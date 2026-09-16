/**
 * マップ上の「スポット」＝タップして情報を見られる地点の統一モデル。
 *
 * 店舗・電停・駅・建物などのランドマーク・お手洗い・休けい場所は
 * これまで別々の型（Shop / Landmark / Facility）で扱われ、タップ体験も
 * バラバラだった（店舗はバナー、ランドマークはLeaflet版だけポップアップ、
 * 施設は無反応）。この型に寄せることで、店舗以外はすべて同じ
 * スポットカード（SpotCard）で開けるようにする。
 *
 * 店舗は情報量が多く専用バナー（ShopDetailBanner）を持つため、
 * ここでは kind: 'shop' として同じ型に載せられるようにだけしておき、
 * カードの中身は専用バナーに委ねる。
 */

export type SpotKind = 'transit' | 'landmark' | 'restroom' | 'rest' | 'shop';

/** 交通機関の種別。transit のときだけ意味を持つ */
export type TransitMode = 'tram' | 'jr';

export type MapSpot = {
  /** `landmark:<key>` / `facility:<id>` / `shop:<id>` の形。種別をまたいで一意 */
  id: string;
  kind: SpotKind;
  transitMode?: TransitMode;
  name: string;
  /** 1〜2文の説明。空文字なら表示しない */
  description: string;
  lat: number;
  lng: number;
  /** 丸型バッジや建物イラストなど、マップ上と同じアイコン画像 */
  iconUrl?: string;
  /** アイコン画像が無いときに使う絵文字 */
  emoji?: string;
  /** 種別ごとのアクセント色（CSSカラー） */
  accentColor: string;
  /** 「屋根あり」「多目的トイレ」などの短いタグ */
  tags?: string[];
  /** 実景写真のURL（PR2以降のデータ拡充で入る） */
  photoUrl?: string;
  /** 写真の出典表記（ライセンス上必要なもの） */
  photoCredit?: string;
  /** 時刻表など外部ページ */
  externalUrl?: string;
  /** 乗り入れ路線（電停・駅） */
  lines?: string[];
  /** 補足（設備・注意など） */
  notes?: string;
  /** 利用できる時間帯（'HH:MM'）。未設定なら終日 */
  openFrom?: string;
  openUntil?: string;
  /** 座標を実測・確認済みか。false なら案内で「おおよそ」と添える */
  verified?: boolean;
  /** kind: 'shop' のときの店舗ID */
  shopId?: number;
  /** kind が landmark/transit のときの map_landmarks.key */
  landmarkKey?: string;
};
