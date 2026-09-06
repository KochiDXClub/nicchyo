/**
 * マップAIアシスタント（`app/api/map-agent`）のプロンプト
 *
 * ここだけ英語で書かれている。買い物ルート提案のJSONを返させる。
 */

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
  start: [number, number]
): string {
  const lines = candidates.map((shop) => {
    const products = shop.products.slice(0, 6).join(", ");
    return `${shop.name} (id:${shop.id}, category:${shop.category}, products:${products}, lat:${shop.lat.toFixed(
      5
    )}, lng:${shop.lng.toFixed(5)})`;
  });

  return `
あなたは高知の日曜市で買い物ルートを提案する案内AIです。回答は短めに、JSONのみを返してください。
出発地点: lat ${start[0].toFixed(5)}, lng ${start[1].toFixed(5)}
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
