import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { fetchLandmarksFromDb } from '../map/services/landmarksDb';
import { countFacilitiesByCategory } from '@/lib/facilities/landmarkFacilities';
import type { FacilityCategoryId } from '@/lib/facilities/facilities';
import FacilitiesPageClient from './FacilitiesPageClient';

// 件数は DB から毎回読む（静的化すると 0 件のまま固定されてしまう）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'おでかけサポート',
  description:
    '高知・日曜市のお手洗い、休けいできるベンチ、電車やバスののりばをマップからさがせます。はじめての方も安心してまわれます。',
};

export default async function FacilitiesPage() {
  // カテゴリごとの件数表示のため、マップと同じスポットデータ（map_landmarks）を取得する。
  // 取得できなくても致命的ではないので、失敗時は0件のまま表示する。
  let counts: Record<FacilityCategoryId, number> = { restroom: 0, rest: 0, transport: 0 };

  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

  if (hasSupabaseEnv) {
    try {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const landmarks = await fetchLandmarksFromDb(supabase);
      counts = countFacilitiesByCategory(landmarks);
    } catch (error) {
      console.error('[FacilitiesPage] スポットの取得に失敗しました:', error);
    }
  }

  return <FacilitiesPageClient counts={counts} />;
}
