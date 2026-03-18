import type { ToolRegistrar } from '../types.js';
import { registerSlidesGet } from './get.js';
import { registerSlidesCreate } from './create.js';
import { registerSlidesAddSlide } from './add-slide.js';
import { registerSlidesArchive } from './archive.js';
import { registerSlidesDelete } from './delete.js';

export const registerSlidesTools: ToolRegistrar = (server, context) => {
  registerSlidesGet(server, context);
  registerSlidesCreate(server, context);
  registerSlidesAddSlide(server, context);
  registerSlidesArchive(server, context);
  registerSlidesDelete(server, context);
};
