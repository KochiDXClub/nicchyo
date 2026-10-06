/**
 * 現地で位置を決める地図（LocationPicker）の色。
 * MapLibre の paint はクラス名ではなく色の文字列を取るので、ここにまとめる
 * （公開マップの色は app/(public)/map/config/roadStyle.ts にある）。
 */
export const PICKER_COLORS = {
  /** 配置済みの区画（nicchyo-primary と同じ緑） */
  assigned: "#7ED957",
  /** 空きの区画 */
  vacant: "#9ca3af",
  /** 点の縁・ピンの白抜き */
  outline: "#ffffff",
  /** これから保存する位置のピン */
  pin: "#e11d48",
} as const;
