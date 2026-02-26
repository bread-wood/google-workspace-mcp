import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailArchive: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_archive',
    'Archive Gmail messages by removing them from the inbox. Messages remain accessible via search and labels.',
    {
      messageIds: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe('Array of Gmail message IDs to archive (1-50)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ messageIds }) => {
      try {
        context.rateLimiter.check('gmail_archive');

        const gmail = getGmailClient();

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            removeLabelIds: ['INBOX'],
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Successfully archived ${messageIds.length} message(s).`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
