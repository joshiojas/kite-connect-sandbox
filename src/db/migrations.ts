import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database.Database): void {
  const schemaPath = resolve(__dirname, 'schema.sql');
  let sql: string;
  try {
    sql = readFileSync(schemaPath, 'utf-8');
  } catch {
    // Fallback for compiled output where .sql may be at a different path
    const altPath = resolve(process.cwd(), 'src', 'db', 'schema.sql');
    sql = readFileSync(altPath, 'utf-8');
  }
  db.exec(sql);
}
