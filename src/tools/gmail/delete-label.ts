import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailDeleteLabel: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_delete_label',
    'Permanently delete a Gmail label. The label must be a user-created label (not a system label). Messages with this label are NOT deleted — only the label itself is removed.',
    {
      labelId: z.string().describe('The ID of the label to delete (e.g., "Label_123"). Use gmail_list_labels to find label IDs.'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    async ({ labelId }) => {
      try {
        context.rateLimiter.check('gmail_delete_label');

        const gmail = getGmailClient();

        await gmail.users.labels.delete({
          userId: 'me',
          id: labelId,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Label ${labelId} deleted successfully.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
