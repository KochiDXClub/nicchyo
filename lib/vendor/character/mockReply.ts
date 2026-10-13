import type { OriginalCharacterDraft, TemplateCharacter } from "./types";

// 話し方テストのモック返答。本番では、キャラの設定をAIに渡して答えさせる。
// ここでは「設定が返事にどう出るか」を画面で確かめられる程度の、決まった返事を返す。

const BASE_ANSWERS = [
  "この時期は、トマトとナスがおいしいですよ。",
  "入口から2つ目のあたりが、人気のお店です。",
  "今日は日曜市の開催日です。ゆっくり見ていってください。",
];

function pick(message: string, list: readonly string[]): string {
  const seed = [...message].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return list[seed % list.length];
}

export function templateReply(character: TemplateCharacter, message: string): string {
  // テンプレは話し方が調整済み。見本の言い回しで返す
  return pick(message, character.samples.length > 0 ? character.samples : [character.greeting]);
}

export function originalReply(draft: OriginalCharacterDraft, message: string): string {
  const base = pick(message, BASE_ANSWERS).replace(/。$/, "");
  const ending = draft.ending.trim();
  const body = ending ? `${base}${ending}` : base;
  const first = draft.firstPerson.trim();
  return first ? `${first}のおすすめは、これ。${body}。` : `${body}。`;
}
