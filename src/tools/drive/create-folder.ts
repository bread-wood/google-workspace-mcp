import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerDriveCreateFolder: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_create_folder',
    'Create a new folder in Google Drive. Optionally specify a parent folder to nest it under.',
    {
      name: z
        .string()
        .max(500)
        .describe('Name of the folder to create'),
      parentFolderId: z
        .string()
        .optional()
        .describe('Optional parent folder ID (defaults to My Drive root)'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ name, parentFolderId }) => {
      try {
        context.rateLimiter.check('drive_create_folder');

        const drive = getDriveClient();

        const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
          name,
          mimeType: 'application/vnd.google-apps.folder',
        };

        if (parentFolderId) {
          fileMetadata.parents = [parentFolderId];
        }

        const response = await drive.files.create({
          requestBody: fileMetadata,
          fields: 'id,name,webViewLink',
        });

        const folder = response.data;

        const lines = [
          'Folder created successfully.',
          `ID: ${folder.id}`,
          `Name: ${folder.name}`,
          `Web Link: ${folder.webViewLink || 'N/A'}`,
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
