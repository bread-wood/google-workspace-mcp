import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getSheetsClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerSheetsGet: ToolRegistrar = (server, context) => {
  server.tool(
    'sheets_get',
    'Get metadata for a Google Sheets spreadsheet by its ID. Returns the spreadsheet title and list of sheet names.',
    {
      spreadsheetId: z.string().describe('The ID of the Google Sheets spreadsheet'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ spreadsheetId }) => {
      try {
        context.rateLimiter.check('sheets_get');

        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'spreadsheetId,properties.title,sheets.properties',
        });

        const spreadsheet = response.data;
        const title = spreadsheet.properties?.title || '(untitled)';
        const sheetNames = (spreadsheet.sheets || [])
          .map((s) => s.properties?.title || '(unnamed sheet)')
          .join(', ');

        const lines = [
          `Spreadsheet ID: ${spreadsheet.spreadsheetId}`,
          `Title: ${title}`,
          `Sheets: ${sheetNames}`,
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
