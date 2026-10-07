"use client";

/**
 * 下部バーの「メニュー」まわりの共通部品。
 *
 * 来訪者向けの NavigationBar と出店者向けの VendorNavBar が同じ見た目・同じ操作感になるよう、
 * シート本体・1行の項目・区切り・中央のメニューボタン・左右のタブ・もどるバーをここにまとめる。
 * 画面ごとに書き分けると、片方だけ直して見た目がずれていくので、変えるときはここを直す。
 */

import Image from "next/image";
import Link from "next/link";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";
import { useDialogFocus } from "@/lib/ui/useDialogFocus";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { ArrowLeft, LayoutGrid, X, type LucideIcon } from "lucide-react";

/** iOS のシートに近い、最後にすっと止まる曲線 */
const EASE_OUT_SHEET: [number, number, number, number] = [0.32, 0.72, 0, 1];
const EASE_IN_SHEET: [number, number, number, number] = [0.4, 0, 1, 1];

// ─── シート本体 ───────────────────────────────────────────────────────────────
/**
 * 下から上がってくるメニューシート。
 * 開いている間は背面を固定し、Esc・背景タップ・ハンドルを下に引く操作で閉じる。
 * 閉じたら returnFocusRef の要素（ふつうはメニューボタン）へフォーカスを戻す。
 */
export function MenuSheet({
  open,
  onClose,
  label,
  returnFocusRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** 読み上げ用のシートの名前 */
  label: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  // 背面のスクロールを止める（ほかのシートと重なっても数を合わせる共通の仕組み）
  useBodyScrollLock(open);

  // 呼び出し側が毎回新しい onClose を渡しても、Esc の登録をやり直さないよう ref で持つ
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const fadeTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景オーバーレイ */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="fixed inset-0 z-[9995] bg-slate-900/40 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden
          />
          <SheetPanel
            key="sheet"
            label={label}
            onClose={onClose}
            returnFocusRef={returnFocusRef}
            prefersReducedMotion={prefersReducedMotion ?? false}
          >
            {children}
          </SheetPanel>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * シート本体。開いているあいだだけ描画されるので、ここでフォーカスの面倒を見る
 * （開いたら中へ移し、Tab を中で回し、閉じたらメニューボタンへ戻す）。
 */
function SheetPanel({
  label,
  onClose,
  returnFocusRef,
  prefersReducedMotion,
  children,
}: {
  label: string;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  prefersReducedMotion: boolean;
  children: ReactNode;
}) {
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, undefined, { returnFocusRef });

  /** ハンドルを下に引いたら閉じる */
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) onClose();
  };

  // シートは「ひとかたまり」で上がってくる。要素ごとに遅れて現れると点滅して見えるので、
  // 中身には一切アニメーションを掛けない。
  const sheetTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.46, ease: EASE_OUT_SHEET };
  const sheetExitTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: EASE_IN_SHEET };

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%", transition: sheetExitTransition }}
      transition={sheetTransition}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.55 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      className="fixed bottom-0 left-0 right-0 z-[9996] mx-auto w-full max-w-lg rounded-t-[28px] bg-nicchyo-base shadow-[0_-16px_48px_-12px_rgba(58,58,58,0.3)] ring-1 ring-nicchyo-ink/[0.07] outline-none"
      style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 5.5rem)" }}
    >
      {/* ドラッグハンドル（下に引くと閉じる） */}
      <div
        onPointerDown={(event) => dragControls.start(event)}
        className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
      >
        <span className="h-[5px] w-11 rounded-full bg-nicchyo-ink/15" aria-hidden />
      </div>

      {/* スクロール領域 */}
      <div className="max-h-[74dvh] overflow-y-auto overscroll-contain px-3 pb-2 pt-1">{children}</div>
    </motion.div>
  );
}

// ─── シートの部品 ─────────────────────────────────────────────────────────────
/** シート先頭のログイン中ユーザー。押すとプロフィール（アカウント）へ進む */
export function MenuUserRow({
  name,
  avatarUrl,
  roleLabel,
  onClick,
}: {
  name: string;
  avatarUrl?: string | null;
  /** 名前の右に添える役割（例: 出店者） */
  roleLabel?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition active:bg-nicchyo-ink/[0.05]"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nicchyo-primary text-[15px] font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-nicchyo-ink">
        {name}
      </span>
      {roleLabel && (
        <span className="shrink-0 text-[12px] font-medium text-nicchyo-ink/45">{roleLabel}</span>
      )}
    </button>
  );
}

/** メニューの1行。アイコン・字送り・高さを全項目で揃える */
export function MenuRow({
  icon: Icon,
  label,
  badge,
  muted = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** ラベルの右に添える一言（例: デモ） */
  badge?: string;
  /** 補助的な項目。少し小さく、控えめな色にする */
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl px-3 text-left transition active:bg-nicchyo-ink/[0.05]"
    >
      <Icon
        className={`shrink-0 ${muted ? "h-[19px] w-[19px] text-nicchyo-ink/35" : "h-[21px] w-[21px] text-nicchyo-ink/55"}`}
        strokeWidth={1.7}
        aria-hidden
      />
      <span
        className={
          muted
            ? "flex-1 py-2.5 text-[14px] font-medium text-nicchyo-ink/70"
            : "flex-1 py-3 text-[15px] font-semibold text-nicchyo-ink"
        }
      >
        {label}
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-dashed border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** 区切り線。見出しを添えるときは線の代わりに小さな文字を置く */
export function MenuDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <p className="mb-1 mt-4 px-3 text-[11px] font-semibold tracking-wide text-nicchyo-ink/40">{label}</p>
    );
  }
  return <div className="my-2 h-px bg-nicchyo-ink/[0.08]" />;
}

// ─── 下部バーの部品 ───────────────────────────────────────────────────────────
/** 下部バー中央の丸いメニューボタン。開閉で格子と×を重ねて入れ替える */
export function MenuToggleButton({
  open,
  onClick,
  buttonRef,
  inlineOnLg = false,
}: {
  open: boolean;
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement>;
  /** lg 以上で、アイコンとラベルを縦ではなく横に並べる（PC の地図のツールバー用） */
  inlineOnLg?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const fadeTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

  return (
    <div className={`flex flex-1 items-center justify-center ${inlineOnLg ? "lg:flex-none lg:px-1" : ""}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        className={`flex flex-col items-center gap-1 ${inlineOnLg ? "lg:flex-row lg:gap-2" : ""}`}
      >
        <motion.span
          animate={{ scale: open ? 1.06 : 1 }}
          whileTap={{ scale: 0.94 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", damping: 24, stiffness: 420 }
          }
          className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_6px_16px_-4px_rgba(15,23,42,0.5)] ${inlineOnLg ? "lg:h-9 lg:w-9" : ""}`}
        >
          {/* 回転だけだと格子も×も見た目が変わらないので、重ねて入れ替える */}
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            animate={{ opacity: open ? 0 : 1, scale: open ? 0.7 : 1 }}
            transition={fadeTransition}
          >
            <LayoutGrid className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          </motion.span>
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.7 }}
            transition={fadeTransition}
          >
            <X className="h-[21px] w-[21px]" strokeWidth={2.2} aria-hidden />
          </motion.span>
        </motion.span>
        <span
          className={`text-[10px] font-medium leading-none tracking-tight text-slate-500 ${
            inlineOnLg ? "lg:text-sm lg:font-semibold lg:text-slate-700" : ""
          }`}
        >
          メニュー
        </span>
      </button>
    </div>
  );
}

/** 下部バー左右のタブの外枠のクラス。リンクのタブと、押すとメニューが開くタブ（近況の選択など）で共通 */
export function bottomNavItemClass(isActive: boolean, inlineOnLg = false): string {
  return `group flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200 ${
    isActive ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
  } ${inlineOnLg ? "lg:flex-none lg:flex-row lg:gap-2 lg:rounded-full lg:px-4 lg:hover:bg-nicchyo-ink/5" : ""}`;
}

/** 下部バー左右のタブの中身（アイコン＋短いラベル） */
export function BottomNavItemContent({
  icon: Icon,
  label,
  isActive,
  inlineOnLg = false,
}: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  /** lg 以上で、ラベルを少し大きくする（横並びのとき読みやすいように） */
  inlineOnLg?: boolean;
}) {
  return (
    <>
      <Icon
        className={`h-[22px] w-[22px] transition-transform duration-200 group-active:scale-95 ${
          isActive ? "scale-105" : "group-hover:scale-105"
        }`}
        strokeWidth={isActive ? 2 : 1.7}
        aria-hidden
      />
      <span
        className={`text-[10px] font-medium leading-none tracking-tight ${
          inlineOnLg ? "lg:text-sm lg:font-semibold" : ""
        }`}
      >
        {label}
      </span>
    </>
  );
}

/** 下部バー左右のタブ（アイコン＋短いラベル）。今いるページなら amber で点ける */
export function BottomNavLink({
  href,
  label,
  icon,
  isActive = false,
  inlineOnLg = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  inlineOnLg?: boolean;
}) {
  return (
    <Link href={href} prefetch={false} className={bottomNavItemClass(isActive, inlineOnLg)}>
      <BottomNavItemContent icon={icon} label={label} isActive={isActive} inlineOnLg={inlineOnLg} />
    </Link>
  );
}

/** サブページの下部バー。起点のページへ戻るボタンだけを置く */
export function BottomNavBackBar({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mx-auto flex h-14 max-w-lg items-center px-4">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-100"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        {label}
      </button>
    </div>
  );
}
