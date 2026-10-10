import { Surface } from "@/components/ui";

// 現場登録の画面（FieldShopEditor とその部品）で共有する、フォームの見た目の部品。

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200";
export const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-3 text-base font-semibold disabled:opacity-50";

export function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Surface as="section" padding="sm">
      <h2 className="text-base font-bold text-nicchyo-ink">{title}</h2>
      {hint ? <p className="mt-1 text-[13px] text-nicchyo-ink/55">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </Surface>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">{label}</span>
      {children}
    </label>
  );
}
