# Google Workspace MCP Server

A private, self-hosted [Model Context Protocol](https://modelcontextprotocol.io/) server that gives Claude authenticated access to Google Calendar, Gmail, Drive, Docs, and Sheets via stdio transport.

## Features

- **23 tools** across 6 Google Workspace services
- **Secure token storage**: AES-256-GCM encryption with macOS Keychain-stored keys
- **No hard deletes**: Archive-only semantics for Docs and Sheets (moves to ARCHIVED folder)
- **Prompt injection defense**: 5-stage sanitization pipeline for all untrusted content
- **OWASP-aligned security**: Input validation, rate limiting, structured logging, PKCE OAuth2

## Prerequisites

- Node.js >= 20
- macOS (uses Keychain for key storage)
- A Google Cloud project with OAuth credentials

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., "Workspace MCP Server") and click **Create**

### 2. Enable APIs

Navigate to **APIs & Services → Library** and enable:

- Google Calendar API
- Gmail API
- Google Drive API
- Google Docs API
- Google Sheets API

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Click **Get started** (or **Edit App** if you already have one configured)
3. Set **User type** to **External** (or **Internal** if using Google Workspace)
4. Fill in the required fields:
   - **App name**: e.g., "Workspace MCP Server"
   - **User support email**: your email address
   - **Developer contact email**: your email address
5. On the **Scopes** step, click **Add or remove scopes** and add:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/spreadsheets`
6. Save and continue

### 4. Add Test Users (Required)

While the app is in "Testing" publishing status (before Google verification), only explicitly listed test users can authenticate. If you skip this step you will get a **403: access_denied** error saying the app "has not completed the Google verification process".

1. Go to **APIs & Services → OAuth consent screen**
2. Under the **Audience** section (or **Test users** tab), click **Add users**
3. Enter the Google account email you will authenticate with (e.g., `you@gmail.com`)
4. Click **Save**

You can add up to 100 test users. Only these accounts will be able to complete the OAuth flow while the app is in testing mode. You do **not** need to submit the app for Google verification — test users are sufficient for personal/self-hosted use.

### 5. Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Choose **Desktop application**
4. Name it (e.g., "MCP Server")
5. Click **Create** and note the **Client ID** and **Client Secret**

### 6. Configure the MCP Server

Set environment variables:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

Or create a config file at `~/.config/google-workspace-mcp/config.json`:

```json
{
  "clientId": "your-client-id.apps.googleusercontent.com",
  "clientSecret": "your-client-secret"
}
```

### 7. First Run

```bash
npm install
npm run build
npm start
```

On first run, the server will:
1. Open your browser for Google sign-in
2. Ask you to authorize the requested scopes
3. Store tokens securely in macOS Keychain + encrypted file
4. Start the MCP server on stdio

### 8. Claude Code Integration

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/path/to/google-workspace-mcp/dist/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

## Available Tools

### Gmail (5 tools)
- `gmail_search` — Search emails by query
- `gmail_get_message` — Get full email content by ID
- `gmail_send` — Send an email
- `gmail_create_draft` — Create a draft email
- `gmail_list_labels` — List all Gmail labels

### Calendar (4 tools)
- `calendar_list_events` — List events in a time range
- `calendar_get_event` — Get full event details
- `calendar_create_event` — Create a calendar event
- `calendar_update_event` — Update an existing event

### Drive (4 tools)
- `drive_search` — Search files in Drive
- `drive_get_file_metadata` — Get file metadata
- `drive_download` — Download/export file content
- `drive_upload` — Upload a file to Drive

### Docs (4 tools)
- `docs_get` — Get document content
- `docs_create` — Create a new document
- `docs_update` — Update document content
- `docs_archive` — Archive document (move to ARCHIVED folder)

### Sheets (5 tools)
- `sheets_get` — Get spreadsheet metadata
- `sheets_create` — Create a new spreadsheet
- `sheets_read_range` — Read cell values from a range
- `sheets_update_range` — Write cell values to a range
- `sheets_archive` — Archive spreadsheet (move to ARCHIVED folder)

### Auth (1 tool)
- `auth_status` — Check authentication status and scopes

## Security

- **No hard deletes**: The server enforces no-delete semantics at the application layer. Archive operations move files to an ARCHIVED folder in Drive.
- **Prompt injection defense**: All content from external sources (emails, documents, calendar events) passes through a 5-stage sanitization pipeline before being returned to the LLM.
- **Token security**: OAuth tokens are encrypted with AES-256-GCM. The encryption key is stored in macOS Keychain.
- **Rate limiting**: Per-tool rate limits prevent runaway API usage.
- **Input validation**: All tool inputs are validated with Zod schemas.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | (required) | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | (required) | OAuth client secret |
| `MAX_CONTENT_LENGTH` | `50000` | Max content length before truncation |
| `AUTH_TIMEOUT_MS` | `300000` | OAuth flow timeout (ms) |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
| `ARCHIVE_FOLDER_NAME` | `ARCHIVED` | Name of the archive folder in Drive |

## Development

```bash
npm install
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm test         # Run tests
npm run test:watch  # Run tests in watch mode
```
