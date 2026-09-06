/**
 * AIに送るプロンプト文の集約点。
 * 文面を直すときはこのディレクトリの README.md を先に読む。
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
