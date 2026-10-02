"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button, Surface } from "@/components/ui";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/auth/displayName";
import type { User } from "@/lib/auth/types";
import { canDecodeImage, IMAGE_DECODE_ERROR_MESSAGE } from "@/lib/image/clientCompression";
import { AVATAR_PICK_MAX_BYTES, deleteAccountAvatars, uploadAccountAvatar } from "../../_services/accountProfileService";

type UpdateProfile = (updates: Pick<User, "name" | "email" | "phone" | "avatarUrl">) => Promise<boolean>;

/**
 * アカウントの名前と写真（アイコン）を変える。
 * Google ログインの名前・写真が初期値で、ここで変えた値が優先される（lib/auth/displayName.ts）。
 * メンバー一覧や操作ログ、運営とのやりとりで、この名前が表示される。メールアドレスは Google 側のものなので変えない。
 */
export default function ProfileSection({ user, updateProfile }: { user: User; updateProfile: UpdateProfile }) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState<"name" | "photo" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const nameChanged = trimmed !== user.name;
  const nameValid = trimmed.length > 0 && trimmed.length <= DISPLAY_NAME_MAX_LENGTH;

  const save = async (updates: { name?: string; avatarUrl?: string }) =>
    updateProfile({ name: updates.name ?? user.name, email: user.email, phone: user.phone, avatarUrl: updates.avatarUrl ?? user.avatarUrl });

  const handleSaveName = async () => {
    if (!nameValid || !nameChanged) return;
    setBusy("name");
    setMessage(null);
    const ok = await save({ name: trimmed });
    setMessage(ok ? { kind: "ok", text: "名前を変えました" } : { kind: "error", text: "名前を変えられませんでした。もう一度お試しください" });
    setBusy(null);
  };

  const handlePickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) {
      setMessage({ kind: "error", text: "画像ファイルを選んでください" });
      return;
    }
    if (file.size > AVATAR_PICK_MAX_BYTES) {
      setMessage({ kind: "error", text: "10MB以下の写真を選んでください" });
      return;
    }
    setBusy("photo");
    try {
      if (!(await canDecodeImage(file))) {
        setMessage({ kind: "error", text: IMAGE_DECODE_ERROR_MESSAGE });
        return;
      }
      const url = await uploadAccountAvatar(user.id, file);
      const ok = await save({ avatarUrl: url });
      setMessage(ok ? { kind: "ok", text: "写真を変えました" } : { kind: "error", text: "写真を変えられませんでした。もう一度お試しください" });
    } catch {
      setMessage({ kind: "error", text: "写真を上げられませんでした。もう一度お試しください" });
    } finally {
      setBusy(null);
    }
  };

  const handleRemovePhoto = async () => {
    setBusy("photo");
    setMessage(null);
    try {
      const ok = await save({ avatarUrl: "" });
      if (ok) await deleteAccountAvatars(user.id);
      setMessage(ok ? { kind: "ok", text: "写真を消しました" } : { kind: "error", text: "写真を消せませんでした。もう一度お試しください" });
    } catch {
      setMessage({ kind: "error", text: "写真を消せませんでした。もう一度お試しください" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="profile-heading" className="space-y-3">
      <h2 id="profile-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        名前と写真
      </h2>
      <Surface padding="md" className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-500 text-2xl font-bold text-white ring-1 ring-line">
            {user.avatarUrl ? (
              // Google の写真など外部の URL も出るので、画像の最適化は通さない（すでに小さい）
              <Image src={user.avatarUrl} alt="いまの写真" width={80} height={80} unoptimized className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{user.name.charAt(0)}</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                {busy === "photo" ? "処理しています…" : "写真を変える"}
              </Button>
              {user.avatarUrl && (
                <Button variant="quiet" size="sm" onClick={handleRemovePhoto} disabled={busy !== null}>
                  写真を消す
                </Button>
              )}
            </div>
            <p className="text-xs text-nicchyo-ink/55">自動で小さくして保存します。顔写真でもお店のロゴでも大丈夫です。</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickPhoto} aria-label="写真を選ぶ" />
        </div>

        <div className="space-y-2">
          <label htmlFor="account-name" className="text-xs font-semibold text-nicchyo-ink/55">
            名前（メンバー一覧や操作ログに表示されます）
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="account-name"
              type="text"
              value={name}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-btn bg-white px-3 py-2 text-sm text-nicchyo-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <Button size="sm" onClick={handleSaveName} disabled={busy !== null || !nameValid || !nameChanged}>
              {busy === "name" ? "保存しています…" : "名前を保存"}
            </Button>
          </div>
        </div>

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={
              message.kind === "error"
                ? "rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line"
                : "rounded-btn bg-status-good-bg p-3 text-sm text-status-good-fg ring-1 ring-status-good-line"
            }
          >
            {message.text}
          </p>
        )}
      </Surface>
    </section>
  );
}
