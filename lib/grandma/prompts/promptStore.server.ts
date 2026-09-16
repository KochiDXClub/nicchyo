/**
 * 管理画面で保存したプロンプトをサーバー側で読む。
 *
 * ai_prompts は RLS ポリシーを作らず、anon / authenticated から GRANT を
 * 剥がしてある。つまり service role 以外からは触れない。
 * 読めなければコード側の既定値を返す。プロンプトが読めないことで
 * 相談機能そのものが止まってはいけない。
 *
 * このファイルはサーバー専用。クライアントコンポーネントから import すると
 * 常に既定値が返るだけの無言の劣化になるので、lib/grandma/prompts/index.ts
 * からは再エクスポートしないこと。
 */

import { cache } from "react";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import {
  AI_PROMPT_KEYS,
  DEFAULT_AI_PROMPTS,
  normalizeAiPrompts,
  type AiPromptSet,
} from "./promptKeys";

export const AI_PROMPTS_TABLE = "ai_prompts";

/**
 * アクティブなプロンプト一式を読む。
 * 1リクエスト内で複数回呼ばれても問い合わせは1回で済ませる。
 */
export const fetchAiPrompts = cache(async (): Promise<AiPromptSet> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return DEFAULT_AI_PROMPTS;

  try {
    const client = createServiceClient<DatabaseWithExtensions>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from(AI_PROMPTS_TABLE)
      .select("key, body")
      .eq("is_active", true)
      .in("key", AI_PROMPT_KEYS as string[]);

    if (error) return DEFAULT_AI_PROMPTS;
    return normalizeAiPrompts(data);
  } catch {
    return DEFAULT_AI_PROMPTS;
  }
});
