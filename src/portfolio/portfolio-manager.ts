import type Database from 'better-sqlite3';
import type { Portfolio, Holding, Position, PositionsResponse, MarginsResponse, SegmentMargins, ConversionParams } from '../types/portfolio.js';
import type { Trade } from '../types/orders.js';
import { formatTimestamp } from '../utils/timestamp.js';
import { calculateWeightedAveragePrice } from './pnl-calculator.js';
import type { AppConfig } from '../types/config.js';

export class PortfolioManager {
  constructor(
    private db: Database.Database,
    private config: AppConfig,
  ) {}

  ensurePortfolio(apiKey: string): Portfolio {
    const existing = this.db.prepare('SELECT * FROM portfolios WHERE api_key = ?').get(apiKey) as Portfolio | undefined;
    if (existing) return existing;

    const now = formatTimestamp();
    const initialCapital = this.config.sandbox.initialCapital;
    this.db.prepare(
      'INSERT INTO portfolios (api_key, initial_capital, available_cash, used_margin, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    ).run(apiKey, initialCapital, initialCapital, now, now);

    return {
      api_key: apiKey,
      initial_capital: initialCapital,
      available_cash: initialCapital,
      used_margin: 0,
      created_at: now,
      updated_at: now,
    };
  }

  getPortfolio(apiKey: string): Portfolio {
    return this.ensurePortfolio(apiKey);
  }

  getAvailableCash(apiKey: string): number {
    const portfolio = this.ensurePortfolio(apiKey);
    return portfolio.available_cash;
  }

  blockMargin(apiKey: string, amount: number): void {
    const now = formatTimestamp();
    this.db.prepare(
      'UPDATE portfolios SET available_cash = available_cash - ?, used_margin = used_margin + ?, updated_at = ? WHERE api_key = ?',
    ).run(amount, amount, now, apiKey);
  }

  releaseMargin(apiKey: string, amount: number): void {
    const now = formatTimestamp();
    this.db.prepare(
      'UPDATE portfolios SET available_cash = available_cash + ?, used_margin = used_margin - ?, updated_at = ? WHERE api_key = ?',
    ).run(amount, amount, now, apiKey);
  }

  debitCash(apiKey: string, amount: number): void {
    const now = formatTimestamp();
    this.db.prepare(
      'UPDATE portfolios SET available_cash = available_cash - ?, updated_at = ? WHERE api_key = ?',
    ).run(amount, now, apiKey);
  }

  creditCash(apiKey: string, amount: number): void {
    const now = formatTimestamp();
    this.db.prepare(
      'UPDATE portfolios SET available_cash = available_cash + ?, updated_at = ? WHERE api_key = ?',
    ).run(amount, now, apiKey);
  }

  getHoldings(apiKey: string): Holding[] {
    const rows = this.db.prepare('SELECT * FROM holdings WHERE api_key = ? AND quantity > 0').all(apiKey) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      tradingsymbol: row.tradingsymbol as string,
      exchange: row.exchange as string,
      instrument_token: row.instrument_token as number,
      isin: (row.isin as string) || '',
      product: row.product as string,
      quantity: row.quantity as number,
      t1_quantity: row.t1_quantity as number,
      realised_quantity: row.realised_quantity as number,
      authorised_quantity: (row.authorised_quantity as number) || 0,
      authorised_date: (row.authorised_date as string) || '',
      opening_quantity: row.opening_quantity as number,
      collateral_quantity: (row.collateral_quantity as number) || 0,
      collateral_type: (row.collateral_type as string) || '',
      discrepancy: Boolean(row.discrepancy),
      average_price: row.average_price as number,
      last_price: row.last_price as number,
      close_price: row.close_price as number,
      pnl: row.pnl as number,
      day_change: row.day_change as number,
      day_change_percentage: row.day_change_percentage as number,
      used_quantity: (row.used_quantity as number) || 0,
      short_quantity: (row.short_quantity as number) || 0,
    }));
  }

  addToHoldings(apiKey: string, trade: Trade): void {
    const now = formatTimestamp();
    const existing = this.db.prepare(
      'SELECT * FROM holdings WHERE api_key = ? AND tradingsymbol = ? AND exchange = ?',
    ).get(apiKey, trade.tradingsymbol, trade.exchange) as Record<string, unknown> | undefined;

    if (existing) {
      const existingQty = existing.quantity as number;
      const existingAvg = existing.average_price as number;
      const newAvgPrice = calculateWeightedAveragePrice(existingQty, existingAvg, trade.quantity, trade.average_price);
      const newQty = existingQty + trade.quantity;

      this.db.prepare(
        'UPDATE holdings SET quantity = ?, average_price = ?, t1_quantity = t1_quantity + ?, updated_at = ? WHERE api_key = ? AND tradingsymbol = ? AND exchange = ?',
      ).run(newQty, newAvgPrice, trade.quantity, now, apiKey, trade.tradingsymbol, trade.exchange);
    } else {
      this.db.prepare(
        `INSERT INTO holdings (api_key, tradingsymbol, exchange, instrument_token, product, quantity, t1_quantity, realised_quantity, opening_quantity, average_price, last_price, close_price, pnl, day_change, day_change_percentage, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'CNC', ?, ?, 0, 0, ?, 0, 0, 0, 0, 0, ?, ?)`,
      ).run(apiKey, trade.tradingsymbol, trade.exchange, trade.instrument_token, trade.quantity, trade.quantity, trade.average_price, now, now);
    }
  }

  reduceFromHoldings(apiKey: string, tradingsymbol: string, exchange: string, qty: number): number {
    const holding = this.db.prepare(
      'SELECT * FROM holdings WHERE api_key = ? AND tradingsymbol = ? AND exchange = ?',
    ).get(apiKey, tradingsymbol, exchange) as Record<string, unknown> | undefined;

    if (!holding) return 0;

    const currentQty = holding.quantity as number;
    const avgPrice = holding.average_price as number;
    const newQty = currentQty - qty;
    const now = formatTimestamp();

    if (newQty <= 0) {
      this.db.prepare(
        'UPDATE holdings SET quantity = 0, updated_at = ? WHERE api_key = ? AND tradingsymbol = ? AND exchange = ?',
      ).run(now, apiKey, tradingsymbol, exchange);
    } else {
      this.db.prepare(
        'UPDATE holdings SET quantity = ?, updated_at = ? WHERE api_key = ? AND tradingsymbol = ? AND exchange = ?',
      ).run(newQty, now, apiKey, tradingsymbol, exchange);
    }

    return avgPrice;
  }

  getHoldingQuantity(apiKey: string, tradingsymbol: string, exchange: string): number {
    const row = this.db.prepare(
      'SELECT quantity FROM holdings WHERE api_key = ? AND tradingsymbol = ? AND exchange = ?',
    ).get(apiKey, tradingsymbol, exchange) as { quantity: number } | undefined;
    return row?.quantity ?? 0;
  }

  getPositions(apiKey: string): PositionsResponse {
    const rows = this.db.prepare('SELECT * FROM positions WHERE api_key = ?').all(apiKey) as Array<Record<string, unknown>>;
    const positions: Position[] = rows.map((row) => this.mapPosition(row));

    // Day positions: only those with day activity
    const day = positions.filter((p) => p.day_buy_quantity > 0 || p.day_sell_quantity > 0);

    return { net: positions, day };
  }

  updatePosition(apiKey: string, trade: Trade): void {
    const now = formatTimestamp();
    const isBuy = trade.transaction_type === 'BUY';
    const tradeValue = trade.quantity * trade.average_price;

    const existing = this.db.prepare(
      'SELECT * FROM positions WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = ?',
    ).get(apiKey, trade.tradingsymbol, trade.exchange, trade.product) as Record<string, unknown> | undefined;

    if (existing) {
      const currentQty = existing.quantity as number;
      const currentAvg = existing.average_price as number;

      let newQty: number;
      let newAvgPrice: number;

      if (isBuy) {
        if (currentQty >= 0) {
          // Adding to long or opening long
          newAvgPrice = calculateWeightedAveragePrice(Math.max(0, currentQty), currentAvg, trade.quantity, trade.average_price);
          newQty = currentQty + trade.quantity;
        } else {
          // Covering short
          newQty = currentQty + trade.quantity;
          newAvgPrice = newQty > 0 ? trade.average_price : currentAvg;
        }
      } else {
        if (currentQty <= 0) {
          // Adding to short or opening short
          newAvgPrice = calculateWeightedAveragePrice(Math.max(0, Math.abs(currentQty)), currentAvg, trade.quantity, trade.average_price);
          newQty = currentQty - trade.quantity;
        } else {
          // Selling long
          newQty = currentQty - trade.quantity;
          newAvgPrice = newQty < 0 ? trade.average_price : currentAvg;
        }
      }

      const buyQty = (existing.buy_quantity as number) + (isBuy ? trade.quantity : 0);
      const buyValue = (existing.buy_value as number) + (isBuy ? tradeValue : 0);
      const sellQty = (existing.sell_quantity as number) + (isBuy ? 0 : trade.quantity);
      const sellValue = (existing.sell_value as number) + (isBuy ? 0 : tradeValue);
      const dayBuyQty = (existing.day_buy_quantity as number) + (isBuy ? trade.quantity : 0);
      const dayBuyValue = (existing.day_buy_value as number) + (isBuy ? tradeValue : 0);
      const daySellQty = (existing.day_sell_quantity as number) + (isBuy ? 0 : trade.quantity);
      const daySellValue = (existing.day_sell_value as number) + (isBuy ? 0 : tradeValue);

      this.db.prepare(
        `UPDATE positions SET
          quantity = ?, average_price = ?,
          buy_quantity = ?, buy_value = ?, buy_price = ?,
          sell_quantity = ?, sell_value = ?, sell_price = ?,
          day_buy_quantity = ?, day_buy_value = ?, day_buy_price = ?,
          day_sell_quantity = ?, day_sell_value = ?, day_sell_price = ?,
          value = ?, realised = ?,
          updated_at = ?
        WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = ?`,
      ).run(
        newQty, newAvgPrice,
        buyQty, buyValue, buyQty > 0 ? buyValue / buyQty : 0,
        sellQty, sellValue, sellQty > 0 ? sellValue / sellQty : 0,
        dayBuyQty, dayBuyValue, dayBuyQty > 0 ? dayBuyValue / dayBuyQty : 0,
        daySellQty, daySellValue, daySellQty > 0 ? daySellValue / daySellQty : 0,
        newQty * newAvgPrice,
        Math.min(buyQty, sellQty) > 0 ? (sellValue / sellQty - buyValue / buyQty) * Math.min(buyQty, sellQty) : 0,
        now,
        apiKey, trade.tradingsymbol, trade.exchange, trade.product,
      );
    } else {
      // New position
      const qty = isBuy ? trade.quantity : -trade.quantity;
      this.db.prepare(
        `INSERT INTO positions (
          api_key, tradingsymbol, exchange, instrument_token, product,
          quantity, overnight_quantity, multiplier, average_price,
          buy_quantity, buy_price, buy_value,
          sell_quantity, sell_price, sell_value,
          day_buy_quantity, day_buy_price, day_buy_value,
          day_sell_quantity, day_sell_price, day_sell_value,
          value, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        apiKey, trade.tradingsymbol, trade.exchange, trade.instrument_token, trade.product,
        qty, trade.average_price,
        isBuy ? trade.quantity : 0, isBuy ? trade.average_price : 0, isBuy ? tradeValue : 0,
        isBuy ? 0 : trade.quantity, isBuy ? 0 : trade.average_price, isBuy ? 0 : tradeValue,
        isBuy ? trade.quantity : 0, isBuy ? trade.average_price : 0, isBuy ? tradeValue : 0,
        isBuy ? 0 : trade.quantity, isBuy ? 0 : trade.average_price, isBuy ? 0 : tradeValue,
        qty * trade.average_price, now, now,
      );
    }
  }

  convertPosition(apiKey: string, params: ConversionParams): boolean {
    const existing = this.db.prepare(
      'SELECT * FROM positions WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = ?',
    ).get(apiKey, params.tradingsymbol, params.exchange, params.old_product) as Record<string, unknown> | undefined;

    if (!existing) return false;

    const currentQty = existing.quantity as number;
    if (Math.abs(currentQty) < params.quantity) return false;

    const now = formatTimestamp();
    const avgPrice = existing.average_price as number;

    // Reduce from old product
    const newQty = params.transaction_type === 'BUY'
      ? currentQty - params.quantity
      : currentQty + params.quantity;

    this.db.prepare(
      'UPDATE positions SET quantity = ?, updated_at = ? WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = ?',
    ).run(newQty, now, apiKey, params.tradingsymbol, params.exchange, params.old_product);

    // Add to new product
    const newProductPos = this.db.prepare(
      'SELECT * FROM positions WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = ?',
    ).get(apiKey, params.tradingsymbol, params.exchange, params.new_product) as Record<string, unknown> | undefined;

    if (newProductPos) {
      const existQty = newProductPos.quantity as number;
      const addQty = params.transaction_type === 'BUY' ? params.quantity : -params.quantity;
      this.db.prepare(
        'UPDATE positions SET quantity = ?, updated_at = ? WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = ?',
      ).run(existQty + addQty, now, apiKey, params.tradingsymbol, params.exchange, params.new_product);
    } else {
      const qty = params.transaction_type === 'BUY' ? params.quantity : -params.quantity;
      this.db.prepare(
        `INSERT INTO positions (
          api_key, tradingsymbol, exchange, instrument_token, product,
          quantity, overnight_quantity, multiplier, average_price,
          value, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`,
      ).run(
        apiKey, params.tradingsymbol, params.exchange, (existing.instrument_token as number) || 0, params.new_product,
        qty, avgPrice, qty * avgPrice, now, now,
      );
    }

    return true;
  }

  getMargins(apiKey: string, segment?: string): MarginsResponse {
    const portfolio = this.ensurePortfolio(apiKey);

    const equityMargin = this.buildSegmentMargins(portfolio, true);
    const commodityMargin = this.buildSegmentMargins(portfolio, false);

    if (segment === 'equity') {
      return { equity: equityMargin, commodity: commodityMargin };
    }
    if (segment === 'commodity') {
      return { equity: equityMargin, commodity: commodityMargin };
    }

    return { equity: equityMargin, commodity: commodityMargin };
  }

  private buildSegmentMargins(portfolio: Portfolio, enabled: boolean): SegmentMargins {
    return {
      enabled,
      net: enabled ? portfolio.available_cash : 0,
      available: {
        adhoc_margin: 0,
        cash: enabled ? portfolio.available_cash : 0,
        opening_balance: enabled ? portfolio.initial_capital : 0,
        live_balance: enabled ? portfolio.available_cash : 0,
        collateral: 0,
        intraday_payin: 0,
      },
      utilised: {
        debits: enabled ? portfolio.used_margin : 0,
        exposure: 0,
        m2m_realised: 0,
        m2m_unrealised: 0,
        option_premium: 0,
        payout: 0,
        span: 0,
        holding_sales: 0,
        turnover: 0,
        liquid_collateral: 0,
        stock_collateral: 0,
        delivery: 0,
      },
    };
  }

  private mapPosition(row: Record<string, unknown>): Position {
    return {
      tradingsymbol: row.tradingsymbol as string,
      exchange: row.exchange as string,
      instrument_token: (row.instrument_token as number) || 0,
      product: row.product as string,
      quantity: row.quantity as number,
      overnight_quantity: (row.overnight_quantity as number) || 0,
      multiplier: (row.multiplier as number) || 1,
      average_price: row.average_price as number,
      close_price: (row.close_price as number) || 0,
      last_price: (row.last_price as number) || 0,
      value: (row.value as number) || 0,
      pnl: (row.pnl as number) || 0,
      m2m: (row.m2m as number) || 0,
      unrealised: (row.unrealised as number) || 0,
      realised: (row.realised as number) || 0,
      buy_quantity: (row.buy_quantity as number) || 0,
      buy_price: (row.buy_price as number) || 0,
      buy_value: (row.buy_value as number) || 0,
      buy_m2m: (row.buy_m2m as number) || 0,
      sell_quantity: (row.sell_quantity as number) || 0,
      sell_price: (row.sell_price as number) || 0,
      sell_value: (row.sell_value as number) || 0,
      sell_m2m: (row.sell_m2m as number) || 0,
      day_buy_quantity: (row.day_buy_quantity as number) || 0,
      day_buy_price: (row.day_buy_price as number) || 0,
      day_buy_value: (row.day_buy_value as number) || 0,
      day_sell_quantity: (row.day_sell_quantity as number) || 0,
      day_sell_price: (row.day_sell_price as number) || 0,
      day_sell_value: (row.day_sell_value as number) || 0,
    };
  }

  resetPortfolio(apiKey: string): void {
    const now = formatTimestamp();
    const initialCapital = this.config.sandbox.initialCapital;

    const tables = ['order_history', 'trades', 'orders', 'holdings', 'positions', 'gtt_orders', 'alerts', 'mf_orders', 'mf_sips', 'mf_holdings'];
    for (const table of tables) {
      this.db.prepare(`DELETE FROM ${table} WHERE api_key = ?`).run(apiKey);
    }

    this.db.prepare(
      'UPDATE portfolios SET available_cash = ?, used_margin = 0, updated_at = ? WHERE api_key = ?',
    ).run(initialCapital, now, apiKey);
  }
}
