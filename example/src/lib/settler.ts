import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  keccak256,
} from "viem";
import { addresses, ExperimentERC20, Staking } from "../contracts";
import { odysseyTestnet2 } from "../config";

type Asset = {
  token: Address;
  amount: bigint;
};

type Call = {
  target: Address;
  callData: Hex;
  value: bigint;
};

export type CallByUser = {
  user: Address;
  nonce: bigint;
  asset: Asset;
  chainId: bigint;
  signature: Hex;
  calls: Call[];
};

export function encodeStakingCalls(params: { amount: bigint; user: Address }) {
  const stakingCalls = [
    {
      target: addresses[odysseyTestnet2.id].erc20 as Address,
      callData: encodeFunctionData({
        abi: ExperimentERC20.abi,
        functionName: "approve",
        args: [Staking.address, params.amount],
      }),
      value: 0n,
    },
    {
      target: Staking.address as Address,
      callData: encodeFunctionData({
        abi: Staking.abi,
        functionName: "stake",
        args: [params.amount],
      }),
      value: 0n,
    },
  ];

  return stakingCalls;
}

export function encodeCallByUserCalls(
  calls: CallByUser["calls"],
  nonce: bigint
) {
  // Encode the calls.
  const encodedCalls = encodeAbiParameters(
    [
      {
        internalType: "struct Call[]",
        name: "calls",
        type: "tuple[]",
        components: [
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
      },
    ],
    [calls]
  );

  // Construct the signing payload.
  const payload = keccak256(
    encodePacked(["uint256", "bytes"], [nonce, encodedCalls])
  );

  return payload;
}

export function encodeCallByUser(callByUser: CallByUser) {
  const encoded = encodeAbiParameters(
    [
      {
        type: "tuple",
        name: "CallByUser",
        components: [
          {
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256",
          },
          {
            internalType: "struct Asset",
            name: "asset",
            type: "tuple",
            components: [
              {
                internalType: "address",
                name: "token",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
              },
            ],
          },
          {
            internalType: "uint64",
            name: "chainId",
            type: "uint64",
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes",
          },
          {
            internalType: "struct Call[]",
            name: "calls",
            type: "tuple[]",
            components: [
              {
                internalType: "address",
                name: "target",
                type: "address",
              },
              {
                internalType: "bytes",
                name: "callData",
                type: "bytes",
              },
              {
                internalType: "uint256",
                name: "value",
                type: "uint256",
              },
            ],
          },
        ],
      },
    ],
    [callByUser]
  );
  return encoded;
}

export function encodeEIP7702AuthData(authData: {
  authlist: {
    chainId: bigint;
    codeAddress: Address;
    nonce: bigint;
    signature: Hex;
  }[];
}) {
  const encoded = encodeAbiParameters(
    [
      {
        type: "tuple",
        name: "EIP7702AuthData",
        components: [
          {
            internalType: "struct Authorization[]",
            name: "authlist",
            type: "tuple[]",
            components: [
              {
                internalType: "uint256",
                name: "chainId",
                type: "uint256",
              },
              {
                internalType: "address",
                name: "codeAddress",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "bytes",
                name: "signature",
                type: "bytes",
              },
            ],
          },
        ],
      },
    ],
    [authData]
  );

  return encoded;
}

export function encodeAsset(asset: Asset) {
  const encoded = encodeAbiParameters(
    [
      {
        name: "Asset",
        type: "tuple",
        components: [
          {
            internalType: "address",
            name: "token",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
      },
    ],
    [asset]
  );
  return encoded;
}

export function encodeOrderData(orderData: {
  callByUser: CallByUser;
  authData: {
    authlist: {
      chainId: bigint;
      codeAddress: Address;
      nonce: bigint;
      signature: Hex;
    }[];
  };
  asset: Asset;
}) {
  const types = [
    {
      name: "calls",
      type: "tuple",
      components: [
        { name: "user", type: "address" },
        { name: "nonce", type: "uint256" },
        {
          name: "asset",
          type: "tuple",
          components: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
        { name: "chainId", type: "uint64" },
        { name: "signature", type: "bytes" },
        {
          name: "calls",
          type: "tuple[]",
          components: [
            { name: "target", type: "address" },
            { name: "callData", type: "bytes" },
            { name: "value", type: "uint256" },
          ],
        },
      ],
    },
    {
      name: "authData",
      type: "tuple",
      components: [
        {
          name: "authlist",
          type: "tuple[]",
          components: [
            { name: "chainId", type: "uint256" },
            { name: "codeAddress", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "signature", type: "bytes" },
          ],
        },
      ],
    },
    {
      name: "inputAsset",
      type: "tuple",
      components: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    },
  ];

  const encoded = encodeAbiParameters(types, [
    orderData.callByUser,
    orderData.authData,
    orderData.asset,
  ]);
  return encoded;
}
