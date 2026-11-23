import type { ChangeEvent } from "react";

/** お店の紹介の上限（文字数）。DB の check 制約と同じ数 */
export const INTRODUCTION_MAX_LENGTH = 200;

/**
 * お店の紹介（任意の平文）の入力欄。店舗バナーの商品の上に、そのまま出る。
 * 空のままでも保存でき、空なら来訪者の画面には何も出ない。
 */
export function IntroductionSection({
  introduction,
  onIntroductionChange,
}: {
  introduction: string;
  onIntroductionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <section className="py-6">
      <label className="block text-sm font-semibold text-nicchyo-ink">
        お店の紹介（任意）
        <textarea
          rows={4}
          maxLength={INTRODUCTION_MAX_LENGTH}
          value={introduction}
          onChange={onIntroductionChange}
          placeholder="例: 朝採れの野菜を、その場で袋詰めしています。"
          className="mt-1 w-full rounded-card border border-line bg-white px-3 py-2 text-sm font-normal leading-relaxed text-nicchyo-ink focus:outline-none focus:ring-2 focus:ring-nicchyo-primary"
        />
      </label>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-nicchyo-ink/55">
        <span>商品の上に、お店の紹介として表示されます。</span>
        <span className="shrink-0">{introduction.length}/{INTRODUCTION_MAX_LENGTH}</span>
      </div>
    </section>
  );
}
