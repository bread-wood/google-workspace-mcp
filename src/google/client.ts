import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GaxiosOptions, GaxiosResponse } from 'gaxios';
import { logger } from '../logger.js';

const BLOCKED_METHODS = new Set(['DELETE']);

/**
 * Install a global request interceptor that rejects HTTP DELETE calls.
 * Defense-in-depth: even though no delete tools exist, this catches programming errors.
 */
function installDeleteGuardInterceptor(auth: OAuth2Client): void {
  const originalRequest = auth.request.bind(auth);
  auth.request = async function <T>(opts: GaxiosOptions): Promise<GaxiosResponse<T>> {
    const method = (opts.method || 'GET').toUpperCase();
    if (BLOCKED_METHODS.has(method)) {
      logger.error('DELETE request blocked by interceptor', {
        url: opts.url,
        method,
      });
      throw new Error('HTTP DELETE requests are blocked by security policy. Use archive operations instead.');
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
