/**
 * 「おでかけサポート」のデモで案内するお手洗い。
 *
 * 場所は本番の map_landmarks（category = restroom）そのもの。マップページが
 * 既に読み込んでいるランドマークから拾い、本番と同じ変換（landmarkToSpot）で
 * スポットにする。名前・場所の説明・タグ・写真も本番と同じものが出る。
 *
 * ランドマークがまだ無い（取得に失敗した・開発環境で空）ときだけ、案内が
 * 空白にならないよう控えを使う。控えは map_landmarks に最初に入れた4か所
 * （supabase/migrations/20260905123611 の seed）と同じ内容で、座標も同じ。
 */

import type { Landmark } from '../../types/landmark';
import { landmarkToSpot, resolveLandmarkKind, type MapSpot } from '@/lib/spots';

const RESTROOM_ICON_URL = '/images/maps/elements/facilities/restroom.svg';

function fallbackRestroom(
  key: string,
  name: string,
  description: string,
  lat: number,
  lng: number,
  tags: string[],
  notes: string,
  photo?: { url: string; credit: string }
): Landmark {
  return {
    key,
    name,
    description,
    url: RESTROOM_ICON_URL,
    lat,
    lng,
    widthPx: 40,
    heightPx: 40,
    showAtMinZoom: false,
    category: 'restroom',
    tags,
    notes,
    photoUrl: photo?.url,
    photoCredit: photo?.credit,
    showOnMap: false,
    verified: false,
  };
}

/** ランドマークが読めていないときの控え。本番の seed と同じ4か所 */
export const FALLBACK_INTRO_RESTROOMS: Landmark[] = [
  fallbackRestroom(
    'restroom-central-park',
    '中央公園 公衆お手洗い',
    '会場の中ほど・中央公園内',
    33.5609,
    133.5376,
    ['多目的あり'],
    '日曜市の通りから南へすぐ。会場のどこからでも向かいやすい場所です。'
  ),
  fallbackRestroom(
    'restroom-kochi-castle',
    '高知公園（高知城前）公衆お手洗い',
    '会場の西のはし・追手門のそば',
    33.5607,
    133.5341,
    ['多目的あり'],
    '日曜市の西の入口から歩いてすぐです。'
  ),
  fallbackRestroom(
    'restroom-hirome',
    'ひろめ市場',
    '会場から南へ徒歩3分ほど',
    33.5598,
    133.5346,
    ['屋内'],
    '館内のお手洗いを利用できます。混み合う時間帯があります。',
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Hirome_Market_Entrance.jpg/960px-Hirome_Market_Entrance.jpg',
      credit: '写真: Tzu-hsun, Hsu / CC BY-SA 4.0（Wikimedia Commons）',
    }
  ),
  fallbackRestroom(
    'restroom-obiyamachi',
    '帯屋町アーケード周辺の商業施設',
    '会場から南へ徒歩5分ほど',
    33.5601,
    133.5367,
    ['屋内'],
    'アーケード内の各施設で利用できます。営業時間内のみです。',
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Obiyamachi_1st_Shopping_Street_ac_%282%29.jpg/960px-Obiyamachi_1st_Shopping_Street_ac_%282%29.jpg',
      credit: '写真: Asturio Cantabrio / CC BY-SA 4.0（Wikimedia Commons）',
    }
  ),
];

/**
 * ランドマークからお手洗いだけをスポットにして返す。
 * 種別の判定は本番と同じ（category 優先、無ければ key の規約）。1つも無ければ控え。
 */
export function pickIntroRestrooms(landmarks: Landmark[] | undefined): MapSpot[] {
  const restrooms = (landmarks ?? []).filter(
    (landmark) => resolveLandmarkKind(landmark).kind === 'restroom'
  );
  const source = restrooms.length > 0 ? restrooms : FALLBACK_INTRO_RESTROOMS;
  return source.map(landmarkToSpot);
}
