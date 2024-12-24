import { type Address, privateKeyToAccount } from "viem/accounts";

const faucetPk =
  import.meta.env.VITE_FAUCET_PK ||
  "0x5b41e82ca32231e1403bdf78f1ea476cac266c069bd2ab8793e35959c301ffaf";

export function getFaucetAccount() {
  return privateKeyToAccount(faucetPk as Address);
}
