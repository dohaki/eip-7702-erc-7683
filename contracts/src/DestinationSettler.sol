pragma solidity ^0.8.0;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GaslessCrossChainOrder} from "./ERC7683.sol";
import {CallByUser, Call} from "./Structs.sol";
import {ResolvedCrossChainOrderLib} from "./ResolvedCrossChainOrderLib.sol";
import {ExperimentalDelegation} from "./account/ExperimentalDelegation.sol";
import {SignatureVerification} from "./SignatureVerification.sol";

/**
 * @notice Destination chain entrypoint contract for fillers relaying cross chain message containing delegated
 * calldata.
 * @dev The difference between this contract and the DestinationSettler.sol contract is that this contract
 * performs all the CallByUser signature verification rather than having the XAccount contract do it. This reduces
 * gas costs in the `fill()` function but it does mean that all users must trust the DestinationSettler
 * contract since it performs the signature verification. Unlike this contract, the DestinationSettler.sol contract
 * can be swapped out for another settlement contract because the XAccount provides the signature verification
 * protection for the user. As a result, the XAccount smart contract wallet used by this settler is much more
 * lightweight than the one used by the DestinationSettler.sol contract.
 */
contract DestinationSettler is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Store unique orders to prevent duplicate fills for the same order.
    mapping(bytes32 => bool) public fillStatuses;

    event Executed(bytes32 indexed orderId);

    error InvalidOrderId();
    error DuplicateFill();
    error InvalidUserSignature();
    error InvalidExecutionChainId();

    // Called by filler, who sees ERC7683 intent emitted on origin chain
    // containing the callsByUser data to be executed following a 7702 delegation.
    // @dev We don't use the last parameter `fillerData` in this function.
    function fill(bytes32 orderId, bytes calldata originData, bytes calldata) external nonReentrant {
        (CallByUser memory callsByUser) = abi.decode(originData, (CallByUser));
        if (ResolvedCrossChainOrderLib.getOrderId(callsByUser) != orderId) revert InvalidOrderId();

        // Protect against duplicate fills.
        if (fillStatuses[orderId]) revert DuplicateFill();
        fillStatuses[orderId] = true;

        // TODO: Protect fillers from collisions with other fillers. Requires letting user set an exclusive relayer.

        // Pull funds into this settlement contract and perform any steps necessary to ensure that filler
        // receives a refund of their assets.
        _fundUser(callsByUser);

        _verifyCalls(callsByUser);
        _verify7702Delegation();

        // The following call will only succeed if the user has set a 7702 authorization to set its code
        // equal to the XAccount contract. The filler should have seen any auth data emitted in an OriginSettler
        // event on the sending chain.
        ExperimentalDelegation(payable(callsByUser.user)).xExecute(callsByUser);

        // Perform any final steps required to prove that filler has successfully filled the ERC7683 intent.
        // For example, we could emit an event containing a unique hash of the fill that could be proved
        // on the origin chain via a receipt proof + RIP7755.
        // e.g. emit Executed(orderId)
        emit Executed(orderId);
    }

    // Pull funds into this settlement contract as escrow and use to execute user's calldata. Escrowed
    // funds will be paid back to filler after this contract successfully verifies the settled intent.
    // This step could be skipped by lightweight escrow systems that don't need to perform additional
    // validation on the filler's actions.
    function _fundUser(CallByUser memory call) internal {
        IERC20(call.asset.token).safeTransferFrom(msg.sender, call.user, call.asset.amount);
    }

    function _verifyCalls(CallByUser memory userCalls) internal view {
        if (userCalls.chainId != block.chainid) revert InvalidExecutionChainId();
        // TODO: Make the blob to sign EIP712-compatible (i.e. instead of keccak256(abi.encode(...)) set
        // this to SigningLib.getTypedDataHash(...)

        // Get the associated authorized public keys for the user. Assumes the target has `getKeys` similar to that in ExperimentalDelegation.
        ExperimentalDelegation userAccount = ExperimentalDelegation(payable(userCalls.user));
        SignatureVerification.Key[] memory keys = userAccount.getKeys();
        SignatureVerification.WrappedSignature memory wrappedSignature =
            SignatureVerification.parseSignature(userCalls.signature);
        SignatureVerification.Key memory authorizingKey = keys[wrappedSignature.keyIndex];

        bytes32 digest = keccak256(abi.encodePacked(userAccount.nonce(), abi.encode(userCalls)));
        SignatureVerification.assertSignature(digest, userCalls.signature, authorizingKey);
    }

    function _verify7702Delegation() internal {
        // TODO: We might not need this function at all, because if the authorization data requires that this contract
        // is set as the delegation code, then xExecute would fail if the auth data is not submitted by the filler.
        // However, it might still be useful to verify that the delegate is set correctly, like checking EXTCODEHASH.
    }
}
