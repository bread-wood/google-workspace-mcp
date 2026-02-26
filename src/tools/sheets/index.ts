import type { ToolRegistrar } from '../types.js';
import { registerSheetsGet } from './get.js';
import { registerSheetsCreate } from './create.js';
import { registerSheetsReadRange } from './read-range.js';
import { registerSheetsUpdateRange } from './update-range.js';
import { registerSheetsArchive } from './archive.js';
import { registerSheetsDelete } from './delete.js';

export const registerSheetsTools: ToolRegistrar = (server, context) => {
  registerSheetsGet(server, context);
  registerSheetsCreate(server, context);
  registerSheetsReadRange(server, context);
  registerSheetsUpdateRange(server, context);
  registerSheetsArchive(server, context);
  registerSheetsDelete(server, context);
};
