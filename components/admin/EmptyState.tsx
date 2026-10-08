import React from "react";
import { EmptyState as BaseEmptyState, Button } from "@/components/ui";

/**
 * 管理画面の空状態。
 *
 * 中身は共通の EmptyState（components/ui/empty-state.tsx）。
 * 呼び出し側の書き方（絵文字と action: {label, onClick}）はそのままにしたいので、
 * ここで受け取って渡し替えている。新しく書くところは共通のほうを直接使う。
 *
 * 管理画面は情報量が多いので tone は neutral。ボタンの色も、以前の blue-600 から
 * プロダクトの主色（amber）に揃えた。
 */
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = React.memo(function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <BaseEmptyState
      icon={icon}
      title={title}
      description={description}
      tone="neutral"
      bordered={false}
      action={
        action ? (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : undefined
      }
    />
  );
});
