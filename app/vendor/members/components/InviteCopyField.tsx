"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";

export default function InviteCopyField({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      input.current?.focus();
      input.current?.select();
      setStatus("manual");
    }
  }

  return (
    <div>
      <div className="flex min-w-0 items-center gap-2 rounded-btn border border-line bg-white p-1">
        <input ref={input} readOnly value={url} aria-label="再共有用の招待リンク"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate bg-transparent px-2 text-base text-nicchyo-ink" />
        <Button variant="secondary" className="min-h-11 shrink-0" onClick={copy}>
          {status === "copied" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {status === "copied" ? "コピー済み" : "コピー"}
        </Button>
      </div>
      <p role="status" className={status === "manual" ? "mt-1 text-xs text-nicchyo-ink/70" : "sr-only"}>
        {status === "manual" ? "URLを長押ししてコピーしてください。" : status === "copied" ? "招待リンクをコピーしました。" : ""}
      </p>
    </div>
  );
}
