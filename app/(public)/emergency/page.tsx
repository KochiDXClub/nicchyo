import Link from "next/link";
import { ExternalLink } from "lucide-react";

import NavigationBar from "@/app/components/NavigationBar";
import { PageContainer, PageHeader, PageShell, Surface, buttonClass } from "@/components/ui";
import { EVACUATION_DATA_SOURCE } from "@/lib/evacuation/sites";
import { guideHrefForKind } from "@/lib/guide/query";

/**
 * /emergency（地震・津波のときは）
 *
 * 日曜市には土地勘のない来訪者が大勢いる。揺れたときに「まず何をするか」と
 * 「どこへ逃げるか」を、読むだけで分かる固定の文面で示す。
 *
 * - 文面は一般的な避難の原則（気象庁・内閣府・高知県が呼びかけている内容）に限り、
 *   nicchyo 独自の予測や判断は書かない。AI にも答えさせない
 * - 速報は出さない。いま出ている警報は公式の発表（緊急速報メール・防災無線・気象庁）を見てもらう
 * - 避難場所は地図のおでかけサポート（/map?facility=evacuation）で近い順に出す
 */

export const metadata = {
  title: "地震・津波のときは",
  description:
    "日曜市で大きな揺れを感じたときにすること、津波からの避難のしかた、近くの避難場所の探し方をまとめています。",
};

const EVACUATION_MAP_HREF = guideHrefForKind("evacuation");

const SHAKING_STEPS = [
  "かばんなどで頭を守り、その場で身を低くする",
  "屋台のテントや看板、ブロック塀、建物のガラスから離れる",
  "揺れがおさまるまで、あわてて走り出さない",
];

const TSUNAMI_STEPS = [
  "強い揺れや、弱くても長い揺れを感じたら、警報を待たずにすぐ避難する",
  "日曜市の通り（追手筋）のあたりも、南海トラフ地震の津波で浸水すると想定されている",
  "近くの丈夫で高い建物（津波避難ビル）の上の階か、高い場所へ。車は使わず歩いて",
  "津波はくり返し来る。警報・注意報が解除されるまで戻らない",
];

type OfficialLink = { label: string; note: string; href: string };

const OFFICIAL_LINKS: OfficialLink[] = [
  {
    label: "気象庁 津波警報・注意報",
    note: "いま出ている津波の警報・注意報",
    href: "https://www.jma.go.jp/bosai/map.html#contents=tsunami",
  },
  {
    label: "気象庁 地震情報",
    note: "震源と各地の震度",
    href: "https://www.jma.go.jp/bosai/map.html#contents=earthquake_map",
  },
  {
    label: "高知市 地震・津波ハザードマップ",
    note: "浸水の想定と避難場所",
    href: "https://www.city.kochi.kochi.jp/site/bousai/jisintsunami-hazardmap.html",
  },
  {
    label: "高知県防災マップ",
    note: "県内の浸水想定・避難場所の地図",
    href: "https://bousaimap.pref.kochi.lg.jp/",
  },
];

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-3 space-y-2.5">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-3 text-[0.95rem] leading-relaxed text-nicchyo-ink">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-nicchyo-primary text-xs font-bold text-white"
          >
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function EmergencyPage() {
  return (
    <PageShell>
      <PageHeader label="地震・津波のときは" />

      <PageContainer as="main" className="space-y-5 pt-8">
        <div>
          <h1 className="text-2xl font-bold leading-snug tracking-tight">
            大きく揺れたら、
            <br />
            まず身を守り、高い所へ
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-nicchyo-ink/70">
            日曜市は屋外に露店が並ぶ市です。揺れたときにすることと、近くの避難場所の探し方をまとめました。
          </p>
        </div>

        <Surface>
          <h2 className="text-base font-bold">揺れている間は</h2>
          <StepList steps={SHAKING_STEPS} />
        </Surface>

        <Surface elevation="lifted" padding="lg">
          <h2 className="text-base font-bold">揺れがおさまったら（津波）</h2>
          <StepList steps={TSUNAMI_STEPS} />
          <Link href={EVACUATION_MAP_HREF} className={buttonClass({ size: "lg", className: "mt-5 w-full" })}>
            近くの避難場所を地図で探す
          </Link>
          <p className="mt-3 text-xs leading-relaxed text-nicchyo-ink/55">
            避難場所は災害の種類ごとに決められています。津波から逃げるときは「津波」の印がある場所を選んでください。
            地図が開けないときは、まわりの避難誘導の標識に従ってください。
          </p>
        </Surface>

        <Surface>
          <h2 className="text-base font-bold">いま出ている警報を知るには</h2>
          <p className="mt-2 text-sm leading-relaxed text-nicchyo-ink/70">
            nicchyo は警報や速報を出していません。スマートフォンの緊急速報メール、防災行政無線、テレビ・ラジオ、
            下の公式の情報を確かめてください。
          </p>
          <ul className="mt-3 divide-y divide-line">
            {OFFICIAL_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-3 text-nicchyo-ink"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{link.label}</span>
                    <span className="block text-xs text-nicchyo-ink/55">{link.note}</span>
                  </span>
                  <ExternalLink size={16} className="shrink-0 text-nicchyo-ink/40" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </Surface>

        <Surface>
          <h2 className="text-base font-bold">家族や知り合いと連絡を取るには</h2>
          <p className="mt-2 text-sm leading-relaxed text-nicchyo-ink/70">
            大きな災害のあとは電話がつながりにくくなります。災害用伝言ダイヤル（171）や、
            携帯電話各社の災害用伝言板を使ってください。
          </p>
        </Surface>

        <p className="text-xs leading-relaxed text-nicchyo-ink/55">
          地図の避難場所：{EVACUATION_DATA_SOURCE.credit}（{EVACUATION_DATA_SOURCE.retrievedAt} 時点）。
          指定は変わることがあるので、現地の標識や高知市の発表もあわせて確かめてください。
        </p>
      </PageContainer>

      <NavigationBar />
    </PageShell>
  );
}
