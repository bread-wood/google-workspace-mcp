/**
 * Content size limiting with truncation notice.
 */

const TRUNCATION_NOTICE = '\n\n[TRUNCATED — content exceeded maximum length]';

export function applySizeLimit(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - TRUNCATION_NOTICE.length) + TRUNCATION_NOTICE;
}
