import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getCalendarClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitizeField } from '../../sanitize/pipeline.js';

export const registerCalendarListEvents: ToolRegistrar = (server, context) => {
  server.tool(
    'calendar_list_events',
    'List upcoming events from a Google Calendar within a time range. Returns event summaries with IDs, titles, times, and status.',
    {
      timeMin: z.string().describe('Start of time range in ISO 8601 format (e.g., "2025-01-01T00:00:00Z")'),
      timeMax: z.string().describe('End of time range in ISO 8601 format (e.g., "2025-01-31T23:59:59Z")'),
      maxResults: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe('Maximum number of events to return (1-50, default 10)'),
      calendarId: z
        .string()
        .default('primary')
        .describe('Calendar ID to list events from (default: "primary")'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ timeMin, timeMax, maxResults, calendarId }) => {
      try {
        context.rateLimiter.check('calendar_list_events');

        const calendar = getCalendarClient();

        const response = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items || [];

        if (events.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No events found in the specified time range.' }],
          };
        }

        const results = events.map((event) => {
          const start = event.start?.dateTime || event.start?.date || '(unknown)';
          const end = event.end?.dateTime || event.end?.date || '(unknown)';

          return [
            `ID: ${event.id}`,
            `Summary: ${sanitizeField(event.summary || '(no title)')}`,
            `Start: ${start}`,
            `End: ${end}`,
            `Status: ${event.status || '(unknown)'}`,
          ].join('\n');
        });

        const text = `Found ${events.length} event(s):\n\n${results.join('\n\n---\n\n')}`;

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
