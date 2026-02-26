import type { ToolRegistrar } from '../types.js';
import { registerDocsGet } from './get.js';
import { registerDocsCreate } from './create.js';
import { registerDocsUpdate } from './update.js';
import { registerDocsArchive } from './archive.js';

export const registerDocsTools: ToolRegistrar = (server, context) => {
  registerDocsGet(server, context);
  registerDocsCreate(server, context);
  registerDocsUpdate(server, context);
  registerDocsArchive(server, context);
};
