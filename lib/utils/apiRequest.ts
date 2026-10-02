/**
 * 自サイトの API を呼ぶ共通の関数。応答の JSON を返し、失敗したときは API が返した文言（error）と
 * 状態コード・コード（code）を持つ ApiError を投げる。画面は error.message をそのまま出せる。
 * 通信そのものが失敗したとき（電波がない等）も、fallback の文言で ApiError にそろえる。
 */

export class ApiError extends Error {
  readonly status: number;
  /** API が返した、画面で分岐するための短い名前（例: "already_member"）。無ければ undefined */
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function apiRequest<T>(url: string, options: RequestOptions, fallbackError: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(fallbackError, 0);
  }

  const data = (await res.json().catch(() => null)) as ({ error?: string; code?: string } & Record<string, unknown>) | null;
  if (!res.ok) throw new ApiError(data?.error ?? fallbackError, res.status, data?.code);
  return data as T;
}
