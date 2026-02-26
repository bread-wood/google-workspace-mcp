import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitizeField } from '../../sanitize/pipeline.js';

export const registerDriveGetMetadata: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_get_file_metadata',
    'Get detailed metadata for a Google Drive file by its ID. Returns file properties including name, type, size, dates, owners, and links.',
    {
      fileId: z.string().describe('The ID of the Google Drive file'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ fileId }) => {
      try {
        context.rateLimiter.check('drive_get_file_metadata');

        const drive = getDriveClient();

        const response = await drive.files.get({
          fileId,
          fields: 'id,name,mimeType,size,modifiedTime,createdTime,owners,parents,webViewLink,description',
        });

        const file = response.data;

        const ownerNames = file.owners?.map((o) => o.displayName || o.emailAddress || 'unknown').join(', ') || 'unknown';

        const lines = [
          `ID: ${file.id}`,
          `Name: ${sanitizeField(file.name || '(untitled)')}`,
          `MIME Type: ${file.mimeType || 'unknown'}`,
          `Size: ${file.size ? `${file.size} bytes` : 'N/A'}`,
          `Created: ${file.createdTime || 'unknown'}`,
          `Modified: ${file.modifiedTime || 'unknown'}`,
          `Owner: ${sanitizeField(ownerNames)}`,
          `Parents: ${file.parents?.join(', ') || 'none'}`,
          `Web Link: ${file.webViewLink || 'N/A'}`,
          `Description: ${file.description ? sanitizeField(file.description) : 'none'}`,
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
