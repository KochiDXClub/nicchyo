import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText, Mail } from "lucide-react";

export const metadata = {
  title: "プライバシーポリシー",
  description: "nicchyo における個人情報の収集・利用・管理方針についてご説明します。",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-orange-50/50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-orange-100 bg-white/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link
            href="/contact"
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold text-gray-800">プライバシーポリシー</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Intro Card */}
        <div className="mb-8 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">
            お客様の情報を<br />大切にお守りします
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            nicchyo（以下「当サービス」）は、お客様の個人情報を適切に取り扱い、保護することを社会的責務と考えています。
            このページでは、どのような情報を収集し、それをどう利用するかを分かりやすくご説明します。
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          <Section
            icon={Eye}
            title="1. 収集する情報"
            content={
              <ul className="list-inside list-disc space-y-2 text-sm text-gray-600">
                <li>
                  <span className="font-semibold text-gray-800">お問い合わせ情報：</span>
                  お名前、メールアドレス、お問い合わせ内容など、フォームに入力いただいた情報。
                </li>
                <li>
                  <span className="font-semibold text-gray-800">利用データ：</span>
                  Cookie等を使用した、当サイトへのアクセス状況や利用履歴（個人を特定するものではありません）。
                </li>
              </ul>
            }
          />

          <Section
            icon={FileText}
            title="2. 情報の利用目的"
            content={
              <ul className="list-inside list-disc space-y-2 text-sm text-gray-600">
                <li>お問い合わせへの回答やご連絡のため</li>
                <li>サービスの品質向上や新機能開発のため</li>
                <li>不正アクセスや利用規約違反の防止・対応のため</li>
              </ul>
            }
          />

          <Section
            icon={Lock}
            title="3. 第三者への提供"
            content={
              <p className="text-sm leading-relaxed text-gray-600">
                法令に基づく場合を除き、お客様の同意なく個人情報を第三者に提供することはありません。
                ただし、サービスの運営に必要な範囲で、信頼できる委託先に業務を委託する場合があります（例：サーバー管理会社など）。
                その場合も、適切な管理が行われるよう監督します。
              </p>
            }
          />

          <Section
            icon={Mail}
            title="4. お問い合わせ窓口"
            content={
              <div className="text-sm leading-relaxed text-gray-600">
                <p className="mb-2">
                  個人情報の取り扱いに関するご質問やご相談は、下記のお問い合わせフォームよりご連絡ください。
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:underline"
                >
                  お問い合わせフォームへ
                  <ArrowLeft className="h-3 w-3 rotate-180" />
                </Link>
              </div>
            }
          />
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center text-xs text-gray-400">
          <p>最終更新日：2024年5月22日</p>
        </div>
      </main>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="border-b border-gray-50 bg-gray-50/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <h3 className="font-semibold text-gray-800">{title}</h3>
        </div>
      </div>
      <div className="p-5">{content}</div>
    </section>
  );
}
