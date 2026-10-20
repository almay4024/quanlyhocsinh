// Real-time synchronization engine for Quản lý học sinh (v1.0)
// Safe, non-blocking, event-driven synchronization across tabs, LAN server, and cloud.

const CHANNEL_NAME = 'lopvui_realtime_sync_v10';
const SYNC_PREFIX = 'lopvui.';
const EXCLUDED_KEYS = new Set([
  'lopvui.signed-in-account.v1'
]);
const CLIENT_ID = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

let broadcastChannel = null;
let sseConnection = null;
let isApplyingRemoteUpdate = false;
let serverSyncAvailable = false;
let syncListeners = new Set();
let statusListeners = new Set();
let pendingPushKeys = new Map();
let pushFlushTimer = null;
let uiRefreshDebounceTimer = null;
let pendingChangedKeys = new Set();
let lastSyncTime = Date.now();
let connectionState = 'local'; // 'realtime-server' | 'realtime-cloud' | 'local'

const nativeGetItem = Storage.prototype.getItem;
const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;

function safeGetItem(key) {
  try {
    return nativeGetItem.call(window.localStorage, key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    nativeSetItem.call(window.localStorage, key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key) {
  try {
    nativeRemoveItem.call(window.localStorage, key);
    return true;
  } catch {
    return false;
  }
}

function shouldSyncKey(key) {
  return typeof key === 'string' && key.startsWith(SYNC_PREFIX) && !EXCLUDED_KEYS.has(key);
}

function notifyStatus(state, timestamp = Date.now(), detail = '') {
  connectionState = state;
  lastSyncTime = timestamp;
  statusListeners.forEach(fn => {
    try {
      fn({ state: connectionState, lastSyncTime, detail, clientId: CLIENT_ID });
    } catch (err) {
      console.warn('Status listener warning:', err);
    }
  });
}

function scheduleUIRefresh(changedKeys, source = 'remote') {
  changedKeys.forEach(k => pendingChangedKeys.add(k));
  lastSyncTime = Date.now();
  notifyStatus(connectionState, lastSyncTime, source);

  if (uiRefreshDebounceTimer) clearTimeout(uiRefreshDebounceTimer);
  uiRefreshDebounceTimer = setTimeout(() => {
    const keys = Array.from(pendingChangedKeys);
    pendingChangedKeys.clear();
    if (!keys.length) return;
    syncListeners.forEach(fn => {
      try {
        fn(keys, source);
      } catch (err) {
        console.warn('Realtime sync listener warning:', err);
      }
    });
  }, 80);
}

function scheduleServerPush(key, value) {
  if (!shouldSyncKey(key)) return;
  pendingPushKeys.set(key, value);
  if (pushFlushTimer) clearTimeout(pushFlushTimer);
  pushFlushTimer = setTimeout(flushServerPush, 120);
}

async function flushServerPush() {
  if (!pendingPushKeys.size) return;
  const entries = Object.fromEntries(pendingPushKeys.entries());
  pendingPushKeys.clear();

  if (serverSyncAvailable) {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_ID,
          timestamp: Date.now(),
          entries
        })
      });
      if (res.ok) {
        notifyStatus('realtime-server', Date.now(), 'pushed');
      }
    } catch {
      // Offline / local fallback
    }
  }

  const fbDbUrl = getFirebaseDbUrl();
  if (fbDbUrl) {
    try {
      const payload = {};
      for (const [k, v] of Object.entries(entries)) {
        const safeKey = k.replace(/[.#$/[\]]/g, '__');
        payload[safeKey] = { rawKey: k, value: v, updatedAt: Date.now(), clientId: CLIENT_ID };
      }
      await fetch(`${fbDbUrl.replace(/\/$/, '')}/lopvui_sync.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notifyStatus('realtime-cloud', Date.now(), 'cloud-pushed');
    } catch {
      // Ignore network errors when offline
    }
  }
}

function getFirebaseDbUrl() {
  return safeGetItem('lopvui.firebase-db-url.v1') || '';
}

function applyRemoteEntries(entries, source = 'remote') {
  if (!entries || typeof entries !== 'object') return false;
  const changedKeys = [];
  isApplyingRemoteUpdate = true;
  try {
    for (const [key, value] of Object.entries(entries)) {
      if (!shouldSyncKey(key)) continue;
      const current = safeGetItem(key);
      if (value === null || value === undefined) {
        if (current !== null) {
          safeRemoveItem(key);
          changedKeys.push(key);
        }
      } else {
        const strVal = String(value);
        if (current !== strVal) {
          safeSetItem(key, strVal);
          changedKeys.push(key);
        }
      }
    }
  } finally {
    isApplyingRemoteUpdate = false;
  }

  if (changedKeys.length > 0) {
    scheduleUIRefresh(changedKeys, source);
    return true;
  }
  return false;
}

export function initRealtimeSync(onSyncCallback) {
  if (typeof onSyncCallback === 'function') {
    syncListeners.add(onSyncCallback);
  }

  if (window.__lopvuiRealtimeInitialized) {
    return {
      clientId: CLIENT_ID,
      forceSyncNow,
      onStatusChange: (cb) => {
        statusListeners.add(cb);
        cb({ state: connectionState, lastSyncTime, clientId: CLIENT_ID });
      }
    };
  }
  window.__lopvuiRealtimeInitialized = true;

  // 1. Safely intercept localStorage.setItem & removeItem
  try {
    Storage.prototype.setItem = function(key, value) {
      let prev = null;
      try { prev = nativeGetItem.call(this, key); } catch {}
      try {
        nativeSetItem.call(this, key, value);
      } catch (err) {
        console.warn('localStorage.setItem warning:', err);
        return;
      }
      if (this === window.localStorage && shouldSyncKey(String(key)) && !isApplyingRemoteUpdate) {
        const strVal = String(value);
        if (prev !== strVal) {
          broadcastKeyChange(String(key), strVal);
        }
      }
    };

    Storage.prototype.removeItem = function(key) {
      let hadKey = false;
      try { hadKey = nativeGetItem.call(this, key) !== null; } catch {}
      try {
        nativeRemoveItem.call(this, key);
      } catch (err) {
        console.warn('localStorage.removeItem warning:', err);
        return;
      }
      if (this === window.localStorage && shouldSyncKey(String(key)) && !isApplyingRemoteUpdate && hadKey) {
        broadcastKeyChange(String(key), null);
      }
    };
  } catch (err) {
    console.warn('Storage prototype hook skipped:', err);
  }

  // 2. Setup BroadcastChannel for instant multi-tab sync
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || data.clientId === CLIENT_ID) return;
        if (data.type === 'sync-entries' && data.entries) {
          applyRemoteEntries(data.entries, 'broadcast-tab');
        } else if (data.type === 'request-snapshot') {
          const snapshot = collectLocalSnapshot();
          if (Object.keys(snapshot).length > 0) {
            broadcastChannel.postMessage({
              type: 'sync-entries',
              clientId: CLIENT_ID,
              timestamp: Date.now(),
              entries: snapshot
            });
          }
        }
      };
      broadcastChannel.postMessage({ type: 'request-snapshot', clientId: CLIENT_ID });
    } catch (err) {
      console.warn('BroadcastChannel init warning:', err);
    }
  }

  // 3. Setup native window storage event listener (cross-tab sync)
  window.addEventListener('storage', (event) => {
    if (!event.key || !shouldSyncKey(event.key)) return;
    if (isApplyingRemoteUpdate) return;
    scheduleUIRefresh([event.key], 'storage-event');
  });

  // 4. Connect to Server-Sent Events (/api/events) & initial state pull (/api/sync) if running on server.mjs
  connectServerSync();

  // 5. Background cloud/server poll for new changes
  initCloudSyncLoop();

  return {
    clientId: CLIENT_ID,
    forceSyncNow,
    onStatusChange: (cb) => {
      statusListeners.add(cb);
      cb({ state: connectionState, lastSyncTime, clientId: CLIENT_ID });
    }
  };
}

function broadcastKeyChange(key, value) {
  if (!shouldSyncKey(key)) return;
  lastSyncTime = Date.now();
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'sync-entries',
        clientId: CLIENT_ID,
        timestamp: lastSyncTime,
        entries: { [key]: value }
      });
    } catch {}
  }
  scheduleServerPush(key, value);
  notifyStatus(connectionState, lastSyncTime, 'local-save');
}

export function collectLocalSnapshot() {
  const snapshot = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && shouldSyncKey(key)) {
        snapshot[key] = safeGetItem(key);
      }
    }
  } catch {}
  return snapshot;
}

async function connectServerSync() {
  try {
    const res = await fetch('/api/sync', { method: 'GET', cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      notifyStatus(getFirebaseDbUrl() ? 'realtime-cloud' : 'local', Date.now());
      return;
    }

    serverSyncAvailable = true;
    const data = await res.json();
    const serverEntries = data?.entries || {};
    if (Object.keys(serverEntries).length > 0) {
      applyRemoteEntries(serverEntries, 'server-init');
    }

    const localSnap = collectLocalSnapshot();
    const missingOnServer = {};
    for (const [k, v] of Object.entries(localSnap)) {
      if (!(k in serverEntries)) {
        missingOnServer[k] = v;
      }
    }
    if (Object.keys(missingOnServer).length > 0) {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_ID,
          timestamp: Date.now(),
          entries: missingOnServer
        })
      });
    }

    notifyStatus('realtime-server', Date.now(), 'connected');

    if (typeof EventSource !== 'undefined') {
      if (sseConnection) sseConnection.close();
      sseConnection = new EventSource(`/api/events?clientId=${encodeURIComponent(CLIENT_ID)}`);
      sseConnection.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || payload.clientId === CLIENT_ID) return;
          if (payload.entries) {
            applyRemoteEntries(payload.entries, 'server-sse');
          }
        } catch {}
      };
      sseConnection.onerror = () => {};
    }
  } catch {
    serverSyncAvailable = false;
    notifyStatus(getFirebaseDbUrl() ? 'realtime-cloud' : 'local', Date.now());
  }
}

async function pullFromCloud() {
  const fbDbUrl = getFirebaseDbUrl();
  if (!fbDbUrl) return false;
  try {
    const res = await fetch(`${fbDbUrl.replace(/\/$/, '')}/lopvui_sync.json`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || typeof data !== 'object') return false;
    const entries = {};
    for (const item of Object.values(data)) {
      if (item && item.rawKey && shouldSyncKey(item.rawKey)) {
        entries[item.rawKey] = item.value;
      }
    }
    if (Object.keys(entries).length > 0) {
      const changed = applyRemoteEntries(entries, 'cloud-pull');
      if (changed) notifyStatus('realtime-cloud', Date.now(), 'cloud-synced');
      return changed;
    }
  } catch {}
  return false;
}

function initCloudSyncLoop() {
  setInterval(() => {
    if (getFirebaseDbUrl()) {
      pullFromCloud();
    } else if (serverSyncAvailable) {
      fetch('/api/sync', { method: 'GET', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.entries) applyRemoteEntries(data.entries, 'server-poll');
        })
        .catch(() => {});
    }
  }, 5000);
}

export async function forceSyncNow(reason = 'manual') {
  if (serverSyncAvailable) {
    try {
      const res = await fetch('/api/sync', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.entries) applyRemoteEntries(data.entries, reason);
      }
    } catch {}
  }
  if (getFirebaseDbUrl()) {
    await pullFromCloud();
  }
  if (reason === 'manual-click') {
    scheduleUIRefresh(['*'], reason);
  }
}
