import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { authenticate } from './auth/oauth.js';
import { initializeGoogleClient } from './google/client.js';
import { createServer } from './server.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();

    // Authenticate with Google
    logger.info('Starting authentication...');
    const auth = await authenticate(config);
    initializeGoogleClient(auth);

    // Create MCP server with all tools
    const server = createServer(config, auth);

    // Connect via stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Google Workspace MCP server running on stdio');
  } catch (err) {
    logger.error('Fatal error during startup', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

main();
