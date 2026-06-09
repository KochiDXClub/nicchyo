import { distanceMeters } from "@/app/(public)/map/utils/mapRouteGeometry";

export type CongestionLevel = "low" | "medium" | "high" | "very_high";

export interface ShopCongestion {
  shopId: number;
  visitorCount: number;
  averageStayMinutes: number;
  congestionLevel: CongestionLevel;
  estimatedWaitMinutes: number;
}

export interface LocationLog {
  visitor_key: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  created_at: string;
}

const GEOFENCE_RADIUS_METERS = 15;
const SLOW_SPEED_THRESHOLD_KPH = 0.5;
const SLOW_SPEED_THRESHOLD_MPS = SLOW_SPEED_THRESHOLD_KPH / 3.6;

/**
 * Calculates congestion and wait times for shops based on recent location logs.
 */
export function estimateCongestion(
  shops: Array<{ id: number; lat: number; lng: number }>,
  logs: LocationLog[]
): ShopCongestion[] {
  const result: ShopCongestion[] = [];

  for (const shop of shops) {
    const shopLogs = logs.filter(
      (log) =>
        distanceMeters({ lat: shop.lat, lng: shop.lng }, { lat: log.latitude, lng: log.longitude }) <=
        GEOFENCE_RADIUS_METERS
    );

    const uniqueVisitors = new Set(shopLogs.map((l) => l.visitor_key));
    const visitorCount = uniqueVisitors.size;

    // Calculate average stay duration per visitor
    let totalStayMs = 0;
    let visitorsWithDuration = 0;

    uniqueVisitors.forEach((vKey) => {
      const vLogs = shopLogs
        .filter((l) => l.visitor_key === vKey)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      if (vLogs.length >= 2) {
        const start = new Date(vLogs[0].created_at).getTime();
        const end = new Date(vLogs[vLogs.length - 1].created_at).getTime();
        totalStayMs += end - start;
        visitorsWithDuration++;
      }
    });

    const averageStayMinutes =
      visitorsWithDuration > 0 ? totalStayMs / visitorsWithDuration / 1000 / 60 : 0;

    // Determine congestion level
    let congestionLevel: CongestionLevel = "low";
    if (visitorCount >= 10 && averageStayMinutes >= 10) {
      congestionLevel = "very_high";
    } else if (visitorCount >= 5 && averageStayMinutes >= 5) {
      congestionLevel = "high";
    } else if (visitorCount >= 3) {
      congestionLevel = "medium";
    }

    // Estimate wait time based on slow-moving users
    const slowLogs = shopLogs.filter(
      (l) => l.speed !== null && l.speed <= SLOW_SPEED_THRESHOLD_MPS && l.speed > 0.01
    );

    let estimatedWaitMinutes = 0;
    if (slowLogs.length > 0) {
      const avgSpeed = slowLogs.reduce((sum, l) => sum + (l.speed || 0), 0) / slowLogs.length;
      const waitSeconds = GEOFENCE_RADIUS_METERS / avgSpeed;
      estimatedWaitMinutes = Math.min(60, Math.round(waitSeconds / 60));
    } else if (congestionLevel === "very_high") {
        estimatedWaitMinutes = 20;
    } else if (congestionLevel === "high") {
        estimatedWaitMinutes = 10;
    }

    result.push({
      shopId: shop.id,
      visitorCount,
      averageStayMinutes,
      congestionLevel,
      estimatedWaitMinutes,
    });
  }

  return result;
}
