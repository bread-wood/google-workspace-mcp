import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getSlidesClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerSlidesCreate: ToolRegistrar = (server, context) => {
  server.tool(
    'slides_create',
    'Create a new Google Slides presentation with an optional title. Returns the presentation ID, title, and URL.',
    {
      title: z.string().max(500).describe('Title for the new presentation (max 500 characters)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ title }) => {
      try {
        context.rateLimiter.check('slides_create');

        const slides = getSlidesClient();

        const response = await slides.presentations.create({
          requestBody: {
            title,
          },
        });

        const presentationId = response.data.presentationId!;
        const url = `https://docs.google.com/presentation/d/${presentationId}/edit`;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Presentation created successfully.\nPresentation ID: ${presentationId}\nTitle: ${title}\nURL: ${url}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
