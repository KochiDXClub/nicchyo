import type { ConsultCharacter, ConsultCharacterId } from "@/app/(public)/consult/data/consultCharacters";
import type {
  ConsultAskResponse,
  ConsultErrorCode,
  ConsultHistoryEntry,
  ConsultTurn,
} from "@/app/(public)/consult/types/consultConversation";
import type { Shop } from "@/app/(public)/map/data/shops";

export const MARKET_CENTER = { lat: 33.565, lng: 133.531 };
export const ON_SITE_RADIUS_KM = 0.5;

const CHOME_VALUES = new Set([
  "一丁目",
  "二丁目",
  "三丁目",
  "四丁目",
  "五丁目",
  "六丁目",
  "七丁目",
]);

export function normalizeChome(value: string | null): Shop["chome"] {
  if (value && CHOME_VALUES.has(value)) {
    return value as Shop["chome"];
  }
  return undefined;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function classifyLocationType(
  location: { lat: number; lng: number } | null | undefined
): "pre_visit" | "on_site" | "unknown" {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return "unknown";
  }
  return haversineKm(location, MARKET_CENTER) <= ON_SITE_RADIUS_KM
    ? "on_site"
    : "pre_visit";
}

export function classifyIntent(question: string): string {
  if (/人気|売れ|ランキング|売れ筋/.test(question)) return "人気商品";
  if (/味|美味|うまい|おいし|甘|辛|酸っ|塩/.test(question)) return "味";
  if (/行列|混|待ち|並ぶ|並び/.test(question)) return "行列";
  if (/何時|営業|開店|閉店|時間|朝|終わ/.test(question)) return "営業時間";
  if (/おすすめ|オススメ|いい|良い/.test(question)) return "おすすめ";
  return "その他";
}

export function extractKeywords(question: string): string[] {
  const stopwords =
    /^(は|が|を|に|で|と|も|の|て|だ|な|や|か|から|まで|より|けど|ので|って|ね|よ|し|ている|てる|です|ます|ない|ある|いる|する|した|して|できる|ください|教え|知り|たい)$/;
  const tokens = question
    .replace(/[、。！？,\s]/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopwords.test(token));
  return [...new Set(tokens)].slice(0, 6);
}

export function sanitizeLikeKeyword(value: string) {
  return value.replace(/[%_,]/g, "").trim();
}

export function isShopRelatedQuestion(normalized: string): boolean {
  return /お店|おすすめ|人気|売って|買い|食べ|飲み|野菜|果物|惣菜|お土産|アクセサリー|雑貨|道具|工具|植物|苗|花|ハンドメイド|工芸|ランチ|朝ごはん|おやつ|スイーツ|食材|食べ物/.test(
    normalized
  );
}

export function isSeasonalQuestion(normalized: string) {
  return /季節|旬|今の時期|今の季節|春|夏|秋|冬/.test(normalized);
}

export function getCurrentSeasonInfo(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return { seasonId: 0, seasonName: "春ー夏" };
  }
  if (month >= 6 && month <= 8) {
    return { seasonId: 1, seasonName: "夏ー秋" };
  }
  if (month >= 9 && month <= 11) {
    return { seasonId: 2, seasonName: "秋ー冬" };
  }
  return { seasonId: 3, seasonName: "冬ー春" };
}

export function isUnsupportedQuestion(normalized: string) {
  return /違法|犯罪|爆弾|殺|死ね|個人情報|住所を教え|電話番号|パスワード|ハッキング|詐欺/.test(
    normalized
  );
}

export function getErrorSpeaker(
  errorCode: ConsultErrorCode,
  characters: ConsultCharacter[]
): ConsultCharacter {
  const preferredIdByError: Record<ConsultErrorCode, ConsultCharacterId> = {
    system_error: "nichiyosan",
    insufficient_context: "nichiyosan",
    unsupported_request: "nichiyosan",
    no_result: "yosakochan",
  };
  return (
    characters.find((character) => character.id === preferredIdByError[errorCode]) ??
    characters[0]
  );
}

export function getHelperQuestions(errorCode: ConsultErrorCode): string[] {
  switch (errorCode) {
    case "insufficient_context":
      return [
        "旬の食べものを探してるんだけど、おすすめある？",
        "おみやげ向きのお店を教えて",
      ];
    case "unsupported_request":
      return [
        "日曜市の回り方を教えて",
        "今の季節におすすめの食材はある？",
      ];
    case "no_result":
      return [
        "近い条件でおすすめを教えて",
        "ジャンルを変えるなら何がおすすめ？",
      ];
    default:
      return [];
  }
}

export function buildErrorResponse(
  errorCode: ConsultErrorCode,
  characters: ConsultCharacter[],
  message: string,
  options?: {
    retryable?: boolean;
    errorMessage?: string;
    memorySummary?: string;
  }
): ConsultAskResponse {
  const speaker = getErrorSpeaker(errorCode, characters);
  const turns: ConsultTurn[] = [
    {
      speakerId: speaker.id,
      speakerName: speaker.name,
      text: message,
    },
  ];

  return {
    reply: `${speaker.name}: ${message}`,
    turns,
    errorCode,
    helperQuestions: getHelperQuestions(errorCode),
    memorySummary: options?.memorySummary,
    retryable: options?.retryable ?? false,
    errorMessage: options?.errorMessage ?? message,
  };
}

export function buildHistoryContext(history: ConsultHistoryEntry[], memorySummary: string) {
  const recentHistory = history.slice(-6);
  const historyBlock =
    recentHistory.length > 0
      ? recentHistory
          .map((entry) => {
            const speaker =
              entry.role === "assistant"
                ? entry.speakerName || entry.speakerId || "assistant"
                : "user";
            return `${speaker}: ${entry.text}`;
          })
          .join("\n")
      : "なし";

  return [
    `会話メモ: ${memorySummary || "まだ特記事項なし"}`,
    `直近の会話:\n${historyBlock}`,
  ].join("\n");
}

export function isValidFollowUpQuestion(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 8 || trimmed.length > 40) return false;
  if (!/[？?]$/.test(trimmed)) return false;
  if (/(してみる|どうかな|どう？|気になる|行ってみる)/.test(trimmed)) return false;
  return true;
}

/** AI応答に含まれる `SHOP_IDS: 1,2,3` ディレクティブを表示用テキストから取り除く */
export function stripShopIdsDirective(text: string): string {
  return text.replace(/SHOP_IDS:\s*([0-9,\s]+)/i, "").trim();
}

export function buildFallbackFollowUpQuestion(
  question: string,
  targetShopName: string | null,
  shopCount: number
) {
  if (targetShopName) {
    return `${targetShopName}でいちばん人気の商品は？`;
  }
  if (/(季節|旬|食材|野菜|果物)/.test(question)) {
    return "今の季節なら何を最初に見ればいい？";
  }
  if (shopCount > 0) {
    return "この中でいちばん人気のお店は？";
  }
  return "はじめて行くならどこから回るのがおすすめ？";
}
