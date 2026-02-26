import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OAuth2Client } from 'google-auth-library';
import type { Config } from './config.js';
import type { ToolContext } from './tools/types.js';
import { RateLimiter } from './security/rate-limiter.js';
import { assertNoDeleteTools } from './security/delete-guard.js';
import { logger } from './logger.js';

// Tool registrars
import { registerAuthTools } from './tools/auth/index.js';
import { registerGmailTools } from './tools/gmail/index.js';
import { registerCalendarTools } from './tools/calendar/index.js';
import { registerDriveTools } from './tools/drive/index.js';
import { registerDocsTools } from './tools/docs/index.js';
import { registerSheetsTools } from './tools/sheets/index.js';

export function createServer(config: Config, auth: OAuth2Client): McpServer {
  const server = new McpServer({
    name: 'google-workspace-mcp',
    version: '1.0.0',
  });

  const context: ToolContext = {
    config,
    rateLimiter: new RateLimiter(),
    auth,
  };

  // Register all tools
  registerAuthTools(server, context);
  registerGmailTools(server, context);
  registerCalendarTools(server, context);
  registerDriveTools(server, context);
  registerDocsTools(server, context);
  registerSheetsTools(server, context);

  // Verify no delete tools were registered
  // Access internal tool registry to get tool names
  const toolNames = getRegisteredToolNames(server);
  assertNoDeleteTools(toolNames);
  logger.info(`Registered ${toolNames.length} tools`, { tools: toolNames });

  return server;
}

/**
 * Extract registered tool names from the MCP server.
 * Uses the server's internal state to enumerate tools.
 */
function getRegisteredToolNames(server: McpServer): string[] {
  // The McpServer stores tools as a plain object, not a Map
  const registeredTools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
  if (registeredTools && typeof registeredTools === 'object') {
    return Object.keys(registeredTools);
  }
  logger.warn('Could not enumerate registered tools for delete guard verification');
  return [];
}
