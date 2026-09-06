/**
 * AIに送るプロンプト文の集約点。
 * 文面を直すときはこのディレクトリの README.md を先に読む。
 *
 * **promptStore.server.ts をここから再エクスポートしないこと。**
 * このバレルはクライアントコンポーネントからも読まれる。1行足すだけで
 * service role クライアントを読み込むモジュールが全てのクライアント import に
 * 連鎖する（`SUPABASE_SERVICE_ROLE_KEY` は NEXT_PUBLIC_ ではないので値は
 * 埋め込まれないが、依存を持ち込む理由がない）。
 * サーバー側は promptStore.server.ts を直接 import する。
 */
export {
  CONSULT_CHARACTER_PROMPT_PROFILES,
  type ConsultCharacterPromptProfile,
} from "./consultCharacterProfiles";
export {
  CONSULT_INTRO,
  CONSULT_CONVERSATION_RULES,
  CONSULT_CONTENT_RULES,
  CONSULT_OUTPUT_RULES,
  CONSULT_CAST_HEADER,
  buildGrandmaAiSystemPrompt,
} from "./consultSystemPrompt";
export {
  CONSULT_CONVERSATION_PATTERNS,
  ALL_CAST_CONVERSATION_PATTERN,
  buildConversationPatternPrompt,
  buildStreamingFormatPrompt,
} from "./consultConversation";
export {
  SHOP_CHAT_PERSONA_RULES,
  SHOP_CHAT_CLOSING_INSTRUCTION,
  buildShopChatSystemPrompt,
  type ShopChatContext,
} from "./shopChatPrompt";
export {
  ITINERARY_SYSTEM_PROMPT,
  ITINERARY_FORMAT_RULES,
  buildItineraryUserPrompt,
  stripAngleBrackets,
  type ItineraryPromptInput,
} from "./itineraryPrompt";
export {
  MAP_AGENT_SYSTEM_PROMPT,
  buildMapAgentPrompt,
  type MapAgentAnswers,
  type MapAgentCandidate,
} from "./mapAgentPrompt";
export {
  AI_PROMPT_DEFS,
  AI_PROMPT_DEF_BY_KEY,
  AI_PROMPT_KEYS,
  AI_PROMPT_CHARACTER_IDS,
  DEFAULT_AI_PROMPTS,
  isAiPromptKey,
  normalizeAiPrompts,
  validateAiPromptBody,
  type AiPromptValidationResult,
  type AiPromptDef,
  type AiPromptKey,
  type AiPromptSet,
} from "./promptKeys";
