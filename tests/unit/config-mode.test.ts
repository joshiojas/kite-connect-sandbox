import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('Config — SANDBOX_MODE', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to sandbox mode when SANDBOX_MODE is not set', () => {
    delete process.env.SANDBOX_MODE;
    const config = loadConfig();
    expect(config.mode).toBe('sandbox');
  });

  it('sets mode to proxy when SANDBOX_MODE=proxy', () => {
    process.env.SANDBOX_MODE = 'proxy';
    const config = loadConfig();
    expect(config.mode).toBe('proxy');
  });

  it('sets mode to sandbox when SANDBOX_MODE=sandbox', () => {
    process.env.SANDBOX_MODE = 'sandbox';
    const config = loadConfig();
    expect(config.mode).toBe('sandbox');
  });

  it('loads LOG_FILE_PATH from environment', () => {
    process.env.LOG_FILE_PATH = '/tmp/test.log';
    const config = loadConfig();
    expect(config.logFilePath).toBe('/tmp/test.log');
  });

  it('defaults logFilePath to /data/logs/kite-proxy.log', () => {
    delete process.env.LOG_FILE_PATH;
    const config = loadConfig();
    expect(config.logFilePath).toBe('/data/logs/kite-proxy.log');
  });

  it('loads enforceInProxyMode from environment', () => {
    process.env.SANDBOX_RATE_LIMIT_PROXY = 'false';
    const config = loadConfig();
    expect(config.rateLimits.enforceInProxyMode).toBe(false);
  });

  it('defaults enforceInProxyMode to true', () => {
    delete process.env.SANDBOX_RATE_LIMIT_PROXY;
    const config = loadConfig();
    expect(config.rateLimits.enforceInProxyMode).toBe(true);
  });
});
