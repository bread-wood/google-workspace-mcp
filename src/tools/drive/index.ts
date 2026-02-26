import type { ToolRegistrar } from '../types.js';
import { registerDriveSearch } from './search.js';
import { registerDriveGetMetadata } from './get-metadata.js';
import { registerDriveDownload } from './download.js';
import { registerDriveUpload } from './upload.js';
import { registerDriveCreateFolder } from './create-folder.js';

export const registerDriveTools: ToolRegistrar = (server, context) => {
  registerDriveSearch(server, context);
  registerDriveGetMetadata(server, context);
  registerDriveDownload(server, context);
  registerDriveUpload(server, context);
  registerDriveCreateFolder(server, context);
};
