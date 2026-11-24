import type { RefObject } from "react";
import { Mic, Send } from "lucide-react";
import { useT } from "@/lib/i18n/LocaleContext";
import { isImeComposing } from "@/lib/utils/isImeComposing";

type Props = {
  textInputRef: RefObject<HTMLInputElement>;
  typed: string;
  setTyped: (value: string) => void;
  speakerName: string;
  isBusy: boolean;
  micSupported: boolean;
  listening: boolean;
  onMic: () => void;
  onSubmit: (question: string) => void;
};

export default function ConsultComposer({
  textInputRef, typed, setTyped, speakerName, isBusy, micSupported, listening, onMic, onSubmit,
}: Props) {
  const t = useT();
  function submit() {
    const question = typed.trim();
    if (isBusy || !question) return;
    setTyped("");
    onSubmit(question);
  }

  return (
    <div className="contents lg:col-start-2 lg:flex lg:items-center lg:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-amber-200 bg-white/95 py-1.5 pl-4 pr-1.5 shadow-float focus-within:ring-2 focus-within:ring-amber-600">
        <input
          ref={textInputRef}
          type="text"
          maxLength={1000}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // 日本語入力の変換確定の Enter で、未確定テキストのまま送信してしまわないようにする
            if (isImeComposing(event)) return;
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          // 応答待ちの間は押せない状態で残す。押せないことは送信・マイクのボタンが
          // 薄くなることで伝わるので、入力欄自体は薄くせず「考えよるよ…」を読める濃さで出す
          placeholder={isBusy ? t("考えよるよ…") : t("（例）今の旬の果物は？")}
          aria-label={t("{name}への質問").replace("{name}", speakerName)}
          enterKeyHint="send"
          disabled={isBusy}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-nicchyo-ink outline-none placeholder:text-nicchyo-ink/60 disabled:placeholder:text-amber-700"
        />
        <button
          type="button"
          disabled={isBusy || !typed.trim()}
          onClick={submit}
          aria-label={t("聞く")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-amber-700 text-white shadow-sm transition disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {micSupported && (
        <button
          type="button"
          onClick={onMic}
          disabled={isBusy}
          aria-label={listening ? t("とめる") : t("音声で聞く")}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition disabled:opacity-50 ${
            listening
              ? "bg-red-500 text-white"
              : "border border-amber-200 bg-white/95 text-amber-800"
          }`}
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
