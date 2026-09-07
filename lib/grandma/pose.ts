/**
 * 相談ページのキャラ絵の「構え」
 *
 * 会話の状態（聞いている・考えている・答えている）をキャラの姿勢に写す。
 * これによりローディングスピナーや録音中インジケータをキャラの動きに置き換えられる。
 *
 * 表示側の都合を持ち込まない純関数にしてあるので、GrandmaChatter の状態から
 * そのまま導出できる（新しい state を増やさない）。
 */

export type GrandmaPose = "idle" | "listening" | "thinking" | "speaking";

/** GrandmaChatter が持っている aiStatus と同じ形 */
export type GrandmaAiStatus = "idle" | "thinking" | "answered" | "error";

export interface GrandmaPoseInput {
  /** 音声入力の受付中 */
  isListening: boolean;
  /** 返答がストリーミングで流れてきている最中 */
  isStreaming: boolean;
  aiStatus: GrandmaAiStatus;
}

/**
 * 会話の状態から構えを決める。
 *
 * 優先順位は「聞いている > 答えている > 考えている > 待機」。
 * 音声入力を最優先にするのは、マイクを押した瞬間の反応が最も体感に効くため。
 * ストリーミングを thinking より優先するのは、最初のトークンが届いた時点で
 * aiStatus がまだ "thinking" のまま残っていることがあるから。
 */
export function resolveGrandmaPose({
  isListening,
  isStreaming,
  aiStatus,
}: GrandmaPoseInput): GrandmaPose {
  if (isListening) return "listening";
  if (isStreaming) return "speaking";
  if (aiStatus === "thinking") return "thinking";
  return "idle";
}
