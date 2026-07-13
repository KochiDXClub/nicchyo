export type ItineraryShop = { id: number; name?: string; time: string };
export type ItineraryPlan = { title: string; summary?: string; shops: ItineraryShop[] };

export function generateItinerary(options: {
  shopCandidates: { id: number; name?: string }[];
  stops?: number;
  startAt?: string; // "今すぐ" or "HH:MM"
  interest?: string;
}): ItineraryPlan {
  const stops = Math.max(1, Math.min(6, options.stops ?? 3));
  const candidates = options.shopCandidates ?? [];
  const selected = candidates.slice(0, Math.min(stops, candidates.length));
  const now = new Date();
  const startDate = new Date(now);
  if (options.startAt && options.startAt !== "今すぐ") {
    const m = options.startAt.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      startDate.setHours(hh, mm, 0, 0);
      // if start time is earlier than now, assume next day
      if (startDate.getTime() < now.getTime()) {
        startDate.setDate(startDate.getDate() + 1);
      }
    }
  }

  const intervalMinutes = 20;
  const shops = selected.map((s, i) => {
    const time = new Date(startDate.getTime() + i * intervalMinutes * 60 * 1000);
    return { id: s.id, name: s.name, time: time.toISOString() };
  });

  const title = `${options.startAt ?? '今すぐ'}のおさんぽプラン`;
  return { title, summary: options.interest ?? '', shops };
}
