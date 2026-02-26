import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError, ToolError } from '../../errors/index.js';
import { sanitize } from '../../sanitize/pipeline.js';

const EXPORT_MIME_MAP: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript'];

function isTextMimeType(mimeType: string): boolean {
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export const registerDriveDownload: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_download',
    'Download the content of a Google Drive file. Supports Google Docs, Sheets, Slides (exported as text), and other text-based files. Binary files are not supported.',
    {
      fileId: z.string().describe('The ID of the Google Drive file to download'),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async ({ fileId }) => {
      try {
        context.rateLimiter.check('drive_download');

        const drive = getDriveClient();

        // First get metadata to determine the file type
        const metaResponse = await drive.files.get({
          fileId,
          fields: 'id,name,mimeType',
        });

        const mimeType = metaResponse.data.mimeType || '';
        const fileName = metaResponse.data.name || '(untitled)';

        let content: string;

        // Handle Google native formats via export
        const exportMime = EXPORT_MIME_MAP[mimeType];
        if (exportMime) {
          const exportResponse = await drive.files.export({
            fileId,
            mimeType: exportMime,
          });
          content = typeof exportResponse.data === 'string'
            ? exportResponse.data
            : String(exportResponse.data);
        } else if (isTextMimeType(mimeType)) {
          // Handle regular text-based files
          const downloadResponse = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'text' },
          );
          content = typeof downloadResponse.data === 'string'
            ? downloadResponse.data
            : String(downloadResponse.data);
        } else {
          throw new ToolError(
            `Cannot download binary file "${fileName}" (${mimeType}). Only text-based files and Google Docs/Sheets/Slides are supported.`,
          );
        }

        const sanitizedContent = sanitize(content, { source: 'drive_file' });

        return {
          content: [{ type: 'text' as const, text: sanitizedContent }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
