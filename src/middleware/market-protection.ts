export interface MarketProtectionResult {
  body: Record<string, string>;
  injected: boolean;
}

/**
 * For MARKET and SL-M orders, inject market_protection=-1 (auto protection)
 * if it is missing or set to "0". Leaves LIMIT and SL orders unchanged.
 */
export function injectMarketProtection(body: Record<string, string>): MarketProtectionResult {
  const orderType = body.order_type;
  if (orderType !== 'MARKET' && orderType !== 'SL-M') {
    return { body, injected: false };
  }

  if (!body.market_protection || body.market_protection === '0') {
    return {
      body: { ...body, market_protection: '-1' },
      injected: true,
    };
  }

  return { body, injected: false };
}
