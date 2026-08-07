/**
 * おでかけサポートの施設データ
 *
 * 日曜市（追手筋）周辺の お手洗い / 休けい場所 / のりもの を静的に持つ。
 * /facilities のカテゴリボックスと、マップ上の強調表示・最寄り案内の両方がこれを参照する。
 *
 * ⚠️ お手洗い・休けいベンチの座標は、追手筋の実座標
 *    （app/(public)/map/config/roadConfig.ts）を基準にした暫定値です。
 *    最寄り案内の精度に直結するため、公開前に必ず現地または地図サービスで
 *    実測値へ差し替えてください。
 *    のりもの（電停・JR駅）はWikipediaのinfobox基準の座標で、
 *    app/(public)/map のランドマーク表示（map_landmarks の tram-*・
 *    jr-kochi-station）と同じ実測値を使っているため、この注記の対象外です。
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
    description: '電車・バス・駐車場をさがします',
    boxClass: 'border-amber-200 bg-amber-50 text-amber-900',
    markerColor: '#d97706',
  },
];

/**
 * のりもの用の専用アイコン（電停＝オレンジ、JR駅＝青のSVGバッジ）。
 * マップ上のランドマーク表示（map_landmarks の transit/*.svg）と同じ画像を使う。
 */
const TRAM_STOP_ICON = {
  iconUrl: '/images/maps/elements/transit/tram-stop.svg',
  markerColor: '#f97316',
} as const;
const JR_STATION_ICON = {
  iconUrl: '/images/maps/elements/transit/train-stop.svg',
  markerColor: '#1d4ed8',
} as const;

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
  // 電停・駅の座標とアイコンは、マップ上のランドマーク表示
  // （lib/facilities/facilities.ts と同じPRで追加した map_landmarks の
  // tram-*・jr-kochi-station エントリ）と揃えてある。
  {
    id: 'transport-tram-hasuikemachidori',
    category: 'transport',
    name: '路面電車「蓮池町通」電停',
    area: '会場の東がわ',
    note: 'とさでん交通・駅前線の電停です。',
    tags: ['路面電車'],
    lat: 33.5618694,
    lng: 133.5432083,
    ...TRAM_STOP_ICON,
  },
  {
    id: 'transport-tram-ohashidori',
    category: 'transport',
    name: '路面電車「大橋通」電停',
    area: '会場の南がわ',
    note: 'とさでん交通・伊野線の電停です。',
    tags: ['路面電車'],
    lat: 33.5589806,
    lng: 133.5366611,
    ...TRAM_STOP_ICON,
  },
  {
    id: 'transport-tram-harimayabashi',
    category: 'transport',
    name: '路面電車「はりまや橋」電停',
    area: '会場の東がわ',
    note: 'とさでん交通の主要な乗りかえ拠点。後免線・伊野線・桟橋線・駅前線が乗り入れます。',
    tags: ['路面電車', '乗りかえ'],
    lat: 33.5596333,
    lng: 133.5423972,
    ...TRAM_STOP_ICON,
  },
  {
    id: 'transport-tram-horizume',
    category: 'transport',
    name: '路面電車「堀詰」電停',
    area: '会場の中ほど',
    note: 'とさでん交通・伊野線の電停です。',
    tags: ['路面電車'],
    lat: 33.5594944,
    lng: 133.5392306,
    ...TRAM_STOP_ICON,
  },
  {
    id: 'transport-tram-kochijomae',
    category: 'transport',
    name: '路面電車「高知城前」電停',
    area: '会場の西のはし',
    note: 'とさでん交通・伊野線。高知城・日曜市の最寄り電停です。',
    tags: ['路面電車'],
    lat: 33.5585056,
    lng: 133.5339250,
    ...TRAM_STOP_ICON,
  },
  {
    id: 'transport-tram-kochiekimae',
    category: 'transport',
    name: '路面電車「高知駅前」電停',
    area: '会場から北へ徒歩15分ほど',
    note: 'とさでん交通・駅前線。JR高知駅のすぐ南にあります。',
    tags: ['路面電車'],
    lat: 33.5668361,
    lng: 133.5436528,
    ...TRAM_STOP_ICON,
  },
  {
    id: 'transport-jr-kochi-station',
    category: 'transport',
    name: 'JR高知駅',
    area: '会場から北へ徒歩15分ほど',
    note: '土讃線・特急が発着する、県外から日曜市へ向かう主要な玄関口です。路面電車なら「はりまや橋」で乗りかえます。',
    tags: ['JR', 'バスのりば'],
    lat: 33.567691786705,
    lng: 133.5436611,
    ...JR_STATION_ICON,
  },
  {
    id: 'transport-parking-central-park',
    category: 'transport',
    name: '中央公園地下駐車場',
    area: '会場の中ほど・中央公園の地下',
    note: '日曜市の日は追手筋が通行止めになります。少し離れた駐車場に停めて歩くのがおすすめです。',
    tags: ['駐車場'],
    lat: 33.5608,
    lng: 133.5378,
  },
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
