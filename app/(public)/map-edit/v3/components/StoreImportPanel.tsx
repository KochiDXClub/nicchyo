"use client";

import { useMemo, useState } from "react";
import { downloadCsvTemplate } from "@/lib/admin/exportUtils";
import { decodeCsvBuffer } from "@/lib/csv/parseCsv";
import {
  STORE_CSV_HEADERS,
  defaultImportRoads,
  parseStoreCsv,
  planStoreImport,
  type ImportIssue,
  type StoreCsvRow,
  type StoreImportPlan,
} from "../storeCsvImport";
import type { EditableRoad, EditableShop, EditableVendor, VendorCategory } from "../types";
import {
  buttonStyle,
  errorNoteStyle,
  inputStyle,
  label,
  noteStyle,
  panelWrap,
  primaryButtonStyle,
} from "./panelStyles";

const TEMPLATE_FILENAME = "stores_import_template.csv";
/** 一覧に出す問題の最大件数（多すぎるとパネルが埋まるため） */
const MAX_LISTED_ISSUES = 30;

function IssueList({ issues, tone }: { issues: ImportIssue[]; tone: "error" | "warning" }) {
  if (issues.length === 0) return null;
  return (
    <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 10, fontSize: 11.5, lineHeight: 1.6 }}>
      {issues.slice(0, MAX_LISTED_ISSUES).map((issue, i) => (
        <div key={i} style={tone === "error" ? { ...errorNoteStyle, margin: 0, fontWeight: 400 } : undefined}>
          {issue.line != null ? `${issue.line} 行目：` : ""}
          {issue.message}
        </div>
      ))}
      {issues.length > MAX_LISTED_ISSUES && <div>ほか {issues.length - MAX_LISTED_ISSUES} 件</div>}
    </div>
  );
}

/**
 * 出店者の住所録 CSV の取り込み。CSV を読み、取り込み先の道と削除の有無を選んで内容を確かめ、
 * 「取り込む」でマップ編集の1件の操作として当てはめる（保存は「変更を保存」でふだんどおり行う）。
 */
export default function StoreImportPanel({
  roads,
  shops,
  vendors,
  categories,
  onApply,
  onClose,
}: {
  roads: EditableRoad[];
  shops: EditableShop[];
  vendors: EditableVendor[];
  categories: VendorCategory[];
  onApply: (plan: StoreImportPlan) => void;
  onClose: () => void;
}) {
  const usableRoads = useMemo(() => roads.filter((road) => road.points.length >= 2), [roads]);
  const defaults = useMemo(() => defaultImportRoads(usableRoads), [usableRoads]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ rows: StoreCsvRow[]; errors: ImportIssue[] } | null>(null);
  // 今ある区画は仮のデータなので、最初の取り込みでは置き換える前提にする
  const [replace, setReplace] = useState(true);
  // 出店者ごと消すと商品・投稿も戻せなくなるため、自分で選んだときだけ有効にする
  const [deleteVendors, setDeleteVendors] = useState(false);

  const plan = useMemo(
    () =>
      parsed
        ? planStoreImport({
            rows: parsed.rows,
            parseErrors: parsed.errors,
            shops,
            vendors,
            categories,
            roads: defaults,
            replace,
            deleteVendors,
          })
        : null,
    [parsed, shops, vendors, categories, defaults, replace, deleteVendors]
  );

  const readFile = async (file: File) => {
    setFileName(file.name);
    setParsed(parseStoreCsv(decodeCsvBuffer(await file.arrayBuffer())));
  };


  return (
    <div style={panelWrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 900 }}>出店者 CSV の取り込み</span>
        <button type="button" onClick={onClose} style={{ ...buttonStyle, padding: "4px 10px" }}>
          閉じる
        </button>
      </div>
      <p style={noteStyle}>
        1行が1区画・1出店者です。列は「{STORE_CSV_HEADERS.join("・")}」（本番号・丁目・側は必須）。側は「北」「南」「大橋通り」のどれかにします。
      </p>
      <button
        type="button"
        onClick={() => downloadCsvTemplate([...STORE_CSV_HEADERS], TEMPLATE_FILENAME)}
        style={{ ...buttonStyle, marginBottom: 12 }}
      >
        テンプレートをダウンロード
      </button>

      <label>
        <span style={label}>CSV ファイル</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
          }}
          style={{ ...inputStyle, padding: 6 }}
        />
      </label>

      {/* 置く道は道の名前から自動で決める（storeCsvImport.ts の defaultImportRoads） */}
      <p style={noteStyle}>
        区画を置く道：「北」「南」は {defaults.northSouth ? `「${defaults.northSouth.name}」` : "（追手筋の道がありません）"}、
        「大橋通り」は{" "}
        {defaults.ohashi ? `「${defaults.ohashi.name}」` : "（大橋通りの道がまだ無いので、その行は飛ばして取り込みます）"}
      </p>
      <label style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, marginBottom: 10 }}>
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        <span>CSV に無い区画を削除する（今の区画を置き換える。出店者の情報は消さず、割り当てだけ外れます）</span>
      </label>
      <label
        style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, marginBottom: 10, opacity: replace ? 1 : 0.45 }}
      >
        <input
          type="checkbox"
          checked={replace && deleteVendors}
          disabled={!replace}
          onChange={(e) => setDeleteVendors(e.target.checked)}
        />
        <span>
          削除する区画にいた出店者のデータも削除する（商品・投稿もまとめて消え、元に戻せません。ほかの区画に残る出店者と、区画にいなかった出店者は消しません）
        </span>
      </label>

      {plan && (
        <>
          <p style={noteStyle} aria-live="polite">
            {fileName}：{plan.rowCount} 行
            {plan.skippedRowCount > 0 && `（大橋通りの道が無いため ${plan.skippedRowCount} 行を飛ばします）`}
            <br />
            区画 新規 {plan.createdSlotCount}・更新 {plan.updatedSlotCount}・削除 {plan.deletedSlotCount}
            <br />
            出店者 新規 {plan.createdVendorCount}・更新 {plan.updatedVendorCount}・既存を割り当て {plan.reusedVendorCount}・削除{" "}
            {plan.deletedVendorCount}
          </p>
          {plan.deletedVendorCount > 0 && (
            <p role="alert" style={errorNoteStyle}>
              出店者 {plan.deletedVendorCount} 件を、商品・投稿ごと削除します。「変更を保存」を押すと元に戻せません。
            </p>
          )}
          {plan.errors.length > 0 && (
            <>
              <p role="alert" style={errorNoteStyle}>
                取り込めない行があります（{plan.errors.length} 件）。CSV を直してから選び直してください。
              </p>
              <IssueList issues={plan.errors} tone="error" />
            </>
          )}
          {plan.warnings.length > 0 && (
            <details style={{ marginBottom: 10, fontSize: 12 }}>
              <summary>確認してほしいこと（{plan.warnings.length} 件）</summary>
              <IssueList issues={plan.warnings} tone="warning" />
            </details>
          )}
          <p style={noteStyle}>
            新しい区画は道の上に丁目・番号の順で等間隔に並べます。正確な位置は、取り込んだあとに区画分けやドラッグで直せます。取り込んだ内容は変更一覧に載り、取り消せます。保存は「変更を保存」で行います。
          </p>
          <button
            type="button"
            disabled={!plan.next}
            onClick={() => {
              if (
                plan.deletedVendorCount > 0 &&
                !window.confirm(`出店者 ${plan.deletedVendorCount} 件を、商品・投稿ごと削除する取り込みです。よろしいですか？\n（保存するまでは、変更一覧から取り消せます）`)
              ) {
                return;
              }
              onApply(plan);
            }}
            style={{ ...primaryButtonStyle, opacity: plan.next ? 1 : 0.45 }}
          >
            取り込む
          </button>
        </>
      )}
    </div>
  );
}
