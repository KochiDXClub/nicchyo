/**
 * 管理画面で保存した会話設定をサーバー側で読む。
 *
 * ai_conversation_settings は RLS ポリシーを作らず、anon / authenticated から
 * GRANT を剥がしてある。つまり service role 以外からは触れない。
 * 読めなければコード側の既定値を返す。設定が読めないことで
 * 相談機能そのものが止まってはいけない。
 *
 * このファイルはサーバー専用。クライアントコンポーネントから import すると
 * 常に既定値が返るだけの無言の劣化になるので、lib/ai/conversationSettings.ts
 * からは再エクスポートしないこと
 * （lib/grandma/prompts/promptStore.server.ts と同じ方針）。
 */

import { cache } from "react";
import { createTypedAdminClient } from "@/lib/supabase/adminClient";
import {
  AI_CONVERSATION_SETTING_KEYS,
  DEFAULT_AI_CONVERSATION_SETTINGS,
  normalizeAiConversationSettings,
  type AiConversationSettings,
} from "./conversationSettings";

export const AI_CONVERSATION_SETTINGS_TABLE = "ai_conversation_settings";

/**
 * 会話設定一式を読む。
 * 1リクエスト内で複数回呼ばれても問い合わせは1回で済ませる。
 */
export const fetchAiConversationSettings = cache(async (): Promise<AiConversationSettings> => {
  try {
    const client = createTypedAdminClient();
    if (!client) return DEFAULT_AI_CONVERSATION_SETTINGS;
    const { data, error } = await client
      .from(AI_CONVERSATION_SETTINGS_TABLE)
      .select("key, value")
      .in("key", AI_CONVERSATION_SETTING_KEYS as string[]);

    if (error) return DEFAULT_AI_CONVERSATION_SETTINGS;
    return normalizeAiConversationSettings(data);
  } catch {
    return DEFAULT_AI_CONVERSATION_SETTINGS;
  }
});
