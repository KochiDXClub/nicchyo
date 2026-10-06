import Link from "next/link";
import NavigationBar from "../../components/NavigationBar";
import MapLink from "../../components/MapLink";
import ContactForm from "./ContactForm";
import { HelpCircle } from "lucide-react";

export const metadata = {
  title: "お問い合わせ",
  description: "nicchyo へのご意見・ご要望・不具合報告はこちらからお送りください。",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-900 pb-[calc(3rem+var(--safe-bottom))]">
      {/* Header Section */}
      <div className="relative pt-6 pb-12 px-4 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600/80 mb-2">Support</p>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">お問い合わせ</h1>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 flex flex-col gap-6 -mt-6">
        {/* Pre-check / FAQ Link (Soft Suggestion) */}
        <div className="group relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm transition hover:shadow-md">
          <Link href="/faq" className="flex items-start gap-4">
            <div className="rounded-full bg-blue-100 p-2.5 text-blue-600">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                よくある質問はこちら
              </h3>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                お問い合わせの前に、解決策が見つかるかもしれません。
                配送やアカウントについてはFAQをご覧ください。
              </p>
            </div>
            <div className="self-center">
              <span className="text-xs font-bold text-blue-600 underline underline-offset-2">Check</span>
            </div>
          </Link>
        </div>

        {/* Main Form Card */}
        <div className="rounded-2xl border border-orange-100 bg-white/90 p-5 shadow-xl shadow-orange-100/50 backdrop-blur-sm sm:p-8">
          <ContactForm />
        </div>

        {/* Back to Map */}
        <div className="text-center pb-8">
          <MapLink
            href="/map"
            className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-amber-600"
          >
            ← マップに戻る
          </MapLink>
        </div>
      </div>

      <NavigationBar />
    </main>
  );
}
