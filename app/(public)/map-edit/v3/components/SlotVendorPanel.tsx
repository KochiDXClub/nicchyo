"use client";

import { useEffect, useState } from "react";
import { VENDOR_FIELD_LIMITS, slotLabel } from "../../../map/types/editableShop";
import type { ChomeJudgement } from "@/lib/map/chomeBoundaries";
import { CHOMES, getChome, normalizeChomeId, type ChomeId } from "@/lib/map/chomes";
import { EDITOR_COLORS } from "../editorTheme";
import type { EditableShop, EditableVendor, VendorCategory } from "../types";
import {
  buttonStyle,
  dangerButtonStyle,
  errorNoteStyle,
  inputStyle,
  label,
  noteStyle,
  panelWrap,
  primaryButtonStyle,
} from "./panelStyles";

type VendorDraft = Omit<EditableVendor, "id">;

const EMPTY_DRAFT: VendorDraft = { name: "", categoryId: null, strength: "", mainProducts: [] };

/** 「柚子、文旦, 生姜」のような入力を、主な商品の一覧に分ける */
export function parseMainProducts(text: string): string[] {
  return text
    .split(/[,、，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, VENDOR_FIELD_LIMITS.mainProductsMaxCount);
}

/**
 * 出店者の入力欄（店名・ジャンル・こだわり・主な商品）。
 * 主な商品は区切り文字を打っている途中で消えないよう、欄を離れたときに一覧へ直す。
 */
function VendorFields({
  value,
  categories,
  onChange,
  onProductsCommit,
}: {
  value: VendorDraft;
  categories: VendorCategory[];
  onChange: (patch: Partial<VendorDraft>, field: "name" | "categoryId" | "strength") => void;
  onProductsCommit: (products: string[]) => void;
}) {
  const [productsText, setProductsText] = useState(value.mainProducts.join("、"));
  const joined = value.mainProducts.join("、");
  // 取り消し・やり直しや別の出店者への切り替えで一覧が変わったら、入力欄も合わせる
  useEffect(() => setProductsText(joined), [joined]);

  return (
    <>
      <label>
        <span style={label}>店名（必須）</span>
        <input
          value={value.name}
          maxLength={VENDOR_FIELD_LIMITS.nameMaxLength}
          onChange={(e) => onChange({ name: e.target.value }, "name")}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={label}>ジャンル</span>
        <select
          value={value.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || null }, "categoryId")}
          style={inputStyle}
        >
          <option value="">（未設定）</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span style={label}>こだわり・説明</span>
        <textarea
          value={value.strength}
          maxLength={VENDOR_FIELD_LIMITS.strengthMaxLength}
          rows={3}
          onChange={(e) => onChange({ strength: e.target.value }, "strength")}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>
      <label>
        <span style={label}>主な商品（「、」で区切る・{VENDOR_FIELD_LIMITS.mainProductsMaxCount}件まで）</span>
        <input
          value={productsText}
          onChange={(e) => setProductsText(e.target.value)}
          onBlur={() => {
            const products = parseMainProducts(productsText);
            if (products.join("、") !== joined) onProductsCommit(products);
            else setProductsText(joined);
          }}
          style={inputStyle}
        />
      </label>
    </>
  );
}

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
 * - 空き区画: 登録済みの出店者から選ぶか、新しい出店者を入力して登録する
 * - 出店者のいる区画: その出店者の情報をその場で直す（直した内容は変更一覧に載り、取り消せる）
 */
export default function SlotVendorPanel({
  shop,
  roadName,
  vendor,
  vendors,
  categories,
  onSelectVendor,
  onRegisterVendor,
  onUpdateVendor,
  onClearVendor,
  onChomeChange,
  autoChome,
  onDelete,
}: {
  shop: EditableShop;
  /** 区画が乗っている道の名前（道基準の位置を持つ区画だけ） */
  roadName: string | null;
  /** この区画の出店者 */
  vendor: EditableVendor | null;
  vendors: EditableVendor[];
  categories: VendorCategory[];
  onSelectVendor: (vendorId: string) => void;
  onRegisterVendor: (draft: VendorDraft) => void;
  onUpdateVendor: (patch: Partial<VendorDraft>, logText: string, coalesceKey?: string) => void;
  onClearVendor: () => void;
  /** 丁目を選ぶ（手で設定）／"auto" で自動判定に戻す */
  onChomeChange: (value: ChomeId | "auto") => void;
  /** この区画の位置からの自動判定の結果（道の位置が無い区画は null） */
  autoChome: ChomeJudgement | null;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<VendorDraft>(EMPTY_DRAFT);
  // 別の区画を選んだら、入力途中の新しい出店者は捨てる
  useEffect(() => setDraft(EMPTY_DRAFT), [shop.locationId]);

  const fieldLog = { name: "の店名を変更", categoryId: "のジャンルを変更", strength: "のこだわりを変更" } as const;

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

      <label>
        <span style={label}>登録済みの出店者から選ぶ</span>
        <select value={shop.vendorId ?? ""} onChange={(e) => onSelectVendor(e.target.value)} style={inputStyle}>
          <option value="">（空き）</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      {vendor ? (
        <>
          <p style={{ ...label, marginTop: 4 }}>出店者の情報</p>
          <VendorFields
            value={vendor}
            categories={categories}
            onChange={(patch, field) =>
              onUpdateVendor(patch, fieldLog[field], field === "categoryId" ? undefined : `vendor-${field}:${vendor.id}`)
            }
            onProductsCommit={(mainProducts) => onUpdateVendor({ mainProducts }, "の主な商品を変更")}
          />
          {!vendor.name.trim() && <p style={errorNoteStyle}>店名が空のままでは保存できません。</p>}
          <p style={noteStyle}>地図のピンや下の区画レーンをドラッグすると、別の区画へ移せます（出店者がいれば入れ替え）。</p>
        </>
      ) : (
        <>
          <p style={{ ...label, marginTop: 4 }}>または、新しい出店者を登録</p>
          <VendorFields
            value={draft}
            categories={categories}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            onProductsCommit={(mainProducts) => setDraft((prev) => ({ ...prev, mainProducts }))}
          />
          <button
            type="button"
            disabled={!draft.name.trim()}
            onClick={() => {
              onRegisterVendor(draft);
              setDraft(EMPTY_DRAFT);
            }}
            style={{ ...primaryButtonStyle, opacity: draft.name.trim() ? 1 : 0.45, marginBottom: 12 }}
          >
            この区画に登録
          </button>
          <p style={noteStyle}>登録した出店者は、あとから出店者本人のアカウントに紐づけられます。</p>
        </>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {vendor && (
          <button type="button" onClick={onClearVendor} style={buttonStyle} title="出店者の情報は消さず、この区画から外します">
            空きにする
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={!!shop.vendorId}
          title={shop.vendorId ? "出店者がいる区画は削除できません。先に「空きにする」で出店者を外してください" : undefined}
          style={{ ...dangerButtonStyle, opacity: shop.vendorId ? 0.45 : 1, cursor: shop.vendorId ? "not-allowed" : "pointer" }}
        >
          この区画を削除
        </button>
      </div>
      {shop.vendorId && <p style={{ ...noteStyle, marginTop: 8 }}>区画を削除するには、先に「空きにする」で出店者を外してください。</p>}
    </div>
  );
}
