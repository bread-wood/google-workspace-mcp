import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getSheetsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerSheetsUpdateRange: ToolRegistrar = (server, context) => {
  server.tool(
    'sheets_update_range',
    'Write values to a Google Sheets spreadsheet range using A1 notation. Overwrites existing cell values in the specified range.',
    {
      spreadsheetId: z.string().describe('The ID of the Google Sheets spreadsheet'),
      range: z
        .string()
        .max(200)
        .describe('The A1 notation range to write to (e.g., "Sheet1!A1:C10", max 200 characters)'),
      values: z
        .array(z.array(z.string().max(10000)))
        .max(1000)
        .describe('2D array of string values to write (rows x columns, max 1000 rows, cell max 10000 characters)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ spreadsheetId, range, values }) => {
      try {
        context.rateLimiter.check('sheets_update_range');

        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values,
          },
        });

        const updatedCells = response.data.updatedCells || 0;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Updated ${updatedCells} cell(s) in range ${range}.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
