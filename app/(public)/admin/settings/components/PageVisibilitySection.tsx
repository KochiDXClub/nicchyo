"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  DEFAULT_REDIRECT_TO,
  EMPTY_PAGE_VISIBILITY_SETTINGS,
  PAGE_REGISTRY,
  VISIBILITY_ROLE_LABELS,
  VISIBILITY_ROLES,
  VISIBILITY_STATES,
  VISIBILITY_STATE_LABELS,
  getLockedState,
  isSafeRedirectPath,
  parsePageVisibilitySettings,
  type PageRegistryEntry,
  type PageVisibilitySettings,
  type VisibilityRole,
  type VisibilityState,
} from "@/lib/pageVisibility";

const STATE_STYLE: Record<VisibilityState, { pill: string; dot: string; description: string }> = {
  public: {
    pill: "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    description: "リンクも表示",
  },
  unlisted: {
    pill: "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100",
    dot: "bg-amber-500",
    description: "URL直接アクセスのみ",
  },
  private: {
    pill: "bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100",
    dot: "bg-rose-500",
    description: "リダイレクト",
  },
};

/** 公開状態のピル型セレクター。locked のときはドロップダウンを開かず固定表示にする */
function VisibilityPicker({
  value,
  locked,
  onChange,
}: {
  value: VisibilityState;
  locked: boolean;
  onChange: (next: VisibilityState) => void;
}) {
  const style = STATE_STYLE[value];

  if (locked) {
    return (
      <span
        title="固定（変更不可）"
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400"
      >
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        {VISIBILITY_STATE_LABELS[value]}
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4M5 11h14v10H5z" />
        </svg>
      </span>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 data-[state=open]:ring-2 data-[state=open]:ring-slate-400 ${style.pill}`}
        >
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {VISIBILITY_STATE_LABELS[value]}
          <svg className="h-3 w-3 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[10020] min-w-[200px] rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as VisibilityState)}>
            {VISIBILITY_STATES.map((s) => (
              <DropdownMenu.RadioItem
                key={s}
                value={s}
                className="flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none transition data-[highlighted]:bg-slate-50"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATE_STYLE[s].dot}`} />
                <span className="flex-1">
                  <span className="block font-semibold">{VISIBILITY_STATE_LABELS[s]}</span>
                  <span className="block text-xs text-slate-400">{STATE_STYLE[s].description}</span>
                </span>
                <DropdownMenu.ItemIndicator>
                  <svg className="h-4 w-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * ページ公開設定セクション
 * 「設定」ページの「公開範囲」タブとして表示する。
 */
export function PageVisibilitySection() {
  const { permissions, isLoading } = useAuth();
  const [settings, setSettings] = useState<PageVisibilitySettings>(EMPTY_PAGE_VISIBILITY_SETTINGS);
  const [initial, setInitial] = useState<PageVisibilitySettings>(EMPTY_PAGE_VISIBILITY_SETTINGS);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !permissions.isAdmin) return;
    let active = true;
    void fetch("/api/admin/settings")
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as { pageVisibility?: unknown };
        if (!active) return;
        const parsed = parsePageVisibilitySettings(data.pageVisibility);
        setSettings(parsed);
        setInitial(parsed);
      })
      .catch(() => {
        if (active) setMessage("設定の取得に失敗しました。");
      })
      .finally(() => {
        if (active) setIsFetching(false);
      });
    return () => {
      active = false;
    };
  }, [isLoading, permissions.isAdmin]);

  const hasChanges = useMemo(
    () => JSON.stringify(parsePageVisibilitySettings(settings)) !== JSON.stringify(initial),
    [settings, initial]
  );

  const groups = useMemo(() => {
    const map = new Map<string, PageRegistryEntry[]>();
    for (const entry of PAGE_REGISTRY) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return Array.from(map.entries());
  }, []);

  const getState = (entry: PageRegistryEntry, role: VisibilityRole): VisibilityState =>
    getLockedState(entry, role) ?? settings.pages[entry.path]?.roles[role] ?? "public";

  const setState = (path: string, role: VisibilityRole, state: VisibilityState) => {
    setSettings((prev) => {
      const rule = prev.pages[path] ?? { roles: {} };
      const roles = { ...rule.roles };
      if (state === "public") delete roles[role];
      else roles[role] = state;
      return { pages: { ...prev.pages, [path]: { ...rule, roles } } };
    });
  };

  const setRedirect = (path: string, redirectTo: string) => {
    setSettings((prev) => {
      const rule = prev.pages[path] ?? { roles: {} };
      return { pages: { ...prev.pages, [path]: { ...rule, redirectTo } } };
    });
  };

  const hasPrivate = (entry: PageRegistryEntry) =>
    VISIBILITY_ROLES.some((role) => !getLockedState(entry, role) && getState(entry, role) === "private");

  const invalidRedirects = useMemo(
    () =>
      Object.entries(settings.pages).filter(
        ([, rule]) => rule.redirectTo !== undefined && rule.redirectTo !== "" && !isSafeRedirectPath(rule.redirectTo)
      ).length,
    [settings]
  );

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageVisibility: settings }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { pageVisibility?: unknown };
      const parsed = parsePageVisibilitySettings(data.pageVisibility);
      setSettings(parsed);
      setInitial(parsed);
      setMessage("保存しました。反映まで最大1分かかります。");
    } catch {
      setMessage("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !permissions.isAdmin) return null;

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">ロール別にページの公開状態を切り替える</h2>
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-semibold text-green-800">公開</span>: リンクも表示　/
                <span className="font-semibold text-amber-800">限定公開</span>: リンク非表示・URL直接アクセスは可　/
                <span className="font-semibold text-red-800">非公開</span>: URL直接アクセスもリダイレクト
              </p>
              <p className="mt-1 text-xs text-slate-400">
                管理者は常に全ページを閲覧できます。コード側でロール制限されているページ（出店者・管理者向け）は該当ロール以外を緩められません。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isFetching || isSaving || !hasChanges || invalidRedirects > 0}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "保存中..." : "設定を保存"}
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
          {invalidRedirects > 0 ? (
            <p className="mt-3 text-sm text-red-600">リダイレクト先は「/」または上記一覧にあるページのパス（例: /map）を入力してください。</p>
          ) : null}
        </div>

        {isFetching ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : (
          <div className="space-y-6">
            {groups.map(([group, entries]) => (
              <section key={group} className="overflow-hidden rounded-2xl bg-white shadow">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="text-sm font-bold text-slate-700">{group}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">ページ</th>
                        {VISIBILITY_ROLES.map((role) => (
                          <th key={role} className="px-2 py-2 text-center font-semibold">
                            {VISIBILITY_ROLE_LABELS[role]}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-left font-semibold">非公開時のリダイレクト先</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const redirectTo = settings.pages[entry.path]?.redirectTo ?? "";
                        const showRedirect = hasPrivate(entry);
                        return (
                          <tr key={entry.path} className="border-t border-slate-100">
                            <td className="px-4 py-2 align-middle">
                              <p className="font-medium text-slate-800">{entry.label}</p>
                              <p className="text-xs text-slate-400">
                                {entry.path}
                                {entry.description ? ` ・ ${entry.description}` : ""}
                              </p>
                            </td>
                            {VISIBILITY_ROLES.map((role) => {
                              const locked = getLockedState(entry, role);
                              const state = getState(entry, role);
                              return (
                                <td key={role} className="px-2 py-2 text-center align-middle">
                                  <VisibilityPicker
                                    value={state}
                                    locked={locked !== null}
                                    onChange={(next) => setState(entry.path, role, next)}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 align-middle">
                              {showRedirect ? (
                                <input
                                  type="text"
                                  value={redirectTo}
                                  placeholder={DEFAULT_REDIRECT_TO}
                                  onChange={(e) => setRedirect(entry.path, e.target.value.trim())}
                                  className={`w-full rounded-full border px-3 py-1.5 text-xs transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                                    redirectTo && !isSafeRedirectPath(redirectTo)
                                      ? "border-rose-300 bg-rose-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                />
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
      )}
    </div>
  );
}
