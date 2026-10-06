"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PAYMENT_OPTIONS, RAIN_OPTIONS } from "@/lib/vendor/storeOptions";
import { formatTime, isEndAfterStart, LAST_HOUR, parseTime, TIME_HOURS, TIME_MINUTES } from "@/lib/vendor/businessHours";
import type { PaymentMethod, RainPolicy } from "@/app/vendor/_types";
import PhotoPickerField from "./PhotoPickerField";
import { usePhotoPicker } from "./usePhotoPicker";
import {
  AskForm,
  DraftAddRow,
  RemovableChip,
  SkipLabelContext,
  choiceClass,
  fieldClass,
  type InputProps,
} from "./askFormParts";
import {
  CategoryInput,
  LineTextInput,
  OwnerInput,
  PhotoInput,
  ProductPricesInput,
  ScheduleInput,
  StyleInput,
} from "./ProfileInputs";

/** 質問の種類に合わせた入力欄。質問が変わるたびに状態を捨てたいので、呼び出し側で key を付ける */
export default function AskInput(props: InputProps & { skipLabel?: string }) {
  const { skipLabel, ...inputProps } = props;
  return (
    <SkipLabelContext.Provider value={skipLabel ?? "あとで"}>
      <AskInputBody {...inputProps} />
    </SkipLabelContext.Provider>
  );
}

function AskInputBody(props: InputProps) {
  switch (props.question.input) {
    case "product-list":
      return <ProductListInput {...props} />;
    case "hours":
      return <HoursInput {...props} />;
    case "signature":
      return <SignatureInput {...props} />;
    case "payment":
      return <PaymentInput {...props} />;
    case "rain":
      return <RainInput {...props} />;
    case "handle":
      return <SingleLineInput {...props} kind="handle" />;
    case "url":
      return <SingleLineInput {...props} kind="url" />;
    case "years":
      return <YearsInput {...props} />;
    case "long-text":
      return <LongTextInput {...props} />;
    case "line-text":
      return <LineTextInput {...props} />;
    case "photo":
      return <PhotoInput {...props} />;
    case "category":
      return <CategoryInput {...props} />;
    case "style":
      return <StyleInput {...props} />;
    case "owner":
      return <OwnerInput {...props} />;
    case "product-prices":
      return <ProductPricesInput {...props} />;
    case "schedule":
      return <ScheduleInput {...props} />;
  }
}

function ProductListInput({ snapshot, saving, onSubmit, onSkip, question }: InputProps) {
  const [items, setItems] = useState<string[]>(snapshot.weekly?.products ?? []);
  const [draft, setDraft] = useState("");

  const add = () => {
    const name = draft.trim();
    if (!name || items.includes(name)) return;
    setItems((prev) => [...prev, name]);
    setDraft("");
  };

  return (
    <AskForm
      canSubmit={items.length > 0 || draft.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => {
        // 入力欄に書いたまま「これでええ」を押しても、その分を落とさない
        const name = draft.trim();
        const products = name && !items.includes(name) ? [...items, name] : items;
        onSubmit({ id: "weekly-products", products });
      }}
    >
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <RemovableChip
                label={item}
                onRemove={() => setItems((prev) => prev.filter((name) => name !== item))}
              />
            </li>
          ))}
        </ul>
      )}
      <DraftAddRow
        value={draft}
        onChange={setDraft}
        onAdd={add}
        placeholder={question.placeholder}
        label="商品名"
      />
    </AskForm>
  );
}

/** 時刻の選択（時と分）。保存の形は "7:30"。分は10分刻み、24時は0分だけ（lib/vendor/businessHours.ts） */
function TimeSelect({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  const parsed = parseTime(value);
  const hour = parsed ? String(parsed.hour) : "";
  const minute = parsed ? parsed.minute : 0;

  return (
    <div className="grid grid-cols-[1fr_auto] gap-1.5">
      <select
        value={hour}
        onChange={(event) => (event.target.value ? onChange(formatTime(Number(event.target.value), Number(event.target.value) === LAST_HOUR ? 0 : minute)) : onChange(""))}
        aria-label={`${label}（時）`}
        className={fieldClass}
      >
        <option value="">{placeholder}</option>
        {TIME_HOURS.map((h) => (
          <option key={h} value={h}>
            {h}時
          </option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(event) => parsed && onChange(formatTime(parsed.hour, Number(event.target.value)))}
        disabled={!parsed || parsed.hour === LAST_HOUR}
        aria-label={`${label}（分）`}
        className={fieldClass}
      >
        {TIME_MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}分
          </option>
        ))}
      </select>
    </div>
  );
}

/** 保存の形（"7:30"）にそろえる。選べる時刻でなければ空（"06:00" のような形も "6:00" にする） */
function normalizeTime(value: string | undefined): string {
  const time = parseTime(value);
  return time ? formatTime(time.hour, time.minute) : "";
}

function HoursInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  // 10分刻みの時刻でない古い値（空・形式違い）は、選び直してもらう
  const [start, setStart] = useState(normalizeTime(snapshot.businessHoursStart));
  const [end, setEnd] = useState(normalizeTime(snapshot.businessHoursEnd));
  const valid = isEndAfterStart(start, end);

  return (
    <AskForm
      canSubmit={valid}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "hours", start, end })}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TimeSelect value={start} onChange={setStart} label="開始時間" placeholder="何時から" />
        <span className="text-nicchyo-ink/55" aria-hidden="true">
          〜
        </span>
        <TimeSelect value={end} onChange={setEnd} label="終了時間" placeholder="何時まで" />
      </div>
      <p className="text-xs text-nicchyo-ink/55">10分きざみで選べます（例：7時30分）。</p>
      {start && end && !valid && (
        <p className="text-sm text-rose-600">終わりは、始まりより後にしてや</p>
      )}
    </AskForm>
  );
}

function SignatureInput({ snapshot, saving, onSubmit, onSkip, question }: InputProps) {
  const existingImage = snapshot.signatureProduct?.imageUrl;
  const [name, setName] = useState(
    snapshot.signatureProduct?.name ?? snapshot.signatureNameHint ?? ""
  );
  const picker = usePhotoPicker(existingImage);
  const { file } = picker;

  return (
    <AskForm
      canSubmit={name.trim() !== "" && (!!file || !!existingImage)}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "signature", name, imageFile: file })}
    >
      <PhotoPickerField picker={picker} alt="看板商品の写真" />
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={question.placeholder}
        aria-label="商品名"
        className={fieldClass}
      />
    </AskForm>
  );
}

function PaymentInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>(snapshot.paymentMethods);
  const [note, setNote] = useState(snapshot.paymentNote ?? "");

  const toggle = (key: PaymentMethod) =>
    setMethods((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));

  return (
    <AskForm
      canSubmit={methods.length > 0 || note.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "payment", methods, note })}
    >
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={methods.includes(option.key)}
            onClick={() => toggle(option.key)}
            className={choiceClass(methods.includes(option.key))}
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="ほかにあれば（例：QUOカード）"
        aria-label="ほかの支払方法"
        className={fieldClass}
      />
    </AskForm>
  );
}

function RainInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  // 既定値の「当日判断」のままは未回答と区別がつかないので、答えるまで何も選ばせない
  const [policy, setPolicy] = useState<RainPolicy | null>(
    snapshot.rainAnswered ? snapshot.rainPolicy : null
  );
  const [note, setNote] = useState(snapshot.rainNote ?? "");

  return (
    <AskForm
      canSubmit={policy !== null}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => {
        if (policy) onSubmit({ id: "rain", policy, note });
      }}
    >
      <div className="flex flex-col gap-2">
        {RAIN_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={policy === option.key}
            onClick={() => setPolicy(option.key)}
            className={choiceClass(policy === option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="ひとこと（例：小雨なら出るよ）"
        aria-label="雨の日のひとこと"
        className={fieldClass}
      />
    </AskForm>
  );
}

/** URL は https:// を省いて入れる人が多いので、無ければ補う */
function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function SingleLineInput({
  snapshot,
  saving,
  onSubmit,
  onSkip,
  question,
  kind,
}: InputProps & { kind: "handle" | "url" }) {
  // 同じ「ID を聞く」入力欄を、インスタと X で使い回す
  const isX = question.id === "x";
  const [value, setValue] = useState(
    (kind === "url" ? snapshot.website : isX ? snapshot.snsX : snapshot.instagram) ?? ""
  );

  return (
    <AskForm
      canSubmit={value.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() =>
        onSubmit(
          kind === "url"
            ? { id: "website", value: normalizeUrl(value) }
            : { id: isX ? "x" : "instagram", value: value.trim() }
        )
      }
    >
      <input
        type={kind === "url" ? "url" : "text"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={question.placeholder}
        aria-label={kind === "url" ? "webサイトのURL" : isX ? "XのID" : "インスタグラムのID"}
        autoCapitalize="none"
        autoCorrect="off"
        inputMode={kind === "url" ? "url" : "text"}
        className={fieldClass}
      />
    </AskForm>
  );
}

function YearsInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [value, setValue] = useState(snapshot.yearsRunning != null ? String(snapshot.yearsRunning) : "");
  const years = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(years) && years >= 0 && years <= 100;

  return (
    <AskForm
      canSubmit={valid}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "years", years })}
    >
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="続けてきた年数"
          className={cn(fieldClass, "text-right")}
        />
        <span className="shrink-0 text-base font-semibold text-nicchyo-ink">年くらい</span>
      </div>
    </AskForm>
  );
}

type LongTextId = "signature-pr" | "strength" | "motivation" | "sunday-love";

function LongTextInput({ snapshot, saving, onSubmit, onSkip, question }: InputProps) {
  const id = question.id as LongTextId;
  const initial =
    {
      "signature-pr": snapshot.signatureProduct?.description,
      strength: snapshot.strength,
      motivation: snapshot.motivation,
      "sunday-love": snapshot.sundayLove,
    }[id] ?? "";
  const [text, setText] = useState(initial);

  return (
    <AskForm
      canSubmit={text.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id, text: text.trim() })}
    >
      {id === "signature-pr" && snapshot.signatureProduct && (
        <p className="text-sm font-semibold text-amber-800">
          {snapshot.signatureProduct.name}
        </p>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={question.placeholder}
        aria-label="こたえ"
        rows={4}
        maxLength={300}
        className={cn(fieldClass, "resize-none leading-relaxed")}
      />
    </AskForm>
  );
}
