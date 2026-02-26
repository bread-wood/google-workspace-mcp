import { sanitizeUnicode } from '../../../src/sanitize/unicode.js';

describe('sanitizeUnicode', () => {
  it('preserves normal ASCII text', () => {
    const input = 'Hello, world! This is a normal string.';
    expect(sanitizeUnicode(input)).toBe(input);
  });

  it('preserves common Unicode text (accented letters, CJK, emoji)', () => {
    const input = 'Cafe\u0301 \u00FC\u00F1o \u4F60\u597D \uD83D\uDE00';
    const result = sanitizeUnicode(input);
    // Should still contain the meaningful characters
    expect(result).toContain('\u00F1');
    expect(result).toContain('\u4F60\u597D');
  });

  it('NFC normalizes combining character sequences', () => {
    // e + combining acute accent (U+0301) should become e-acute (U+00E9)
    const decomposed = 'Caf\u0065\u0301';
    const result = sanitizeUnicode(decomposed);
    expect(result).toBe('Caf\u00E9');
    expect(result).toBe('Caf\u00E9'.normalize('NFC'));
  });

  it('NFC normalizes multiple combining characters', () => {
    // a + combining ring above (U+030A) should become a-ring (U+00E5)
    const decomposed = '\u0061\u030A';
    const result = sanitizeUnicode(decomposed);
    expect(result).toBe('\u00E5');
  });

  it('strips zero-width space (U+200B)', () => {
    const input = 'Hello\u200BWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips zero-width non-joiner (U+200C)', () => {
    const input = 'Hello\u200CWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips zero-width joiner (U+200D)', () => {
    const input = 'Hello\u200DWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips byte order mark (U+FEFF)', () => {
    const input = '\uFEFFHello World';
    expect(sanitizeUnicode(input)).toBe('Hello World');
  });

  it('strips all zero-width chars in a single pass', () => {
    const input = '\u200BHe\u200Cll\u200Do\uFEFF!';
    expect(sanitizeUnicode(input)).toBe('Hello!');
  });

  it('strips bidi left-to-right embedding (U+202A)', () => {
    const input = 'Hello\u202AWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips bidi right-to-left override (U+202E)', () => {
    const input = 'Hello\u202EWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips bidi isolates (U+2066-U+2069)', () => {
    const input = 'A\u2066B\u2067C\u2068D\u2069E';
    expect(sanitizeUnicode(input)).toBe('ABCDE');
  });

  it('strips all bidi override characters (U+202A-U+202E)', () => {
    const input = '\u202A\u202B\u202C\u202D\u202EText';
    expect(sanitizeUnicode(input)).toBe('Text');
  });

  it('strips tag characters (U+E0001-U+E007F)', () => {
    // Language tag sequence: U+E0001 (LANGUAGE TAG) + some tag chars
    const input = 'Hello\u{E0001}\u{E0065}\u{E006E}\u{E007F}World';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips multiple tag characters spread through text', () => {
    const input = 'A\u{E0020}B\u{E0041}C\u{E007F}D';
    expect(sanitizeUnicode(input)).toBe('ABCD');
  });

  it('strips control characters (NUL, BEL, BS, etc.)', () => {
    const input = 'Hello\x00\x01\x02\x03\x04\x05\x06\x07\x08World';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips vertical tab (U+000B) and form feed (U+000C)', () => {
    const input = 'Hello\x0B\x0CWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('strips shift-out (U+000E) through unit separator (U+001F)', () => {
    let input = 'Start';
    for (let i = 0x0E; i <= 0x1F; i++) {
      input += String.fromCharCode(i);
    }
    input += 'End';
    expect(sanitizeUnicode(input)).toBe('StartEnd');
  });

  it('strips DEL character (U+007F)', () => {
    const input = 'Hello\x7FWorld';
    expect(sanitizeUnicode(input)).toBe('HelloWorld');
  });

  it('preserves newline (U+000A)', () => {
    const input = 'Line 1\nLine 2';
    expect(sanitizeUnicode(input)).toBe('Line 1\nLine 2');
  });

  it('preserves carriage return (U+000D)', () => {
    const input = 'Line 1\rLine 2';
    expect(sanitizeUnicode(input)).toBe('Line 1\rLine 2');
  });

  it('preserves tab (U+0009)', () => {
    const input = 'Column1\tColumn2';
    expect(sanitizeUnicode(input)).toBe('Column1\tColumn2');
  });

  it('preserves CRLF line endings', () => {
    const input = 'Line 1\r\nLine 2\r\nLine 3';
    expect(sanitizeUnicode(input)).toBe('Line 1\r\nLine 2\r\nLine 3');
  });

  it('handles empty string', () => {
    expect(sanitizeUnicode('')).toBe('');
  });

  it('handles string made entirely of stripped characters', () => {
    const input = '\u200B\u200C\u200D\uFEFF\u202A\u202E\x00\x01\x7F';
    expect(sanitizeUnicode(input)).toBe('');
  });

  it('handles a combined attack: bidi + zero-width + control chars', () => {
    const input = '\u202EIgnore\u200B\x00 this\uFEFF\u2066 text\u{E0001}';
    const result = sanitizeUnicode(input);
    expect(result).toBe('Ignore this text');
  });
});
