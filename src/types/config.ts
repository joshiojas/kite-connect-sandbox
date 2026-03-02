export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
}

export interface SandboxConfig {
  initialCapital: number;
  currency: string;
  defaultSegments: string[];
  persistence: 'sqlite' | 'memory';
  dbPath: string;
  resetPortfolioOnRestart: boolean;
}

export interface UpstreamConfig {
  baseUrl: string;
  wsUrl: string;
  timeout: number;
  retries: number;
}

export interface OrderEngineConfig {
  defaultSlippage: number;
  slippageModel: 'percentage' | 'fixed' | 'none';
  fixedSlippage: number;
  simulatePartialFills: boolean;
  marketOrderFillDelay: number;
  autoFillLimitOrders: boolean;
  rejectAfterMarketHours: boolean;
}

export interface RateLimitsConfig {
  enabled: boolean;
  quote: number;
  historical: number;
  orders: number;
  default: number;
  ordersPerMinute: number;
  ordersPerDay: number;
}

export interface AppConfig {
  server: ServerConfig;
  sandbox: SandboxConfig;
  upstream: UpstreamConfig;
  orderEngine: OrderEngineConfig;
  rateLimits: RateLimitsConfig;
}
