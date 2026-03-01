import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from './types/config.js';

function loadJsonConfig(): AppConfig {
  const configPath = resolve(process.cwd(), 'config', 'default.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as AppConfig;
  } catch {
    throw new Error(`Failed to load config from ${configPath}`);
  }
}

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

export function loadConfig(): AppConfig {
  const defaults = loadJsonConfig();

  return {
    server: {
      port: envNumber('SANDBOX_PORT', defaults.server.port),
      host: envString('SANDBOX_HOST', defaults.server.host),
      logLevel: envString('SANDBOX_LOG_LEVEL', defaults.server.logLevel),
    },
    sandbox: {
      initialCapital: envNumber('SANDBOX_INITIAL_CAPITAL', defaults.sandbox.initialCapital),
      currency: defaults.sandbox.currency,
      defaultSegments: defaults.sandbox.defaultSegments,
      persistence: envString('SANDBOX_PERSISTENCE', defaults.sandbox.persistence) as 'sqlite' | 'memory',
      dbPath: envString('SANDBOX_DB_PATH', defaults.sandbox.dbPath),
      resetPortfolioOnRestart: envBool('SANDBOX_RESET_ON_RESTART', defaults.sandbox.resetPortfolioOnRestart),
    },
    upstream: {
      baseUrl: envString('KITE_BASE_URL', defaults.upstream.baseUrl),
      wsUrl: envString('KITE_WS_URL', defaults.upstream.wsUrl),
      timeout: envNumber('KITE_UPSTREAM_TIMEOUT', defaults.upstream.timeout),
      retries: defaults.upstream.retries,
    },
    orderEngine: {
      ...defaults.orderEngine,
    },
    rateLimits: {
      ...defaults.rateLimits,
    },
  };
}
