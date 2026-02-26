import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitizeField } from '../../sanitize/pipeline.js';

export const registerGmailSearch: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_search',
    'Search Gmail messages using Gmail search syntax (e.g., "from:user@example.com", "subject:hello", "is:unread"). Returns message summaries.',
    {
      query: z.string().describe('Gmail search query (uses Gmail search syntax)'),
      maxResults: z
        .number()
        .min(1)
        .max(500)
        .default(10)
        .describe('Maximum number of results to return (1-500, default 10)'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ query, maxResults }) => {
      try {
        context.rateLimiter.check('gmail_search');

        const gmail = getGmailClient();

        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
        });

        const messages = listResponse.data.messages || [];

        if (messages.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No messages found matching the query.' }],
          };
        }

        const results = await Promise.all(
          messages.map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'METADATA',
              metadataHeaders: ['Subject', 'From', 'Date'],
            });

            const headers = detail.data.payload?.headers || [];
            const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
            const from = headers.find((h) => h.name === 'From')?.value || '(unknown sender)';
            const date = headers.find((h) => h.name === 'Date')?.value || '(unknown date)';
            const snippet = detail.data.snippet || '';

            return [
              `ID: ${detail.data.id}`,
              `Subject: ${sanitizeField(subject)}`,
              `From: ${sanitizeField(from)}`,
              `Date: ${sanitizeField(date)}`,
              `Snippet: ${sanitizeField(snippet)}`,
            ].join('\n');
          }),
        );

        const text = `Found ${messages.length} message(s):\n\n${results.join('\n\n---\n\n')}`;

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
