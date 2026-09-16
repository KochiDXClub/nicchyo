/**
 * 運営体制
 *
 * 協賛を検討する側がこのページで最後に確かめるのは「卒業したら誰が続けるのか」。
 * 名前を並べても答えにならないので、役割と、どこから来てどこへ届くのかを出す。
 *
 * ここに書くことは、activities.ts に記録が残っている範囲だけにすること。
 * 体制の話は確かめようがないぶん、盛ると一気に信用を失う。
 */

export type TeamColumnKey = "support" | "operate" | "reach";

export type TeamMember = {
  /** 立場 */
  role: string;
  /** 何をしているか。1行で */
  doing: string;
};

export type TeamColumn = {
  key: TeamColumnKey;
  label: string;
  members: TeamMember[];
};

/**
 * 「支える人 → 運営する人 → 届く先」の3段。
 *
 * ご協賛がどこに入って、最後に誰へ届くのかを1枚で見せるための並び。
 * 真ん中だけが nicchyo で、両側は外の人。
 */
export const TEAM_FLOW: TeamColumn[] = [
  {
    key: "support",
    label: "支えてくださる方",
    members: [
      { role: "ご協賛・助成・賞金", doing: "運営費をお預かりしています" },
      { role: "日曜市の出店者のみなさま", doing: "店舗の情報をご提供いただいています" },
      { role: "高知市商業振興課", doing: "街路市担当のみなさまと連携しています" },
    ],
  },
  {
    key: "operate",
    label: "運営する人",
    members: [
      { role: "高知高専の学生", doing: "開発と、日曜市での聞き取り・調査を行っています" },
      { role: "顧問の教員", doing: "会計を確認し、代が替わっても続くよう見ています" },
    ],
  },
  {
    key: "reach",
    label: "届く先",
    members: [
      { role: "日曜市にいらっしゃる方", doing: "1回およそ17,000人（高知市調べ）" },
      { role: "出店者のみなさま", doing: "近況の投稿を通じて、来訪者に届いています" },
    ],
  },
];

/**
 * 引き継ぎについての説明。
 *
 * 学生プロジェクトへの支援を判断するとき、いちばん大きな不安がここになる。
 * ただし、書ける内容が固まるまでは null のままにしておくこと。
 * 空欄よりも、確かめられない約束を書く方がまずい。
 */
export const HANDOVER_NOTE: string | null = null;
