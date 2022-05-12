import assert from "assert";
import { Contract, ethers } from "ethers";
import type { Event } from "ethers";
import type {
  TypedEventFilterEthers as TypedEventFilter,
  TypedEventEthers as TypedEvent,
} from "@uma/contracts-frontend";
import { Provider } from "@ethersproject/providers";
import { Signer } from "@ethersproject/abstract-signer";
import * as uma from "@uma/sdk";

export { Provider, Signer, Contract, TypedEventFilter, TypedEvent, Event };

export type Result = ethers.utils.Result;

export interface Callable {
  (...args: any[]): any;
}

export type GetEventType<
  ContractType extends Contract,
  EventName extends string
> = ReturnType<
  ContractType["filters"][EventName] extends Callable
    ? ContractType["filters"][EventName]
    : never
> extends TypedEventFilter<infer T, infer S>
  ? TypedEvent<T & S extends Result ? T & S : any>
  : never;
export enum ChainId {
  MAINNET = 1,
  OPTIMISM = 10,
  ARBITRUM = 42161,
  BOBA = 288,
  POLYGON = 137,
  // testnets
  RINKEBY = 4,
  KOVAN = 42,
  KOVAN_OPTIMISM = 69,
  ARBITRUM_RINKEBY = 421611,
  GOERLI = 5,
  // Polygon testnet
  MUMBAI = 80001,
}

export function isSupportedChainId(chainId: number): chainId is ChainId {
  return chainId in ChainId;
}

assert(
  process.env.REACT_APP_PUBLIC_INFURA_ID,
  "Missing process.env.REACT_APP_PUBLIC_INFURA_ID"
);
export const infuraId = process.env.REACT_APP_PUBLIC_INFURA_ID;

export type ChainInfo = {
  name: string;
  fullName?: string;
  chainId: ChainId;
  rpcUrl?: string;
  explorerUrl: string;
  pollingInterval?: number;
  nativeCurrencySymbol: string;
  earliestBlock: number;
  maxRange?: number;
};
export type ChainInfoList = ChainInfo[];
export type ChainInfoTable = Record<ChainId, ChainInfo>;
export const CHAINS: ChainInfoTable = {
  [ChainId.MAINNET]: {
    name: "Ethereum",
    fullName: "Ethereum Mainnet",
    chainId: ChainId.MAINNET,
    explorerUrl: "https://etherscan.io",
    nativeCurrencySymbol: "ETH",
    earliestBlock: 14704308,
  },
  [ChainId.OPTIMISM]: {
    name: "Optimism",
    chainId: ChainId.OPTIMISM,
    rpcUrl: "https://mainnet.optimism.io",
    explorerUrl: "https://optimistic.etherscan.io",
    nativeCurrencySymbol: "OETH",
    earliestBlock: 6979967,
  },
  [ChainId.ARBITRUM]: {
    name: "Arbitrum",
    fullName: "Arbitrum One",
    chainId: ChainId.ARBITRUM,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
    nativeCurrencySymbol: "AETH",
    earliestBlock: 6979967,
    maxRange: 99999,
  },
  [ChainId.BOBA]: {
    name: "Boba",
    chainId: ChainId.BOBA,
    rpcUrl: "https://mainnet.boba.network",
    explorerUrl: "https://blockexplorer.boba.network",
    nativeCurrencySymbol: "ETH",
    earliestBlock: 551955,
    maxRange: 4999,
  },
  [ChainId.POLYGON]: {
    name: "Polygon",
    fullName: "Polygon Network",
    chainId: ChainId.POLYGON,
    rpcUrl: "https://rpc.ankr.com/polygon",
    explorerUrl: "https://polygonscan.com",
    nativeCurrencySymbol: "MATIC",
    earliestBlock: 27875891,
    maxRange: 3499,
  },
  [ChainId.RINKEBY]: {
    name: "Rinkeby",
    fullName: "Rinkeby Testnet",
    chainId: ChainId.RINKEBY,
    explorerUrl: "https://rinkeby.etherscan.io",
    nativeCurrencySymbol: "ETH",
    earliestBlock: 10365599,
  },
  [ChainId.KOVAN]: {
    name: "Kovan",
    fullName: "Ethereum Testnet Kovan",
    chainId: ChainId.KOVAN,
    explorerUrl: "https://kovan.etherscan.io",
    nativeCurrencySymbol: "KOV",
    earliestBlock: 31457369,
  },
  [ChainId.KOVAN_OPTIMISM]: {
    name: "Optimism Kovan",
    fullName: "Optimism Testnet Kovan",
    chainId: ChainId.KOVAN_OPTIMISM,
    rpcUrl: "https://kovan.optimism.io",
    explorerUrl: "https://kovan-optimistic.etherscan.io",
    nativeCurrencySymbol: "KOR",
    earliestBlock: 2537971,
  },
  [ChainId.ARBITRUM_RINKEBY]: {
    name: "Arbitrum Rinkeby",
    fullName: "Arbitrum Testnet Rinkeby",
    chainId: ChainId.ARBITRUM_RINKEBY,
    explorerUrl: "https://rinkeby-explorer.arbitrum.io",
    rpcUrl: "https://rinkeby.arbitrum.io/rpc",
    nativeCurrencySymbol: "ARETH",
    earliestBlock: 10523275,
    maxRange: 99999,
  },
  [ChainId.GOERLI]: {
    name: "Goerli",
    fullName: "Goerli Testnet",
    chainId: ChainId.GOERLI,
    explorerUrl: "https://goerli.etherscan.io/",
    nativeCurrencySymbol: "ETH",
    earliestBlock: 6860535,
  },
  [ChainId.MUMBAI]: {
    name: "Mumbai",
    chainId: ChainId.MUMBAI,
    rpcUrl: "https://matic-mumbai.chainstacklabs.com",
    explorerUrl: "https://mumbai.polygonscan.com",
    nativeCurrencySymbol: "MATIC",
    earliestBlock: 26276253,
    maxRange: 3499,
  },
};

export function getChainInfo(chainId: number | string): ChainInfo {
  const numericChainId = Number(chainId);
  assert(isSupportedChainId(numericChainId), "Unsupported chain id " + chainId);
  return CHAINS[numericChainId];
}

export const providerUrls: [ChainId, string][] = [
  [ChainId.MAINNET, `https://mainnet.infura.io/v3/${infuraId}`],
  [ChainId.OPTIMISM, `https://optimism-mainnet.infura.io/v3/${infuraId}`],
  [ChainId.ARBITRUM, `https://arbitrum-mainnet.infura.io/v3/${infuraId}`],
  [ChainId.BOBA, `https://mainnet.boba.network`],
  [ChainId.POLYGON, `https://polygon-mainnet.infura.io/v3/${infuraId}`],
  [ChainId.RINKEBY, `https://rinkeby.infura.io/v3/${infuraId}`],
  [ChainId.KOVAN, `https://kovan.infura.io/v3/${infuraId}`],
  [ChainId.KOVAN_OPTIMISM, `https://optimism-kovan.infura.io/v3/${infuraId}`],
  [
    ChainId.ARBITRUM_RINKEBY,
    `https://arbitrum-rinkeby.infura.io/v3/${infuraId}`,
  ],
  [ChainId.GOERLI, `https://goerli.infura.io/v3/${infuraId}`],
  [ChainId.MUMBAI, `https://polygon-mumbai.infura.io/v3/${infuraId}`],
];
export const providerUrlsTable: Record<number, string> =
  Object.fromEntries(providerUrls);

export const providers: [number, ethers.providers.StaticJsonRpcProvider][] =
  providerUrls.map(([chainId, url]) => {
    return [chainId, new ethers.providers.StaticJsonRpcProvider(url)];
  });
export const providersTable: Record<
  number,
  ethers.providers.StaticJsonRpcProvider
> = Object.fromEntries(providers);

export function getProvider(
  chainId: ChainId
): ethers.providers.StaticJsonRpcProvider {
  return providersTable[chainId];
}

export async function incrementalEvents<E>(
  queryEventRange: (start: number, end: number) => Promise<E[]>,
  startBlock: number,
  endBlock: number,
  maxRange?: number
) {
  let rangeState = uma.oracle.utils.rangeStart({
    startBlock,
    endBlock,
    maxRange,
  });
  let result: E[] = [];
  while (!rangeState.done) {
    try {
      const events = await queryEventRange(
        rangeState.currentStart,
        rangeState.currentEnd
      );
      result = result.concat(events);
      rangeState = uma.oracle.utils.rangeSuccessDescending(rangeState);
    } catch (err) {
      console.log("event error", err);
      rangeState = uma.oracle.utils.rangeFailureDescending(rangeState);
    }
  }
  return result;
}
