import Database from 'better-sqlite3';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { runMigrations } from './migrations.js';
import type { AppConfig } from '../types/config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export function createDatabase(config: AppConfig): Database.Database {
  const dbPath = config.sandbox.persistence === 'memory' ? ':memory:' : config.sandbox.dbPath;
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema migrations
  runMigrations(db);

  return db;
}

export const databasePlugin = fp(
  async (fastify: FastifyInstance) => {
    const config = fastify.config;
    const db = createDatabase(config);

    fastify.decorate('db', db);

    fastify.addHook('onClose', () => {
      // Flush WAL and close cleanly
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    });
  },
  {
    name: 'database',
  },
);
