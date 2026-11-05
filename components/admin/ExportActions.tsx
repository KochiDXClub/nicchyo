"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui";

/** 一覧の CSV / JSON 出力ボタン（ページ見出しの actions に置く） */
export function ExportActions({
  onCsv,
  onJson,
  loading = false,
  compact = false,
}: {
  onCsv: () => void;
  onJson: () => void;
  loading?: boolean;
  /** 操作の多い見出しでは、出力形式を1つのメニューにまとめる */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="quiet" disabled={loading} className="shrink-0 px-4">
            <Download size={16} aria-hidden="true" />
            {loading ? "出力中…" : "出力"}
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={16} className="z-[10020] min-w-44 rounded-panel bg-white p-2 shadow-float ring-1 ring-line">
            {[{ label: "CSV出力", onSelect: onCsv }, { label: "JSON出力", onSelect: onJson }].map((item) => (
              <DropdownMenu.Item key={item.label} onSelect={item.onSelect} className="flex min-h-11 cursor-pointer items-center rounded-btn px-3 text-sm text-nicchyo-ink outline-none data-[highlighted]:bg-nicchyo-base">
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }
  return (
    <>
      <Button variant="quiet" size="sm" onClick={onCsv} disabled={loading} aria-label="CSVファイルをエクスポート">
        CSV出力
      </Button>
      <Button variant="quiet" size="sm" onClick={onJson} disabled={loading} aria-label="JSONファイルをエクスポート">
        JSON出力
      </Button>
    </>
  );
}
