"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// このプロジェクトの Button は cva（buttonVariants）ではなく独自の variant/size
// マップを使うため、prompt-kit 由来の VariantProps ではなく Button の型に合わせる。
type ButtonVariant = "default" | "outline" | "ghost" | "primary" | "cta"
type ButtonSize = "default" | "icon" | "sm" | "lg" | "fab"

export type PromptSuggestionProps = {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  highlight?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>

function PromptSuggestion({
  children,
  variant,
  size,
  className,
  highlight,
  ...props
}: PromptSuggestionProps) {
  const isHighlightMode = highlight !== undefined && highlight.trim() !== ""
  const content = typeof children === "string" ? children : ""

  if (!isHighlightMode) {
    return (
      <Button
        variant={variant || "outline"}
        size={size || "lg"}
        className={cn("rounded-full", className)}
        {...props}
      >
        {children}
      </Button>
    )
  }

  if (!content) {
    return (
      <Button
        variant={variant || "ghost"}
        size={size || "sm"}
        className={cn(
          "w-full cursor-pointer justify-start rounded-xl py-2",
          "hover:bg-accent",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    )
  }

  const trimmedHighlight = highlight.trim()
  const contentLower = content.toLowerCase()
  const highlightLower = trimmedHighlight.toLowerCase()
  const shouldHighlight = contentLower.includes(highlightLower)

  return (
    <Button
      variant={variant || "ghost"}
      size={size || "sm"}
      className={cn(
        "w-full cursor-pointer justify-start gap-0 rounded-xl py-2",
        "hover:bg-accent",
        className
      )}
      {...props}
    >
      {shouldHighlight ? (
        (() => {
          const index = contentLower.indexOf(highlightLower)
          if (index === -1)
            return (
              <span className="text-muted-foreground whitespace-pre-wrap">
                {content}
              </span>
            )

          const actualHighlightedText = content.substring(
            index,
            index + highlightLower.length
          )

          const before = content.substring(0, index)
          const after = content.substring(index + actualHighlightedText.length)

          return (
            <>
              {before && (
                <span className="text-muted-foreground whitespace-pre-wrap">
                  {before}
                </span>
              )}
              <span className="text-primary font-medium whitespace-pre-wrap">
                {actualHighlightedText}
              </span>
              {after && (
                <span className="text-muted-foreground whitespace-pre-wrap">
                  {after}
                </span>
              )}
            </>
          )
        })()
      ) : (
        <span className="text-muted-foreground whitespace-pre-wrap">
          {content}
        </span>
      )}
    </Button>
  )
}

export { PromptSuggestion }
