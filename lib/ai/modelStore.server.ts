/**
 * 場面ごとに使うAIモデルをサーバー側で解決する。
 *
 * ai_model_settings は RLS ポリシーを作らず、anon / authenticated から GRANT を
 * 剥がしてある。つまり service role 以外からは触れない。
 * 読めなければコード側の既定値を返す。設定が読めないことで
 * AI機能そのものが止まってはいけない。
 *
 * このファイルはサーバー専用。クライアントコンポーネントから import すると
 * 常に既定値が返るだけの無言の劣化になるので、lib/ai/models.ts のような
 * 共有モジュールからは再エクスポートしないこと
 * （lib/grandma/prompts/promptStore.server.ts と同じ方針）。
 */

import { cache } from "react";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import {
  AI_USE_CASES,
  DEFAULT_AI_MODEL_SETTINGS,
  normalizeAiModelSettings,
  resolveAiModelChoice,
  type AiModelSettingSet,
  type AiUseCase,
  type ResolvedAiModel,
} from "./models";

export const AI_MODEL_SETTINGS_TABLE = "ai_model_settings";

/**
 * 有効なモデル設定一式を読む。
 * 1リクエスト内で複数回呼ばれても問い合わせは1回で済ませる。
 */
export const fetchAiModelSettings = cache(async (): Promise<AiModelSettingSet> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return DEFAULT_AI_MODEL_SETTINGS;

  try {
    const client = createServiceClient<DatabaseWithExtensions>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from(AI_MODEL_SETTINGS_TABLE)
      .select("use_case, model_id, reasoning_effort")
      .in("use_case", AI_USE_CASES as string[]);

    if (error) return DEFAULT_AI_MODEL_SETTINGS;
    return normalizeAiModelSettings(data);
  } catch {
    return DEFAULT_AI_MODEL_SETTINGS;
  }
});

/** その場面で実際に使うモデルを解決する */
export async function resolveAiModelFor(useCase: AiUseCase): Promise<ResolvedAiModel> {
  const settings = await fetchAiModelSettings();
  return resolveAiModelChoice(settings[useCase], useCase);
}
