/**
 * 管理者が登録ユーザーへ一斉送信する際によく使うメールテンプレート
 */
export interface BroadcastTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
}

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: "market-cancelled",
    label: "日曜市開催中止のお知らせ",
    subject: "【nicchyo】本日の日曜市開催中止のお知らせ",
    body: "いつも日曜市をご利用いただきありがとうございます。\n\n本日の日曜市は、天候不良（荒天）のため開催を中止いたします。\nご来場を予定されていた皆様にはご迷惑をおかけし申し訳ございません。\n\n次回の開催は通常通り翌週日曜日を予定しております。\n最新情報はマップページにてご確認ください。",
  },
  {
    id: "maintenance",
    label: "メンテナンスのお知らせ",
    subject: "【nicchyo】システムメンテナンスのお知らせ",
    body: "いつもnicchyoをご利用いただきありがとうございます。\n\n下記日程にてシステムメンテナンスを実施いたします。\nメンテナンス中はサイトにアクセスできない場合があります。\n\n日時: ○年○月○日（○）○時〜○時\n対象: nicchyo全機能\n\nご不便をおかけしますが、何卒よろしくお願いいたします。",
  },
  {
    id: "event",
    label: "イベント開催のお知らせ",
    subject: "【nicchyo】イベント開催のお知らせ",
    body: "いつもnicchyoをご利用いただきありがとうございます。\n\nこの度、下記の通りイベントを開催いたしますのでお知らせいたします。\n\nイベント名: \n開催日時: \n開催場所: 高知・日曜市\n\n皆様のご来場を心よりお待ちしております。",
  },
  {
    id: "vendor-notice",
    label: "出店者向け一般連絡",
    subject: "【nicchyo】出店者の皆様へ",
    body: "出店者の皆様\n\nいつもnicchyoをご利用いただきありがとうございます。\n\n下記についてご連絡いたします。\n\n（連絡内容をご記入ください）\n\nご不明な点がございましたら、事務局までお問い合わせください。",
  },
];
