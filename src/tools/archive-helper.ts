import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDriveClient } from '../google/client.js';
import type { Config } from '../config.js';

/**
 * Get or create the shared archive folder in Google Drive.
 * Caches the folder ID locally to avoid repeated API calls.
 */
export async function getOrCreateArchiveFolder(config: Config): Promise<string> {
  const cacheFile = join(config.configDir, 'archive-folder-id');

  // Check cache
  if (existsSync(cacheFile)) {
    const cached = readFileSync(cacheFile, 'utf-8').trim();
    if (cached) {
      // Verify it still exists
      try {
        await getDriveClient().files.get({ fileId: cached, fields: 'id' });
        return cached;
      } catch {
        // Folder deleted, recreate
      }
    }
  }

  // Search for existing folder
  const drive = getDriveClient();
  const search = await drive.files.list({
    q: `name='${config.archiveFolderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: 'files(id)',
  });

  if (search.data.files?.length) {
    const folderId = search.data.files[0].id!;
    writeFileSync(cacheFile, folderId, { mode: 0o600 });
    return folderId;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: config.archiveFolderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  const folderId = folder.data.id!;
  writeFileSync(cacheFile, folderId, { mode: 0o600 });
  return folderId;
}

/**
 * Move a file to the archive folder in Google Drive (soft delete).
 * Returns the name of the archived file.
 */
export async function archiveFile(fileId: string, config: Config): Promise<string> {
  const drive = getDriveClient();
  const archiveFolderId = await getOrCreateArchiveFolder(config);

  // Get current parents
  const file = await drive.files.get({ fileId, fields: 'name,parents' });
  const currentParents = (file.data.parents || []).join(',');

  // Move to archive folder
  await drive.files.update({
    fileId,
    addParents: archiveFolderId,
    removeParents: currentParents,
  });

  return file.data.name || fileId;
}
