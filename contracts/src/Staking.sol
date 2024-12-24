pragma solidity ^0.8.0;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Staking {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    event Staked(address indexed caller, address indexed user, uint256 amount);
    event Withdrawn(address indexed user, address indexed recipient, uint256 amount);

    mapping(address => uint256) public userStakes;

    constructor(IERC20 _token) {
        token = _token;
    }

    function stake(uint256 amount) external {
        stakeFor(msg.sender, amount);
    }

    function stakeFor(address user, uint256 amount) public {
        userStakes[user] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, user, amount);
    }

    function withdraw(uint256 amount) external {
        withdrawTo(msg.sender, amount);
    }

    function withdrawTo(address recipient, uint256 amount) public {
        userStakes[msg.sender] -= amount;
        token.safeTransfer(recipient, amount);
        emit Withdrawn(msg.sender, recipient, amount);
    }
}
