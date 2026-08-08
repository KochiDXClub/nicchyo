/**
 * おでかけサポートの施設データ
 *
 * 日曜市（追手筋）周辺の お手洗い / 休けい場所 / のりもの を静的に持つ。
 * /facilities のカテゴリボックスと、マップ上の強調表示・最寄り案内の両方がこれを参照する。
 *
 * ⚠️ 座標は追手筋の実座標（app/(public)/map/config/roadConfig.ts）を基準にした
 *    暫定値です。最寄り案内の精度に直結するため、公開前に必ず現地または
 *    地図サービスで実測値へ差し替えてください。
 *
 * のりもの（電停・JR駅）はここには含めない。マップ上のランドマーク表示
 * （map_landmarks の tram-*・jr-kochi-station）が常時表示で既に案内して
 * いるため、二重に扱わない。ここに置くのは駐車場などランドマーク側で
 * 扱っていない情報のみ。
 */

export type FacilityCategoryId = 'restroom' | 'rest' | 'transport';

export type Facility = {
  id: string;
  category: FacilityCategoryId;
  name: string;
  /** 日曜市会場から見た位置の説明 */
  area: string;
  /** 補足（設備・所要時間など） */
  note?: string;
  /** 目印になる短いタグ */
  tags?: string[];
  /** ⚠️ 暫定座標。実測値に要差し替え */
  lat: number;
  lng: number;
  /**
   * マップ上のアイコン画像（未指定ならカテゴリ絵文字を使う）。
   * のりものは種別ごとに専用アイコン（路面電車＝オレンジ、JR＝青）を使う。
   */
  iconUrl?: string;
  /** マーカーの色（未指定ならカテゴリの markerColor を使う） */
  markerColor?: string;
};

export type FacilityCategory = {
  id: FacilityCategoryId;
  /** 画面に出す名前 */
  label: string;
  emoji: string;
  /**
   * カテゴリ代表アイコン画像（未指定なら emoji を使う）。
   * のりものは、マップ上の停留場バッジと同じ tram-stop.svg を使う。
   */
  iconUrl?: string;
  /** ボックスに添える一文 */
  description: string;
  /** マーカーとボックスの配色（Tailwindクラス） */
  boxClass: string;
  /** マーカーの地色（CSSカラー） */
  markerColor: string;
};

export const FACILITY_CATEGORIES: FacilityCategory[] = [
  {
    id: 'restroom',
    label: 'お手洗い',
    emoji: '🚻',
    description: '会場の近くで使えるお手洗いをさがします',
    boxClass: 'border-sky-200 bg-sky-50 text-sky-900',
    markerColor: '#0284c7',
  },
  {
    id: 'rest',
    label: '休けいベンチ',
    emoji: '🌿',
    description: '荷物を置いて、ひと息つける場所をさがします',
    boxClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    markerColor: '#059669',
  },
  {
    id: 'transport',
    label: 'のりもの',
    emoji: '🚋',
    iconUrl: '/images/maps/elements/transit/tram-stop.svg',
    description: '路面電車の停留場やJR高知駅をさがします',
    boxClass: 'border-amber-200 bg-amber-50 text-amber-900',
    markerColor: '#d97706',
  },
];

export const FACILITIES: Facility[] = [
  // ── お手洗い ────────────────────────────────────────────────
  {
    id: 'restroom-central-park',
    category: 'restroom',
    name: '中央公園 公衆お手洗い',
    area: '会場の中ほど・中央公園内',
    note: '日曜市の通りから南へすぐ。会場のどこからでも向かいやすい場所です。',
    tags: ['多目的あり'],
    lat: 33.5609,
    lng: 133.5376,
  },
  {
    id: 'restroom-kochi-castle',
    category: 'restroom',
    name: '高知公園（高知城前）公衆お手洗い',
    area: '会場の西のはし・追手門のそば',
    note: '日曜市の西の入口から歩いてすぐです。',
    tags: ['多目的あり'],
    lat: 33.5607,
    lng: 133.5341,
  },
  {
    id: 'restroom-hirome',
    category: 'restroom',
    name: 'ひろめ市場',
    area: '会場から南へ徒歩3分ほど',
    note: '館内のお手洗いを利用できます。混み合う時間帯があります。',
    tags: ['屋内'],
    lat: 33.5598,
    lng: 133.5346,
  },
  {
    id: 'restroom-obiyamachi',
    category: 'restroom',
    name: '帯屋町アーケード周辺の商業施設',
    area: '会場から南へ徒歩5分ほど',
    note: 'アーケード内の各施設で利用できます。営業時間内のみです。',
    tags: ['屋内'],
    lat: 33.5601,
    lng: 133.5367,
  },

  // ── 休けいベンチ ────────────────────────────────────────────
  {
    id: 'rest-central-park',
    category: 'rest',
    name: '中央公園',
    area: '会場の中ほど・南がわ',
    note: 'ベンチと広場があります。買ったものをその場で食べるのにも向いています。',
    tags: ['ベンチあり'],
    lat: 33.5610,
    lng: 133.5379,
  },
  {
    id: 'rest-kochi-castle-park',
    category: 'rest',
    name: '高知公園（高知城のふもと）',
    area: '会場の西のはし',
    note: '木かげとベンチがあります。人が少なめで落ち着けます。',
    tags: ['木かげあり'],
    lat: 33.5605,
    lng: 133.5338,
  },
  {
    id: 'rest-hirome',
    category: 'rest',
    name: 'ひろめ市場',
    area: '会場から南へ徒歩3分ほど',
    note: '屋根のある飲食スペースです。雨の日の避難先にもなります。',
    tags: ['屋内'],
    lat: 33.5598,
    lng: 133.5346,
  },
  {
    id: 'rest-obiyamachi',
    category: 'rest',
    name: '帯屋町アーケード',
    area: '会場から南へ徒歩5分ほど',
    note: '屋根つきの通りです。日ざしや雨をよけながら休めます。',
    tags: ['屋根あり'],
    lat: 33.5601,
    lng: 133.5372,
  },

  // ── のりもの ────────────────────────────────────────────────
  // ここには何も置かない。電停・JR駅は map_landmarks 側（マップ上に
  // 常時表示）が唯一の情報源で、lib/facilities/transitLandmarks.ts が
  // そこから Facility 形式に変換して補う（getFacilitiesByCategory では
  // 取得できないので注意。呼び出し側で transitLandmarks の結果と
  // マージすること）。
];

export function getFacilityCategory(id: FacilityCategoryId): FacilityCategory | undefined {
  return FACILITY_CATEGORIES.find((category) => category.id === id);
}

export function getFacilitiesByCategory(id: FacilityCategoryId): Facility[] {
  return FACILITIES.filter((facility) => facility.category === id);
}

/** URLパラメータなど外部由来の文字列をカテゴリIDに変換する */
export function parseFacilityCategoryId(value: string | null | undefined): FacilityCategoryId | null {
  if (!value) return null;
  const match = FACILITY_CATEGORIES.find((category) => category.id === value);
  return match ? match.id : null;
}
