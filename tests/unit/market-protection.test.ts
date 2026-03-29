import { describe, it, expect } from 'vitest';
import { injectMarketProtection } from '../../src/middleware/market-protection.js';

describe('Market protection injection', () => {
  it('injects market_protection=-1 for MARKET orders with no market_protection', () => {
    const result = injectMarketProtection({
      order_type: 'MARKET',
      tradingsymbol: 'NIFTY2640323000CE',
      exchange: 'NFO',
    });
    expect(result.injected).toBe(true);
    expect(result.body.market_protection).toBe('-1');
  });

  it('injects market_protection=-1 for MARKET orders with market_protection=0', () => {
    const result = injectMarketProtection({
      order_type: 'MARKET',
      market_protection: '0',
      tradingsymbol: 'INFY',
    });
    expect(result.injected).toBe(true);
    expect(result.body.market_protection).toBe('-1');
  });

  it('injects market_protection=-1 for SL-M orders', () => {
    const result = injectMarketProtection({
      order_type: 'SL-M',
      tradingsymbol: 'RELIANCE',
    });
    expect(result.injected).toBe(true);
    expect(result.body.market_protection).toBe('-1');
  });

  it('does NOT inject for LIMIT orders', () => {
    const result = injectMarketProtection({
      order_type: 'LIMIT',
      tradingsymbol: 'INFY',
    });
    expect(result.injected).toBe(false);
    expect(result.body.market_protection).toBeUndefined();
  });

  it('does NOT inject for SL orders', () => {
    const result = injectMarketProtection({
      order_type: 'SL',
      tradingsymbol: 'INFY',
    });
    expect(result.injected).toBe(false);
  });

  it('does NOT override explicit non-zero market_protection', () => {
    const result = injectMarketProtection({
      order_type: 'MARKET',
      market_protection: '5',
      tradingsymbol: 'INFY',
    });
    expect(result.injected).toBe(false);
    expect(result.body.market_protection).toBe('5');
  });

  it('does NOT override market_protection=-1 (already set)', () => {
    const result = injectMarketProtection({
      order_type: 'MARKET',
      market_protection: '-1',
      tradingsymbol: 'INFY',
    });
    expect(result.injected).toBe(false);
    expect(result.body.market_protection).toBe('-1');
  });

  it('preserves all other body fields', () => {
    const result = injectMarketProtection({
      order_type: 'MARKET',
      tradingsymbol: 'NIFTY2640323000CE',
      exchange: 'NFO',
      transaction_type: 'BUY',
      quantity: '75',
      product: 'NRML',
    });
    expect(result.body.tradingsymbol).toBe('NIFTY2640323000CE');
    expect(result.body.exchange).toBe('NFO');
    expect(result.body.transaction_type).toBe('BUY');
    expect(result.body.quantity).toBe('75');
    expect(result.body.product).toBe('NRML');
  });
});
