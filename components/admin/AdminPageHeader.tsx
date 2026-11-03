import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  /** 初見の人にも役割が伝わる一行説明 */
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="border-b border-line bg-white/95 px-4 py-5 backdrop-blur-sm">
      {/* モバイルは左上のメニューボタンと重ならないよう余白を確保する */}
      <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 pl-14 lg:pl-0 xl:flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nicchyo-ink/55">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold text-nicchyo-ink sm:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-nicchyo-ink/55">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto">{actions}</div> : null}
      </div>
    </div>
  );
}
