/**
 * 場面ごとに使うAIモデルをサーバー側で解決する。
 *
 * 台帳（ai_models / ai_use_cases）は RLS ポリシーを作らず、anon / authenticated
 * から GRANT を剥がしてある。つまり service role 以外からは触れない。
 * 読めなければコード側の定義（CODE_AI_CATALOG）を返す。台帳が読めないことで
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
  CODE_AI_CATALOG,
  DEFAULT_AI_MODEL_SETTINGS,
  buildAiCatalog,
  normalizeAiModelSettings,
  resolveAiModelChoice,
  type AiCatalog,
  type AiModelSettingSet,
  type AiUseCase,
  type ResolvedAiModel,
} from "./models";

export const AI_MODELS_TABLE = "ai_models";
export const AI_USE_CASES_TABLE = "ai_use_cases";

export type AiRegistry = {
  catalog: AiCatalog;
  settings: AiModelSettingSet;
};

const CODE_REGISTRY: AiRegistry = {
  catalog: CODE_AI_CATALOG,
  settings: DEFAULT_AI_MODEL_SETTINGS,
};

/**
 * 台帳と現在の割り当てを読む。
 * 1リクエスト内で複数回呼ばれても問い合わせは1回で済ませる。
 */
export const fetchAiRegistry = cache(async (): Promise<AiRegistry> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return CODE_REGISTRY;

  try {
    const client = createServiceClient<DatabaseWithExtensions>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [modelsResult, useCasesResult] = await Promise.all([
      client
        .from(AI_MODELS_TABLE)
        .select(
          "id, label, description, token_param, supports_temperature, reasoning_efforts, reasoning_headroom_tokens, price_input_per_mtok, price_output_per_mtok, is_selectable, sort_order"
        )
        .eq("is_selectable", true)
        .order("sort_order", { ascending: true }),
      client
        .from(AI_USE_CASES_TABLE)
        .select("key, label, description, model_id, reasoning_effort, sort_order")
        .eq("is_enabled", true)
        .in("key", AI_USE_CASES as string[])
        .order("sort_order", { ascending: true }),
    ]);

    if (modelsResult.error || useCasesResult.error) return CODE_REGISTRY;

    const catalog = buildAiCatalog(modelsResult.data, useCasesResult.data);
    return { catalog, settings: normalizeAiModelSettings(catalog, useCasesResult.data) };
  } catch {
    return CODE_REGISTRY;
  }
});

/** その場面で実際に使うモデルを解決する */
export async function resolveAiModelFor(useCase: AiUseCase): Promise<ResolvedAiModel> {
  const { catalog, settings } = await fetchAiRegistry();
  return resolveAiModelChoice(catalog, settings[useCase], useCase);
}
