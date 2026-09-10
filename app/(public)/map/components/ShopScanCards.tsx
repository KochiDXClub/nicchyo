"use client";

/**
 * 探しているときだけ出る、写真中心の店舗カード
 *
 * 【なぜ出すか】
 * 静止しているときの地図は「日曜市の絵」であってほしいので、店名は出さない。
 * 一方で地図を動かしているときは店を探している場面なので、そのあいだだけ
 * 写真と名前を前に出す。屋台マーカーは消さず、その上に重ねる。
 *
 * 【出す条件】
 * - ズームが MIN_ZOOM 以上（引いた状態ではカードが密集して読めないため）
 * - 地図が動いた直後。止まってから HOLD_MS のあいだは残す
 *
 * 止まった瞬間に消すと「動いている絵しか読めない」ことになるので、
 * 静止してからしばらく残して、静止画で読める時間を作る。
 *
 * 【カードの形】
 * 写真・名前・屋根の色を1枚の板にまとめる。名前は写真の中の帯に置き、
 * カードの高さ＝写真の高さに保つ。名前を写真の外に出すと、その分だけ
 * 写真を小さくすることになり「写真が主役」が崩れる。
 *
 * かつて 220px 幅の写真＋店名カードが木札として存在したが、店舗間隔に対して
 * 3倍近く重なるため廃止された（app/globals.css の .shop-nameplate 参照）。
 * 今回は縦積みにして、間隔から逆算した高さに収めることで成立させている。
 *
 * 【レンダラー非依存】
 * MapCamera だけを使うので Leaflet 版・MapLibre 版の両方で動く。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Shop } from "../data/shops";
import type { MapCamera } from "../types/mapCamera";
import { getShopBannerImage } from "@/lib/shopImages";
import { getPixelsPerMeter } from "../config/roadStyle";
import { resolveStallColors } from "../config/shopCategories";
import { sanitizeCssColor } from "../utils/markerHtmlGenerator";

/** これ未満のズームでは出さない（Leaflet 換算） */
const MIN_ZOOM = 20.5;
/** 地図が止まってからカードを残す時間 */
const HOLD_MS = 2500;

/**
 * 列の中の店舗間隔（メートル）。market_locations 300件の実測値。
 * 左右それぞれ 150 店が等間隔に並んでいる。
 */
const SHOP_SPACING_METERS = 5.9;

/** カードの幅。左右の列（最大ズームで中心から約121px）でも画面内に収まる値 */
const CARD_WIDTH = 108;
/** カードの高さ＝写真の高さ。下限・上限 */
const MIN_CARD_HEIGHT = 56;
const MAX_CARD_HEIGHT = 88;
/** 隣のカードとのあいだに残す隙間 */
const CARD_GAP = 8;

/** 画面の外どれだけまで先読みして出すか */
const VIEWPORT_MARGIN = 160;

/** これ以上動いていたらドラッグ（パン）とみなしてタップにしない */
const TAP_MOVE_TOLERANCE_PX = 8;
/** これより長く押していたらタップにしない */
const TAP_MAX_DURATION_MS = 700;

/** 消えるときのフェード時間。globals.css の出現アニメーションと対になる */
const FADE_OUT_MS = 200;
/** 写真を先読みする最大枚数（同じ画像を使い回すので実際はもっと少ない） */
const PRELOAD_LIMIT = 24;

/**
 * ズームからカードの高さを決める。
 *
 * 拡大するほど店舗の間隔が画面上で広がるので、その余白ぶんだけ大きくする。
 * 固定サイズだと、いちばん密なズームに合わせて小さいままになってしまう。
 * 4px 刻みに丸めて、ズーム中の書き換え回数を抑える。
 *
 * ※ 地図を大きく回転させると店舗の並びが縦方向でなくなるため、この見積もりは
 *   甘くなる（カードが少し重なる）。自動回転で道は縦向きに保たれる前提の値。
 */
function getCardHeight(zoom: number): number {
  const spacingPx = SHOP_SPACING_METERS * getPixelsPerMeter(zoom);
  const room = spacingPx - CARD_GAP;
  const clamped = Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, room));
  return Math.round(clamped / 4) * 4;
}

type Point = { x: number; y: number };

function resolvePhoto(shop: Shop): string {
  return shop.images?.main ?? getShopBannerImage(shop.category, shop.position ?? shop.id);
}

export default function ShopScanCards({
  map,
  shops,
  enabled = true,
  onActiveChange,
  onSelectShop,
}: {
  map: MapCamera | null;
  shops: Shop[];
  /** 他のパネルが開いているときなど、呼び出し側から止めたいとき */
  enabled?: boolean;
  /** カードが出ている / 消えたときに呼ばれる。マーカー側の木札と写真窓を伏せるのに使う */
  onActiveChange?: (active: boolean) => void;
  /** カードがタップされたとき。マーカーをタップしたのと同じ扱いにする */
  onSelectShop?: (shop: Shop) => void;
}) {
  const [shown, setShown] = useState(false);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [cardHeight, setCardHeight] = useState(MIN_CARD_HEIGHT);

  useEffect(() => {
    onActiveChange?.(shown);
  }, [shown, onActiveChange]);

  // フェードアウトが終わったらカードを外す。
  // 残したままだと、次に出るときマウント済みで出現アニメーションが走らない
  useEffect(() => {
    if (shown) return;
    const timer = setTimeout(() => {
      visibleIdsRef.current = [];
      setVisibleIds([]);
    }, FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  // 写真を先読みしておく。初回のパンでデコードが一斉に走ると、
  // カードが1枚ずつ遅れて現れて出方が乱れる
  useEffect(() => {
    if (typeof window === "undefined" || shops.length === 0) return;
    const urls = new Set<string>();
    for (const shop of shops) {
      urls.add(resolvePhoto(shop));
      if (urls.size >= PRELOAD_LIMIT) break;
    }
    const images = [...urls].map((url) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
      return image;
    });
    return () => {
      for (const image of images) image.src = "";
    };
  }, [shops]);

  const shopById = useMemo(() => {
    const m = new Map<number, Shop>();
    for (const shop of shops) m.set(shop.id, shop);
    return m;
  }, [shops]);

  /** 直近の画面座標。描画は React、位置の更新は DOM 直書きで分ける */
  const pointsRef = useRef(new Map<number, Point>());
  const nodesRef = useRef(new Map<number, HTMLDivElement | null>());
  const visibleIdsRef = useRef<number[]>([]);
  const cardHeightRef = useRef(MIN_CARD_HEIGHT);
  const shownRef = useRef(false);
  shownRef.current = shown;

  const setNode = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) nodesRef.current.set(id, el);
    else nodesRef.current.delete(id);
  }, []);

  // 動きの検知。move はズーム中にも飛ぶので、ズームで探しているときも出る
  useEffect(() => {
    if (!map || !enabled) {
      setShown(false);
      return;
    }

    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const wake = () => {
      if (holdTimer) clearTimeout(holdTimer);
      const next = map.getZoom() >= MIN_ZOOM;
      // 毎フレーム setState しないよう、変化したときだけ通す
      if (next !== shownRef.current) setShown(next);
    };

    const sleep = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(() => setShown(false), HOLD_MS);
    };

    map.on("move", wake);
    map.on("moveend", sleep);
    return () => {
      map.off("move", wake);
      map.off("moveend", sleep);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [map, enabled]);

  /**
   * カードのタップ判定。
   *
   * カード層は pointer-events: none のままにしてある。カードが当たり判定を持つと
   * その上から始めたドラッグを地図が受け取れず、パンできなくなるため。
   * 代わりに地図コンテナの click を拾い、押した位置からほとんど動いていない
   * ときだけタップとみなして、カードの矩形と突き合わせる。
   */
  useEffect(() => {
    if (!map || !shown || !onSelectShop) return;
    const container = map.getContainer();

    let downX = 0;
    let downY = 0;
    let downAt = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      downAt = e.timeStamp;
    };

    const onClick = (e: MouseEvent) => {
      // ドラッグの終わりにも click は飛ぶので、動いた量と時間で弾く
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MOVE_TOLERANCE_PX) return;
      if (e.timeStamp - downAt > TAP_MAX_DURATION_MS) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const height = cardHeightRef.current;

      let bestId: number | null = null;
      let bestDistance = Infinity;
      for (const id of visibleIdsRef.current) {
        const point = pointsRef.current.get(id);
        if (!point) continue;
        // カードは店舗の座標を下端として、上に伸びている
        if (Math.abs(x - point.x) > CARD_WIDTH / 2) continue;
        if (y < point.y - height || y > point.y) continue;
        // 隣のカードとわずかに重なる場合に備えて、中心が近いほうを採る
        const distance = Math.hypot(x - point.x, y - (point.y - height / 2));
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = id;
        }
      }
      if (bestId === null) return;
      const shop = shopById.get(bestId);
      if (shop) onSelectShop(shop);
    };

    container.addEventListener("pointerdown", onPointerDown, { passive: true });
    container.addEventListener("click", onClick);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("click", onClick);
    };
  }, [map, shown, onSelectShop, shopById]);

  // 出ているあいだだけ、毎フレーム位置を更新する
  useEffect(() => {
    if (!map || !shown) return;

    let raf = 0;
    const tick = () => {
      const container = map.getContainer();
      const width = container.clientWidth;
      const height = container.clientHeight;

      const nextHeight = getCardHeight(map.getZoom());
      if (nextHeight !== cardHeightRef.current) {
        cardHeightRef.current = nextHeight;
        setCardHeight(nextHeight);
      }
      const currentHeight = cardHeightRef.current;

      const next: number[] = [];
      for (const shop of shops) {
        const point = map.latLngToContainerPoint([shop.lat, shop.lng]);
        if (
          point.x < -VIEWPORT_MARGIN ||
          point.x > width + VIEWPORT_MARGIN ||
          point.y < -VIEWPORT_MARGIN ||
          point.y > height + VIEWPORT_MARGIN
        ) {
          continue;
        }
        next.push(shop.id);
        pointsRef.current.set(shop.id, point);
        const node = nodesRef.current.get(shop.id);
        if (node) {
          node.style.transform = `translate3d(${Math.round(point.x - CARD_WIDTH / 2)}px, ${Math.round(point.y - currentHeight)}px, 0)`;
        }
      }

      const prev = visibleIdsRef.current;
      let changed = prev.length !== next.length;
      if (!changed) {
        for (let i = 0; i < next.length; i += 1) {
          if (prev[i] !== next[i]) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        visibleIdsRef.current = next;
        setVisibleIds(next);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [map, shops, shown]);

  if (visibleIds.length === 0) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[400] overflow-hidden transition-opacity ease-out ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
      aria-hidden="true"
    >
      {visibleIds.map((id) => {
        const shop = shopById.get(id);
        if (!shop) return null;
        const point = pointsRef.current.get(id);
        const roof = resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color));
        return (
          <div
            key={id}
            ref={(el) => setNode(id, el)}
            className="absolute left-0 top-0 will-change-transform"
            style={{
              width: CARD_WIDTH,
              height: cardHeight,
              transform: point
                ? `translate3d(${Math.round(point.x - CARD_WIDTH / 2)}px, ${Math.round(point.y - cardHeight)}px, 0)`
                : "translate3d(-9999px, -9999px, 0)",
            }}
          >
            {/* 位置は外側、出入りの見た目は内側。transform を取り合わないよう分ける。
                出現は CSS アニメーション（マウント時に走る）、消えるときは層ごとフェード */}
            <div
              className="nicchyo-scan-card relative h-full w-full overflow-hidden rounded-[14px]"
              style={{
                // 写真が読めなかったときに白い穴が空かないよう、屋根の淡い色を下敷きにする
                backgroundColor: roof.light,
                // 縁と影をひとつの box-shadow にまとめ、影の二重掛けを避ける
                boxShadow: `0 0 0 2px ${roof.dark}, 0 5px 14px rgba(58,58,58,0.26)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element --
                  パン中に十数枚が付け外しされるため、next/image のラッパーと
                  最適化エンドポイントを挟まない素の img で出す。読み込むのは
                  地図側でも使っている小さな webp なので最適化の利得も薄い */}
              <img
                src={resolvePhoto(shop)}
                alt=""
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {shop.name ? (
                <span
                  className="absolute inset-x-0 bottom-0 block truncate px-[7px] py-[3px] text-[10.5px] font-bold leading-[13px] tracking-[0.01em] text-white"
                  style={{ backgroundColor: roof.dark }}
                >
                  {shop.name}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
