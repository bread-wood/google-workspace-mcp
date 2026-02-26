import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDocsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerDocsCreate: ToolRegistrar = (server, context) => {
  server.tool(
    'docs_create',
    'Create a new Google Doc with an optional initial content. Returns the document ID, title, and URL.',
    {
      title: z.string().max(500).describe('Title for the new document (max 500 characters)'),
      content: z
        .string()
        .max(100000)
        .optional()
        .describe('Optional initial text content for the document (max 100000 characters)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ title, content }) => {
      try {
        context.rateLimiter.check('docs_create');

        const docs = getDocsClient();

        // Create the document
        const createResponse = await docs.documents.create({
          requestBody: {
            title,
          },
        });

        const documentId = createResponse.data.documentId!;

        // Insert initial content if provided
        if (content) {
          const requests = [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ];
          await docs.documents.batchUpdate({
            documentId,
            requestBody: { requests },
          });
        }

        const url = `https://docs.google.com/document/d/${documentId}/edit`;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Document created successfully.\nDocument ID: ${documentId}\nTitle: ${title}\nURL: ${url}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
