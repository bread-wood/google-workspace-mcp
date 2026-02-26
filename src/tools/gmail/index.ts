import type { ToolRegistrar } from '../types.js';
import { registerGmailSearch } from './search.js';
import { registerGmailGetMessage } from './get-message.js';
import { registerGmailSend } from './send.js';
import { registerGmailCreateDraft } from './create-draft.js';
import { registerGmailListLabels } from './list-labels.js';

export const registerGmailTools: ToolRegistrar = (server, context) => {
  registerGmailSearch(server, context);
  registerGmailGetMessage(server, context);
  registerGmailSend(server, context);
  registerGmailCreateDraft(server, context);
  registerGmailListLabels(server, context);
};
