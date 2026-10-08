import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BASE_DIR = process.cwd();
const ENV_PATH = path.resolve(BASE_DIR, '.env.local');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["'](.*)["']$/, '$1');
      env[key] = val;
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const BUCKET_NAME = 'vendor-images';
const isDryRun = process.argv.includes('--dry-run');

console.log(`[migrate-vendor-images] Mode: ${isDryRun ? 'DRY-RUN (変更なし)' : 'LIVE (実際に更新・削除)'}`);

async function main() {
  // 1. vendors テーブルから画像URLが設定されているレコードを取得
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('id, shop_name, shop_image_url')
    .not('shop_image_url', 'is', null);

  if (error) {
    console.error('Error fetching vendors:', error);
    process.exit(1);
  }

  console.log(`[migrate-vendor-images] 対象店舗数: ${vendors.length} 件`);

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let totalBytesSaved = 0;

  for (const vendor of vendors) {
    const vendorId = vendor.id;
    const currentUrl = vendor.shop_image_url;
    console.log(`\n--- 店舗: ${vendor.shop_name} (${vendorId}) ---`);
    console.log(`  現在のURL: ${currentUrl}`);

    try {
      // Storage 内の vendor フォルダ内のファイルを一覧取得
      const { data: files, error: listErr } = await supabase.storage
        .from(BUCKET_NAME)
        .list(vendorId);

      if (listErr) {
        console.warn(`  Storage list エラー: ${listErr.message}`);
      }

      const fileNames = files ? files.map((f) => f.name) : [];
      console.log(`  Storage内のファイル:`, fileNames);

      const hasMainWebp = fileNames.includes('store-main.webp');
      const hasThumbWebp = fileNames.includes('store-thumb.webp');

      // 既に store-main.webp と store-thumb.webp の両方があり、URLも store-main.webp になっている場合はスキップ
      if (hasMainWebp && hasThumbWebp && currentUrl.includes('store-main.webp')) {
        console.log(`  -> 既に WebP メイン・サムネイル両方が存在するためスキップします。`);
        skippedCount++;
        continue;
      }

      // 元画像のダウンロード
      console.log(`  元画像をダウンロード中...`);
      const response = await fetch(currentUrl);
      if (!response.ok) {
        throw new Error(`画像のダウンロードに失敗しました (status: ${response.status})`);
      }

      const originalBuffer = Buffer.from(await response.arrayBuffer());
      const originalSize = originalBuffer.length;
      console.log(`  元画像サイズ: ${(originalSize / 1024).toFixed(1)} KB`);

      // sharp でリサイズ & WebP 変換
      // メイン画像: 長辺 1200px, quality 82
      const mainBuffer = await sharp(originalBuffer)
        .rotate() // Exif の向き情報を反映
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      // サムネイル画像: 長辺 160px, quality 80
      const thumbBuffer = await sharp(originalBuffer)
        .rotate()
        .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      console.log(`  変換後: メイン ${(mainBuffer.length / 1024).toFixed(1)} KB, サムネイル ${(thumbBuffer.length / 1024).toFixed(1)} KB`);

      const mainPath = `${vendorId}/store-main.webp`;
      const thumbPath = `${vendorId}/store-thumb.webp`;

      // 不要になった元画像ファイルの特定（旧店舗写真のみ対象。投稿画像などは絶対に削除しない）
      const oldUrlFileName = currentUrl.split('/').pop()?.split('?')[0];
      const filesToDelete = fileNames
        .filter((name) => {
          if (name === 'store-main.webp' || name === 'store-thumb.webp') return false;
          const isOldStoreMain = name.startsWith('store-main.') && !name.endsWith('.webp');
          const isOldUrlTarget = oldUrlFileName && name === oldUrlFileName;
          return isOldStoreMain || isOldUrlTarget;
        })
        .map((name) => `${vendorId}/${name}`);

      if (isDryRun) {
        console.log(`  [DRY-RUN] アップロード予定: ${mainPath}, ${thumbPath}`);
        if (filesToDelete.length > 0) {
          console.log(`  [DRY-RUN] 削除予定の旧ファイル:`, filesToDelete);
        } else {
          console.log(`  [DRY-RUN] 削除対象の旧ファイルなし`);
        }
      } else {
        // アップロード
        const [mainUp, thumbUp] = await Promise.all([
          supabase.storage
            .from(BUCKET_NAME)
            .upload(mainPath, mainBuffer, { contentType: 'image/webp', upsert: true }),
          supabase.storage
            .from(BUCKET_NAME)
            .upload(thumbPath, thumbBuffer, { contentType: 'image/webp', upsert: true }),
        ]);

        if (mainUp.error) throw new Error(`メイン画像アップロード失敗: ${mainUp.error.message}`);
        if (thumbUp.error) throw new Error(`サムネイルアップロード失敗: ${thumbUp.error.message}`);

        // 新しい Public URL の取得
        const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(mainPath);
        const newMainUrl = pubData.publicUrl;

        // DB 更新
        const { error: dbErr } = await supabase
          .from('vendors')
          .update({
            shop_image_url: newMainUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendorId);

        if (dbErr) throw new Error(`DB更新失敗: ${dbErr.message}`);
        console.log(`  -> DB の shop_image_url を更新しました: ${newMainUrl}`);

        if (filesToDelete.length > 0) {
          console.log(`  不要な旧ファイルを削除中:`, filesToDelete);
          const { error: delErr } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(filesToDelete);

          if (delErr) {
            console.warn(`  旧ファイル削除警告: ${delErr.message}`);
          } else {
            console.log(`  -> 旧ファイルを削除しました。`);
          }
        }
      }

      processedCount++;
      const saved = originalSize - (mainBuffer.length + thumbBuffer.length);
      if (saved > 0) totalBytesSaved += saved;

    } catch (err) {
      console.error(`  エラー発生 (${vendor.shop_name}):`, err.message);
      errorCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`[migrate-vendor-images] 処理完了`);
  console.log(`  処理件数: ${processedCount}`);
  console.log(`  スキップ: ${skippedCount}`);
  console.log(`  エラー: ${errorCount}`);
  console.log(`  削減された容量（概算）: ${(totalBytesSaved / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`========================================`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
