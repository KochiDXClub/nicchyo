"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";

export default function UserProfileButton() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const toggleMenu = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <div className="absolute right-3 top-3 z-[1600] sm:right-4 sm:top-4">
      <button
        type="button"
        onClick={toggleMenu}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-lg shadow-lg shadow-amber-200/60 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95 overflow-hidden"
        aria-label="ユーザーメニューを開く"
      >
        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name}
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : (
          "👤"
        )}
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-2xl border border-amber-100 bg-white/95 p-3 text-sm text-gray-800 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl overflow-hidden">
              {user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                "👤"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || "ゲストさん"}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || ""}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs text-gray-700">
            <p>・お気に入り店舗：12件</p>
            <p>・最近の訪問: 日曜市エリア A〜C</p>
            <p>・メモ: かつお藁焼き屋台が気になる</p>
          </div>

          <div className="mt-3 flex gap-2">
            <Link
              href="/user"
              className="flex-1 rounded-xl bg-amber-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-md shadow-amber-200/60 transition hover:bg-amber-500 active:scale-95"
            >
              ユーザーページへ
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 active:scale-95"
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
