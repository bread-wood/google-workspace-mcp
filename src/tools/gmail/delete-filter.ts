import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailDeleteFilter: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_delete_filter',
    'Delete a Gmail filter by its ID. Use gmail_list_filters to find filter IDs.',
    {
      filterId: z.string().describe('The ID of the filter to delete (use gmail_list_filters to find IDs)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    async ({ filterId }) => {
      try {
        context.rateLimiter.check('gmail_delete_filter');

        const gmail = getGmailClient();

        await gmail.users.settings.filters.delete({
          userId: 'me',
          id: filterId,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Filter ${filterId} deleted successfully.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
