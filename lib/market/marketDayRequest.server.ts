import { NextResponse } from "next/server";
import { validateMarketDayInput, type MarketDayInput } from "./marketDayInput";

/**
 * 開催ステータス更新リクエストの本文を読んで検証する（運営・高知市で共通）。
 * 失敗したらそのまま返せる 400 レスポンスを返す。
 */
export async function parseMarketDayRequest(
  req: Request
): Promise<{ data: MarketDayInput } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: NextResponse.json({ error: "無効なリクエストです" }, { status: 400 }) };
  }

  const { data, error } = validateMarketDayInput(body);
  if (!data) {
    return {
      response: NextResponse.json({ error: error ?? "無効なリクエストです" }, { status: 400 }),
    };
  }
  return { data };
}
