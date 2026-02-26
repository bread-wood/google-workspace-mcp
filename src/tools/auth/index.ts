import type { ToolRegistrar } from '../types.js';
import { mapError } from '../../errors/index.js';

export const registerAuthTools: ToolRegistrar = (server, context) => {
  server.tool(
    'auth_status',
    'Check current authentication status, authorized scopes, and token expiry. Can trigger re-authentication if needed.',
    {},
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async () => {
      try {
        context.rateLimiter.check('auth_status');

        const credentials = context.auth.credentials;
        if (!credentials.access_token) {
          return {
            content: [{
              type: 'text' as const,
              text: 'Not authenticated. Please restart the server to initiate the OAuth flow.',
            }],
          };
        }

        const expiryDate = credentials.expiry_date;
        const isExpired = expiryDate ? expiryDate < Date.now() : true;
        const scope = credentials.scope || 'unknown';

        const lines = [
          `Authenticated: Yes`,
          `Token type: ${credentials.token_type || 'unknown'}`,
          `Scopes: ${scope}`,
          `Expires: ${expiryDate ? new Date(expiryDate).toISOString() : 'unknown'}`,
          `Status: ${isExpired ? 'Expired (will auto-refresh on next API call)' : 'Valid'}`,
          `Refresh token: ${credentials.refresh_token ? 'Present' : 'Missing'}`,
        ];

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
