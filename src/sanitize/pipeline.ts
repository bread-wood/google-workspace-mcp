/**
 * Composable sanitization pipeline.
 * All stages applied in order: unicode → html → injection → size-limit → envelope
 */

import { sanitizeUnicode } from './unicode.js';
import { sanitizeHtml } from './html.js';
import { sanitizeInjection } from './injection.js';
import { applySizeLimit } from './size-limit.js';
import { wrapInEnvelope, type ContentSource } from './envelope.js';

export interface SanitizeOptions {
  source: ContentSource;
  maxLength?: number;
  skipEnvelope?: boolean;
}

const DEFAULT_MAX_LENGTH = 50_000;

/**
 * Run the full sanitization pipeline on untrusted content.
 */
export function sanitize(input: string, options: SanitizeOptions): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  let result = input;

  // Stage 1: Unicode normalization and dangerous char removal
  result = sanitizeUnicode(result);

  // Stage 2: HTML tag stripping and entity decoding
  result = sanitizeHtml(result);

  // Stage 3: Prompt injection neutralization
  result = sanitizeInjection(result);

  // Stage 4: Size limiting
  result = applySizeLimit(result, maxLength);

  // Stage 5: Untrusted content envelope
  if (!options.skipEnvelope) {
    result = wrapInEnvelope(result, options.source);
  }

  return result;
}

/**
 * Sanitize a single field (no envelope wrapping).
 * Used for individual metadata fields like subject, sender, etc.
 */
export function sanitizeField(input: string): string {
  let result = sanitizeUnicode(input);
  result = sanitizeHtml(result);
  result = sanitizeInjection(result);
  return applySizeLimit(result, 1000); // fields are short
}
