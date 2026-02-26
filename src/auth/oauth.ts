import { google } from 'googleapis';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { type OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { logger } from '../logger.js';
import { loadTokens, saveTokens, type StoredTokens } from './token-store.js';
import { ALL_SCOPES } from './scopes.js';
import type { Config } from '../config.js';

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = createServer();
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve());
        });
        server.on('error', reject);
      });
      return port;
    } catch {
      continue;
    }
  }
  throw new Error(`No available port in range ${start}-${end}`);
}

async function waitForAuthCode(
  port: number,
  state: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authorization Failed</h1><p>You can close this tab.</p></body></html>');
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Invalid State</h1><p>CSRF protection triggered.</p></body></html>');
        cleanup();
        reject(new Error('OAuth state mismatch (possible CSRF)'));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Missing Code</h1></body></html>');
        cleanup();
        reject(new Error('No authorization code received'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Authorization Successful</h1><p>You can close this tab and return to the terminal.</p></body></html>');
      cleanup();
      resolve(code);
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth flow timed out'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }

    server.listen(port, '127.0.0.1', () => {
      logger.debug('OAuth callback server listening', { port });
    });

    server.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

export async function authenticate(config: Config): Promise<OAuth2Client> {
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    'http://127.0.0.1:3000/callback', // Placeholder, updated per flow
  );

  // Try loading existing tokens
  const existingTokens = loadTokens(config.configDir);
  if (existingTokens) {
    oauth2Client.setCredentials({
      access_token: existingTokens.access_token,
      refresh_token: existingTokens.refresh_token,
      token_type: existingTokens.token_type,
      expiry_date: existingTokens.expiry_date,
    });

    // Register token refresh handler
    oauth2Client.on('tokens', (tokens) => {
      const updated: StoredTokens = {
        access_token: tokens.access_token || existingTokens.access_token,
        refresh_token: tokens.refresh_token || existingTokens.refresh_token,
        token_type: tokens.token_type || existingTokens.token_type,
        expiry_date: tokens.expiry_date || existingTokens.expiry_date,
      };
      saveTokens(updated, config.configDir);
      logger.info('Tokens refreshed and saved');
    });

    // Test if tokens work (will auto-refresh if needed)
    try {
      await oauth2Client.getAccessToken();
      logger.info('Authenticated with existing tokens');
      return oauth2Client;
    } catch (err) {
      logger.warn('Existing tokens invalid, starting new auth flow', { error: String(err) });
    }
  }

  // Start new OAuth flow with PKCE
  const port = await findAvailablePort(3000, 3010);
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  (oauth2Client as unknown as { redirectUri_: string }).redirectUri_ = redirectUri;

  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ALL_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: CodeChallengeMethod.S256,
    redirect_uri: redirectUri,
  });

  logger.info('Opening browser for authentication...');
  logger.info(`If browser doesn't open, visit: ${authUrl}`);

  // Open browser
  const openModule = await import('open');
  await openModule.default(authUrl);

  // Wait for callback
  const code = await waitForAuthCode(port, state, config.authTimeoutMs);

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier: verifier,
    redirect_uri: redirectUri,
  });

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('OAuth token exchange did not return required tokens');
  }

  oauth2Client.setCredentials(tokens);

  // Save tokens
  const storedTokens: StoredTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type || 'Bearer',
    expiry_date: tokens.expiry_date || 0,
  };
  saveTokens(storedTokens, config.configDir);

  // Register refresh handler for future refreshes
  oauth2Client.on('tokens', (newTokens) => {
    const updated: StoredTokens = {
      access_token: newTokens.access_token || storedTokens.access_token,
      refresh_token: newTokens.refresh_token || storedTokens.refresh_token,
      token_type: newTokens.token_type || storedTokens.token_type,
      expiry_date: newTokens.expiry_date || storedTokens.expiry_date,
    };
    saveTokens(updated, config.configDir);
  });

  logger.info('Authentication successful');
  return oauth2Client;
}
