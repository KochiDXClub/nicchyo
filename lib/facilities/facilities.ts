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
