"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchClosedDates, saveClosedDates } from "@/app/vendor/_services/closedDatesService";

// ─── 日付ユーティリティ（ローカル基準・UTCずれを避ける） ───────────────
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// 今日以降の日曜を count 個返す
function upcomingSundays(count: number): Date[] {
  const base = startOfToday();
  const offset = (7 - base.getDay()) % 7; // 次の日曜まで（当日日曜なら0）
  const first = new Date(base);
  first.setDate(base.getDate() + offset);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i * 7);
    return d;
  });
}

// 指定年月の週配列（日曜始まり、前後の空白は null）
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function ClosedDaysCalendar({
  vendorId,
  variant = "full",
}: {
  vendorId: string;
  variant?: "full" | "strip";
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const todayISO = useMemo(() => toISO(startOfToday()), []);

  // 平日をタップしたときの案内ポップ（約1秒で消える）
  const showWeekdayNotice = () => {
    setNotice(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(false), 1200);
  };
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // 最新の closed を参照するための ref（連続タップで古い値を掴まないように）
  const closedRef = useRef(closed);
  useEffect(() => {
    closedRef.current = closed;
  }, [closed]);

  useEffect(() => {
    let active = true;
    fetchClosedDates(vendorId)
      .then((dates) => {
        if (!active) return;
        setClosed(new Set(dates));
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [vendorId]);

  const toggle = (iso: string) => {
    const prev = closedRef.current;
    const next = new Set(prev);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    closedRef.current = next;
    setClosed(next);
    setSaving(true);
    saveClosedDates(vendorId, [...next].sort())
      .catch(() => {
        // 失敗したら元に戻す
        closedRef.current = prev;
        setClosed(prev);
      })
      .finally(() => setSaving(false));
  };

  const sundays = useMemo(() => upcomingSundays(variant === "strip" ? 6 : 8), [variant]);
  const weeks = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  // 設定できる範囲：今月〜12か月後まで
  const range = useMemo(() => {
    const now = new Date();
    const min = { year: now.getFullYear(), month: now.getMonth() };
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    const max = { year: maxDate.getFullYear(), month: maxDate.getMonth() };
    return { min, max };
  }, []);

  const ymIndex = (y: number, m: number) => y * 12 + m;
  const minIdx = ymIndex(range.min.year, range.min.month);
  const maxIdx = ymIndex(range.max.year, range.max.month);
  const viewIdx = ymIndex(view.year, view.month);
  const atMin = viewIdx <= minIdx;
  const atMax = viewIdx >= maxIdx;

  const stepMonth = (delta: number) => {
    const next = Math.min(maxIdx, Math.max(minIdx, viewIdx + delta));
    setView({ year: Math.floor(next / 12), month: next % 12 });
  };

  // 今月〜12か月後までを「年月」のひとつながりの選択肢にする
  const monthOptions = Array.from({ length: maxIdx - minIdx + 1 }, (_, i) => {
    const idx = minIdx + i;
    return { value: idx, label: `${Math.floor(idx / 12)}年${(idx % 12) + 1}月` };
  });
  const pickYearMonth = (idx: number) => {
    setView({ year: Math.floor(idx / 12), month: idx % 12 });
    setPickerOpen(false);
  };

  return (
    <div className="relative rounded-panel border border-amber-100 bg-white/85 p-5 shadow-card backdrop-blur-sm">
      {/* 平日タップ時の案内ポップ */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-6"
          >
            <span className="rounded-full bg-nicchyo-ink/90 px-4 py-2.5 text-center text-[13px] font-bold text-white shadow-lg">
              お休みを設定できるのは日曜日だけです
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-nicchyo-ink">出店しない日</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">お休みの日曜をタップで登録できます</p>
        </div>
        {saving && <span className="text-[11px] font-semibold text-amber-500">保存中…</span>}
      </div>

      {/* 日曜だけの横帯 */}
      <div className="mb-4">
        <p className="mb-2 text-[12px] font-bold text-amber-700">次の日曜市</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
          {sundays.map((d) => {
            const iso = toISO(d);
            const isClosed = closed.has(iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => toggle(iso)}
                disabled={!loaded}
                aria-pressed={isClosed}
                className={`flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition active:scale-95 ${
                  isClosed
                    ? "border-slate-200 bg-slate-100 text-slate-400"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <span className="text-[11px] font-semibold">{d.getMonth() + 1}月</span>
                <span className="font-display text-xl leading-none">
                  {d.getDate()}
                  <span className="ml-0.5 text-[10px] font-sans font-semibold">日</span>
                </span>
                <span className="text-[11px] font-bold">{isClosed ? "休み" : "出店"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {variant === "full" && (
        <div>
          {/* 月ナビ（年月をタップして縦ダイヤルで調整・12か月後まで） */}
          <div className="relative mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              disabled={atMin}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition active:scale-90 hover:bg-amber-50 disabled:opacity-25"
              aria-label="前の月"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className={`rounded-xl px-3 py-1 font-display text-lg text-nicchyo-ink transition active:scale-95 ${
                pickerOpen ? "bg-amber-100" : "hover:bg-amber-50"
              }`}
            >
              {view.year}年{view.month + 1}月
            </button>

            <button
              type="button"
              onClick={() => stepMonth(1)}
              disabled={atMax}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition active:scale-90 hover:bg-amber-50 disabled:opacity-25"
              aria-label="次の月"
            >
              <ChevronRight size={20} />
            </button>

            <AnimatePresence>
              {pickerOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="閉じる"
                    onClick={() => setPickerOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 rounded-2xl border border-amber-100 bg-white p-1.5 shadow-xl"
                  >
                    <Dial options={monthOptions} value={viewIdx} onSelect={pickYearMonth} />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 text-center">
            {WEEKDAY_LABELS.map((w, i) => (
              <span
                key={w}
                className={`py-1 text-[12px] font-bold ${
                  i === 0 ? "text-amber-700" : i === 6 ? "text-sky-500" : "text-slate-400"
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((d, i) => {
              if (!d) return <span key={`empty-${i}`} />;
              const iso = toISO(d);
              const isSunday = d.getDay() === 0;
              const isClosed = isSunday && closed.has(iso);
              const isToday = iso === todayISO;
              const isPast = iso < todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => (isSunday ? toggle(iso) : showWeekdayNotice())}
                  disabled={!loaded || isPast}
                  aria-pressed={isSunday ? isClosed : undefined}
                  className={`relative flex aspect-square items-center justify-center rounded-xl text-sm transition active:scale-90 ${
                    isClosed
                      ? "bg-slate-200 font-bold text-slate-400 line-through"
                      : isSunday
                        ? "bg-amber-50 font-bold text-amber-800 hover:bg-amber-100"
                        : "text-slate-300"
                  } ${isToday ? "ring-2 ring-amber-400" : ""} ${isPast ? "opacity-40" : ""}`}
                >
                  <span className="flex items-baseline justify-center">
                    {d.getDate()}
                    <span className="ml-px text-[9px] font-normal">日</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[12px] text-slate-400">
            日曜をタップすると「休み」に、もう一度タップで戻せます
          </p>
        </div>
      )}
    </div>
  );
}

// 縦ダイヤル（スクロール＋タップで選択、選択中は中央にハイライト）
function Dial({
  options,
  value,
  onSelect,
}: {
  options: { value: number; label: string }[];
  value: number;
  onSelect: (v: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = listRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-val="${value}"]`);
    if (container && el) {
      // コンテナ内だけをスクロール（ページを動かさない）
      container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    }
  }, [value]);

  return (
    <div className="relative">
      {/* 中央のハイライト帯 */}
      <div className="pointer-events-none absolute inset-x-1 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-amber-50 ring-1 ring-amber-200" />
      <div
        ref={listRef}
        className="relative max-h-[176px] snap-y snap-mandatory overflow-y-auto scrollbar-none py-[66px]"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              data-val={o.value}
              onClick={() => onSelect(o.value)}
              className={`flex h-11 w-full snap-center items-center justify-center rounded-lg text-lg transition ${
                active ? "font-display font-bold text-amber-800" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
