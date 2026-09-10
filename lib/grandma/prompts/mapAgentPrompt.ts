/**
 * マップAIアシスタント（`app/api/map-agent`）のプロンプト
 *
 * ここだけ英語で書かれている。買い物ルート提案のJSONを返させる。
 *
 * 来訪者の緯度・経度は渡さない。「会場のあたりにいる／離れたところにいる」の
 * 区分だけを渡す（相談側と同じ扱い。/privacy の記載もこれを前提にしている）。
 * 実際の並び順は受け取ったあとサーバー側で距離順に組み直すので、
 * 生の座標をAIに渡す必要がない。
 */
import { describeLocationForPrompt } from "@/lib/grandma/consultUtils";

/** コード契約: JSONのみを返す約束 */
export const MAP_AGENT_SYSTEM_PROMPT =
  "You are a concise shopping guide for Kochi Sunday Market. Reply only with JSON that matches the requested schema. Keep route hints short and realistic.";

export type MapAgentAnswers = {
  purpose?: string;
  needs?: string;
  visitCount?: string;
  favoriteFood?: string;
};

export type MapAgentCandidate = {
  id: number;
  name: string;
  category: string;
  products: string[];
  lat: number;
  lng: number;
};

export function buildMapAgentPrompt(
  answers: MapAgentAnswers,
  candidates: MapAgentCandidate[],
  location: { lat: number; lng: number } | null
): string {
  const lines = candidates.map((shop) => {
    const products = shop.products.slice(0, 6).join(", ");
    return `${shop.name} (id:${shop.id}, category:${shop.category}, products:${products}, lat:${shop.lat.toFixed(
      5
    )}, lng:${shop.lng.toFixed(5)})`;
  });

  return `
あなたは高知の日曜市で買い物ルートを提案する案内AIです。回答は短めに、JSONのみを返してください。
来訪者の居場所: ${describeLocationForPrompt(location)}
ユーザー入力:
- 目的: ${answers.purpose ?? "未回答"}
- 欲しいもの: ${answers.needs ?? "未回答"}
- 回りたい件数: ${answers.visitCount ?? "未回答"}
- 好きな料理: ${answers.favoriteFood ?? "未回答"}

候補店舗(最大6件):
${lines.join("\n")}

出力JSONの形:
{
  "title": "string",
  "summary": "string",
  "shops": [{ "id": number, "name": "string", "reason": "string", "icon": "string" }],
  "routeHint": "string",
  "shoppingList": ["string", ...]
}
`.trim();
}
