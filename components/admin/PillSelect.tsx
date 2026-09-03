"use client";

import { Children, isValidElement, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export interface PillSelectOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
}

/**
 * 管理画面用のピル型セレクター。
 * ネイティブの <select> は OS 依存で角ばって見えるため、Radix の DropdownMenu で描く。
 * `options` を渡すか、互換のために <option> の子要素からも読み取れる。
 */
export function PillSelect({
  value,
  onChange,
  options,
  children,
  label,
  placeholder = "選択",
  disabled = false,
  size = "sm",
  className = "",
  menuClassName = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options?: PillSelectOption[];
  /** <option value="..">ラベル</option> を並べてもよい（互換用） */
  children?: ReactNode;
  /** 左に添える見出し */
  label?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  menuClassName?: string;
}) {
  const resolved: PillSelectOption[] =
    options ??
    Children.toArray(children)
      .filter(isValidElement)
      .map((el) => {
        const props = el.props as { value?: unknown; children?: ReactNode };
        return { value: String(props.value ?? ""), label: props.children ?? String(props.value ?? "") };
      });
  const current = resolved.find((o) => o.value === value);

  const trigger =
    size === "md"
      ? "gap-2 rounded-full px-4 py-2.5 text-sm"
      : "gap-1.5 rounded-full px-3 py-1.5 text-sm";

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={`inline-flex max-w-[22rem] items-center bg-white font-medium text-slate-800 ring-1 ring-inset ring-slate-200 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary data-[state=open]:ring-2 data-[state=open]:ring-nicchyo-primary disabled:cursor-not-allowed disabled:opacity-50 ${trigger}`}
          >
            <span className="truncate">{current ? current.label : <span className="text-slate-400">{placeholder}</span>}</span>
            <svg className="h-3.5 w-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className={`z-[10020] max-h-[60vh] min-w-[200px] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/10 ${menuClassName}`}
          >
            <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
              {resolved.map((o) => (
                <DropdownMenu.RadioItem
                  key={o.value}
                  value={o.value}
                  className="flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none transition data-[highlighted]:bg-slate-50"
                >
                  <span className="flex-1">
                    <span className="block">{o.label}</span>
                    {o.description && <span className="block text-xs text-slate-400">{o.description}</span>}
                  </span>
                  <DropdownMenu.ItemIndicator>
                    <svg className="h-4 w-4 text-nicchyo-primary" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </label>
  );
}
