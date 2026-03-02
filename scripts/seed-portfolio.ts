/**
 * Seed a portfolio with sample holdings.
 * Usage: npx tsx scripts/seed-portfolio.ts [api_key]
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const apiKey = process.argv[2] || 'demo_api_key';
const dbPath = process.env.SANDBOX_DB_PATH || resolve(process.cwd(), 'sandbox.db');

console.log(`Seeding portfolio for api_key: ${apiKey}`);
console.log(`Database: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schemaPath = resolve(process.cwd(), 'src', 'db', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');
db.exec(schema);

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
const initialCapital = 1000000;

// Create portfolio
db.prepare(
  'INSERT OR REPLACE INTO portfolios (api_key, initial_capital, available_cash, used_margin, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
).run(apiKey, initialCapital, 750000, now, now);

// Seed holdings
const holdings = [
  { symbol: 'INFY', exchange: 'NSE', qty: 50, avg: 1450 },
  { symbol: 'RELIANCE', exchange: 'NSE', qty: 20, avg: 2400 },
  { symbol: 'TCS', exchange: 'NSE', qty: 10, avg: 3400 },
  { symbol: 'HDFCBANK', exchange: 'NSE', qty: 30, avg: 1550 },
  { symbol: 'ICICIBANK', exchange: 'NSE', qty: 40, avg: 950 },
];

for (const h of holdings) {
  db.prepare(
    `INSERT OR REPLACE INTO holdings (
      api_key, tradingsymbol, exchange, product, quantity, t1_quantity,
      realised_quantity, opening_quantity, average_price, created_at, updated_at
    ) VALUES (?, ?, ?, 'CNC', ?, 0, 0, ?, ?, ?, ?)`,
  ).run(apiKey, h.symbol, h.exchange, h.qty, h.qty, h.avg, now, now);
}

console.log(`Seeded ${holdings.length} holdings`);
console.log(`Available cash: ₹750,000`);
console.log('Done!');

db.close();
