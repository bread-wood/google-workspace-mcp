import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getCalendarClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerCalendarUpdateEvent: ToolRegistrar = (server, context) => {
  server.tool(
    'calendar_update_event',
    'Update an existing Google Calendar event. Only the provided fields will be modified; omitted fields remain unchanged.',
    {
      eventId: z.string().describe('The ID of the calendar event to update'),
      calendarId: z
        .string()
        .default('primary')
        .describe('Calendar ID the event belongs to (default: "primary")'),
      summary: z
        .string()
        .max(500)
        .optional()
        .describe('New event title/summary (max 500 characters)'),
      start: z
        .string()
        .optional()
        .describe('New start time in ISO 8601 format'),
      end: z
        .string()
        .optional()
        .describe('New end time in ISO 8601 format'),
      description: z
        .string()
        .max(5000)
        .optional()
        .describe('New event description (max 5000 characters)'),
      location: z
        .string()
        .max(500)
        .optional()
        .describe('New event location (max 500 characters)'),
      attendees: z
        .array(z.string())
        .max(20)
        .optional()
        .describe('New list of attendee email addresses (max 20). Replaces existing attendees.'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ eventId, calendarId, summary, start, end, description, location, attendees }) => {
      try {
        context.rateLimiter.check('calendar_update_event');

        const calendar = getCalendarClient();

        const requestBody: {
          summary?: string;
          start?: { dateTime: string };
          end?: { dateTime: string };
          description?: string;
          location?: string;
          attendees?: Array<{ email: string }>;
        } = {};

        if (summary !== undefined) {
          requestBody.summary = summary;
        }

        if (start !== undefined) {
          requestBody.start = { dateTime: start };
        }

        if (end !== undefined) {
          requestBody.end = { dateTime: end };
        }

        if (description !== undefined) {
          requestBody.description = description;
        }

        if (location !== undefined) {
          requestBody.location = location;
        }

        if (attendees !== undefined) {
          requestBody.attendees = attendees.map((email) => ({ email }));
        }

        const response = await calendar.events.patch({
          calendarId,
          eventId,
          requestBody,
        });

        const event = response.data;

        const lines = [
          'Event updated successfully.',
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
