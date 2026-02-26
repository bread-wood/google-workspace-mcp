/**
 * Per-tool sliding window rate limiter.
 * Prevents runaway LLM loops (e.g., mass email sending).
 */

import { ToolError } from '../errors/index.js';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // Write operations have tighter limits
  gmail_send: { maxRequests: 10, windowMs: 60_000 },
  gmail_create_draft: { maxRequests: 20, windowMs: 60_000 },
  calendar_create_event: { maxRequests: 15, windowMs: 60_000 },
  calendar_update_event: { maxRequests: 15, windowMs: 60_000 },
  drive_upload: { maxRequests: 10, windowMs: 60_000 },
  docs_create: { maxRequests: 10, windowMs: 60_000 },
  docs_update: { maxRequests: 20, windowMs: 60_000 },
  sheets_create: { maxRequests: 10, windowMs: 60_000 },
  sheets_update_range: { maxRequests: 30, windowMs: 60_000 },
  gmail_archive: { maxRequests: 20, windowMs: 60_000 },
  gmail_modify_labels: { maxRequests: 20, windowMs: 60_000 },
  gmail_trash: { maxRequests: 10, windowMs: 60_000 },
  gmail_create_label: { maxRequests: 15, windowMs: 60_000 },
  gmail_delete_label: { maxRequests: 10, windowMs: 60_000 },
  docs_delete: { maxRequests: 5, windowMs: 60_000 },
  sheets_delete: { maxRequests: 5, windowMs: 60_000 },
  // Read operations have generous limits
  _default: { maxRequests: 60, windowMs: 60_000 },
};

export class RateLimiter {
  private windows = new Map<string, number[]>();

  private getConfig(toolName: string): RateLimitConfig {
    return DEFAULT_LIMITS[toolName] || DEFAULT_LIMITS._default;
  }

  check(toolName: string): void {
    const config = this.getConfig(toolName);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create window
    let timestamps = this.windows.get(toolName);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(toolName, timestamps);
    }

    // Remove expired entries
    const filtered = timestamps.filter((t) => t > windowStart);
    this.windows.set(toolName, filtered);

    if (filtered.length >= config.maxRequests) {
      throw new ToolError(
        `Rate limit exceeded for ${toolName}. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds. Please wait before retrying.`,
      );
    }

    // Record this request
    filtered.push(now);
  }
}
