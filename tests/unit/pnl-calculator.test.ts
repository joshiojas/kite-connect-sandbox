import { describe, it, expect } from 'vitest';
import { calculatePositionPnL, calculateHoldingPnL, calculateDayChange, calculateWeightedAveragePrice } from '../../src/portfolio/pnl-calculator.js';

describe('PnL Calculator', () => {
  describe('calculatePositionPnL', () => {
    it('should calculate long position P&L', () => {
      const pnl = calculatePositionPnL(10, 100, 110);
      expect(pnl).toBe(100); // (110 - 100) * 10
    });

    it('should calculate short position P&L', () => {
      const pnl = calculatePositionPnL(-10, 100, 90);
      expect(pnl).toBe(100); // (90 - 100) * -10
    });

    it('should apply multiplier', () => {
      const pnl = calculatePositionPnL(10, 100, 110, 50);
      expect(pnl).toBe(5000); // (110 - 100) * 10 * 50
    });

    it('should handle zero quantity', () => {
      const pnl = calculatePositionPnL(0, 100, 110);
      expect(pnl).toBe(0);
    });

    it('should handle loss on long position', () => {
      const pnl = calculatePositionPnL(10, 100, 90);
      expect(pnl).toBe(-100); // (90 - 100) * 10
    });
  });

  describe('calculateHoldingPnL', () => {
    it('should calculate holding P&L', () => {
      const pnl = calculateHoldingPnL(10, 100, 120);
      expect(pnl).toBe(200); // (120 - 100) * 10
    });

    it('should handle loss', () => {
      const pnl = calculateHoldingPnL(10, 100, 80);
      expect(pnl).toBe(-200); // (80 - 100) * 10
    });
  });

  describe('calculateDayChange', () => {
    it('should calculate day change', () => {
      const result = calculateDayChange(110, 100, 10);
      expect(result.dayChange).toBe(100);
      expect(result.dayChangePercentage).toBe(10);
    });

    it('should handle zero close price', () => {
      const result = calculateDayChange(110, 0, 10);
      expect(result.dayChangePercentage).toBe(0);
    });
  });

  describe('calculateWeightedAveragePrice', () => {
    it('should calculate weighted average', () => {
      const avg = calculateWeightedAveragePrice(10, 100, 10, 120);
      expect(avg).toBe(110); // (10*100 + 10*120) / 20
    });

    it('should handle zero total quantity', () => {
      const avg = calculateWeightedAveragePrice(0, 0, 0, 100);
      expect(avg).toBe(0);
    });

    it('should handle first purchase', () => {
      const avg = calculateWeightedAveragePrice(0, 0, 10, 150);
      expect(avg).toBe(150);
    });
  });
});
