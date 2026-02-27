/**
 * Delete guard: startup assertion that no registered tools allow deletion.
 * Defense-in-depth alongside the HTTP DELETE interceptor in google/client.ts.
 */

import { logger } from '../logger.js';

const FORBIDDEN_PATTERN = /\b(delete|remove|trash|purge|destroy)\b/i;

/** Exact tool names that are allowed despite matching the forbidden pattern. */
const ALLOWED_TOOL_NAMES = new Set([
  'docs_archive',
  'docs_delete',
  'sheets_archive',
  'sheets_delete',
  'gmail_archive',
  'gmail_trash',
  'gmail_delete_label',
  'calendar_delete_event',
]);

export function assertNoDeleteTools(toolNames: string[]): void {
  const violations: string[] = [];

  for (const name of toolNames) {
    if (FORBIDDEN_PATTERN.test(name)) {
      if (!ALLOWED_TOOL_NAMES.has(name)) {
        violations.push(name);
      }
    }
  }

  if (violations.length > 0) {
    const msg = `Delete guard violation: forbidden tool names detected: ${violations.join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info('Delete guard passed: no forbidden tool names registered');
}
