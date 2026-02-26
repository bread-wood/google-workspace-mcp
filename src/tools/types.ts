import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OAuth2Client } from 'google-auth-library';
import type { Config } from '../config.js';
import type { RateLimiter } from '../security/rate-limiter.js';

export interface ToolContext {
  config: Config;
  rateLimiter: RateLimiter;
  auth: OAuth2Client;
}

export type ToolRegistrar = (server: McpServer, context: ToolContext) => void;
