/**
 * 店舗表示設定の中央管理ファイル
 *
 * 【目的】
 * - 店舗イラストのサイズ、間隔、表示ルールを一元管理
 * - 将来のイラスト差し替え・サイズ変更に対応
 * - 表示の公平性を保証する
 *
 * 【設計方針】
 * 1. ハードコード禁止: すべての値をこの設定から取得
 * 2. レスポンシブ対応: 画面サイズ・ズーム倍率の変化に追従
 * 3. 公平性の保証: 特定店舗だけが優遇されない仕組み
 * 4. 拡張性: 新しいイラストタイプの追加が容易
 */

/**
 * 店舗イラストのサイズ定義
 * 【重要】イラストを差し替える場合はここを変更
 */
export interface IllustrationSize {
  /** SVG/画像の幅（px） */
  width: number;
  /** SVG/画像の高さ（px） */
  height: number;
  /** Leafletマーカーのアンカーポイント [x, y] （イラストの基準点） */
  anchor: [number, number];
}

/**
 * イラストサイズのプリセット
 *
 * 【スマホUX最適化】イラストサイズを拡大して視認性・タップ性を向上
 * - small: 35px → 45px（視認性向上、指でタップしやすい）
 * - medium: 50px → 60px（詳細が見やすい、快適なサイズ）
 * - filterIntervalで表示店舗数を減らし、適切な間隔を確保
 */
export const ILLUSTRATION_SIZES: Record<
  'small' | 'medium' | 'large',
  IllustrationSize
> = {
  small: {
    width: 45,    // 【スマホUX】35→45px（視認性・タップ性向上）
    height: 45,
    anchor: [22, 38], // 下部中央（サイズに合わせて調整）
  },
  medium: {
    width: 60,    // 【スマホUX】50→60px（詳細が見やすい）
    height: 60,
    anchor: [30, 50], // 下部中央（サイズに合わせて調整）
  },
  large: {
    width: 80,
    height: 80,
    anchor: [40, 70], // 下部中央
  },
};

/**
 * デフォルトで使用するイラストサイズ
 * 【将来の変更】ここを変えるだけで全体のサイズが変わる
 * 実運用では shop.illustration.size が DB から供給されないため、
 * 全店舗がこの値（medium = 60px）で描画される。
 */
export const DEFAULT_ILLUSTRATION_SIZE: 'small' | 'medium' | 'large' =
  'medium';

/**
 * ズームレベルごとの表示ルール
 */
export interface ZoomDisplayRule {
  /** このルールが適用される最小ズームレベル */
  minZoom: number;
  /** 店舗フィルタリング間隔（例: 3なら3店舗に1つ表示） */
  filterInterval: number;
  /** 店舗詳細（バナー）の表示を許可するか */
  allowShopDetails: boolean;
  /** 店舗情報（名前・吹き出し）の表示を許可するか */
  allowShopInfo: boolean;
  /** 説明テキスト */
  description: string;
}

/**
 * ズーム段階別の表示ルール（2段階表示）
 *
 * 【2段階表示】
 * - 拡大時: 全店舗表示（filterInterval = 1）
 * - 縮小時: 丁目別フィルタリング（filterInterval = 0）
 */
export const ZOOM_DISPLAY_RULES: ZoomDisplayRule[] = [
  {
    minZoom: 19.5,
    filterInterval: 1, // 拡大時: 全店舗表示（300店舗）
    allowShopDetails: true,
    allowShopInfo: true,
    description: '拡大時 - 全店舗',
  },
  {
    minZoom: 0,
    filterInterval: 0, // 縮小時: 丁目別フィルタリング（14店舗）
    allowShopDetails: false,
    allowShopInfo: true,
    description: '縮小時 - 丁目別代表店舗',
  },
];

/**
 * 店舗間隔の設定
 *
 * 【動的計算】
 * - 店舗数、道路の長さ、イラストサイズから自動計算
 * - 固定値は使わない
 */
export interface SpacingConfig {
  /** 店舗間の最小ピクセル間隔（ズーム18基準） */
  minPixelsPerShop: number;
  /** 道路幅のオフセット係数（道路の長さに対する比率） */
  roadWidthOffsetRatio: number;
}

export const SPACING_CONFIG: SpacingConfig = {
  // 店舗イラストが重ならないための最小間隔
  // イラストサイズ + 余白 を考慮
  minPixelsPerShop: 80,

  // 道路幅のオフセット（道路の中心線からの距離）
  // 【スマホUX改善】道幅を狭くして店舗を主役に
  // - 従来: 1.3km の道路に対して 50m ≈ 0.038 (3.8%)
  // - 改善後: 1.3km の道路に対して 33m ≈ 0.025 (2.5%)
  roadWidthOffsetRatio: 0.025,
};

/**
 * 現在のズームレベルに適用される表示ルールを取得
 *
 * @param currentZoom 現在のズームレベル
 * @returns 適用される表示ルール
 */
export function getDisplayRuleForZoom(
  currentZoom: number
): ZoomDisplayRule {
  // ズームレベルが高い順（詳細表示優先）でルールを検索
  for (let i = 0; i < ZOOM_DISPLAY_RULES.length; i++) {
    if (currentZoom >= ZOOM_DISPLAY_RULES[i].minZoom) {
      return ZOOM_DISPLAY_RULES[i];
    }
  }

  // フォールバック（最も広域なルール）
  return ZOOM_DISPLAY_RULES[ZOOM_DISPLAY_RULES.length - 1];
}

/**
 * 店舗詳細（バナー）を開くことができるかチェック
 *
 * @param currentZoom 現在のズームレベル
 * @returns 開くことができる場合 true
 */
export function canOpenShopDetails(currentZoom: number): boolean {
  const rule = getDisplayRuleForZoom(currentZoom);
  return rule.allowShopDetails;
}

/**
 * 店舗情報（名前・吹き出し）を表示できるかチェック
 *
 * @param currentZoom 現在のズームレベル
 * @returns 表示できる場合 true
 */
export function canShowShopInfo(currentZoom: number): boolean {
  const rule = getDisplayRuleForZoom(currentZoom);
  return rule.allowShopInfo;
}

/**
 * 最小ズームレベルで店舗詳細を開けるレベルを取得
 */
export function getMinZoomForShopDetails(): number {
  const detailRule = ZOOM_DISPLAY_RULES.find((rule) => rule.allowShopDetails);
  return detailRule?.minZoom ?? 17.0;
}

/**
 * レスポンシブスペーシング設定
 *
 * 【目的】
 * - デバイスサイズに応じた最適な店舗間隔を提供
 * - モバイル、タブレット、デスクトップで異なる密度を設定
 *
 * 【将来の拡張】
 * - Phase 3のクラスタリング実装で使用
 * - 店舗間隔の動的調整に活用
 */
export interface ResponsiveSpacingConfig {
  /** モバイル画面での最小ピクセル間隔（画面幅 < 768px） */
  mobile: number;
  /** タブレット画面での最小ピクセル間隔（画面幅 768-1023px） */
  tablet: number;
  /** デスクトップ画面での最小ピクセル間隔（画面幅 >= 1024px） */
  desktop: number;
}

export const RESPONSIVE_SPACING: ResponsiveSpacingConfig = {
  mobile: 60,   // モバイルは密集を避けるため広めに
  tablet: 80,   // タブレットは中間
  desktop: 100, // デスクトップは広く
};

/**
 * 画面サイズとズームレベルに応じた最適な店舗間隔を取得
 *
 * 【計算ロジック】
 * 1. 画面幅に応じたベース間隔を決定
 * 2. ズームレベルに応じた補正係数を適用
 *    - ズーム17を基準（係数1.0）
 *    - 1ズーム上がるごとに2倍、下がるごとに0.5倍
 *
 * @param screenWidth 画面幅（px）
 * @param currentZoom 現在のズームレベル
 * @returns 最適な店舗間ピクセル間隔
 */
export function getOptimalSpacing(
  screenWidth: number,
  currentZoom: number
): number {
  // 画面サイズに応じたベース間隔
  let baseSpacing: number;
  if (screenWidth < 768) {
    baseSpacing = RESPONSIVE_SPACING.mobile;
  } else if (screenWidth < 1024) {
    baseSpacing = RESPONSIVE_SPACING.tablet;
  } else {
    baseSpacing = RESPONSIVE_SPACING.desktop;
  }

  // ズームレベルに応じた補正
  // ズーム17を基準（係数1.0）として、1ズーム上がるごとに2倍、下がるごとに0.5倍
  const zoomFactor = Math.pow(2, currentZoom - 17);

  return baseSpacing * zoomFactor;
}

/**
 * マップの表示モード（2段階表示）
 * シンプルで直感的な拡大・縮小操作を実現
 */
export enum ViewMode {
  /** 縮小時: 各丁目から2店舗（左右1つずつ）、計14店舗表示 */
  OVERVIEW = 'OVERVIEW',

  /** 拡大時: 全300店舗を表示 */
  DETAIL = 'DETAIL',
}

/**
 * 表示モード定義
 *
 * 【Phase 3.5】スマホファースト対応
 * - mobileFilterInterval: スマホ専用の間引き間隔（画面が小さいため、より積極的に間引く）
 */
export interface ViewModeConfig {
  mode: ViewMode;
  minZoom: number;
  filterInterval: number;          // デスクトップ/タブレット用の間引き間隔
  mobileFilterInterval?: number;   // スマホ専用の間引き間隔（未指定時は filterInterval を使用）
  allowShopDetails: boolean;       // 詳細バナー表示を許可
  allowMarkerInteraction: boolean; // マーカークリックを許可
  description: string;
}

/**
 * 表示モード設定（2段階表示）
 *
 * 【シンプルな2段階表示】
 *
 * ┌─────────────────────────────────────┐
 * │ OVERVIEW（16.0-19.5未満）          │
 * │ 役割：縮小時、全体俯瞰              │
 * │ 体験：「日曜市の7丁目を把握」       │
 * │ 表示：14店舗（各丁目から左右1つずつ）│
 * │ イラスト：縮小表示                  │
 * │ タップ：その丁目にズームイン        │
 * └─────────────────────────────────────┘
 * ┌─────────────────────────────────────┐
 * │ DETAIL（19.5以上）                 │
 * │ 役割：拡大時、詳細閲覧              │
 * │ 体験：「全店舗を見渡せる」          │
 * │ 表示：300店舗すべて                 │
 * │ イラスト：拡大表示                  │
 * │ タップ：店舗詳細を表示              │
 * └─────────────────────────────────────┘
 *
 * 【設計原則】
 * - 2段階のシンプルな切り替え
 * - 縮小時は丁目別に代表店舗を表示（論理的な7分割）
 * - 拡大時は全店舗を表示
 * - デフォルトズーム18.0：中間帯、19.5で全店舗表示へ
 */
export const VIEW_MODE_CONFIGS: ViewModeConfig[] = [
  {
    mode: ViewMode.DETAIL,
    minZoom: 19.5,  // 【2段階表示】19.5で詳細表示へ
    filterInterval: 1,  // 全店舗表示（300店舗すべて）
    mobileFilterInterval: 1,  // 全店舗表示
    allowShopDetails: true,
    allowMarkerInteraction: true,
    description: '拡大時 - 全300店舗を表示',
  },
  {
    mode: ViewMode.OVERVIEW,
    minZoom: 16.0,  // 【2段階表示】縮小時
    filterInterval: 0,  // 【特殊】丁目別フィルタリング（後述）
    mobileFilterInterval: 0,  // 【特殊】丁目別フィルタリング（後述）
    allowShopDetails: false,
    allowMarkerInteraction: true,
    description: '縮小時 - 各丁目から2店舗（計14店舗）',
  },
];

/**
 * ズームレベルから表示モードを取得
 */
export function getViewModeForZoom(currentZoom: number): ViewModeConfig {
  for (const config of VIEW_MODE_CONFIGS) {
    if (currentZoom >= config.minZoom) {
      return config;
    }
  }
  return VIEW_MODE_CONFIGS[VIEW_MODE_CONFIGS.length - 1];
}

/**
 * デバイスに応じた適切な filterInterval を取得
 *
 * 【Phase 3.5】スマホファースト対応
 * - スマホ: mobileFilterInterval を優先使用
 * - デスクトップ/タブレット: filterInterval を使用
 *
 * @param config 表示モード設定
 * @param isMobile スマホかどうか
 * @returns 適切な filterInterval
 */
export function getFilterIntervalForDevice(
  config: ViewModeConfig,
  isMobile: boolean
): number {
  if (isMobile && config.mobileFilterInterval !== undefined) {
    return config.mobileFilterInterval;
  }
  return config.filterInterval;
}

/**
 * 詳細バナーを表示できるかチェック
 */
export function canShowShopDetailBanner(currentZoom: number): boolean {
  const viewMode = getViewModeForZoom(currentZoom);
  return viewMode.allowShopDetails;
}

/**
 * 詳細表示可能な最小ズームレベルを取得
 */
export function getMinZoomForDetailMode(): number {
  const detailMode = VIEW_MODE_CONFIGS.find(
    (config) => config.mode === ViewMode.DETAIL
  );
  return detailMode?.minZoom ?? 17.0;
}

/**
 * 丁目エリアマーカーを表示するズーム帯（OVERVIEW ゾーン）
 *
 * 「このへん、なにがある？」ボタンの出現帯としても使用する
 * （丁目が見える倍率＝周辺を俯瞰している状態、という判断）
 */
export const OVERVIEW_ZONE_MIN_ZOOM = 17;
export const OVERVIEW_ZONE_MAX_ZOOM = 19;
