import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = process.cwd();
const PORT = 4173;
const STORE_FILE = join(root, '.realtime-store.json');

const types = { 
  '.html': 'text/html; charset=utf-8', 
  '.css': 'text/css; charset=utf-8', 
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

// In-memory store backed by .realtime-store.json for real-time multi-device sync
let realtimeStore = {};
const sseClients = new Set();

async function loadStoreFromDisk() {
  try {
    if (existsSync(STORE_FILE)) {
      const raw = await readFile(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        realtimeStore = parsed;
      }
    }
  } catch {
    realtimeStore = {};
  }
}

let saveStoreTimer = null;
function persistStoreToDisk() {
  if (saveStoreTimer) clearTimeout(saveStoreTimer);
  saveStoreTimer = setTimeout(async () => {
    try {
      await writeFile(STORE_FILE, JSON.stringify(realtimeStore, null, 2), 'utf-8');
    } catch {}
  }, 150);
}

function broadcastSSE(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

await loadStoreFromDisk();

const server = createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(urlObj.pathname);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    // 1. Real-time Server-Sent Events (SSE) stream
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

      const client = { id: urlObj.searchParams.get('clientId') || 'anon', res };
      sseClients.add(client);

      req.on('close', () => {
        sseClients.delete(client);
      });
      return;
    }

    // 2. Real-time State Sync API (GET & POST)
    if (pathname === '/api/sync') {
      if (req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          ok: true,
          timestamp: Date.now(),
          entries: realtimeStore
        }));
        return;
      }

      if (req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const bodyText = Buffer.concat(chunks).toString('utf-8');
        const payload = JSON.parse(bodyText || '{}');
        const entries = payload.entries || {};
        const changed = {};

        for (const [key, value] of Object.entries(entries)) {
          if (!String(key).startsWith('lopvui.')) continue;
          if (value === null || value === undefined) {
            if (key in realtimeStore) {
              delete realtimeStore[key];
              changed[key] = null;
            }
          } else if (realtimeStore[key] !== value) {
            realtimeStore[key] = String(value);
            changed[key] = String(value);
          }
        }

        if (Object.keys(changed).length > 0) {
          persistStoreToDisk();
          broadcastSSE({
            type: 'sync-entries',
            clientId: payload.clientId || null,
            timestamp: Date.now(),
            entries: changed
          });
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ ok: true, updatedCount: Object.keys(changed).length, timestamp: Date.now() }));
        return;
      }
    }

    // 3. Static Files & SPA Fallback
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    let file = normalize(join(root, relative));
    if (!file.startsWith(root)) throw new Error('Invalid path');

    let body;
    let ext = extname(file);
    try {
      body = await readFile(file);
    } catch {
      // SPA Fallback for client-side routing (e.g. /class/TOAN8A/general)
      if (!ext) {
        file = join(root, 'index.html');
        ext = '.html';
        body = await readFile(file);
      } else {
        throw new Error('File not found');
      }
    }

    res.writeHead(200, { 
      'Content-Type': types[ext] || 'application/octet-stream', 
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Không tìm thấy trang này.');
  }
});

// Lắng nghe trên 0.0.0.0 để iPad, điện thoại cùng mạng Wi-Fi có thể truy cập và đồng bộ real-time
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Ứng dụng Lớp học vui (v1.0 · Real-time Sync) đang chạy:`);
  console.log(`- Trên máy này:    http://localhost:${PORT}`);
  
  // In địa chỉ IP mạng nội bộ cho iPad / điện thoại
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`- Trên iPad/Phone: http://${net.address}:${PORT} (Đồng bộ Real-time qua Wi-Fi)`);
      }
    }
  }
  console.log('');
});
