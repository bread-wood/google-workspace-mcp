import { z } from 'zod';
import type { slides_v1 } from 'googleapis';
import type { ToolRegistrar } from '../types.js';
import { getSlidesClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

const LAYOUT_OPTIONS = [
  'BLANK',
  'CAPTION_ONLY',
  'TITLE',
  'TITLE_AND_BODY',
  'TITLE_AND_TWO_COLUMNS',
  'TITLE_ONLY',
  'SECTION_HEADER',
  'SECTION_TITLE_AND_DESCRIPTION',
  'ONE_COLUMN_TEXT',
  'MAIN_POINT',
  'BIG_NUMBER',
] as const;

export const registerSlidesAddSlide: ToolRegistrar = (server, context) => {
  server.tool(
    'slides_add_slide',
    'Add a new slide to an existing Google Slides presentation. Optionally specify a predefined layout and text to insert into placeholders.',
    {
      presentationId: z.string().describe('The presentation ID to add a slide to'),
      layout: z
        .enum(LAYOUT_OPTIONS)
        .default('BLANK')
        .describe('Predefined layout for the new slide (default: BLANK)'),
      insertionIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Zero-based position to insert the slide. Omit to append at the end.'),
      title: z
        .string()
        .max(500)
        .optional()
        .describe('Text to insert into the title placeholder (if the layout has one)'),
      body: z
        .string()
        .max(50000)
        .optional()
        .describe('Text to insert into the body placeholder (if the layout has one)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ presentationId, layout, insertionIndex, title, body }) => {
      try {
        context.rateLimiter.check('slides_add_slide');

        const slides = getSlidesClient();

        // Generate a deterministic object ID for the new slide
        const slideObjectId = `slide_${Date.now()}`;

        const createRequest: slides_v1.Schema$Request = {
          createSlide: {
            objectId: slideObjectId,
            insertionIndex,
            slideLayoutReference: {
              predefinedLayout: layout,
            },
          },
        };

        const requests: slides_v1.Schema$Request[] = [createRequest];

        // Create the slide first
        const batchResponse = await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });

        // If title or body text provided, find placeholders and insert text
        if (title || body) {
          const textRequests: slides_v1.Schema$Request[] = [];

          // Fetch the newly created slide to find placeholder IDs
          const presentation = await slides.presentations.get({
            presentationId,
          });
          const newSlide = presentation.data.slides?.find(
            (s) => s.objectId === slideObjectId,
          );

          if (newSlide) {
            for (const element of newSlide.pageElements || []) {
              const placeholder = element.shape?.placeholder;
              if (!placeholder) continue;

              if (placeholder.type === 'TITLE' || placeholder.type === 'CENTERED_TITLE') {
                if (title && element.objectId) {
                  textRequests.push({
                    insertText: {
                      objectId: element.objectId,
                      text: title,
                      insertionIndex: 0,
                    },
                  });
                }
              } else if (placeholder.type === 'BODY' || placeholder.type === 'SUBTITLE') {
                if (body && element.objectId) {
                  textRequests.push({
                    insertText: {
                      objectId: element.objectId,
                      text: body,
                      insertionIndex: 0,
                    },
                  });
                }
              }
            }

            if (textRequests.length > 0) {
              await slides.presentations.batchUpdate({
                presentationId,
                requestBody: { requests: textRequests },
              });
            }
          }
        }

        const slideIndex =
          batchResponse.data.replies?.[0]?.createSlide?.objectId || slideObjectId;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Slide added successfully.\nPresentation ID: ${presentationId}\nSlide ID: ${slideIndex}\nLayout: ${layout}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
