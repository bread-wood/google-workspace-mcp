import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getSheetsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerSheetsCreate: ToolRegistrar = (server, context) => {
  server.tool(
    'sheets_create',
    'Create a new Google Sheets spreadsheet with an optional header row. Returns the new spreadsheet ID, title, and URL.',
    {
      title: z.string().max(500).describe('Title for the new spreadsheet (max 500 characters)'),
      headers: z
        .array(z.string())
        .max(50)
        .optional()
        .describe('Optional array of column header strings to write to Row 1 (max 50 items)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ title, headers }) => {
      try {
        context.rateLimiter.check('sheets_create');

        const sheets = getSheetsClient();

        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title,
            },
          },
        });

        const spreadsheet = createResponse.data;
        const spreadsheetId = spreadsheet.spreadsheetId!;
        const spreadsheetTitle = spreadsheet.properties?.title || title;
        const url = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

        if (headers && headers.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [headers],
            },
          });
        }

        const lines = [
          `Spreadsheet created successfully.`,
          `Spreadsheet ID: ${spreadsheetId}`,
          `Title: ${spreadsheetTitle}`,
          `URL: ${url}`,
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
