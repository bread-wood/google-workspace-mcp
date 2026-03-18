export const SCOPES = {
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  GMAIL_MODIFY: 'https://www.googleapis.com/auth/gmail.modify',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_LABELS: 'https://www.googleapis.com/auth/gmail.labels',
  GMAIL_SETTINGS: 'https://www.googleapis.com/auth/gmail.settings.basic',
  DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  DOCUMENTS: 'https://www.googleapis.com/auth/documents',
  SPREADSHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  PRESENTATIONS: 'https://www.googleapis.com/auth/presentations',
} as const;

export const ALL_SCOPES = Object.values(SCOPES);
