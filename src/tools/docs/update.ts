import { z } from 'zod';
import type { docs_v1 } from 'googleapis';
import type { ToolRegistrar } from '../types.js';
import { getDocsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerDocsUpdate: ToolRegistrar = (server, context) => {
  server.tool(
    'docs_update',
    'Update the content of an existing Google Doc. Supports appending text to the end or replacing all content.',
    {
      documentId: z.string().describe('The Google Docs document ID to update'),
      content: z.string().max(100000).describe('The text content to insert (max 100000 characters)'),
      mode: z
        .enum(['append', 'replace'])
        .default('append')
        .describe('Update mode: "append" adds to end, "replace" replaces all content (default: "append")'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ documentId, content, mode }) => {
      try {
        context.rateLimiter.check('docs_update');

        const docs = getDocsClient();

        // Get current document to determine end index
        const docResponse = await docs.documents.get({ documentId });
        const doc = docResponse.data;
        const endIndex =
          doc.body?.content?.[doc.body.content.length - 1]?.endIndex || 1;

        const requests: docs_v1.Schema$Request[] = [];

        if (mode === 'replace') {
          // Delete existing content (if any) before inserting
          if (endIndex > 2) {
            requests.push({
              deleteContentRange: {
                range: {
                  startIndex: 1,
                  endIndex: endIndex - 1,
                },
              },
            });
          }
          // Insert new content at the beginning
          requests.push({
            insertText: {
              location: { index: 1 },
              text: content,
            },
          });
        } else {
          // Append mode: insert at end of document
          requests.push({
            insertText: {
              location: { index: endIndex - 1 },
              text: content,
            },
          });
        }

        await docs.documents.batchUpdate({
          documentId,
          requestBody: { requests },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Document updated successfully.\nDocument ID: ${documentId}\nMode: ${mode}\nContent length: ${content.length} characters`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
