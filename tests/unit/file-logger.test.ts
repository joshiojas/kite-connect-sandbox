import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initFileLogger, logRecord, closeFileLogger } from '../../src/logging/file-logger.js';
import { readFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('File logger', () => {
  let logDir: string;
  let logPath: string;

  beforeEach(() => {
    logDir = join(tmpdir(), `kite-logger-test-${Date.now()}`);
    logPath = join(logDir, 'test.log');
    mkdirSync(logDir, { recursive: true });
  });

  afterEach(() => {
    closeFileLogger();
    try {
      if (existsSync(logPath)) unlinkSync(logPath);
    } catch { /* ignore */ }
  });

  it('writes valid JSONL to the log file', async () => {
    initFileLogger(logPath);

    logRecord({ level: 'info', message: 'TEST_MESSAGE', data: { foo: 'bar' } });

    // Give the write stream time to flush
    await new Promise((resolve) => setTimeout(resolve, 100));

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(1);

    const record = JSON.parse(lines[0]!);
    expect(record.service).toBe('KiteProxy');
    expect(record.level).toBe('info');
    expect(record.type).toBe('info');
    expect(record.message).toBe('TEST_MESSAGE');
    expect(record.data).toEqual({ foo: 'bar' });
    expect(record.timestamp).toBeDefined();
    expect(typeof record.timestamp).toBe('string');
  });

  it('includes \\n delimiter between records', async () => {
    initFileLogger(logPath);

    logRecord({ level: 'info', message: 'FIRST' });
    logRecord({ level: 'warn', message: 'SECOND' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const content = readFileSync(logPath, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);

    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);

    expect(JSON.parse(lines[0]!).message).toBe('FIRST');
    expect(JSON.parse(lines[1]!).message).toBe('SECOND');
  });

  it('contains required fields in every record', async () => {
    initFileLogger(logPath);

    logRecord({ level: 'error', message: 'ERR_TEST' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const content = readFileSync(logPath, 'utf-8');
    const record = JSON.parse(content.trim());

    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('service');
    expect(record).toHaveProperty('level');
    expect(record).toHaveProperty('message');
    expect(record.service).toBe('KiteProxy');
  });

  it('writes to stdout even without file logger initialized', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Don't call initFileLogger — no file stream
    logRecord({ level: 'info', message: 'STDOUT_TEST' });

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.message).toBe('STDOUT_TEST');

    stdoutSpy.mockRestore();
  });

  it('does not crash when log directory is invalid', () => {
    // Initialize with an impossible path — should not throw
    expect(() => {
      initFileLogger('/proc/nonexistent/impossible/path/test.log');
    }).not.toThrow();
  });
});
