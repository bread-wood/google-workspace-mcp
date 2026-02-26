/**
 * HTML sanitization: strip all tags, decode entities.
 * Prevents hidden-text-in-white-on-white attacks.
 */

const HTML_TAG = /<[^>]*>/g;

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&hellip;': '…',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

const ENTITY_PATTERN = /&(?:#(\d{1,6})|#x([0-9a-fA-F]{1,6})|(\w+));/g;

function decodeEntities(input: string): string {
  return input.replace(ENTITY_PATTERN, (match, decimal, hex, named) => {
    if (decimal) {
      const code = parseInt(decimal, 10);
      return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    }
    if (hex) {
      const code = parseInt(hex, 16);
      return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    }
    if (named) {
      return HTML_ENTITIES[`&${named};`] || match;
    }
    return match;
  });
}

export function sanitizeHtml(input: string): string {
  const stripped = input.replace(HTML_TAG, '');
  return decodeEntities(stripped);
}
