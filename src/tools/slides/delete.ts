import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerSlidesDelete: ToolRegistrar = (server, context) => {
  server.tool(
    'slides_delete',
    'Permanently delete a Google Slides presentation. This is irreversible — the presentation cannot be recovered. Consider using slides_archive for a safer alternative.',
    {
      presentationId: z.string().describe('The Google Slides presentation ID to permanently delete'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    async ({ presentationId }) => {
      try {
        context.rateLimiter.check('slides_delete');

        const drive = getDriveClient();

        await drive.files.delete({
          fileId: presentationId,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Presentation ${presentationId} permanently deleted.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
