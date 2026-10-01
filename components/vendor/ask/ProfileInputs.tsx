"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { STYLE_PRESETS, WEEKDAY_OPTIONS } from "@/lib/vendor/storeOptions";
import { AskForm, DraftAddRow, RemovableChip, choiceClass, fieldClass, type InputProps } from "./askFormParts";
import PhotoPickerField from "./PhotoPickerField";
import { usePhotoPicker } from "./usePhotoPicker";

// 店舗情報の基本項目（編集画面の質問）の入力欄。トップの質問の入力欄は AskInputs にある。

export function LineTextInput({ snapshot, saving, onSubmit, onSkip, question }: InputProps) {
  const [text, setText] = useState(snapshot.shopName ?? "");
  return (
    <AskForm
      canSubmit={text.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "shop-name", text: text.trim() })}
    >
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={question.placeholder}
        aria-label="お店の名前"
        maxLength={40}
        className={fieldClass}
      />
    </AskForm>
  );
}

export function PhotoInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const picker = usePhotoPicker(snapshot.shopImageUrl);
  const { file } = picker;
  return (
    <AskForm
      canSubmit={!!file}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => file && onSubmit({ id: "shop-photo", imageFile: file })}
    >
      <PhotoPickerField picker={picker} alt="お店の写真" className="h-52" />
      <p className="text-center text-xs text-nicchyo-ink/55">
        マップの吹き出しと、お店のページのバナーに出るきね
      </p>
    </AskForm>
  );
}

export function CategoryInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [selected, setSelected] = useState(snapshot.categoryId ?? "");
  return (
    <AskForm
      canSubmit={selected !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "category", categoryId: selected })}
    >
      {snapshot.categoryOptions.length === 0 ? (
        <p className="text-sm text-nicchyo-ink/55">読み込みよるよ…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {snapshot.categoryOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected === option.id}
              onClick={() => setSelected(option.id)}
              className={choiceClass(selected === option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </AskForm>
  );
}

/** 文字を足していくタグの入力。出店スタイルと出店日で使う */
function TagEditor({
  items,
  onChange,
  presets,
  placeholder,
  label,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  presets: readonly string[];
  placeholder: string;
  label: string;
}) {
  const [draft, setDraft] = useState("");

  const toggle = (value: string) =>
    onChange(items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);

  const addDraft = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={items.includes(preset)}
            onClick={() => toggle(preset)}
            className={cn(
              "min-h-9 rounded-chip px-3.5 text-sm font-semibold transition",
              items.includes(preset)
                ? "bg-amber-50 text-amber-900 ring-2 ring-amber-500"
                : "bg-white text-nicchyo-ink ring-1 ring-line"
            )}
          >
            {preset}
          </button>
        ))}
        {items
          .filter((item) => !presets.includes(item))
          .map((item) => (
            <RemovableChip key={item} label={item} tone="selected" onRemove={() => toggle(item)} />
          ))}
      </div>
      <DraftAddRow value={draft} onChange={setDraft} onAdd={addDraft} placeholder={placeholder} label={label} />
    </div>
  );
}

export function StyleInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [tags, setTags] = useState(snapshot.styleTags);
  const [note, setNote] = useState(snapshot.style ?? "");
  return (
    <AskForm
      canSubmit={tags.length > 0 || note.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "style", tags, note })}
    >
      <TagEditor
        items={tags}
        onChange={setTags}
        presets={STYLE_PRESETS}
        placeholder="ほかのスタイル（例：朝市限定）"
        label="ほかのスタイル"
      />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="ひとこと（例：試食あり・数量限定）"
        aria-label="お店のひとこと"
        rows={2}
        maxLength={80}
        className={cn(fieldClass, "resize-none leading-relaxed")}
      />
    </AskForm>
  );
}

export function ScheduleInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [items, setItems] = useState(snapshot.schedule);
  return (
    <AskForm
      canSubmit={items.length > 0}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "schedule", items })}
    >
      <TagEditor
        items={items}
        onChange={setItems}
        presets={WEEKDAY_OPTIONS}
        placeholder="ほかの日程（例：年末のみ）"
        label="ほかの日程"
      />
    </AskForm>
  );
}

export function OwnerInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [name, setName] = useState(snapshot.ownerName ?? "");
  const [isPublic, setIsPublic] = useState(snapshot.ownerNamePublic);
  return (
    <AskForm
      canSubmit={name.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "owner", name: name.trim(), isPublic })}
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="（例）山田 太郎"
        aria-label="店主さんのお名前"
        maxLength={40}
        className={fieldClass}
      />
      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        onClick={() => setIsPublic((value) => !value)}
        className={choiceClass(isPublic)}
      >
        <span
          className={cn(
            "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition",
            isPublic ? "justify-end bg-amber-500" : "justify-start bg-nicchyo-ink/20"
          )}
          aria-hidden="true"
        >
          <span className="h-4 w-4 rounded-full bg-white shadow-chip" />
        </span>
        お店のページにお名前を出す
      </button>
      <p className="text-xs leading-relaxed text-nicchyo-ink/55">
        オフのあいだは、お客さんには見えん。お名前がAIの答えに使われることもないきね。
      </p>
    </AskForm>
  );
}

type PriceRow = { name: string; price: string };

export function ProductPricesInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [rows, setRows] = useState<PriceRow[]>(
    snapshot.products.map((product) => ({
      name: product.name,
      price: product.price == null ? "" : String(product.price),
    }))
  );
  const [draftName, setDraftName] = useState("");
  const [draftPrice, setDraftPrice] = useState("");

  const addDraft = () => {
    const name = draftName.trim();
    if (!name || rows.some((row) => row.name === name)) return;
    setRows((prev) => [...prev, { name, price: draftPrice.trim() }]);
    setDraftName("");
    setDraftPrice("");
  };

  const toItems = (list: PriceRow[]) =>
    list.map((row) => {
      const price = row.price.trim() === "" ? null : Number.parseInt(row.price, 10);
      return { name: row.name, price: price === null || Number.isNaN(price) || price < 0 ? null : price };
    });

  return (
    <AskForm
      canSubmit={rows.length > 0 || draftName.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => {
        // 入力欄に書いたまま「これでええ」を押しても、その商品を落とさない
        const name = draftName.trim();
        const all =
          name && !rows.some((row) => row.name === name)
            ? [...rows, { name, price: draftPrice.trim() }]
            : rows;
        onSubmit({ id: "products", items: toItems(all) });
      }}
    >
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate rounded-btn bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                {row.name}
              </span>
              <label className="flex w-28 shrink-0 items-center gap-1 rounded-btn bg-nicchyo-base px-3 py-2.5 ring-1 ring-line">
                <span className="text-xs text-nicchyo-ink/55">¥</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.price}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, price: event.target.value } : item))
                    )
                  }
                  placeholder="未設定"
                  aria-label={`${row.name}の値段`}
                  className="w-full min-w-0 bg-transparent text-right text-sm outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`${row.name}を外す`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-nicchyo-ink/55"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            addDraft();
          }}
          placeholder="商品名（例：トマト）"
          aria-label="商品名"
          enterKeyHint="next"
          className={fieldClass}
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={draftPrice}
          onChange={(event) => setDraftPrice(event.target.value)}
          placeholder="¥"
          aria-label="値段"
          className={cn(fieldClass, "w-24 shrink-0 text-right")}
        />
        <Button type="button" variant="secondary" size="icon" onClick={addDraft} aria-label="追加する">
          <Plus size={18} aria-hidden="true" />
        </Button>
      </div>
      <p className="text-xs text-nicchyo-ink/55">値段は空のままでもええよ</p>
    </AskForm>
  );
}
