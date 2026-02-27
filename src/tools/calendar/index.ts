import type { ToolRegistrar } from '../types.js';
import { registerCalendarListEvents } from './list-events.js';
import { registerCalendarGetEvent } from './get-event.js';
import { registerCalendarCreateEvent } from './create-event.js';
import { registerCalendarUpdateEvent } from './update-event.js';
import { registerCalendarDeleteEvent } from './delete-event.js';

export const registerCalendarTools: ToolRegistrar = (server, context) => {
  registerCalendarListEvents(server, context);
  registerCalendarGetEvent(server, context);
  registerCalendarCreateEvent(server, context);
  registerCalendarUpdateEvent(server, context);
  registerCalendarDeleteEvent(server, context);
};
