"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { Camera, Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { canDecodeImage, IMAGE_DECODE_ERROR_MESSAGE } from "@/lib/image/clientCompression";
import { PAYMENT_OPTIONS, RAIN_OPTIONS, TIME_OPTIONS } from "@/lib/vendor/storeOptions";
import type { PaymentMethod, RainPolicy } from "@/app/vendor/_types";
import type { AskAnswer, AskQuestion, VendorAskSnapshot } from "@/lib/vendor/askQuestions";

const fieldClass =
  "w-full rounded-btn bg-nicchyo-base px-4 py-3 text-base text-nicchyo-ink ring-1 ring-line placeholder:text-nicchyo-ink/40 focus:outline-none focus:ring-2 focus:ring-amber-500/60";

const choiceClass = (selected: boolean) =>
  cn(
    "flex min-h-11 items-center gap-2 rounded-btn px-4 py-2.5 text-left text-sm font-semibold transition",
    selected
      ? "bg-amber-50 text-amber-900 ring-2 ring-amber-500"
      : "bg-white text-nicchyo-ink ring-1 ring-line"
  );

/** 当日判断を選んで補足が空のときに入れる文。未回答（既定値のまま）と見分けるため */
const UNDECIDED_RAIN_NOTE = RAIN_OPTIONS.find((option) => option.key === "undecided")?.desc ?? "";

type AskFormProps = {
  canSubmit: boolean;
  saving: boolean;
  onSubmit: () => void;
  onSkip: () => void;
  children: ReactNode;
};

/** 入力欄の下に「これでええ」「あとで」を置く共通の枠 */
function AskForm({ canSubmit, saving, onSubmit, onSkip, children }: AskFormProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !saving) onSubmit();
  };
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {children}
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!canSubmit || saving}>
          {saving ? "保存しよるよ…" : "これでええ！"}
        </Button>
        <Button type="button" variant="quiet" size="sm" disabled={saving} onClick={onSkip}>
          あとで
        </Button>
      </div>
    </form>
  );
}

type InputProps = {
  question: AskQuestion;
  snapshot: VendorAskSnapshot;
  saving: boolean;
  onSubmit: (answer: AskAnswer) => void;
  onSkip: () => void;
};

/** 質問の種類に合わせた入力欄。質問が変わるたびに状態を捨てたいので、呼び出し側で key を付ける */
export default function AskInput(props: InputProps) {
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
            <li
              key={item}
              className="flex items-center gap-1.5 rounded-chip bg-amber-50 py-1.5 pl-3.5 pr-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200"
            >
              {item}
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((name) => name !== item))}
                aria-label={`${item}を外す`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-amber-700"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // 日本語変換の確定 Enter で追加してしまわないようにする
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            add();
          }}
          placeholder={question.placeholder}
          aria-label="商品名"
          enterKeyHint="done"
          className={fieldClass}
        />
        <Button type="button" variant="secondary" size="icon" onClick={add} aria-label="追加する">
          <Plus size={18} aria-hidden="true" />
        </Button>
      </div>
    </AskForm>
  );
}

function HoursInput({ snapshot, saving, onSubmit, onSkip }: InputProps) {
  const [start, setStart] = useState(snapshot.businessHoursStart ?? "");
  const [end, setEnd] = useState(snapshot.businessHoursEnd ?? "");
  const valid = !!start && !!end && TIME_OPTIONS.indexOf(end) > TIME_OPTIONS.indexOf(start);

  return (
    <AskForm
      canSubmit={valid}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "hours", start, end })}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select
          value={start}
          onChange={(event) => setStart(event.target.value)}
          aria-label="開始時間"
          className={fieldClass}
        >
          <option value="">何時から</option>
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <span className="text-nicchyo-ink/55" aria-hidden="true">
          〜
        </span>
        <select
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          aria-label="終了時間"
          className={fieldClass}
        >
          <option value="">何時まで</option>
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </div>
      {start && end && !valid && (
        <p className="text-sm text-rose-600">終わりは、始まりより後にしてや</p>
      )}
    </AskForm>
  );
}

function SignatureInput({ snapshot, saving, onSubmit, onSkip, question }: InputProps) {
  const existingImage = snapshot.signatureProduct?.imageUrl;
  const [name, setName] = useState(snapshot.signatureProduct?.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(existingImage ?? null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    },
    []
  );

  const handleFile = async (selected: File | undefined) => {
    if (!selected) return;
    // 保存時の変換でつまずく前に、このブラウザで読める写真かを確かめる
    if (!(await canDecodeImage(selected))) {
      setError(IMAGE_DECODE_ERROR_MESSAGE);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(selected);
    setFile(selected);
    setPreview(blobUrlRef.current);
  };

  return (
    <AskForm
      canSubmit={name.trim() !== "" && (!!file || !!existingImage)}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => onSubmit({ id: "signature", name, imageFile: file })}
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label={preview ? "写真を変える" : "写真を選ぶ"}
        className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-card bg-nicchyo-base text-nicchyo-ink/55 ring-1 ring-line"
      >
        {preview ? (
          <Image
            src={preview}
            alt="看板商品の写真"
            fill
            sizes="(min-width: 640px) 32rem, 100vw"
            unoptimized={preview.startsWith("blob:")}
            className="object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-sm font-semibold">
            <Camera size={28} aria-hidden="true" />
            写真を撮る・選ぶ
          </span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(event) => void handleFile(event.target.files?.[0])}
        className="hidden"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
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
    snapshot.rainPolicy !== "undecided" || snapshot.rainNote ? snapshot.rainPolicy : null
  );
  const [note, setNote] = useState(snapshot.rainNote ?? "");

  return (
    <AskForm
      canSubmit={policy !== null}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() => {
        if (!policy) return;
        const finalNote = note.trim() || (policy === "undecided" ? UNDECIDED_RAIN_NOTE : "");
        onSubmit({ id: "rain", policy, note: finalNote });
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
  const [value, setValue] = useState(
    (kind === "handle" ? snapshot.instagram : snapshot.website) ?? ""
  );

  return (
    <AskForm
      canSubmit={value.trim() !== ""}
      saving={saving}
      onSkip={onSkip}
      onSubmit={() =>
        onSubmit(
          kind === "handle"
            ? { id: "instagram", value: value.trim() }
            : { id: "website", value: normalizeUrl(value) }
        )
      }
    >
      <input
        type={kind === "url" ? "url" : "text"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={question.placeholder}
        aria-label={kind === "handle" ? "インスタグラムのID" : "webサイトのURL"}
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
