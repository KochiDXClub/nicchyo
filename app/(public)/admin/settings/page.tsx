"use client";

export const dynamic = "force-dynamic";

import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AdminLayout, AdminPageHeader } from "@/components/admin";

type PublicSettings = {
  siteName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  publicAnnouncementEnabled: boolean;
  publicAnnouncement: string;
};

type MapSettings = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
  maxMapSnapshots: number;
  maxEditZoom: number;
};

const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  siteName: "nicchyo",
  maintenanceMode: false,
  maintenanceMessage: "",
  publicAnnouncementEnabled: false,
  publicAnnouncement: "",
};

const DEFAULT_MAP_SETTINGS: MapSettings = {
  maxLandmarks: 80,
  maxUnassignedShopMarkers: 40,
  maxMapSnapshots: 50,
  maxEditZoom: 20,
};

function EmailNotificationSection() {
  const [status, setStatus] = useState<{ configured: boolean; fromAddress: string; notificationTo: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/send-notification");
      if (!res.ok) return;
      const data = await res.json() as typeof status;
      setStatus(data);
      setTestTo(data?.notificationTo !== "未設定" ? (data?.notificationTo ?? "") : "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  const handleTest = async () => {
    setSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; skipped?: boolean };
      if (!res.ok) {
        setTestResult({ ok: false, message: data.error ?? "送信失敗" });
      } else if (data.skipped) {
        setTestResult({ ok: true, message: "RESEND_API_KEY が未設定のため送信をスキップしました（コンソールにログ出力済み）" });
      } else {
        setTestResult({ ok: true, message: "テストメールを送信しました" });
      }
    } catch {
      setTestResult({ ok: false, message: "通信エラーが発生しました" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Notifications</p>
      <h3 className="mt-2 text-xl font-bold text-slate-900">メール通知設定</h3>

      {status === null ? (
        <p className="mt-3 text-sm text-slate-400">読み込み中...</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500">設定状態</p>
              <p className={`mt-1 font-semibold ${status.configured ? "text-green-700" : "text-amber-700"}`}>
                {status.configured ? "✅ 設定済み（Resend）" : "⚠️ 未設定（スキップモード）"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">送信元</p>
              <p className="mt-1 text-slate-700">{status.fromAddress}</p>
            </div>
          </div>

          {!status.configured && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              メール送信を有効にするには <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> を .env に設定してください。
              未設定の場合、通報・問い合わせ受信時の通知はコンソールログのみ出力されます。
            </p>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">テスト送信先</label>
            <div className="mt-1 flex gap-2">
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="admin@example.com"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={!testTo || sending}
                className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {sending ? "送信中..." : "テスト送信"}
              </button>
            </div>
            {testResult && (
              <p className={`mt-2 text-xs ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
                {testResult.message}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              ADMIN_NOTIFICATION_EMAIL 環境変数を設定すると通報・問い合わせ受信時に自動でメールを送ります。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminSettingsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [publicSettings, setPublicSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [mapSettings, setMapSettings] = useState<MapSettings>(DEFAULT_MAP_SETTINGS);
  const [initialPublicSettings, setInitialPublicSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [initialMapSettings, setInitialMapSettings] = useState<MapSettings>(DEFAULT_MAP_SETTINGS);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dangerPassword, setDangerPassword] = useState("");
  const [isDangerLoading, setIsDangerLoading] = useState(false);
  const [dangerMessage, setDangerMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isSuperAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isSuperAdmin, router]);

  useEffect(() => {
    if (isLoading || !permissions.isSuperAdmin) return;
    let active = true;
    void fetch("/api/admin/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as {
          public?: Partial<PublicSettings>;
          map?: Partial<MapSettings>;
        };
        if (!active) return;
        const nextPublic = { ...DEFAULT_PUBLIC_SETTINGS, ...(data.public ?? {}) };
        const nextMap = { ...DEFAULT_MAP_SETTINGS, ...(data.map ?? {}) };
        setPublicSettings(nextPublic);
        setMapSettings(nextMap);
        setInitialPublicSettings(nextPublic);
        setInitialMapSettings(nextMap);
      })
      .catch(() => {
        if (!active) return;
        setMessage("設定の取得に失敗しました。");
      })
      .finally(() => {
        if (active) setIsFetching(false);
      });
    return () => {
      active = false;
    };
  }, [isLoading, permissions.isSuperAdmin]);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(publicSettings) !== JSON.stringify(initialPublicSettings) ||
      JSON.stringify(mapSettings) !== JSON.stringify(initialMapSettings),
    [initialMapSettings, initialPublicSettings, mapSettings, publicSettings]
  );

  if (isLoading || !permissions.isSuperAdmin) {
    return null;
  }

  const handleDangerAction = async (action: "clean-map-history" | "delete-analytics") => {
    if (!dangerPassword) {
      setDangerMessage({ type: "error", text: "パスワードを入力してください" });
      return;
    }
    const label = action === "clean-map-history" ? "古いマップ履歴の整理" : "分析ログの全削除";
    if (!confirm(`${label}を実行しますか？この操作は取り消せません。`)) return;

    setIsDangerLoading(true);
    setDangerMessage(null);
    try {
      const res = await fetch("/api/admin/danger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          password: dangerPassword,
          ...(action === "clean-map-history" ? { keepCount: mapSettings.maxMapSnapshots } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; deletedCount?: number };
      if (!res.ok || !data.ok) {
        setDangerMessage({ type: "error", text: data.error ?? "操作に失敗しました" });
        return;
      }
      setDangerMessage({
        type: "ok",
        text: `${label}が完了しました（${data.deletedCount ?? 0}件削除）`,
      });
      setDangerPassword("");
    } catch {
      setDangerMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsDangerLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public: publicSettings,
          map: mapSettings,
        }),
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { public: PublicSettings; map: MapSettings };
      setPublicSettings(data.public);
      setMapSettings(data.map);
      setInitialPublicSettings(data.public);
      setInitialMapSettings(data.map);
      setMessage("設定を保存しました。");
    } catch {
      setMessage("設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="System Settings" title="システム設定" />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-24">
        <div className="mb-6 rounded-2xl bg-white p-5 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">公開設定と運用上限</h2>
              <p className="mt-1 text-sm text-slate-500">
                公開状態、マップ編集の上限、認証が必要な危険操作をここで管理します。
              </p>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={isFetching || isSaving || !hasChanges}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "保存中..." : "設定を保存"}
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Public</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">公開設定</h3>
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">サイト名</span>
                <input
                  value={publicSettings.siteName}
                  onChange={(event) =>
                    setPublicSettings((prev) => ({ ...prev, siteName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">メンテナンスモード</p>
                  <p className="text-xs text-slate-500">公開画面のメンテナンス告知に使う設定です。</p>
                </div>
                <input
                  type="checkbox"
                  checked={publicSettings.maintenanceMode}
                  onChange={(event) =>
                    setPublicSettings((prev) => ({
                      ...prev,
                      maintenanceMode: event.target.checked,
                    }))
                  }
                  className="h-5 w-5"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">メンテナンス文言</span>
                <textarea
                  rows={3}
                  value={publicSettings.maintenanceMessage}
                  onChange={(event) =>
                    setPublicSettings((prev) => ({
                      ...prev,
                      maintenanceMessage: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">公開お知らせを有効化</p>
                  <p className="text-xs text-slate-500">ホームなどで共通告知を出すための下準備です。</p>
                </div>
                <input
                  type="checkbox"
                  checked={publicSettings.publicAnnouncementEnabled}
                  onChange={(event) =>
                    setPublicSettings((prev) => ({
                      ...prev,
                      publicAnnouncementEnabled: event.target.checked,
                    }))
                  }
                  className="h-5 w-5"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">公開お知らせ文</span>
                <textarea
                  rows={4}
                  value={publicSettings.publicAnnouncement}
                  onChange={(event) =>
                    setPublicSettings((prev) => ({
                      ...prev,
                      publicAnnouncement: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600">Map Limits</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">マップ利用上限</h3>
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">建物オブジェクト上限</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={mapSettings.maxLandmarks}
                  onChange={(event) =>
                    setMapSettings((prev) => ({
                      ...prev,
                      maxLandmarks: Number(event.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">未割当マーカ上限</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={mapSettings.maxUnassignedShopMarkers}
                  onChange={(event) =>
                    setMapSettings((prev) => ({
                      ...prev,
                      maxUnassignedShopMarkers: Number(event.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">保持する履歴件数</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={mapSettings.maxMapSnapshots}
                  onChange={(event) =>
                    setMapSettings((prev) => ({
                      ...prev,
                      maxMapSnapshots: Number(event.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">編集画面の最大ズーム</span>
                <input
                  type="number"
                  min={18}
                  max={24}
                  value={mapSettings.maxEditZoom}
                  onChange={(event) =>
                    setMapSettings((prev) => ({
                      ...prev,
                      maxEditZoom: Number(event.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>
            </div>
          </section>
        </div>

        {/* メール通知設定 */}
        <EmailNotificationSection />

        <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-600">Danger Zone</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">認証が必要な危険操作</h3>
          <p className="mt-2 text-sm text-slate-600">
            パスワードを入力して実行してください。この操作は取り消せません。
          </p>

          <div className="mt-5 max-w-md">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">現在のパスワード</span>
              <input
                type="password"
                value={dangerPassword}
                onChange={(event) => setDangerPassword(event.target.value)}
                className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
                autoComplete="current-password"
              />
            </label>
          </div>

          {dangerMessage && (
            <p className={`mt-3 text-sm ${dangerMessage.type === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
              {dangerMessage.text}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={() => handleDangerAction("clean-map-history")}
              disabled={isDangerLoading || !dangerPassword}
              className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDangerLoading ? "処理中..." : `古いマップ履歴を整理（最新${mapSettings.maxMapSnapshots}件を保持）`}
            </button>

            <button
              type="button"
              onClick={() => handleDangerAction("delete-analytics")}
              disabled={isDangerLoading || !dangerPassword}
              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDangerLoading ? "処理中..." : "分析ログを全削除"}
            </button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
