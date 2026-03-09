import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getCalendarClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerCalendarCreateCalendar: ToolRegistrar = (server, context) => {
  server.tool(
    'calendar_create_calendar',
    'Create a new Google Calendar. Returns the calendar ID needed to add events to it.',
    {
      summary: z.string().max(255).describe('Calendar name'),
      description: z
        .string()
        .max(1000)
        .optional()
        .describe('Calendar description'),
      timeZone: z
        .string()
        .optional()
        .describe('IANA time zone (e.g., "America/New_York"). Defaults to the account time zone.'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ summary, description, timeZone }) => {
      try {
        context.rateLimiter.check('calendar_create_calendar');

        const calendar = getCalendarClient();

        const requestBody: {
          summary: string;
          description?: string;
          timeZone?: string;
        } = { summary };

        if (description) requestBody.description = description;
        if (timeZone) requestBody.timeZone = timeZone;

        const response = await calendar.calendars.insert({ requestBody });
        const cal = response.data;

        const lines = [
          'Calendar created successfully.',
          `ID: ${cal.id}`,
          `Summary: ${cal.summary}`,
          ...(cal.description ? [`Description: ${cal.description}`] : []),
          ...(cal.timeZone ? [`Time Zone: ${cal.timeZone}`] : []),
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
