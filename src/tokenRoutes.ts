import assert from "assert";
import bluebird from "bluebird";
import {
  getProvider,
  ChainId,
  GetEventType,
  Provider,
  Event,
  isSupportedChainId,
  getChainInfo,
  incrementalEvents,
} from "./utils";
import {
  ERC20__factory,
  HubPool,
  HubPool__factory,
  SpokePool,
  SpokePool__factory,
  getDeployedAddress,
  getDeployedBlockNumber,
} from "@across-protocol/contracts-v2";

// event types
type L1TokenEnabledForLiquidityProvision = GetEventType<
  HubPool,
  "L1TokenEnabledForLiquidityProvision"
>;
type L2TokenDisabledForLiquidityProvision = GetEventType<
  HubPool,
  "L2TokenDisabledForLiquidityProvision"
>;
type SetEnableDepositRoute = GetEventType<HubPool, "SetEnableDepositRoute">;
type CrossChainContractsSet = GetEventType<HubPool, "CrossChainContractsSet">;
type SetPoolRebalanceRoute = GetEventType<HubPool, "SetPoolRebalanceRoute">;
type EnabledDepositRoute = GetEventType<SpokePool, "EnabledDepositRoute">;

type HubPoolEvent =
  | L1TokenEnabledForLiquidityProvision
  | L2TokenDisabledForLiquidityProvision
  | SetEnableDepositRoute
  | CrossChainContractsSet
  | SetPoolRebalanceRoute;

type SpokePoolEvent = EnabledDepositRoute;

// return object
export interface Route {
  fromChain: number;
  toChain: number;
  fromTokenAddress: string;
  fromSpokeAddress: string;
  fromTokenSymbol: string;
  isNative: boolean;
  l1TokenAddress: string;
}
export type Routes = Route[];

// type the hub pool events
export function isSetEnableDepositRoute(
  event: Event
): event is SetEnableDepositRoute {
  return event.event === "SetEnableDepositRoute";
}
export function isCrossChainContractsSet(
  event: Event
): event is CrossChainContractsSet {
  return event.event === "CrossChainContractsSet";
}
export function isL1TokenEnabledForLiquidityProvision(
  event: Event
): event is L1TokenEnabledForLiquidityProvision {
  return event.event === "L1TokenEnabledForLiquidityProvision";
}
export function isL2TokenDisabledForLiquidityProvision(
  event: Event
): event is L2TokenDisabledForLiquidityProvision {
  return event.event === "L2TokenDisabledForLiquidityProvision";
}

export function isSetPoolRebalanceRoute(
  event: Event
): event is SetPoolRebalanceRoute {
  return event.event === "SetPoolRebalanceRoute";
}
// type the spoke pool events
export function isEnabledDepositRoute(
  event: Event
): event is EnabledDepositRoute {
  return event.event === "EnabledDepositRoute";
}

export class SpokePoolUtils {
  public readonly contract: SpokePool;
  private events: SpokePoolEvent[] = [];
  public wrappedNativeToken: string | void = undefined;
  constructor(
    public readonly address: string,
    public readonly provider: Provider,
    private startBlock = 0,
    private maxRange?: number
  ) {
    this.contract = SpokePool__factory.connect(address, provider);
  }
  async update() {
    await this.fetchEvents();
    try {
      this.wrappedNativeToken = await this.contract.wrappedNativeToken();
    } catch {
      this.wrappedNativeToken = "0x4200000000000000000000000000000000000006";
    }
  }
  async fetchEvents(): Promise<Array<SpokePoolEvent>> {
    const latestBlock = await this.provider.getBlockNumber();
    const chainId = await this.provider.getNetwork();
    const maxRange = this.maxRange;
    const startBlock = this.startBlock;
    const queries = [
      incrementalEvents(
        (startBlock: number, endBlock: number) => {
          return this.contract.queryFilter(
            this.contract.filters.EnabledDepositRoute(),
            startBlock,
            endBlock
          );
        },
        startBlock,
        latestBlock,
        maxRange
      ),
    ];
    this.events = (await bluebird.mapSeries(queries, (x) => x)).flat();
    return this.events;
  }
  routesEnabled(): Record<string, string[]> {
    const init: Record<string, Set<string>> = {};
    const result = this.events.reduce((result, event) => {
      if (!isEnabledDepositRoute(event)) return result;
      const { destinationChainId, originToken, enabled } = event.args;
      if (!result[destinationChainId.toString()])
        result[destinationChainId.toString()] = new Set();
      if (enabled) {
        result[destinationChainId.toString()].add(originToken);
      } else {
        result[destinationChainId.toString()].delete(originToken);
      }
      return result;
    }, init);

    return Object.fromEntries(
      Object.entries(result).map(([chainId, addressSet]) => {
        return [chainId, [...addressSet.values()]];
      })
    );
  }
  getSupportedTokens(): string[] {
    const table = this.routesEnabled();
    const tokens = new Set<string>();
    Object.values(table).forEach((value) => {
      Object.values(value).forEach((token) => tokens.add(token));
    });
    return [...tokens.values()];
  }
  getSupportedChains(): number[] {
    const table = this.routesEnabled();
    return [...Object.keys(table)].map(Number);
  }
}

export class HubPoolUtils {
  public readonly contract: HubPool;
  private events: HubPoolEvent[] = [];
  private wethAddress: undefined | string;
  constructor(
    private address: string,
    private provider: Provider,
    private startBlock = 0,
    private maxRange?: number
  ) {
    this.contract = HubPool__factory.connect(address, provider);
  }
  async update() {
    await this.fetchEvents();
    this.wethAddress = await this.contract.weth();
  }

  getWethAddress(): string {
    assert(this.wethAddress, "weth address not set");
    return this.wethAddress;
  }
  async fetchEvents(): Promise<HubPoolEvent[]> {
    const latestBlock = (await this.provider.getBlockNumber()) - 1;
    const startBlock = this.startBlock;
    const maxRange = this.maxRange;
    const queries = [
      incrementalEvents<L1TokenEnabledForLiquidityProvision>(
        (startBlock: number, endBlock: number) => {
          return this.contract.queryFilter(
            this.contract.filters.L1TokenEnabledForLiquidityProvision(),
            startBlock,
            endBlock
          );
        },
        startBlock,
        latestBlock,
        maxRange
      ),
      incrementalEvents<L2TokenDisabledForLiquidityProvision>(
        (startBlock: number, endBlock: number) => {
          return this.contract.queryFilter(
            this.contract.filters.L2TokenDisabledForLiquidityProvision(),
            startBlock,
            endBlock
          );
        },
        startBlock,
        latestBlock,
        maxRange
      ),
      incrementalEvents<SetEnableDepositRoute>(
        (startBlock: number, endBlock: number) => {
          return this.contract.queryFilter(
            this.contract.filters.SetEnableDepositRoute(),
            startBlock,
            endBlock
          );
        },
        startBlock,
        latestBlock,
        maxRange
      ),
      incrementalEvents<CrossChainContractsSet>(
        (startBlock: number, endBlock: number) => {
          return this.contract.queryFilter(
            this.contract.filters.CrossChainContractsSet(),
            startBlock,
            endBlock
          );
        },
        startBlock,
        latestBlock,
        maxRange
      ),
      incrementalEvents(
        (startBlock: number, endBlock: number) => {
          return this.contract.queryFilter(
            this.contract.filters.SetPoolRebalanceRoute(),
            startBlock,
            endBlock
          );
        },
        startBlock,
        latestBlock,
        maxRange
      ),
    ];
    this.events = (await bluebird.mapSeries(queries, (x) => x))
      .flat()
      .sort((a: HubPoolEvent, b: HubPoolEvent) => {
        if (a.blockNumber !== b.blockNumber)
          return a.blockNumber - b.blockNumber;
        if (a.transactionIndex !== b.transactionIndex)
          return a.transactionIndex - b.transactionIndex;
        if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
        throw new Error(
          "Duplicate events found on transaction: " + a.transactionHash
        );
      });
    return this.events;
  }
  getSpokePoolAddresses(): Record<number, string> {
    const init: Record<number, string> = {};
    return this.events.reduce((result, event) => {
      if (!isCrossChainContractsSet(event)) return result;
      result[event.args.l2ChainId.toNumber()] = event.args.spokePool;
      return result;
    }, init);
  }
  getL1LpTokenTable(): Record<string, string> {
    const init: Record<string, string> = {};
    return this.events.reduce((result, event) => {
      if (isL1TokenEnabledForLiquidityProvision(event)) {
        result[event.args.l1Token] = event.args.lpToken;
      }
      if (isL2TokenDisabledForLiquidityProvision(event)) {
        delete result[event.args.l1Token];
      }
      return result;
    }, init);
  }
  getL1Tokens(): string[] {
    return [...Object.keys(this.getL1LpTokenTable())];
  }
  getLpTokens(): string[] {
    return [...Object.values(this.getL1LpTokenTable())];
  }
  // map spoke token addresses to hubpool addresses
  getSpokeTokenTable(): Record<string, string> {
    const result: Record<string, string> = {};
    this.events.forEach((event) => {
      if (!isSetPoolRebalanceRoute(event)) return;
      const { destinationChainId, l1Token, destinationToken } = event.args;
      result[destinationToken] = l1Token;
    });
    return result;
  }
  getRoutes(): Record<number, Record<number, Record<string, boolean>>> {
    const result: Record<number, Record<number, Record<string, boolean>>> = {};
    this.events.forEach((event) => {
      if (!isSetEnableDepositRoute(event)) return;
      const {
        destinationChainId,
        originChainId,
        originToken,
        depositsEnabled,
      } = event.args;
      if (!result[originChainId]) result[originChainId] = {};
      if (!result[originChainId][destinationChainId])
        result[originChainId][destinationChainId] = {};
      result[originChainId][destinationChainId][originToken] = depositsEnabled;
    });
    return result;
  }
}

// fetch info we need for all routes
async function getSpokePoolState(spoke: SpokePoolUtils): Promise<{
  routes: ReturnType<SpokePoolUtils["routesEnabled"]>;
  symbols: Record<string, string>;
  wrappedNativeToken: string;
}> {
  await spoke.update();
  const routes = spoke.routesEnabled();
  const supportedTokens = spoke.getSupportedTokens();
  const { wrappedNativeToken } = spoke;
  assert(wrappedNativeToken, "Spoke pool missing wrapped native token address");
  const symbols = Object.fromEntries(
    await Promise.all(
      supportedTokens.map(async (tokenAddress) => {
        const contract = ERC20__factory.connect(tokenAddress, spoke.provider);
        return [tokenAddress, await contract.symbol()];
      })
    )
  );

  return {
    routes,
    symbols,
    wrappedNativeToken,
  };
}

interface RouteConfig {
  hubPoolAddress: string;
  hubPoolChain: number;
  hubPoolWethAddress: string;
  routes: Routes;
}

// main function to return route list
export async function fetchRoutes(
  hubPoolChain: ChainId,
  hubPoolAddressOverride?: string
): Promise<RouteConfig> {
  const { maxRange } = getChainInfo(hubPoolChain);
  const hubPoolAddress =
    hubPoolAddressOverride || getDeployedAddress("HubPool", hubPoolChain);
  const hubPoolStartBlock = getDeployedBlockNumber("HubPool", hubPoolChain);
  const provider = getProvider(hubPoolChain);
  const hubPool = new HubPoolUtils(
    hubPoolAddress,
    provider,
    Number(hubPoolStartBlock),
    maxRange
  );
  await hubPool.update();
  const spokePoolAddresses = hubPool.getSpokePoolAddresses();
  const spokeTokenTable = hubPool.getSpokeTokenTable();
  const hubPoolWethAddress = hubPool.getWethAddress();

  const allRoutes: Routes = [];

  const spokeData = await Promise.all(
    Object.entries(spokePoolAddresses).map(
      async ([fromChain, fromSpokeAddress]) => {
        const fromChainId = Number(fromChain);
        assert(
          isSupportedChainId(fromChainId),
          "Missing supported chain id: " + fromChain
        );
        const { maxRange } = getChainInfo(fromChainId);
        const spokePoolAddress = fromSpokeAddress;
        const provider = getProvider(fromChainId);
        const deployedBlock = getDeployedBlockNumber("SpokePool", fromChainId);
        const pool = new SpokePoolUtils(
          fromSpokeAddress,
          provider,
          deployedBlock,
          maxRange
        );
        return {
          fromSpokeAddress,
          fromChain,
          ...(await getSpokePoolState(pool)),
        };
      }
    )
  );

  spokeData.forEach(
    ({ fromChain, fromSpokeAddress, routes, symbols, wrappedNativeToken }) => {
      const { nativeCurrencySymbol } = getChainInfo(fromChain);
      Object.entries(routes).forEach(([toChain, fromTokenAddresses]) => {
        fromTokenAddresses.forEach((fromTokenAddress) => {
          const l1TokenAddress = spokeTokenTable[fromTokenAddress];
          const fromTokenSymbol = symbols[fromTokenAddress];
          const route = {
            fromChain: Number(fromChain),
            toChain: Number(toChain),
            fromTokenAddress,
            fromSpokeAddress,
            fromTokenSymbol,
            isNative: false,
            l1TokenAddress,
          };
          allRoutes.push(route);
          if (fromTokenAddress === wrappedNativeToken) {
            allRoutes.push({
              ...route,
              // native token symbol may differ from erc20
              fromTokenSymbol: nativeCurrencySymbol,
              isNative: true,
            });
          }
        });
      });
    }
  );

  return {
    hubPoolChain,
    hubPoolAddress,
    hubPoolWethAddress,
    routes: allRoutes,
  };
}
