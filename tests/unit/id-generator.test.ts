import { describe, it, expect, beforeEach } from 'vitest';
import { generateOrderId, generateExchangeOrderId, generateTradeId, generateGuid, generateUuid, resetCounters } from '../../src/utils/id-generator.js';

describe('ID Generator', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('generateOrderId', () => {
    it('should generate a 15-character numeric string', () => {
      const id = generateOrderId();
      expect(id).toMatch(/^\d{15}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateOrderId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateExchangeOrderId', () => {
    it('should generate a 15-character numeric string', () => {
      const id = generateExchangeOrderId();
      expect(id).toMatch(/^\d{15}$/);
    });
  });

  describe('generateTradeId', () => {
    it('should generate an 8-character numeric string', () => {
      const id = generateTradeId();
      expect(id).toMatch(/^\d{8}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(generateTradeId());
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('generateGuid', () => {
    it('should generate a 32-character string of digits', () => {
      const id = generateGuid();
      expect(id).toMatch(/^\d{32}$/);
    });
  });

  describe('generateUuid', () => {
    it('should generate a UUID-like string', () => {
      const id = generateUuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});
