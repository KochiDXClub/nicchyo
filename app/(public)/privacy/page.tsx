import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText, Mail, MapPin, Send, SlidersHorizontal } from "lucide-react";

import AnalyticsOptOutToggle from "./AnalyticsOptOutToggle";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "nicchyo が集める情報、外部に送信している情報、位置情報の扱い、アクセス解析の停止方法についてご説明します。",
};

/** 最終更新日。内容を書き換えたらここも直す */
const LAST_UPDATED = "2026年9月9日";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-orange-50/50 pb-20">
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
        <div className="mb-8 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            集める情報は、
            <br />
            できるだけ少なくしています
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            nicchyo（以下「当サービス」）は、高知・日曜市を初めて訪れる方を案内するための地図サービスです。
            会員登録なしでお使いいただけ、その場合にお名前やご連絡先をいただくことはありません。
            このページでは、どんな情報を、何のために、どこへ送っているのかを具体的に書いています。
          </p>
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold leading-relaxed text-emerald-800">
            現在地（緯度・経度）は、お使いの端末の中だけで使います。当サービスのサーバーにも、外部にも送っていません。
          </p>
        </div>

        <div className="space-y-6">
          <Section
            icon={Eye}
            title="1. 集めている情報"
            content={
              <div className="space-y-4 text-sm leading-relaxed text-gray-600">
                <div>
                  <p className="font-semibold text-gray-800">閲覧の記録（自動）</p>
                  <p className="mt-1">
                    見たページのアドレス・滞在時間・日付、そしてブラウザごとに割り当てるランダムな識別子
                    （Cookie <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">nicchyo_visitor_id</code>）。
                    どのページがよく見られているかを知り、案内を作り直すために使います。お名前とは結び付きません。
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">お店への反応の記録（自動）</p>
                  <p className="mt-1">
                    どのお店のカードが表示され、押されたか。あわせて接続元の IP アドレスを記録します
                    （同じ操作の重複や不正な送信を見分けるためで、個人の特定には使いません）。
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">おでかけサポートの記録（自動）</p>
                  <p className="mt-1">
                    どの目的地を選んだか、徒歩の分数・距離、出発地に「現在地」を使ったかどうか。
                    <span className="font-semibold text-gray-700">現在地そのもの（緯度・経度）は含みません。</span>
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">お問い合わせいただいた内容</p>
                  <p className="mt-1">
                    お名前、メールアドレス、お問い合わせ内容など、フォームにご入力いただいたもの。
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">アカウントをお作りいただいた場合</p>
                  <p className="mt-1">
                    メールアドレスと、出店者・運営などの役割。ログイン状態の保持にも Cookie を使います。
                  </p>
                </div>
              </div>
            }
          />

          <Section
            icon={MapPin}
            title="2. 位置情報の扱い"
            content={
              <div className="space-y-3 text-sm leading-relaxed text-gray-600">
                <p>
                  現在地は、地図に自分の位置を出すことと、目的地までの道のりを示すことにだけ使います。
                  <span className="font-semibold text-gray-800">
                    緯度・経度が端末の外に出ることはありません。
                  </span>
                  当サービスのサーバーにも保存していません。
                </p>
                <p>
                  取得にはブラウザの許可が必要です。許可を求める画面は、地図が表示されてから出ます。
                  許可しなくても、地図・検索・お店の情報はすべてお使いいただけます。
                </p>
                <p>
                  一度許可したあとで取りやめたいときは、ブラウザの設定（サイトごとの権限）から変更できます。
                </p>
              </div>
            }
          />

          <Section
            icon={Send}
            title="3. 外部に送っている情報"
            content={
              <div className="space-y-4 text-sm leading-relaxed text-gray-600">
                <p>
                  電気通信事業法の外部送信規律にもとづき、利用者の情報を外部へ送っているものを記載します。
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="py-2 pr-3 font-semibold">送信先</th>
                        <th className="py-2 pr-3 font-semibold">送る内容</th>
                        <th className="py-2 font-semibold">目的</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600">
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 align-top">
                          Google LLC
                          <br />
                          <span className="text-gray-400">（Google アナリティクス）</span>
                        </td>
                        <td className="py-2 pr-3 align-top">
                          見たページ、地図やお店に対する操作、ブラウザの種類、おおよその地域、
                          Google が発行する識別子
                        </td>
                        <td className="py-2 align-top">利用状況の把握とサービス改善</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 align-top">
                          OpenFreeMap / CARTO
                          <br />
                          <span className="text-gray-400">（地図の背景）</span>
                        </td>
                        <td className="py-2 pr-3 align-top">
                          表示している地図の範囲（＝どのあたりを見ているか）、IP アドレス
                        </td>
                        <td className="py-2 align-top">地図の背景画像の配信</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 align-top">
                          OpenAI
                          <br />
                          <span className="text-gray-400">（AI相談・マップの案内）</span>
                        </td>
                        <td className="py-2 pr-3 align-top">
                          相談で入力・お話しいただいた内容と、案内に必要な店舗情報
                        </td>
                        <td className="py-2 align-top">相談への回答文の作成</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-3 align-top">
                          Vercel / Supabase
                          <br />
                          <span className="text-gray-400">（サーバー・データベース）</span>
                        </td>
                        <td className="py-2 pr-3 align-top">接続に伴う通信記録（IP アドレスなど）</td>
                        <td className="py-2 align-top">サービスの稼働と保守</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500">
                  いずれも現在地（緯度・経度）は含みません。地図の背景を配信する事業者には、
                  表示している地図の範囲が伝わります。AI への送信は当サービスのサーバーを経由して行い、
                  相談の内容は回答を作るためだけに使います。
                </p>
              </div>
            }
          />

          <Section
            icon={SlidersHorizontal}
            title="4. アクセス解析を止める"
            content={
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-gray-600">
                  アクセス解析は既定で有効ですが、いつでも止められます。下のスイッチで切り替えてください。
                </p>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <AnalyticsOptOutToggle />
                </div>
                <p className="text-sm leading-relaxed text-gray-600">
                  ブラウザ側で止めることもできます。Google が配布している
                  <a
                    href="https://tools.google.com/dlpage/gaoptout?hl=ja"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-1 font-semibold text-amber-600 hover:underline"
                  >
                    アナリティクス オプトアウト アドオン
                  </a>
                  を入れると、当サービス以外のサイトでも Google アナリティクスへの送信が止まります。
                </p>
              </div>
            }
          />

          <Section
            icon={FileText}
            title="5. 情報の使いみち"
            content={
              <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-gray-600">
                <li>地図・検索・案内を、初めての方に分かりやすく作り直すため</li>
                <li>どの案内が使われているかを知り、次に作るものを決めるため</li>
                <li>お問い合わせへの回答やご連絡のため</li>
                <li>出店者の方への連絡や、出店情報の掲載のため</li>
                <li>不正なアクセスや利用規約違反を防ぎ、対応するため</li>
              </ul>
            }
          />

          <Section
            icon={Lock}
            title="6. 第三者への提供・保存期間"
            content={
              <div className="space-y-3 text-sm leading-relaxed text-gray-600">
                <p>
                  法令に基づく場合を除き、お客様の個人情報を同意なく第三者へ提供することはありません。
                  上の「外部に送っている情報」に挙げた事業者へは、サービスの運営に必要な範囲で業務を委託しており、
                  適切に取り扱われるよう監督します。
                </p>
                <p>
                  閲覧の記録は、集計してサービス改善に使う目的の範囲で保管します。不要になったものは削除します。
                </p>
              </div>
            }
          />

          <Section
            icon={Mail}
            title="7. お問い合わせ窓口"
            content={
              <div className="text-sm leading-relaxed text-gray-600">
                <p className="mb-2">
                  個人情報の取り扱いについてのご質問、ご自身の情報の開示・削除のご希望は、
                  下記のフォームからご連絡ください。
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

        <div className="mt-12 text-center text-xs text-gray-400">
          <p>最終更新日：{LAST_UPDATED}</p>
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
