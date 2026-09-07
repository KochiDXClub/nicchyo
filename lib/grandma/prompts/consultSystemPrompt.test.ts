import { describe, it, expect } from "vitest";
import {
  buildGrandmaAiSystemPrompt,
  CONSULT_CONTENT_RULES,
  CONSULT_CONVERSATION_RULES,
  CONSULT_OUTPUT_RULES,
} from "./consultSystemPrompt";
import { DEFAULT_AI_PROMPTS } from "./promptKeys";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";

const oneChar = CONSULT_CHARACTERS.slice(0, 1);
const TAIL = "テスト用の追加指示";

/**
 * 既定値だけで組み立てたときの文面を固定する。
 *
 * 会話ルール・内容ルールは運営がDBから編集するようになったため、
 * 固定部分（プロンプトキャッシュの対象）ではなく `---` の後ろに置いている。
 */
const EXPECTED_PROMPT = `
あなたは高知県・日曜市の案内会話を生成するAIです。
日曜市の店や回り方が中心ですが、高知市の観光や食の話題にも一般知識ベースで答えてよいです。

## 出力ルール
- 必ずJSONのみを返す
- スキーマに従う
- summary には、次回以降に引き継ぐ短い会話メモを120文字以内で入れる
- turns は表示順で返す。発話数の目安は会話ルールに従う
- turns[].speakerId は必ず今回の話し手の id にする
- followUpQuestion には、ユーザーが次にAIへ送る質問文を1つだけ入れる
- followUpQuestion は「〜はどう？」「〜してみる？」のようなAI側の問いかけにしない
- followUpQuestion はボタンにそのまま出せる自然な質問文にする
- 例: 「朝いちで回るならどの順番がいい？」 「この中でいちばん人気のお店は？」

---

## 会話ルール
- 選ばれたキャラ1人だけが、ユーザーに直接話しかける
- 発話は1つだけ。2〜3文、全体で100文字前後に収める
- 最初の1文で答えを言い切り、残りで理由やひとこと補足を添える
- 前置き・あいさつ・相づちは入れない（「そうやねえ」から始めない）
- 同じ内容の言い換えを繰り返さない
- 店を勧めるときは、名前を並べるだけでなく「なぜそこか」を一言添える
- にちよさん、よういちさん、よさこちゃんは土佐弁で話す
- みらいくんだけは標準語で話す
- 方言は語尾程度にとどめ、読みにくくなるほど濃くしない

## 内容ルール
- 与えられた会話メモリと直近履歴を踏まえて、文脈を引き継ぐ
- 店舗提案が必要なときだけ、候補店舗の中から shopIds を返す
- 店舗提案が不要な質問では shopIds を空配列にする
- ランドマーク画像案内が必要なときだけ imageUrl を設定する
- 候補にない店舗IDは返さない
- 危険・違法・個人情報・攻撃的内容は穏やかに断る
- 答えられる材料が足りない、または不確かなときは、状況に合った短い案内や断り文を1つだけ返す
- 季節や旬の質問では、与えられた seasonal context を優先する
- 高知市の観光場所など、店舗DBに直接ない質問でも一般的に知られた内容なら自然に答えてよい
- 一般知識で答えるときは、店の候補がないのに無理に shopIds を返さない

今回の話し手は次のキャラクターです。必ずこの人だけを登場させてください。

- id: nichiyosan
  name: にちよさん
  personality: 日曜市を長年見てきたおばあちゃん。質問にまず答えてから、「せっかくやき」と一つだけおすすめを足す。押しつけがましくない。
  speech_style: 土佐弁

テスト用の追加指示
`.trim();

describe("buildGrandmaAiSystemPrompt", () => {
  it("既定値のみで組み立てた文面を固定する", () => {
    expect(buildGrandmaAiSystemPrompt(oneChar, TAIL)).toBe(EXPECTED_PROMPT);
  });

  it("プロンプトに undefined が混ざらない（循環参照の検出）", () => {
    expect(buildGrandmaAiSystemPrompt(oneChar, TAIL)).not.toContain("undefined");
  });

  it("prompts を省略してもコード側の既定値で組み立てる（DBが読めなくても動く）", () => {
    expect(buildGrandmaAiSystemPrompt(oneChar, TAIL)).toBe(
      buildGrandmaAiSystemPrompt(oneChar, TAIL, DEFAULT_AI_PROMPTS)
    );
  });

  it("DBで編集できる文は固定部分より後ろに置く（プロンプトキャッシュのため）", () => {
    const prompt = buildGrandmaAiSystemPrompt(oneChar, TAIL);
    const separator = prompt.indexOf("\n---\n");

    // 固定部分（キャッシュの共通プレフィックス）
    expect(prompt.indexOf("## 出力ルール")).toBeLessThan(separator);
    // 可変部分
    expect(prompt.indexOf("## 会話ルール")).toBeGreaterThan(separator);
    expect(prompt.indexOf("## 内容ルール")).toBeGreaterThan(separator);
    expect(prompt.indexOf("- id: nichiyosan")).toBeGreaterThan(separator);
    expect(prompt.indexOf(TAIL)).toBeGreaterThan(separator);
  });

  it("編集しても固定部分（キャッシュの共通プレフィックス）は変わらない", () => {
    const edited = buildGrandmaAiSystemPrompt(oneChar, TAIL, {
      ...DEFAULT_AI_PROMPTS,
      "consult.conversation_rules": "## 会話ルール\n- 方言はごく薄くする",
    });
    const base = buildGrandmaAiSystemPrompt(oneChar, TAIL);
    const prefixOf = (value: string) => value.slice(0, value.indexOf("\n---\n"));

    expect(prefixOf(edited)).toBe(prefixOf(base));
    expect(edited).toContain("- 方言はごく薄くする");
    expect(edited).not.toContain("- 方言は語尾程度にとどめ、読みにくくなるほど濃くしない");
  });

  it("会話ルール・内容ルールをDBの値で差し替える", () => {
    const prompt = buildGrandmaAiSystemPrompt(oneChar, TAIL, {
      ...DEFAULT_AI_PROMPTS,
      "consult.conversation_rules": "## 会話ルール\n- 1発話だけにする",
      "consult.content_rules": "## 内容ルール\n- 旬のものだけ答える",
    });
    expect(prompt).toContain("- 1発話だけにする");
    expect(prompt).toContain("- 旬のものだけ答える");
    expect(prompt).not.toContain(CONSULT_CONVERSATION_RULES);
    expect(prompt).not.toContain(CONSULT_CONTENT_RULES);
  });

  it("キャラの人格・話し方をDBの値で差し替える", () => {
    const prompt = buildGrandmaAiSystemPrompt(oneChar, TAIL, {
      ...DEFAULT_AI_PROMPTS,
      "consult.character.nichiyosan.personality": "ぶっきらぼうに短く答える。",
      "consult.character.nichiyosan.speech_style": "標準語",
    });
    expect(prompt).toContain("  personality: ぶっきらぼうに短く答える。");
    expect(prompt).toContain("  speech_style: 標準語");
  });

  it("今週のメモがあれば末尾側に差し込む", () => {
    const prompt = buildGrandmaAiSystemPrompt(oneChar, TAIL, {
      ...DEFAULT_AI_PROMPTS,
      "consult.operator_note": "今週は雨で休みの店が多い。",
    });
    expect(prompt).toContain("## 今週のメモ\n今週は雨で休みの店が多い。");
    expect(prompt.indexOf("## 今週のメモ")).toBeGreaterThan(prompt.indexOf("\n---\n"));
  });

  it("今週のメモが空なら見出しごと出さない", () => {
    const prompt = buildGrandmaAiSystemPrompt(oneChar, TAIL, {
      ...DEFAULT_AI_PROMPTS,
      "consult.operator_note": "   ",
    });
    expect(prompt).not.toContain("## 今週のメモ");
  });

  it("出力ルールはDBで編集できない（スキーマと対の契約）", () => {
    const prompt = buildGrandmaAiSystemPrompt(oneChar, TAIL, {
      ...DEFAULT_AI_PROMPTS,
      "consult.conversation_rules": "壊してみる",
      "consult.content_rules": "壊してみる",
    });
    expect(prompt).toContain(CONSULT_OUTPUT_RULES);
  });
});
