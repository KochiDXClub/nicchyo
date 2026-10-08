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
import { buildStreamingFormatPrompt } from "@/lib/grandma/prompts/consultConversation";
import type { AiPromptSet } from "@/lib/grandma/prompts/promptKeys";

export function PromptPreview({ prompts }: { prompts: AiPromptSet }) {
  /** プレビュー用の話し手。実際はユーザーが選んだキャラ（未選択ならランダム）になる */
  const previewCharacters = useMemo(() => CONSULT_CHARACTERS.slice(0, 1), []);

  const preview = useMemo(() => {
    return buildGrandmaAiSystemPrompt(
      previewCharacters,
      buildStreamingFormatPrompt(previewCharacters),
      prompts
    );
  }, [previewCharacters, prompts]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">保存前プレビュー</h2>
      <p className="mt-1 text-[13px] text-slate-500">
        いま入力している内容で、AIに送られる文の全体です。保存はまだされていません。
        話し手はプレビュー用の例で、実際はユーザーが選んだキャラクターになります。
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
