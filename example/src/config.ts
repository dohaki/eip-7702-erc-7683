import { QueryClient } from "@tanstack/react-query";
import { defineChain } from "viem";
import { http, createConfig } from "wagmi";
import { odysseyTestnet } from "wagmi/chains";

export const odysseyTestnet2 = /*#__PURE__*/ defineChain({
  id: 9118672,
  name: "Odyssey Testnet 2",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-odyssey-2.t.conduit.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Blockexplorer",
      url: "https://explorer-odyssey-2.t.conduit.xyz",
    },
  },
  contracts: {
    accountDelegation: {
      address: "0x1F5AA71C79ec6a11FC55789ed32dAE3B64d75791",
    },
  },
});

export const destinationChain = odysseyTestnet2;
export const originChain = odysseyTestnet;

export const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [odysseyTestnet, odysseyTestnet2],
  pollingInterval: 1000,
  transports: {
    [odysseyTestnet.id]: http(),
    [odysseyTestnet2.id]: http(),
  },
});

export const client = wagmiConfig.getClient();
export type Client = typeof client;
