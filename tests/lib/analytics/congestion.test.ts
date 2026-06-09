import { describe, it, expect } from 'vitest';
import { estimateCongestion } from '@/lib/analytics/congestion';

describe('estimateCongestion', () => {
  const shops = [
    { id: 1, lat: 33.5614, lng: 133.5379 },
    { id: 2, lat: 33.5620, lng: 133.5410 },
  ];

  it('should return low congestion when there are no logs', () => {
    const logs: any[] = [];
    const result = estimateCongestion(shops, logs);
    expect(result[0].congestionLevel).toBe('low');
    expect(result[0].visitorCount).toBe(0);
  });

  it('should return high congestion when visitors and stay duration are above thresholds', () => {
    const logs = [
      // Visitor 1: 10 mins stay
      { visitor_key: 'v1', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:00:00Z' },
      { visitor_key: 'v1', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:10:00Z' },
      // Visitor 2: 10 mins stay
      { visitor_key: 'v2', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:00:00Z' },
      { visitor_key: 'v2', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:10:00Z' },
      // Visitor 3, 4, 5
      { visitor_key: 'v3', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:05:00Z' },
      { visitor_key: 'v3', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:15:00Z' },
      { visitor_key: 'v4', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:05:00Z' },
      { visitor_key: 'v4', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:15:00Z' },
      { visitor_key: 'v5', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:05:00Z' },
      { visitor_key: 'v5', latitude: 33.5614, longitude: 133.5379, speed: 1.0, created_at: '2026-06-01T10:15:00Z' },
    ];
    const result = estimateCongestion(shops, logs);
    expect(result[0].congestionLevel).toBe('high');
    expect(result[0].visitorCount).toBe(5);
    expect(result[0].averageStayMinutes).toBe(10);
  });

  it('should estimate wait time based on slow users', () => {
    const logs = [
      // 0.1 m/s = 0.36 km/h (below 0.5 threshold)
      // Wait time = 15m / 0.1m/s = 150s = 2.5 mins -> rounds to 3 mins
      { visitor_key: 'v1', latitude: 33.5614, longitude: 133.5379, speed: 0.1, created_at: '2026-06-01T10:00:00Z' },
    ];
    const result = estimateCongestion(shops, logs);
    expect(result[0].estimatedWaitMinutes).toBe(3);
  });
});
