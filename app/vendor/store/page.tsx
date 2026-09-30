"use client";

export const dynamic = "force-dynamic";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { Button, CenteredLoading, PageContainer, Surface } from "@/components/ui";
import VendorBackdrop from "@/components/vendor/VendorBackdrop";
import { useAuth } from "@/lib/auth/AuthContext";
import AnswerRow from "./components/AnswerRow";
import AskSheet from "./components/AskSheet";
import CheerBubble from "./components/CheerBubble";
import StallHero from "./components/StallHero";
import { useStoreStudio } from "./useStoreStudio";

/** 進み具合に合わせた、にちよさんのひとこと */
function coachMessage(answered: number, total: number): string {
  if (total > 0 && answered === total) return "ぜんぶ教えてくれたねぇ！お店のことが、ばっちり伝わるきね。";
  if (answered === 0) return "はじめまして！わしが聞いていくき、ひとつずつ教えてや。";
  // 「10つ」とは言わないので、9までは「つ」、10以上は「個」で数える
  const rest = total - answered;
  return `あと${rest <= 9 ? `${rest}つ` : `${rest}個`}教えてくれたら、満点じゃ！`;
}

export default function VendorStorePage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const studio = useStoreStudio(user?.id ?? null);
  const { snapshot, groups, answeredCount, total, isComplete } = studio;

  const progress = total > 0 ? answeredCount / total : 0;

  return (
    <div className="relative min-h-screen">
      <VendorBackdrop />

      <PageContainer className="relative z-10 pb-10 pt-4 sm:pt-8">
        {studio.status === "loading" && <CenteredLoading />}

        {studio.status === "error" && (
          <Surface className="text-center">
            <p className="text-base font-bold text-amber-900">うまく開けんかった。もういっぺん開いてみてや。</p>
            <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
              もういっぺん
            </Button>
          </Surface>
        )}

        {studio.status === "ready" && snapshot && (
          <div className="flex flex-col gap-6">
            {/* 屋台：ひさしの下に、お客さんに見えるお店の名刺 */}
            <StallHero
              snapshot={snapshot}
              onEditPhoto={() => studio.open("shop-photo")}
              onEditName={() => studio.open("shop-name")}
            />

            {/* にちよさん：進み具合と、続きを聞いてもらう入口 */}
            <Surface elevation="lifted" padding="sm" className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <GrandmaAvatar
                  pose={isComplete ? "speaking" : "idle"}
                  size="pinned"
                  character={DEFAULT_CONSULT_CHARACTER}
                  className="shrink-0"
                />
                <div className="consult-greeting consult-greeting--left min-w-0 flex-1 rounded-card border border-amber-200 bg-amber-50/60 px-4 py-3">
                  <p className="text-[15px] font-bold leading-relaxed text-amber-900">
                    {coachMessage(answeredCount, total)}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-nicchyo-ink/70">お店の育ち</span>
                  <span className="text-sm font-bold text-amber-800">
                    {answeredCount}
                    <span className="text-xs font-semibold text-nicchyo-ink/55"> / {total}</span>
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-amber-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={answeredCount}
                  aria-label="お店の育ち"
                >
                  <motion.div
                    className="h-full rounded-full bg-amber-500"
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ type: "spring", damping: 22, stiffness: 120 }}
                  />
                </div>
              </div>

              {!isComplete && (
                <Button size="lg" onClick={studio.startQueue}>
                  <Sparkles size={18} aria-hidden="true" />
                  続きを答える
                </Button>
              )}
            </Surface>

            {/* 章ごとの質問と答え */}
            {groups.map((group) => {
              const answeredInGroup = group.questions.filter((q) => q.isAnswered(snapshot)).length;
              return (
                <section key={group.key} aria-labelledby={`group-${group.key}`}>
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <h2
                      id={`group-${group.key}`}
                      className="flex items-center gap-2 font-display text-xl text-nicchyo-ink"
                    >
                      <span aria-hidden="true">{group.emoji}</span>
                      {group.title}
                    </h2>
                    <span className="text-xs font-bold text-amber-900">
                      {answeredInGroup} / {group.questions.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {group.questions.map((question, index) => (
                      <AnswerRow
                        key={question.id}
                        question={question}
                        snapshot={snapshot}
                        index={index}
                        onOpen={() => studio.open(question.id)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </PageContainer>

      <AnimatePresence>
        {studio.openedQuestion && snapshot && (
          <AskSheet
            key="ask-sheet"
            question={studio.openedQuestion}
            snapshot={snapshot}
            saving={studio.saving}
            error={studio.error}
            queueMode={studio.queueMode}
            onClose={studio.close}
            onSubmit={(answer) => void studio.save(answer)}
            onSkip={studio.skipCurrent}
            onClear={() => studio.clear(studio.openedQuestion!.id)}
          />
        )}
      </AnimatePresence>

      <CheerBubble cheer={studio.cheer} />
    </div>
  );
}
