import { describe, it, expect } from "vitest";
import {
  buildGrandmaAiSystemPrompt,
  CONSULT_CONTENT_RULES,
  CONSULT_CONVERSATION_RULES,
  CONSULT_OUTPUT_RULES,
} from "./consultSystemPrompt";
import { DEFAULT_AI_PROMPTS } from "./promptKeys";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";

const twoChars = CONSULT_CHARACTERS.slice(0, 2);
const PATTERN = "構成1: テスト用の会話構成";

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
- turns は表示順で返す
- turns[].speakerId は必ず今回選ばれたキャラの id のどれかにする
- followUpQuestion には、ユーザーが次にAIへ送る質問文を1つだけ入れる
- followUpQuestion は「〜はどう？」「〜してみる？」のようなAI側の問いかけにしない
- followUpQuestion はボタンにそのまま出せる自然な質問文にする
- 例: 「朝いちで回るならどの順番がいい？」 「この中でいちばん人気のお店は？」

---

## 会話ルール
- 通常は選ばれたキャラの掛け合いで構成する
- 5%の全員会話のときは、各キャラが1発話ずつ話す
- 1〜4発話で収める
- 1発話は1〜2文まで
- 同じ内容の言い換えを繰り返さない
- ユーザーに一方的に説明するだけでなく、相手の発話を受けて少し返す
- ただし雑談だけで終わらせず、質問への答えが自然に分かるようにする
- みらいくんだけは標準語で話す
- にちよさん、よういちさん、よさこちゃんは土佐弁で話す
- 方言は不自然に過剰にしない

## 内容ルール
- 与えられた会話メモリと直近履歴を踏まえて、文脈を引き継ぐ
- 店舗提案が必要なときだけ、候補店舗の中から shopIds を返す
- 店舗提案が不要な質問では shopIds を空配列にする
- ランドマーク画像案内が必要なときだけ imageUrl を設定する
- 候補にない店舗IDは返さない
- 危険・違法・個人情報・攻撃的内容は穏やかに断る
- 答えられる材料が足りない、または不確かなときは、1キャラだけが状況に合った短い案内や断り文を返す
- 季節や旬の質問では、与えられた seasonal context を優先する
- 高知市の観光場所など、店舗DBに直接ない質問でも一般的に知られた内容なら自然に答えてよい
- 一般知識で答えるときは、店の候補がないのに無理に shopIds を返さない

今回は、次の選ばれたキャラクターだけが会話に参加します。必ずこの人たちだけを登場させてください。

- id: nichiyosan
  name: にちよさん
  personality: やさしく場をつなぎ、話を整理しながら土佐弁で案内する。
  speech_style: 土佐弁
- id: yoichisan
  name: よういちさん
  personality: 落ち着いていて、昔から知っている目線でしみじみ語る。
  speech_style: 土佐弁

今回の会話構成:
構成1: テスト用の会話構成
`.trim();

describe("buildGrandmaAiSystemPrompt", () => {
  it("既定値のみで組み立てた文面を固定する", () => {
    expect(buildGrandmaAiSystemPrompt(twoChars, PATTERN)).toBe(EXPECTED_PROMPT);
  });

  it("プロンプトに undefined が混ざらない（循環参照の検出）", () => {
    expect(buildGrandmaAiSystemPrompt(twoChars, PATTERN)).not.toContain("undefined");
  });

  it("prompts を省略してもコード側の既定値で組み立てる（DBが読めなくても動く）", () => {
    expect(buildGrandmaAiSystemPrompt(twoChars, PATTERN)).toBe(
      buildGrandmaAiSystemPrompt(twoChars, PATTERN, DEFAULT_AI_PROMPTS)
    );
  });

  it("DBで編集できる文は固定部分より後ろに置く（プロンプトキャッシュのため）", () => {
    const prompt = buildGrandmaAiSystemPrompt(twoChars, PATTERN);
    const separator = prompt.indexOf("\n---\n");

    // 固定部分（キャッシュの共通プレフィックス）
    expect(prompt.indexOf("## 出力ルール")).toBeLessThan(separator);
    // 可変部分
    expect(prompt.indexOf("## 会話ルール")).toBeGreaterThan(separator);
    expect(prompt.indexOf("## 内容ルール")).toBeGreaterThan(separator);
    expect(prompt.indexOf("- id: nichiyosan")).toBeGreaterThan(separator);
    expect(prompt.indexOf("今回の会話構成:")).toBeGreaterThan(separator);
  });

  it("編集しても固定部分（キャッシュの共通プレフィックス）は変わらない", () => {
    const edited = buildGrandmaAiSystemPrompt(twoChars, PATTERN, {
      ...DEFAULT_AI_PROMPTS,
      "consult.conversation_rules": "## 会話ルール\n- 方言はごく薄くする",
    });
    const base = buildGrandmaAiSystemPrompt(twoChars, PATTERN);
    const prefixOf = (value: string) => value.slice(0, value.indexOf("\n---\n"));

    expect(prefixOf(edited)).toBe(prefixOf(base));
    expect(edited).toContain("- 方言はごく薄くする");
    expect(edited).not.toContain("- 方言は不自然に過剰にしない");
  });

  it("会話ルール・内容ルールをDBの値で差し替える", () => {
    const prompt = buildGrandmaAiSystemPrompt(twoChars, PATTERN, {
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
    const prompt = buildGrandmaAiSystemPrompt(twoChars, PATTERN, {
      ...DEFAULT_AI_PROMPTS,
      "consult.character.nichiyosan.personality": "ぶっきらぼうに短く答える。",
      "consult.character.nichiyosan.speech_style": "標準語",
    });
    expect(prompt).toContain("  personality: ぶっきらぼうに短く答える。");
    expect(prompt).toContain("  speech_style: 標準語");
  });

  it("今週のメモがあれば末尾側に差し込む", () => {
    const prompt = buildGrandmaAiSystemPrompt(twoChars, PATTERN, {
      ...DEFAULT_AI_PROMPTS,
      "consult.operator_note": "今週は雨で休みの店が多い。",
    });
    expect(prompt).toContain("## 今週のメモ\n今週は雨で休みの店が多い。");
    expect(prompt.indexOf("## 今週のメモ")).toBeGreaterThan(prompt.indexOf("\n---\n"));
  });

  it("今週のメモが空なら見出しごと出さない", () => {
    const prompt = buildGrandmaAiSystemPrompt(twoChars, PATTERN, {
      ...DEFAULT_AI_PROMPTS,
      "consult.operator_note": "   ",
    });
    expect(prompt).not.toContain("## 今週のメモ");
  });

  it("出力ルールはDBで編集できない（スキーマと対の契約）", () => {
    const prompt = buildGrandmaAiSystemPrompt(twoChars, PATTERN, {
      ...DEFAULT_AI_PROMPTS,
      "consult.conversation_rules": "壊してみる",
      "consult.content_rules": "壊してみる",
    });
    expect(prompt).toContain(CONSULT_OUTPUT_RULES);
  });
});
