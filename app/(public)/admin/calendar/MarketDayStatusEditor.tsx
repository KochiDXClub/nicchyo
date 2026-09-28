import { getStatusPresentation, type MarketDayStatus } from "@/lib/market/calendar";

const STATUS_OPTIONS: { value: MarketDayStatus; hint: string }[] = [
  { value: "open", hint: "通常どおり開催" },
  { value: "cancelled", hint: "荒天などで中止" },
  { value: "special", hint: "特別開催・拡大開催" },
  { value: "closed", hint: "臨時休市" },
];

const STATUS_BUTTON_CLASS: Record<MarketDayStatus, string> = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-rose-300 bg-rose-50 text-rose-800",
  special: "border-amber-300 bg-amber-50 text-amber-800",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
};

/** カードを畳んだままでも今の公開状態が分かる小さな札 */
export function MarketDayStatusChip({ status }: { status: MarketDayStatus | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">未設定</span>
    );
  }
  const { label } = getStatusPresentation(status);
  const tone =
    status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

/**
 * 開催ステータスの4択切替＋一言。/admin/calendar の日曜カード内に置く。
 *
 * ボタンを押した時点では選ぶだけで公開されない（下書きなしで即座に公開されると
 * 誤操作がそのまま来訪者に見えてしまうため）。「保存する」を押して初めて公開される。
 */
export function MarketDayStatusEditor({
  committedStatus,
  draftStatus,
  noteDraft,
  isDirty,
  isSaving,
  recentNotes,
  onSelectStatus,
  onSetNoteDraft,
  onSave,
}: {
  committedStatus: MarketDayStatus | null;
  draftStatus: MarketDayStatus | null;
  noteDraft: string;
  isDirty: boolean;
  isSaving: boolean;
  recentNotes: string[];
  onSelectStatus: (status: MarketDayStatus) => void;
  onSetNoteDraft: (note: string) => void;
  onSave: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">開催ステータス</span>
        {committedStatus ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            公開中：{getStatusPresentation(committedStatus).label}
          </span>
        ) : (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-400">
            未設定（通常開催として扱われます）
          </span>
        )}
        {isDirty && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            未保存の変更があります
          </span>
        )}
      </div>

      {/* 選ぶだけ。ここではまだ保存しない */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUS_OPTIONS.map((option) => {
          const isSelected = draftStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={isSaving}
              onClick={() => onSelectStatus(option.value)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left transition disabled:opacity-40 ${
                isSelected
                  ? STATUS_BUTTON_CLASS[option.value]
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className="block text-sm font-bold">
                {getStatusPresentation(option.value).label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight opacity-70">
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <label className="text-xs font-semibold text-slate-600">一言（任意・200文字まで）</label>
        <input
          type="text"
          value={noteDraft}
          maxLength={200}
          placeholder="雨天のため中止します／判断は当日朝6時"
          onChange={(e) => onSetNoteDraft(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
        {recentNotes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recentNotes.map((note) => (
              <button
                key={note}
                type="button"
                onClick={() => onSetNoteDraft(note)}
                className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 hover:border-amber-300 hover:bg-amber-50"
                title={note}
              >
                {note}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={isSaving || !draftStatus || !isDirty}
        title={!draftStatus ? "先にステータスを選んでください" : undefined}
        onClick={onSave}
        className="mt-3 w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isSaving ? "保存中..." : "保存する（公開されます）"}
      </button>
    </div>
  );
}
