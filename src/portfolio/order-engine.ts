import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import type { Order, Trade, PlaceOrderParams, ModifyOrderParams } from '../types/orders.js';
import type { AppConfig } from '../types/config.js';
import { PortfolioManager } from './portfolio-manager.js';
import { calculateMarginRequired } from './margin-calculator.js';
import { generateOrderId, generateExchangeOrderId, generateTradeId, generateGuid } from '../utils/id-generator.js';
import { formatTimestamp, todayDateString } from '../utils/timestamp.js';
import { ORDER_STATUSES, CANCELLABLE_STATUSES, MODIFIABLE_STATUSES } from '../utils/constants.js';
import { fetchLTP } from '../proxy/kite-proxy.js';

export class OrderEngine {
  private portfolioManager: PortfolioManager;

  constructor(
    private db: Database.Database,
    private config: AppConfig,
    private fastify: FastifyInstance,
  ) {
    this.portfolioManager = new PortfolioManager(db, config);
  }

  getPortfolioManager(): PortfolioManager {
    return this.portfolioManager;
  }

  async placeOrder(apiKey: string, params: PlaceOrderParams, authHeader: string): Promise<{ order_id: string }> {
    this.portfolioManager.ensurePortfolio(apiKey);

    // Validate required fields
    if (!params.exchange || !params.tradingsymbol || !params.transaction_type || !params.order_type || !params.product || !params.quantity) {
      throw new OrderError('Missing required order parameters', 'InputException');
    }

    if (params.quantity <= 0) {
      throw new OrderError('Quantity must be positive', 'InputException');
    }

    const orderId = generateOrderId();
    const exchangeOrderId = generateExchangeOrderId();
    const guid = generateGuid();
    const now = formatTimestamp();

    // Determine fill price
    let fillPrice = params.price ?? 0;

    if (params.order_type === 'MARKET' || (params.order_type === 'LIMIT' && this.config.orderEngine.autoFillLimitOrders)) {
      // Fetch LTP for market orders
      if (params.order_type === 'MARKET' || fillPrice === 0) {
        const instrument = `${params.exchange}:${params.tradingsymbol}`;
        const ltpData = await fetchLTP(this.fastify, authHeader, [instrument]);
        const ltpEntry = ltpData[instrument];
        if (ltpEntry) {
          fillPrice = ltpEntry.last_price;
        } else if (params.order_type === 'MARKET') {
          // If no LTP available for market order, use a default or reject
          fillPrice = params.price ?? 100; // fallback
        }
      }

      if (fillPrice === 0) {
        fillPrice = params.price ?? 0;
      }

      // Apply slippage for market orders
      if (params.order_type === 'MARKET' && this.config.orderEngine.defaultSlippage > 0) {
        fillPrice = this.applySlippage(fillPrice, params.transaction_type);
      }
    }

    // Check margin / holdings for sells
    if (params.transaction_type === 'SELL' && params.product === 'CNC') {
      const holdingQty = this.portfolioManager.getHoldingQuantity(apiKey, params.tradingsymbol, params.exchange);
      if (holdingQty < params.quantity) {
        // Create rejected order
        this.createOrder(apiKey, orderId, exchangeOrderId, guid, params, now, ORDER_STATUSES.REJECTED, 'Insufficient holdings');
        this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.REJECTED, 'Insufficient holdings to sell', now);
        throw new OrderError(`Insufficient holdings. Available: ${holdingQty}, Required: ${params.quantity}`, 'HoldingException');
      }
    } else if (params.transaction_type === 'BUY') {
      const effectivePrice = fillPrice > 0 ? fillPrice : (params.price ?? 0);
      const margin = calculateMarginRequired(params.exchange, params.product, params.order_type, params.transaction_type, params.quantity, effectivePrice);

      if (margin.required > 0) {
        const availableCash = this.portfolioManager.getAvailableCash(apiKey);
        if (availableCash < margin.required) {
          this.createOrder(apiKey, orderId, exchangeOrderId, guid, params, now, ORDER_STATUSES.REJECTED, 'Insufficient margin');
          this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.REJECTED, 'Insufficient margin', now);
          throw new OrderError(`Insufficient margin. Available: ${availableCash.toFixed(2)}, Required: ${margin.required.toFixed(2)}`, 'MarginException');
        }
      }
    }

    // Determine initial status based on variety and order type
    let status: string;
    if (params.variety === 'amo') {
      status = ORDER_STATUSES.AMO_REQ_RECEIVED;
    } else if (params.order_type === 'SL' || params.order_type === 'SL-M') {
      status = this.config.orderEngine.autoFillLimitOrders ? ORDER_STATUSES.COMPLETE : ORDER_STATUSES.TRIGGER_PENDING;
    } else if (params.order_type === 'MARKET') {
      status = ORDER_STATUSES.COMPLETE;
    } else if (params.order_type === 'LIMIT' && this.config.orderEngine.autoFillLimitOrders) {
      status = ORDER_STATUSES.COMPLETE;
    } else {
      status = ORDER_STATUSES.OPEN;
    }

    // Create the order
    this.createOrder(apiKey, orderId, exchangeOrderId, guid, params, now, status, null, fillPrice);

    // Record status transitions
    this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.PUT_ORDER_REQ_RECEIVED, null, now);
    if (status === ORDER_STATUSES.COMPLETE) {
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.OPEN_PENDING, null, now);
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.OPEN, null, now);
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.COMPLETE, null, now);

      // Execute the fill
      this.executeFill(apiKey, orderId, params, fillPrice, exchangeOrderId, now);
    } else if (status === ORDER_STATUSES.AMO_REQ_RECEIVED) {
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.AMO_REQ_RECEIVED, null, now);
    } else if (status === ORDER_STATUSES.TRIGGER_PENDING) {
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.TRIGGER_PENDING, null, now);
    } else {
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.OPEN_PENDING, null, now);
      this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.OPEN, null, now);
    }

    return { order_id: orderId };
  }

  modifyOrder(apiKey: string, variety: string, orderId: string, params: ModifyOrderParams): { order_id: string } {
    const order = this.db.prepare('SELECT * FROM orders WHERE order_id = ? AND api_key = ?').get(orderId, apiKey) as Record<string, unknown> | undefined;

    if (!order) {
      throw new OrderError('Order not found', 'OrderException');
    }

    if (!MODIFIABLE_STATUSES.has(order.status as string)) {
      throw new OrderError(`Order cannot be modified. Current status: ${order.status}`, 'OrderException');
    }

    const now = formatTimestamp();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.order_type !== undefined) { updates.push('order_type = ?'); values.push(params.order_type); }
    if (params.quantity !== undefined) { updates.push('quantity = ?', 'pending_quantity = ?'); values.push(params.quantity, params.quantity); }
    if (params.price !== undefined) { updates.push('price = ?'); values.push(params.price); }
    if (params.trigger_price !== undefined) { updates.push('trigger_price = ?'); values.push(params.trigger_price); }
    if (params.disclosed_quantity !== undefined) { updates.push('disclosed_quantity = ?'); values.push(params.disclosed_quantity); }
    if (params.validity !== undefined) { updates.push('validity = ?'); values.push(params.validity); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(orderId, apiKey);

    this.db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE order_id = ? AND api_key = ?`).run(...values);
    this.recordOrderHistory(orderId, apiKey, 'UPDATE', 'Order modified', now);

    return { order_id: orderId };
  }

  cancelOrder(apiKey: string, variety: string, orderId: string): { order_id: string } {
    const order = this.db.prepare('SELECT * FROM orders WHERE order_id = ? AND api_key = ?').get(orderId, apiKey) as Record<string, unknown> | undefined;

    if (!order) {
      throw new OrderError('Order not found', 'OrderException');
    }

    if (!CANCELLABLE_STATUSES.has(order.status as string)) {
      throw new OrderError(`Order cannot be cancelled. Current status: ${order.status}`, 'OrderException');
    }

    const now = formatTimestamp();
    const pendingQty = order.pending_quantity as number;

    this.db.prepare(
      'UPDATE orders SET status = ?, cancelled_quantity = ?, pending_quantity = 0, updated_at = ? WHERE order_id = ? AND api_key = ?',
    ).run(ORDER_STATUSES.CANCELLED, pendingQty, now, orderId, apiKey);

    this.recordOrderHistory(orderId, apiKey, ORDER_STATUSES.CANCELLED, 'Order cancelled by user', now);

    // Release margin if BUY order was pending
    if (order.transaction_type === 'BUY' && order.product !== 'CNC') {
      const price = (order.price as number) || (order.average_price as number) || 0;
      const margin = calculateMarginRequired(
        order.exchange as string, order.product as string,
        order.order_type as string, order.transaction_type as string,
        pendingQty, price,
      );
      if (margin.required > 0) {
        this.portfolioManager.releaseMargin(apiKey, margin.required);
      }
    }

    return { order_id: orderId };
  }

  getOrders(apiKey: string): Order[] {
    const today = todayDateString();
    const rows = this.db.prepare(
      "SELECT * FROM orders WHERE api_key = ? AND created_at >= ? ORDER BY created_at DESC",
    ).all(apiKey, today) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapOrder(row));
  }

  getOrderHistory(apiKey: string, orderId: string): Order[] {
    const rows = this.db.prepare(
      'SELECT order_snapshot FROM order_history WHERE order_id = ? AND api_key = ? ORDER BY id ASC',
    ).all(orderId, apiKey) as Array<{ order_snapshot: string }>;

    return rows.map((row) => JSON.parse(row.order_snapshot) as Order);
  }

  getOrderTrades(apiKey: string, orderId: string): Trade[] {
    const rows = this.db.prepare(
      'SELECT * FROM trades WHERE order_id = ? AND api_key = ?',
    ).all(orderId, apiKey) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapTrade(row));
  }

  getAllTrades(apiKey: string): Trade[] {
    const today = todayDateString();
    const rows = this.db.prepare(
      "SELECT * FROM trades WHERE api_key = ? AND fill_timestamp >= ? ORDER BY fill_timestamp DESC",
    ).all(apiKey, today) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapTrade(row));
  }

  private createOrder(
    apiKey: string, orderId: string, exchangeOrderId: string, guid: string,
    params: PlaceOrderParams, now: string, status: string, statusMessage: string | null,
    fillPrice?: number,
  ): void {
    const effectivePrice = status === ORDER_STATUSES.COMPLETE && fillPrice ? fillPrice : (params.price ?? 0);
    const filledQty = status === ORDER_STATUSES.COMPLETE ? params.quantity : 0;
    const pendingQty = status === ORDER_STATUSES.COMPLETE ? 0 : params.quantity;
    const avgPrice = status === ORDER_STATUSES.COMPLETE ? effectivePrice : 0;
    const tags = params.tag ? JSON.stringify([params.tag]) : '[]';

    this.db.prepare(
      `INSERT INTO orders (
        order_id, api_key, exchange_order_id, parent_order_id, variety,
        exchange, tradingsymbol, instrument_token, transaction_type, order_type,
        product, validity, validity_ttl, price, trigger_price,
        quantity, disclosed_quantity, filled_quantity, pending_quantity, cancelled_quantity,
        average_price, status, status_message, status_message_raw,
        tag, tags, meta, guid, placed_by,
        order_timestamp, exchange_timestamp, exchange_update_timestamp,
        created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      orderId, apiKey, exchangeOrderId, params.variety || 'regular',
      params.exchange, params.tradingsymbol, params.transaction_type, params.order_type,
      params.product, params.validity ?? 'DAY', params.validity_ttl ?? 0,
      params.price ?? 0, params.trigger_price ?? 0,
      params.quantity, params.disclosed_quantity ?? 0, filledQty, pendingQty,
      avgPrice, status, statusMessage, statusMessage,
      params.tag ?? null, tags, guid, apiKey,
      now, status === ORDER_STATUSES.COMPLETE ? now : null, status === ORDER_STATUSES.COMPLETE ? now : null,
      now, now,
    );
  }

  private executeFill(
    apiKey: string, orderId: string, params: PlaceOrderParams,
    fillPrice: number, exchangeOrderId: string, now: string,
  ): void {
    const tradeId = generateTradeId();
    const tradeValue = params.quantity * fillPrice;

    // Create trade record
    this.db.prepare(
      `INSERT INTO trades (
        trade_id, api_key, order_id, exchange, tradingsymbol, instrument_token,
        product, transaction_type, quantity, average_price,
        fill_timestamp, order_timestamp, exchange_timestamp, exchange_order_id
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      tradeId, apiKey, orderId, params.exchange, params.tradingsymbol,
      params.product, params.transaction_type, params.quantity, fillPrice,
      now, now, now, exchangeOrderId,
    );

    const trade: Trade = {
      trade_id: tradeId,
      order_id: orderId,
      exchange: params.exchange,
      tradingsymbol: params.tradingsymbol,
      instrument_token: 0,
      product: params.product,
      average_price: fillPrice,
      quantity: params.quantity,
      fill_timestamp: now,
      transaction_type: params.transaction_type,
      order_timestamp: now,
      exchange_order_id: exchangeOrderId,
      exchange_timestamp: now,
    };

    // Update portfolio
    if (params.transaction_type === 'BUY') {
      if (params.product === 'CNC') {
        // Debit cash and add to holdings
        this.portfolioManager.debitCash(apiKey, tradeValue);
        this.portfolioManager.addToHoldings(apiKey, trade);
      } else {
        // Intraday/NRML: block margin, update position
        this.portfolioManager.debitCash(apiKey, tradeValue);
      }
      this.portfolioManager.updatePosition(apiKey, trade);
    } else {
      // SELL
      if (params.product === 'CNC') {
        // Credit cash and reduce holdings
        this.portfolioManager.creditCash(apiKey, tradeValue);
        this.portfolioManager.reduceFromHoldings(apiKey, params.tradingsymbol, params.exchange, params.quantity);
      } else {
        // Intraday/NRML: credit cash, update position
        this.portfolioManager.creditCash(apiKey, tradeValue);
      }
      this.portfolioManager.updatePosition(apiKey, trade);
    }
  }

  private recordOrderHistory(orderId: string, apiKey: string, status: string, statusMessage: string | null, timestamp: string): void {
    // Get current order state for snapshot
    const order = this.db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId) as Record<string, unknown> | undefined;
    const snapshot = order ? JSON.stringify(this.mapOrder({ ...order, status, status_message: statusMessage })) : '{}';

    this.db.prepare(
      'INSERT INTO order_history (order_id, api_key, status, status_message, timestamp, order_snapshot) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(orderId, apiKey, status, statusMessage, timestamp, snapshot);
  }

  private applySlippage(price: number, transactionType: string): number {
    const config = this.config.orderEngine;
    if (config.slippageModel === 'none' || config.defaultSlippage === 0) return price;

    if (config.slippageModel === 'fixed') {
      return transactionType === 'BUY' ? price + config.fixedSlippage : price - config.fixedSlippage;
    }

    // percentage
    const slippage = price * config.defaultSlippage;
    return transactionType === 'BUY' ? price + slippage : price - slippage;
  }

  private mapOrder(row: Record<string, unknown>): Order {
    let tags: string[] = [];
    try {
      tags = JSON.parse((row.tags as string) || '[]') as string[];
    } catch { /* empty */ }

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse((row.meta as string) || '{}') as Record<string, unknown>;
    } catch { /* empty */ }

    return {
      order_id: row.order_id as string,
      parent_order_id: (row.parent_order_id as string) || null,
      exchange_order_id: (row.exchange_order_id as string) || null,
      placed_by: (row.placed_by as string) || '',
      variety: row.variety as string,
      status: row.status as Order['status'],
      tradingsymbol: row.tradingsymbol as string,
      exchange: row.exchange as string,
      instrument_token: (row.instrument_token as number) || 0,
      transaction_type: row.transaction_type as Order['transaction_type'],
      order_type: row.order_type as Order['order_type'],
      product: row.product as Order['product'],
      validity: (row.validity as string) || 'DAY',
      validity_ttl: (row.validity_ttl as number) || 0,
      price: (row.price as number) || 0,
      trigger_price: (row.trigger_price as number) || 0,
      average_price: (row.average_price as number) || 0,
      quantity: row.quantity as number,
      filled_quantity: (row.filled_quantity as number) || 0,
      pending_quantity: (row.pending_quantity as number) || 0,
      cancelled_quantity: (row.cancelled_quantity as number) || 0,
      disclosed_quantity: (row.disclosed_quantity as number) || 0,
      market_protection: 0,
      order_timestamp: (row.order_timestamp as string) || '',
      exchange_timestamp: (row.exchange_timestamp as string) || null,
      exchange_update_timestamp: (row.exchange_update_timestamp as string) || null,
      status_message: (row.status_message as string) || null,
      status_message_raw: (row.status_message_raw as string) || null,
      tag: (row.tag as string) || null,
      tags,
      meta,
      guid: (row.guid as string) || '',
    };
  }

  private mapTrade(row: Record<string, unknown>): Trade {
    return {
      trade_id: row.trade_id as string,
      order_id: row.order_id as string,
      exchange: row.exchange as string,
      tradingsymbol: row.tradingsymbol as string,
      instrument_token: (row.instrument_token as number) || 0,
      product: row.product as string,
      average_price: row.average_price as number,
      quantity: row.quantity as number,
      fill_timestamp: row.fill_timestamp as string,
      transaction_type: row.transaction_type as string,
      order_timestamp: (row.order_timestamp as string) || '',
      exchange_order_id: (row.exchange_order_id as string) || null,
      exchange_timestamp: (row.exchange_timestamp as string) || null,
    };
  }
}

export class OrderError extends Error {
  constructor(
    message: string,
    public errorType: string,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}
