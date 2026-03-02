export interface Portfolio {
  api_key: string;
  initial_capital: number;
  available_cash: number;
  used_margin: number;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  isin: string;
  product: string;
  quantity: number;
  t1_quantity: number;
  realised_quantity: number;
  authorised_quantity: number;
  authorised_date: string;
  opening_quantity: number;
  collateral_quantity: number;
  collateral_type: string;
  discrepancy: boolean;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
  used_quantity: number;
  short_quantity: number;
}

export interface Position {
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  product: string;
  quantity: number;
  overnight_quantity: number;
  multiplier: number;
  average_price: number;
  close_price: number;
  last_price: number;
  value: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buy_quantity: number;
  buy_price: number;
  buy_value: number;
  buy_m2m: number;
  sell_quantity: number;
  sell_price: number;
  sell_value: number;
  sell_m2m: number;
  day_buy_quantity: number;
  day_buy_price: number;
  day_buy_value: number;
  day_sell_quantity: number;
  day_sell_price: number;
  day_sell_value: number;
}

export interface PositionsResponse {
  net: Position[];
  day: Position[];
}

export interface ConversionParams {
  tradingsymbol: string;
  exchange: string;
  transaction_type: string;
  position_type: string;
  quantity: number;
  old_product: string;
  new_product: string;
}

export interface SegmentMargins {
  enabled: boolean;
  net: number;
  available: {
    adhoc_margin: number;
    cash: number;
    opening_balance: number;
    live_balance: number;
    collateral: number;
    intraday_payin: number;
  };
  utilised: {
    debits: number;
    exposure: number;
    m2m_realised: number;
    m2m_unrealised: number;
    option_premium: number;
    payout: number;
    span: number;
    holding_sales: number;
    turnover: number;
    liquid_collateral: number;
    stock_collateral: number;
    delivery: number;
  };
}

export interface MarginsResponse {
  equity: SegmentMargins;
  commodity: SegmentMargins;
}

export interface Alert {
  uuid: string;
  type: string;
  status: string;
  condition: Record<string, unknown>;
  basket: Record<string, unknown>[] | null;
  created_at: string;
  updated_at: string;
}
