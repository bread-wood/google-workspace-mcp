import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getCalendarClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerCalendarCreateEvent: ToolRegistrar = (server, context) => {
  server.tool(
    'calendar_create_event',
    'Create a new event in Google Calendar. Supports setting a summary, start/end times, description, location, and attendees.',
    {
      summary: z
        .string()
        .max(500)
        .describe('Event title/summary (max 500 characters)'),
      start: z.string().describe('Event start time in ISO 8601 format (e.g., "2025-01-15T09:00:00-05:00")'),
      end: z.string().describe('Event end time in ISO 8601 format (e.g., "2025-01-15T10:00:00-05:00")'),
      description: z
        .string()
        .max(5000)
        .optional()
        .describe('Event description (max 5000 characters)'),
      attendees: z
        .array(z.string())
        .max(20)
        .optional()
        .describe('List of attendee email addresses (max 20)'),
      location: z
        .string()
        .max(500)
        .optional()
        .describe('Event location (max 500 characters)'),
      calendarId: z
        .string()
        .default('primary')
        .describe('Calendar ID to create the event in (default: "primary")'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ summary, start, end, description, attendees, location, calendarId }) => {
      try {
        context.rateLimiter.check('calendar_create_event');

        const calendar = getCalendarClient();

        const requestBody: {
          summary: string;
          start: { dateTime: string };
          end: { dateTime: string };
          description?: string;
          location?: string;
          attendees?: Array<{ email: string }>;
        } = {
          summary,
          start: { dateTime: start },
          end: { dateTime: end },
        };

        if (description) {
          requestBody.description = description;
        }

        if (location) {
          requestBody.location = location;
        }

        if (attendees && attendees.length > 0) {
          requestBody.attendees = attendees.map((email) => ({ email }));
        }

        const response = await calendar.events.insert({
          calendarId,
          requestBody,
        });

        const event = response.data;

        const lines = [
          'Event created successfully.',
          `ID: ${event.id}`,
          `Summary: ${event.summary}`,
          `Start: ${event.start?.dateTime || event.start?.date}`,
          `End: ${event.end?.dateTime || event.end?.date}`,
          `Status: ${event.status}`,
          `HTML Link: ${event.htmlLink || '(none)'}`,
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
