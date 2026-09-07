"use client";

export const dynamic = "force-dynamic";

/**
 * AIプロンプト編集
 *
 * 「にちよさん」の会話ルール・内容ルール・キャラの人格・今週のメモを、
 * コードを触らずに運営が調整するための画面。
 *
 * 編集できるのは lib/grandma/prompts/promptKeys.ts の AI_PROMPT_DEFS に
 * 載っているものだけ。出力ルール（JSONスキーマと対の契約）は載せていないので、
 * ここから相談機能を壊すことはできない。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import {
  AI_PROMPT_DEFS,
  DEFAULT_AI_PROMPTS,
  validateAiPromptBody,
  type AiPromptDef,
  type AiPromptKey,
  type AiPromptSet,
} from "@/lib/grandma/prompts/promptKeys";
import { PromptPreview } from "./components/PromptPreview";

const GROUP_LABELS: Record<AiPromptDef["group"], { title: string; description: string }> = {
  weekly: {
    title: "今週のメモ",
    description:
      "その週だけAIに教えたいこと。日曜市が終わったら消す運用でかまいません。",
  },
  rules: {
    title: "会話のルール",
    description:
      "話し方の濃さや、答え方の方針。ここを直すと、にちよさんたちの返事の雰囲気が変わります。",
  },
  characters: {
    title: "キャラクター",
    description: "4人それぞれの性格と話し方。",
  },
};

const GROUP_ORDER: AiPromptDef["group"][] = ["weekly", "rules", "characters"];

const REJECT_MESSAGES: Record<string, string> = {
  too_long: "長すぎます",
  empty: "空にはできません",
  not_string: "入力の形式が正しくありません",
  unknown_key: "編集できない項目です",
  newline_not_allowed: "改行は入れられません（1行で書いてください）",
  control_character: "使えない文字が含まれています",
};

function PromptField({
  def,
  value,
  savedValue,
  onChange,
}: {
  def: AiPromptDef;
  value: string;
  /** 現在保存されている値。差分の表示に使う */
  savedValue: string;
  onChange: (key: AiPromptKey, next: string) => void;
}) {
  const validation = validateAiPromptBody(def.key, value);
  const isDefault = value === def.defaultBody;
  const isDirty = value !== savedValue;
  const overLimit = value.trim().length > def.maxLength;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <label htmlFor={def.key} className="text-sm font-bold text-slate-900">
          {def.label}
        </label>
        {isDirty ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            未保存
          </span>
        ) : null}
        {isDefault ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
            既定のまま
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-slate-500">{def.description}</p>

      {def.multiline ? (
        <textarea
          id={def.key}
          value={value}
          onChange={(event) => onChange(def.key, event.target.value)}
          rows={def.key === "consult.operator_note" ? 4 : 12}
          className="mt-3 w-full rounded-md border border-slate-300 p-2 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-slate-400 focus:outline-none"
        />
      ) : (
        <input
          id={def.key}
          type="text"
          value={value}
          onChange={(event) => onChange(def.key, event.target.value)}
          className="mt-3 w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className={`text-[12px] ${overLimit ? "font-semibold text-red-600" : "text-slate-400"}`}>
          {value.trim().length.toLocaleString()} / {def.maxLength.toLocaleString()} 文字
        </span>
        {!validation.ok ? (
          <span className="text-[12px] font-semibold text-red-600">
            {REJECT_MESSAGES[validation.reason] ?? "保存できません"}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onChange(def.key, def.defaultBody)}
          disabled={isDefault}
          className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 disabled:opacity-40"
        >
          既定値に戻す
        </button>
      </div>
    </div>
  );
}

export default function AdminAiPromptsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [saved, setSaved] = useState<AiPromptSet>(DEFAULT_AI_PROMPTS);
  const [draft, setDraft] = useState<AiPromptSet>(DEFAULT_AI_PROMPTS);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-prompts");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { prompts: AiPromptSet };
      setSaved(data.prompts);
      setDraft(data.prompts);
    } catch {
      showToast.error("プロンプトの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissions.isAdmin) return;
    void fetchPrompts();
  }, [permissions.isAdmin, fetchPrompts]);

  const handleChange = useCallback((key: AiPromptKey, next: string) => {
    setDraft((current) => ({ ...current, [key]: next }));
  }, []);

  const changedKeys = useMemo(
    () => AI_PROMPT_DEFS.filter((def) => draft[def.key] !== saved[def.key]).map((def) => def.key),
    [draft, saved]
  );

  const invalidKeys = useMemo(
    () => AI_PROMPT_DEFS.filter((def) => !validateAiPromptBody(def.key, draft[def.key]).ok),
    [draft]
  );

  const handleSave = useCallback(async () => {
    if (changedKeys.length === 0 || invalidKeys.length > 0) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(changedKeys.map((key) => [key, draft[key]]));
      const res = await fetch("/api/admin/ai-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: payload, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success("保存しました");
      setNote("");
      await fetchPrompts();
    } catch {
      showToast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [changedKeys, invalidKeys, draft, note, fetchPrompts]);

  if (isLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="AI"
        title="AIプロンプト編集"
        description="にちよさんたちの話し方と答え方を、コードを触らずに調整する"
      />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-600">
          ここで直せるのは話し方と答え方の方針だけです。JSONの出し方などアプリが動くための
          決まりごとはコード側にあり、この画面からは触れないようになっています。
          保存すると次の相談から反映されます。
        </p>

        {loading ? (
          <p className="text-[13px] text-slate-500">読み込み中...</p>
        ) : (
          <>
            {GROUP_ORDER.map((group) => {
              const defs = AI_PROMPT_DEFS.filter((def) => def.group === group);
              if (defs.length === 0) return null;
              return (
                <section key={group} className="space-y-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {GROUP_LABELS[group].title}
                    </h2>
                    <p className="text-[13px] text-slate-500">
                      {GROUP_LABELS[group].description}
                    </p>
                  </div>
                  {defs.map((def) => (
                    <PromptField
                      key={def.key}
                      def={def}
                      value={draft[def.key]}
                      savedValue={saved[def.key]}
                      onChange={handleChange}
                    />
                  ))}
                </section>
              );
            })}

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <label htmlFor="ai-prompt-note" className="text-sm font-bold text-slate-900">
                変更した理由（任意）
              </label>
              <p className="mt-1 text-[13px] text-slate-500">
                あとで履歴を見たときに、なぜ直したのかが分かるようにしておくと戻しやすくなります。
              </p>
              <input
                id="ai-prompt-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
                placeholder="例: 土佐弁が濃すぎたので弱めた"
                className="mt-3 w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
              />
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPreview((value) => !value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-[13px] font-semibold text-slate-700"
              >
                {showPreview ? "プレビューを閉じる" : "保存せずにプレビュー"}
              </button>
              <LoadingButton
                onClick={handleSave}
                isLoading={saving}
                loadingText="保存中..."
                disabled={changedKeys.length === 0 || invalidKeys.length > 0}
                className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white"
              >
                {changedKeys.length > 0 ? `${changedKeys.length}件を保存` : "変更なし"}
              </LoadingButton>
              {invalidKeys.length > 0 ? (
                <span className="text-[13px] font-semibold text-red-600">
                  入力に問題がある項目があります
                </span>
              ) : null}
              {changedKeys.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setDraft(saved)}
                  className="text-[13px] text-slate-500 underline"
                >
                  編集を取り消す
                </button>
              ) : null}
            </div>

            {showPreview ? <PromptPreview prompts={draft} /> : null}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
