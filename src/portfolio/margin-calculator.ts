import { MIS_MARGIN_PERCENTAGE, NRML_MARGIN_PERCENTAGE } from '../utils/constants.js';

export interface MarginRequirement {
  required: number;
  type: string;
}

export function calculateMarginRequired(
  exchange: string,
  product: string,
  orderType: string,
  transactionType: string,
  quantity: number,
  price: number,
): MarginRequirement {
  const totalValue = quantity * price;

  // F&O exchanges
  const isFnO = ['NFO', 'CDS', 'BFO', 'MCX', 'BCD'].includes(exchange);

  if (product === 'MIS') {
    // Intraday: reduced margin
    return {
      required: totalValue * MIS_MARGIN_PERCENTAGE,
      type: 'MIS',
    };
  }

  if (product === 'NRML' && isFnO) {
    // F&O NRML: simplified SPAN + exposure
    return {
      required: totalValue * NRML_MARGIN_PERCENTAGE,
      type: 'NRML',
    };
  }

  if (product === 'CNC') {
    // Delivery: full value for buy, holdings check for sell
    if (transactionType === 'BUY') {
      return {
        required: totalValue,
        type: 'CNC',
      };
    }
    // Sell CNC: no margin needed (we check holdings instead)
    return {
      required: 0,
      type: 'CNC',
    };
  }

  // Default: full value
  return {
    required: totalValue,
    type: product,
  };
}

export function calculateOrderValue(quantity: number, price: number): number {
  return quantity * price;
}
