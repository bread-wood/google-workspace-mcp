import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { archiveFile } from '../archive-helper.js';
import { mapError } from '../../errors/index.js';

export const registerSheetsArchive: ToolRegistrar = (server, context) => {
  server.tool(
    'sheets_archive',
    'Archive a Google Sheets spreadsheet by moving it to a designated archive folder. This is a safe alternative to deletion.',
    {
      spreadsheetId: z.string().describe('The ID of the Google Sheets spreadsheet to archive'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ spreadsheetId }) => {
      try {
        context.rateLimiter.check('sheets_archive');

        await archiveFile(spreadsheetId, context.config);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Spreadsheet ${spreadsheetId} has been archived successfully.`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
