/**
 * Structured stderr-only logger.
 * stdout is reserved for JSON-RPC (MCP protocol).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'password',
  'secret',
  'client_secret',
  'authorization',
  'cookie',
]);

function redactSensitive(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(redactSensitive);
  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitive(value);
      }
    }
    return redacted;
  }
  return data;
}

class Logger {
  private level: LogLevel;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    this.level = envLevel && envLevel in LOG_LEVELS ? (envLevel as LogLevel) : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...(data !== undefined ? { data: redactSensitive(data) } : {}),
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }
}

export const logger = new Logger();
