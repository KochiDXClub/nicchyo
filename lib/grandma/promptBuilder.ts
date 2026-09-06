import {
  CONSULT_CHARACTER_BY_ID,
  type ConsultCharacter,
  type ConsultCharacterId,
} from "@/app/(public)/consult/data/consultCharacters";
import type { ConsultTurn } from "@/app/(public)/consult/types/consultConversation";
import type { ConversationPattern, StreamedConsultPayload } from "./types";
import {
  ALL_CAST_CONVERSATION_PATTERN,
  CONSULT_CONVERSATION_PATTERNS,
} from "./prompts/consultConversation";

// プロンプト文（会話構成・出力フォーマットの指示）は lib/grandma/prompts/ に集約した。
// このファイルにはスキーマ定義とレスポンスのパースだけを残す。

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
    return ALL_CAST_CONVERSATION_PATTERN;
  }
  const index = Math.floor(Math.random() * CONSULT_CONVERSATION_PATTERNS.length);
  return CONSULT_CONVERSATION_PATTERNS[index];
}

/**
 * `buildStreamingFormatPrompt()` が指示した行フォーマットを解釈する。
 * 片方だけ直すと相談が壊れるので、必ず両方を見比べること。
 */
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
