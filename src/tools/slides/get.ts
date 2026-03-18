import { z } from 'zod';
import type { slides_v1 } from 'googleapis';
import type { ToolRegistrar } from '../types.js';
import { getSlidesClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitize, sanitizeField } from '../../sanitize/pipeline.js';

/**
 * Extract all text content from a presentation's slides.
 */
function extractText(presentation: slides_v1.Schema$Presentation): string {
  const parts: string[] = [];

  for (const slide of presentation.slides || []) {
    const slideNumber = (presentation.slides || []).indexOf(slide) + 1;
    const slideParts: string[] = [];

    for (const element of slide.pageElements || []) {
      extractElementText(element, slideParts);
    }

    if (slideParts.length > 0) {
      parts.push(`--- Slide ${slideNumber} ---`);
      parts.push(slideParts.join('\n'));
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * Recursively extract text from a page element (shape, table, group).
 */
function extractElementText(element: slides_v1.Schema$PageElement, parts: string[]): void {
  // Text from shapes (text boxes, titles, etc.)
  if (element.shape?.text) {
    for (const textElement of element.shape.text.textElements || []) {
      if (textElement.textRun?.content) {
        parts.push(textElement.textRun.content.trimEnd());
      }
    }
  }

  // Text from tables
  if (element.table) {
    for (const row of element.table.tableRows || []) {
      for (const cell of row.tableCells || []) {
        if (cell.text) {
          for (const textElement of cell.text.textElements || []) {
            if (textElement.textRun?.content) {
              parts.push(textElement.textRun.content.trimEnd());
            }
          }
        }
      }
    }
  }

  // Recurse into groups
  if (element.elementGroup) {
    for (const child of element.elementGroup.children || []) {
      extractElementText(child, parts);
    }
  }
}

export const registerSlidesGet: ToolRegistrar = (server, context) => {
  server.tool(
    'slides_get',
    'Get the full content of a Google Slides presentation by its ID. Returns the title, slide count, and extracted text from all slides.',
    {
      presentationId: z.string().describe('The Google Slides presentation ID to retrieve'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ presentationId }) => {
      try {
        context.rateLimiter.check('slides_get');

        const slides = getSlidesClient();

        const response = await slides.presentations.get({
          presentationId,
        });

        const presentation = response.data;
        const title = sanitizeField(presentation.title || '(untitled)');
        const slideCount = (presentation.slides || []).length;
        const rawText = extractText(presentation);
        const sanitizedText = rawText
          ? sanitize(rawText, { source: 'presentation' })
          : '(empty presentation)';

        const lines = [
          `Title: ${title}`,
          `Presentation ID: ${presentationId}`,
          `Slides: ${slideCount}`,
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
