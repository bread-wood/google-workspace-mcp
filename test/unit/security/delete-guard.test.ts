import { assertNoDeleteTools } from '../../../src/security/delete-guard.js';

describe('assertNoDeleteTools', () => {
  it('passes with normal tool names', () => {
    expect(() =>
      assertNoDeleteTools(['gmail_search', 'docs_get', 'calendar_list_events']),
    ).not.toThrow();
  });

  it('passes with archive tool names', () => {
    expect(() =>
      assertNoDeleteTools(['docs_archive', 'sheets_archive', 'gmail_archive']),
    ).not.toThrow();
  });

  it('passes with whitelisted gmail_trash', () => {
    expect(() =>
      assertNoDeleteTools(['gmail_trash']),
    ).not.toThrow();
  });

  it('passes with whitelisted gmail_delete_label', () => {
    expect(() =>
      assertNoDeleteTools(['gmail_delete_label']),
    ).not.toThrow();
  });

  it('passes with whitelisted docs_delete', () => {
    expect(() =>
      assertNoDeleteTools(['docs_delete']),
    ).not.toThrow();
  });

  it('passes with whitelisted sheets_delete', () => {
    expect(() =>
      assertNoDeleteTools(['sheets_delete']),
    ).not.toThrow();
  });

  it('throws on tool names containing "delete"', () => {
    // \b word boundary: underscore is a word char, so use hyphen/dot/standalone
    expect(() =>
      assertNoDeleteTools(['gmail-delete-message']),
    ).toThrow(/delete guard violation/i);
  });

  it('throws on tool names containing "remove"', () => {
    expect(() =>
      assertNoDeleteTools(['drive-remove-file']),
    ).toThrow(/delete guard violation/i);
  });

  it('throws on tool names containing "trash"', () => {
    expect(() =>
      assertNoDeleteTools(['trash']),
    ).toThrow(/delete guard violation/i);
  });

  it('throws on tool names containing "purge"', () => {
    expect(() =>
      assertNoDeleteTools(['purge']),
    ).toThrow(/delete guard violation/i);
  });

  it('throws on tool names containing "destroy"', () => {
    expect(() =>
      assertNoDeleteTools(['destroy']),
    ).toThrow(/delete guard violation/i);
  });

  it('is case insensitive: throws on "DELETE"', () => {
    expect(() =>
      assertNoDeleteTools(['DELETE']),
    ).toThrow(/delete guard violation/i);
  });

  it('passes with empty array', () => {
    expect(() => assertNoDeleteTools([])).not.toThrow();
  });
});
