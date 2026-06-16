import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "primary" | "cta";
  size?: "default" | "icon" | "sm" | "lg" | "fab";
};

const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:  "bg-slate-700 text-white hover:bg-slate-600",
  outline:  "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50",
  ghost:    "bg-transparent hover:bg-slate-100",
  primary:  "bg-amber-500 text-white hover:bg-amber-600 border-transparent shadow-pop",
  cta:      "bg-gradient-to-b from-amber-400 to-amber-600 text-white border-transparent shadow-pop",
};

const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-10 px-4 py-2 text-sm",
  sm:      "h-8 px-3 text-xs",
  lg:      "h-12 px-6 text-base",
  icon:    "h-10 w-10",
  fab:     "h-14 w-14 rounded-full p-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        // eslint-disable-next-line react/button-has-type
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-xl border text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          variantClassMap[variant],
          sizeClassMap[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
