import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailListLabels: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_list_labels',
    'List all Gmail labels in the account. Useful for discovering label IDs to use in search queries.',
    {},
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async () => {
      try {
        context.rateLimiter.check('gmail_list_labels');

        const gmail = getGmailClient();

        const response = await gmail.users.labels.list({
          userId: 'me',
        });

        const labels = response.data.labels || [];

        if (labels.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No labels found.' }],
          };
        }

        const lines = labels.map((label) => {
          const labelType = label.type === 'system' ? '(system)' : '(user)';
          return `- ${label.name} ${labelType} [ID: ${label.id}]`;
        });

        const text = `Found ${labels.length} label(s):\n\n${lines.join('\n')}`;

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
