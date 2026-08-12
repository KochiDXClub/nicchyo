import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { versionHistory } from "../versions";

export const metadata = {
  title: "バージョン履歴 | nicchyo について",
  description: "nicchyo のこれまでのアップデート内容をまとめています。",
};

export default function VersionHistoryPage() {
  return (
    <main className="min-h-screen bg-amber-50 px-6 py-10 text-gray-900">
      <div className="mx-auto max-w-md">
        <Link
          href="/about"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 transition hover:text-amber-800"
        >
          <ArrowLeft className="h-4 w-4" />
          nicchyo について に戻る
        </Link>

        <h1 className="mb-1 text-3xl font-bold text-gray-900">バージョン履歴</h1>
        <p className="mb-8 text-sm text-gray-500">
          nicchyo のこれまでのアップデートをまとめています。
        </p>

        <ol className="flex flex-col gap-5">
          {versionHistory.map((entry) => (
            <li
              key={entry.version}
              className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-2 flex items-baseline gap-2">
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-bold text-white">
                  {entry.version}
                </span>
                <time className="text-xs font-medium text-gray-400">{entry.date}</time>
              </div>
              <h2 className="mb-3 text-base font-bold leading-snug text-gray-900">
                {entry.title}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {entry.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
