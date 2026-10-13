import { formatJaDateTime } from "@/lib/utils/date";

/**
 * 招待リンクを作った直後に見せる枠（リンクの URL と期限）。リンクはこのとき1回しか出せない。
 * コピーのボタンや補足は children で足す。店舗側の画面と運営の店舗詳細で共通。
 */
export default function CreatedInviteLink({
  url,
  expiresAt,
  children,
}: {
  url: string;
  expiresAt: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-btn bg-status-good-bg p-3 ring-1 ring-status-good-line">
      <p className="text-sm font-semibold text-status-good-fg">リンクができました（{formatJaDateTime(expiresAt)}まで）</p>
      <input
        readOnly
        value={url}
        aria-label="招待リンク"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-btn bg-white px-3 py-2 text-xs text-nicchyo-ink ring-1 ring-line"
      />
      {children}
    </div>
  );
}
