import { formatEther } from "viem";
import { useBalance, useReadContract } from "wagmi";

import { client } from "../config";
import { ExperimentERC20 } from "../contracts";
import type { Account } from "../modules/Account";

export function AccountDetails({ account }: { account: Account.Account }) {
  const { data: expBalance } = useReadContract({
    ...ExperimentERC20,
    functionName: "balanceOf",
    args: [account.address],
    query: {
      refetchInterval: 1000,
    },
  });
  const { data: ethBalance } = useBalance({
    address: account.address,
    query: {
      refetchInterval: 1000,
    },
  });

  return (
    <div>
      <div>
        <strong>Address:</strong> <code>{account.address}</code> {" · "}
        <a
          href={`${client.chain.blockExplorers.default.url}/address/${account.address}`}
          target="_blank"
          rel="noreferrer"
        >
          Explorer
        </a>
      </div>
      <div>
        <strong>ETH Balance:</strong>{" "}
        {typeof ethBalance === "object" && (
          <code>{formatEth(ethBalance.value)} ETH</code>
        )}
      </div>
      <div>
        <strong>ERC20 Balance:</strong>{" "}
        {typeof expBalance === "bigint" && (
          <code>{formatEth(expBalance)} USDC</code>
        )}
      </div>
    </div>
  );
}

const numberIntl = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 6,
});

export function formatEth(wei: bigint) {
  return numberIntl.format(Number(formatEther(wei)));
}
