import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type MessageBubbleProps = {
  role: "user" | "assistant";
  children: ReactNode;
  variant?: "default" | "consult";
  className?: string;
};

export default function MessageBubble({
  role,
  children,
  variant = "default",
  className,
}: MessageBubbleProps) {
  const isConsult = variant === "consult";
  const isConsultUser = isConsult && role === "user";
  const isConsultAssistant = isConsult && role === "assistant";

  return (
    <div
      className={cn(
        "relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words",
        role === "user"
          ? isConsult
            ? "rounded-tr-md bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm"
            : "rounded-tr-sm bg-amber-500 text-white"
          : isConsult
            ? // モバイルは枠・背景なしで紙面に直接流し（横幅を最大化）、md以上はバブル表示
              "border-0 bg-transparent text-slate-800 shadow-none md:rounded-[22px] md:rounded-tl-md md:border md:border-amber-200 md:bg-[linear-gradient(180deg,#fffaf2_0%,#fff6e8_100%)] md:shadow-sm"
            : "rounded-tl-sm border border-amber-100 bg-white text-slate-900",
        isConsultUser ? "ring-1 ring-amber-300/60" : "",
        isConsultAssistant
          ? "p-0 md:py-3 md:pl-5 md:pr-5 md:before:absolute md:before:bottom-4 md:before:left-2 md:before:top-4 md:before:w-1 md:before:rounded-full md:before:bg-gradient-to-b md:before:from-amber-300 md:before:to-orange-300 md:after:absolute md:after:right-4 md:after:top-3 md:after:text-3xl md:after:leading-none md:after:text-amber-200/70 md:after:content-['”']"
          : "",
        isConsult ? "text-[15px] leading-7 md:text-base" : "",
        className
      )}
    >
      {children}
    </div>
  );
}
