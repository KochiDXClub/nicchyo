import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayJstString } from './jstDate';

describe('todayJstString', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns current date in YYYY-MM-DD format in Asia/Tokyo timezone', () => {
    // Mock Date to a specific UTC time
    // 2023-08-15T23:00:00Z is 2023-08-16T08:00:00+09:00 (JST)
    const mockDate = new Date('2023-08-15T23:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const result = todayJstString();
    expect(result).toBe('2023-08-16');

    vi.useRealTimers();
  });

  it('accepts an explicit baseDate instead of the current time', () => {
    // 2024-01-01T23:30:00Z は 2024-01-02T08:30:00+09:00 (JST)
    const result = todayJstString(new Date('2024-01-01T23:30:00Z'));
    expect(result).toBe('2024-01-02');
  });

  it('throws an error if Intl.DateTimeFormat fails to provide year/month/day', () => {
    // We only need to mock formatToParts for this specific test
    vi.stubGlobal('Intl', {
      ...Intl,
      DateTimeFormat: function() {
        return {
          formatToParts: () => []
        };
      }
    });

    expect(() => todayJstString()).toThrow('Failed to format JST date');

    vi.unstubAllGlobals();
  });
});
