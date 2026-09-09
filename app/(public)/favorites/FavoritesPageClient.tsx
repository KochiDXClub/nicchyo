'use client';

/**
 * お気に入り一覧
 *
 * 店ごとにまとめて表示し、商品をぶら下げる。商品を入れていない店は店名だけが並ぶ。
 * 現地で使う主導線はマップ側のお気に入り絞り込みで、このページは
 * 「歩き終わったあとに見返す」「次にどこへ戻るか決める」ための場所。
 *
 * 並びは既定で場所順（丁目 → 道沿いの位置）。日曜市は約1.3kmの一本道なので、
 * 追加した順よりも「どっちの方向に何軒あるか」の方が現地では役に立つ。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Map as MapIcon, X as XIcon } from "lucide-react";
import NavigationBar from "../../components/NavigationBar";
import ShopDetailBanner from "../map/components/ShopDetailBanner";
import { useShops } from "../../../lib/hooks/useShops";
import { getShopBannerImage } from "../../../lib/shopImages";
import { saveSearchMapPayload } from "../../../lib/searchMapStorage";
import { useFavoriteEntries } from "../../../lib/hooks/useFavorites";
import {
  groupFavoritesByShop,
  loadFavoriteEntries,
  removeFavoriteShop,
  saveFavoriteEntries,
  toggleFavoriteProduct,
  type FavoriteEntry,
  type FavoriteShopGroup,
} from "../../../lib/favoriteShops";
import type { Shop } from "../map/data/shops";

const MAP_LABEL = "お気に入りのお店";
const SORT_STORAGE_KEY = "nicchyo-favorites-sort";
const NO_CHOME_LABEL = "丁目がまだ分からないお店";

type SortKey = "place" | "added";

/** 取り消しを出しておく時間 */
const UNDO_DURATION_MS = 6000;

type UndoItem = { id: number; label: string; entries: FavoriteEntry[] };

/** 並びの好みは端末に覚えさせる。毎回選び直させない */
function loadSort(): SortKey {
  if (typeof window === "undefined") return "place";
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) === "added" ? "added" : "place";
  } catch {
    return "place";
  }
}

type Row = FavoriteShopGroup & { shop: Shop | undefined };
type Section = { key: string; label: string | null; rows: Row[] };

/**
 * 表示用の並びを作る。
 * 場所順は丁目ごとに区切り、丁目の中は道沿いの位置で並べる。
 * 追加順は区切らずに1本の並びにする（新しいものが上）。
 */
function buildSections(rows: Row[], sort: SortKey): Section[] {
  if (sort === "added") {
    return rows.length > 0 ? [{ key: "added", label: null, rows }] : [];
  }

  const byChome = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.shop?.chome ?? NO_CHOME_LABEL;
    const list = byChome.get(key);
    if (list) list.push(row);
    else byChome.set(key, [row]);
  }

  return Array.from(byChome.entries())
    .map(([label, groupRows]) => ({
      key: label,
      label,
      rows: groupRows.sort(
        (a, b) => (a.shop?.position ?? Infinity) - (b.shop?.position ?? Infinity),
      ),
    }))
    // 丁目そのものの並びも道沿いの順にする。丁目が分からないものは最後
    .sort((a, b) => {
      if (a.label === NO_CHOME_LABEL) return 1;
      if (b.label === NO_CHOME_LABEL) return -1;
      return (a.rows[0]?.shop?.position ?? Infinity) - (b.rows[0]?.shop?.position ?? Infinity);
    });
}

export default function FavoritesPageClient() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const entries = useFavoriteEntries();
  const { shops, isLoading } = useShops();
  const [pendingRemoval, setPendingRemoval] = useState<FavoriteShopGroup | null>(null);
  // 店をタップしたらこのページの上でバナーを開く（/consult と同じ形）
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [sort, setSort] = useState<SortKey>("place");
  // 外したものを戻せるようにする。1タップで消せる代わりに、必ず戻せる。
  // ハート1つで消せる以上、続けて何件も外すのは普通に起きるので、
  // 1件しか覚えないと2件目を外した時点で1件目が戻せなくなる。積んで持つ
  const [undos, setUndos] = useState<UndoItem[]>([]);
  const undoTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const undoSeqRef = useRef(0);

  useEffect(() => setSort(loadSort()), []);

  useEffect(() => {
    const timers = undoTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const dropUndo = useCallback((id: number) => {
    const timer = undoTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimersRef.current.delete(id);
    setUndos((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const offerUndo = useCallback(
    (label: string, removed: FavoriteEntry[]) => {
      if (removed.length === 0) return;
      const id = ++undoSeqRef.current;
      setUndos((prev) => [...prev, { id, label, entries: removed }]);
      undoTimersRef.current.set(
        id,
        setTimeout(() => dropUndo(id), UNDO_DURATION_MS),
      );
    },
    [dropUndo],
  );

  // 新しく外したものから戻す。戻すと、その1つ前の取り消しが顔を出す
  const handleUndo = useCallback(() => {
    const latest = undos[undos.length - 1];
    if (!latest) return;
    saveFavoriteEntries([...loadFavoriteEntries(), ...latest.entries]);
    dropUndo(latest.id);
  }, [undos, dropUndo]);

  const changeSort = useCallback((next: SortKey) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      // 保存できなくても並び替えそのものは効かせる
    }
  }, []);

  const shopById = useMemo(() => {
    const map = new Map<number, Shop>();
    shops.forEach((shop) => map.set(shop.id, shop));
    return map;
  }, [shops]);

  const rows = useMemo<Row[]>(
    () => groupFavoritesByShop(entries).map((group) => ({ ...group, shop: shopById.get(group.shopId) })),
    [entries, shopById],
  );
  const sections = useMemo(() => buildSections(rows, sort), [rows, sort]);
  const productCount = entries.filter((entry) => entry.product !== null).length;

  const removeShop = useCallback(
    (shopId: number, label: string) => {
      const removed = loadFavoriteEntries().filter((entry) => entry.shopId === shopId);
      removeFavoriteShop(shopId);
      offerUndo(label, removed);
    },
    [offerUndo],
  );

  const handleShopHeartClick = useCallback(
    (row: Row) => {
      // 商品がぶら下がっている店を消すと商品も一緒に消えるので、そこだけ確認を出す。
      // 店だけのときは1タップで外して、取り消しで戻せるようにする
      if (row.products.length > 0) {
        setPendingRemoval(row);
        return;
      }
      removeShop(row.shopId, row.shop?.name ?? "お店");
    },
    [removeShop],
  );

  const handleConfirmRemoval = useCallback(() => {
    if (!pendingRemoval) return;
    removeShop(pendingRemoval.shopId, shopById.get(pendingRemoval.shopId)?.name ?? "お店");
    setPendingRemoval(null);
  }, [pendingRemoval, removeShop, shopById]);

  const handleRemoveProduct = useCallback(
    (shopId: number, product: string) => {
      const removed = loadFavoriteEntries().filter(
        (entry) => entry.shopId === shopId && entry.product === product,
      );
      toggleFavoriteProduct(shopId, product);
      offerUndo(product, removed);
    },
    [offerUndo],
  );

  const handleOpenMap = useCallback(() => {
    const ids = rows.map((row) => row.shopId);
    if (ids.length === 0) {
      router.push("/map");
      return;
    }
    saveSearchMapPayload({ ids, label: MAP_LABEL });
    router.push(`/map?search=1&label=${encodeURIComponent(MAP_LABEL)}`);
  }, [rows, router]);

  const handleSelectShop = useCallback(
    (shopId: number) => {
      const shop = shopById.get(shopId);
      if (shop) setSelectedShop(shop);
    },
    [shopById],
  );

  const isEmpty = rows.length === 0;

  return (
    <main className="min-h-screen bg-[#f6f3ec] pb-20 text-slate-900">
      {/* スクロール中も残すのは、見出しと「地図でみる」だけにする。
          並び替えは一度決めれば触らないので、本文と一緒に流す */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#f6f3ec]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-safe-top">
          <h1 className="flex min-w-0 items-baseline gap-2 py-3">
            <span className="text-[22px] font-black leading-none tracking-tight">お気に入り</span>
            {!isEmpty && (
              <span className="shrink-0 text-[12px] font-semibold text-slate-400">
                {rows.length}店{productCount > 0 && ` ・ ${productCount}品`}
              </span>
            )}
          </h1>

          {!isEmpty && (
            <button
              type="button"
              onClick={handleOpenMap}
              className="my-1.5 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-[13px] font-bold text-white transition hover:bg-black active:scale-95"
            >
              <MapIcon size={15} />
              地図でみる
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pb-4">
        {isEmpty ? (
          <EmptyState onOpenMap={() => router.push("/map")} />
        ) : (
          <div className="space-y-5">
            <SortToggle value={sort} onChange={changeSort} />
            {sections.map((section) => (
              <section key={section.key}>
                {section.label && (
                  <h2 className="mb-1.5 flex items-baseline gap-2 px-1">
                    <span className="text-[13px] font-black tracking-wide text-slate-700">
                      {section.label}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {section.rows.length}店
                    </span>
                  </h2>
                )}

                <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-[18px] border border-stone-200 bg-white">
                  {section.rows.map((row) => (
                    <FavoriteRow
                      key={row.shopId}
                      row={row}
                      isLoadingShops={isLoading}
                      showChome={sort === "added"}
                      onSelectShop={handleSelectShop}
                      onRemoveShop={handleShopHeartClick}
                      onRemoveProduct={handleRemoveProduct}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <UndoToast
        undo={undos[undos.length - 1] ?? null}
        pendingCount={undos.length}
        onUndo={handleUndo}
        reduceMotion={!!prefersReducedMotion}
      />

      <RemoveShopDialog
        productCount={pendingRemoval?.products.length ?? 0}
        open={!!pendingRemoval}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={handleConfirmRemoval}
        reduceMotion={!!prefersReducedMotion}
      />

      {selectedShop && (
        <ShopDetailBanner shop={selectedShop} onClose={() => setSelectedShop(null)} />
      )}

      <NavigationBar />
    </main>
  );
}

/** 並び替え。選択肢が2つなので、開くのではなくその場で切り替えられる形にする */
function SortToggle({ value, onChange }: { value: SortKey; onChange: (next: SortKey) => void }) {
  const options: { key: SortKey; label: string }[] = [
    { key: "place", label: "場所順" },
    { key: "added", label: "追加順" },
  ];

  return (
    <div
      role="group"
      aria-label="並び替え"
      className="inline-flex rounded-full border border-stone-200 bg-white p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={`min-h-9 rounded-full px-3.5 text-[13px] font-bold transition ${
            value === option.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FavoriteRow({
  row,
  isLoadingShops,
  showChome,
  onSelectShop,
  onRemoveShop,
  onRemoveProduct,
}: {
  row: Row;
  isLoadingShops: boolean;
  /** 丁目で区切っていないときだけ、行のほうに丁目を出す */
  showChome: boolean;
  onSelectShop: (shopId: number) => void;
  onRemoveShop: (row: Row) => void;
  onRemoveProduct: (shopId: number, product: string) => void;
}) {
  const { shop } = row;
  const previewImage = shop
    ? shop.images?.main ||
      shop.images?.thumbnail ||
      shop.images?.additional?.[0] ||
      getShopBannerImage(shop.category, shop.position ?? shop.id)
    : null;

  const place = shop
    ? [showChome ? shop.chome : null, `${shop.position + 1}番あたり`].filter(Boolean).join(" ・ ")
    : isLoadingShops
      ? "読み込み中"
      : "出店情報が見つかりません";

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSelectShop(row.shopId)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={shop ? `${shop.name}の詳細を開く` : "お店の詳細を開く"}
        >
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
            {previewImage ? (
              <Image src={previewImage} alt="" fill className="object-cover" sizes="56px" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight">
              {shop?.name ?? (isLoadingShops ? "読み込み中…" : `お店 #${row.shopId}`)}
            </span>
            <span className="mt-1 block truncate text-[12px] text-slate-500">{place}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onRemoveShop(row)}
          aria-label="お気に入りから外す"
          className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-favorite-fg/75 transition hover:bg-favorite-bg hover:text-favorite-fg active:scale-90"
        >
          <Heart size={18} fill="currentColor" />
        </button>
      </div>

      {row.products.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-[68px]">
          {row.products.map((product) => {
            const price = shop?.productPrices?.[product] ?? null;
            return (
              <li key={product}>
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-favorite-bg pl-2.5 pr-1 text-[12px] font-semibold text-favorite-fg">
                  <span className="max-w-[9rem] truncate">{product}</span>
                  {price != null && (
                    <span className="text-[11px] font-bold opacity-70">¥{price.toLocaleString()}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveProduct(row.shopId, product)}
                    aria-label={`${product}をお気に入りから外す`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white active:scale-90"
                  >
                    <XIcon size={13} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function EmptyState({ onOpenMap }: { onOpenMap: () => void }) {
  return (
    <div className="flex min-h-[58vh] flex-col items-center justify-center px-6 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-favorite-bg text-favorite-fg">
        <Heart size={28} />
      </span>
      <p className="mt-5 text-[15px] font-bold">気になったお店のハートを押すと、ここにたまります</p>
      <button
        type="button"
        onClick={onOpenMap}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-black active:scale-[0.98]"
      >
        <MapIcon size={16} />
        マップでお店を探す
      </button>
    </div>
  );
}

/**
 * 外したものを戻す知らせ。
 *
 * ハート1つで消せるようにしている以上、取り消せることが前提になる。
 * 位置は下部ナビとセーフエリアの上。
 */
function UndoToast({
  undo,
  pendingCount,
  onUndo,
  reduceMotion,
}: {
  undo: UndoItem | null;
  /** まだ戻せるものの数。2件以上なら「あと何件戻せるか」を出す */
  pendingCount: number;
  onUndo: () => void;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {undo && (
        <motion.div
          key={undo.id}
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 z-40 px-4"
          style={{ bottom: "calc(4.75rem + var(--safe-bottom, 0px))" }}
        >
          <div className="pointer-events-auto mx-auto flex max-w-sm items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{undo.label}</p>
              <p className="text-[12px] text-white/65">
                お気に入りから外しました
                {pendingCount > 1 && ` ・ ほかに${pendingCount - 1}件戻せます`}
              </p>
            </div>
            <button
              type="button"
              onClick={onUndo}
              className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold transition hover:bg-white/25 active:scale-95"
            >
              元に戻す
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** お店ごと外すときの確認。入れている商品も一緒に消えるため、ここだけ確認を出す */
function RemoveShopDialog({
  productCount,
  open,
  onCancel,
  onConfirm,
  reduceMotion,
}: {
  productCount: number;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-4 backdrop-blur-[2px] sm:items-center"
          style={{ paddingBottom: "calc(2rem + var(--safe-bottom, 0px))" }}
          onClick={onCancel}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-base font-bold">お気に入りから外しますか？</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              このお店に入れている{productCount}品も一緒に消えます。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-12 flex-1 rounded-2xl bg-stone-100 text-sm font-bold text-slate-700 transition hover:bg-stone-200"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-12 flex-1 rounded-2xl bg-slate-900 text-sm font-bold text-white transition hover:bg-black"
              >
                外す
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
