import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailTrash: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_trash',
    'Move Gmail messages to trash. Messages in trash are automatically deleted after 30 days. This is reversible.',
    {
      messageIds: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe('Array of Gmail message IDs to trash (1-50)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    async ({ messageIds }) => {
      try {
        context.rateLimiter.check('gmail_trash');

        const gmail = getGmailClient();

        let trashedCount = 0;
        for (const id of messageIds) {
          await gmail.users.messages.trash({
            userId: 'me',
            id,
          });
          trashedCount++;
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Successfully moved ${trashedCount} message(s) to trash.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
