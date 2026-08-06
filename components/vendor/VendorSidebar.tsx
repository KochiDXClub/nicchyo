"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { VENDOR_NAV_ITEMS } from "./vendorNavItems";

// 下部バーのメニューシートと同一の権威ある導線リストを使う（食い違い防止）
const navItems = VENDOR_NAV_ITEMS;

export default function VendorSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <>
      {/* モバイルではVendorNavBar（ボトムタブ）で代替するためハンバーガーは非表示 */}

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[1px] lg:hidden"
          aria-label="出店者メニューを閉じる"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[9999] flex w-72 flex-col border-r border-amber-200 bg-[#FFFDF8] shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-amber-100 bg-gradient-to-r from-amber-500 to-orange-500 px-5 text-white">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🏪</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">Vendor Menu</p>
              <h2 className="text-base font-bold">出店者ページ</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="出店者メニューを閉じる"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-amber-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">{user?.name || "出店者"}</p>
          <p className="mt-0.5 text-xs text-slate-500">モバイルでもすぐに主要機能へ移動できます</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Link href="/map" onClick={onClose} className="flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">🗺️</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">マップを見る</p>
                <p className="text-[11px] text-amber-700">市場全体の流れを確認する</p>
              </div>
            </Link>
          </div>

          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                      : "border-transparent bg-white text-slate-700 hover:border-amber-100 hover:bg-amber-50/70"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="mt-0.5 text-xl" aria-hidden="true">{item.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-amber-100 px-5 py-4">
          <Link
            href="/my-shop"
            onClick={onClose}
            className="flex items-center justify-center rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400"
          >
            マイ店舗へ戻る
          </Link>
        </div>
      </aside>
    </>
  );
}
