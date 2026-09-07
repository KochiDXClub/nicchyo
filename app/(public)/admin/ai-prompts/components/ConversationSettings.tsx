"use client";

/**
 * 相談の会話設定（発話数・返答の長さ・履歴件数）
 *
 * 値だけを編集する画面。項目そのもの（見出し・説明・受け付ける範囲）は
 * DBの台帳（ai_conversation_settings）が持っていて、増やすにはマイグレーションと
 * コードの対応が要る。行を足しても値を読むのはコード側なので、
 * どこからも参照されない行が増えるだけになるため。
 *
 * 範囲はキーごとに違う。値を間違えたときの被害が違うので、
 * 入力欄でも弾き、APIでもDBのCHECK制約でも弾く。
 */

import { useCallback, useEffect, useState } from "react";
import { LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import type { AiConversationSettingKey } from "@/lib/ai/conversationSettings";

type SettingItem = {
  key: AiConversationSettingKey;
  label: string;
  description: string;
  value: number;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  savedInDb: boolean;
  updatedAt: string | null;
};

export function ConversationSettings() {
  const [items, setItems] = useState<SettingItem[] | null>(null);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai-conversation-settings");
      if (!response.ok) {
        setLoadError("会話設定を読み込めませんでした。");
        return;
      }
      const payload = (await response.json()) as { items: SettingItem[] };
      setItems(payload.items);
      setEdited({});
      setLoadError(null);
    } catch {
      setLoadError("会話設定を読み込めませんでした。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const valueOf = (item: SettingItem) => edited[item.key] ?? item.value;
  const changedKeys = (items ?? []).filter((item) => valueOf(item) !== item.value);

  const handleSave = async () => {
    if (changedKeys.length === 0) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/ai-conversation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: Object.fromEntries(changedKeys.map((item) => [item.key, valueOf(item)])),
        }),
      });
      if (!response.ok) {
        // 保存できていないのに「保存しました」と出すと、効かない設定に気づけない
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast.error(payload?.error ?? "保存に失敗しました");
        return;
      }
      showToast.success("会話設定を保存しました");
      await load();
    } catch {
      showToast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{loadError}</p>
      </section>
    );
  }

  if (!items) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">読み込み中…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold text-slate-900">会話の設定</h2>
      <p className="mt-1 text-sm text-slate-500">
        発話数・返答の長さ・覚えておく会話の件数。値だけ変えられます。項目を増やすには
        コードの対応が要ります。
      </p>

      <ul className="mt-4 flex flex-col gap-4">
        {items.map((item) => {
          const current = valueOf(item);
          const isChanged = current !== item.value;
          const isOutOfRange = current < item.minValue || current > item.maxValue;
          return (
            <li key={item.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label
                  htmlFor={`setting-${item.key}`}
                  className="text-sm font-semibold text-slate-900"
                >
                  {item.label}
                </label>
                <span className="text-[11px] text-slate-400">
                  {item.minValue}〜{item.maxValue} / 既定 {item.defaultValue}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id={`setting-${item.key}`}
                  type="number"
                  inputMode="numeric"
                  min={item.minValue}
                  max={item.maxValue}
                  step={1}
                  value={current}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    setEdited((prev) => ({ ...prev, [item.key]: Math.trunc(next) }));
                  }}
                  className={`w-28 rounded-lg border px-3 py-2 text-sm ${
                    isOutOfRange ? "border-red-400 bg-red-50" : "border-slate-300"
                  }`}
                />
                {isChanged && !isOutOfRange && (
                  <span className="text-xs font-semibold text-amber-700">未保存</span>
                )}
                {isOutOfRange && (
                  <span className="text-xs font-semibold text-red-600">
                    {item.minValue}〜{item.maxValue} の範囲で入れてください
                  </span>
                )}
              </div>
              {!item.savedInDb && (
                // マイグレーション未適用の環境で「保存しても効かない」に気づけるようにする
                <p className="mt-2 text-[11px] text-amber-700">
                  この設定はまだDBに行がありません。コード側の既定値で動いています。
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <LoadingButton
          onClick={handleSave}
          isLoading={isSaving}
          className="rounded-full bg-nicchyo-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
          disabled={
            changedKeys.length === 0 ||
            changedKeys.some((item) => {
              const value = valueOf(item);
              return value < item.minValue || value > item.maxValue;
            })
          }
        >
          会話設定を保存
        </LoadingButton>
        {changedKeys.length > 0 && (
          <button
            type="button"
            onClick={() => setEdited({})}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            変更を取り消す
          </button>
        )}
      </div>
    </section>
  );
}
