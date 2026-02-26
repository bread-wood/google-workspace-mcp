import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getCalendarClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitize, sanitizeField } from '../../sanitize/pipeline.js';

export const registerCalendarGetEvent: ToolRegistrar = (server, context) => {
  server.tool(
    'calendar_get_event',
    'Get full details of a specific Google Calendar event by its ID. Returns summary, description, location, times, attendees, and other metadata.',
    {
      eventId: z.string().describe('The ID of the calendar event to retrieve'),
      calendarId: z
        .string()
        .default('primary')
        .describe('Calendar ID the event belongs to (default: "primary")'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ eventId, calendarId }) => {
      try {
        context.rateLimiter.check('calendar_get_event');

        const calendar = getCalendarClient();

        const response = await calendar.events.get({
          calendarId,
          eventId,
        });

        const event = response.data;

        const start = event.start?.dateTime || event.start?.date || '(unknown)';
        const end = event.end?.dateTime || event.end?.date || '(unknown)';

        const attendeeList = (event.attendees || []).map((a) => {
          const name = a.displayName ? sanitizeField(a.displayName) : '';
          const email = a.email ? sanitizeField(a.email) : '(no email)';
          const status = a.responseStatus || 'unknown';
          return name ? `  - ${name} <${email}> (${status})` : `  - ${email} (${status})`;
        });

        const lines = [
          `ID: ${event.id}`,
          `Summary: ${sanitizeField(event.summary || '(no title)')}`,
          `Status: ${event.status || '(unknown)'}`,
          `Start: ${start}`,
          `End: ${end}`,
          `Location: ${sanitizeField(event.location || '(none)')}`,
          `Description: ${sanitizeField(event.description || '(none)')}`,
          `Organizer: ${event.organizer?.email || '(unknown)'}`,
          `Created: ${event.created || '(unknown)'}`,
          `Updated: ${event.updated || '(unknown)'}`,
          `HTML Link: ${event.htmlLink || '(none)'}`,
        ];

        if (attendeeList.length > 0) {
          lines.push(`Attendees (${attendeeList.length}):`);
          lines.push(...attendeeList);
        } else {
          lines.push('Attendees: (none)');
        }

        const rawText = lines.join('\n');
        const text = sanitize(rawText, { source: 'calendar_event' });

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
