"use client";

import Link from "next/link";
import { findVendorHelpPage } from "@/lib/vendor/helpPages";

export type HelpAnswerPart = { type: "text"; text: string } | { type: "link"; text: string; href: string };

/** `[名前](URL)` のリンクと、文中にそのまま出てきた出店者向けの URL */
const LINK_PATTERN = /\[([^\]\n]{1,60})\]\(([^)\s]{1,200})\)|(?<![\w/:.])(\/(?:vendor|my-shop)(?:\/[\w-]+)*\/?)/g;

/** 書きかけのリンク（ストリーミング中の `[近況投稿ペ` や `[近況投稿ページ](/vendor/po`） */
const PARTIAL_LINK_AT_END = /\[([^\]\n]*)(\]\([^)\s]*)?$/;

function looksLikeUrl(text: string): boolean {
  return text.startsWith("/") || /^https?:/i.test(text);
}

/**
 * にちよさんの答えを、文と画面へのリンクに分ける。
 *
 * リンクにするのは、案内してよい画面（lib/vendor/helpPages.ts）だけ。
 * 出店者は URL では分からないので、リンクの文字は画面の名前にする。
 * 一覧に無い URL はリンクにせず、文字だけを残す。
 */
export function splitHelpAnswer(answer: string): HelpAnswerPart[] {
  const source = answer.replace(PARTIAL_LINK_AT_END, "$1");
  const parts: HelpAnswerPart[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last?.type === "text") last.text += text;
    else parts.push({ type: "text", text });
  };

  let cursor = 0;
  for (const match of source.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    pushText(source.slice(cursor, index));
    cursor = index + match[0].length;

    const [, label, href, barePath] = match;
    const page = findVendorHelpPage(href ?? barePath ?? "");
    if (!page) {
      // 案内できない URL はリンクにしない。名前があれば名前だけ、無ければそのまま残す
      pushText(label && !looksLikeUrl(label) ? label : match[0]);
      continue;
    }
    const text = label && !looksLikeUrl(label) ? label : page.name;
    parts.push({ type: "link", text, href: page.href });
  }
  pushText(source.slice(cursor));
  return parts;
}

export default function HelpAnswerText({ answer }: { answer: string }) {
  return (
    <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-amber-900">
      {splitHelpAnswer(answer).map((part, index) =>
        part.type === "link" ? (
          <Link
            key={index}
            href={part.href}
            className="font-bold text-amber-700 underline decoration-amber-300 decoration-2 underline-offset-4"
          >
            {part.text}
          </Link>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </p>
  );
}
