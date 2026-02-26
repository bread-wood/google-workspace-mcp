import { z } from 'zod';
import type { docs_v1 } from 'googleapis';
import type { ToolRegistrar } from '../types.js';
import { getDocsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitize, sanitizeField } from '../../sanitize/pipeline.js';

function extractText(doc: docs_v1.Schema$Document): string {
  const parts: string[] = [];
  for (const element of doc.body?.content || []) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements || []) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
    if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          for (const cellContent of cell.content || []) {
            if (cellContent.paragraph) {
              for (const el of cellContent.paragraph.elements || []) {
                if (el.textRun?.content) {
                  parts.push(el.textRun.content);
                }
              }
            }
          }
        }
      }
    }
  }
  return parts.join('');
}

export const registerDocsGet: ToolRegistrar = (server, context) => {
  server.tool(
    'docs_get',
    'Get the full content of a Google Doc by its document ID. Returns the document title and extracted text content.',
    {
      documentId: z.string().describe('The Google Docs document ID to retrieve'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ documentId }) => {
      try {
        context.rateLimiter.check('docs_get');

        const docs = getDocsClient();

        const response = await docs.documents.get({
          documentId,
        });

        const doc = response.data;
        const title = sanitizeField(doc.title || '(untitled)');
        const rawText = extractText(doc);
        const sanitizedText = rawText
          ? sanitize(rawText, { source: 'document' })
          : '(empty document)';

        const lines = [
          `Title: ${title}`,
          `Document ID: ${documentId}`,
          '',
          sanitizedText,
        ];

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
