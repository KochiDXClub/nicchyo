import type { Shop } from "../../map/data/shops";
import type { ConsultCharacterId } from "../data/consultCharacters";

export type ConsultHistoryEntry = {
  role: "user" | "assistant";
  text: string;
  speakerId?: ConsultCharacterId | null;
  speakerName?: string | null;
};

export type ConsultTurn = {
  speakerId: ConsultCharacterId;
  speakerName: string;
  text: string;
};

export type ConsultErrorCode =
  | "system_error"
  | "insufficient_context"
  | "unsupported_request"
  | "no_result";

export type ConsultAskResponse = {
  reply: string;
  imageUrl?: string;
  shopIds?: number[];
  shops?: Shop[];
  turns?: ConsultTurn[];
  followUpQuestion?: string;
  memorySummary?: string;
  errorCode?: ConsultErrorCode;
  helperQuestions?: string[];
  errorMessage?: string;
  retryable?: boolean;
  consultId?: string;
  /**
   * OpenAI 側の失敗内容（例: `HTTP 400 model_not_found: ...`）。
   * 管理画面の対話テストからの内部呼び出しにだけ付く。来訪者には返さない
   */
  debugError?: string;
};

export type ConsultAskStreamEvent =
  | {
      type: "first_turn_start";
      speakerId: ConsultCharacterId;
      speakerName: string;
    }
  | {
      type: "first_turn_delta";
      delta: string;
    }
  | {
      type: "final";
      response: ConsultAskResponse;
    };
