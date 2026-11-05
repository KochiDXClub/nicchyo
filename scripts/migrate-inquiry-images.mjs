/** 既定はdry-run。適用手順は docs/security/2026-11-04-review.md を参照。 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const SOURCE = 'vendor-images';
const TARGET = 'vendor-inquiry-images';
const PREFIX = 'inquiry-image:';
const PUBLIC_PATH = `/storage/v1/object/public/${SOURCE}/`;
const PATH = /^[0-9a-f-]{36}\/inquiries\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/i;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const check = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };

export async function migrateInquiryImages(db, { apply = false, includeUnreferenced = false } = {}) {
  if (check(await db.storage.getBucket(TARGET)).public !== false) throw new Error('Destination bucket must be private');
  const source = db.storage.from(SOURCE);
  const target = db.storage.from(TARGET);
  const list = async (folder) => {
    const files = [];
    for (let offset = 0; ;) {
      const batch = check(await source.list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }));
      if (!batch.length) return files;
      files.push(...batch); offset += batch.length;
    }
  };
  const paths = [];
  for (const folder of await list('')) {
    if (!/^[0-9a-f-]{36}$/i.test(folder.name)) continue;
    for (const file of await list(`${folder.name}/inquiries`)) {
      if (!file.id) throw new Error('Nested legacy folder found; inspect before migration');
      const path = `${folder.name}/inquiries/${file.name}`;
      if (!PATH.test(path)) throw new Error('Unexpected legacy filename; inspect before migration');
      paths.push(path);
    }
  }
  // 全DB参照を先に突合する。特定ホストのLIKEだけで探すと、別表記の参照を孤立ファイルと誤認する。
  const references = async () => {
    const rows = [];
    for (let offset = 0; ;) {
      const batch = check(await db.from('vendor_inquiries').select('id, vendor_id, image_url')
        .not('image_url', 'is', null).order('id').range(offset, offset + 99));
      if (!batch.length) return rows;
      rows.push(...batch); offset += batch.length;
    }
  };
  const classify = (row) => {
    if (typeof row.image_url !== "string") return null;
    if (row.image_url.startsWith(PREFIX)) {
      const path = row.image_url.slice(PREFIX.length);
      return PATH.test(path) && path.split('/')[0] === row.vendor_id ? { path, private: true } : null;
    }
    try {
      const url = new URL(row.image_url);
      if (url.protocol !== 'https:' || !url.pathname.startsWith(PUBLIC_PATH)) return null;
      const path = decodeURIComponent(url.pathname.slice(PUBLIC_PATH.length));
      if (!PATH.test(path) || path.split('/')[0] !== row.vendor_id) return null;
      const expectedOrigin = new URL(source.getPublicUrl(path).data.publicUrl).origin;
      return { path, private: false, foreign: url.origin !== expectedOrigin };
    } catch { return null; }
  };
  const rows = await references();
  const entries = rows.map(row => ({ row, ref: classify(row) }));
  const pathSet = new Set(paths);
  const unreferenced = paths.filter(path => !entries.some(e => e.ref?.path === path));
  const summary = {
    mode: apply ? 'apply' : 'dry-run', files: paths.length,
    referencedRows: entries.filter(e => e.ref && !e.ref.private).length,
    referencedFiles: new Set(entries.filter(e => e.ref && !e.ref.private && pathSet.has(e.ref.path)).map(e => e.ref.path)).size,
    unreferencedFiles: unreferenced.length,
    foreignOriginReferences: entries.filter(e => e.ref?.foreign).length,
    unresolvedReferences: entries.filter(e => !e.ref || (!e.ref.private && !pathSet.has(e.ref.path))).length,
    migratedFiles: 0, skippedUnreferenced: 0,
  };
  if (!apply) return summary;
  if (summary.foreignOriginReferences || summary.unresolvedReferences) throw new Error('Unresolved DB references; inspect dry-run results before applying');
  for (const path of paths) {
    if (unreferenced.includes(path) && !includeUnreferenced) { summary.skippedUnreferenced++; continue; }
    const original = check(await source.download(path));
    const bytes = Buffer.from(await original.arrayBuffer());
    check(await target.upload(path, bytes, { contentType: original.type, upsert: true, cacheControl: '0' }));
    const copied = check(await target.download(path));
    if (digest(bytes) !== digest(Buffer.from(await copied.arrayBuffer()))) throw new Error('Copy verification failed');
    for (const { row, ref } of entries) {
      if (!ref || ref.private || ref.path !== path) continue;
      const updated = check(await db.from('vendor_inquiries').update({ image_url: PREFIX + path })
        .eq('id', row.id).eq('image_url', row.image_url).select('id'));
      if (updated.length !== 1) throw new Error('Inquiry changed during migration; retry before deleting source');
    }
    // コピー後にも全参照を確認。ホスト表記違い・同時更新の取り残しがあれば公開側を残す。
    const leftovers = (await references()).map(classify);
    if (leftovers.some(ref => !ref || (!ref.private && ref.path === path))) throw new Error('Unmigrated reference remains; not deleting source');
    check(await source.remove([path]));
    summary.migratedFiles++;
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are required');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(JSON.stringify(await migrateInquiryImages(db, {
    apply: process.argv.includes('--apply'), includeUnreferenced: process.argv.includes('--include-unreferenced'),
  })));
}
