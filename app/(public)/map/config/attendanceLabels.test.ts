import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_LABELS,
  CLOSED_ATTENDANCE_LABELS,
  isClosedAttendanceLabel,
} from './attendanceLabels';

describe('isClosedAttendanceLabel', () => {
  it('出店者が確定した「出店していない」はグレー対象', () => {
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.CLOSED_CONFIRMED)).toBe(true);
  });

  it('「出店していない可能性が高い」はグレー対象', () => {
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.LIKELY_CLOSED)).toBe(true);
  });

  it('投票が割れている「出店していないかもしれない」はグレーにしない', () => {
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.MAYBE_CLOSED)).toBe(false);
  });

  it('出店側のラベルはすべてグレーにしない', () => {
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.OPEN_CONFIRMED)).toBe(false);
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.LIKELY_OPEN_HIGH)).toBe(false);
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.LIKELY_OPEN)).toBe(false);
  });

  it('「わからない」はグレーにしない', () => {
    expect(isClosedAttendanceLabel(ATTENDANCE_LABELS.UNKNOWN)).toBe(false);
  });

  it('未取得（undefined / null / 空文字）は安全側でグレーにしない', () => {
    expect(isClosedAttendanceLabel(undefined)).toBe(false);
    expect(isClosedAttendanceLabel(null)).toBe(false);
    expect(isClosedAttendanceLabel('')).toBe(false);
  });

  it('未知の文字列はグレーにしない', () => {
    expect(isClosedAttendanceLabel('休業中')).toBe(false);
  });

  it('グレー対象は2件のみ', () => {
    expect(CLOSED_ATTENDANCE_LABELS.size).toBe(2);
  });
});
