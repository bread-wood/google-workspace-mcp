import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerDriveMove: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_move',
    'Move a file or folder to a different parent folder in Google Drive.',
    {
      fileId: z
        .string()
        .describe('ID of the file or folder to move'),
      destinationFolderId: z
        .string()
        .describe('ID of the target parent folder'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ fileId, destinationFolderId }) => {
      try {
        context.rateLimiter.check('drive_move');

        const drive = getDriveClient();

        // Get current parents
        const file = await drive.files.get({ fileId, fields: 'name,parents,webViewLink' });
        const currentParents = (file.data.parents || []).join(',');

        // Move to destination folder
        await drive.files.update({
          fileId,
          addParents: destinationFolderId,
          removeParents: currentParents,
        });

        const lines = [
          'File moved successfully.',
          `Name: ${file.data.name}`,
          `Destination Folder: ${destinationFolderId}`,
          `Web Link: ${file.data.webViewLink || 'N/A'}`,
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
