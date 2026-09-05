"use client";

export const dynamic = "force-dynamic";

/**
 * スポット管理
 *
 * 電停・駅・建物・お手洗い・休けい場所（map_landmarks）の一覧と編集。
 * マップ上の位置・アイコンサイズは「マップ編集」画面が担当し、ここでは
 * スポットカードとおでかけサポートで使う属性（種別・写真・タグ・路線・補足・
 * 外部リンク・常時表示・実測済み）を編集する。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import { SPOT_CATEGORIES, type AdminSpot, type SpotCategory } from "@/lib/spots/adminSpot";

const CATEGORY_LABEL: Record<SpotCategory, string> = {
  transit: "のりもの",
  landmark: "目印（建物など）",
  restroom: "お手洗い",
  rest: "休けい",
};

const CATEGORY_BADGE: Record<SpotCategory, string> = {
  transit: "bg-orange-100 text-orange-800",
  landmark: "bg-amber-100 text-amber-800",
  restroom: "bg-sky-100 text-sky-800",
  rest: "bg-emerald-100 text-emerald-800",
};

type FormState = {
  key: string;
  name: string;
  description: string;
  category: SpotCategory;
  transit_mode: "" | "tram" | "jr";
  latitude: string;
  longitude: string;
  image_url: string;
  lines: string;
  tags: string;
  notes: string;
  external_url: string;
  photo_url: string;
  photo_credit: string;
  open_from: string;
  open_until: string;
  show_on_map: boolean;
  verified: boolean;
};

const EMPTY_FORM: FormState = {
  key: "",
  name: "",
  description: "",
  category: "landmark",
  transit_mode: "",
  latitude: "33.5614",
  longitude: "133.5380",
  image_url: "/images/maps/elements/facilities/rest.svg",
  lines: "",
  tags: "",
  notes: "",
  external_url: "",
  photo_url: "",
  photo_credit: "",
  open_from: "",
  open_until: "",
  show_on_map: false,
  verified: false,
};

const splitList = (value: string) =>
  value
    .split(/[、,]/)
    .map((v) => v.trim())
    .filter(Boolean);

function toForm(spot: AdminSpot): FormState {
  return {
    key: spot.key,
    name: spot.name,
    description: spot.description,
    category: spot.category,
    transit_mode: spot.transit_mode ?? "",
    latitude: String(spot.latitude),
    longitude: String(spot.longitude),
    image_url: spot.image_url,
    lines: spot.lines.join("、"),
    tags: spot.tags.join("、"),
    notes: spot.notes ?? "",
    external_url: spot.external_url ?? "",
    photo_url: spot.photo_url ?? "",
    photo_credit: spot.photo_credit ?? "",
    open_from: spot.open_from ?? "",
    open_until: spot.open_until ?? "",
    show_on_map: spot.show_on_map,
    verified: spot.verified,
  };
}

function toPayload(form: FormState) {
  return {
    key: form.key.trim(),
    name: form.name,
    description: form.description,
    category: form.category,
    transit_mode: form.category === "transit" && form.transit_mode ? form.transit_mode : null,
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    image_url: form.image_url,
    width_px: 40,
    height_px: 40,
    lines: splitList(form.lines),
    tags: splitList(form.tags),
    notes: form.notes.trim() || null,
    external_url: form.external_url.trim() || null,
    photo_url: form.photo_url.trim() || null,
    photo_credit: form.photo_credit.trim() || null,
    open_from: form.open_from.trim() || null,
    open_until: form.open_until.trim() || null,
    show_on_map: form.show_on_map,
    verified: form.verified,
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SpotForm({
  form,
  setForm,
  isNew,
  saving,
  onSave,
  onCancel,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  isNew: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm({ ...form, [field]: value });

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="キー" hint="英小文字・数字・ハイフン。作成後は変更できません">
          <input
            className={inputClass}
            value={form.key}
            disabled={!isNew}
            onChange={(e) => update("key", e.target.value)}
            placeholder="restroom-otepia"
          />
        </Field>
        <Field label="名前">
          <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={80} />
        </Field>
        <Field label="種別">
          <select className={inputClass} value={form.category} onChange={(e) => update("category", e.target.value as SpotCategory)}>
            {SPOT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        {form.category === "transit" && (
          <Field label="交通機関">
            <select className={inputClass} value={form.transit_mode} onChange={(e) => update("transit_mode", e.target.value as FormState["transit_mode"])}>
              <option value="">未設定</option>
              <option value="tram">路面電車</option>
              <option value="jr">JR</option>
            </select>
          </Field>
        )}
        <Field label="緯度">
          <input className={inputClass} value={form.latitude} onChange={(e) => update("latitude", e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="経度">
          <input className={inputClass} value={form.longitude} onChange={(e) => update("longitude", e.target.value)} inputMode="decimal" />
        </Field>
      </div>
      <Field label="説明" hint="カードの本文。施設は「会場から見た位置」を書く">
        <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} maxLength={400} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="アイコン画像URL" hint="/images/… または https://…">
          <input className={inputClass} value={form.image_url} onChange={(e) => update("image_url", e.target.value)} />
        </Field>
        <Field label="外部リンク" hint="時刻表・公式サイトなど">
          <input className={inputClass} value={form.external_url} onChange={(e) => update("external_url", e.target.value)} placeholder="https://" />
        </Field>
        <Field label="乗り入れ路線" hint="「、」区切り（のりもののみ）">
          <input className={inputClass} value={form.lines} onChange={(e) => update("lines", e.target.value)} placeholder="伊野線、後免線" />
        </Field>
        <Field label="条件タグ" hint="「、」区切り。例: 屋根あり、多目的あり、ベンチあり">
          <input className={inputClass} value={form.tags} onChange={(e) => update("tags", e.target.value)} />
        </Field>
        <Field label="写真URL" hint="https://… （Wikimedia Commons 等の再利用可能な画像）">
          <input className={inputClass} value={form.photo_url} onChange={(e) => update("photo_url", e.target.value)} />
        </Field>
        <Field label="写真の出典" hint="ライセンス上必要な表記。例: 写真: 撮影者 / CC BY 2.0（Wikimedia Commons）">
          <input className={inputClass} value={form.photo_credit} onChange={(e) => update("photo_credit", e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="利用できる時間（から）" hint="HH:MM。未設定なら終日">
          <input className={inputClass} value={form.open_from} onChange={(e) => update("open_from", e.target.value)} placeholder="10:00" />
        </Field>
        <Field label="利用できる時間（まで）">
          <input className={inputClass} value={form.open_until} onChange={(e) => update("open_until", e.target.value)} placeholder="18:00" />
        </Field>
      </div>
      <Field label="補足" hint="設備・混雑・注意など">
        <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={600} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.show_on_map} onChange={(e) => update("show_on_map", e.target.checked)} />
          マップに常時表示する（お手洗い・休けいは通常オフ）
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.verified} onChange={(e) => update("verified", e.target.checked)} />
          座標を実測・確認済み
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim() || !form.key.trim()}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
        >
          {saving ? "保存中..." : isNew ? "作成" : "保存"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">
          キャンセル
        </button>
      </div>
    </div>
  );
}

export default function AdminSpotsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SpotCategory | "all">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const fetchSpots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/spots");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { spots: AdminSpot[] };
      setSpots(data.spots);
    } catch {
      showToast.error("スポットの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissions.isAdmin) return;
    void fetchSpots();
  }, [fetchSpots, permissions.isAdmin]);

  const visible = useMemo(
    () => (filter === "all" ? spots : spots.filter((s) => s.category === filter)),
    [filter, spots]
  );

  const startEdit = (spot: AdminSpot) => {
    setCreating(false);
    setEditingKey(spot.key);
    setForm(toForm(spot));
  };

  const startCreate = () => {
    setEditingKey(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  };

  const cancel = () => {
    setEditingKey(null);
    setCreating(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/spots", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(creating ? `「${form.name}」を作成しました` : `「${form.name}」を保存しました`);
      cancel();
      void fetchSpots();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (spot: AdminSpot) => {
    setConfirmingKey(null);
    try {
      const res = await fetch(`/api/admin/spots?key=${encodeURIComponent(spot.key)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(`「${spot.name}」を削除しました`);
      void fetchSpots();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="マスタ管理" title="スポット管理" />

      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        電停・駅・建物・お手洗い・休けい場所の情報（写真・タグ・路線・補足）を編集します。
        マップ上の位置とアイコンの大きさは「マップ編集」で調整してください。
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...SPOT_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === c ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c === "all" ? `すべて（${spots.length}）` : `${CATEGORY_LABEL[c]}（${spots.filter((s) => s.category === c).length}）`}
          </button>
        ))}
        <button
          type="button"
          onClick={startCreate}
          className="ml-auto rounded-xl bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
        >
          スポットを追加
        </button>
      </div>

      {creating && (
        <div className="mb-4">
          <SpotForm form={form} setForm={setForm} isNew saving={saving} onSave={() => void save()} onCancel={cancel} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">スポットがありません</p>
      ) : (
        <div className="space-y-2">
          {visible.map((spot) =>
            editingKey === spot.key ? (
              <SpotForm
                key={spot.key}
                form={form}
                setForm={setForm}
                isNew={false}
                saving={saving}
                onSave={() => void save()}
                onCancel={cancel}
              />
            ) : (
              <div key={spot.key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spot.image_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{spot.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_BADGE[spot.category]}`}>
                      {CATEGORY_LABEL[spot.category]}
                    </span>
                    {spot.photo_url && <span className="text-[10px] text-slate-400">📷 写真あり</span>}
                    {!spot.show_on_map && <span className="text-[10px] text-slate-400">案内時のみ表示</span>}
                    {!spot.verified && <span className="text-[10px] text-rose-500">座標未確認</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {spot.key}
                    {spot.tags.length > 0 && ` ・ ${spot.tags.join(" / ")}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(spot)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                >
                  編集
                </button>
                {confirmingKey === spot.key ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void remove(spot)}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                    >
                      削除する
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingKey(null)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      やめる
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingKey(spot.key)}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-100"
                  >
                    削除
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </AdminLayout>
  );
}
