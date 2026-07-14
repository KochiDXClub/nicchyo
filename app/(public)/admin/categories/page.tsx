"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import type { Category } from "@/app/api/admin/categories/route";

export default function AdminCategoriesPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isSuperAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isSuperAdmin, router]);

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
    if (!permissions.isSuperAdmin) return;
    void fetchCategories();
  }, [fetchCategories, permissions.isSuperAdmin]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(`「${name}」を追加しました`);
      setNewName("");
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
  };

  const handleSave = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success("カテゴリ名を更新しました");
      setEditingId(null);
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

      {/* カテゴリ追加 */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          placeholder="新しいカテゴリ名"
          maxLength={50}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!newName.trim() || adding}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
        >
          {adding ? "追加中..." : "追加"}
        </button>
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
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSave(cat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={50}
                    autoFocus
                    className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSave(cat.id)}
                    disabled={!editName.trim() || saving}
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
                  <span className="flex-1 text-sm font-medium text-slate-800">{cat.name}</span>
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
