import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { mapError } from '../../errors/index.js';
import { archiveFile } from '../archive-helper.js';

export const registerSlidesArchive: ToolRegistrar = (server, context) => {
  server.tool(
    'slides_archive',
    'Archive a Google Slides presentation by moving it to the ARCHIVED folder in Drive. This is a soft delete — the presentation is not permanently removed.',
    {
      presentationId: z.string().describe('The Google Slides presentation ID to archive'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ presentationId }) => {
      try {
        context.rateLimiter.check('slides_archive');

        const name = await archiveFile(presentationId, context.config);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Presentation archived successfully.\nPresentation: ${name}\nPresentation ID: ${presentationId}\nMoved to: ${context.config.archiveFolderName} folder`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
