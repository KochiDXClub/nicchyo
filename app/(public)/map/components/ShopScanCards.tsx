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
 * 【いまは MapLibre 版だけ】
 * 座標の取得は MapCamera だけに頼っているが、Leaflet 版では出さない。
 * あちらの地図はビューポートより大きい正方形のシェルに入っていて CSS で
 * 回転させてあり、latLngToContainerPoint が返すのはその回転した箱の中の
 * 座標だから、ビューポート基準のこの層にそのまま書くとカードが画面外へ飛ぶ。
 * 対応するにはシェルの中に描いて1枚ずつ逆回転させる作りが要る。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Shop } from "../data/shops";
import { isLeafletMap, type MapCamera, type MapCameraEvent } from "../types/mapCamera";
import { getShopBannerImage } from "@/lib/shopImages";
import { getPixelsPerMeter } from "../config/roadStyle";
import { resolveStallColors } from "../config/shopCategories";
import { sanitizeCssColor } from "../utils/markerHtmlGenerator";

/** これ未満のズームでは出さない（Leaflet 換算） */
const MIN_ZOOM = 20.5;
/**
 * 地図が止まってからカードを残す時間。
 *
 * 屋台の並びこそがこの地図の主役なので、止まったあとも長く残すと主客が入れ替わる。
 * 動かしているあいだの検索性を足すだけに留めて、止まったらすぐ屋台の絵に戻す。
 */
const HOLD_MS = 500;

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

/** これ以下の重なりは許容する（隣り合うカードが1〜2px かすめる程度で消さない） */
const COLLISION_TOLERANCE_PX = 3;

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
  highlightShopIds,
  onSelectShop,
}: {
  map: MapCamera | null;
  shops: Shop[];
  /** 他のパネルが開いているときなど、呼び出し側から止めたいとき */
  enabled?: boolean;
  /**
   * 検索結果や AI のおすすめで対象が絞れているときの店舗 ID。
   *
   * 1件でもあれば「絞り込みモード」になり、その店だけカードを出して、
   * ほかの店にはパンしても出さない。探している対象と、それ以外との対比を作る。
   * このモードではパンしていなくても出したままにする（結果の位置を指すため）。
   */
  highlightShopIds?: number[];
  /** カードがタップされたとき。マーカーをタップしたのと同じ扱いにする */
  onSelectShop?: (shop: Shop) => void;
}) {
  const [shown, setShown] = useState(false);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [cardHeight, setCardHeight] = useState(MIN_CARD_HEIGHT);

  const isHighlightMode = (highlightShopIds?.length ?? 0) > 0;

  /** カードを出す候補。絞り込みモードでは対象の店だけ */
  const candidates = useMemo(() => {
    if (!isHighlightMode) return shops;
    const ids = new Set(highlightShopIds);
    return shops.filter((shop) => ids.has(shop.id));
  }, [shops, highlightShopIds, isHighlightMode]);

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

  /**
   * 写真が描ける状態になった URL。
   *
   * カードは写真が主役なので、写真が無い枠が先に出るのは避けたい。固定の待ち時間で
   * ごまかすと、回線が遅ければ間に合わず、速ければ無駄に待つことになる。
   * 読み込みが終わったものから順に出す。
   * 店舗ではなく URL で持つのは、同じ写真を多くの店で使い回しているため
   * （1枚読めれば、それを使う店のカードはすべて出せる）。
   */
  const [loadedPhotos, setLoadedPhotos] = useState<ReadonlySet<string>>(() => new Set());
  const loadedPhotosRef = useRef<ReadonlySet<string>>(loadedPhotos);

  const markPhotoLoaded = useCallback((url: string) => {
    if (loadedPhotosRef.current.has(url)) return;
    const next = new Set(loadedPhotosRef.current);
    next.add(url);
    loadedPhotosRef.current = next;
    setLoadedPhotos(next);
  }, []);

  // 写真を先読みしておく。パンを始めた時点で読み終わっていれば、待たずに出せる
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
      // 読めなかったものも「済み」にする。そうしないとそのカードが永久に出ない
      image.onload = () => markPhotoLoaded(url);
      image.onerror = () => markPhotoLoaded(url);
      image.src = url;
      if (image.complete && image.naturalWidth > 0) markPhotoLoaded(url);
      return image;
    });
    return () => {
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [shops, markPhotoLoaded]);

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
    // Leaflet 版では出さない。
    //
    // Leaflet の地図はビューポートより大きい正方形のシェル（対角線ぶんの一辺）に
    // 入っていて、道が縦になるよう CSS で回転させてある。latLngToContainerPoint が
    // 返すのはその回転した箱の中の座標で、ビューポート基準のこの層にそのまま
    // 書くとカードが画面外に飛ぶ（390x844 で x=1000 付近まで出る）。
    // 正しく出すにはシェルの中に描いて1枚ずつ逆回転させる必要があり、
    // 屋台マーカーが --map-rotation-inverse でやっているのと同じ作りになる。
    // いまの描画は MapLibre 版なので、Leaflet 版を残しているあいだは出さない。
    if (!map || !enabled || isLeafletMap(map)) {
      setShown(false);
      return;
    }
    // 絞り込みモードでは、パンの有無に関わらずズームだけで決める。
    // 結果の位置を指し続けたいので動きは見ないが、引いた状態でカードが密集して
    // 読めなくなるのは通常時と同じなので、ズームの下限には従う
    if (isHighlightMode) {
      const syncByZoom = () => {
        const next = map.getZoom() >= MIN_ZOOM;
        if (next !== shownRef.current) setShown(next);
      };
      syncByZoom();
      map.on("move", syncByZoom);
      map.on("zoomend", syncByZoom);
      return () => {
        map.off("move", syncByZoom);
        map.off("zoomend", syncByZoom);
      };
    }
    // 絞り込みモードから戻ってきたときに出したままにならないよう、一度伏せる。
    // パンの途中なら、次の move ですぐ出る
    setShown(false);

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
  }, [map, enabled, isHighlightMode]);

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

  /**
   * 位置と、出す顔ぶれの更新。
   *
   * 地図が動いたときだけ rAF を 1 つ積む。絞り込みモードは動きに関係なく出したままに
   * するので、常時 rAF を回すと止まっているあいだも電池を使い続けることになる。
   *
   * 重なりの回避もここで行う。カードの高さは店舗間隔から逆算しているが、それは
   * 道が縦向きのときの話で、地図を回すと並びが変わって重なる。絞り込みモードでは
   * 対象が離れて散らばるとも限らない。画面の中心に近いものから置いて、
   * すでに置いたカードと重なるものは出さない。
   */
  useEffect(() => {
    if (!map || !shown) return;

    let raf = 0;
    let disposed = false;

    const update = () => {
      raf = 0;
      if (disposed) return;

      const container = map.getContainer();
      const width = container.clientWidth;
      const height = container.clientHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      const nextHeight = getCardHeight(map.getZoom());
      if (nextHeight !== cardHeightRef.current) {
        cardHeightRef.current = nextHeight;
        setCardHeight(nextHeight);
      }
      const currentHeight = cardHeightRef.current;

      // 画面（と少しの余白）に入っているものを、中心に近い順に並べる
      const inView: Array<{ id: number; point: Point; distance: number }> = [];
      for (const shop of candidates) {
        const point = map.latLngToContainerPoint([shop.lat, shop.lng]);
        if (
          point.x < -VIEWPORT_MARGIN ||
          point.x > width + VIEWPORT_MARGIN ||
          point.y < -VIEWPORT_MARGIN ||
          point.y > height + VIEWPORT_MARGIN
        ) {
          continue;
        }
        inView.push({
          id: shop.id,
          point,
          distance: Math.hypot(point.x - centerX, point.y - centerY),
        });
      }
      inView.sort((a, b) => a.distance - b.distance);

      const placed: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      const next: number[] = [];
      for (const item of inView) {
        const rect = {
          x1: item.point.x - CARD_WIDTH / 2,
          y1: item.point.y - currentHeight,
          x2: item.point.x + CARD_WIDTH / 2,
          y2: item.point.y,
        };
        const collides = placed.some(
          (other) =>
            rect.x1 < other.x2 - COLLISION_TOLERANCE_PX &&
            rect.x2 > other.x1 + COLLISION_TOLERANCE_PX &&
            rect.y1 < other.y2 - COLLISION_TOLERANCE_PX &&
            rect.y2 > other.y1 + COLLISION_TOLERANCE_PX
        );
        if (collides) continue;
        placed.push(rect);
        next.push(item.id);
        pointsRef.current.set(item.id, item.point);
        const node = nodesRef.current.get(item.id);
        if (node) {
          node.style.transform = `translate3d(${Math.round(rect.x1)}px, ${Math.round(rect.y1)}px, 0)`;
        }
      }

      // 顔ぶれの比較は並び順に依存しないよう、id を昇順に揃えてから行う
      next.sort((a, b) => a - b);
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
    };

    const schedule = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(update);
    };

    schedule();
    const events: MapCameraEvent[] = ["move", "zoom", "moveend", "zoomend"];
    for (const event of events) map.on(event, schedule);
    return () => {
      disposed = true;
      if (raf !== 0) cancelAnimationFrame(raf);
      for (const event of events) map.off(event, schedule);
    };
  }, [map, candidates, shown]);

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
        const photo = resolvePhoto(shop);
        // 写真が描けるようになったカードだけ出す
        const photoReady = loadedPhotos.has(photo);
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
                出現は写真が読めてからクラスを付けて走らせる。消えるときは層ごとフェード */}
            <div
              className={`relative h-full w-full overflow-hidden rounded-[14px] ${
                photoReady ? "nicchyo-scan-card" : "opacity-0"
              }`}
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
                src={photo}
                alt=""
                decoding="async"
                draggable={false}
                onLoad={() => markPhotoLoaded(photo)}
                // 読めなかったものも「済み」にする。そうしないとカードが永久に出ない
                onError={() => markPhotoLoaded(photo)}
                ref={(el) => {
                  // キャッシュ済みだと onLoad が付く前に発火し終えていることがある
                  if (el?.complete && el.naturalWidth > 0) markPhotoLoaded(photo);
                }}
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
