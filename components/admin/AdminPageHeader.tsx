import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="pl-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        {actions ? <div className="ml-auto flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
