import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailModifyLabels: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_modify_labels',
    'Add or remove labels from Gmail messages. Use removeLabelIds: ["UNREAD"] to mark as read, addLabelIds: ["INBOX"] to move back to inbox, etc.',
    {
      messageIds: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe('Array of Gmail message IDs to modify (1-50)'),
      addLabelIds: z
        .array(z.string())
        .optional()
        .describe('Label IDs to add to the messages'),
      removeLabelIds: z
        .array(z.string())
        .optional()
        .describe('Label IDs to remove from the messages'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ messageIds, addLabelIds, removeLabelIds }) => {
      try {
        if ((!addLabelIds || addLabelIds.length === 0) && (!removeLabelIds || removeLabelIds.length === 0)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'At least one of addLabelIds or removeLabelIds must be provided with at least one label.',
              },
            ],
            isError: true,
          };
        }

        context.rateLimiter.check('gmail_modify_labels');

        const gmail = getGmailClient();

        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            ...(addLabelIds && addLabelIds.length > 0 ? { addLabelIds } : {}),
            ...(removeLabelIds && removeLabelIds.length > 0 ? { removeLabelIds } : {}),
          },
        });

        const actions: string[] = [];
        if (addLabelIds && addLabelIds.length > 0) {
          actions.push(`added labels: ${addLabelIds.join(', ')}`);
        }
        if (removeLabelIds && removeLabelIds.length > 0) {
          actions.push(`removed labels: ${removeLabelIds.join(', ')}`);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Successfully modified ${messageIds.length} message(s): ${actions.join('; ')}.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
