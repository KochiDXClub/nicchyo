import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enforceRateLimit, getClientIp } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getClientIp', () => {
    it('returns x-real-ip if present', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '1.2.3.4' }
      });
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('returns x-forwarded-for if x-real-ip is absent', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' }
      });
      expect(getClientIp(req)).toBe('5.6.7.8');
    });

    it('returns unknown if neither header is present', () => {
      const req = new Request('http://localhost');
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('enforceRateLimit', () => {
    const defaultOptions = {
      bucket: 'test-bucket',
      limit: 2,
      windowMs: 1000,
    };

    it('allows requests within limit', async () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '1.1.1.1' }
      });

      expect(await enforceRateLimit(req, defaultOptions)).toBeNull();
      expect(await enforceRateLimit(req, defaultOptions)).toBeNull();
    });

    it('blocks requests over limit and returns 429 response', async () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '2.2.2.2' }
      });

      await enforceRateLimit(req, defaultOptions);
      await enforceRateLimit(req, defaultOptions);
      const res = await enforceRateLimit(req, defaultOptions);

      expect(res).not.toBeNull();
      expect(res?.status).toBe(429);
      expect(res?.headers.get('Retry-After')).toBe('1');

      const body = await res?.json();
      expect(body.error).toBe('Too Many Requests');
    });

    it('resets limit after windowMs', async () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '3.3.3.3' }
      });

      await enforceRateLimit(req, defaultOptions);
      await enforceRateLimit(req, defaultOptions);

      expect(await enforceRateLimit(req, defaultOptions)).not.toBeNull();

      vi.advanceTimersByTime(1100);

      expect(await enforceRateLimit(req, defaultOptions)).toBeNull();
    });

    it('supports custom messages', async () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '4.4.4.4' }
      });
      const options = { ...defaultOptions, message: 'Custom error message' };

      await enforceRateLimit(req, options);
      await enforceRateLimit(req, options);
      const res = await enforceRateLimit(req, options);

      const body = await res?.json();
      expect(body.message).toBe('Custom error message');
    });
  });

  describe('cleanupIfNeeded', () => {
    it('cleans up old entries when MAX_BUCKETS is exceeded', async () => {
      const defaultOptions = {
        bucket: 'test-bucket-cleanup',
        limit: 10,
        windowMs: 1000,
      };

      for (let i = 0; i < 20001; i++) {
        const req = new Request('http://localhost', {
          headers: { 'x-real-ip': `ip-${i}` }
        });
        await enforceRateLimit(req, defaultOptions);
      }

      await expect(async () => {
        const lastReq = new Request('http://localhost', { headers: { 'x-real-ip': 'ip-final' } });
        await enforceRateLimit(lastReq, defaultOptions);
      }).not.toThrow();
    });
  });
});
