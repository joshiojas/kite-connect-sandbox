export interface Quote {
  instrument_token: number;
  timestamp: string;
  last_trade_time: string;
  last_price: number;
  last_quantity: number;
  buy_quantity: number;
  sell_quantity: number;
  volume: number;
  average_price: number;
  oi: number;
  oi_day_high: number;
  oi_day_low: number;
  net_change: number;
  lower_circuit_limit: number;
  upper_circuit_limit: number;
  ohlc: OHLC;
  depth: MarketDepth;
}

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LTP {
  instrument_token: number;
  last_price: number;
}

export interface MarketDepth {
  buy: DepthItem[];
  sell: DepthItem[];
}

export interface DepthItem {
  price: number;
  quantity: number;
  orders: number;
}

export interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface InstrumentCSVRow {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
}
