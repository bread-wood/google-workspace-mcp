import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';

export interface Config {
  clientId: string;
  clientSecret: string;
  maxContentLength: number;
  authTimeoutMs: number;
  logLevel: string;
  archiveFolderName: string;
  configDir: string;
}

const CONFIG_DIR = join(homedir(), '.config', 'google-workspace-mcp');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfigFile(): Record<string, unknown> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.warn('Config file is not a JSON object, ignoring');
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    logger.warn('Failed to read config file', { path: CONFIG_FILE, error: String(err) });
    return {};
  }
}

function getString(env: string | undefined, file: unknown, fallback: string): string {
  if (env !== undefined && env !== '') return env;
  if (typeof file === 'string' && file !== '') return file;
  return fallback;
}

function getNumber(env: string | undefined, file: unknown, fallback: number): number {
  if (env !== undefined && env !== '') {
    const n = Number(env);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid numeric config value: ${env}`);
    }
    return n;
  }
  if (typeof file === 'number' && Number.isFinite(file) && file > 0) return file;
  return fallback;
}

export function loadConfig(): Config {
  const file = loadConfigFile();

  const clientId = getString(process.env.GOOGLE_CLIENT_ID, file.clientId, '');
  const clientSecret = getString(process.env.GOOGLE_CLIENT_SECRET, file.clientSecret, '');

  if (!clientId) {
    throw new Error(
      'GOOGLE_CLIENT_ID is required. Set it as an environment variable or in ' + CONFIG_FILE,
    );
  }
  if (!clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_SECRET is required. Set it as an environment variable or in ' + CONFIG_FILE,
    );
  }

  const config: Config = {
    clientId,
    clientSecret,
    maxContentLength: getNumber(process.env.MAX_CONTENT_LENGTH, file.maxContentLength, 50_000),
    authTimeoutMs: getNumber(process.env.AUTH_TIMEOUT_MS, file.authTimeoutMs, 300_000),
    logLevel: getString(process.env.LOG_LEVEL, file.logLevel, 'info'),
    archiveFolderName: getString(process.env.ARCHIVE_FOLDER_NAME, file.archiveFolderName, 'ARCHIVED'),
    configDir: CONFIG_DIR,
  };

  logger.info('Config loaded', {
    maxContentLength: config.maxContentLength,
    authTimeoutMs: config.authTimeoutMs,
    logLevel: config.logLevel,
    archiveFolderName: config.archiveFolderName,
  });

  return config;
}
