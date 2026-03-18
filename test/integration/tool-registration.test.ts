import { createServer } from '../../src/server.js';
import type { OAuth2Client } from 'google-auth-library';
import type { Config } from '../../src/config.js';

const EXPECTED_TOOLS: string[] = [
  'auth_status',
  'gmail_search',
  'gmail_get_message',
  'gmail_send',
  'gmail_create_draft',
  'gmail_list_labels',
  'gmail_archive',
  'gmail_modify_labels',
  'gmail_trash',
  'gmail_create_label',
  'gmail_delete_label',
  'gmail_list_filters',
  'gmail_create_filter',
  'gmail_delete_filter',
  'calendar_list_events',
  'calendar_get_event',
  'calendar_create_event',
  'calendar_update_event',
  'calendar_delete_event',
  'calendar_create_calendar',
  'drive_search',
  'drive_get_file_metadata',
  'drive_download',
  'drive_upload',
  'drive_create_folder',
  'drive_move',
  'drive_create_pdf',
  'docs_get',
  'docs_create',
  'docs_update',
  'docs_archive',
  'docs_delete',
  'sheets_get',
  'sheets_create',
  'sheets_read_range',
  'sheets_update_range',
  'sheets_archive',
  'sheets_delete',
  'slides_get',
  'slides_create',
  'slides_add_slide',
  'slides_archive',
  'slides_delete',
];

const FORBIDDEN_PATTERN = /\b(delete|remove|trash|purge|destroy)\b/i;

describe('tool registration', () => {
  const mockAuth = {
    credentials: { access_token: 'test' },
  } as unknown as OAuth2Client;

  const mockConfig: Config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    maxContentLength: 50_000,
    authTimeoutMs: 300_000,
    logLevel: 'info',
    archiveFolderName: 'ARCHIVED',
    configDir: '/tmp/test-config',
  };

  it('creates a server and registers all 43 tools', () => {
    const server = createServer(mockConfig, mockAuth);
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, unknown> }
    )._registeredTools;

    const toolNames = Object.keys(registeredTools);
    expect(toolNames).toHaveLength(43);

    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }
  });

  it('no tool names match delete/remove/trash/purge/destroy pattern', () => {
    const server = createServer(mockConfig, mockAuth);
    const registeredTools = (
      server as unknown as { _registeredTools: Record<string, unknown> }
    )._registeredTools;

    const toolNames = Object.keys(registeredTools);
    const ALLOWED_TOOL_NAMES = new Set([
      'docs_archive', 'docs_delete', 'sheets_archive', 'sheets_delete',
      'slides_archive', 'slides_delete',
      'gmail_archive', 'gmail_trash', 'gmail_delete_label', 'gmail_delete_filter', 'calendar_delete_event',
    ]);
    const violations = toolNames.filter(
      (name) => FORBIDDEN_PATTERN.test(name) && !ALLOWED_TOOL_NAMES.has(name),
    );
    expect(violations).toEqual([]);
  });
});
