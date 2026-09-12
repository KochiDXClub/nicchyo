/**
 * 管理画面の対話テスト（app/api/admin/ai-models/test）の結果。
 * API と画面（ModelPlayground）で共有する。
 */
export type AiModelTestResult = {
  ok: boolean;
  status: number;
  /** 埋め込み・検索・モデル呼び出しを含む、来訪者が待つのと同じ所要時間 */
  elapsedMs: number;
  modelId: string;
  reasoningEffort: string | null;
  reply: string;
  turns: { speakerName: string; text: string }[];
  shops: { id: number; name: string }[];
  followUpQuestion: string;
  errorCode: string | null;
  errorMessage: string | null;
  /** OpenAI 側の失敗内容。失敗したときだけ */
  debugError: string | null;
};
