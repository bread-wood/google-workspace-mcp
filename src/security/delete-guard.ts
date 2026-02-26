/**
 * Delete guard: startup assertion that no registered tools allow deletion.
 * Defense-in-depth alongside the HTTP DELETE interceptor in google/client.ts.
 */

import { logger } from '../logger.js';

const FORBIDDEN_PATTERN = /\b(delete|remove|trash|purge|destroy)\b/i;
const ALLOWED_EXCEPTIONS = new Set(['archive']); // archive tools are fine

export function assertNoDeleteTools(toolNames: string[]): void {
  const violations: string[] = [];

  for (const name of toolNames) {
    if (FORBIDDEN_PATTERN.test(name)) {
      // Check if it's an allowed exception
      const isAllowed = [...ALLOWED_EXCEPTIONS].some((exception) =>
        name.toLowerCase().includes(exception),
      );
      if (!isAllowed) {
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
