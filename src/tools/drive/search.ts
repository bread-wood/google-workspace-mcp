import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitizeField } from '../../sanitize/pipeline.js';

export const registerDriveSearch: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_search',
    'Search Google Drive files using Drive search syntax (e.g., "name contains \'report\'", "mimeType=\'application/pdf\'"). Returns file summaries.',
    {
      query: z.string().describe('Google Drive search query (uses Drive search syntax)'),
      maxResults: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe('Maximum number of results to return (1-50, default 10)'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ query, maxResults }) => {
      try {
        context.rateLimiter.check('drive_search');

        const drive = getDriveClient();

        const listResponse = await drive.files.list({
          q: query,
          pageSize: maxResults,
          fields: 'files(id,name,mimeType,size,modifiedTime,owners)',
        });

        const files = listResponse.data.files || [];

        if (files.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No files found matching the query.' }],
          };
        }

        const results = files.map((file) => {
          const ownerNames = file.owners?.map((o) => o.displayName || o.emailAddress || 'unknown').join(', ') || 'unknown';
          return [
            `ID: ${file.id}`,
            `Name: ${sanitizeField(file.name || '(untitled)')}`,
            `Type: ${file.mimeType || 'unknown'}`,
            `Size: ${file.size ? `${file.size} bytes` : 'N/A'}`,
            `Modified: ${file.modifiedTime || 'unknown'}`,
            `Owner: ${sanitizeField(ownerNames)}`,
          ].join('\n');
        });

        const text = `Found ${files.length} file(s):\n\n${results.join('\n\n---\n\n')}`;

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
