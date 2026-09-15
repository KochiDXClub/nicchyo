export type ActivityCategory = "行政連携" | "現地調査" | "発表" | "受賞";

export type ActivityItem = {
  slug: string;
  date: string;
  title: string;
  note?: string;
  image?: string;
  externalLink?: {
    label: string;
    href: string;
    image?: string;
  };
  category: ActivityCategory;
  summary: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

/**
 * カテゴリのバッジ色。/activities と /support の両方で同じ見え方にするため、
 * データと一緒にここに置く（片方だけ色が変わると別の分類に見える）
 */
export const ACTIVITY_CATEGORY_STYLES: Record<ActivityCategory, string> = {
  行政連携: "bg-[#efe1ce] text-[#7b4721]",
  現地調査: "bg-[#f7e8d7] text-[#8b4d20]",
  発表: "bg-[#f1e5d4] text-[#754420]",
  受賞: "bg-[#f6ead7] text-[#7d4b1f]",
};

export const ACTIVITIES: ActivityItem[] = [
  {
    slug: "2025-07-15-kochi-city-meeting-1",
    date: "2025年7月15日",
    title: "第1回高知市商業振興課街路市担当との会談",
    category: "行政連携",
    summary:
      "日曜市の現状や課題を聞き取り、プロジェクトの方向性をすり合わせました。",
    sections: [
      {
        heading: "会議の目的",
        body:
          "本会議は、日曜市デジタルマップ「nicchyo」の実証および今後の連携可能性を検討するために実施しました。また、運営者である高知市に対して日曜市の現状や来訪者の動きについてのヒアリングを行い、取り組むべき課題の選定を行いました。",
      },
      {
        heading: "わかったこと",
        body:
          "運用においては、出店者の高齢化やデジタル活用の難しさに加え、情報入力への協力が得られにくいことが大きな課題であると分かりました。また、個人情報の扱いや運用主体の違いにより、システムの位置付けにも影響があることが明らかになりました。",
      },
      {
        heading: "今後に向けて",
        body:
          "今後は高知市から機能要件に関する助言をいただきながら、実証に向けた準備を進めます。あわせて、運用体制の整理や継続的なデータ更新の仕組みについても検討を進めていきます。",
      },
    ],
  },
  {
    slug: "2025-07-31-re-kosen-adopted",
    date: "2025年7月31日",
    title: "AKATSUKI事業（re-KOSEN）採択",
    image: "/images/activities/re-kosen-logo.png",
    category: "発表",
    externalLink: {
      label: "re-KOSEN 公式サイトを見る",
      href: "https://re-kosen.com/",
    },
    summary:
      "re-KOSENプロジェクトは、令和7年度から始動した、中四国の高専生が地域課題をITで解決することを目指したプロジェクトです。",
    sections: [
      {
        heading: "概要",
        body:
          "nicchyoプロジェクトが令和7年度AKATSUKI事業（re-KOSEN）に採択され、メンターの助言と開発支援金を活用してデジタルマップを開発していくことになりました。",
      },
      {
        heading: "採択の意味",
        body:
          "アイデア段階にとどまらず、実際の地域や来訪者と向き合いながら検証していく体制を持てるようになりました。",
      },
      {
        heading: "今後に向けて",
        body:
          "実装、現地調査、行政との対話を行き来しながら、日曜市に合う形を探る活動へつながっています。",
      },
    ],
  },
  {
    slug: "2025-09-30-kochi-city-meeting-2",
    date: "2025年9月30日",
    title: "第2回高知市商業振興課街路市担当との会談",
    category: "行政連携",
    summary:
      "来訪者アンケートの実施に向けて、事前準備としてオンラインで打ち合わせを行いました。",
    sections: [
      {
        heading: "概要",
        body:
          "第2回の会談は、日曜市で来訪者アンケートを実施する前の準備として、オンラインで行いました。",
      },
      {
        heading: "話し合ったこと",
        body:
          "アンケートの目的や確認したい内容、当日の進め方について整理し、現地でどのような声を集めるべきかをすり合わせました。",
      },
      {
        heading: "今後に向けて",
        body:
          "この打ち合わせをもとに、来訪者アンケート本番に向けた準備を進め、現地での調査につなげました。",
      },
    ],
  },
  {
    slug: "2025-10-19-sunday-market-survey",
    date: "2025年10月19日",
    title: "日曜市での来訪者アンケートを実施",
    note: "133人に実施",
    image: "/images/activities/2025-10-19-sunday-market-survey.png",
    category: "現地調査",
    summary:
      "実際の来訪者の声を集め、迷いや不安がどこで生まれるかを現地で確認しました。",
    sections: [
      {
        heading: "概要",
        body:
          "日曜市の現地で来訪者アンケートを実施し、133人から回答を得ました。",
      },
      {
        heading: "見えてきたこと",
        body:
          "来訪者は『何があるのか分からない』『どこから見ればよいか分からない』といった戸惑いを抱えていることが分かりました。",
      },
      {
        heading: "今後に向けて",
        body:
          "集まった声をもとに、検索だけでなく相談や案内役の存在を含めた体験設計を進めました。",
      },
    ],
  },
  {
    slug: "2026-01-24-re-kosen-final-presentation",
    date: "2026年1月24日",
    title: "re-KOSEN最終報告会を実施",
    image: "/images/activities/2026-01-24-re-kosen-final-presentation.jpg",
    category: "発表",
    summary:
      "調査と開発の成果を整理し、今後の展開も含めてプロジェクト全体を報告しました。",
    sections: [
      {
        heading: "概要",
        body:
          "re-KOSEN最終報告会で、ここまでの調査、設計、実装の取り組みを共有しました。",
      },
      {
        heading: "発表したこと",
        body:
          "来訪者の不安を起点にした価値設計や、検索・相談・会話をつなぐ構想を中心に報告しました。",
      },
      {
        heading: "今後に向けて",
        body:
          "一度きりの発表で終わらせず、実運用と改善を続けるプロジェクトとして位置づけを明確にしました。",
      },
    ],
  },
  {
    slug: "2026-02-28-kochi-npo-award",
    date: "2026年2月28日",
    title: "こうちNPOアワード2025「ワカモノ未来賞」受賞",
    image: "/images/activities/2026-02-28-kochi-npo-award.jpg",
    category: "受賞",
    summary:
      "地域文化と若い世代の視点をつなぐ取り組みとして評価を受けました。",
    sections: [
      {
        heading: "概要",
        body:
          "こうちNPOアワード2025で『ワカモノ未来賞』を受賞しました。",
      },
      {
        heading: "評価された点",
        body:
          "地域文化と若い世代の視点をつなぎ、日曜市の体験価値を新しい形で支えようとする点が評価されました。",
      },
      {
        heading: "今後に向けて",
        body:
          "受賞を励みにしつつ、実際に役立つサービスへ育てていくことが次の課題です。",
      },
    ],
  },
  {
    slug: "2026-03-17-kochi-city-meeting-3",
    date: "2026年3月17日",
    title: "第3回高知市商業振興課街路市担当との会談",
    image: "/images/activities/2026-03-17-kochi-city-meeting-3.jpg",
    category: "行政連携",
    summary:
      "これまでの検証結果を共有し、今後の連携と改善の方向について話し合いました。",
    sections: [
      {
        heading: "概要",
        body:
          "これまでの取り組みをもとに、改めて高知市商業振興課街路市担当の方と会談を行いました。",
      },
      {
        heading: "話し合ったこと",
        body:
          "アンケートや実装を通じて見えてきた課題、今後の連携のあり方、改善の方向について共有しました。",
      },
      {
        heading: "今後に向けて",
        body:
          "単発の開発ではなく、継続して育てていく取り組みとして次のフェーズを見据える機会になりました。",
      },
    ],
  },
] as const;

export function parseJapaneseDateToNumber(value: string) {
  const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return 0;
  const [, year, month, day] = match;
  return Number(`${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`);
}

export function getActivitiesSortedDesc() {
  return [...ACTIVITIES].sort(
    (a, b) => parseJapaneseDateToNumber(b.date) - parseJapaneseDateToNumber(a.date)
  );
}

export function getActivityBySlug(slug: string) {
  return ACTIVITIES.find((activity) => activity.slug === slug) ?? null;
}
