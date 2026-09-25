/**
 * クライアント側（ブラウザ）での画像リサイズ・WebP圧縮ユーティリティ
 *
 * 出店者がスマホ等で撮影した大容量写真（3MB〜10MB）をそのままアップロードせず、
 * ブラウザの Canvas を使って事前に「メイン用」と「サムネイル用」の WebP 画像に変換します。
 * これにより、通信量と Supabase Storage 容量を大幅に削減し、マップでの高速描画を可能にします。
 */

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
  thumbnail: {
    maxDimension: 160,
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

  const mimeType = options.mimeType ?? "image/webp";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        // WebP がサポートされていない環境の場合は JPEG にフォールバック
        canvas.toBlob(
          (fallbackBlob) => {
            if (fallbackBlob) {
              resolve(fallbackBlob);
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
 * WebP を書き出せないブラウザでは、toBlob が JPEG（上のフォールバック）や
 * PNG（未対応の形式を指定したときの仕様上の既定）を返す。
 * image/webp と決め打ちで保存すると、中身と Content-Type が食い違ってどのブラウザでも表示できなくなる。
 */
export function imageUploadInfo(blob: Blob): { contentType: string; ext: string } {
  const contentType = blob.type || "image/jpeg";
  return { contentType, ext: EXTENSIONS[contentType] ?? "jpg" };
}

/**
 * 店舗画像 1 ファイルから「メイン用」と「サムネイル用」の 2 つの WebP Blob を生成する
 */
export async function createStoreImages(file: File): Promise<{
  mainBlob: Blob;
  thumbBlob: Blob;
}> {
  // 並行してメイン画像とサムネイル画像をリサイズ・圧縮
  const [mainBlob, thumbBlob] = await Promise.all([
    resizeImageToBlob(file, STORE_IMAGE_CONFIG.main),
    resizeImageToBlob(file, STORE_IMAGE_CONFIG.thumbnail),
  ]);

  return { mainBlob, thumbBlob };
}

/**
  * 近況投稿（ポスト）用画像 1 ファイルを WebP Blob にリサイズ・圧縮する
  */
export async function createPostImage(file: File): Promise<Blob> {
  return resizeImageToBlob(file, POST_IMAGE_CONFIG);
}
