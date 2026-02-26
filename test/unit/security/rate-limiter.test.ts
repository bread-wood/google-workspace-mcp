import { RateLimiter } from '../../../src/security/rate-limiter.js';
import { ToolError } from '../../../src/errors/index.js';

describe('RateLimiter', () => {
  it('allows requests within limit', () => {
    const limiter = new RateLimiter();
    // gmail_send has a limit of 10 per minute
    expect(() => {
      for (let i = 0; i < 10; i++) {
        limiter.check('gmail_send');
      }
    }).not.toThrow();
  });

  it('throws ToolError when limit exceeded for gmail_send (10/minute)', () => {
    const limiter = new RateLimiter();
    // Fill up the 10-request limit
    for (let i = 0; i < 10; i++) {
      limiter.check('gmail_send');
    }
    // The 11th call should throw
    expect(() => limiter.check('gmail_send')).toThrow(ToolError);
    expect(() => limiter.check('gmail_send')).toThrow(/rate limit exceeded/i);
  });

  it('tracks different tools independently', () => {
    const limiter = new RateLimiter();
    // Exhaust gmail_send limit (10)
    for (let i = 0; i < 10; i++) {
      limiter.check('gmail_send');
    }
    // gmail_send should be blocked
    expect(() => limiter.check('gmail_send')).toThrow(ToolError);
    // But gmail_create_draft (limit 20) should still be available
    expect(() => limiter.check('gmail_create_draft')).not.toThrow();
  });

  it('window slides — old entries expire', () => {
    vi.useFakeTimers();
    try {
      const limiter = new RateLimiter();
      // Fill up the 10-request limit for gmail_send
      for (let i = 0; i < 10; i++) {
        limiter.check('gmail_send');
      }
      // Should be blocked now
      expect(() => limiter.check('gmail_send')).toThrow(ToolError);

      // Advance time past the 60-second window
      vi.advanceTimersByTime(61_000);

      // Old entries should have expired; requests should be allowed again
      expect(() => limiter.check('gmail_send')).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('default limit applies to unknown tools', () => {
    const limiter = new RateLimiter();
    // Default limit is 60 per minute for unknown tools
    expect(() => {
      for (let i = 0; i < 60; i++) {
        limiter.check('some_unknown_tool');
      }
    }).not.toThrow();
    // The 61st request should throw
    expect(() => limiter.check('some_unknown_tool')).toThrow(ToolError);
    expect(() => limiter.check('some_unknown_tool')).toThrow(/rate limit exceeded/i);
  });
});
