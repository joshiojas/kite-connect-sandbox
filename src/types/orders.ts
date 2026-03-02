export interface Order {
  order_id: string;
  parent_order_id: string | null;
  exchange_order_id: string | null;
  placed_by: string;
  variety: string;
  status: OrderStatus;
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  transaction_type: TransactionType;
  order_type: OrderType;
  product: ProductType;
  validity: string;
  validity_ttl: number;
  price: number;
  trigger_price: number;
  average_price: number;
  quantity: number;
  filled_quantity: number;
  pending_quantity: number;
  cancelled_quantity: number;
  disclosed_quantity: number;
  market_protection: number;
  order_timestamp: string;
  exchange_timestamp: string | null;
  exchange_update_timestamp: string | null;
  status_message: string | null;
  status_message_raw: string | null;
  tag: string | null;
  tags: string[];
  meta: Record<string, unknown>;
  guid: string;
}

export type OrderStatus =
  | 'COMPLETE'
  | 'REJECTED'
  | 'CANCELLED'
  | 'OPEN'
  | 'OPEN PENDING'
  | 'VALIDATION PENDING'
  | 'PUT ORDER REQ RECEIVED'
  | 'TRIGGER PENDING'
  | 'MODIFY PENDING'
  | 'MODIFY VALIDATION PENDING'
  | 'CANCEL PENDING'
  | 'AMO REQ RECEIVED'
  | 'UPDATE'
  | 'NOT MODIFIED'
  | 'NOT CANCELLED';

export type TransactionType = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type ProductType = 'CNC' | 'NRML' | 'MIS' | 'MTF';
export type Variety = 'regular' | 'amo' | 'co' | 'iceberg' | 'auction';
export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'CDS' | 'BFO' | 'MCX' | 'BCD';

export interface PlaceOrderParams {
  variety: string;
  exchange: string;
  tradingsymbol: string;
  transaction_type: TransactionType;
  order_type: OrderType;
  product: ProductType;
  quantity: number;
  price?: number;
  trigger_price?: number;
  disclosed_quantity?: number;
  validity?: string;
  validity_ttl?: number;
  iceberg_legs?: number;
  iceberg_quantity?: number;
  tag?: string;
}

export interface ModifyOrderParams {
  order_type?: OrderType;
  quantity?: number;
  price?: number;
  trigger_price?: number;
  disclosed_quantity?: number;
  validity?: string;
}

export interface Trade {
  trade_id: string;
  order_id: string;
  exchange: string;
  tradingsymbol: string;
  instrument_token: number;
  product: string;
  average_price: number;
  quantity: number;
  fill_timestamp: string;
  transaction_type: string;
  order_timestamp: string;
  exchange_order_id: string | null;
  exchange_timestamp: string | null;
}

export interface GTTOrder {
  id: number;
  user_id: string;
  type: 'single' | 'two-leg';
  status: GTTStatus;
  condition: GTTCondition;
  orders: GTTOrderLeg[];
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export type GTTStatus =
  | 'active'
  | 'triggered'
  | 'disabled'
  | 'expired'
  | 'cancelled'
  | 'rejected'
  | 'deleted';

export interface GTTCondition {
  exchange: string;
  tradingsymbol: string;
  trigger_values: number[];
  last_price: number;
  instrument_token: number;
}

export interface GTTOrderLeg {
  exchange: string;
  tradingsymbol: string;
  transaction_type: TransactionType;
  quantity: number;
  order_type: OrderType;
  product: ProductType;
  price: number;
  result: GTTOrderResult | null;
}

export interface GTTOrderResult {
  order_result: {
    order_id: string;
    rejection_reason: string;
    status: string;
  };
  timestamp: string;
  triggered_at: number;
}

export interface MFOrder {
  order_id: string;
  exchange_order_id: string | null;
  tradingsymbol: string;
  status: string;
  status_message: string;
  folio: string | null;
  fund: string;
  order_timestamp: string;
  exchange_timestamp: string | null;
  settlement_id: string | null;
  transaction_type: TransactionType;
  variety: string;
  purchase_type: string;
  quantity: number;
  amount: number;
  last_price: number;
  average_price: number;
  placed_by: string;
  tag: string | null;
}

export interface MFSip {
  sip_id: string;
  tradingsymbol: string;
  fund: string;
  dividend_type: string;
  transaction_type: TransactionType;
  status: string;
  sip_type: string;
  instalments: number;
  frequency: string;
  instalment_amount: number;
  instalment_day: number;
  completed_instalments: number;
  pending_instalments: number;
  created: string;
  last_instalment: string;
  next_instalment: string;
  step_up: Record<string, number>;
  tag: string | null;
}

export interface MFHolding {
  folio: string;
  fund: string;
  tradingsymbol: string;
  average_price: number;
  last_price: number;
  last_price_date: string;
  pnl: number;
  quantity: number;
  pledge_quantity: number;
}
