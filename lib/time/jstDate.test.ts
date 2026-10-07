import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayJstString, addDaysToDateString, monthStartJstString, nextSundayJstString } from './jstDate';

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

describe('JST 日付の境界（JST 0:00〜8:59 は UTC ではまだ前日）', () => {
  // 2026-10-06T15:30:00Z は JST 2026-10-07 00:30
  const jstEarlyMorning = new Date('2026-10-06T15:30:00Z');

  it('todayJstString は UTC の toISOString().slice(0, 10) と異なり JST の日付を返す', () => {
    expect(jstEarlyMorning.toISOString().slice(0, 10)).toBe('2026-10-06');
    expect(todayJstString(jstEarlyMorning)).toBe('2026-10-07');
    expect(todayJstString(new Date('2026-10-06T23:59:00Z'))).toBe('2026-10-07');
    expect(todayJstString(new Date('2026-10-06T14:59:00Z'))).toBe('2026-10-06');
  });

  it('addDaysToDateString は月・年をまたいで暦どおりに加減算する', () => {
    expect(addDaysToDateString('2026-10-07', -6)).toBe('2026-10-01');
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateString('2026-10-07', 0)).toBe('2026-10-07');
  });

  it('monthStartJstString は JST の月初を返す（月初の JST 早朝でも前月にならない）', () => {
    // 2026-09-30T15:30:00Z = JST 2026-10-01 00:30
    expect(monthStartJstString(new Date('2026-09-30T15:30:00Z'))).toBe('2026-10-01');
    expect(monthStartJstString(new Date('2026-10-15T00:00:00Z'))).toBe('2026-10-01');
  });

  it('nextSundayJstString は JST の曜日で次の日曜を返す', () => {
    // 2026-10-04 は日曜。JST 日曜 0:30（UTC では土曜 15:30）は当日
    expect(nextSundayJstString(new Date('2026-10-03T15:30:00Z'))).toBe('2026-10-04');
    // JST 月曜 0:30（UTC では日曜 15:30）は先週日曜ではなく翌週日曜
    expect(nextSundayJstString(new Date('2026-10-04T15:30:00Z'))).toBe('2026-10-11');
    // JST 水曜
    expect(nextSundayJstString(new Date('2026-10-07T03:00:00Z'))).toBe('2026-10-11');
  });
});
