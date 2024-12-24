import { useMutation, useQuery as useQuery_ } from "@tanstack/react-query";
import {
  type Address,
  type GetCodeReturnType,
  type Hex,
  type PrivateKeyAccount,
  bytesToHex,
  concat,
  encodePacked,
  hexToBytes,
  keccak256,
  parseEther,
  parseSignature,
  size,
  slice,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  getCode,
  readContract,
  sendTransaction,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import {
  signAuthorization,
  type SignAuthorizationReturnType,
} from "viem/experimental";
import {
  type PublicKey,
  createCredential,
  parsePublicKey,
  sign,
} from "webauthn-p256";

import { type Client, queryClient } from "../config";
import { ExperimentDelegation, ExperimentERC20 } from "../contracts";
import { getFaucetAccount } from "../lib/faucet";

export namespace Account {
  /////////////////////////////////////////////////////////
  // Types
  /////////////////////////////////////////////////////////

  export type Account = {
    address: Address;
    authTransactionHash?: Hex;
    // Should not be stored in the query client but doing so for now for demo purposes.
    privateKey: Hex;
    key: {
      id: string;
      publicKey: {
        x: bigint;
        y: bigint;
      };
    };
  };

  export type Calls = { to: Address; value?: bigint; data?: Hex }[];

  /////////////////////////////////////////////////////////
  // Actions
  /////////////////////////////////////////////////////////

  /**
   * Generates a new EOA and injects the ExperimentDelegation contract onto it
   * with an authorized WebAuthn public key.
   */
  export async function createAndAuthorize({
    client,
    chainId,
    privateKey,
  }: {
    client: Client;
    chainId?: number;
    privateKey?: Hex;
  }) {
    const { account, credential, publicKey } =
      await createWalletAndWebAuthnCredential(privateKey);

    // Authorize the WebAuthn key on the EOA.
    const { hash, signature, authorization } = await authorize({
      account,
      client,
      publicKey,
      chainId,
    });

    await waitForTransactionReceipt(client, { hash });

    queryClient.setQueryData(["account"], {
      address: account.address,
      authTransactionHash: hash,
      key: {
        id: credential.id,
        publicKey,
      },
    });
    queryClient.setQueryData(["authorization", account.address, chainId], {
      authorization,
      signature,
    });

    return hash;
  }

  export async function setDelegation({
    client,
    chainId,
    useSequencerGasSponsor = true,
  }: {
    client: Client;
    chainId?: number;
    useSequencerGasSponsor?: boolean;
  }) {
    const expiry = 0n;
    const account = queryClient.getQueryData(["account"]) as Account;
    const { authorization, signature } = queryClient.getQueryData([
      "authorization",
      account.address,
      chainId,
    ]) as {
      authorization: SignAuthorizationReturnType;
      signature: ReturnType<typeof parseSignature>;
    };

    const hash = await sendAuthorizeTx({
      authorization,
      signature,
      expiry,
      account: privateKeyToAccount(account.privateKey),
      client,
      publicKey: account.key.publicKey!,
      useSequencerGasSponsor,
    });

    await waitForTransactionReceipt(client, { hash });
    const { key, ...restAccount } = queryClient.getQueryData([
      "account",
    ]) as Account;

    queryClient.setQueryData(["account"], {
      ...restAccount,
      authTransactionHash: hash,
      key: {
        ...key,
        id: key.id,
      },
    });

    return hash;
  }

  export async function createAndPrepAuthorization({
    client,
    chainId,
    privateKey: _privateKey,
  }: {
    client: Client;
    chainId?: number;
    privateKey?: Hex;
  }) {
    const { account, publicKey, credential, privateKey } =
      await createWalletAndWebAuthnCredential(_privateKey);

    const { authorization, signature } = await prepareAuthorize({
      account,
      client,
      publicKey,
      chainId,
    });

    queryClient.setQueryData(["account"], {
      address: account.address,
      privateKey,
      key: {
        id: credential.id,
        publicKey,
      },
    });
    queryClient.setQueryData(["authorization", account.address, chainId], {
      authorization,
      signature,
    });

    return {
      authorization,
      signature,
    };
  }

  export async function createWalletAndWebAuthnCredential(_privateKey?: Hex) {
    // Generate a new EOA or use an existing one. This Account will be used to inject the ExperimentDelegation
    // contract onto it.
    const privateKey = _privateKey ?? generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    // Create a WebAuthn credential which will be used as an authorized key
    // for the EOA.
    const credential = await createCredential({
      user: {
        name: `Example Delegation (${truncate(account.address)})`,
        id: hexToBytes(account.address),
      },
    });

    const publicKey = parsePublicKey(credential.publicKey);

    return {
      account,
      privateKey,
      credential,
      publicKey,
    };
  }

  export async function prepareAuthorize({
    account,
    client,
    publicKey,
    nonce = 0n,
    chainId,
    useSequencerGasSponsor = true,
  }: {
    account: PrivateKeyAccount;
    client: Client;
    publicKey: PublicKey;
    nonce?: bigint;
    chainId?: number;
    useSequencerGasSponsor?: boolean;
  }) {
    const expiry = 0n; // no expiry

    // Compute digest to sign for the authorize function.
    const digest = keccak256(
      encodePacked(
        ["uint256", "uint256", "uint256", "uint256"],
        [nonce, publicKey.x, publicKey.y, expiry]
      )
    );

    // Sign the authorize digest and parse signature to object format required by
    // the contract.
    const signature = parseSignature(await account.sign({ hash: digest }));

    // Sign an EIP-7702 authorization to inject the ExperimentDelegation contract
    // onto the EOA.
    const authorization = await signAuthorization(client, {
      account,
      contractAddress: ExperimentDelegation.address,
      delegate: useSequencerGasSponsor ? true : undefined,
      chainId,
    });

    return {
      authorization,
      signature,
    };
  }

  export async function sendAuthorizeTx({
    authorization,
    signature,
    expiry,
    account,
    client,
    publicKey,
    useSequencerGasSponsor = true,
  }: {
    authorization: SignAuthorizationReturnType;
    signature: ReturnType<typeof parseSignature>;
    expiry: bigint;
    account: PrivateKeyAccount;
    client: Client;
    publicKey: PublicKey;
    useSequencerGasSponsor?: boolean;
  }) {
    try {
      // Send an EIP-7702 contract write to authorize the WebAuthn key on the EOA.
      const hash = await writeContract(client, {
        abi: ExperimentDelegation.abi,
        address: account.address,
        functionName: "authorize",
        args: [
          {
            x: publicKey.x,
            y: publicKey.y,
          },
          expiry,
          {
            r: BigInt(signature.r),
            s: BigInt(signature.s),
            yParity: signature.yParity,
          },
        ],
        authorizationList: [authorization],
        account: useSequencerGasSponsor ? null : account,
        chain: client.chain,
      });

      return hash;
    } catch (error) {
      console.error("Error sending authorize transaction", error);
      throw error;
    }
  }

  /**
   * Authorizes a WebAuthn public key on an EOA by sending an EIP-7702 authorization
   * transaction to inject the ExperimentDelegation contract onto it.
   */
  export async function authorize({
    account,
    client,
    publicKey,
    chainId,
  }: {
    account: PrivateKeyAccount;
    client: Client;
    publicKey: PublicKey;
    chainId?: number;
  }) {
    const nonce = 0n; // initial nonce will always be 0
    const expiry = 0n; // no expiry

    const { authorization, signature } = await prepareAuthorize({
      account,
      client,
      publicKey,
      nonce,
      chainId,
    });

    const hash = await sendAuthorizeTx({
      authorization,
      signature,
      expiry,
      account,
      client,
      publicKey,
    });

    return {
      hash,
      signature,
      authorization,
    };
  }

  /**
   * Imports an existing EOA that holds an authorized WebAuthn public key
   * into account state.
   */
  export async function load({ client }: { client: Client }) {
    // Sign an empty hash to extract the user's WebAuthn credential.
    const { raw } = await sign({
      hash: "0x",
    });

    // Extract the EOA address from the WebAuthn user handle.
    const response = raw.response as AuthenticatorAssertionResponse;
    const address = bytesToHex(new Uint8Array(response.userHandle!));

    // Extract the authorized WebAuthn key from the delegated EOA's contract.
    const [, , publicKey] = await readContract(client, {
      address,
      abi: ExperimentDelegation.abi,
      functionName: "keys",
      args: [0n],
    });
    queryClient.setQueryData(["account"], {
      address,
      key: {
        id: raw.id,
        publicKey,
      },
    });
  }

  export async function fundViaFaucet({
    account,
    client,
  }: {
    account: Account;
    client: Client;
  }) {
    const faucetAccount = getFaucetAccount();
    const ethTxHash = await sendTransaction(client, {
      to: account.address,
      value: parseEther("0.001"),
      account: faucetAccount,
    });
    await waitForTransactionReceipt(client, { hash: ethTxHash });

    const erc20TxHash = await writeContract(client, {
      abi: ExperimentERC20.abi,
      address: ExperimentERC20.address,
      functionName: "mint",
      args: [account.address, parseEther("100")],
      account: faucetAccount,
    });

    return {
      ethTxHash,
      erc20TxHash,
    };
  }

  /**
   * Executes calls with the delegated EOA's WebAuthn credential.
   */
  export async function execute({
    account,
    calls,
    client,
  }: {
    account: Account;
    calls: Calls;
    client: Client;
  }) {
    // Fetch the next available nonce from the delegated EOA's contract.
    const nonce = await readContract(client, {
      abi: ExperimentDelegation.abi,
      address: account.address,
      functionName: "nonce",
    });

    // Encode calls into format required by the contract.
    const calls_encoded = concat(
      calls.map((call) =>
        encodePacked(
          ["uint8", "address", "uint256", "uint256", "bytes"],
          [
            0,
            call.to,
            call.value ?? 0n,
            BigInt(size(call.data ?? "0x")),
            call.data ?? "0x",
          ]
        )
      )
    );

    // Compute digest to sign for the execute function.
    const digest = keccak256(
      encodePacked(["uint256", "bytes"], [nonce, calls_encoded])
    );

    // Sign the digest with the authorized WebAuthn key.
    const { signature, webauthn } = await sign({
      hash: digest,
      credentialId: account.key.id,
    });

    // Extract r and s values from signature.
    const r = BigInt(slice(signature, 0, 32));
    const s = BigInt(slice(signature, 32, 64));

    // Execute calls.
    return await writeContract(client, {
      abi: ExperimentDelegation.abi,
      address: account.address,
      functionName: "execute",
      args: [calls_encoded, { r, s }, webauthn, 0],
      account: null, // defer to sequencer to fill
    });
  }

  /////////////////////////////////////////////////////////
  // Query
  /////////////////////////////////////////////////////////

  export function useAccountQuery() {
    return useQuery_<Account>({
      queryKey: ["account"],
    });
  }

  export function useGetCodeQuery({
    client,
    address,
  }: {
    client: Client;
    address: Address;
  }) {
    return useQuery_<GetCodeReturnType>({
      queryKey: ["code", address],
      queryFn: () => getCode(client, { address }),
    });
  }

  export function useCreateAndAuthorize({ client }: { client: Client }) {
    return useMutation({
      mutationFn: async () => await createAndAuthorize({ client }),
    });
  }

  export function useCreateAndPrepAuthorization({
    client,
  }: {
    client: Client;
  }) {
    return useMutation({
      mutationFn: async ({
        chainId,
        privateKey,
      }: {
        chainId?: number;
        privateKey?: Hex;
      }) => await createAndPrepAuthorization({ client, chainId, privateKey }),
    });
  }

  export function useSetDelegation({ client }: { client: Client }) {
    return useMutation({
      mutationFn: async ({
        chainId,
        useSequencerGasSponsor,
      }: {
        chainId?: number;
        useSequencerGasSponsor?: boolean;
      }) => await setDelegation({ client, chainId, useSequencerGasSponsor }),
    });
  }

  export function useExecute({ client }: { client: Client }) {
    return useMutation({
      mutationFn: async ({
        account,
        calls,
      }: {
        account: Account;
        calls: Calls;
      }) => await execute({ account, calls, client }),
    });
  }

  export function useFundViaFaucet({ client }: { client: Client }) {
    return useMutation({
      mutationFn: async ({ account }: { account: Account }) =>
        await fundViaFaucet({ account, client }),
    });
  }

  export function useLoad({ client }: { client: Client }) {
    return useMutation({
      mutationFn: async () => await load({ client }),
    });
  }
}

function truncate(
  str: string,
  { start = 8, end = 6 }: { start?: number; end?: number } = {}
) {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}\u2026${str.slice(-end)}`;
}
