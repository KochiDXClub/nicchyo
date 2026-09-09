import React from "react";
import Link from "next/link";

import NavigationBar from "@/app/components/NavigationBar";
import AnalyticsOptOutToggle from "./AnalyticsOptOutToggle";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "nicchyo がお預かりする情報、外部へ送信している情報、位置情報の取り扱い、アクセス解析の停止方法についてご説明いたします。",
};

/** 内容を改めたときは、この日付も更新してください */
const LAST_UPDATED = "2026年9月9日";

type Destination = {
  name: string;
  service: string;
  sends: string;
  purpose: string;
};

const destinations: Destination[] = [
  {
    name: "Google LLC",
    service: "Google アナリティクス",
    sends:
      "ご覧になったページ、地図やお店に対する操作、ブラウザの種類、おおよその地域、Google が発行する識別子",
    purpose: "ご利用状況の把握とサービスの改善",
  },
  {
    name: "OpenFreeMap／CARTO",
    service: "地図の背景",
    sends: "表示している地図の範囲（どのあたりをご覧になっているか）、IP アドレス",
    purpose: "地図の背景画像の配信",
  },
  {
    name: "OpenAI",
    service: "AI相談・マップの案内",
    sends: "ご相談で入力・お話しいただいた内容と、ご案内に必要な店舗の情報",
    purpose: "ご相談への回答文の作成",
  },
  {
    name: "Vercel／Supabase",
    service: "サーバー・データベース",
    sends: "接続に伴う通信記録（IP アドレスなど）",
    purpose: "サービスの稼働と保守",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-nicchyo-base pb-28">
      <header className="sticky top-0 z-10 border-b border-[#EADFCB] bg-nicchyo-base/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-[38rem]">
          <p className="text-sm font-medium text-[#6B6660]">プライバシーポリシー</p>
        </div>
      </header>

      <main className="mx-auto max-w-[38rem] px-5">
        {/* 導入 */}
        <div className="pt-12 pb-10">
          <h1 className="text-[1.6rem] font-bold leading-[1.55] tracking-[-0.01em] text-nicchyo-ink sm:text-[1.875rem]">
            お預かりする情報を、
            <br />
            できるだけ少なく
          </h1>
          <p className="mt-6 text-[0.95rem] leading-[1.95] text-[#5C574F]">
            nicchyo（以下「当サービス」といいます）は、高知・日曜市を初めて訪れる方をご案内するための地図サービスです。
            会員登録をしなくてもお使いいただけ、その場合にお名前やご連絡先を頂戴することはございません。
            このページでは、どのような情報を、何のために、どこへ送っているのかを具体的にご説明いたします。
          </p>
        </div>

        {/* 中心にある約束 */}
        <div className="border-l-[3px] border-nicchyo-primary pl-5 sm:pl-6">
          <p className="text-[1.05rem] font-bold leading-[1.9] text-nicchyo-ink sm:text-[1.15rem]">
            現在地は、地図の表示には端末の中だけで使います。
            AI に相談されたときはお預かりしますが、外部へ渡すことはありません。
          </p>
        </div>

        <div className="mt-14 space-y-14">
          <Section number={1} title="お預かりしている情報">
            <Detail term="ご覧になったページの記録（自動）">
              ページのアドレス、滞在時間、日付、そしてブラウザごとに割り当てるランダムな識別子（Cookie{" "}
              <Code>nicchyo_visitor_id</Code>）をお預かりしております。どのページがよくご覧いただいているかを知り、
              ご案内を作り直すために用いるもので、お名前と結び付くことはございません。
            </Detail>
            <Detail term="お店への反応の記録（自動）">
              どのお店のカードが表示され、押されたかをお預かりしております。あわせて接続元の IP
              アドレスを記録いたしますが、これは同じ操作の重複や不正な送信を見分けるためのもので、
              個人の特定には用いません。
            </Detail>
            <Detail term="おでかけサポートの記録（自動）">
              お選びになった目的地、徒歩の分数と距離、出発地に「現在地」をお使いになったかどうかを
              お預かりしております。現在地そのもの（緯度・経度）は含まれません。
            </Detail>
            <Detail term="お問い合わせいただいた内容">
              お名前、メールアドレス、お問い合わせ内容など、フォームにご入力いただいたものをお預かりいたします。
            </Detail>
            <Detail term="アカウントをお作りいただいた場合">
              メールアドレスと、出店者・運営などの役割をお預かりいたします。ログイン状態の保持にも Cookie
              を用いております。
            </Detail>
          </Section>

          <Section number={2} title="位置情報の取り扱い">
            <Prose>
              地図にご自身の位置を表示すること、目的地までの道のりをお示しすること、
              おでかけサポートで残りの距離を数えることは、すべてお使いの端末の中で完結いたします。
              このとき緯度・経度が端末の外に出ることはございません。
            </Prose>
            <Prose>
              <strong className="font-semibold text-nicchyo-ink">AI にご相談いただいたときは</strong>、
              そのときの緯度・経度を当サービスのサーバーへお送りいたします。近くのお店から順にお探しし、
              お手洗いや休憩場所までの徒歩の分数を数えるために用いるものです。
            </Prose>
            <Prose>
              このとき、<strong className="font-semibold text-nicchyo-ink">緯度・経度が
              OpenAI などの外部へ渡ることはございません。</strong>外部へ渡るのは「会場のあたりにいらっしゃる」
              「会場から離れたところにいらっしゃる」という区分までで、これは相談の記録として残す粒度と同じです。
              緯度・経度そのものを保存することもございません。
            </Prose>
            <Prose>
              取得にはブラウザの許可が必要です。許可をお尋ねする画面は、地図が表示されてからお出しいたします。
              許可をされない場合でも、地図・検索・お店の情報はすべてお使いいただけますし、
              AI へのご相談も位置情報なしで承ります。
            </Prose>
            <Prose>
              一度許可されたあとで取りやめたいときは、ブラウザの設定（サイトごとの権限）からご変更いただけます。
            </Prose>
          </Section>

          <Section number={3} title="外部への送信">
            <Prose>
              電気通信事業法の外部送信規律にもとづき、利用者の情報を外部へ送信しているものを記載いたします。
            </Prose>
            <dl className="mt-8 border-t border-[#EADFCB]">
              {destinations.map((destination) => (
                <div
                  key={destination.name}
                  className="grid gap-x-8 gap-y-3 border-b border-[#EADFCB] py-6 sm:grid-cols-[10.5rem_1fr]"
                >
                  <dt>
                    <span className="block text-[0.95rem] font-semibold text-nicchyo-ink">
                      {destination.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#8C8378]">{destination.service}</span>
                  </dt>
                  <dd className="space-y-2 text-sm leading-[1.85] text-[#5C574F]">
                    <p>{destination.sends}</p>
                    <p className="text-[#8C8378]">目的：{destination.purpose}</p>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm leading-[1.9] text-[#8C8378]">
              いずれにも現在地（緯度・経度）は含まれません。地図の背景を配信する事業者には、
              表示している地図の範囲が伝わります。AI への送信は当サービスのサーバーを経由して行っており、
              ご相談の内容は回答を作成するためにのみ用います。
            </p>
          </Section>

          <Section number={4} title="アクセス解析を止める">
            <Prose>
              アクセス解析は既定で有効ですが、いつでもお止めいただけます。下のスイッチでお切り替えください。
            </Prose>
            <div className="mt-7 rounded-2xl border border-nicchyo-soft-green bg-white/70 p-5 sm:p-6">
              <AnalyticsOptOutToggle />
            </div>
            <Prose className="mt-7">
              ブラウザ側でお止めいただくこともできます。Google が配布している{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout?hl=ja"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#3F7F2E] underline decoration-nicchyo-soft-green decoration-2 underline-offset-4 hover:decoration-nicchyo-primary"
              >
                アナリティクス オプトアウト アドオン
              </a>{" "}
              をお使いになると、当サービス以外のサイトでも Google アナリティクスへの送信が止まります。
            </Prose>
          </Section>

          <Section number={5} title="情報の使いみち">
            <ul className="space-y-3 text-[0.95rem] leading-[1.9] text-[#5C574F]">
              {[
                "地図・検索・ご案内を、初めての方に分かりやすく作り直すため",
                "どのご案内をお使いいただいているかを知り、次に作るものを決めるため",
                "お問い合わせへの回答やご連絡のため",
                "出店者の方へのご連絡や、出店情報の掲載のため",
                "不正なアクセスや利用規約違反を防ぎ、対応するため",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden className="mt-[0.7em] h-1 w-1 flex-none rounded-full bg-nicchyo-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section number={6} title="第三者への提供と保存期間">
            <Prose>
              法令に基づく場合を除き、お客様の個人情報を同意なく第三者へ提供することはございません。
              上の「外部への送信」に挙げた事業者へは、サービスの運営に必要な範囲で業務を委託しており、
              適切に取り扱われるよう監督いたします。
            </Prose>
            <Prose>
              ご覧になったページの記録は、集計してサービスの改善に用いる目的の範囲で保管し、
              不要になったものは削除いたします。
            </Prose>
          </Section>

          <Section number={7} title="お問い合わせ窓口">
            <Prose>
              個人情報の取り扱いについてのご質問、ご自身の情報の開示・削除のご希望は、
              下記のフォームよりご連絡ください。
            </Prose>
            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-nicchyo-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              お問い合わせフォームへ
            </Link>
          </Section>
        </div>

        <p className="mt-20 border-t border-[#EADFCB] pt-6 text-xs text-[#A79E92]">
          最終更新日：{LAST_UPDATED}
        </p>
      </main>

      <NavigationBar />
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-3 text-[1.05rem] font-semibold text-nicchyo-ink">
        <span className="text-sm font-bold tabular-nums text-nicchyo-soft-green">{number}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Prose({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[0.95rem] leading-[1.95] text-[#5C574F] ${className} [&+&]:mt-4`}>{children}</p>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="text-[0.95rem] font-semibold text-nicchyo-ink">{term}</p>
      <p className="mt-1.5 text-[0.95rem] leading-[1.95] text-[#5C574F]">{children}</p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[#F0E7D8] px-1.5 py-0.5 text-[0.8em] text-[#6B6660]">{children}</code>
  );
}
