import { describe, it, expect } from 'vitest';
import { parseAuthHeader } from '../../src/middleware/auth.js';

describe('Auth Header Parsing', () => {
  it('should parse valid auth header', () => {
    const result = parseAuthHeader('token my_api_key:my_access_token');
    expect(result).toEqual({
      apiKey: 'my_api_key',
      accessToken: 'my_access_token',
    });
  });

  it('should return null for missing header', () => {
    expect(parseAuthHeader(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseAuthHeader('')).toBeNull();
  });

  it('should return null for header without token prefix', () => {
    expect(parseAuthHeader('my_api_key:my_access_token')).toBeNull();
  });

  it('should return null for header without colon separator', () => {
    expect(parseAuthHeader('token my_api_key')).toBeNull();
  });

  it('should handle access tokens containing colons', () => {
    const result = parseAuthHeader('token api_key:token:with:colons');
    expect(result).toEqual({
      apiKey: 'api_key',
      accessToken: 'token:with:colons',
    });
  });
});
