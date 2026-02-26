import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getSheetsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitizeField } from '../../sanitize/pipeline.js';

function formatTable(values: string[][]): string {
  if (!values.length) return '(empty range)';
  return values.map((row) => row.join('\t')).join('\n');
}

export const registerSheetsReadRange: ToolRegistrar = (server, context) => {
  server.tool(
    'sheets_read_range',
    'Read cell values from a Google Sheets spreadsheet range using A1 notation (e.g., "Sheet1!A1:C10"). Returns the values as tab-separated text.',
    {
      spreadsheetId: z.string().describe('The ID of the Google Sheets spreadsheet'),
      range: z
        .string()
        .max(200)
        .describe('The A1 notation range to read (e.g., "Sheet1!A1:C10", max 200 characters)'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ spreadsheetId, range }) => {
      try {
        context.rateLimiter.check('sheets_read_range');

        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const rawValues = response.data.values || [];

        const sanitizedValues = rawValues.map((row) =>
          row.map((cell) => sanitizeField(String(cell))),
        );

        const text = formatTable(sanitizedValues);

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
