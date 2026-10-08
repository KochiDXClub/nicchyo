/**
 * マップ編集画面の配色。
 * 既存の編集画面（ヘッダー・右パネル）で使っている色と同じ値を、新しく作る部品から
 * 参照できるよう1か所にまとめる（部品ごとに色を直書きすると同じ意味の色がばらつくため）。
 */
export const EDITOR_COLORS = {
  /** 強調（選択中の道具・ボタン） */
  accent: "#92400E",
  /** 強調の縁取り（頂点ハンドルなど） */
  accentBorder: "#B45309",
  /** 強調の淡い背景 */
  accentSoft: "#FFF7E6",
  ink: "#57503F",
  muted: "#9A8A6A",
  border: "#E4D9BF",
  surface: "#ffffff",
  /** 保存していない変更がある要素の印 */
  unsaved: "#2563EB",
  /**
   * 地図上の区画: 空き（赤）と出店者あり（ピン）。
   * 出店者を割り当て忘れた区画を地図の上でひと目で探せるよう、空きは目立つ赤にする。
   * 区画分けで「消す」プレビューの赤（previewDelete）とは別の、赤紫寄りの色にして混ざらないようにする
   */
  vacantSlot: "#E11D48",
  vacantSlotStroke: "#9F1239",
  occupiedSlot: "#D97706",
  selectedSlot: "#B45309",
  /** 区画分けのプレビュー: 新しく作る区画・動く区画・消す区画 */
  previewCreate: "#16A34A",
  previewMove: "#D97706",
  previewDelete: "#DC2626",
} as const;
