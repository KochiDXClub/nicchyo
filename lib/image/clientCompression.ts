/**
 * クライアント側（ブラウザ）での画像リサイズ・WebP圧縮ユーティリティ
 *
 * 出店者がスマホ等で撮影した大容量写真（3MB〜10MB）をそのままアップロードせず、
 * ブラウザの Canvas を使って事前に「メイン用」と「サムネイル用」の WebP 画像に変換します。
 * これにより、通信量と Supabase Storage 容量を大幅に削減し、マップでの高速描画を可能にします。
 */

import type { ShopImageKind } from "@/lib/shopImages";
import { PANORAMA_THUMB_MAX_WIDTH, panoramaThumbGeometry } from "./panoramaThumb";

export type ResizeOptions = {
  /** 長辺の最大ピクセル数 */
  maxDimension: number;
  /** 画質 (0.0 〜 1.0) */
  quality: number;
  /** 出力 MIME タイプ（デフォルト: image/webp） */
  mimeType?: string;
};

export const STORE_IMAGE_CONFIG = {
  main: {
    maxDimension: 1200,
    quality: 0.82,
    mimeType: "image/webp",
  },
  // 全周写真。見渡すとき画面に映るのは全体の約4分の1なので、普通の写真より大きく残す（WebP で数百KB〜1MB台）
  panoramaMain: {
    maxDimension: 2400,
    quality: 0.82,
    mimeType: "image/webp",
  },
  // 全周写真から切り出すサムネイル（lib/image/panoramaThumb.ts）。バナーの上でも使うので、通常のサムネイルより大きい
  panoramaThumbnail: {
    maxDimension: PANORAMA_THUMB_MAX_WIDTH,
    quality: 0.82,
    mimeType: "image/webp",
  },
  // 地図の屋台にはめ込む写真・検索結果のカードで使う。
  // 屋台の写真枠は最大ズームで横 約 73px（高精細画面では ×3 で約 220px）。拡大して見ても粗くならないよう 400px
  thumbnail: {
    maxDimension: 400,
    quality: 0.8,
    mimeType: "image/webp",
  },
} as const;

export const POST_IMAGE_CONFIG = {
  maxDimension: 1200,
  quality: 0.82,
  mimeType: "image/webp",
} as const;

/**
 * 縦横比を維持しながら、長辺が maxDimension 以下になる幅と高さを計算する
 */
export function calculateFitDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxDimension <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * ブラウザが画像をデコードできなかったときのエラー。
 * Android Chrome で本物の HEIC を選んだときなど、形式そのものが読めない場合に投げる。
 * 通信エラーなどと見分けて、出店者に「別の写真を選び直す」よう伝えるために使う。
 */
export class ImageDecodeError extends Error {
  constructor() {
    super("画像の読み込みに失敗しました");
    this.name = "ImageDecodeError";
  }
}

export const IMAGE_DECODE_ERROR_MESSAGE =
  "この形式の写真は読み込めませんでした。JPEG か PNG の写真を選び直してください。";

/**
 * 画面に出すエラーメッセージを決める。デコード失敗なら選び直しを促し、それ以外は fallback を返す
 */
export function imageErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ImageDecodeError ? IMAGE_DECODE_ERROR_MESSAGE : fallback;
}

/**
 * File または Blob を読み込み、HTMLImageElement を生成する
 */
function loadImageElement(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageDecodeError());
    };
    img.src = url;
  });
}

/**
 * このブラウザで画像をデコードできるかを確かめる。写真を選んだ時点で呼び、送信前に知らせるために使う
 */
export async function canDecodeImage(source: Blob): Promise<boolean> {
  try {
    await loadImageElement(source);
    return true;
  } catch {
    return false;
  }
}

/**
 * 画像の幅と高さ（ピクセル）を読む。全周写真（2:1）の登録で、選んだ写真の比率を確かめるのに使う。
 * 読めなかったときは null
 */
export async function readImageSize(source: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const img = await loadImageElement(source);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

/**
 * 画像を Canvas でリサイズし、指定形式の Blob に変換する
 */
export async function resizeImageToBlob(
  source: Blob,
  options: ResizeOptions
): Promise<Blob> {
  const img = await loadImageElement(source);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  const { width, height } = calculateFitDimensions(
    naturalWidth,
    naturalHeight,
    options.maxDimension
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストの取得に失敗しました");
  }

  // 高品質な画像縮小処理のための補間設定
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  return canvasToBlob(canvas, options);
}

/**
 * Canvas を指定形式の Blob にする。指定の形式で書き出せなければ JPEG にする
 */
function canvasToBlob(canvas: HTMLCanvasElement, options: ResizeOptions): Promise<Blob> {
  const mimeType = options.mimeType ?? "image/webp";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // 指定した形式で書き出せたときだけそのまま使う。
        // WebP を書き出せないブラウザ（iPhone の Safari など）は null ではなく PNG を返す（仕様上の既定）。
        // 写真の PNG は 1200px でも 2MB を超え、地図の表示が重くなるので、JPEG で書き出し直す
        if (blob && blob.type === mimeType) {
          resolve(blob);
          return;
        }
        canvas.toBlob(
          (fallbackBlob) => {
            if (fallbackBlob) {
              resolve(fallbackBlob);
            } else if (blob) {
              // JPEG も書き出せないなら、重くても書き出せた形式で保存する
              resolve(blob);
            } else {
              reject(new Error("画像のBlob変換に失敗しました"));
            }
          },
          "image/jpeg",
          options.quality
        );
      },
      mimeType,
      options.quality
    );
  });
}

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * 変換後の Blob の実際の形式から、アップロード時の Content-Type と拡張子を決める。
 *
 * WebP を書き出せないブラウザでは、resizeImageToBlob が JPEG（上のフォールバック）を返す。
 * JPEG も書き出せない環境では PNG のこともある。
 * image/webp と決め打ちで保存すると、中身と Content-Type が食い違ってどのブラウザでも表示できなくなる。
 */
export function imageUploadInfo(blob: Blob): { contentType: string; ext: string } {
  const contentType = blob.type || "image/jpeg";
  return { contentType, ext: EXTENSIONS[contentType] ?? "jpg" };
}

/**
 * 全周写真の中央の高さを、左右の好きな位置で切り出して、バナー用のサムネイルにする。
 * @param center 切り出しの中心。写真の横幅に対する割合（0〜1）。端をまたいでもよい
 */
export async function createPanoramaThumbnail(source: Blob, center: number): Promise<Blob> {
  const img = await loadImageElement(source);
  const geometry = panoramaThumbGeometry(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    center
  );

  const canvas = document.createElement("canvas");
  canvas.width = geometry.outWidth;
  canvas.height = geometry.outHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストの取得に失敗しました");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const segment of geometry.segments) {
    ctx.drawImage(img, segment.sx, geometry.sy, segment.sw, geometry.sh, segment.dx, 0, segment.dw, geometry.outHeight);
  }

  return canvasToBlob(canvas, STORE_IMAGE_CONFIG.panoramaThumbnail);
}

/**
 * 登録済みの全周写真（メイン）を取り直して、サムネイルだけを切り直す。
 * 写真は保存済みのものを使うので、切り直しのために写真を選び直す必要はない
 */
export async function createPanoramaThumbnailFromUrl(url: string, center: number): Promise<Blob> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("登録済みの写真を読み込めませんでした");
  return createPanoramaThumbnail(await response.blob(), center);
}

/**
 * 店舗画像 1 ファイルから「メイン用」と「サムネイル用」の 2 つの WebP Blob を生成する
 * （WebP を書き出せないブラウザでは JPEG）。
 * 全周写真は、メインを大きめ（長辺2400px）に残し、サムネイルは中央の高さを thumbCenter の位置で切り出す
 */
export async function createStoreImages(
  file: File,
  options: { kind?: ShopImageKind; thumbCenter?: number } = {}
): Promise<{
  mainBlob: Blob;
  thumbBlob: Blob;
}> {
  const panorama = options.kind === "panorama";
  // 並行してメイン画像とサムネイル画像をリサイズ・圧縮
  const [mainBlob, thumbBlob] = await Promise.all([
    resizeImageToBlob(file, panorama ? STORE_IMAGE_CONFIG.panoramaMain : STORE_IMAGE_CONFIG.main),
    panorama
      ? createPanoramaThumbnail(file, options.thumbCenter ?? 0.5)
      : resizeImageToBlob(file, STORE_IMAGE_CONFIG.thumbnail),
  ]);

  return { mainBlob, thumbBlob };
}

/**
  * 近況投稿（ポスト）用画像 1 ファイルを WebP Blob にリサイズ・圧縮する
  */
export async function createPostImage(file: File): Promise<Blob> {
  return resizeImageToBlob(file, POST_IMAGE_CONFIG);
}
