/**
 * Unicode sanitization: NFC normalize, strip dangerous invisible characters.
 */

// Zero-width and invisible formatting characters
const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

// Bidi override characters (can reorder displayed text)
const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;

// Tag characters (U+E0001-U+E007F) — used in invisible text attacks
const TAG_CHARS = /[\u{E0001}-\u{E007F}]/gu;

// Control characters except newline, carriage return, tab
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeUnicode(input: string): string {
  return input
    .normalize('NFC')
    .replace(ZERO_WIDTH_CHARS, '')
    .replace(BIDI_OVERRIDES, '')
    .replace(TAG_CHARS, '')
    .replace(CONTROL_CHARS, '');
}
