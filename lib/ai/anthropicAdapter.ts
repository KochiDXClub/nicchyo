/**
 * Anthropic（Claude）を、OpenAI の Chat Completions と同じ形で呼ぶための変換層
 *
 * 呼び出し側（相談・店舗チャット・回り方プラン・出店者ヘルプ・LINE）は
 * OpenAI の形式のリクエストを作り、OpenAI の形式のレスポンスを読んでいる
 * （`choices[0].message.content`、SSE の `choices[0].delta.content`、関数呼び出しの断片）。
 * モデルを台帳で切り替えられるようにするため、その形を保ったまま Claude を呼ぶ。
 * 呼び出し側は提供元を知らなくてよい。
 *
 * ここでやっていること:
 *   - リクエスト: system を分け、tools / 出力上限を Messages API の形に直す
 *   - レスポンス: Message / ストリームのイベントを OpenAI の形に直す
 *   - 失敗: OpenAI と同じ `{ error: { code, message } }` の Response にする
 *     （readOpenAiError と、`model_not_found` での既定モデルへの切り替えがそのまま効く）
 *
 * 固定している設定:
 *   - thinking は `disabled`。相談は待ち時間がそのまま体験になるので、考え込ませない
 *   - temperature は送らない（Haiku 5.5 は既定値以外を 400 で拒否する）
 *   - assistant の prefill は使わない（400 になる）
 */

import Anthropic from "@anthropic-ai/sdk";

/** 呼び出し側が出力上限を指定しなかったときの値。Messages API は max_tokens が必須 */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 2048;

export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY";

type OpenAiMessage = { role?: unknown; content?: unknown };
type OpenAiTool = { function?: { name?: unknown; description?: unknown; parameters?: unknown } };

/** response_format（json_schema）の中身を、プロンプトに書き足す文にする */
function describeJsonSchema(responseFormat: unknown): string | null {
  const schema = (responseFormat as { json_schema?: { schema?: unknown } } | undefined)?.json_schema
    ?.schema;
  if (!schema) return null;
  return [
    "返事は次の JSON Schema に従う JSON オブジェクト1つだけにしてください。",
    "前後に説明文・コードブロック・余計な文字を付けないでください。",
    JSON.stringify(schema),
  ].join("\n");
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
      .join("");
  }
  return "";
}

type ImageMediaType = Anthropic.Base64ImageSource["media_type"];
const IMAGE_MEDIA_TYPES: readonly ImageMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** OpenAI の image_url（data URL か https の URL）を Messages API の画像ブロックにする。読めない形は null */
function toImageBlock(part: unknown): Anthropic.ImageBlockParam | null {
  const url = (part as { image_url?: { url?: unknown } } | null)?.image_url?.url;
  if (typeof url !== "string") return null;
  const dataUrl = url.match(/^data:([^;,]+);base64,(.+)$/);
  if (dataUrl) {
    const mediaType = dataUrl[1] as ImageMediaType;
    if (!IMAGE_MEDIA_TYPES.includes(mediaType)) return null;
    return { type: "image", source: { type: "base64", media_type: mediaType, data: dataUrl[2] } };
  }
  if (/^https:\/\//.test(url)) return { type: "image", source: { type: "url", url } };
  return null;
}

/**
 * user の発言の中身を Messages API の形にする。
 * 相談の写真（OpenAI の image_url）は画像ブロックに直して渡す。画像が無ければ文字列のまま
 */
function userContentOf(content: unknown): string | Anthropic.ContentBlockParam[] {
  if (!Array.isArray(content)) return textOf(content);
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const part of content) {
    const type = (part as { type?: unknown } | null)?.type;
    if (type === "image_url") {
      const image = toImageBlock(part);
      if (image) blocks.push(image);
    } else {
      const text = textOf([part]);
      if (text) blocks.push({ type: "text", text });
    }
  }
  if (!blocks.some((block) => block.type === "image")) return textOf(content);
  return blocks;
}

/**
 * buildChatCompletionBody が作った OpenAI 形式のボディを Messages API のパラメータに直す。
 * 出力上限は `max_tokens`（Anthropic のモデルは tokenParam が max_tokens）
 */
export function toAnthropicParams(body: Record<string, unknown>): Anthropic.MessageCreateParams {
  const messages = Array.isArray(body.messages) ? (body.messages as OpenAiMessage[]) : [];

  const systemParts: string[] = [];
  const turns: Anthropic.MessageParam[] = [];
  for (const message of messages) {
    const text = textOf(message.content);
    if (message.role === "system") {
      if (text) systemParts.push(text);
    } else if (message.role === "user") {
      const content = userContentOf(message.content);
      // 空の文字列は Messages API が 400 にする
      if (typeof content !== "string" || content) turns.push({ role: "user", content });
    } else if (message.role === "assistant") {
      if (text) turns.push({ role: "assistant", content: text });
    }
  }
  const schemaNote = describeJsonSchema(body.response_format);
  if (schemaNote) systemParts.push(schemaNote);

  const tools = Array.isArray(body.tools)
    ? (body.tools as OpenAiTool[])
        .filter((tool) => typeof tool.function?.name === "string")
        .map(
          (tool): Anthropic.Tool => ({
            name: tool.function!.name as string,
            description: typeof tool.function!.description === "string" ? tool.function!.description : undefined,
            input_schema: (tool.function!.parameters as Anthropic.Tool.InputSchema) ?? {
              type: "object",
              properties: {},
            },
          })
        )
    : [];

  const maxTokens =
    typeof body.max_tokens === "number" && body.max_tokens > 0
      ? body.max_tokens
      : ANTHROPIC_DEFAULT_MAX_TOKENS;

  return {
    model: String(body.model),
    max_tokens: maxTokens,
    messages: turns,
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    thinking: { type: "disabled" },
    ...(tools.length > 0
      ? {
          tools,
          // 一度に呼ぶ関数は1つだけ（OpenAI 側の parallel_tool_calls: false と同じ）
          tool_choice: { type: "auto", disable_parallel_tool_use: true },
        }
      : {}),
  };
}

/** Anthropic の stop_reason を OpenAI の finish_reason にする */
function toFinishReason(stopReason: string | null | undefined): string {
  if (stopReason === "max_tokens") return "length";
  if (stopReason === "tool_use") return "tool_calls";
  if (stopReason === "refusal") return "content_filter";
  return "stop";
}

/** JSON を求めたのにコードブロックで包んで返したとき、中身だけを取り出す */
export function stripJsonFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return match ? match[1] : text;
}

/** Messages API の応答を、OpenAI の Chat Completions の応答の形に直す */
export function toOpenAiCompletion(message: Anthropic.Message, expectJson: boolean) {
  let text = "";
  const toolCalls: { id: string; type: "function"; function: { name: string; arguments: string } }[] = [];
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
    else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }
  return {
    id: message.id,
    model: message.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: expectJson ? stripJsonFence(text) : text,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toFinishReason(message.stop_reason),
      },
    ],
    usage: {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    },
  };
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache",
} as const;

/** ストリームのイベントを OpenAI の SSE（`data: {...}` の行）に直して流す */
export function toOpenAiSseStream(
  events: AsyncIterable<Anthropic.MessageStreamEvent>,
  onCancel?: () => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  let cancelled = false;

  const send = (controller: ReadableStreamDefaultController<Uint8Array>, delta: unknown, finish: string | null = null) => {
    const chunk = { choices: [{ index: 0, delta, finish_reason: finish }] };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // 関数呼び出しは「何番目の関数か」で断片をつなぐ。Anthropic のブロック番号とは別に数える
      const toolIndexByBlock = new Map<number, number>();
      let stopReason: string | null = null;
      try {
        while (true) {
          const { done, value: event } = await iterator.next();
          if (done || cancelled) break;
          if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            const toolIndex = toolIndexByBlock.size;
            toolIndexByBlock.set(event.index, toolIndex);
            send(controller, {
              tool_calls: [
                {
                  index: toolIndex,
                  id: event.content_block.id,
                  type: "function",
                  function: { name: event.content_block.name, arguments: "" },
                },
              ],
            });
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              send(controller, { content: event.delta.text });
            } else if (event.delta.type === "input_json_delta") {
              const toolIndex = toolIndexByBlock.get(event.index);
              if (toolIndex !== undefined) {
                send(controller, {
                  tool_calls: [{ index: toolIndex, function: { arguments: event.delta.partial_json } }],
                });
              }
            }
          } else if (event.type === "message_delta") {
            stopReason = event.delta.stop_reason ?? stopReason;
          }
        }
        if (!cancelled) {
          send(controller, {}, toFinishReason(stopReason));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      } catch (error) {
        // 途中で切れたことを利用者側に伝える（正常終了に見せない）
        try {
          controller.error(error);
        } catch {
          // すでに閉じている
        }
      }
    },
    cancel() {
      cancelled = true;
      // 利用者側で切れたら Anthropic からの受け取りも止める（無駄なトークンを使わない）
      iterator.return?.().catch(() => {});
      onCancel?.();
    },
  });
}

/**
 * Anthropic の失敗を OpenAI と同じ形の Response にする。
 *
 * `code` は呼び出し側が見る語彙に合わせる:
 *   - model_not_found … 台帳にあるが使えないモデル。既定モデルへ切り替える
 *   - invalid_api_key / missing_api_key … キーが無効・未設定。同じく既定モデルへ切り替える
 */
export function anthropicErrorResponse(error: unknown): Response {
  let status = 502;
  let code: string | null = null;
  let message = "Anthropic request failed";
  if (error instanceof Anthropic.APIError) {
    status = typeof error.status === "number" ? error.status : 502;
    message = error.message;
    if (status === 404) code = "model_not_found";
    else if (status === 401 || status === 403) code = "invalid_api_key";
    else if (status === 429) code = "rate_limit_exceeded";
  } else if (error instanceof Error) {
    message = error.message;
  }
  return new Response(JSON.stringify({ error: { code, message: message.slice(0, 300) } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function missingAnthropicKeyResponse(): Response {
  return new Response(
    JSON.stringify({
      error: { code: "missing_api_key", message: `${ANTHROPIC_API_KEY_ENV} が設定されていません` },
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * OpenAI 形式のボディで Claude を呼び、OpenAI 形式の Response を返す。
 * 失敗は例外にせず、OpenAI と同じ形の失敗 Response にする
 * （requestChatCompletion が `.ok` を見て既定モデルへ切り替えられるように）。
 */
export async function requestAnthropicChatCompletion(
  body: Record<string, unknown>
): Promise<Response> {
  const apiKey = process.env[ANTHROPIC_API_KEY_ENV];
  if (!apiKey) return missingAnthropicKeyResponse();

  try {
    // リトライは1回まで。来訪者を待たせる経路なので、長く粘らない
    const client = new Anthropic({ apiKey, maxRetries: 1 });
    const params = toAnthropicParams(body);
    const expectJson = body.response_format !== undefined;

    if (body.stream === true) {
      // stream: true の create は HTTP の応答が返るまで待つので、4xx はここで例外になる
      const stream = await client.messages.create({ ...params, stream: true });
      return new Response(toOpenAiSseStream(stream, () => stream.controller.abort()), {
        status: 200,
        headers: SSE_HEADERS,
      });
    }

    const message = await client.messages.create({ ...params, stream: false });
    return new Response(JSON.stringify(toOpenAiCompletion(message, expectJson)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return anthropicErrorResponse(error);
  }
}
