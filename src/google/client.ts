import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GaxiosOptions, GaxiosResponse } from 'gaxios';
import { logger } from '../logger.js';

const BLOCKED_METHODS = new Set(['DELETE']);

/** URL patterns where HTTP DELETE is explicitly permitted. */
const ALLOWED_DELETE_PATTERNS = [
  /^https:\/\/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/labels\/[^/]+$/,
  /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/[^/]+$/,
  /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/[^/]+\/events\/[^/]+$/,
];

/**
 * Install a global request interceptor that rejects HTTP DELETE calls
 * unless the URL matches an explicit allowlist.
 * Defense-in-depth: catches programming errors and blocks unintended deletions.
 */
function installDeleteGuardInterceptor(auth: OAuth2Client): void {
  const originalRequest = auth.request.bind(auth);
  auth.request = async function <T>(opts: GaxiosOptions): Promise<GaxiosResponse<T>> {
    const method = (opts.method || 'GET').toUpperCase();
    if (BLOCKED_METHODS.has(method)) {
      const url = String(opts.url || '');
      const allowed = ALLOWED_DELETE_PATTERNS.some((pattern) => pattern.test(url));
      if (!allowed) {
        logger.error('DELETE request blocked by interceptor', {
          url: opts.url,
          method,
        });
        throw new Error('HTTP DELETE requests are blocked by security policy. Use archive operations instead.');
      }
      logger.info('DELETE request allowed by interceptor', { url });
    }
    return originalRequest<T>(opts);
  };
}

export function initializeGoogleClient(auth: OAuth2Client): void {
  installDeleteGuardInterceptor(auth);
  google.options({ auth });
  logger.info('Google API client initialized with delete guard');
}

export function getGmailClient() {
  return google.gmail('v1');
}

export function getCalendarClient() {
  return google.calendar('v3');
}

export function getDriveClient() {
  return google.drive('v3');
}

export function getDocsClient() {
  return google.docs('v1');
}

export function getSheetsClient() {
  return google.sheets('v4');
}

export function getSlidesClient() {
  return google.slides('v1');
}
