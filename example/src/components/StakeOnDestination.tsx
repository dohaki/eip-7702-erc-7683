import type { BaseError } from "viem";

import { client } from "../config";
import { Account } from "../modules/Account";

export function SetDelegation({ account }: { account: Account.Account }) {
  const {
    data: delegation,
    error,
    ...setDelegationMutation
  } = Account.useSetDelegation({
    client,
  });

  const isPending = setDelegationMutation.isPending;
  const isSuccess = setDelegationMutation.isSuccess;

  return (
    <div>
      <p>Stake on the destination chain</p>
      <button
        disabled={
          isPending || isSuccess || Boolean(account.authTransactionHash)
        }
        onClick={() =>
          setDelegationMutation.mutate({
            chainId: 0,
            useSequencerGasSponsor: false,
          })
        }
        type="button"
      >
        {isPending ? "Delegating..." : "Set Delegation"}
      </button>
      {error && <p>{(error as BaseError).shortMessage ?? error.message}</p>}
      {(isSuccess || account.authTransactionHash) && (
        <p>
          Delegation set ·{" "}
          <a
            href={`${client.chain.blockExplorers.default.url}/tx/${account.authTransactionHash}`}
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
