/**
 * 相談の掛け合い構成と、出力フォーマットの指示
 *
 * `buildGrandmaAiSystemPrompt()` の末尾（毎回変わる部分）に差し込まれる。
 */
import type { ConsultCharacter } from "@/app/(public)/consult/data/consultCharacters";
import type { ConversationPattern } from "../types";

/** 運営調整可: 2キャラの掛け合いの型。話の運び方を決めている */
export const CONSULT_CONVERSATION_PATTERNS: ConversationPattern[] = [
  {
    id: "pattern1",
    instruction:
      "構成1: キャラ1が回答し、キャラ2がそこから自然に出てくる疑問を投げ、キャラ1が補足し、最後にキャラ2が納得と感想で締める。",
    turnCount: 4,
  },
  {
    id: "pattern2",
    instruction:
      "構成2: キャラ1が回答し、キャラ2が別視点の答えを足し、キャラ1が共感し、最後にキャラ2がユーザーへやさしく声を掛ける。",
    turnCount: 4,
  },
  {
    id: "pattern3",
    instruction:
      "構成3: キャラ1が回答し、キャラ2がやさしく反対側の意見や注意点を述べ、キャラ1が納得し、最後にキャラ2が整理して締める。",
    turnCount: 4,
  },
  {
    id: "pattern4",
    instruction:
      "構成4: キャラ1が回答し、キャラ2が共感し、キャラ1が新たな意見を足し、最後にキャラ2がキャラ1とユーザーの両方を受けてまとめる。",
    turnCount: 4,
  },
];

/** 運営調整可: 4キャラ全員が登場するときの構成（5%の全員会話） */
export const ALL_CAST_CONVERSATION_PATTERN: ConversationPattern = {
  id: "all_cast",
  instruction:
    "全員会話: 選ばれた全員が1発話ずつ話し、前の発話を軽く受けながらそれぞれの言い方で答える。",
  turnCount: 4,
};

export function buildConversationPatternPrompt(
  characters: ConsultCharacter[],
  pattern: ConversationPattern
) {
  const speakerOrder =
    characters.length >= 4
      ? characters.map((character) => character.name).join(" → ")
      : `${characters[0]?.name} → ${characters[1]?.name} → ${characters[0]?.name} → ${characters[1]?.name}`;
  return [
    pattern.instruction,
    `発話数は必ず${pattern.turnCount}つ。`,
    `発話順は必ず ${speakerOrder}。`,
  ].join("\n");
}

/**
 * コード契約: 変えるとアプリが壊れる。管理画面から編集できるようにしてはいけない。
 *
 * ここで指示している行フォーマット（TURN / SHOP_IDS / IMAGE_URL / FOLLOW_UP / SUMMARY / END）を
 * `parseStreamingConsultOutput()` がそのまま解釈する。両方を同時に直すこと。
 */
export function buildStreamingFormatPrompt(
  characters: ConsultCharacter[],
  pattern: ConversationPattern
) {
  const speakerMap = characters.map((character) => `${character.id}=${character.name}`).join(", ");
  return [
    "出力は必ずプレーンテキストのみ。JSON、Markdown、前置きは禁止。",
    `TURN 行を必ず ${pattern.turnCount} 行、最初に出力する。`,
    `TURN 行の形式は TURN|speakerId|speakerName|text。speakerId は ${speakerMap} のいずれかを使う。`,
    "text には改行を入れない。speakerName は対応する表示名を使う。",
    "TURN 行の後に、次の行をこの順番で必ず1行ずつ出力する。",
    "SHOP_IDS|1,2,3",
    "IMAGE_URL|https://... または null",
    "FOLLOW_UP|次にユーザーへ聞く質問",
    "SUMMARY|会話の要約",
    "END",
    "候補がない時は SHOP_IDS| とする。画像がない時は IMAGE_URL|null とする。",
    "余計な説明は絶対に足さない。",
  ].join("\n");
}
