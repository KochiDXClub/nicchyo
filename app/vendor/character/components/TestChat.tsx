"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Button, Surface } from "@/components/ui";
import {
  consumeTest,
  msUntilNextTest,
  remainingTests,
  TEST_LIMIT,
  TEST_WINDOW_MS,
  type TestUsage,
} from "@/lib/vendor/character/testRateLimit";
import CharacterAvatar from "./CharacterAvatar";

type Props = {
  name: string;
  image?: string | null;
  greeting: string;
  /** 本番ではAIに設定を渡して答えさせる。モックでは決まった返事を返す */
  reply: (message: string) => string;
  /** 話し相手が変わったら会話を作り直すための印 */
  resetKey: string;
  /** 回数は話し相手を変えても数え続ける（上限を回避できないように）。持ち主は画面側 */
  usage: TestUsage;
  onUsageChange: (usage: TestUsage) => void;
};

type Line = { from: "user" | "character"; text: string };

const SUGGESTIONS = ["おすすめは？", "どこにありますか？", "今日は何が旬？"] as const;

/** キャラの話し方を試す。10分100回まで */
export default function TestChat({ resetKey, ...rest }: Props) {
  return <TestChatBody key={resetKey} {...rest} />;
}

function TestChatBody({ name, image, greeting, reply, usage, onUsageChange }: Omit<Props, "resetKey">) {
  const [lines, setLines] = useState<Line[]>([{ from: "character", text: greeting }]);
  const [input, setInput] = useState("");
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const remaining = remainingTests(usage, Date.now());

  function send(message: string) {
    const text = message.trim();
    if (!text) return;
    const now = Date.now();
    const result = consumeTest(usage, now);
    if (!result.ok) {
      const minutes = Math.ceil(msUntilNextTest(usage, now) / 60000);
      setLimitMessage(`試せる回数の上限です。${minutes}分ほど待ってからもう一度どうぞ。`);
      return;
    }
    setLimitMessage(null);
    onUsageChange(result.usage);
    setLines((prev) => [...prev, { from: "user", text }, { from: "character", text: reply(text) }]);
    setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <Surface className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-nicchyo-ink/70">話し方を試す</h3>
        <p className="text-xs tabular-nums text-nicchyo-ink/55">
          あと{remaining}回（{TEST_WINDOW_MS / 60000}分で{TEST_LIMIT}回まで）
        </p>
      </div>

      <ul className="max-h-72 space-y-2 overflow-y-auto" aria-live="polite">
        {lines.map((line, index) => (
          <li key={index} className={line.from === "user" ? "flex justify-end" : "flex items-start gap-2"}>
            {line.from === "character" && <CharacterAvatar name={name} image={image} size="sm" className="h-9 w-9 text-sm" />}
            <p
              className={
                line.from === "user"
                  ? "max-w-[80%] rounded-card bg-amber-500 px-3 py-2 text-sm leading-relaxed text-white"
                  : "max-w-[80%] rounded-card bg-nicchyo-base px-3 py-2 text-sm leading-relaxed text-nicchyo-ink"
              }
            >
              {line.text}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <Button key={s} size="sm" variant="quiet" onClick={() => send(s)}>
            {s}
          </Button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="お客さんになって話しかける"
          placeholder="お客さんになって話しかける"
          maxLength={100}
          className="min-w-0 flex-1 rounded-btn bg-white px-3 py-2.5 text-base text-nicchyo-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-amber-500/60"
        />
        <Button type="submit" size="icon" aria-label="送る" disabled={!input.trim()}>
          <Send size={18} aria-hidden="true" />
        </Button>
      </form>

      {limitMessage && (
        <p role="alert" className="text-sm text-rose-700">
          {limitMessage}
        </p>
      )}
    </Surface>
  );
}
