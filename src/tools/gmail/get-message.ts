import { z } from 'zod';
import type { gmail_v1 } from 'googleapis';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitize, sanitizeField } from '../../sanitize/pipeline.js';

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  // Check direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Check parts recursively, prefer text/plain
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
    }

    // Recurse into nested parts
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }

  return '';
}

export const registerGmailGetMessage: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_get_message',
    'Get the full content of a specific Gmail message by its ID. Returns headers, body, and attachment list.',
    {
      messageId: z.string().describe('The Gmail message ID to retrieve'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ messageId }) => {
      try {
        context.rateLimiter.check('gmail_get_message');

        const gmail = getGmailClient();

        const response = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const message = response.data;
        const headers = message.payload?.headers || [];

        const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find((h) => h.name === 'From')?.value || '(unknown sender)';
        const to = headers.find((h) => h.name === 'To')?.value || '(unknown recipient)';
        const date = headers.find((h) => h.name === 'Date')?.value || '(unknown date)';

        const rawBody = message.payload ? extractBody(message.payload) : '';
        const sanitizedBody = rawBody
          ? sanitize(rawBody, { source: 'email' })
          : '(no body content)';

        // Collect attachment info
        const attachments: string[] = [];
        function collectAttachments(part: gmail_v1.Schema$MessagePart): void {
          if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
            attachments.push(
              `- ${sanitizeField(part.filename)} (${part.mimeType || 'unknown type'}, ${part.body.size || 0} bytes)`,
            );
          }
          if (part.parts) {
            for (const subPart of part.parts) {
              collectAttachments(subPart);
            }
          }
        }
        if (message.payload) {
          collectAttachments(message.payload);
        }

        const lines = [
          `Subject: ${sanitizeField(subject)}`,
          `From: ${sanitizeField(from)}`,
          `To: ${sanitizeField(to)}`,
          `Date: ${sanitizeField(date)}`,
          `Labels: ${(message.labelIds || []).join(', ')}`,
          '',
          sanitizedBody,
        ];

        if (attachments.length > 0) {
          lines.push('', `Attachments (${attachments.length}):`, ...attachments);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
