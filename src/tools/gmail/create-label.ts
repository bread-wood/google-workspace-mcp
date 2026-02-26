import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailCreateLabel: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_create_label',
    'Create a new Gmail label. Use "Parent/Child" format for sub-labels (e.g., "Finance/Bills").',
    {
      name: z.string().describe('Label name. Use "/" as separator for sub-labels (e.g., "Finance/Bills")'),
      backgroundColor: z
        .string()
        .optional()
        .describe('Background color in hex format (e.g., "#16a765"). Both colors must be provided together.'),
      textColor: z
        .string()
        .optional()
        .describe('Text color in hex format (e.g., "#ffffff"). Both colors must be provided together.'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ name, backgroundColor, textColor }) => {
      try {
        context.rateLimiter.check('gmail_create_label');

        const gmail = getGmailClient();

        const requestBody: {
          name: string;
          labelListVisibility: string;
          messageListVisibility: string;
          color?: { backgroundColor: string; textColor: string };
        } = {
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        };

        if (backgroundColor && textColor) {
          requestBody.color = { backgroundColor, textColor };
        }

        const response = await gmail.users.labels.create({
          userId: 'me',
          requestBody,
        });

        const label = response.data;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Label created successfully.\nName: ${label.name}\nID: ${label.id}\nType: ${label.type}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
