"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { AboutIcon } from "./AboutIcon";
import { aboutSlides, type SlideRichContent } from "./slides";

// ─── スライドごとの配色 ─────────────────────────────────────────────────────
// アイコン円・プログレスバー・ドット・アクションボタンに使う。
// スライドが増えたときはここにも id を追加する（未登録なら intro の配色を使う）。
type SlideTheme = { accent: string; light: string; text: string; border: string };

const SLIDE_THEMES: Record<string, SlideTheme> = {
  intro: { accent: "#F59E0B", light: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  painPoints: { accent: "#F43F5E", light: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
  concept: { accent: "#F59E0B", light: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  map: { accent: "#10B981", light: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  search: { accent: "#0EA5E9", light: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  consult: { accent: "#F97316", light: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  story: { accent: "#EC4899", light: "#FDF2F8", text: "#9D174D", border: "#FBCFE8" },
  calendar: { accent: "#0EA5E9", light: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  facilities: { accent: "#14B8A6", light: "#F0FDFA", text: "#115E59", border: "#99F6E4" },
  achievements: { accent: "#F59E0B", light: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  team: { accent: "#64748B", light: "#F8FAFC", text: "#334155", border: "#E2E8F0" },
  roadmap: { accent: "#10B981", light: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  version: { accent: "#6366F1", light: "#EEF2FF", text: "#3730A3", border: "#C7D2FE" },
  cta: { accent: "#F59E0B", light: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
};
const DEFAULT_THEME = SLIDE_THEMES.intro;

function getSlideTheme(id: string): SlideTheme {
  return SLIDE_THEMES[id] ?? DEFAULT_THEME;
}

function RichContent({
  content,
  theme,
  weeklyVisitors,
}: {
  content: SlideRichContent;
  theme: SlideTheme;
  weeklyVisitors?: number | null;
}) {
  if (content.type === "painPoints") {
    return (
      <div className="mb-8 flex w-full max-w-sm flex-col gap-3 text-left">
        {content.items.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: theme.border }}
          >
            <span className="text-2xl">{p.emoji}</span>
            <p className="text-sm font-semibold text-gray-700 leading-snug">{p.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (content.type === "characters") {
    return (
      <div className="mb-6 grid w-full max-w-sm grid-cols-2 gap-2.5">
        {content.items.map((c, i) => (
          <div key={i} className={`flex flex-col items-center gap-1.5 rounded-2xl ${c.bg} p-2.5 text-center`}>
            <div className="h-12 w-12 overflow-hidden rounded-full bg-white shadow ring-2 ring-white">
              <Image src={c.img} alt={c.name} width={48} height={48} className="h-full w-full object-cover" />
            </div>
            <p className="text-xs font-extrabold text-gray-800">{c.name}</p>
            <p className="text-[10px] font-semibold" style={{ color: theme.text }}>{c.role}</p>
          </div>
        ))}
      </div>
    );
  }

  if (content.type === "achievements") {
    return (
      <div className="mb-8 flex w-full max-w-sm flex-col gap-3">
        {content.items.map((a, i) => {
          const value =
            a.dynamicKey === "weeklyVisitors" && typeof weeklyVisitors === "number"
              ? `${weeklyVisitors.toLocaleString()}人`
              : a.value;
          return (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm"
              style={{ borderColor: theme.border }}
            >
              <span className="text-3xl">{a.emoji}</span>
              <div>
                <p className="text-[11px] font-semibold text-gray-400">{a.label}</p>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">{value}</p>
                <p className="text-[11px] text-gray-400">{a.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (content.type === "version") {
    const { entry } = content;
    return (
      <div className="mb-8 flex w-full max-w-sm flex-col gap-3 text-left">
        <div className="flex items-baseline gap-2 px-1">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: theme.accent }}
          >
            {entry.version}
          </span>
          <time className="text-xs font-medium text-gray-400">{entry.date}</time>
        </div>
        {entry.highlights.map((highlight, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-2xl border bg-white p-3 shadow-sm"
            style={{ borderColor: theme.border }}
          >
            <span className="mt-0.5 text-base">✨</span>
            <p className="text-sm font-semibold leading-snug text-gray-700">{highlight}</p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 300;

export default function AboutStory({ weeklyVisitors }: { weeklyVisitors?: number | null }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToSlide = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(aboutSlides.length - 1, index)));
  };

  const nextSlide = () => goToSlide(currentIndex + 1);
  const prevSlide = () => goToSlide(currentIndex - 1);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_DISTANCE_THRESHOLD || velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      nextSlide();
    } else if (offset.x > SWIPE_DISTANCE_THRESHOLD || velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      prevSlide();
    }
  };

  const currentSlide = aboutSlides[currentIndex];
  const theme = getSlideTheme(currentSlide.id);
  const progress = ((currentIndex + 1) / aboutSlides.length) * 100;

  return (
    <motion.div
      className="flex min-h-screen flex-col text-gray-900"
      animate={{ backgroundColor: theme.light }}
      transition={{ duration: 0.4 }}
    >
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 z-10 h-1.5 w-full bg-white/60">
        <motion.div
          className="h-full"
          animate={{ width: `${progress}%`, backgroundColor: theme.accent }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Close Button */}
      <Link
        href="/map"
        className="fixed top-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow-sm backdrop-blur-sm transition hover:bg-white"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </Link>

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            className="flex max-w-md flex-col items-center text-center touch-pan-y"
          >
            {/* Icon Circle */}
            {currentSlide.iconName && (
              <div
                className="mb-8 flex h-24 w-24 items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(160deg, white, ${theme.light})`,
                  color: theme.accent,
                  boxShadow: `0 10px 24px -8px ${theme.accent}55, 0 0 0 6px ${theme.light}`,
                }}
              >
                <AboutIcon name={currentSlide.iconName} className="h-12 w-12" />
              </div>
            )}
            {!currentSlide.iconName && currentSlide.id === "intro" && (
              <div
                className="mb-8 flex h-24 w-24 items-center justify-center rounded-full text-white shadow-md font-bold text-xl"
                style={{ backgroundColor: theme.accent }}
              >
                nicchyo
              </div>
            )}

            {/* Typography */}
            <h2 className="mb-4 text-3xl font-bold leading-tight text-gray-900 md:text-4xl">
              {currentSlide.title}
            </h2>
            <p className="mb-8 text-xl font-medium leading-relaxed text-gray-700 md:text-2xl">
              {currentSlide.description}
            </p>

            {/* Rich Content */}
            {currentSlide.richContent && (
              <RichContent content={currentSlide.richContent} theme={theme} weeklyVisitors={weeklyVisitors} />
            )}

            {/* Slide Action Button */}
            {currentSlide.action && (
              <Link
                href={currentSlide.action.href}
                className="mb-4 inline-flex items-center justify-center rounded-full px-8 py-4 text-lg font-bold shadow-lg transition active:scale-95"
                style={
                  currentSlide.action.primary
                    ? { backgroundColor: theme.accent, color: "white" }
                    : { backgroundColor: "white", color: theme.text, border: `1px solid ${theme.border}` }
                }
              >
                {currentSlide.action.label}
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/60 bg-white/90 px-6 pt-4 pb-3 backdrop-blur-sm safe-bottom">
        {/* Dot navigation: タップで任意のスライドへジャンプできる */}
        <div className="mx-auto mb-3 flex max-w-md items-center justify-center gap-1.5 overflow-x-auto px-1">
          {aboutSlides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goToSlide(i)}
              aria-label={`${slide.title} へ移動`}
              aria-current={i === currentIndex}
              className="shrink-0 rounded-full transition-all"
              style={{
                width: i === currentIndex ? 18 : 6,
                height: 6,
                backgroundColor: i === currentIndex ? theme.accent : "#E5E7EB",
              }}
            />
          ))}
        </div>

        <div className="mx-auto flex max-w-md items-center justify-between gap-4">
          <button
            type="button"
            onClick={prevSlide}
            disabled={currentIndex === 0}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              currentIndex === 0
                ? "text-gray-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            aria-label="Previous slide"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          <span className="text-sm font-medium text-gray-400">
            {currentIndex + 1} / {aboutSlides.length}
          </span>

          <button
            type="button"
            onClick={nextSlide}
            disabled={currentIndex === aboutSlides.length - 1}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full font-bold shadow-md transition active:scale-95"
            style={
              currentIndex === aboutSlides.length - 1
                ? { backgroundColor: "#F3F4F6", color: "#9CA3AF", boxShadow: "none" }
                : { backgroundColor: "#111827", color: "white" }
            }
            aria-label="Next slide"
          >
            {currentIndex === aboutSlides.length - 1 ? (
              <span>完了</span>
            ) : (
              <>
                <span>次へ</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
