"use client";

import { useState } from "react";
import type { SlotRoadPositionPlan } from "@/app/api/admin/map-layout/_shared";
import { buttonStyle, errorNoteStyle, label, noteStyle, panelWrap, primaryButtonStyle } from "./panelStyles";

const SIDE_LABEL = { left: "左", right: "右" } as const;

/**
 * 道の上の位置をまだ持たない区画（移行前の区画）を、道基準の位置へ移す。
 * まず試算の結果（変換できる区画・どの道にも近くない区画）を見せ、確認してから実行する。
 * 実行前にサーバーがスナップショットを作るので、「変更履歴」から移行前に戻せる。
 */
export default function SlotMigrationPanel({
  unanchoredCount,
  hasUnsavedChanges,
  onMigrated,
}: {
  unanchoredCount: number;
  hasUnsavedChanges: boolean;
  /** 移行が終わったら（画面の読み直しは呼び出し側） */
  onMigrated: (updatedCount: number) => void;
}) {
  const [plan, setPlan] = useState<SlotRoadPositionPlan | null>(null);
  const [state, setState] = useState<"idle" | "planning" | "running">("idle");
  const [error, setError] = useState<string | null>(null);

  const loadPlan = async () => {
    setState("planning");
    setError(null);
    try {
      const response = await fetch("/api/admin/map-layout/slot-road-positions");
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { plan: SlotRoadPositionPlan };
      setPlan(data.plan);
    } catch {
      setError("試算に失敗しました。");
    } finally {
      setState("idle");
    }
  };

  const run = async () => {
    setState("running");
    setError(null);
    try {
      const response = await fetch("/api/admin/map-layout/slot-road-positions", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { updatedCount?: number; error?: string } | null;
      if (!response.ok) throw new Error(data?.error);
      setPlan(null);
      onMigrated(data?.updatedCount ?? 0);
    } catch {
      setError("移行に失敗しました。変更はされていません。");
    } finally {
      setState("idle");
    }
  };

  return (
    <div style={panelWrap}>
      <span style={label}>区画の位置の移行</span>
      <p style={noteStyle}>
        道の上の位置をまだ持たない区画が {unanchoredCount} 件あります。移すと、道の形を直したときに区画がついてくるようになります。
      </p>

      {!plan && (
        <button type="button" onClick={() => void loadPlan()} disabled={state !== "idle"} style={buttonStyle}>
          {state === "planning" ? "試算中..." : "試算する"}
        </button>
      )}

      {plan && (
        <>
          <p style={noteStyle}>
            自動で移せる区画：{plan.matched.length} 件
            <br />
            どの道にも近くないため移さない区画：{plan.unmatched.length} 件
          </p>
          {plan.unmatched.length > 0 && (
            <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 10, fontSize: 11.5 }}>
              {plan.unmatched.map((item) => (
                <div key={item.locationId}>
                  店番 {item.position}（{item.name}）
                  {item.distanceToNearestRoadM != null
                    ? `— ${item.nearestRoadName} から ${Math.round(item.distanceToNearestRoadM)}m`
                    : "— 道がありません"}
                </div>
              ))}
            </div>
          )}
          {plan.matched.some((item) => item.driftM > 0.5) && (
            <details style={{ marginBottom: 10, fontSize: 11.5 }}>
              <summary>道の端より外にある区画（道の形を直すと位置がずれます）</summary>
              {plan.matched
                .filter((item) => item.driftM > 0.5)
                .map((item) => (
                  <div key={item.locationId}>
                    店番 {item.position}：{item.roadName} の{SIDE_LABEL[item.roadSide]}側、端から {item.driftM.toFixed(1)}m 外
                  </div>
                ))}
            </details>
          )}
          {hasUnsavedChanges ? (
            <p style={errorNoteStyle}>保存していない変更があります。先に保存するか取り消してから移行してください。</p>
          ) : (
            <p style={noteStyle}>移行の前にスナップショットを作ります。問題があれば「変更履歴」から戻せます。緯度経度（公開マップの位置）は変わりません。</p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => void run()}
              disabled={state !== "idle" || hasUnsavedChanges || plan.matched.length === 0}
              style={{ ...primaryButtonStyle, opacity: hasUnsavedChanges || plan.matched.length === 0 ? 0.45 : 1 }}
            >
              {state === "running" ? "移行中..." : `${plan.matched.length} 件を移す`}
            </button>
            <button type="button" onClick={() => setPlan(null)} style={buttonStyle}>
              やめる
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" style={{ ...errorNoteStyle, marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
