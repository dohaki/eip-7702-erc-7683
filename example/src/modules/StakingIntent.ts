import {
  type Address,
  type Hex,
  type PrivateKeyAccount,
  concat,
  createPublicClient,
  http,
  toHex,
  encodeFunctionData,
  createWalletClient,
  maxUint32,
  keccak256,
} from "viem";
import type { SignAuthorizationReturnType } from "viem/experimental";

import {
  destinationChain,
  odysseyTestnet2,
  originChain,
  queryClient,
} from "../config";
import {
  addresses,
  ExperimentDelegation,
  ExperimentERC20,
  OriginSettler,
} from "../contracts";
import {
  encodeAsset,
  encodeCallByUserCalls,
  encodeEIP7702AuthData,
  encodeOrderData,
} from "../lib/settler";
import { encodeStakingCalls } from "../lib/settler";

export namespace StakingIntent {
  export async function createAndSignStakeIntent({
    account,
    amount,
  }: {
    account: PrivateKeyAccount;
    amount: bigint;
  }) {
    const publicClient = createPublicClient({
      chain: destinationChain,
      transport: http(),
    });

    let destinationNonce = 0n;
    try {
      destinationNonce = await publicClient.readContract({
        ...ExperimentDelegation,
        functionName: "nonce",
        address: account.address,
      });
    } catch (error) {
      console.warn("Failed to get destination nonce", error);
      destinationNonce = 0n;
    }
    console.log("@@@", { destinationNonce });

    const encodedStakingCalls = encodeStakingCalls({
      amount,
      user: account.address,
    });
    const encodedCallByUserCalls = encodeCallByUserCalls(
      encodedStakingCalls,
      destinationNonce
    );
    const { authorization, signature } = queryClient.getQueryData([
      "authorization",
      account.address,
      destinationChain.id,
    ]) as {
      authorization: SignAuthorizationReturnType;
      signature:
        | {
            r: `0x${string}`;
            s: `0x${string}`;
            v: bigint;
            yParity: number;
          }
        | {
            r: `0x${string}`;
            s: `0x${string}`;
            yParity: number;
            v?: never;
          };
    };

    const eip7702AuthData = {
      authlist: [
        {
          chainId: BigInt(authorization.chainId),
          codeAddress: authorization.contractAddress,
          nonce: BigInt(authorization.nonce),
          // serialize signature as hex
          signature: concat([
            signature.r,
            signature.s,
            toHex(signature.yParity),
          ]),
        },
      ],
    };

    const destinationCallsSignature = await account.sign({
      hash: encodedCallByUserCalls,
    });
    const destinationCallByUser = {
      user: account.address,
      nonce: destinationNonce,
      // input token
      asset: {
        token: addresses[originChain.id].erc20 as Address,
        amount,
      },
      chainId: BigInt(odysseyTestnet2.id),
      signature: destinationCallsSignature,
      calls: encodedStakingCalls,
    };
    const encodedEIP7702AuthData = encodeEIP7702AuthData(eip7702AuthData);
    const encodedAsset = encodeAsset(destinationCallByUser.asset);
    const encodedOrderData = encodeOrderData({
      callByUser: destinationCallByUser,
      authData: eip7702AuthData,
      asset: destinationCallByUser.asset,
    });

    return {
      encodedOrderData,
      encodedEIP7702AuthData,
      encodedAsset,
      encodedCallByUser: destinationCallByUser,
      amount,
    };
  }

  export async function openStakeOrder({
    account,
    encodedOrderData,
    encodedEIP7702AuthData,
    encodedAsset,
    encodedCallByUser,
    amount,
  }: {
    account: PrivateKeyAccount;
    encodedOrderData: Hex;
    encodedEIP7702AuthData: Hex;
    encodedAsset: Hex;
    encodedCallByUser: Hex;
    amount: bigint;
  }) {
    const wallet = createWalletClient({
      account,
      chain: originChain,
      transport: http(),
    });
    const originClient = createPublicClient({
      chain: originChain,
      transport: http(),
    });

    // TODO: Batch
    const allowance = await originClient.readContract({
      ...ExperimentERC20,
      address: addresses[originChain.id].erc20 as Address,
      functionName: "allowance",
      args: [account.address, OriginSettler.address],
    });
    if (allowance < amount) {
      const approvalTxHash = await wallet.sendTransaction({
        to: addresses[originChain.id].erc20 as Address,
        data: encodeFunctionData({
          abi: ExperimentERC20.abi,
          functionName: "approve",
          args: [OriginSettler.address, amount],
        }),
      });
      await originClient.waitForTransactionReceipt({
        hash: approvalTxHash,
      });
    }

    const openTxHash = await wallet.sendTransaction({
      to: OriginSettler.address,
      data: encodeFunctionData({
        abi: OriginSettler.abi,
        functionName: "open",
        args: [
          {
            fillDeadline: maxUint32,
            orderDataType: keccak256(toHex("TODO")),
            orderData: encodedOrderData,
          },
        ],
      }),
    });
    return {
      openTxHash,
    };
  }
}
