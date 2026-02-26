import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as tokenStore from '../../../src/auth/token-store.js';

describe('token-store', () => {
  it('exports getOrCreateEncryptionKey', () => {
    expect(typeof tokenStore.getOrCreateEncryptionKey).toBe('function');
  });

  it('exports saveTokens', () => {
    expect(typeof tokenStore.saveTokens).toBe('function');
  });

  it('exports loadTokens', () => {
    expect(typeof tokenStore.loadTokens).toBe('function');
  });

  it('loadTokens returns null when no file exists', () => {
    // Use a temp directory that has no tokens.enc file
    const tempDir = mkdtempSync(join(tmpdir(), 'token-store-test-'));
    const result = tokenStore.loadTokens(tempDir);
    expect(result).toBeNull();
  });
});
