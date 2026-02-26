import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { logger } from '../logger.js';

const SERVICE_NAME = 'google-workspace-mcp';
const ACCOUNT_NAME = 'encryption-key';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit for GCM
const KEY_LENGTH = 32; // 256-bit

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope?: string;
}

interface EncryptedData {
  iv: string;     // hex
  tag: string;    // hex
  ciphertext: string; // hex
}

function getTokenFilePath(configDir: string): string {
  return join(configDir, 'tokens.enc');
}

function execKeychain(args: string): string {
  return execSync(`security ${args}`, {
    encoding: 'utf-8',
    timeout: 5000,
  }).trim();
}

export function getOrCreateEncryptionKey(): Buffer {
  // Try to read existing key from Keychain
  try {
    const result = execKeychain(
      `find-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" -w`,
    );
    const key = Buffer.from(result, 'hex');
    if (key.length === KEY_LENGTH) {
      logger.debug('Encryption key loaded from Keychain');
      return key;
    }
    logger.warn('Invalid key length in Keychain, regenerating');
  } catch {
    logger.debug('No encryption key in Keychain, creating one');
  }

  // Generate new key and store in Keychain
  const key = randomBytes(KEY_LENGTH);
  const hexKey = key.toString('hex');
  try {
    // Delete old entry if exists (ignore errors)
    try {
      execKeychain(`delete-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}"`);
    } catch {
      // Entry didn't exist, that's fine
    }
    execKeychain(
      `add-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" -w "${hexKey}" -U`,
    );
    logger.info('Encryption key stored in Keychain');
  } catch (err) {
    throw new Error(`Failed to store encryption key in Keychain: ${err}`);
  }

  return key;
}

function encrypt(data: string, key: Buffer): EncryptedData {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

function decrypt(data: EncryptedData, key: Buffer): string {
  const iv = Buffer.from(data.iv, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  const ciphertext = Buffer.from(data.ciphertext, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

export function saveTokens(tokens: StoredTokens, configDir: string): void {
  const key = getOrCreateEncryptionKey();
  const plaintext = JSON.stringify(tokens);
  const encrypted = encrypt(plaintext, key);

  // Ensure config directory exists with restrictive permissions
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  const filePath = getTokenFilePath(configDir);
  writeFileSync(filePath, JSON.stringify(encrypted), { mode: 0o600 });
  logger.info('Tokens saved (encrypted)');
}

export function loadTokens(configDir: string): StoredTokens | null {
  const filePath = getTokenFilePath(configDir);
  if (!existsSync(filePath)) {
    logger.debug('No token file found');
    return null;
  }

  try {
    const key = getOrCreateEncryptionKey();
    const raw = readFileSync(filePath, 'utf-8');
    const encrypted: EncryptedData = JSON.parse(raw);

    if (!encrypted.iv || !encrypted.tag || !encrypted.ciphertext) {
      logger.warn('Invalid token file format');
      return null;
    }

    const plaintext = decrypt(encrypted, key);
    const tokens: StoredTokens = JSON.parse(plaintext);

    if (!tokens.access_token || !tokens.refresh_token) {
      logger.warn('Token file missing required fields');
      return null;
    }

    logger.debug('Tokens loaded (decrypted)');
    return tokens;
  } catch (err) {
    logger.warn('Failed to load tokens', { error: String(err) });
    return null;
  }
}
