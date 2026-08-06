"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Store, Megaphone, ArrowLeft, LogOut, Map as MapIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { VENDOR_NAV_ITEMS } from "./vendorNavItems";

const HOME_HREF = "/my-shop";

export default function VendorNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isHome = pathname === HOME_HREF;
  // /vendor/* はPCでサイドバーが出るので下部バーはlg以上で隠す。
  // /my-shop* はサイドバーが無いので全サイズで表示する。
  const inVendorConsole = pathname?.startsWith("/vendor") ?? false;

  // シートを開いている間は背面スクロールを止める
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  // ルート変更でシートを閉じる
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const go = (href: string) => {
    setSheetOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    setSheetOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <>
      {/* ── メニューシート ───────────────────────────────── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="fixed inset-x-0 bottom-0 z-[1001] rounded-t-sheet bg-surface-warmwhite shadow-2xl"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
              role="dialog"
              aria-label="出店者メニュー"
            >
              <div className="mx-auto mb-1 mt-3.5 h-[5px] w-12 rounded-full bg-amber-200/70" />

              <div className="max-h-[78dvh] overflow-y-auto overscroll-contain px-4 pb-3 pt-4">
                {user?.name && (
                  <div className="mb-4 flex items-center gap-3.5 rounded-panel bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 ring-1 ring-amber-100">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xl font-bold text-white shadow-sm ring-2 ring-white">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-nicchyo-ink">{user.name}</p>
                      <p className="mt-0.5 text-[12px] text-slate-500">出店者メニュー</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
                      出店者
                    </span>
                  </div>
                )}

                <div className="overflow-hidden rounded-panel border border-amber-100 bg-white shadow-sm">
                  {VENDOR_NAV_ITEMS.map((item, i) => (
                    <button
                      type="button"
                      key={item.href}
                      onClick={() => go(item.href)}
                      className={`flex w-full items-center gap-4 px-4 py-[15px] text-left transition active:bg-amber-50 ${
                        i !== 0 ? "border-t border-amber-50" : ""
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">{item.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold text-nicchyo-ink">{item.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-500">
                          {item.description}
                        </span>
                      </span>
                      <svg className="h-4 w-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => go("/map")}
                  className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-panel border border-amber-100 bg-white py-[14px] text-[14px] font-bold text-amber-700 shadow-sm transition active:scale-[0.98] active:bg-amber-50"
                >
                  <MapIcon size={18} />
                  マップを見る
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-panel border border-slate-200 bg-white py-[14px] text-[14px] font-semibold text-slate-500 shadow-sm transition active:scale-[0.98] active:bg-slate-50"
                >
                  <LogOut size={18} />
                  ログアウト
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 下部バー ─────────────────────────────────────── */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-[1002] border-t border-amber-100 bg-white/90 backdrop-blur-md ${
          inVendorConsole ? "lg:hidden" : ""
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {isHome ? (
          <div className="mx-auto flex h-16 max-w-lg items-center">
            <NavSlot
              icon={<Store size={24} />}
              label="店舗情報"
              onClick={() => router.push("/vendor/store")}
            />

            <div className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => setSheetOpen((v) => !v)}
                className="flex flex-col items-center gap-1 transition active:scale-95"
                aria-label="メニューを開く"
                aria-expanded={sheetOpen}
              >
                <motion.span
                  animate={sheetOpen ? { rotate: 45, scale: 1.08 } : { rotate: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-brand-pop"
                >
                  <MenuGridIcon className="h-5 w-5" />
                </motion.span>
                <span className="text-[11px] font-bold leading-none text-amber-700">メニュー</span>
              </button>
            </div>

            <NavSlot
              icon={<Megaphone size={24} />}
              label="投稿"
              onClick={() => router.push("/vendor/post/new")}
            />
          </div>
        ) : (
          <div className="mx-auto flex h-16 max-w-lg items-center px-4">
            <button
              type="button"
              onClick={() => router.push(HOME_HREF)}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-bold text-amber-700 transition active:scale-95 active:bg-amber-50"
            >
              <ArrowLeft size={20} />
              マイ店舗へ戻る
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

function NavSlot({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-1 flex-col items-center justify-center gap-1 text-slate-500 transition hover:text-amber-600"
    >
      <span className="transition-transform duration-200 group-hover:scale-105">{icon}</span>
      <span className="text-[11px] font-semibold leading-none tracking-tight">{label}</span>
    </button>
  );
}

function MenuGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
