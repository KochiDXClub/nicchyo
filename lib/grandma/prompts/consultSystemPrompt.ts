/**
 * 相談（にちよさん）のシステムプロンプトの組み立て
 *
 * 文面そのものは consultRules.ts にある（循環参照を避けるため分けている）。
 */
import type { ConsultCharacter } from "@/app/(public)/consult/data/consultCharacters";
import { DEFAULT_AI_PROMPTS, type AiPromptSet } from "./promptKeys";
import {
  CONSULT_CAST_HEADER,
  CONSULT_INTRO,
  CONSULT_OPERATOR_NOTE_HEADER,
  CONSULT_OUTPUT_RULES,
} from "./consultRules";

// 文面は consultRules.ts が本体。ここから読めた方が呼び出し側が楽なので再エクスポートする
export {
  CONSULT_INTRO,
  CONSULT_CONVERSATION_RULES,
  CONSULT_CONTENT_RULES,
  CONSULT_OUTPUT_RULES,
  CONSULT_CAST_HEADER,
  CONSULT_OPERATOR_NOTE_HEADER,
} from "./consultRules";

function buildCastBlock(characters: ConsultCharacter[], prompts: AiPromptSet): string {
  return characters
    .map((character) => {
      return [
        `- id: ${character.id}`,
        `  name: ${character.name}`,
        `  personality: ${prompts[`consult.character.${character.id}.personality`]}`,
        `  speech_style: ${prompts[`consult.character.${character.id}.speech_style`]}`,
      ].join("\n");
    })
    .join("\n");
}

/**
 * 相談のシステムプロンプトを組み立てる。
 *
 * 並び順に意味がある。
 *
 *   [固定]  イントロ → 出力ルール          … 全リクエスト共通。プロンプトキャッシュの対象
 *   ---
 *   [可変]  会話ルール → 内容ルール →
 *           今週のメモ → キャラ → 会話構成  … 運営が編集する / 毎回変わる
 *
 * 会話ルールと内容ルールは運営がDBから編集するので、固定部分に置くと
 * 編集のたびに共通プレフィックスが変わってキャッシュが効かなくなる。
 * **DB由来の文を `---` より前に動かさないこと。**
 *
 * `prompts` を省略するとコード側の既定値で組み立てる。DBが読めなくても
 * 相談機能そのものは動き続ける。
 */
export function buildGrandmaAiSystemPrompt(
  characters: ConsultCharacter[],
  conversationPattern: string,
  prompts: AiPromptSet = DEFAULT_AI_PROMPTS
): string {
  const operatorNote = prompts["consult.operator_note"].trim();

  return [
    // ここから固定文（プロンプトキャッシュの対象）
    CONSULT_INTRO,
    CONSULT_OUTPUT_RULES,
    "---",
    // ここから可変。前方に動かさないこと
    prompts["consult.conversation_rules"],
    prompts["consult.content_rules"],
    ...(operatorNote ? [`${CONSULT_OPERATOR_NOTE_HEADER}\n${operatorNote}`] : []),
    `${CONSULT_CAST_HEADER}\n\n${buildCastBlock(characters, prompts)}`,
    `今回の会話構成:\n${conversationPattern}`,
  ].join("\n\n");
}
