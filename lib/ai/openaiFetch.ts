/**
 * OpenAI API への呼び出し口
 *
 * `fetch("https://api.openai.com/...")` を各ルートに直接書かないこと。
 *
 * これを分けている理由は、書く量が減るからではなく **入れ場所を1つにするため**。
 * エンドポイント・認証ヘッダ・埋め込みモデル名がルートごとに散らばっていると、
 * 「今月AIにいくら使ったか」を数える、月次の上限で止める、といった話が出たときに
 * 手を入れる場所が呼び出しの数だけ増える。実際この整理の前は6ファイル9箇所に
 * 散らばっていて、どこか1つ直し忘れれば計上が漏れる状態だった。
 *
 * Chat Completions は buildChatCompletionBody() をこの中で呼ぶので、呼び出し側は
 * ChatCompletionParams をそのまま渡せばよい。モデルごとのパラメータの差
 * （`max_tokens` と `max_completion_tokens`、temperature の可否、推論ぶんの余白）は
 * 今までどおり lib/ai/models.ts が吸収する。
 *
 * 戻り値は Response のまま返す。ストリーミングは `.body` を、それ以外は `.json()` を
 * 使っていて、失敗時の返し方もルートごとに違うため、成功時の中身は解釈しない。
 * 失敗時だけは中身をログに残し、`model_not_found` なら既定モデルで1回だけやり直す
 * （requestChatCompletion のコメントを参照）。
 */

import { buildChatCompletionBody, type ChatCompletionParams, type ResolvedAiModel } from "./models";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

/** 埋め込みに使うモデル。4箇所で同じ値を書いていたのでここに集約する */
export const EMBEDDING_MODEL = "text-embedding-3-small";

function jsonHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Chat Completions を叩く。
 *
 * `model` は resolveAiModelFor(useCase) で解決したものを渡す。
 * ボディの組み立てはここで行うので、呼び出し側が `model` や `max_tokens` を
 * 直接書くことはない。
 */
export async function requestChatCompletion(
  apiKey: string,
  model: ResolvedAiModel,
  params: ChatCompletionParams
): Promise<Response> {
  const res = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify(buildChatCompletionBody(model, params)),
  });
  if (res.ok) return res;

  // 失敗の中身はここで必ずログに残す。呼び出し側は `.ok` しか見ないので、
  // ここで読まないと「相談の送信に失敗しました」としか分からない
  const detail = await readOpenAiError(res);
  console.error(`[openai] chat completion failed: ${detail.summary}`, {
    model: model.def.id,
    reasoningEffort: model.reasoningEffort ?? null,
  });

  // 台帳には載っているが、APIキーの OpenAI プロジェクトで使用許可が出ていない
  // モデルは `model_not_found` で落ちる。管理画面で切り替えた直後に来訪者向けの
  // 機能が全部止まるより、既定モデルで答え続けるほうが被害が小さい
  if (detail.code === "model_not_found" && model.fallbackDef) {
    console.warn(
      `[openai] falling back to default model: ${model.def.id} -> ${model.fallbackDef.id}`
    );
    const retry = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: jsonHeaders(apiKey),
      body: JSON.stringify(buildChatCompletionBody({ def: model.fallbackDef }, params)),
    });
    if (!retry.ok) {
      // 逃げ先まで落ちたときに原因が追えないと「切り替えたら全滅した」しか分からない
      const retryDetail = await readOpenAiError(retry);
      console.error(`[openai] fallback also failed: ${retryDetail.summary}`, {
        model: model.fallbackDef.id,
      });
    }
    return retry;
  }

  return res;
}

export type OpenAiErrorDetail = {
  status: number;
  /** OpenAI の error.code（例: model_not_found）。無ければ null */
  code: string | null;
  /** OpenAI の error.message。無ければ本文の先頭 */
  message: string;
  /** ログ・管理画面向けの1行 */
  summary: string;
};

/**
 * 失敗レスポンスから OpenAI のエラー内容を取り出す。
 *
 * ボディは clone から読むので、呼び出し側は元の Response をそのまま扱える。
 */
export async function readOpenAiError(res: Response): Promise<OpenAiErrorDetail> {
  let code: string | null = null;
  let message = "";
  try {
    const text = await res.clone().text();
    try {
      const json = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } };
      code = typeof json.error?.code === "string" ? json.error.code : null;
      message = typeof json.error?.message === "string" ? json.error.message : "";
    } catch {
      message = text;
    }
  } catch {
    message = "";
  }
  message = message.trim().slice(0, 300);
  const summary = `HTTP ${res.status}${code ? ` ${code}` : ""}${message ? `: ${message}` : ""}`;
  return { status: res.status, code, message, summary };
}

/**
 * 埋め込みを作る。
 *
 * `input` は 1件でも複数件でもよい（OpenAI 側が両方受ける）。
 * 複数件をまとめて渡したときは、返ってくる順序が入力の順序と一致する。
 */
export function requestEmbeddings(
  apiKey: string,
  input: string | string[]
): Promise<Response> {
  return fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });
}
