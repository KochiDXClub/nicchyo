/**
 * 相談の出力フォーマットの指示
 *
 * `buildGrandmaAiSystemPrompt()` の末尾（毎回変わる部分）に差し込まれる。
 *
 * 以前はここに「2キャラの掛け合い構成（4発話・話者順）」があったが、
 * 1人語りに変えた際に削除した。発話数・長さ・話の運び方は
 * DBの `consult.conversation_rules`（既定値は consultRules.ts）で決める。
 * コード側が決めるのは「発話は最大いくつまで受け取れるか」だけにする。
 */
import type { ConsultCharacter } from "@/app/(public)/consult/data/consultCharacters";

/**
 * コード契約: 1回の返答で受け取る発話数の上限。
 *
 * `buildResponseSchema()` の `turns.maxItems` と `buildStreamingFormatPrompt()` の
 * 行数指示の両方がこれを読む。運営が会話ルールで「発話は1つ」と書いても、
 * ここが上限として効く（ルールに従わなかったときの安全弁）。
 *
 * 1 にしているのは、複数発話がUI上は掛け合いに見えるため。
 * `GrandmaChatter` は発話ごとに1秒あけて別の吹き出しを出すので、
 * 同じキャラの2〜3発話でも、以前の2人の掛け合いと見分けがつかない。
 */
export const CONSULT_MAX_TURNS: number = 1;

/**
 * コード契約: 変えるとアプリが壊れる。管理画面から編集できるようにしてはいけない。
 *
 * ここで指示している行フォーマット（TURN / SHOP_IDS / IMAGE_URL / FOLLOW_UP / SUMMARY / END）を
 * `parseStreamingConsultOutput()` がそのまま解釈する。両方を同時に直すこと。
 */
export function buildStreamingFormatPrompt(characters: ConsultCharacter[]) {
  const speakerMap = characters.map((character) => `${character.id}=${character.name}`).join(", ");
  return [
    "出力は必ずプレーンテキストのみ。JSON、Markdown、前置きは禁止。",
    CONSULT_MAX_TURNS === 1
      ? "TURN 行を最初に出力する。TURN 行はちょうど1行だけ。"
      : `TURN 行を最初に出力する。行数は会話ルールに従い、1行以上 ${CONSULT_MAX_TURNS} 行以内。`,
    `TURN 行の形式は TURN|speakerId|speakerName|text。speakerId は ${speakerMap} を使う。`,
    "text には改行を入れない。speakerName は対応する表示名を使う。",
    "TURN 行の後に、次の行をこの順番で必ず1行ずつ出力する。",
    "SHOP_IDS|1,2,3",
    "IMAGE_URL|https://... または null",
    "FOLLOW_UP|次にユーザーへ聞く質問",
    "SUMMARY|会話の要約",
    "END",
    "候補がない時は SHOP_IDS| とする。画像がない時は IMAGE_URL|null とする。",
    "余計な説明は絶対に足さない。",
  ].join("\n");
}

/**
 * コード契約: 変えるとアプリが壊れる。管理画面から編集できるようにしてはいけない。
 *
 * 非ストリーミング時の形式指示。`buildResponseSchema()` が返す JSON スキーマと
 * 対になっている。ストリーミング時は代わりに `buildStreamingFormatPrompt()` を使う。
 * **両方を同時に渡さないこと**（「JSONのみ」と「プレーンテキストのみ」が
 * 同居して、どちらに従うかがモデル任せになる）。
 */
export function buildJsonFormatPrompt() {
  return [
    "出力は必ずJSONのみ。前置き・Markdownのコードフェンス・説明文は禁止。",
    "渡されたJSONスキーマに従う。",
    CONSULT_MAX_TURNS === 1
      ? "turns はちょうど1つ。"
      : `turns は1つ以上 ${CONSULT_MAX_TURNS} つ以内。`,
    "turns[].speakerId は今回の話し手の id にする。",
  ].join("\n");
}
