import type { BaseError } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";

import { client } from "../config";
import { Account } from "../modules/Account";

export function FundViaFaucet({ account }: { account: Account.Account }) {
  const { data, error, ...fundViaFaucetQuery } = Account.useFundViaFaucet({
    client,
  });

  const receiptQuery = useWaitForTransactionReceipt({
    hash: data?.erc20TxHash,
  });

  const isPending =
    receiptQuery.fetchStatus === "fetching" || fundViaFaucetQuery.isPending;
  const isSuccess = receiptQuery.isSuccess && fundViaFaucetQuery.isSuccess;

  return (
    <div>
      <p>Get funded some ETH and USDC from the faucet.</p>
      <button
        disabled={isPending}
        onClick={() =>
          fundViaFaucetQuery.mutate({
            account,
          })
        }
        type="button"
      >
        {isPending ? "Funding..." : "Fund via faucet"}
      </button>
      {error && <p>{(error as BaseError).shortMessage ?? error.message}</p>}
      {isSuccess && (
        <p>
          Funded ETH and USDC ·{" "}
          <a
            href={`${client.chain.blockExplorers.default.url}/tx/${data?.erc20TxHash}`}
            target="_blank"
            rel="noreferrer"
          >
            Explorer
          </a>
        </p>
      )}
    </div>
  );
}
