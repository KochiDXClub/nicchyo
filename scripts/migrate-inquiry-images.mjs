/** 既定はdry-run。実環境への適用は docs/security/2026-11-04-review.md の手順を参照。 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const SOURCE = 'vendor-images';
const TARGET = 'vendor-inquiry-images';
const PREFIX = 'inquiry-image:';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const check = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };

export async function migrateInquiryImages(db, { apply = false } = {}) {
  const bucket = check(await db.storage.getBucket(TARGET));
  if (bucket.public !== false) throw new Error('Destination bucket must be private');
  const source = db.storage.from(SOURCE);
  const target = db.storage.from(TARGET);
  let processed = 0;
  const list = async (folder) => {
    const files = [];
    for (let offset = 0; ; offset += 100) {
      const batch = check(await source.list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }));
      files.push(...batch);
      if (batch.length < 100) return files;
    }
  };
  // 先に一覧を固定する。削除しながらoffsetを進めるとファイルを取り落とす。
  const paths = [];
  for (const folder of await list('')) {
    if (!/^[0-9a-f-]{36}$/i.test(folder.name)) continue;
    for (const file of await list(`${folder.name}/inquiries`)) {
      if (!file.id) continue;
      const path = `${folder.name}/inquiries/${file.name}`;
      if (!/^[0-9a-f-]{36}\/inquiries\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/i.test(path)) {
        throw new Error('Unexpected legacy filename; inspect manually before continuing');
      }
      paths.push(path);
    }
  }
  for (const path of paths) {
    if (!apply) { processed++; continue; }
    const original = check(await source.download(path));
    const bytes = Buffer.from(await original.arrayBuffer());
    check(await target.upload(path, bytes, { contentType: original.type, upsert: true, cacheControl: '0' }));
    const copied = check(await target.download(path));
    if (digest(bytes) !== digest(Buffer.from(await copied.arrayBuffer()))) throw new Error('Copy verification failed');
    const oldUrl = source.getPublicUrl(path).data.publicUrl;
    // 完全一致だけを更新する。他ホスト・別店舗の参照を変換しない。
    const references = [];
    for (let offset = 0; ;) {
      const batch = check(await db.from('vendor_inquiries').select('id, image_url')
        .like('image_url', oldUrl + '%').order('id').range(offset, offset + 99));
      if (!batch.length) break;
      references.push(...batch);
      offset += batch.length;
    }
    for (const row of references) {
      if (row.image_url.split(/[?#]/)[0] !== oldUrl) continue;
      const updated = check(await db.from('vendor_inquiries').update({ image_url: PREFIX + path })
        .eq('id', row.id).eq('image_url', row.image_url).select('id'));
      if (updated.length !== 1) throw new Error('Inquiry changed during migration; retry before deleting source');
    }
    // DB更新失敗時はここに進まない。コピー済みで削除前に失敗しても再実行可能。
    check(await source.remove([path]));
    processed++;
  }
  return { mode: apply ? 'apply' : 'dry-run', files: processed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are required');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(JSON.stringify(await migrateInquiryImages(db, { apply: process.argv.includes('--apply') })));
}
