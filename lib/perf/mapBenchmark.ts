/**
 * マップ描画のベンチマーク
 *
 * 【目的】
 * マーカー描画方式の変更前後で「体感の重さ」を数値で比べる。
 * 管理画面の /admin/map-perf から iframe 越しに呼び出される。
 *
 * 【計測するもの】
 * - フレーム時間: requestAnimationFrame の間隔。33ms 超は 30fps を割った「コマ落ち」とみなす
 * - ロングタスク: PerformanceObserver('longtask') が拾う 50ms 超のメインスレッド占有
 * - 同期コスト: クラス付替後に強制レイアウトさせたときの所要時間（スタイル再計算＋レイアウト）
 * - DOM 要素数: マーカーペイン配下の要素数
 *
 * Leaflet の Map インスタンスは呼び出し側（MapPerfBridge）から渡す。
 * ここでは Leaflet 型に依存させず、必要なメソッドだけを構造的に受け取る。
 */

export interface BenchMapLike {
  getZoom(): number;
  getMinZoom(): number;
  getMaxZoom(): number;
  setZoom(zoom: number, options?: { animate?: boolean }): unknown;
  panBy(offset: [number, number], options?: { animate?: boolean; duration?: number }): unknown;
  once(event: string, handler: () => void): unknown;
  off(event: string, handler: () => void): unknown;
  getContainer(): HTMLElement;
}

export interface FrameStats {
  /** 計測したフレーム数 */
  frames: number;
  /** 平均フレーム時間 (ms) */
  avgMs: number;
  /** 最長フレーム時間 (ms) */
  maxMs: number;
  /** 95 パーセンタイルのフレーム時間 (ms) */
  p95Ms: number;
  /** 33ms を超えたフレーム数（30fps 未満） */
  droppedFrames: number;
  /** ロングタスク（50ms 超）の合計時間 (ms) */
  longTaskMs: number;
}

export interface ZoomStepResult extends FrameStats {
  fromZoom: number;
  toZoom: number;
  /** setZoom 呼び出しから zoomend までの時間 (ms) */
  zoomEndMs: number;
  /** ズーム後に DOM 上にあるマーカー数（markercluster は画面内だけを載せる） */
  markerCount: number;
  /** ズーム後のマーカーペイン配下の要素数 */
  markerPaneElements: number;
}

export interface HighlightToggleResult {
  /** 対象にしたマーカー数 */
  markers: number;
  /** クラス付与＋強制レイアウトの同期時間 (ms) */
  applySyncMs: number;
  /** クラス付与から 2 フレーム後（描画完了の目安）までの時間 (ms) */
  applyPaintMs: number;
  /** クラス除去＋強制レイアウトの同期時間 (ms) */
  clearSyncMs: number;
  clearPaintMs: number;
}

export interface DomStats {
  /** マーカーペイン配下の要素数 */
  markerPaneElements: number;
  /** マーカー（.leaflet-marker-icon）の数 */
  markerCount: number;
  /** 1 マーカーあたりの平均要素数 */
  elementsPerMarker: number;
  /** ページ全体の要素数 */
  documentElements: number;
  /** JS ヒープ使用量 (MB)。Chrome 以外は null */
  jsHeapMb: number | null;
}

export interface BenchmarkReport {
  ranAt: string;
  userAgent: string;
  /** 計測時に有効だったマップ動作フラグ（lib/mapFeatureFlags.ts）。橋渡しが付与する */
  flags?: Record<string, string | boolean>;
  viewport: { width: number; height: number; dpr: number };
  dom: DomStats;
  zoomSteps: ZoomStepResult[];
  pan: FrameStats;
  highlight: HighlightToggleResult;
  idle: FrameStats;
}

export type BenchmarkProgress = (label: string) => void;

const DROPPED_FRAME_THRESHOLD_MS = 33;

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

/**
 * ロングタスクの合計時間を観測する。
 * longtask エントリは Chrome 系のみ。未対応ブラウザでは常に 0。
 */
function observeLongTasks(): { stop: () => number } {
  let total = 0;
  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) total += entry.duration;
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch {
    observer = null;
  }
  return {
    stop: () => {
      observer?.disconnect();
      return total;
    },
  };
}

/**
 * durationMs のあいだ rAF 間隔を記録して統計を返す。
 * `until` を渡すと、その Promise 解決後さらに tailMs だけ記録して終わる
 * （ズームアニメ終了後の再配置コストまで拾うため）。
 */
async function recordFrames(
  durationMs: number,
  until?: Promise<unknown>,
  tailMs = 300
): Promise<FrameStats> {
  const deltas: number[] = [];
  const longTasks = observeLongTasks();
  let last = await nextFrame();
  const start = last;
  let settledAt: number | null = null;
  if (until) {
    void until.then(() => {
      settledAt = performance.now();
    });
  }

  for (;;) {
    const now = await nextFrame();
    deltas.push(now - last);
    last = now;
    const elapsed = now - start;
    if (until) {
      if (settledAt !== null && now - settledAt >= tailMs) break;
      if (elapsed >= durationMs) break; // 安全弁
    } else if (elapsed >= durationMs) {
      break;
    }
  }

  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((a, b) => a + b, 0);
  return {
    frames: deltas.length,
    avgMs: deltas.length ? sum / deltas.length : 0,
    maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
    p95Ms: percentile(sorted, 0.95),
    droppedFrames: deltas.filter((d) => d > DROPPED_FRAME_THRESHOLD_MS).length,
    longTaskMs: longTasks.stop(),
  };
}

function waitForEvent(map: BenchMapLike, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      map.off(event, handler);
      resolve();
    }, timeoutMs);
    map.once(event, handler);
  });
}

export function collectDomStats(map: BenchMapLike): DomStats {
  const container = map.getContainer();
  // 店舗は専用ペイン（leaflet-shop-pane）に置かれるので、標準の markerPane と合わせて数える
  const panes = Array.from(
    container.querySelectorAll(".leaflet-marker-pane, .leaflet-shop-pane")
  );
  const markerPaneElements = panes.reduce((n, p) => n + p.querySelectorAll("*").length, 0);
  const markerCount = panes.reduce((n, p) => n + p.querySelectorAll(".leaflet-marker-icon").length, 0);
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return {
    markerPaneElements,
    markerCount,
    elementsPerMarker: markerCount ? markerPaneElements / markerCount : 0,
    documentElements: document.querySelectorAll("*").length,
    jsHeapMb: memory ? memory.usedJSHeapSize / (1024 * 1024) : null,
  };
}

export async function benchZoomStep(map: BenchMapLike, toZoom: number): Promise<ZoomStepResult> {
  const fromZoom = map.getZoom();
  // zoomend の後、markercluster が画面内のマーカーを差し替えるまで少し待ってから数える
  const t0 = performance.now();
  const zoomEnd = waitForEvent(map, "zoomend", 3000);
  map.setZoom(toZoom, { animate: true });
  const stats = await recordFrames(3000, zoomEnd);
  const zoomEndMs = (await zoomEnd.then(() => performance.now())) - t0;
  const dom = collectDomStats(map);
  return {
    ...stats,
    fromZoom,
    toZoom,
    zoomEndMs,
    markerCount: dom.markerCount,
    markerPaneElements: dom.markerPaneElements,
  };
}

export async function benchPan(map: BenchMapLike): Promise<FrameStats> {
  const moveEnd = waitForEvent(map, "moveend", 3000);
  map.panBy([240, 0], { animate: true, duration: 0.6 });
  const stats = await recordFrames(3000, moveEnd);
  // 元の位置に戻す（計測外）
  await wait(50);
  map.panBy([-240, 0], { animate: false });
  await nextFrame();
  return stats;
}

/**
 * 検索ヒット時の一斉ハイライトを模す。
 * 全マーカーに `shop-marker-search` を付け、強制レイアウトで同期コストを測る。
 * 描画完了の目安として 2 フレーム後までの時間も記録する。
 */
export async function benchHighlightToggle(map: BenchMapLike): Promise<HighlightToggleResult> {
  const container = map.getContainer();
  const markers = Array.from(container.querySelectorAll<HTMLElement>(".custom-shop-marker"));

  const toggle = async (add: boolean) => {
    const t0 = performance.now();
    for (const el of markers) {
      if (add) el.classList.add("shop-marker-search");
      else el.classList.remove("shop-marker-search");
    }
    // 強制レイアウト（スタイル再計算＋レイアウトを同期で走らせる）
    void container.offsetWidth;
    const syncMs = performance.now() - t0;
    await nextFrame();
    await nextFrame();
    const paintMs = performance.now() - t0;
    return { syncMs, paintMs };
  };

  const applied = await toggle(true);
  await wait(200);
  const cleared = await toggle(false);
  await wait(100);

  return {
    markers: markers.length,
    applySyncMs: applied.syncMs,
    applyPaintMs: applied.paintMs,
    clearSyncMs: cleared.syncMs,
    clearPaintMs: cleared.paintMs,
  };
}

/**
 * フルセットを順に実行する。
 * ズームは「最小→中間→最大→最小」で LOD（点・屋台・写真・木札）をすべて通る。
 */
export async function runFullBenchmark(
  map: BenchMapLike,
  onProgress?: BenchmarkProgress
): Promise<BenchmarkReport> {
  const minZoom = map.getMinZoom();
  const maxZoom = map.getMaxZoom();
  const startZoom = map.getZoom();

  onProgress?.("アイドル状態を計測中");
  const idle = await recordFrames(1000);

  onProgress?.("DOM を数えています");
  const dom = collectDomStats(map);

  const path = [
    minZoom,
    Math.round((minZoom + maxZoom) / 2),
    maxZoom,
    Math.round((minZoom + maxZoom) / 2),
    minZoom,
    startZoom,
  ];
  const zoomSteps: ZoomStepResult[] = [];
  for (const target of path) {
    if (target === map.getZoom()) continue;
    onProgress?.(`ズーム ${map.getZoom()} → ${target}`);
    zoomSteps.push(await benchZoomStep(map, target));
    await wait(250);
  }

  onProgress?.("パン中");
  const pan = await benchPan(map);

  onProgress?.("ハイライト一斉切替中");
  const highlight = await benchHighlightToggle(map);

  return {
    ranAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
    dom,
    zoomSteps,
    pan,
    highlight,
    idle,
  };
}
