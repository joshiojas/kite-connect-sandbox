export function calculatePositionPnL(
  quantity: number,
  averagePrice: number,
  lastPrice: number,
  multiplier: number = 1,
): number {
  return (lastPrice - averagePrice) * quantity * multiplier;
}

export function calculateHoldingPnL(
  quantity: number,
  averagePrice: number,
  lastPrice: number,
): number {
  return (lastPrice - averagePrice) * quantity;
}

export function calculateDayChange(
  lastPrice: number,
  closePrice: number,
  quantity: number,
): { dayChange: number; dayChangePercentage: number } {
  const dayChange = (lastPrice - closePrice) * quantity;
  const dayChangePercentage = closePrice > 0 ? ((lastPrice - closePrice) / closePrice) * 100 : 0;
  return { dayChange, dayChangePercentage };
}

export function calculateM2M(
  buyValue: number,
  sellValue: number,
  quantity: number,
  lastPrice: number,
  multiplier: number = 1,
): number {
  const netValue = sellValue - buyValue;
  const unrealisedValue = quantity * lastPrice * multiplier;
  return netValue + unrealisedValue;
}

export function calculateWeightedAveragePrice(
  existingQty: number,
  existingAvgPrice: number,
  newQty: number,
  newPrice: number,
): number {
  if (existingQty + newQty === 0) return 0;
  return ((existingQty * existingAvgPrice) + (newQty * newPrice)) / (existingQty + newQty);
}
