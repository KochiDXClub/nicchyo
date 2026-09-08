import { INK, SERIES, SURFACE } from "../chart";
import { DemoBadge, LiveBadge, ScrollHint, SectionCard } from "./ui";
import { FIELD_SURVEY_PLAN } from "../demoData";

export type CoverageItem = {
  label: string;
  filled: number | null;
  total: number | null;
  note: string;
  /** 実データが取れず、見本の値を出しているとき */
  demo?: boolean;
};

/** 母数つきの充足率。分母が取れないときは伏せる（推測で埋めない）。 */
function CoverageBar({ item }: { item: CoverageItem }) {
  const known = item.filled !== null && item.total !== null && item.total > 0;
  const ratio = known ? (item.filled as number) / (item.total as number) : 0;
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="flex items-center gap-2 text-xs font-medium" style={{ color: INK.secondary }}>
          {item.label}
          {item.demo ? <DemoBadge /> : null}
        </span>
        <span className="text-xs tabular-nums" style={{ color: INK.secondary }}>
          {known ? (
            <>
              {item.filled} / {item.total}
              <span className="ml-1.5 font-semibold">{(ratio * 100).toFixed(1)}%</span>
            </>
          ) : (
            <span style={{ color: INK.muted }}>集計できていません</span>
          )}
        </span>
      </div>
      <span className="block h-2.5 rounded-sm" style={{ backgroundColor: SURFACE.grid }}>
        <span
          className="block h-2.5"
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: SERIES.bar,
            borderRadius: "0 4px 4px 0",
          }}
        />
      </span>
      <p className="text-[11px] leading-snug" style={{ color: INK.muted }}>
        {item.note}
      </p>
    </li>
  );
}

const DEFINITIONS: { metric: string; definition: string; source: string; cadence: string; live: boolean }[] = [
  {
    metric: "登録店舗数",
    definition: "nicchyo に店舗情報が登録されている出店者の数。日曜市の全出店者数ではない。",
    source: "vendors テーブルの行数",
    cadence: "リアルタイム",
    live: true,
  },
  {
    metric: "カテゴリ別出店構成",
    definition: "登録店舗を、登録されたカテゴリで数えたもの。カテゴリ未設定は「未分類」に入る。",
    source: "vendors.category_id × categories.name",
    cadence: "リアルタイム",
    live: true,
  },
  {
    metric: "開催ステータス",
    definition: "その日に日曜市を開催したかどうか。運営が更新した時点で公開される。",
    source: "market_days.status",
    cadence: "開催日ごと",
    live: true,
  },
  {
    metric: "Web 来訪者数",
    definition:
      "その日に nicchyo を開いた端末の数（重複を除く）。日曜市の現地来場者数ではない。",
    source: "web_visitor_stats.visitor_count",
    cadence: "日次",
    live: true,
  },
  {
    metric: "開催実績の履歴",
    definition: "過去の日曜ごとの開催・中止・特別開催・臨時休市の記録。",
    source: "market_days（過去分は未入力）",
    cadence: "開催日ごと",
    live: false,
  },
  {
    metric: "時間帯 × 歩く向き",
    definition:
      "同じ利用者の連続する店舗タップについて、店の経度が東へ動いたか西へ動いたかを数えた遷移数。人数ではない。",
    source: "shop_interactions × location_assignments × market_locations（集計は未実装）",
    cadence: "開催日ごとの集計を想定",
    live: false,
  },
  {
    metric: "入口・到達率・折り返し地点",
    definition:
      "利用者ごとの最初のタップ／到達した最も遠い丁目から求めた割合。2回以上タップした利用者のみが対象。",
    source: "shop_interactions × market_locations（集計は未実装）",
    cadence: "開催日ごとの集計を想定",
    live: false,
  },
  {
    metric: "旬カレンダー",
    definition: "その品目が日曜市に並ぶ月と、とくに旬とされる月。",
    source: "products × product_seasons × seasons（データ整備中）",
    cadence: "月次",
    live: false,
  },
];

export default function AboutData({ coverage }: { coverage: CoverageItem[] }) {
  const hasDemoCoverage = coverage.some((item) => item.demo);

  return (
    <div className="space-y-4">
      <SectionCard
        title="この数字がどこまでを表しているか"
        description="どの指標にも母数を添えています。埋まっていないところを隠さないことが、このページの前提です。"
        demo={hasDemoCoverage}
        live={!hasDemoCoverage}
        footnote="分母は「nicchyo に登録のある店舗」です。日曜市の全出店者数の権威ある数字が得られていないため、日曜市全体に対するカバレッジはまだ出せません。"
      >
        <ul className="space-y-3.5">
          {coverage.map((item) => (
            <CoverageBar key={item.label} item={item} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="偏りについて"
        description="収集方法から必ず生じる偏りです。なくせないので、そのまま書いています。"
      >
        <ul className="space-y-2.5 text-sm leading-relaxed text-amber-900/80">
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-amber-700">
              ・
            </span>
            <span>
              <strong className="font-semibold">Web 来訪者数は来場者数ではありません。</strong>
              スマホを持ち、検索して調べる人だけが数えられています。日曜市の来場者の代表標本ではありません。
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-amber-700">
              ・
            </span>
            <span>
              <strong className="font-semibold">歩く向きは「動線」ではありません。</strong>
              店をタップした地点の並びから推定した移動の向きです。タップしていない区間の往復は見えません。
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-amber-700">
              ・
            </span>
            <span>
              <strong className="font-semibold">初めて訪れる人に寄っています。</strong>
              nicchyo は初来訪者のために作られているため、常連の行動とは異なります。
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-amber-700">
              ・
            </span>
            <span>
              <strong className="font-semibold">出店者の登録情報は、登録してくれた人に寄っています。</strong>
              デジタルに前向きな出店者ほど登録されやすく、そうでない出店者の情報は抜けます。
            </span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        title="現地での実測（定点観測）"
        description="上の偏りは、開示しても消えません。消す方法は現地で数えることだけです。年4回、追手筋の定点で方向別の通過人数を数え、Web の数字との換算係数を出す計画です。"
        footnote="1回でも実測が入ると、Web 来訪者数を現地来場者数の推定値に換算できるようになります。それまで、このページの来訪者数は nicchyo の利用者数としてのみ読んでください。"
      >
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FIELD_SURVEY_PLAN.map((plan) => (
            <li
              key={plan.round}
              className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-3 py-2.5"
            >
              <p className="text-xs font-bold text-amber-900">{plan.round}</p>
              <p className="mt-0.5 text-[11px] text-amber-800/80">{plan.season}</p>
              <p className="mt-1.5 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                未実施
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="指標の定義"
        description="引用するときは、この定義を一緒に確認してください。定義のない数字は使えません。"
      >
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr>
                {["指標", "定義", "取得元", "更新", "状態"].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="border-b border-amber-200 px-2 py-2 text-left font-semibold text-amber-900"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEFINITIONS.map((row) => (
                <tr key={row.metric}>
                  <th
                    scope="row"
                    className="whitespace-nowrap border-b border-amber-50 px-2 py-2 text-left font-medium text-amber-900"
                  >
                    {row.metric}
                  </th>
                  <td className="border-b border-amber-50 px-2 py-2 text-amber-900/80">
                    {row.definition}
                  </td>
                  <td className="border-b border-amber-50 px-2 py-2 font-mono text-[10px] text-amber-900/70">
                    {row.source}
                  </td>
                  <td className="whitespace-nowrap border-b border-amber-50 px-2 py-2 text-amber-900/70">
                    {row.cadence}
                  </td>
                  <td className="border-b border-amber-50 px-2 py-2">
                    {row.live ? <LiveBadge /> : <DemoBadge />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ScrollHint />
      </SectionCard>

      <SectionCard
        title="使い方とライセンス"
        description="第三者が引用できることを目指しています。正式公開の際は、機械可読なファイルを固定 URL で配布し、版を残します。"
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-bold text-amber-900">ライセンス（予定）</dt>
            <dd className="mt-1 text-amber-900/80">
              クリエイティブ・コモンズ 表示 4.0 国際（CC BY 4.0）での公開を検討しています。
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-amber-900">出典表記の例</dt>
            <dd className="mt-1">
              <code className="block rounded-lg bg-amber-50 px-3 py-2 font-mono text-[11px] text-amber-900">
                出典：nicchyo（KochiDXClub）／CC BY 4.0
              </code>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-amber-900">ダウンロード</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex cursor-not-allowed items-center rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1 text-xs font-semibold text-amber-700/70">
                CSV（準備中）
              </span>
              <span className="inline-flex cursor-not-allowed items-center rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1 text-xs font-semibold text-amber-700/70">
                JSON（準備中）
              </span>
              <span className="text-[11px]" style={{ color: INK.muted }}>
                デモ段階のため、まだ配布していません。
              </span>
            </dd>
          </div>
        </dl>
      </SectionCard>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 md:p-6">
        <h3 className="text-base font-bold text-amber-900 md:text-lg">この記録を続けるために</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900/80">
          日曜市の開催実績や出店構成の記録は、続けている間しか作れません。途切れた期間は、あとから
          埋めることができません。マップを届けることと同じくらい、この記録を残していくことを
          nicchyo の役割だと考えています。協賛・寄付、データの使い道のご相談を受け付けています。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/contact"
            className="rounded-full bg-amber-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            お問い合わせ
          </a>
          <a
            href="/about"
            className="rounded-full border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-50"
          >
            nicchyo について
          </a>
        </div>
      </section>
    </div>
  );
}
