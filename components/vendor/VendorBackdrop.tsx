/**
 * 出店者向けページの背景。AI 相談ページと同じグラデーションを画面に固定して敷く。
 * 出店者トップ（/my-shop）と店舗情報の編集（/vendor/store）で同じ世界観にするための共通部品。
 * 中身は z-10 以上に置く。
 */
export default function VendorBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-[var(--consult-bg)]" aria-hidden="true" />
  );
}
