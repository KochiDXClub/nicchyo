"use client";

import * as React from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 名前で探して選ぶ入力欄（検索できるセレクト）。
 *
 * 候補が多い名前一覧（場所・店舗など）を、入力して絞り込みながら選べるようにする。
 * ARIA の combobox パターンに沿い、キーボードは ↑↓ で候補を移し、Enter で決め、Esc で閉じる。
 * 候補をクリックすると、入力が終わるのを待たずに決まる。
 */
export type ComboboxOption = {
  value: string;
  label: string;
  /** 候補の下に小さく出す補足。検索の対象にもなる */
  description?: string;
};

export type ComboboxProps = {
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

const inputClass = "w-full rounded-lg border border-nicchyo-ink/20 bg-white px-3 py-2 text-base text-nicchyo-ink disabled:opacity-50";

export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = "名前で探す",
  emptyText = "一致する候補がありません",
  disabled = false,
  className,
}: ComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(needle));
  }, [options, query]);
  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0));
  const activeId = filtered.length ? `${id}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (open && activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeId]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive(Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      if (open && filtered[activeIndex]) {
        event.preventDefault();
        choose(filtered[activeIndex]);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="block text-sm font-bold">{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? activeId : undefined}
        className={cn(inputClass, "mt-1")}
        disabled={disabled}
        placeholder={open && selected ? selected.label : placeholder}
        value={open ? query : selected?.label ?? ""}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={close}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-nicchyo-ink/20 bg-white py-1">
          {filtered.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={cn("cursor-pointer px-3 py-2 text-sm text-nicchyo-ink", index === activeIndex && "bg-nicchyo-soft-green/40", option.value === value && "font-bold")}
              onMouseDown={(event) => { event.preventDefault(); choose(option); }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="block">{option.label}</span>
              {option.description && <span className="block text-xs text-nicchyo-ink/70">{option.description}</span>}
            </li>
          ))}
          {!filtered.length && <li role="presentation" className="px-3 py-2 text-sm text-nicchyo-ink/70">{emptyText}</li>}
        </ul>
      )}
    </div>
  );
}
