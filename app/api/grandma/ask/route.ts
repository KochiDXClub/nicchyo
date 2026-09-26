/**
 * AI相談「にちよさん」のAPI
 *
 * 本体は handler.ts の handleConsultAsk。管理画面の対話テスト
 * （app/api/admin/ai-models/test）が同じ本体をモデル差し替えで呼ぶので、
 * ルートはここで薄く包むだけにしている。
 */
import { handleConsultAsk } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleConsultAsk(request);
}
