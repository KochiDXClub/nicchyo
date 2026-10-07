// AI Office 中継サーバー（依存は three の配信のみ）。
//   POST /events   フックからのイベント受信（Bearer トークン必須）
//   GET  /stream   SSE でリアルタイム配信（スマホ・プロキシ越しでも動く）
//   GET  /state    現在のスナップショット
//   GET  /         3D ビューア
//
// 環境変数:
//   PORT                     待受ポート（既定 8787）
//   AI_OFFICE_TOKEN          イベント送信用トークン（必須）
//   AI_OFFICE_VIEW_KEY       設定すると /stream /state に ?key= が必要になる（閲覧制限）
//   AI_OFFICE_ALLOW_NO_TOKEN=1  トークン無しで起動（ローカル試用のみ）
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStore, normalizeEvent } from './lib/state.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 32 * 1024;
const SWEEP_MS = 30 * 1000;
const HEARTBEAT_MS = 15 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

// URL プレフィックス -> 配信ルート。この外のファイルは配信しない。
const STATIC_ROUTES = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/')],
  ['/shared/', path.join(ROOT, 'lib/')],
  ['/web/', path.join(ROOT, 'web/')],
];
const STATIC_ALLOW = {
  '/vendor/three/': /^(build\/three\.module\.js|examples\/jsm\/.+\.js)$/,
  '/shared/': /^state\.mjs$/,
  '/web/': /^[\w.-]+$/,
};

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createOfficeServer({ token, viewKey, store = createStore() } = {}) {
  const clients = new Set();

  function broadcast(name, data) {
    const frame = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(frame);
  }

  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  async function serveStatic(res, pathname) {
    for (const [prefix, dir] of STATIC_ROUTES) {
      if (!pathname.startsWith(prefix)) continue;
      const rel = pathname.slice(prefix.length);
      if (!STATIC_ALLOW[prefix].test(rel) || rel.includes('..')) break;
      try {
        const body = await readFile(path.join(dir, rel));
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(rel)] ?? 'application/octet-stream',
          'Cache-Control': prefix === '/web/' || prefix === '/shared/' ? 'no-cache' : 'public, max-age=86400',
        });
        res.end(body);
        return true;
      } catch {
        break;
      }
    }
    return false;
  }

  const viewAllowed = (url) => !viewKey || safeEqual(url.searchParams.get('key') ?? '', viewKey);

  async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;

    if (req.method === 'POST' && pathname === '/events') {
      const auth = req.headers.authorization ?? '';
      const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (token && !safeEqual(given, token)) return json(res, 401, { error: 'unauthorized' });
      let raw;
      try {
        raw = JSON.parse(await readBody(req));
      } catch (error) {
        return json(res, error.status ?? 400, { error: 'bad request' });
      }
      const evt = normalizeEvent(raw);
      if (!evt) return json(res, 400, { error: 'invalid event' });
      const { session, event, removed } = store.apply(evt);
      broadcast('update', { session, event });
      if (removed) setTimeout(() => broadcast('remove', { id: session.id }), 4000);
      return json(res, 200, { ok: true });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });

    if (pathname === '/healthz') return json(res, 200, { ok: true });

    if (pathname === '/state') {
      if (!viewAllowed(url)) return json(res, 401, { error: 'unauthorized' });
      return json(res, 200, store.snapshot());
    }

    if (pathname === '/stream') {
      if (!viewAllowed(url)) return json(res, 401, { error: 'unauthorized' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`retry: 3000\nevent: snapshot\ndata: ${JSON.stringify(store.snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return undefined;
    }

    if (pathname === '/' || pathname === '/index.html') {
      const body = await readFile(path.join(ROOT, 'web/index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      return res.end(body);
    }

    if (await serveStatic(res, pathname)) return undefined;
    return json(res, 404, { error: 'not found' });
  }

  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      console.error('[ai-office] handler error', error);
      if (!res.headersSent) json(res, 500, { error: 'internal error' });
      else res.end();
    });
  });

  const sweepTimer = setInterval(() => {
    const { changed, removed } = store.sweep();
    for (const session of changed) broadcast('update', { session, event: null });
    for (const id of removed) broadcast('remove', { id });
  }, SWEEP_MS);
  const heartbeatTimer = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, HEARTBEAT_MS);
  sweepTimer.unref();
  heartbeatTimer.unref();
  server.on('close', () => {
    clearInterval(sweepTimer);
    clearInterval(heartbeatTimer);
    for (const res of clients) res.end();
  });

  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const token = process.env.AI_OFFICE_TOKEN;
  if (!token && process.env.AI_OFFICE_ALLOW_NO_TOKEN !== '1') {
    console.error('AI_OFFICE_TOKEN を設定してください（ローカル試用なら AI_OFFICE_ALLOW_NO_TOKEN=1）。');
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 8787;
  createOfficeServer({ token, viewKey: process.env.AI_OFFICE_VIEW_KEY }).listen(port, () => {
    console.log(`[ai-office] http://localhost:${port}  (demo: /?demo=1)`);
  });
}
