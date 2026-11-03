"use client";
import { notifyCategoriesUpdated } from "@/lib/categories/CategoryContext";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import { Button, Badge } from "@/components/ui";
import type { Category } from "@/app/api/admin/categories/route";

export default function AdminCategoriesPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [translating, setTranslating] = useState<"new" | "edit" | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isAdmin, router]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("failed");
      const data = await res.json() as { categories: Category[] };
      setCategories(data.categories);
    } catch {
      showToast.error("カテゴリの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissions.isAdmin) return;
    void fetchCategories();
  }, [fetchCategories, permissions.isAdmin]);

  /** 日本語名を英語名にする（サーバーで AI を呼ぶ）。結果は入力欄に入れるだけで、保存は「追加」「保存」を押したとき */
  const translateName = async (target: "new" | "edit", name: string, apply: (nameEn: string) => void) => {
    if (!name.trim()) return;
    setTranslating(target);
    try {
      const res = await fetch("/api/admin/categories/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null) as { nameEn?: string; error?: string } | null;
      if (!res.ok || !data?.nameEn) throw new Error(data?.error ?? "翻訳できませんでした");
      apply(data.nameEn);
      showToast.success("英語名の案を入れました。確認してから保存してください");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "翻訳できませんでした");
    } finally {
      setTranslating(null);
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nameEn: newNameEn }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(`「${name}」を追加しました`);
      setNewName("");
      notifyCategoriesUpdated();
      setNewNameEn("");
      void fetchCategories();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditNameEn(cat.name_en ?? "");
  };

  const handleSave = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nameEn: editNameEn }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success("カテゴリ名を更新しました");
      setEditingId(null);
      notifyCategoriesUpdated();
      void fetchCategories();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    setConfirmingId(null);
    setDeletingId(cat.id);
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(`「${cat.name}」を削除しました`);
      notifyCategoriesUpdated();
      void fetchCategories();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="マスタ管理" title="カテゴリ管理" />

      {/* カテゴリ追加（日本語名と英語名を同時に入れる） */}
      <div className="mb-6 rounded-card border border-line bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="catNameJa" className="mb-1 block text-xs font-medium text-nicchyo-ink/70">日本語名</label>
            <input
              id="catNameJa"
              type="text"
              lang="ja"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="新しいカテゴリ名"
              maxLength={50}
              className="w-full rounded-btn border border-line px-4 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="catNameEn" className="mb-1 block text-xs font-medium text-nicchyo-ink/70">English name（英語名）</label>
            <div className="flex gap-2">
              <input
                id="catNameEn"
                type="text"
                lang="en"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
                placeholder="例: Food"
                maxLength={100}
                className="min-w-0 flex-1 rounded-btn border border-line px-4 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void translateName("new", newName, setNewNameEn)}
                disabled={!newName.trim() || translating !== null}
              >
                {translating === "new" ? "翻訳中..." : "AIで英訳"}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-nicchyo-ink/55">英語名は空でも追加できます。空のあいだは、英語の画面でも日本語名のまま出ます。</p>
          <Button className="shrink-0" onClick={() => void handleAdd()} disabled={!newName.trim() || adding}>
            {adding ? "追加中..." : "追加"}
          </Button>
        </div>
      </div>

      {/* カテゴリ一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : categories.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">カテゴリがありません</p>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              {editingId === cat.id ? (
                <>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      lang="ja"
                      aria-label="日本語名"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSave(cat.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={50}
                      autoFocus
                      className="min-w-0 rounded-btn border border-amber-300 px-3 py-1.5 text-sm focus:outline-none"
                    />
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        lang="en"
                        aria-label="English name（英語名）"
                        placeholder="English name"
                        value={editNameEn}
                        onChange={(e) => setEditNameEn(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSave(cat.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        maxLength={100}
                        className="min-w-0 flex-1 rounded-btn border border-amber-300 px-3 py-1.5 text-sm focus:outline-none"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void translateName("edit", editName, setEditNameEn)}
                        disabled={!editName.trim() || translating !== null}
                      >
                        {translating === "edit" ? "翻訳中..." : "AIで英訳"}
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSave(cat.id)}
                    disabled={!editName.trim() || saving || translating !== null}
                    className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200 disabled:opacity-40"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-nicchyo-ink">
                    <span lang="ja">{cat.name}</span>
                    {cat.name_en ? (
                      <span lang="en" className="font-normal text-nicchyo-ink/70">{cat.name_en}</span>
                    ) : (
                      <Badge variant="neutral">英語名なし</Badge>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEdit(cat)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                  >
                    編集
                  </button>
                  {confirmingId === cat.id ? (
                    <>
                      <span className="text-xs text-red-700">本当に削除しますか？</span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(cat)}
                        disabled={deletingId === cat.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        {deletingId === cat.id ? "削除中..." : "削除する"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(cat.id)}
                      disabled={deletingId === cat.id}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                    >
                      削除
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        全 {categories.length} カテゴリ　※削除は関連商品への影響を確認してから行ってください
      </p>
    </AdminLayout>
  );
}
