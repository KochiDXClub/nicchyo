"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { AboutIcon } from "./AboutIcon";
import { aboutSlides, type SlideRichContent } from "./slides";

function RichContent({
  content,
  weeklyVisitors,
}: {
  content: SlideRichContent;
  weeklyVisitors?: number | null;
}) {
  if (content.type === "painPoints") {
    return (
      <div className="mb-8 flex w-full max-w-sm flex-col gap-3 text-left">
        {content.items.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <span className="text-2xl">{p.emoji}</span>
            <p className="text-sm font-semibold text-gray-700 leading-snug">{p.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (content.type === "characters") {
    return (
      <div className="mb-8 grid w-full max-w-sm grid-cols-2 gap-3">
        {content.items.map((c, i) => (
          <div key={i} className={`flex flex-col items-center gap-2 rounded-2xl ${c.bg} p-3 text-center`}>
            <div className="h-14 w-14 overflow-hidden rounded-full bg-white shadow ring-2 ring-white">
              <Image src={c.img} alt={c.name} width={56} height={56} className="h-full w-full object-cover" />
            </div>
            <p className="text-xs font-extrabold text-gray-800">{c.name}</p>
            <p className="text-[10px] font-semibold text-amber-600">{c.role}</p>
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
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
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
          <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
            {entry.version}
          </span>
          <time className="text-xs font-medium text-gray-400">{entry.date}</time>
        </div>
        {entry.highlights.map((highlight, i) => (
          <div key={i} className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-white p-3 shadow-sm">
            <span className="mt-0.5 text-base">✨</span>
            <p className="text-sm font-semibold leading-snug text-gray-700">{highlight}</p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function AboutStory({ weeklyVisitors }: { weeklyVisitors?: number | null }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    if (currentIndex < aboutSlides.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const currentSlide = aboutSlides[currentIndex];
  const progress = ((currentIndex + 1) / aboutSlides.length) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-amber-50 text-gray-900">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 z-10 h-1.5 w-full bg-amber-100">
        <motion.div
          className="h-full bg-amber-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
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
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex max-w-md flex-col items-center text-center"
          >
            {/* Icon Circle */}
            {currentSlide.iconName && (
              <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-white text-amber-600 shadow-md">
                <AboutIcon name={currentSlide.iconName} className="h-12 w-12" />
              </div>
            )}
            {!currentSlide.iconName && currentSlide.id === "intro" && (
              <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500 text-white shadow-md font-bold text-xl">
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
              <RichContent content={currentSlide.richContent} weeklyVisitors={weeklyVisitors} />
            )}

            {/* Slide Action Button */}
            {currentSlide.action && (
              <Link
                href={currentSlide.action.href}
                className={`mb-4 inline-flex items-center justify-center rounded-full px-8 py-4 text-lg font-bold shadow-lg transition active:scale-95 ${
                  currentSlide.action.primary
                    ? "bg-amber-600 text-white hover:bg-amber-500"
                    : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {currentSlide.action.label}
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-amber-100 bg-white/90 px-6 py-6 backdrop-blur-sm safe-bottom">
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
            className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-full font-bold shadow-md transition active:scale-95 ${
              currentIndex === aboutSlides.length - 1
                ? "bg-gray-100 text-gray-400 shadow-none"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
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
    </div>
  );
}
