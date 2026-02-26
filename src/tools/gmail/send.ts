import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

function createRawEmail(to: string, subject: string, body: string, replyToMessageId?: string): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    ...(replyToMessageId ? [`In-Reply-To: ${replyToMessageId}`, `References: ${replyToMessageId}`] : []),
  ];
  const message = headers.join('\r\n') + '\r\n\r\n' + body;
  return Buffer.from(message).toString('base64url');
}

export const registerGmailSend: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_send',
    'Send an email via Gmail. Supports plain text messages and replies to existing threads.',
    {
      to: z.string().describe('Recipient email address'),
      subject: z.string().max(500).describe('Email subject line (max 500 characters)'),
      body: z.string().max(50000).describe('Email body in plain text (max 50000 characters)'),
      replyToMessageId: z
        .string()
        .optional()
        .describe('Optional Message-ID header to reply to (for threading)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ to, subject, body, replyToMessageId }) => {
      try {
        context.rateLimiter.check('gmail_send');

        const gmail = getGmailClient();

        const raw = createRawEmail(to, subject, body, replyToMessageId);

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw,
          },
        });

        const messageId = response.data.id;
        const threadId = response.data.threadId;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Email sent successfully.\nMessage ID: ${messageId}\nThread ID: ${threadId}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
