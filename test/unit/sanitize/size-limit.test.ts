import { applySizeLimit } from '../../../src/sanitize/size-limit.js';

describe('applySizeLimit', () => {
  const TRUNCATION_NOTICE = '\n\n[TRUNCATED — content exceeded maximum length]';

  it('returns input unchanged if under the limit', () => {
    const input = 'Short string';
    expect(applySizeLimit(input, 100)).toBe(input);
  });

  it('returns input unchanged if well under the limit', () => {
    const input = 'Hello world';
    expect(applySizeLimit(input, 50000)).toBe(input);
  });

  it('truncates content that exceeds the limit', () => {
    const input = 'A'.repeat(200);
    const result = applySizeLimit(input, 100);
    expect(result.length).toBe(100);
    expect(result).toContain(TRUNCATION_NOTICE);
  });

  it('truncates at exact limit with truncation notice appended', () => {
    const limit = 100;
    const input = 'X'.repeat(200);
    const result = applySizeLimit(input, limit);
    expect(result.length).toBe(limit);
    expect(result.endsWith(TRUNCATION_NOTICE)).toBe(true);
    // The content portion is the limit minus the notice length
    const contentLength = limit - TRUNCATION_NOTICE.length;
    expect(result.startsWith('X'.repeat(contentLength))).toBe(true);
  });

  it('handles empty string', () => {
    expect(applySizeLimit('', 100)).toBe('');
  });

  it('handles empty string with zero limit', () => {
    expect(applySizeLimit('', 0)).toBe('');
  });

  it('handles limit exactly at string length', () => {
    const input = 'Exactly right';
    expect(applySizeLimit(input, input.length)).toBe(input);
  });

  it('handles limit one more than string length', () => {
    const input = 'Almost full';
    expect(applySizeLimit(input, input.length + 1)).toBe(input);
  });

  it('handles limit one less than string length', () => {
    const input = 'A'.repeat(200);
    const result = applySizeLimit(input, input.length - 1);
    expect(result.length).toBe(input.length - 1);
    expect(result).toContain(TRUNCATION_NOTICE);
  });

  it('truncation notice is present in truncated output', () => {
    const input = 'B'.repeat(500);
    const result = applySizeLimit(input, 200);
    expect(result).toContain('[TRUNCATED');
    expect(result).toContain('content exceeded maximum length');
  });

  it('preserves beginning of content when truncating', () => {
    const input = 'START_MARKER' + 'X'.repeat(500) + 'END_MARKER';
    const result = applySizeLimit(input, 100);
    expect(result).toContain('START_MARKER');
    expect(result).not.toContain('END_MARKER');
  });

  it('handles large limit that exceeds input', () => {
    const input = 'Small content';
    expect(applySizeLimit(input, 1_000_000)).toBe(input);
  });

  it('handles single-character input under limit', () => {
    expect(applySizeLimit('A', 10)).toBe('A');
  });

  it('handles multibyte unicode content', () => {
    // Note: .slice() operates on code units, so this tests basic behavior
    const input = 'Hello \u00E9\u00E8\u00EA ' + 'X'.repeat(200);
    const result = applySizeLimit(input, 100);
    expect(result.length).toBe(100);
    expect(result).toContain(TRUNCATION_NOTICE);
  });
});
