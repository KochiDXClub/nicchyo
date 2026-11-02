"use client";

import { useState } from "react";
import { LoadingButton, Modal } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import { unlinkShop, type ShopClaimRow } from "@/lib/admin/shopClaimsClient";

/** 紐づけの解除の確認。メンバーが外れることを伝えてから実行する（QR の一覧と店舗の詳細で共通） */
export function UnlinkShopModal({
  shop,
  onClose,
  onUnlinked,
}: {
  shop: Pick<ShopClaimRow, "vendorId" | "shopName" | "memberCount"> | null;
  onClose: () => void;
  onUnlinked: () => void | Promise<void>;
}) {
  const [unlinking, setUnlinking] = useState(false);

  const handleUnlink = async () => {
    if (!shop) return;
    setUnlinking(true);
    try {
      const { removedMembers } = await unlinkShop(shop.vendorId);
      showToast.success(`${shop.shopName}の紐づけを解除しました（${removedMembers}人が外れました）`);
      onClose();
      await onUnlinked();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "解除できませんでした");
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Modal open={shop !== null} onClose={() => !unlinking && onClose()} title="紐づけの解除" widthClassName="max-w-md">
      {shop && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-nicchyo-ink/70">
            「{shop.shopName}」の紐づけを解除します。メンバー {shop.memberCount}人（代表者を含む）がお店から外れ、出ている招待リンクとQRコードは使えなくなります。
            店舗の掲載情報（商品・写真・投稿）はそのまま残ります。
          </p>
          <p className="text-xs text-nicchyo-ink/55">解除したあと、QRコードを出し直すと、新しい代表者が紐づけられます。</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={unlinking} className="rounded-lg px-4 py-2 text-sm text-nicchyo-ink/70 hover:bg-nicchyo-ink/[0.06]">
              やめる
            </button>
            <LoadingButton isLoading={unlinking} loadingText="解除しています…" onClick={handleUnlink} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
              解除する
            </LoadingButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
