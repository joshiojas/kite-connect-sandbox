import { describe, it, expect } from 'vitest';
import { calculateMarginRequired } from '../../src/portfolio/margin-calculator.js';

describe('Margin Calculator', () => {
  describe('Equity CNC', () => {
    it('should require full value for CNC BUY', () => {
      const result = calculateMarginRequired('NSE', 'CNC', 'LIMIT', 'BUY', 10, 1500);
      expect(result.required).toBe(15000);
      expect(result.type).toBe('CNC');
    });

    it('should require zero margin for CNC SELL', () => {
      const result = calculateMarginRequired('NSE', 'CNC', 'LIMIT', 'SELL', 10, 1500);
      expect(result.required).toBe(0);
      expect(result.type).toBe('CNC');
    });
  });

  describe('Equity MIS', () => {
    it('should require ~20% for MIS', () => {
      const result = calculateMarginRequired('NSE', 'MIS', 'MARKET', 'BUY', 10, 1000);
      expect(result.required).toBe(2000); // 10000 * 0.20
      expect(result.type).toBe('MIS');
    });
  });

  describe('F&O NRML', () => {
    it('should require ~50% for NFO NRML', () => {
      const result = calculateMarginRequired('NFO', 'NRML', 'LIMIT', 'BUY', 100, 200);
      expect(result.required).toBe(10000); // 20000 * 0.50
      expect(result.type).toBe('NRML');
    });

    it('should require ~50% for MCX NRML', () => {
      const result = calculateMarginRequired('MCX', 'NRML', 'LIMIT', 'BUY', 10, 5000);
      expect(result.required).toBe(25000); // 50000 * 0.50
    });
  });
});
