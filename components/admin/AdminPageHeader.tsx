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
    <div className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm">
      {/* モバイルは左上のメニューボタンと重ならないよう余白を確保する */}
      <div className="mx-auto flex max-w-7xl items-center gap-3 pl-14 lg:pl-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {eyebrow}
          </p>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1 text-[13px] text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="ml-auto flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
