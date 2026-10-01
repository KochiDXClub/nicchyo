"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";

const SPARKS = ["✨", "⭐", "💛", "✨", "🌟", "💛", "✨", "⭐"] as const;
const PARTY = ["🎉", "✨", "🌟", "💛", "🎊", "✨", "⭐", "🎉", "💛", "✨", "🌟", "🎊"] as const;

/** にちよさんのまわりに広がるきらめき。動きを減らす設定のときは出さない */
function Sparkles({ complete }: { complete: boolean }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const items = complete ? PARTY : SPARKS;
  return (
    <>
      {items.map((glyph, index) => {
        const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
        const distance = complete ? 92 : 68;
        return (
          <motion.span
            key={index}
            aria-hidden="true"
            className="pointer-events-none absolute left-8 top-8 text-lg"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              scale: [0.4, 1.2, 0.8],
              rotate: [0, index % 2 === 0 ? 40 : -40],
            }}
            transition={{ duration: 1.1, delay: index * 0.025, ease: "easeOut" }}
          >
            {glyph}
          </motion.span>
        );
      })}
    </>
  );
}

/**
 * 答えたあとの、にちよさんのひとこと。画面の上にふわっと出て、きらめきが広がる。
 * 操作の邪魔にならないよう、タップは素通しにする。
 */
export default function CheerBubble({
  cheer,
}: {
  cheer: { key: number; text: string; complete: boolean } | null;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[10010] flex justify-center px-4"
      style={{ top: "calc(var(--safe-top, 0px) + 5rem)" }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {cheer && (
          <motion.div
            key={cheer.key}
            className="flex items-center gap-2 rounded-chip bg-white py-2 pl-3 pr-5 shadow-float ring-1 ring-amber-200"
            initial={reduceMotion ? false : { opacity: 0, y: -18, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", damping: 18, stiffness: 320 }}
          >
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <GrandmaAvatar pose="speaking" size="pinned" character={DEFAULT_CONSULT_CHARACTER} />
              <Sparkles complete={cheer.complete} />
            </span>
            <p className="text-base font-bold text-amber-900">{cheer.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
