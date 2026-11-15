"use client";

import { useEffect, useState } from "react";
import { ShopPreview } from "@/components/admin/ShopPreview";
import { formatMarketAddress, parseMarketAddress } from "@/lib/market-schedule/address";
import { slotLabel } from "../../../map/types/editableShop";
import type { ChomeJudgement } from "@/lib/map/chomeBoundaries";
import { CHOMES, getChome, normalizeChomeId, type ChomeId } from "@/lib/map/chomes";
import { EDITOR_COLORS } from "../editorTheme";
import type { EditableShop, EditableVendor } from "../types";
import {
  buttonStyle,
  dangerButtonStyle,
  errorNoteStyle,
  inputStyle,
  label,
  noteStyle,
  panelWrap,
} from "./panelStyles";

/** 自動判定の結果を、パネルに出す一文にする */
export function describeChomeJudgement(judged: ChomeJudgement | null): string {
  if (!judged) return "";
  if (judged.status === "ok") return `自動判定: ${getChome(judged.chomeId)?.name ?? ""}`;
  if (judged.status === "near_boundary") {
    const names = judged.candidates.map((id) => `${id}丁目`).join("・");
    return `境目のすぐ上にあるため、自動では決められません${names ? `（候補: ${names}）` : ""}`;
  }
  if (judged.status === "ambiguous") return "丁目の区間が重なっていて、自動では決められません（設定の誤り）";
  return "自動判定の対象外です（丁目の区間に入っていません）";
}

/**
 * 区画を選んだときの右パネル。区画は出店者の id だけを持ち、出店者の情報は別に保存する。
 * 店舗情報は参照のみ。住所・丁目の編集と、出店予定画面への導線を提供する。
 */
export default function SlotVendorPanel({
  shop,
  roadName,
  vendor,
  onApplyFieldObservation,
  onAddressChange,
  onChomeChange,
  autoChome,
  onDelete,
}: {
  shop: EditableShop;
  /** 区画が乗っている道の名前（道基準の位置を持つ区画だけ） */
  roadName: string | null;
  /** この区画の出店者 */
  vendor: EditableVendor | null;
  onApplyFieldObservation?: () => void;
  onAddressChange?: (address: { main: number; branch: number | null } | null) => void;
  /** 丁目を選ぶ（手で設定）／"auto" で自動判定に戻す */
  onChomeChange: (value: ChomeId | "auto") => void;
  /** この区画の位置からの自動判定の結果（道の位置が無い区画は null） */
  autoChome: ChomeJudgement | null;
  onDelete: () => void;
}) {
  const [previewVendor, setPreviewVendor] = useState<string | null>(null);
  const [addressText, setAddressText] = useState("");
  const [addressError, setAddressError] = useState("");
  useEffect(() => {
    setAddressText(shop.officialNumber == null ? "" : formatMarketAddress({ main: shop.officialNumber, branch: shop.branchNumber ?? null }));
    setAddressError("");
    setPreviewVendor(null);
  }, [shop.locationId, shop.officialNumber, shop.branchNumber]);
  return (
    <div style={panelWrap}>
      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 900 }}>
        区画 {slotLabel(shop)}
        {shop.officialNumber != null && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: EDITOR_COLORS.muted }}>（店番 {shop.position}）</span>
        )}
      </p>
      <p style={{ ...noteStyle, marginBottom: 12 }}>
        {shop.roadId && shop.roadDistanceM != null
          ? `${roadName ?? "道"} の${shop.roadSide === "left" ? "左" : "右"}側・始点から ${Math.round(shop.roadDistanceM)}m`
          : "道の上の位置はまだありません（移行前の区画）"}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 13 }}><a href={`/admin/market-schedule?location=${encodeURIComponent(shop.locationId)}`} target="_blank" rel="noopener noreferrer">この場所の出店予定を管理</a></p>
      {onAddressChange && <div style={{ marginBottom: 16 }}>
        <label><span style={label}>住所番号</span><input value={addressText} onChange={(event) => { setAddressText(event.target.value); setAddressError(""); }} placeholder="例：183-1" style={inputStyle} /></label>
        <p style={noteStyle}>住所の枝番と、この場所の店舗番号は別です。住所は未設定のままでも保存できます。</p>
        {addressError && <p role="alert" style={errorNoteStyle}>{addressError}</p>}
        <button type="button" style={buttonStyle} onClick={() => {
          const value = addressText.trim() ? parseMarketAddress(addressText) : null;
          if (addressText.trim() && !value) { setAddressError("住所番号を「183」または「183-1」の形で入力してください。"); return; }
          if (shop.officialNumber != null && !window.confirm("この場所の住所を変更します。登録された全店舗に反映されます。続けますか？")) return;
          onAddressChange(value);
        }}>住所を編集内容に追加</button>
      </div>}

      <label>
        <span style={label}>日曜市の丁目</span>
        <select
          aria-label="日曜市の丁目"
          value={shop.chomeLocked ? String(normalizeChomeId(shop.chome) ?? "auto") : "auto"}
          onChange={(e) => onChomeChange(e.target.value === "auto" ? "auto" : (Number(e.target.value) as ChomeId))}
          style={{ ...inputStyle, marginBottom: 4 }}
        >
          <option value="auto">自動（道の位置から決める）</option>
          {CHOMES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <p style={{ ...noteStyle, marginBottom: 12 }}>
        いまの丁目: {shop.chome ?? "未設定"}
        {shop.chomeLocked ? "（手で設定）" : ""}
        {autoChome && <><br />{describeChomeJudgement(autoChome)}</>}
        {!shop.chomeLocked && autoChome?.status === "ok" && normalizeChomeId(shop.chome) !== autoChome.chomeId && (
          <><br />今の丁目と自動判定が違います。</>
        )}
      </p>
      {/* 「自動」は、手で設定していない区画では選び直しても変わらず（同じ値の選択は onChange が呼ばれない）、
          今の丁目と自動判定がずれた既存の区画を直せないので、ボタンで直接直せるようにする */}
      {!shop.chomeLocked && autoChome?.status === "ok" && normalizeChomeId(shop.chome) !== autoChome.chomeId && (
        <button type="button" onClick={() => onChomeChange("auto")} style={{ ...buttonStyle, marginBottom: 12 }}>
          自動判定の値（{getChome(autoChome.chomeId)?.shortName}）にする
        </button>
      )}

      {shop.placeName && <div style={{ ...noteStyle, marginBottom: 12 }}>
        <p>出店場所: {shop.placeName}</p>
        <p>この場所に登録されている店舗（公開配置とは別）:</p>
        {shop.placeVendors?.length ? <ul>{shop.placeVendors.map((item) => <li key={item.id}><button type="button" onClick={() => setPreviewVendor(item.id)}>{item.name}</button>（<a href={`/admin/field/${item.id}`} target="_blank" rel="noopener noreferrer">詳細を開く</a>）</li>)}</ul> : <p>なし</p>}
      </div>}
      {vendor ? (
        <>
          <p style={{ ...label, marginTop: 4 }}>現在の公開配置</p>
          <p><button type="button" onClick={() => setPreviewVendor(vendor.id)}><strong>{vendor.name}</strong></button> <a href={`/admin/field/${vendor.id}`} target="_blank" rel="noopener noreferrer">現場登録で店舗情報を確認</a></p>
          {!shop.placeName && vendor.fieldObservation && <div style={{ ...noteStyle, marginBottom: 12 }}>
            <p style={label}>現場で記録した位置（確認用）</p>
            <p>記録日時: {new Date(vendor.fieldObservation.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}<br />
              緯度・経度: {vendor.fieldObservation.lat.toFixed(6)}, {vendor.fieldObservation.lng.toFixed(6)}<br />
              記録した店番: {vendor.fieldObservation.storeNumber ?? "未設定"}<br />
              記録方法: {vendor.fieldObservation.source === "gps" ? "GPS" : vendor.fieldObservation.source === "pin" ? "地図のピン" : "不明"}{vendor.fieldObservation.accuracyM != null ? `（誤差 約${vendor.fieldObservation.accuracyM}m）` : ""}</p>
            {vendor.fieldObservation.storeNumber != null && vendor.fieldObservation.storeNumber !== shop.position && <p style={errorNoteStyle}>記録した店番と、この区画の店番が異なります。位置をよく確認してください。</p>}
            <p>位置を確認して編集内容に追加し、「変更を保存」するとマップへ反映されます。道との紐づけは解除されます。</p>
            <button type="button" style={buttonStyle} onClick={() => {
              if (window.confirm("この区画を現場で記録した位置に移しますか？ 保存するまでマップには反映されません。")) onApplyFieldObservation?.();
            }}>現場の位置を編集内容に追加</button>
          </div>}
        </>
      ) : <p style={noteStyle}>現在の公開配置はありません。</p>}

      {previewVendor && <ShopPreview vendorId={previewVendor} position={shop.position} onClose={() => setPreviewVendor(null)} />}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onDelete}
          disabled={!!shop.vendorId || !!shop.placeName}
          title={shop.vendorId ? "出店者がいる区画は削除できません。先に「空きにする」で出店者を外してください" : shop.placeName ? "名前付きの出店場所は削除できません" : undefined}
          style={{ ...dangerButtonStyle, opacity: shop.vendorId || shop.placeName ? 0.45 : 1, cursor: shop.vendorId || shop.placeName ? "not-allowed" : "pointer" }}
        >
          この区画を削除
        </button>
      </div>
      {shop.vendorId && <p style={{ ...noteStyle, marginTop: 8 }}>区画を削除するには、先に「空きにする」で出店者を外してください。</p>}
      {shop.placeName && <p style={{ ...noteStyle, marginTop: 8 }}>名前付きの出店場所は削除できません。</p>}
    </div>
  );
}
