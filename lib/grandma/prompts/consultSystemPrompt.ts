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
  CONSULT_ANSWER_RULES,
} from "./consultRules";

// 文面は consultRules.ts が本体。ここから読めた方が呼び出し側が楽なので再エクスポートする
export {
  CONSULT_INTRO,
  CONSULT_CONVERSATION_RULES,
  CONSULT_CONTENT_RULES,
  CONSULT_ANSWER_RULES,
  CONSULT_CAST_HEADER,
  CONSULT_OPERATOR_NOTE_HEADER,
} from "./consultRules";

/**
 * 話し手の定義ブロックを組み立てる。
 *
 * profile は運営が複数行で書けるので、続きの行を字下げして本文にぶら下げる。
 * 字下げしないと、2行目以降が別のキャラの定義や別の指示として読める。
 */
function buildCastBlock(characters: ConsultCharacter[], prompts: AiPromptSet): string {
  return characters
    .map((character) => {
      const profile = prompts[`consult.character.${character.id}.profile`]
        .split("\n")
        .map((line) => `    ${line.trim()}`)
        .join("\n");
      return [`- id: ${character.id}`, `  name: ${character.name}`, "  profile:", profile].join(
        "\n"
      );
    })
    .join("\n");
}

/**
 * 相談のシステムプロンプトを組み立てる。
 *
 * 並び順に意味がある。
 *
 *   [固定]  イントロ → 返答の作り方        … 全リクエスト共通。プロンプトキャッシュの対象
 *   ---
 *   [可変]  会話ルール → 内容ルール →
 *           今週のメモ → 話し手 → 追加指示  … 運営が編集する / 毎回変わる
 *
 * 追加指示（tailPrompt）は、出力形式の指示など、コード側がリクエストごとに
 * 組み立てる文。空なら何も足さない。
 *
 * ★ 出力形式（JSON / プレーンテキスト）は経路ごとに違うので、必ず tailPrompt で
 *   渡す。固定部分に書くと、ストリーミング時に「JSONのみ」と
 *   「プレーンテキストのみ」が同居してモデルがどちらに従うか決まらなくなる。
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
  tailPrompt: string,
  prompts: AiPromptSet = DEFAULT_AI_PROMPTS
): string {
  const operatorNote = prompts["consult.operator_note"].trim();

  return [
    // ここから固定文（プロンプトキャッシュの対象）
    CONSULT_INTRO,
    CONSULT_ANSWER_RULES,
    "---",
    // ここから可変。前方に動かさないこと
    prompts["consult.conversation_rules"],
    prompts["consult.content_rules"],
    ...(operatorNote ? [`${CONSULT_OPERATOR_NOTE_HEADER}\n${operatorNote}`] : []),
    `${CONSULT_CAST_HEADER}\n\n${buildCastBlock(characters, prompts)}`,
    ...(tailPrompt.trim() ? [tailPrompt] : []),
  ].join("\n\n");
}
