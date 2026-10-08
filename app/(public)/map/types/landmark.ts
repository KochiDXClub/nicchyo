/** map_landmarks.category。店舗以外のスポットの種別 */
export type LandmarkCategory = 'transit' | 'landmark' | 'restroom' | 'rest';

export type LandmarkTransitMode = 'tram' | 'jr';

/**
 * map_landmarks の1行。マップに描く画像（url/widthPx/heightPx）に加えて、
 * スポットカード・おでかけサポートで使う属性を持つ。
 * 追加属性は省略可能（古いテストデータやスナップショット由来の値に合わせる）。
 */
export type Landmark = {
  key: string;
  name: string;
  description: string;
  url: string;
  lat: number;
  lng: number;
  widthPx: number;
  heightPx: number;
  showAtMinZoom: boolean;
  /** 未指定なら landmark（電停・駅は key の規約から判定する） */
  category?: LandmarkCategory;
  transitMode?: LandmarkTransitMode;
  /** 乗り入れ路線 */
  lines?: string[];
  /** 「屋根あり」「多目的あり」などの条件タグ */
  tags?: string[];
  notes?: string;
  externalUrl?: string;
  photoUrl?: string;
  photoCredit?: string;
  /** 利用できる時間帯（'HH:MM'）。未設定なら終日 */
  openFrom?: string;
  openUntil?: string;
  /** false のものはマップに常時描画しない（おでかけサポート時のみ表示） */
  showOnMap?: boolean;
  /** 座標を実測・確認済みか */
  verified?: boolean;
};

/** マップに常時描画するランドマークだけを返す */
export function filterMapVisibleLandmarks(landmarks: Landmark[]): Landmark[] {
  return landmarks.filter((landmark) => landmark.showOnMap !== false);
}
