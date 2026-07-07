"use client";

import { motion } from "framer-motion";

export const LOADING_LANTERN_DURATION_MS = 1000;

export default function LoadingLantern() {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50 to-white">
      <motion.img
        src="/images/story/loading-lantern.webp"
        alt=""
        aria-hidden="true"
        className="h-56 w-auto drop-shadow-xl"
        initial={{ y: "-120%" }}
        animate={{ y: ["-120%", "0%", "0%", "-120%"] }}
        transition={{
          duration: LOADING_LANTERN_DURATION_MS / 1000,
          times: [0, 0.35, 0.75, 1],
          ease: "easeInOut",
        }}
      />
      <p className="mt-6 text-xs font-bold tracking-[0.35em] text-amber-700">LOADING</p>
    </div>
  );
}
