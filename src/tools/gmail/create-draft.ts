import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

function createRawEmail(to: string, subject: string, body: string): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
  ];
  const message = headers.join('\r\n') + '\r\n\r\n' + body;
  return Buffer.from(message).toString('base64url');
}

export const registerGmailCreateDraft: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_create_draft',
    'Create a draft email in Gmail. The draft can be reviewed and sent later from the Gmail interface.',
    {
      to: z.string().describe('Recipient email address'),
      subject: z.string().max(500).describe('Email subject line (max 500 characters)'),
      body: z.string().max(50000).describe('Email body in plain text (max 50000 characters)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ to, subject, body }) => {
      try {
        context.rateLimiter.check('gmail_create_draft');

        const gmail = getGmailClient();

        const raw = createRawEmail(to, subject, body);

        const response = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw,
            },
          },
        });

        const draftId = response.data.id;
        const messageId = response.data.message?.id;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Draft created successfully.\nDraft ID: ${draftId}\nMessage ID: ${messageId}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
