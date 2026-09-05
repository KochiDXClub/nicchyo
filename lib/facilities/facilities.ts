/**
 * おでかけサポートのカテゴリ定義と施設の型
 *
 * 施設そのもの（お手洗い / 休けい場所 / のりもの）のデータは、マップの
 * ランドマークと同じ map_landmarks テーブルが唯一の情報源。
 * lib/facilities/landmarkFacilities.ts が Landmark[] から Facility[] へ変換する。
 * （以前ここにあった静的配列 FACILITIES は DB へ移行済み）
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
  lat: number;
  lng: number;
  /**
   * マップ上のアイコン画像（未指定ならカテゴリ絵文字を使う）。
   * のりものは種別ごとに専用アイコン（路面電車＝オレンジ、JR＝青）を使う。
   */
  iconUrl?: string;
  /** マーカーの色（未指定ならカテゴリの markerColor を使う） */
  markerColor?: string;
  /** 座標を実測・確認済みか。false の施設は案内で「おおよそ」と添える */
  verified?: boolean;
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
    iconUrl: '/images/maps/elements/facilities/restroom.svg',
    description: '会場の近くで使えるお手洗いをさがします',
    boxClass: 'border-sky-200 bg-sky-50 text-sky-900',
    markerColor: '#0284c7',
  },
  {
    id: 'rest',
    label: '休けいベンチ',
    emoji: '🌿',
    iconUrl: '/images/maps/elements/facilities/rest.svg',
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

export function getFacilityCategory(id: FacilityCategoryId): FacilityCategory | undefined {
  return FACILITY_CATEGORIES.find((category) => category.id === id);
}

/** URLパラメータなど外部由来の文字列をカテゴリIDに変換する */
export function parseFacilityCategoryId(value: string | null | undefined): FacilityCategoryId | null {
  if (!value) return null;
  const match = FACILITY_CATEGORIES.find((category) => category.id === value);
  return match ? match.id : null;
}
