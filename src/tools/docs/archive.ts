import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { mapError } from '../../errors/index.js';
import { archiveFile } from '../archive-helper.js';

export const registerDocsArchive: ToolRegistrar = (server, context) => {
  server.tool(
    'docs_archive',
    'Archive a Google Doc by moving it to the ARCHIVED folder in Drive. This is a soft delete — the document is not permanently removed.',
    {
      documentId: z.string().describe('The Google Docs document ID to archive'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ documentId }) => {
      try {
        context.rateLimiter.check('docs_archive');

        const name = await archiveFile(documentId, context.config);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Document archived successfully.\nDocument: ${name}\nDocument ID: ${documentId}\nMoved to: ${context.config.archiveFolderName} folder`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
