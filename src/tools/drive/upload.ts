import { z } from 'zod';
import { Readable } from 'stream';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerDriveUpload: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_upload',
    'Upload a new file to Google Drive with the given name and text content. Optionally specify a MIME type and target folder.',
    {
      name: z
        .string()
        .max(500)
        .describe('Name of the file to create'),
      content: z
        .string()
        .max(100_000)
        .describe('Text content of the file (max 100,000 characters)'),
      mimeType: z
        .string()
        .default('text/plain')
        .describe('MIME type of the file (default: text/plain)'),
      folderId: z
        .string()
        .optional()
        .describe('Optional Google Drive folder ID to upload into'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ name, content, mimeType, folderId }) => {
      try {
        context.rateLimiter.check('drive_upload');

        const drive = getDriveClient();

        const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
          name,
          mimeType,
        };

        if (folderId) {
          fileMetadata.parents = [folderId];
        }

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType,
            body: Readable.from(content),
          },
          fields: 'id,name,webViewLink',
        });

        const file = response.data;

        const lines = [
          'File uploaded successfully.',
          `ID: ${file.id}`,
          `Name: ${file.name}`,
          `Web Link: ${file.webViewLink || 'N/A'}`,
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
