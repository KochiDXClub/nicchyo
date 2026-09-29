"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Map as MapIcon, Megaphone, Store } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  BottomNavBackBar,
  BottomNavLink,
  MenuDivider,
  MenuRow,
  MenuSheet,
  MenuToggleButton,
  MenuUserRow,
} from "@/components/navigation/MenuSheet";
import { VENDOR_NAV_ITEMS } from "./vendorNavItems";

const HOME_HREF = "/my-shop";

const mainItems = VENDOR_NAV_ITEMS.filter((item) => item.group === "main");
const supportItems = VENDOR_NAV_ITEMS.filter((item) => item.group === "support");

/**
 * 出店者向けの下部バーとメニューシート。
 * 見た目と操作感は来訪者向けの NavigationBar と同じ部品（components/navigation/MenuSheet）で揃える。
 */
export default function VendorNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const isHome = pathname === HOME_HREF;
  // /vendor/* はPCでサイドバーが出るので下部バーはlg以上で隠す。
  // /my-shop* はサイドバーが無いので全サイズで表示する。
  const inVendorConsole = pathname?.startsWith("/vendor") ?? false;

  // ルート変更でシートを閉じる
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

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
      <MenuSheet
        open={sheetOpen}
        onClose={closeSheet}
        label="出店者メニュー"
        returnFocusRef={menuButtonRef}
      >
        {user?.name && (
          <>
            <MenuUserRow
              name={user.name}
              avatarUrl={user.avatarUrl}
              roleLabel="出店者"
              onClick={() => go("/vendor/account")}
            />
            <MenuDivider />
          </>
        )}

        {/* ─ お店の運営で使うページ ─ */}
        {mainItems.map((item) => (
          <MenuRow key={item.href} icon={item.icon} label={item.label} onClick={() => go(item.href)} />
        ))}

        {/* ─ 使い方・設定・マップ ─ */}
        <MenuDivider />
        {supportItems.map((item) => (
          <MenuRow key={item.href} icon={item.icon} label={item.label} muted onClick={() => go(item.href)} />
        ))}
        <MenuRow icon={MapIcon} label="マップを見る" muted onClick={() => go("/map")} />

        {/* ─ ログアウト ─ */}
        <MenuDivider />
        <MenuRow icon={LogOut} label="ログアウト" muted onClick={handleLogout} />
      </MenuSheet>

      {/* ── 下部バー ─────────────────────────────────────── */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-[9997] border-t border-slate-200/60 bg-white/90 text-sm leading-none shadow-sm backdrop-blur-md ${
          inVendorConsole ? "lg:hidden" : ""
        }`}
        style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
      >
        {isHome ? (
          <div className="mx-auto flex h-14 max-w-lg items-center">
            <BottomNavLink href="/vendor/store" label="店舗情報" icon={Store} />
            <MenuToggleButton
              open={sheetOpen}
              onClick={() => setSheetOpen((v) => !v)}
              buttonRef={menuButtonRef}
            />
            <BottomNavLink href="/vendor/post/new" label="投稿" icon={Megaphone} />
          </div>
        ) : (
          <BottomNavBackBar label="マイ店舗へ戻る" onClick={() => router.push(HOME_HREF)} />
        )}
      </nav>
    </>
  );
}
