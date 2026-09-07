/**
 * 場面ごとに使うAIモデルをサーバー側で解決する。
 *
 * 読み取り口をここに1つだけ作っておき、API ルートは
 * `await resolveAiModelFor("consult")` だけを見る。管理画面から保存した値を
 * 使うようにするのは後続PR（ai_model_settings テーブルの追加）で、
 * そのときもこのファイルの中だけが変わり、呼び出し側は触らずに済む。
 *
 * このファイルはサーバー専用。クライアントコンポーネントから import すると
 * 常に既定値が返るだけの無言の劣化になるので、lib/ai/models.ts のような
 * 共有モジュールからは再エクスポートしないこと
 * （lib/grandma/prompts/promptStore.server.ts と同じ方針）。
 */

import { cache } from "react";
import {
  DEFAULT_AI_MODEL_SETTINGS,
  resolveAiModelChoice,
  type AiModelSettingSet,
  type AiUseCase,
  type ResolvedAiModel,
} from "./models";

/**
 * 有効なモデル設定一式を読む。
 * 1リクエスト内で複数回呼ばれても解決は1回で済ませる。
 */
export const fetchAiModelSettings = cache(async (): Promise<AiModelSettingSet> => {
  return DEFAULT_AI_MODEL_SETTINGS;
});

/** その場面で実際に使うモデルを解決する */
export async function resolveAiModelFor(useCase: AiUseCase): Promise<ResolvedAiModel> {
  const settings = await fetchAiModelSettings();
  return resolveAiModelChoice(settings[useCase], useCase);
}
