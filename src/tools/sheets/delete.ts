import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerSheetsDelete: ToolRegistrar = (server, context) => {
  server.tool(
    'sheets_delete',
    'Permanently delete a Google Sheets spreadsheet. This is irreversible — the spreadsheet cannot be recovered. Consider using sheets_archive for a safer alternative.',
    {
      spreadsheetId: z.string().describe('The Google Sheets spreadsheet ID to permanently delete'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    async ({ spreadsheetId }) => {
      try {
        context.rateLimiter.check('sheets_delete');

        const drive = getDriveClient();

        await drive.files.delete({
          fileId: spreadsheetId,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Spreadsheet ${spreadsheetId} permanently deleted.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
