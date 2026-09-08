'use client';

/**
 * お気に入り一覧
 *
 * 店ごとにまとめて表示し、商品をぶら下げる。商品を入れていない店は店名だけが並ぶ。
 * 現地で使う主導線はマップ側のお気に入り絞り込みで、このページは
 * 「歩き終わったあとに見返す・地図でまとめて戻る」ための場所として置いている。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Map as MapIcon, Store, X as XIcon } from "lucide-react";
import NavigationBar from "../../components/NavigationBar";
import ShopDetailBanner from "../map/components/ShopDetailBanner";
import { useShops } from "../../../lib/hooks/useShops";
import { getShopBannerImage } from "../../../lib/shopImages";
import { clearSearchMapPayload, saveSearchMapPayload } from "../../../lib/searchMapStorage";
import {
  FAVORITE_SHOPS_KEY,
  FAVORITE_SHOPS_UPDATED_EVENT,
  groupFavoritesByShop,
  loadFavoriteEntries,
  removeFavoriteShop,
  toggleFavoriteProduct,
  type FavoriteEntry,
  type FavoriteShopGroup,
} from "../../../lib/favoriteShops";
import type { Shop } from "../map/data/shops";

const MAP_LABEL = "お気に入りのお店";

/** お気に入りの変更をこのページに反映する（同じタブのイベントと別タブの storage の両方を見る） */
function useFavoriteEntries(): FavoriteEntry[] {
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);

  useEffect(() => {
    const sync = () => setEntries(loadFavoriteEntries());
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_SHOPS_KEY) sync();
    };
    window.addEventListener(FAVORITE_SHOPS_UPDATED_EVENT, sync);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(FAVORITE_SHOPS_UPDATED_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return entries;
}

function shopSubtitle(shop: Shop | undefined): string {
  if (!shop) return "出店情報を読み込み中";
  if (shop.chome) return `${shop.chome} / ${shop.position + 1}番あたり`;
  return `${shop.position + 1}番あたり`;
}

export default function FavoritesPageClient() {
  const router = useRouter();
  const entries = useFavoriteEntries();
  const { shops, isLoading } = useShops();
  const [pendingRemoval, setPendingRemoval] = useState<FavoriteShopGroup | null>(null);
  // 店をタップしたらこのページの上でバナーを開く（/consult と同じ形）
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  const shopById = useMemo(() => {
    const map = new Map<number, Shop>();
    shops.forEach((shop) => map.set(shop.id, shop));
    return map;
  }, [shops]);

  const groups = useMemo(() => groupFavoritesByShop(entries), [entries]);
  const productCount = entries.filter((entry) => entry.product !== null).length;

  const handleShopHeartClick = useCallback((group: FavoriteShopGroup) => {
    // 商品がぶら下がっている店を消すと商品も一緒に消えるので、そこだけ確認を出す
    if (group.products.length > 0) {
      setPendingRemoval(group);
      return;
    }
    removeFavoriteShop(group.shopId);
  }, []);

  const handleConfirmRemoval = useCallback(() => {
    if (!pendingRemoval) return;
    removeFavoriteShop(pendingRemoval.shopId);
    setPendingRemoval(null);
  }, [pendingRemoval]);

  const handleOpenMap = useCallback(() => {
    if (groups.length === 0) {
      clearSearchMapPayload();
      router.push("/map");
      return;
    }
    const ids = groups.map((group) => group.shopId);
    saveSearchMapPayload({ ids, label: MAP_LABEL });
    router.push(`/map?search=1&label=${encodeURIComponent(MAP_LABEL)}`);
  }, [groups, router]);

  const handleSelectShop = useCallback(
    (shopId: number) => {
      const shop = shopById.get(shopId);
      if (shop) setSelectedShop(shop);
    },
    [shopById],
  );

  return (
    <main className="min-h-screen bg-[#f6f3ec] pb-28 text-slate-900 md:pb-20">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#f6f3ec]/95 backdrop-blur-md">
        <div className="mx-auto max-w-xl px-4 pb-4 pt-safe-top">
          <div className="py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-favorite-fg">Favorites</p>
            <h1 className="mt-1 text-[30px] font-black tracking-tight text-slate-900">お気に入り</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              気になったお店と商品をここにためておけます。お店をタップすると詳しく見られます。
            </p>
          </div>

          {groups.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-3xl border border-stone-200 bg-white p-3 shadow-sm">
              <SummaryCell icon={<Store size={16} />} label="お店" value={`${groups.length}店`} />
              <SummaryCell icon={<Heart size={16} />} label="商品" value={`${productCount}品`} />
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-3 px-4 py-5">
        {groups.length === 0 ? (
          <EmptyState onOpenMap={() => router.push("/map")} />
        ) : (
          groups.map((group) => (
            <FavoriteShopCard
              key={group.shopId}
              group={group}
              shop={shopById.get(group.shopId)}
              isLoadingShops={isLoading}
              onSelectShop={handleSelectShop}
              onRemoveShop={handleShopHeartClick}
              onRemoveProduct={toggleFavoriteProduct}
            />
          ))
        )}
      </div>

      {groups.length > 0 && (
        <div
          className="fixed left-0 right-0 z-30 px-4"
          style={{ bottom: "calc(3.25rem + var(--safe-bottom, 0px))" }}
        >
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              onClick={handleOpenMap}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[24px] bg-slate-950 px-5 py-4 text-left text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:bg-black active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <MapIcon size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">Map</p>
                  <p className="text-sm font-bold">お気に入りのお店を地図で見る</p>
                </div>
              </div>
              <span className="text-sm font-bold text-white/80">{groups.length}店</span>
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pendingRemoval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-4 pb-8 backdrop-blur-[2px] sm:items-center sm:pb-0"
            onClick={() => setPendingRemoval(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-base font-bold text-slate-900">お気に入りから外しますか？</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                このお店に入れている{pendingRemoval.products.length}品も一緒に消えます。
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingRemoval(null)}
                  className="min-h-11 flex-1 rounded-2xl bg-stone-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-stone-200"
                >
                  やめる
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoval}
                  className="min-h-11 flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-black"
                >
                  外す
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedShop && (
        <ShopDetailBanner shop={selectedShop} onClose={() => setSelectedShop(null)} />
      )}

      <NavigationBar />
    </main>
  );
}

function SummaryCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="text-sm font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function FavoriteShopCard({
  group,
  shop,
  isLoadingShops,
  onSelectShop,
  onRemoveShop,
  onRemoveProduct,
}: {
  group: FavoriteShopGroup;
  shop: Shop | undefined;
  isLoadingShops: boolean;
  onSelectShop: (shopId: number) => void;
  onRemoveShop: (group: FavoriteShopGroup) => void;
  onRemoveProduct: (shopId: number, product: string) => void;
}) {
  const previewImage = shop
    ? shop.images?.main ||
      shop.images?.thumbnail ||
      shop.images?.additional?.[0] ||
      getShopBannerImage(shop.category, shop.position ?? shop.id)
    : null;

  return (
    <section className="rounded-[22px] border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onSelectShop(group.shopId)}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"
          aria-label={shop ? `${shop.name}の詳細を開く` : "お店の詳細を開く"}
        >
          {previewImage ? (
            <Image src={previewImage} alt="" fill className="object-cover" sizes="64px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-stone-400">
              {isLoadingShops ? "…" : "画像"}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectShop(group.shopId)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-[15px] font-bold text-slate-900">
            {shop?.name ?? (isLoadingShops ? "読み込み中…" : `お店 #${group.shopId}`)}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{shopSubtitle(shop)}</p>
        </button>

        <button
          type="button"
          onClick={() => onRemoveShop(group)}
          aria-label="お気に入りから外す"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-favorite-line bg-favorite-fg text-white shadow-sm transition hover:opacity-90 active:scale-95"
        >
          <Heart size={17} fill="currentColor" />
        </button>
      </div>

      {group.products.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
          {group.products.map((product) => {
            const price = shop?.productPrices?.[product] ?? null;
            return (
              <li key={product}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-favorite-line bg-favorite-bg py-1 pl-3 pr-1 text-[13px] font-semibold text-favorite-fg">
                  {product}
                  {price != null && (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold text-favorite-fg">
                      ¥{price.toLocaleString()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveProduct(group.shopId, product)}
                    aria-label={`${product}をお気に入りから外す`}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-favorite-fg/50 transition hover:bg-white hover:text-favorite-fg"
                  >
                    <XIcon size={13} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ onOpenMap }: { onOpenMap: () => void }) {
  return (
    <div className="rounded-[24px] border border-dashed border-stone-300 bg-white/70 px-5 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-favorite-bg text-favorite-fg">
        <Heart size={24} />
      </span>
      <p className="mt-4 text-base font-bold text-slate-900">まだお気に入りはありません</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
        気になったお店や商品のハートを押すと、ここにたまります。日曜市は1.3kmと長いので、
        先に進んでしまっても地図で戻ってこられます。
      </p>
      <button
        type="button"
        onClick={onOpenMap}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black active:scale-[0.98]"
      >
        <MapIcon size={16} />
        マップでお店を探す
      </button>
    </div>
  );
}
