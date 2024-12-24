import { AccountDetails } from "./components/AccountDetails";
import { FundViaFaucet } from "./components/FundViaFaucet";
import { InitializeAccount } from "./components/InitializeAccount";
import { SetDelegation } from "./components/SetDelegation";
import { destinationChain, originChain } from "./config";
import { Account } from "./modules/Account";

export function App() {
  const { data: account } = Account.useAccountQuery();

  return (
    <div>
      <h1>Example ERC-7683 X EIP-7702</h1>

      <p>
        <strong>Origin chain:</strong> {originChain.name} ({originChain.id})
        {" · "}
        <a
          href={originChain.blockExplorers?.default.url}
          target="_blank"
          rel="noreferrer"
        >
          Explorer
        </a>
      </p>

      <p>
        <strong>Destination chain:</strong> {destinationChain.name} (
        {destinationChain.id}){" · "}
        <a
          href={destinationChain.blockExplorers?.default.url}
          target="_blank"
          rel="noreferrer"
        >
          Explorer
        </a>
      </p>

      <h2>1. Initialize</h2>
      <p>
        Initialize a new EOA controlled by a WebAuthn key. You can either create
        a new one or use an existing.
      </p>
      <InitializeAccount />

      {account && (
        <>
          <h2>2. Account</h2>
          <AccountDetails account={account} />

          <h2>3. Fund via Faucet</h2>
          <FundViaFaucet account={account} />

          <h2>4. Open 7683 order</h2>
          <SetDelegation account={account} />
        </>
      )}
    </div>
  );
}
