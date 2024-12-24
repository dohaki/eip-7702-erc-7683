import type { BaseError, Hex } from "viem";
import { useState } from "react";
import { client } from "../config";
import { Account } from "../modules/Account";

// This should eventually be set to 0
const destinationChainId = 9118672;

export function InitializeAccount() {
  const [privateKey, setPrivateKey] = useState<Hex | undefined>(undefined);

  const { data: hash, ...createMutation } = Account.useCreateAndAuthorize({
    client,
  });
  const { data: preppedAuthorization, ...createAndPrepMutation } =
    Account.useCreateAndPrepAuthorization({
      client,
    });
  const loadMutation = Account.useLoad({ client });

  const isPending = createMutation.isPending || loadMutation.isPending;
  const error = createMutation.error || loadMutation.error;

  return (
    <div>
      <p>
        <button
          disabled={isPending}
          onClick={() =>
            createAndPrepMutation.mutate({ chainId: destinationChainId })
          }
          type="button"
        >
          Register with new private key
        </button>
      </p>
      <p>
        <input
          type="text"
          placeholder="Private key"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value as Hex)}
        />
        <button
          disabled={isPending}
          onClick={() =>
            createAndPrepMutation.mutate({
              chainId: destinationChainId,
              privateKey,
            })
          }
          type="button"
        >
          Register with existing private key
        </button>
      </p>
      <button
        disabled={isPending}
        onClick={() => loadMutation.mutate()}
        type="button"
      >
        Sign In
      </button>
      {hash && (
        <p>
          Account created!{" "}
          <a
            href={`${client.chain.blockExplorers.default.url}/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Explorer
          </a>
        </p>
      )}
      {error && <p>{(error as BaseError).shortMessage ?? error.message}</p>}
    </div>
  );
}
