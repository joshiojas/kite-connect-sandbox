import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WriteStream } from 'node:fs';

export interface LogRecord {
  timestamp: string;
  service: string;
  level: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

let stream: WriteStream | null = null;

export function initFileLogger(logPath: string): void {
  // Close any existing stream before opening a new one
  if (stream) {
    stream.end();
    stream = null;
  }

  try {
    mkdirSync(dirname(logPath), { recursive: true });
    stream = createWriteStream(logPath, { flags: 'a' });
    stream.on('error', (err) => {
      console.error('Log file stream error:', err.message);
      stream = null;
    });
  } catch (err) {
    console.error('Failed to initialize file logger:', (err as Error).message);
  }
}

export function logRecord(entry: {
  level: string;
  message: string;
  data?: Record<string, unknown>;
}): void {
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    service: 'KiteProxy',
    level: entry.level,
    type: entry.level,
    message: entry.message,
    data: entry.data,
  };

  const json = JSON.stringify(record);

  // Always write to stdout
  process.stdout.write(json + '\n');

  // Write to file if stream is available
  if (stream) {
    stream.write(json + '\n', (err) => {
      if (err) {
        console.error('Failed to write to log file:', err.message);
      }
    });
  }
}

export function closeFileLogger(): void {
  if (stream) {
    stream.end();
    stream = null;
  }
}
