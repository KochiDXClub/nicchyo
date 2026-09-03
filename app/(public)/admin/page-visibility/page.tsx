"use client";

export const dynamic = "force-dynamic";

import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
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

const STATE_STYLE: Record<VisibilityState, string> = {
  public: "border-green-200 bg-green-50 text-green-800",
  unlisted: "border-amber-200 bg-amber-50 text-amber-800",
  private: "border-red-200 bg-red-50 text-red-800",
};

export default function AdminPageVisibilityPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<PageVisibilitySettings>(EMPTY_PAGE_VISIBILITY_SETTINGS);
  const [initial, setInitial] = useState<PageVisibilitySettings>(EMPTY_PAGE_VISIBILITY_SETTINGS);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

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
    <AdminLayout>
      <AdminPageHeader eyebrow="Page Visibility" title="ページ公開設定" />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-24">
        <div className="mb-6 rounded-2xl bg-white p-5 shadow">
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
                                  <select
                                    value={state}
                                    disabled={locked !== null}
                                    onChange={(e) => setState(entry.path, role, e.target.value as VisibilityState)}
                                    title={locked ? "固定（変更不可）" : undefined}
                                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${STATE_STYLE[state]} disabled:opacity-50`}
                                  >
                                    {VISIBILITY_STATES.map((s) => (
                                      <option key={s} value={s}>
                                        {VISIBILITY_STATE_LABELS[s]}
                                      </option>
                                    ))}
                                  </select>
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
                                  className={`w-full rounded-lg border px-2 py-1 text-xs focus:outline-none ${
                                    redirectTo && !isSafeRedirectPath(redirectTo)
                                      ? "border-red-300 bg-red-50"
                                      : "border-slate-200"
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
    </AdminLayout>
  );
}
