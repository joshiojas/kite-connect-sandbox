import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PortfolioManager } from '../../src/portfolio/portfolio-manager.js';
import { startMockKiteServer, stopMockKiteServer } from '../helpers/mock-kite-server.js';
import { createTestApp, API_KEY } from '../setup.js';
import type { Trade } from '../../src/types/orders.js';

describe('PortfolioManager', () => {
  let app: FastifyInstance;
  let pm: PortfolioManager;

  beforeAll(async () => {
    await startMockKiteServer();
    app = await createTestApp();
    pm = new PortfolioManager(app.db, app.config);
  });

  afterAll(async () => {
    await app.close();
    await stopMockKiteServer();
  });

  beforeEach(() => {
    app.db.exec("DELETE FROM positions");
    app.db.exec("DELETE FROM holdings");
    app.db.exec("DELETE FROM portfolios");
  });

  describe('ensurePortfolio', () => {
    it('should create portfolio for new api_key', () => {
      const portfolio = pm.ensurePortfolio(API_KEY);
      expect(portfolio.api_key).toBe(API_KEY);
      expect(portfolio.initial_capital).toBe(1000000);
      expect(portfolio.available_cash).toBe(1000000);
      expect(portfolio.used_margin).toBe(0);
    });

    it('should return existing portfolio', () => {
      pm.ensurePortfolio(API_KEY);
      pm.debitCash(API_KEY, 50000);
      const portfolio = pm.getPortfolio(API_KEY);
      expect(portfolio.available_cash).toBe(950000);
    });
  });

  describe('Cash management', () => {
    it('should debit cash', () => {
      pm.ensurePortfolio(API_KEY);
      pm.debitCash(API_KEY, 15000);
      expect(pm.getAvailableCash(API_KEY)).toBe(985000);
    });

    it('should credit cash', () => {
      pm.ensurePortfolio(API_KEY);
      pm.debitCash(API_KEY, 15000);
      pm.creditCash(API_KEY, 5000);
      expect(pm.getAvailableCash(API_KEY)).toBe(990000);
    });

    it('should block margin', () => {
      pm.ensurePortfolio(API_KEY);
      pm.blockMargin(API_KEY, 20000);
      expect(pm.getAvailableCash(API_KEY)).toBe(980000);
    });

    it('should release margin', () => {
      pm.ensurePortfolio(API_KEY);
      pm.blockMargin(API_KEY, 20000);
      pm.releaseMargin(API_KEY, 10000);
      expect(pm.getAvailableCash(API_KEY)).toBe(990000);
    });
  });

  describe('Holdings', () => {
    it('should add to holdings', () => {
      pm.ensurePortfolio(API_KEY);
      const trade = makeTrade('BUY', 'INFY', 'NSE', 10, 1500);
      pm.addToHoldings(API_KEY, trade);
      const holdings = pm.getHoldings(API_KEY);
      expect(holdings.length).toBe(1);
      expect(holdings[0]!.tradingsymbol).toBe('INFY');
      expect(holdings[0]!.quantity).toBe(10);
      expect(holdings[0]!.average_price).toBe(1500);
    });

    it('should compute weighted average price on multiple buys', () => {
      pm.ensurePortfolio(API_KEY);
      pm.addToHoldings(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1500));
      pm.addToHoldings(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1600));
      const holdings = pm.getHoldings(API_KEY);
      expect(holdings[0]!.quantity).toBe(20);
      expect(holdings[0]!.average_price).toBe(1550); // (10*1500 + 10*1600) / 20
    });

    it('should reduce from holdings', () => {
      pm.ensurePortfolio(API_KEY);
      pm.addToHoldings(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1500));
      pm.reduceFromHoldings(API_KEY, 'INFY', 'NSE', 5);
      const holdings = pm.getHoldings(API_KEY);
      expect(holdings[0]!.quantity).toBe(5);
    });

    it('should return holding quantity', () => {
      pm.ensurePortfolio(API_KEY);
      expect(pm.getHoldingQuantity(API_KEY, 'INFY', 'NSE')).toBe(0);
      pm.addToHoldings(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1500));
      expect(pm.getHoldingQuantity(API_KEY, 'INFY', 'NSE')).toBe(10);
    });
  });

  describe('Positions', () => {
    it('should create position on trade', () => {
      pm.ensurePortfolio(API_KEY);
      pm.updatePosition(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1500, 'MIS'));
      const { net } = pm.getPositions(API_KEY);
      expect(net.length).toBe(1);
      expect(net[0]!.quantity).toBe(10);
      expect(net[0]!.average_price).toBe(1500);
    });

    it('should net positions correctly', () => {
      pm.ensurePortfolio(API_KEY);
      pm.updatePosition(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1500, 'MIS'));
      pm.updatePosition(API_KEY, makeTrade('SELL', 'INFY', 'NSE', 10, 1550, 'MIS'));
      const { net } = pm.getPositions(API_KEY);
      expect(net[0]!.quantity).toBe(0);
    });
  });

  describe('Margins', () => {
    it('should return Kite-format margins response', () => {
      pm.ensurePortfolio(API_KEY);
      const margins = pm.getMargins(API_KEY);
      expect(margins.equity).toBeDefined();
      expect(margins.commodity).toBeDefined();
      expect(margins.equity.available.cash).toBe(1000000);
      expect(margins.equity.enabled).toBe(true);
    });
  });

  describe('resetPortfolio', () => {
    it('should reset portfolio to initial capital', () => {
      pm.ensurePortfolio(API_KEY);
      pm.debitCash(API_KEY, 500000);
      pm.addToHoldings(API_KEY, makeTrade('BUY', 'INFY', 'NSE', 10, 1500));
      pm.resetPortfolio(API_KEY);
      expect(pm.getAvailableCash(API_KEY)).toBe(1000000);
      expect(pm.getHoldings(API_KEY).length).toBe(0);
    });
  });
});

function makeTrade(
  txnType: string, symbol: string, exchange: string,
  qty: number, price: number, product: string = 'CNC',
): Trade {
  return {
    trade_id: `T${Date.now()}`,
    order_id: `O${Date.now()}`,
    exchange,
    tradingsymbol: symbol,
    instrument_token: 0,
    product,
    average_price: price,
    quantity: qty,
    fill_timestamp: '2026-01-01 09:30:00',
    transaction_type: txnType,
    order_timestamp: '2026-01-01 09:30:00',
    exchange_order_id: null,
    exchange_timestamp: null,
  };
}
