"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { PageContainer, PageShell, PageTitle } from "@/components/ui";
import { canDecodeImage, imageErrorMessage, IMAGE_DECODE_ERROR_MESSAGE } from "@/lib/image/clientCompression";
import { createPost, fetchPostById, fetchPostIdentity } from "../../_services/postsService";
import type { ExpirationPreset } from "../../_types";
import { calcExpiresAt, formatExpiresAt } from "./expiration";
import PhotoPicker from "./components/PhotoPicker";
import StoryComposer from "./components/StoryComposer";
import PostDone from "./components/PostDone";

/** 写真 → ひとこと → 出す、の3歩で終わる投稿画面（近況のストーリーと同じ見た目で書く） */
export default function VendorPostNewPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [identity, setIdentity] = useState<{ shopName: string | null; shopImageUrl: string | null }>({
    shopName: null,
    shopImageUrl: null,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  /** 前の投稿をもとに出し直すときの、すでに保存されている写真 */
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [preset, setPreset] = useState<ExpirationPreset>("sunday");
  const [customDateTime, setCustomDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; imageUrl: string; label: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchPostIdentity(user.id)
      .then((loaded) => {
        if (!cancelled) setIdentity(loaded);
      })
      .catch(() => {
        // 名札が出せなくても投稿はできる
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 投稿履歴の「編集して再投稿」（?repost=ID）から来たら、その投稿の写真とひとことで始める
  useEffect(() => {
    const repostId = searchParams.get("repost");
    if (!repostId) return;
    let cancelled = false;
    fetchPostById(repostId).then((post) => {
      if (cancelled || !post) return;
      setText(post.text);
      if (post.image_url) {
        setImagePreview(post.image_url);
        setExistingImageUrl(post.image_url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // 端末の写真を見せるための一時 URL は、差し替えたら手放す
  useEffect(() => {
    if (!imagePreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const expiresAt = useMemo(() => calcExpiresAt(preset, customDateTime), [preset, customDateTime]);

  async function handlePick(file: File) {
    // 送るときの変換でつまずく前に、このブラウザで読める写真かを確かめる
    if (!(await canDecodeImage(file))) {
      setError(IMAGE_DECODE_ERROR_MESSAGE);
      return;
    }
    setError(null);
    setImageFile(file);
    setExistingImageUrl(null);
    setImagePreview(URL.createObjectURL(file));
  }

  function discardPhoto() {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!user || submitting) return;
    if (!imageFile && !existingImageUrl) return;
    const at = calcExpiresAt(preset, customDateTime);
    if (!at) {
      setError("いつまで出すかを、これから先の日時で選んでください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const post = await createPost(
        user.id,
        text.trim(),
        at,
        imageFile ?? undefined,
        existingImageUrl ?? undefined
      );
      setDone({ id: post.id, imageUrl: post.image_url ?? imagePreview ?? "", label: formatExpiresAt(preset, at) });
    } catch (err) {
      setError(imageErrorMessage(err, "うまく出せませんでした。もう一度お試しください。"));
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    discardPhoto();
    setText("");
    setPreset("sunday");
    setCustomDateTime("");
    setDone(null);
  }

  return (
    <PageShell bottomNav={false}>
      <PageTitle title={done ? "出しました" : "近況を出す"} width="narrow" />
      <PageContainer width="narrow">
        {done ? (
          <PostDone postId={done.id} imageUrl={done.imageUrl} expiresLabel={done.label} onAnother={startAnother} />
        ) : imagePreview ? (
          <StoryComposer
            imageUrl={imagePreview}
            shopName={identity.shopName ?? user?.name ?? "あなたのお店"}
            shopImageUrl={identity.shopImageUrl}
            text={text}
            onTextChange={setText}
            preset={preset}
            onPresetChange={setPreset}
            customDateTime={customDateTime}
            onCustomDateTimeChange={setCustomDateTime}
            expiresAt={expiresAt}
            submitting={submitting}
            error={error}
            onDiscard={discardPhoto}
            onSubmit={handleSubmit}
          />
        ) : (
          <>
            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2 rounded-btn bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <PhotoPicker onPick={handlePick} />
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}
