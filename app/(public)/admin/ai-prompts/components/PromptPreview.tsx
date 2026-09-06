"use client";

/**
 * 保存前プレビュー
 *
 * 編集中の値でシステムプロンプトを組み立てて、そのまま見せる。
 * buildGrandmaAiSystemPrompt は純粋な関数なので、サーバーに送らずに
 * ブラウザ側で組み立てられる（保存していない値をDBに書かずに試せる）。
 */

import { useMemo } from "react";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";
import { buildGrandmaAiSystemPrompt } from "@/lib/grandma/prompts/consultSystemPrompt";
import { buildConversationPatternPrompt } from "@/lib/grandma/prompts/consultConversation";
import type { AiPromptSet } from "@/lib/grandma/prompts/promptKeys";
import type { ConversationPattern } from "@/lib/grandma/types";

/** プレビュー用の固定の会話構成。実際はリクエストごとにランダムで選ばれる */
const PREVIEW_PATTERN: ConversationPattern = {
  id: "pattern1",
  instruction:
    "構成1: キャラ1が回答し、キャラ2がそこから自然に出てくる疑問を投げ、キャラ1が補足し、最後にキャラ2が納得と感想で締める。",
  turnCount: 4,
};

export function PromptPreview({ prompts }: { prompts: AiPromptSet }) {
  const previewCharacters = useMemo(() => CONSULT_CHARACTERS.slice(0, 2), []);

  const preview = useMemo(() => {
    return buildGrandmaAiSystemPrompt(
      previewCharacters,
      buildConversationPatternPrompt(previewCharacters, PREVIEW_PATTERN),
      prompts
    );
  }, [previewCharacters, prompts]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">保存前プレビュー</h2>
      <p className="mt-1 text-[13px] text-slate-500">
        いま入力している内容で、AIに送られる文の全体です。保存はまだされていません。
        キャラクターと会話構成はプレビュー用の例で、実際はリクエストごとに変わります。
      </p>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700">
        {preview}
      </pre>
      <p className="mt-2 text-[12px] text-slate-400">
        {preview.length.toLocaleString()} 文字
      </p>
    </section>
  );
}
