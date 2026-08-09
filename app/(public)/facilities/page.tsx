import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { fetchLandmarksFromDb } from '../map/services/landmarksDb';
import { getTransitFacilities } from '@/lib/facilities/transitLandmarks';
import FacilitiesPageClient from './FacilitiesPageClient';

export const metadata: Metadata = {
  title: 'おでかけサポート',
  description:
    '高知・日曜市のお手洗い、休けいできるベンチ、電車やバスののりばをマップからさがせます。はじめての方も安心してまわれます。',
};

export default async function FacilitiesPage() {
  // 「のりもの」の件数表示のため、マップと同じランドマークデータを取得する。
  // 取得できなくても致命的ではないので、失敗時は0件のまま表示する。
  let transportCount = 0;

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
      transportCount = getTransitFacilities(landmarks).length;
    } catch (error) {
      console.error('[FacilitiesPage] ランドマークの取得に失敗しました:', error);
    }
  }

  return <FacilitiesPageClient transportCount={transportCount} />;
}
