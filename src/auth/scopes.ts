export const SCOPES = {
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_LABELS: 'https://www.googleapis.com/auth/gmail.labels',
  DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  DOCUMENTS: 'https://www.googleapis.com/auth/documents',
  SPREADSHEETS: 'https://www.googleapis.com/auth/spreadsheets',
} as const;

export const ALL_SCOPES = Object.values(SCOPES);
