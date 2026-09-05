/**
 * サーバー側（API ルート）で、DB からスポットと道を読み、AI 向けの
 * 「困ったときの案内」を組み立てる。
 *
 * にちよさん（/api/grandma/ask）とマップAI（/api/map-agent）の両方が使う。
 * 取得に失敗しても会話・プランは止めない（空を返す）。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { fetchLandmarksFromDb } from '@/app/(public)/map/services/landmarksDb';
import { fetchMapRouteFromDb } from '@/app/(public)/map/services/mapRouteDb';
import type { LatLng } from '@/lib/facilities/geo';
import { buildSpotSupportPrompt, buildSupportNetwork, buildSupportSuggestions, type SupportSuggestion } from './support';

export type SpotSupport = {
  suggestions: SupportSuggestion[];
  /** システムプロンプトに添える文章（スポットが無ければ空文字） */
  prompt: string;
};

export async function loadSpotSupport(
  supabase: SupabaseClient<Database>,
  origin: LatLng | null
): Promise<SpotSupport> {
  try {
    const [landmarks, mapRoute] = await Promise.all([fetchLandmarksFromDb(supabase), fetchMapRouteFromDb(supabase)]);
    if (landmarks.length === 0) return { suggestions: [], prompt: '' };
    const network = buildSupportNetwork(mapRoute);
    const suggestions = buildSupportSuggestions(landmarks, network, origin);
    return { suggestions, prompt: buildSpotSupportPrompt(landmarks, suggestions) };
  } catch (error) {
    console.warn('[loadSpotSupport] failed:', error);
    return { suggestions: [], prompt: '' };
  }
}
