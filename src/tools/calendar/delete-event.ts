import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getCalendarClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerCalendarDeleteEvent: ToolRegistrar = (server, context) => {
  server.tool(
    'calendar_delete_event',
    'Delete a Google Calendar event by ID.',
    {
      eventId: z.string().describe('The ID of the calendar event to delete'),
      calendarId: z
        .string()
        .default('primary')
        .describe('Calendar ID (default: "primary")'),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async ({ eventId, calendarId }) => {
      try {
        context.rateLimiter.check('calendar_delete_event');
        const calendar = getCalendarClient();
        await calendar.events.delete({ calendarId, eventId });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Event ${eventId} deleted from calendar ${calendarId}.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    }
  );
};
