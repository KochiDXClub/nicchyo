import Link from 'next/link';
import NavigationBar from '../../components/NavigationBar';
import { FACILITY_CATEGORIES, getFacilitiesByCategory } from '@/lib/facilities/facilities';

export const metadata = {
  title: 'おでかけサポート',
  description:
    '高知・日曜市のお手洗い、休けいできるベンチ、電車やバスののりばをマップからさがせます。はじめての方も安心してまわれます。',
};

export default function FacilitiesPage() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] pb-24 text-gray-900">
      {/* ヘッダー */}
      <div className="bg-gradient-to-b from-amber-100/50 to-transparent pb-6 pt-safe-top">
        <div className="mx-auto flex max-w-lg flex-col px-4 pt-6">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">おでかけサポート</h1>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm leading-relaxed text-gray-600">
              さがしたいものをえらぶと、マップで場所を光らせてご案内します。
              現在地がわかるときは、一番近い場所までの道のりもお知らせします。
            </p>
          </div>
        </div>
      </div>

      {/* 3つのカテゴリボックス */}
      <div className="mx-auto max-w-lg px-4">
        <ul className="space-y-4">
          {FACILITY_CATEGORIES.map((category) => (
            <li key={category.id}>
              <Link
                href={`/map?facility=${category.id}`}
                className={`flex min-h-[104px] items-center gap-4 rounded-3xl border-2 px-5 py-5 shadow-sm transition active:scale-[0.98] ${category.boxClass}`}
              >
                <span className="text-4xl leading-none" aria-hidden="true">
                  {category.emoji}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{category.label}</span>
                  <span className="mt-1 block text-sm opacity-80">{category.description}</span>
                  <span className="mt-1 block text-xs opacity-60">
                    {getFacilitiesByCategory(category.id).length}か所
                  </span>
                </span>
                <svg
                  className="h-5 w-5 shrink-0 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
          掲載している情報は変わることがあります。当日の最新の状況は、現地の案内表示をご確認ください。
        </p>
      </div>

      <NavigationBar />
    </main>
  );
}
