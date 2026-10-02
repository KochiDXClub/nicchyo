"use client";

import { Camera, Check, Eye, History, Image as ImageIcon, Pencil, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Box, Finger, POP_IN, SURFACE, useTyped, type Rect, type SceneProps } from "../primitives";

const TAKE: Rect = { x: 20, y: 14, w: 134, h: 100 };
const PICK: Rect = { x: 166, y: 14, w: 134, h: 100 };
const TILE: Rect = { x: 86, y: 14, w: 148, h: 100 };
const NOTE: Rect = { x: 18, y: 124, w: 284, h: 28 };
const SEND: Rect = { x: 126, y: 162, w: 176, h: 28 };
const SAY = "朝どれのトマト、あと10個";

/** 近況を出す。工程: 0 「撮る」か「写真を選ぶ」/ 1 写真が入る / 2 ひとこと / 3 「近況に出す」で公開 */
export function PostPhotoScene({ step }: SceneProps) {
  const typed = useTyped(SAY, step === 2 ? "typing" : step >= 3 ? "done" : "idle");
  const hasPhoto = step >= 1;
  const finger = step === 0 ? TAKE : step === 1 ? null : step === 2 ? NOTE : SEND;

  return (
    <>
      {!hasPhoto && (
        <>
          <Box rect={TAKE} className="flex flex-col items-center justify-center gap-1.5 rounded-card bg-amber-500 text-[15px] font-bold text-white shadow-pop">
            <Camera size={26} aria-hidden="true" />
            撮る
          </Box>
          <Box rect={PICK} className={cn(SURFACE, "flex flex-col items-center justify-center gap-1.5 rounded-card text-[15px] font-bold text-amber-800")}>
            <ImageIcon size={26} aria-hidden="true" />
            写真を選ぶ
          </Box>
        </>
      )}
      {hasPhoto && (
        <Box rect={TILE} {...POP_IN} className="overflow-hidden rounded-card bg-amber-200 shadow-card">
          <span className="absolute inset-x-0 bottom-0 h-9 bg-amber-700/40" />
          {[24, 62, 100].map((left, i) => (
            <span
              key={left}
              className="absolute rounded-full bg-rose-500 shadow-chip"
              style={{ left, bottom: 18 + (i === 1 ? 10 : 0), width: 32, height: 32 }}
            />
          ))}
          {[32, 70, 108].map((left, i) => (
            <span key={left} className="absolute h-2.5 w-2.5 rounded-full bg-emerald-600" style={{ left, bottom: 46 + (i === 1 ? 10 : 0) }} />
          ))}
          {step >= 3 && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-chip bg-status-good-fg px-2 py-0.5 text-[9px] font-bold text-white">
              <Eye size={10} aria-hidden="true" />
              公開中
            </span>
          )}
        </Box>
      )}

      <Box rect={NOTE} className={cn(SURFACE, "flex items-center px-3 text-[11px]")}>
        {typed ? <span className="font-bold text-nicchyo-ink">{typed}</span> : <span className="text-nicchyo-ink/40">ひとこと添える（なくてもOK）</span>}
      </Box>
      <Box
        rect={SEND}
        initial={false}
        animate={{ scale: step === 3 ? 1 : hasPhoto ? [1, 1.04, 1] : 1 }}
        transition={{ duration: 1.4, repeat: step === 3 ? 0 : Infinity }}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-chip text-[12px] font-bold text-white transition-colors duration-300",
          step === 3 ? "bg-status-good-fg" : hasPhoto ? "bg-amber-500" : "bg-nicchyo-ink/20"
        )}
      >
        {step === 3 ? (
          <>
            <Check size={13} aria-hidden="true" />
            出しました
          </>
        ) : (
          <>
            <Send size={13} aria-hidden="true" />
            近況に出す（日曜まで）
          </>
        )}
      </Box>
      <Finger target={finger} pressed={step === 0 || step === 3} />
    </>
  );
}

const CHIPS = ["日曜まで", "1時間だけ", "時間を決める"] as const;
const chip = (index: number): Rect => ({ x: 12 + index * 100, y: 26, w: 96, h: 32 });
const BAR: Rect = { x: 24, y: 96, w: 272, h: 14 };

/** 出しておく期間。工程: 0 選ぶ / 1 1時間だけ（残りが減る）/ 2 自動で消える */
export function PostPeriodScene({ step }: SceneProps) {
  const selected = step === 0 ? 0 : 1;
  return (
    <>
      <Box rect={{ x: 14, y: 4, w: 160, h: 16 }} className="text-[10px] font-bold text-nicchyo-ink/55">
        出しておく期間
      </Box>
      {CHIPS.map((label, index) => (
        <Box
          key={label}
          rect={chip(index)}
          initial={false}
          animate={{ scale: index === 1 && step === 0 ? 1.05 : 1 }}
          className={cn(
            "flex items-center justify-center rounded-chip text-[11px] font-bold transition-colors duration-300",
            selected === index ? "bg-amber-500 text-white shadow-pop" : "bg-white text-nicchyo-ink/70 shadow-chip ring-1 ring-line"
          )}
        >
          {label}
        </Box>
      ))}

      {step >= 1 && (
        <>
          <Box rect={{ x: 24, y: 74, w: 200, h: 16 }} className="flex items-center gap-1 text-[10px] font-bold text-nicchyo-ink/70">
            <span className={cn("h-2 w-2 rounded-full", step === 1 ? "bg-status-good-fg" : "bg-nicchyo-ink/30")} />
            {step === 1 ? "公開中・あと1時間" : "期限が過ぎました"}
          </Box>
          <Box rect={BAR} className="overflow-hidden rounded-full bg-nicchyo-ink/10">
            <Box
              key={step}
              rect={{ x: 0, y: 0, w: BAR.w, h: BAR.h }}
              initial={{ scaleX: step === 1 ? 1 : 0.02 }}
              animate={{ scaleX: step === 1 ? 0.2 : 0 }}
              transition={{ duration: 1.8, ease: "easeInOut" }}
              className="origin-left rounded-full bg-amber-500"
            />
          </Box>
        </>
      )}
      <Box
        rect={{ x: 24, y: 126, w: 272, h: 54 }}
        initial={false}
        animate={{ opacity: step === 2 ? 0.55 : 1 }}
        className={cn(SURFACE, "flex items-center gap-3 px-3")}
      >
        <span className={cn("h-9 w-9 shrink-0 rounded-btn transition-colors duration-500", step === 2 ? "bg-nicchyo-ink/15" : "bg-amber-200")} />
        <span className="text-[11px] font-bold text-nicchyo-ink/70">
          {step === 2 ? "自動で見えなくなりました。履歴には残ります" : "あなたの近況（公開中）"}
        </span>
      </Box>
      <Finger target={step === 2 ? null : chip(1)} pressed={step === 1} />
    </>
  );
}

const TABS = ["すべて", "公開中", "期限切れ"] as const;
const tab = (index: number): Rect => ({ x: 10 + index * 102, y: 10, w: 98, h: 30 });
const ROWS = [
  { id: "a", expired: false },
  { id: "b", expired: true },
  { id: "c", expired: false },
  { id: "d", expired: true },
] as const;
const ROW_H = 30;

/** 投稿履歴の絞り込み。工程: 0 すべて / 1 期限切れを押す / 2 期限切れだけ */
export function PostsTabsScene({ step }: SceneProps) {
  const filtered = step === 2;
  const active = step === 0 ? 0 : 2;
  let order = 0;
  return (
    <>
      {TABS.map((label, index) => (
        <Box
          key={label}
          rect={tab(index)}
          className={cn(
            "flex items-center justify-center rounded-chip text-[11px] font-bold transition-colors duration-300",
            active === index ? "bg-amber-500 text-white shadow-pop" : "bg-white text-nicchyo-ink/70 shadow-chip ring-1 ring-line"
          )}
        >
          {label}
        </Box>
      ))}
      {ROWS.map((item) => {
        const visible = !filtered || item.expired;
        const slot = visible ? order++ : order;
        return (
          <Box
            key={item.id}
            rect={{ x: 10, y: 52, w: 300, h: ROW_H }}
            initial={false}
            animate={{ y: slot * (ROW_H + 4), opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className={cn(SURFACE, "flex items-center gap-2 px-2")}
          >
            <span className={cn("h-5 w-5 rounded-btn", item.expired ? "bg-nicchyo-ink/15" : "bg-amber-200")} />
            <span className="space-y-1">
              <span className="block h-1.5 w-24 rounded-full bg-nicchyo-ink/15" />
              <span className="block h-1.5 w-14 rounded-full bg-nicchyo-ink/10" />
            </span>
            <span
              className={cn(
                "ml-auto rounded-chip px-2 py-0.5 text-[9px] font-bold",
                item.expired ? "bg-nicchyo-ink/10 text-nicchyo-ink/55" : "bg-status-good-bg text-status-good-fg"
              )}
            >
              {item.expired ? "期限切れ" : "公開中"}
            </span>
          </Box>
        );
      })}
      <Finger target={step === 0 ? null : tab(2)} pressed={step === 1} />
    </>
  );
}

const OLD_ROW: Rect = { x: 10, y: 14, w: 300, h: 70 };
const SAME: Rect = { x: 18, y: 54, w: 138, h: 26 };
const EDIT: Rect = { x: 164, y: 54, w: 138, h: 26 };

/** 期限切れの投稿を出し直す。工程: 0 期限切れ / 1 「そのまま再投稿」を押す / 2 公開中でもう一度出る */
export function PostsRepostScene({ step }: SceneProps) {
  const done = step === 2;
  return (
    <>
      {done && (
        <Box key="new" rect={{ x: 10, y: 8, w: 300, h: 44 }} {...POP_IN} className={cn(SURFACE, "z-10 flex items-center gap-2 px-2 ring-status-good-line")}>
          <span className="h-8 w-8 rounded-btn bg-amber-200" />
          <span className="space-y-1">
            <span className="block h-1.5 w-28 rounded-full bg-nicchyo-ink/15" />
            <span className="block h-1.5 w-16 rounded-full bg-nicchyo-ink/10" />
          </span>
          <span className="ml-auto flex items-center gap-1 rounded-chip bg-status-good-bg px-2 py-0.5 text-[9px] font-bold text-status-good-fg">
            <Check size={10} aria-hidden="true" />
            公開中
          </span>
        </Box>
      )}
      <Box
        rect={OLD_ROW}
        initial={false}
        animate={{ y: done ? 46 : 0, opacity: done ? 0.55 : 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        className={cn(SURFACE, "flex items-start gap-2 px-2 pt-2")}
      >
        <span className="h-8 w-8 rounded-btn bg-nicchyo-ink/15" />
        <span className="space-y-1 pt-1">
          <span className="block h-1.5 w-28 rounded-full bg-nicchyo-ink/15" />
          <span className="block h-1.5 w-16 rounded-full bg-nicchyo-ink/10" />
        </span>
        <span className="ml-auto rounded-chip bg-nicchyo-ink/10 px-2 py-0.5 text-[9px] font-bold text-nicchyo-ink/55">期限切れ</span>
      </Box>
      {!done && (
        <>
          <Box
            rect={SAME}
            initial={false}
            animate={{ scale: step === 1 ? 0.95 : 1 }}
            className="z-10 flex items-center justify-center gap-1 rounded-chip bg-amber-500 text-[11px] font-bold text-white shadow-pop"
          >
            <RotateCcw size={12} aria-hidden="true" />
            そのまま再投稿
          </Box>
          <Box rect={EDIT} className="z-10 flex items-center justify-center gap-1 rounded-chip bg-white text-[11px] font-bold text-nicchyo-ink/70 shadow-chip ring-1 ring-line">
            <Pencil size={12} aria-hidden="true" />
            編集して再投稿
          </Box>
        </>
      )}
      {done ? (
        <Box key="toast" rect={{ x: 40, y: 152, w: 240, h: 30 }} {...POP_IN} className="flex items-center justify-center gap-1.5 rounded-chip bg-status-good-fg text-[11px] font-bold text-white shadow-lift">
          <Check size={13} aria-hidden="true" />
          再投稿しました！
        </Box>
      ) : (
        <Box rect={{ x: 10, y: 152, w: 300, h: 36 }} className="flex items-center gap-2 text-[10px] font-bold text-nicchyo-ink/55">
          <History size={14} aria-hidden="true" />
          「編集して再投稿」なら、写真とひとことを直せます
        </Box>
      )}
      <Finger target={step === 0 ? null : SAME} pressed={step === 1} />
    </>
  );
}
