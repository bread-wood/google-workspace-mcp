import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerDocsDelete: ToolRegistrar = (server, context) => {
  server.tool(
    'docs_delete',
    'Permanently delete a Google Doc. This is irreversible — the document cannot be recovered. Consider using docs_archive for a safer alternative.',
    {
      documentId: z.string().describe('The Google Docs document ID to permanently delete'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    async ({ documentId }) => {
      try {
        context.rateLimiter.check('docs_delete');

        const drive = getDriveClient();

        await drive.files.delete({
          fileId: documentId,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Document ${documentId} permanently deleted.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
