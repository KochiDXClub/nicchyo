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
 * 使っていて、失敗時の返し方もルートごとに違うため、ここでは解釈しない。
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
export function requestChatCompletion(
  apiKey: string,
  model: ResolvedAiModel,
  params: ChatCompletionParams
): Promise<Response> {
  return fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify(buildChatCompletionBody(model, params)),
  });
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
