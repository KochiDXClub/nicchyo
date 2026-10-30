"use client";

import { useState } from "react";
import { showToast } from "@/lib/admin/toast";
import { createPanoramaThumbnailFromUrl, createStoreImages, imageErrorMessage } from "@/lib/image/clientCompression";
import type { ShopImageKind } from "@/lib/shopImages";
import type { AdminShopDetail } from "@/lib/admin/shopEdit";
import { PanoramaThumbPicker, ShopImageKindField } from "@/components/ui";
import { useObjectUrl } from "@/lib/hooks/useObjectUrl";
import { useShopImageKind } from "@/lib/image/useShopImageKind";
import { Card, buttonClass, readError } from "./fieldFormParts";

/**
 * 現場登録の「店舗の写真」。撮影・選択した写真を種類（普通／全周）を決めて登録し、
 * 登録済みの全周写真は、サムネイルの切り取り位置だけを切り直せる。
 * 写真の状態は店舗（shop）に反映し、フォームの未保存の入力には触れない。
 */
export function FieldShopPhotoCard({
  shopId,
  shop,
  setShop,
  photoUseAllowedInForm,
}: {
  shopId: string;
  shop: AdminShopDetail;
  setShop: (update: (prev: AdminShopDetail | null) => AdminShopDetail | null) => void;
  /** 画面のフォームで「写真の掲載も許可をもらった」にチェックが入っているか（保存前でも案内を切り替える） */
  photoUseAllowedInForm: boolean;
}) {
  const [photoBusy, setPhotoBusy] = useState(false);
  // 撮った・選んだ写真は、種類（普通／全周）を決めてから登録する
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const pendingPhotoKind = useShopImageKind(pendingPhoto);
  const pendingPhotoUrl = useObjectUrl(pendingPhoto);
  // 全周写真のサムネイルにする位置（写真の横幅に対する割合）。新しい写真の登録と、登録済みの写真の切り直しで使う
  const [thumbCenter, setThumbCenter] = useState(0.5);
  const [recropping, setRecropping] = useState(false);
  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const { mainBlob, thumbBlob } = await createStoreImages(file, { kind: pendingPhotoKind.kind, thumbCenter });
      const body = new FormData();
      body.append("main", mainBlob, "main");
      body.append("thumb", thumbBlob, "thumb");
      body.append("kind", pendingPhotoKind.kind);
      const res = await fetch(`/api/admin/shops/${shopId}/image`, { method: "POST", body });
      if (!res.ok) throw new Error((await readError(res, "写真を保存できませんでした")).message);
      const { url, kind, updated_at } = (await res.json()) as { url: string; kind?: ShopImageKind; updated_at?: string };
      // 同じパスに上書きされるが、返る URL には版（?v=）がついているので、古い写真は出ない。
      // 写真の保存で updated_at が進むので反映する（古いままだと、次の「内容を保存」が必ず 409 になる）。
      // フォームには触れない（未保存の入力を消さない）
      setShop((prev) =>
        prev
          ? { ...prev, shop_image_url: url, shop_image_kind: kind ?? "normal", updated_at: updated_at ?? prev.updated_at }
          : prev,
      );
      setPendingPhoto(null);
      setThumbCenter(0.5);
      showToast.success("写真を保存しました");
    } catch (e) {
      showToast.error(imageErrorMessage(e, e instanceof Error ? e.message : "写真を保存できませんでした"));
    } finally {
      setPhotoBusy(false);
    }
  };

  /** 登録済みの全周写真のサムネイルを、選んだ位置で切り直して保存する（メインの写真は変えない） */
  const recropThumb = async () => {
    if (!shop.shop_image_url) return;
    setPhotoBusy(true);
    try {
      const thumbBlob = await createPanoramaThumbnailFromUrl(shop.shop_image_url, thumbCenter);
      const body = new FormData();
      body.append("thumb", thumbBlob, "thumb");
      const res = await fetch(`/api/admin/shops/${shopId}/image`, { method: "POST", body });
      if (!res.ok) throw new Error((await readError(res, "サムネイルを保存できませんでした")).message);
      const { url, updated_at } = (await res.json()) as { url: string; updated_at?: string };
      setShop((prev) => (prev ? { ...prev, shop_image_url: url, updated_at: updated_at ?? prev.updated_at } : prev));
      setRecropping(false);
      showToast.success("サムネイルを保存しました");
    } catch (e) {
      showToast.error(imageErrorMessage(e, e instanceof Error ? e.message : "サムネイルを保存できませんでした"));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
      <Card title="店舗の写真" hint={photoUseAllowedInForm ? undefined : "写真を使う許可をもらってから、撮影するか端末の写真から選んで登録します（上の「写真の掲載も許可をもらった」にチェック → 保存）。"}>
        {shop.shop_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.shop_image_url} alt={`${shop.shop_name}の写真`} className="max-h-64 w-full rounded-lg border border-line object-contain" />
        ) : (
          <p className="text-sm text-nicchyo-ink/40">まだ写真がありません</p>
        )}
        {shop.shop_image_url && shop.shop_image_kind === "panorama" ? (
          <p className="text-[13px] font-semibold text-nicchyo-ink/70">全周カメラ（360°）の写真として登録済み</p>
        ) : null}
        {shop.shop_image_url && shop.shop_image_kind === "panorama" ? (
          recropping ? (
            <div className="space-y-2 rounded-lg border border-line p-3">
              <PanoramaThumbPicker src={shop.shop_image_url} value={thumbCenter} onChange={setThumbCenter} disabled={photoBusy} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={photoBusy} onClick={() => setRecropping(false)} className={`${buttonClass} border border-line bg-white text-nicchyo-ink`}>
                  やめる
                </button>
                <button type="button" disabled={photoBusy} onClick={() => void recropThumb()} className={`${buttonClass} bg-amber-500 text-white disabled:opacity-50`}>
                  {photoBusy ? "保存しています…" : "この位置で保存"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={photoBusy || !shop.photo_use_allowed}
              onClick={() => {
                setThumbCenter(0.5);
                setRecropping(true);
              }}
              className={`${buttonClass} border border-line bg-white text-nicchyo-ink disabled:opacity-50`}
            >
              サムネイルの切り取り位置を変える
            </button>
          )
        ) : null}
        {/* 撮る（カメラを起動）と、選ぶ（端末の写真から）は別の入口にする */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "camera", label: "写真を撮る", capture: "environment" as const },
            { key: "library", label: "写真を選ぶ", capture: undefined },
          ].map((entry) => (
            <label
              key={entry.key}
              className={`${buttonClass} cursor-pointer bg-amber-500 text-white ${!shop.photo_use_allowed || photoBusy ? "pointer-events-none opacity-50" : ""}`}
            >
              {photoBusy ? "保存しています…" : entry.label}
              <input
                type="file"
                accept="image/*"
                capture={entry.capture}
                className="sr-only"
                disabled={!shop.photo_use_allowed || photoBusy}
                onChange={(e) => {
                  setThumbCenter(0.5);
                  setPendingPhoto(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          ))}
        </div>
        {pendingPhoto ? (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <p className="truncate text-[13px] font-semibold text-nicchyo-ink/70">選んだ写真: {pendingPhoto.name || "撮影した写真"}</p>
            <ShopImageKindField
              value={pendingPhotoKind.kind}
              onChange={pendingPhotoKind.setKind}
              panoramaAvailable={pendingPhotoKind.panoramaAvailable}
              disabled={photoBusy}
            />
            {pendingPhotoKind.kind === "panorama" && pendingPhotoUrl ? (
              <PanoramaThumbPicker src={pendingPhotoUrl} value={thumbCenter} onChange={setThumbCenter} disabled={photoBusy} />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={photoBusy} onClick={() => setPendingPhoto(null)} className={`${buttonClass} border border-line bg-white text-nicchyo-ink`}>
                やめる
              </button>
              <button
                type="button"
                disabled={photoBusy || pendingPhotoKind.checking}
                onClick={() => void uploadPhoto(pendingPhoto)}
                className={`${buttonClass} bg-amber-500 text-white disabled:opacity-50`}
              >
                {photoBusy ? "保存しています…" : "この写真を登録"}
              </button>
            </div>
          </div>
        ) : null}
        {!shop.photo_use_allowed ? <p className="text-[13px] text-amber-700">保存済みの設定で写真の許可がありません</p> : null}
      </Card>
  );
}
