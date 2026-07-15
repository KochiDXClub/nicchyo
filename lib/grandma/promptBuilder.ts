import {
  CONSULT_CHARACTER_BY_ID,
  type ConsultCharacter,
  type ConsultCharacterId,
} from "@/app/(public)/consult/data/consultCharacters";
import type { ConsultTurn } from "@/app/(public)/consult/types/consultConversation";
import type { ConversationPattern, StreamedConsultPayload } from "./types";

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

export function buildResponseSchema(characters: ConsultCharacter[], pattern: ConversationPattern) {
  return {
    type: "json_schema",
    json_schema: {
      name: "consult_duet_response",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          turns: {
            type: "array",
            minItems: pattern.turnCount,
            maxItems: pattern.turnCount,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                speakerId: {
                  type: "string",
                  enum: characters.map((character) => character.id),
                },
                text: { type: "string" },
              },
              required: ["speakerId", "text"],
            },
          },
          shopIds: {
            type: "array",
            maxItems: 3,
            items: { type: "number" },
          },
          imageUrl: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          followUpQuestion: { type: "string" },
        },
        required: ["summary", "turns", "shopIds", "imageUrl", "followUpQuestion"],
      },
    },
  } as const;
}

export function pickConversationPattern(characters: ConsultCharacter[]): ConversationPattern {
  if (characters.length >= 4) {
    return {
      id: "all_cast",
      instruction:
        "全員会話: 選ばれた全員が1発話ずつ話し、前の発話を軽く受けながらそれぞれの言い方で答える。",
      turnCount: 4,
    };
  }
  const index = Math.floor(Math.random() * CONSULT_CONVERSATION_PATTERNS.length);
  return CONSULT_CONVERSATION_PATTERNS[index];
}

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

export function parseStreamingConsultOutput(
  rawOutput: string,
  selectedCharacters: ConsultCharacter[]
): StreamedConsultPayload {
  const turns: ConsultTurn[] = [];
  let shopIds: number[] = [];
  let imageUrl: string | null = null;
  let followUpQuestion = "";
  let summary = "";

  // モデルが TURN| ブロック間の改行を省略し、1行に連結して返すことがあるため、
  // 改行の直後でない TURN| の手前に強制的に改行を入れてから分割する。
  const normalizedOutput = rawOutput.replace(/([^\n])TURN\|/g, "$1\nTURN|");

  const lines = normalizedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line === "END") continue;
    if (line.startsWith("TURN|")) {
      const parts = line.split("|");
      // 本来は TURN|id|name|text の4分割だが、モデルが name を省略して
      // TURN|id|text の3分割で返すことがあるため両方に対応する。
      if (parts.length < 3) continue;
      const requestedSpeakerId = parts[1].trim() as ConsultCharacterId;
      const matchedCharacter =
        CONSULT_CHARACTER_BY_ID.get(requestedSpeakerId) ??
        selectedCharacters.find((character) => character.id === requestedSpeakerId) ??
        selectedCharacters[turns.length % Math.max(selectedCharacters.length, 1)];
      if (!matchedCharacter) continue;
      const hasName = parts.length >= 4;
      const text = (hasName ? parts.slice(3) : parts.slice(2)).join("|").trim();
      if (!text) continue;
      turns.push({
        speakerId: matchedCharacter.id,
        speakerName: (hasName ? parts[2].trim() : "") || matchedCharacter.name,
        text,
      });
      continue;
    }
    if (line.startsWith("SHOP_IDS|")) {
      shopIds = line
        .slice("SHOP_IDS|".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0);
      continue;
    }
    if (line.startsWith("IMAGE_URL|")) {
      const value = line.slice("IMAGE_URL|".length).trim();
      imageUrl = !value || /^null$/i.test(value) ? null : value;
      continue;
    }
    if (line.startsWith("FOLLOW_UP|")) {
      followUpQuestion = line.slice("FOLLOW_UP|".length).trim();
      continue;
    }
    if (line.startsWith("SUMMARY|")) {
      summary = line.slice("SUMMARY|".length).trim();
    }
  }

  if (turns.length === 0) {
    const fallbackText = rawOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !/^(TURN|SHOP_IDS|IMAGE_URL|FOLLOW_UP|SUMMARY)\|/.test(line) &&
          line !== "END"
      )
      .join("\n")
      .trim();
    const fallbackSpeaker = selectedCharacters[0];
    if (fallbackText && fallbackSpeaker) {
      turns.push({
        speakerId: fallbackSpeaker.id,
        speakerName: fallbackSpeaker.name,
        text: fallbackText,
      });
    }
  }

  return {
    summary,
    turns,
    shopIds,
    imageUrl,
    followUpQuestion,
  };
}

export function buildReplyFromTurns(turns: ConsultTurn[]) {
  return turns.map((turn) => `${turn.speakerName}: ${turn.text}`).join("\n");
}
