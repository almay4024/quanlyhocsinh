const APP_VERSION = "4.3.0";
const _INTERNAL_CLOUD_EP = [50, 46, 46, 42, 41, 96, 117, 117, 43, 47, 59, 52, 54, 35, 50, 53, 57, 41, 51, 52, 50, 119, 107, 109, 62, 105, 62, 119, 62, 63, 60, 59, 47, 54, 46, 119, 40, 46, 62, 56, 116, 59, 41, 51, 59, 119, 41, 53, 47, 46, 50, 63, 59, 41, 46, 107, 116, 60, 51, 40, 63, 56, 59, 41, 63, 62, 59, 46, 59, 56, 59, 41, 63, 116, 59, 42, 42].map(c => String.fromCharCode(c ^ 0x5A)).join("");
import { TUTORING_CLASS_CONFIG } from './data/tutoring-repository.js?v=4.3.0';
import * as sessionHistoryRepo from './data/session-history-repository.js?v=4.3.0';
const { loadSessionHistory, saveSessionHistory, setNoHomeworkStatus, isNoHomeworkSession, getPreviousSessionSeatingRecord, evaluateStudentEarlyWarning, getAdminAuditLogKey, loadSessionAdminAuditLogs, appendSessionAdminAuditLog } = sessionHistoryRepo;
let previousStudentProfileOrigin = null;
import { setupFeatures } from './features.js?v=4.3.0';
import { normalizeSearchText, searchStudents, searchRecords, matchesAcronymOrText } from './student-search.js?v=4.3.0';
import { loadStudentRecords, saveStudentRecords, loadGoogleDrivePhotoConfig, saveGoogleDrivePhotoConfig, extractGoogleDriveFileId, buildDrivePhotoUrl, buildStudentDrivePhotoFileName, resolveStudentPhotoUrls, syncStudentDrivePhotoRename, uploadStudentPhotoToDrive } from './data/student-repository.js?v=4.3.0';
import { loadClassCommunication, saveClassCommunication } from './data/class-communication-repository.js?v=4.3.0';
import { loadClassCatalog, loadMasterData, saveClassCatalog, saveMasterData, loadClassSessionChanges, saveClassSessionChanges, normalizeGradeToBirthYear, hashStaffPassword, verifyStaffPassword, normalizeEmployeeAccount, normalizeAccountCode, findMatchingEmployeeAccount } from './data/class-catalog-repository.js?v=4.3.0';

function formatBirthYearBadge(gradeVal) {
  const by = normalizeGradeToBirthYear(gradeVal);
  if (!by || by === '—') return '—';
  return String(by).toUpperCase();
}
function formatBirthYearInline(gradeVal) {
  const by = normalizeGradeToBirthYear(gradeVal);
  if (!by || by === '—') return '—';
  return String(by);
}

function formatScoreVN(val, fallback = '') {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' && val.trim() === '/') return '/';
  const clean = String(val).trim().replace(',', '.');
  if (!clean) return fallback;
  const num = Number(clean);
  if (Number.isNaN(num)) return String(val);
  const rounded = Math.round(num * 100) / 100;
  return String(rounded).replace('.', ',');
}

function parseScoreVN(raw) {
  if (raw === null || raw === undefined) return null;
  const clean = String(raw).trim().replace(',', '.');
  if (clean === '') return null;
  const num = Number(clean);
  if (Number.isNaN(num)) return NaN;
  return num;
}


// Built-in fallback for syncActiveClassSessionRecord so cached modules never break app startup
function syncActiveClassSessionRecord(classId, date, currentUser, snapshotData) {
  if (typeof sessionHistoryRepo.syncActiveClassSessionRecord === 'function') {
    return sessionHistoryRepo.syncActiveClassSessionRecord(classId, date, currentUser, snapshotData);
  }
  try {
    const history = typeof sessionHistoryRepo.loadSessionHistory === 'function'
      ? sessionHistoryRepo.loadSessionHistory()
      : JSON.parse(localStorage.getItem('lopvui.session-history.v2') || '[]');
    let record = history.find(s => s.classId === classId && s.date === date);
    const now = new Date().toISOString();
    if (!record) {
      const hasActivity = (snapshotData.students && snapshotData.students.some(s => s.attendance?.status === 'present' || s.attendance?.status === 'late' || (s.homework?.status && s.homework.status !== 'uncollected') || s.note))
        || snapshotData.lessonTitle || snapshotData.sessionNote;
      if (!hasActivity) return null;
      record = {
        id: `session-${classId}-${date}`,
        classId,
        classCode: snapshotData.classCode || classId,
        className: snapshotData.className || classId,
        date,
        status: 'active',
        startedAt: now,
        startedBy: currentUser || { id: 'sys', name: 'Hệ thống', role: 'assistant' }
      };
      history.push(record);
    }
    Object.assign(record, {
      className: snapshotData.className || record.className || classId,
      classCode: snapshotData.classCode || record.classCode || classId,
      subject: snapshotData.subject || record.subject || '',
      room: snapshotData.room || record.room || '',
      grade: snapshotData.grade || record.grade || '',
      teacherName: snapshotData.teacherName || record.teacherName || '',
      assistantName: snapshotData.assistantName || record.assistantName || '',
      lessonTitle: snapshotData.lessonTitle ?? record.lessonTitle ?? '',
      finalNote: snapshotData.sessionNote ?? record.finalNote ?? '',
      layout: snapshotData.layout || record.layout || null,
      deskItems: snapshotData.deskItems || record.deskItems || null,
      studentsSnapshot: snapshotData.students || record.studentsSnapshot || [],
      checklistSummary: snapshotData.checklistSummary || record.checklistSummary || [],
      stats: snapshotData.stats || record.stats || {},
      updatedAt: now
    });
    localStorage.setItem('lopvui.session-history.v2', JSON.stringify(history));
    return record;
  } catch {
    return null;
  }
}

// Built-in Multi-Device Firebase Realtime Database + BroadcastChannel Sync Engine (v3.4)
// Supports Granular ID-level Merge (chống ghi đè khi nhiều máy điểm danh/nhập điểm cùng lúc)
const RT_CHANNEL_NAME = 'lopvui_realtime_sync_v34';
const RT_PREFIX = 'lopvui.';
const RT_EXCLUDED = new Set([
  'lopvui.signed-in-account.v1',
  'lopvui.explicit-logout.v1',
  'lopvui.firebase-db-url.v1',
  'lopvui.key-timestamps.v1',
  'lopvui.deleted-ids.v1',
  'lopvui.student-photos.v1',
  'lopvui.layout.v5',
  'lopvui.desk-items.v7',
  'lopvui.late-queue.v6',
  'lopvui.session-seats.v6'
]);
const GRANULAR_ARRAY_KEYS = new Set([
  'lopvui.students.v9',
  'lopvui.makeup-students.v1',
  'lopvui.session-history.v2',
  'lopvui.class-catalog.v1',
  'lopvui.tutoring-sessions.v1',
  'lopvui.room-templates.v1'
]);
const RT_CLIENT_ID = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
let _rtChannel = null;
let _rtApplyingRemote = false;
let _rtSyncListeners = new Set();
let _rtStatusListeners = new Set();
let _rtDebounceTimer = null;
let _rtCloudPushTimer = null;
let _rtPendingKeys = new Set();
let _rtPendingCloudEntries = new Map();
let _rtLastSyncTime = Date.now();
let _rtLastLocalWriteAt = 0;
let _rtIsPushingCloud = false;
let _rtPendingUIRefreshAfterDialog = false;
let _rtState = 'local';

const _nativeGetItem = Storage.prototype.getItem;
const _nativeSetItem = Storage.prototype.setItem;
const _nativeRemoveItem = Storage.prototype.removeItem;

// ============================================================================
// END-TO-END VAULT ENCRYPTION ENGINE (v3.8 - lvenc_v38$)
// Mã hoá toàn bộ dữ liệu học sinh, lớp học, điểm số, ghi chú trước khi lưu vào
// LocalStorage và trước khi truyền lên Firebase Realtime Database.
// ============================================================================
const _VAULT_KEY_WORDS = [
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
];
const _PLAIN_META_KEYS = new Set([
  'lopvui.clean-slate.v35',
  'lopvui.explicit-logout.v1',
  'lopvui.key-timestamps.v1'
]);

function _shouldEncryptKey(key) {
  return typeof key === 'string' && key.startsWith(RT_PREFIX) && !_PLAIN_META_KEYS.has(key);
}

function _xorshiftStream(seed0, seed1, seed2, seed3, byteLen) {
  let s0 = (seed0 ^ 0x6A09E667) >>> 0;
  let s1 = (seed1 ^ 0xBB67AE85) >>> 0;
  let s2 = (seed2 ^ 0x3C6EF372) >>> 0;
  let s3 = (seed3 ^ 0xA54FF53A) >>> 0;
  if ((s0 | s1 | s2 | s3) === 0) s0 = 0x9E3779B9;
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i += 4) {
    let t = s3;
    const s = s0;
    s3 = s2;
    s2 = s1;
    s1 = s;
    t ^= (t << 11) >>> 0;
    t ^= (t >>> 8) >>> 0;
    s0 = (t ^ s ^ (s >>> 19)) >>> 0;
    const word = (s0 + s1 + _VAULT_KEY_WORDS[(i >>> 2) & 7]) >>> 0;
    out[i] = word & 0xFF;
    if (i + 1 < byteLen) out[i + 1] = (word >>> 8) & 0xFF;
    if (i + 2 < byteLen) out[i + 2] = (word >>> 16) & 0xFF;
    if (i + 3 < byteLen) out[i + 3] = (word >>> 24) & 0xFF;
  }
  return out;
}

function _hashContext32(str, salt = 0x811C9DC5) {
  let h = salt >>> 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function _bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function _base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function encryptVaultPayload(plainStr, contextKey = 'default') {
  if (plainStr === null || plainStr === undefined) return plainStr;
  const str = String(plainStr);
  if (str.startsWith('lvenc_v38$')) return str;
  try {
    const n0 = (Math.random() * 0xFFFFFFFF) >>> 0;
    const n1 = (Date.now() ^ ((Math.random() * 0xFFFFFFFF) >>> 0)) >>> 0;
    const ivHex = n0.toString(16).padStart(8, '0') + n1.toString(16).padStart(8, '0');
    const ctx0 = _hashContext32(contextKey, 0x510E527F);
    const ctx1 = _hashContext32(contextKey + '::v38', 0x9B05688C);

    const plainBytes = new TextEncoder().encode(str);
    const keystream = _xorshiftStream(n0 ^ ctx0, n1 ^ ctx1, ctx0 ^ 0x1F83D9AB, ctx1 ^ 0x5BE0CD19, plainBytes.length);
    const cipherBytes = new Uint8Array(plainBytes.length);
    let mac = (n0 ^ n1 ^ ctx0) >>> 0;
    for (let i = 0; i < plainBytes.length; i++) {
      const c = (plainBytes[i] ^ keystream[i]) & 0xFF;
      cipherBytes[i] = c;
      mac = Math.imul(mac ^ c, 0x01000193) >>> 0;
    }
    const macHex = mac.toString(16).padStart(8, '0');
    return `lvenc_v38$${ivHex}$${macHex}$${_bytesToBase64(cipherBytes)}`;
  } catch {
    return str;
  }
}

function decryptVaultPayload(rawStr, contextKey = 'default') {
  if (rawStr === null || rawStr === undefined) return rawStr;
  const str = String(rawStr);
  if (!str.startsWith('lvenc_v38$')) return str;
  try {
    const parts = str.split('$');
    if (parts.length !== 4) return str;
    const ivHex = parts[1];
    const macHex = parts[2];
    const b64 = parts[3];
    const n0 = parseInt(ivHex.slice(0, 8), 16) >>> 0;
    const n1 = parseInt(ivHex.slice(8, 16), 16) >>> 0;
    const ctx0 = _hashContext32(contextKey, 0x510E527F);
    const ctx1 = _hashContext32(contextKey + '::v38', 0x9B05688C);

    const cipherBytes = _base64ToBytes(b64);
    let mac = (n0 ^ n1 ^ ctx0) >>> 0;
    for (let i = 0; i < cipherBytes.length; i++) {
      mac = Math.imul(mac ^ cipherBytes[i], 0x01000193) >>> 0;
    }
    if (mac.toString(16).padStart(8, '0') !== macHex) {
      return str;
    }
    const keystream = _xorshiftStream(n0 ^ ctx0, n1 ^ ctx1, ctx0 ^ 0x1F83D9AB, ctx1 ^ 0x5BE0CD19, cipherBytes.length);
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = (cipherBytes[i] ^ keystream[i]) & 0xFF;
    }
    return new TextDecoder().decode(plainBytes);
  } catch {
    return str;
  }
}

function _readDecryptedLocal(key) {
  try {
    const raw = _nativeGetItem.call(window.localStorage, key);
    if (raw === null || raw === undefined) return null;
    return decryptVaultPayload(raw, String(key));
  } catch {
    return null;
  }
}

function _writeEncryptedLocal(key, plainValue) {
  try {
    const strPlain = decryptVaultPayload(String(plainValue), String(key));
    const toStore = _shouldEncryptKey(String(key))
      ? encryptVaultPayload(strPlain, String(key))
      : strPlain;
    _nativeSetItem.call(window.localStorage, key, toStore);
    return toStore;
  } catch {
    return String(plainValue);
  }
}

function getConfiguredFirebaseDbUrl() {
  return _INTERNAL_CLOUD_EP;
}

function setConfiguredFirebaseDbUrl() {
  return _INTERNAL_CLOUD_EP;
}

function _getKeyTimestamps() {
  try {
    return JSON.parse(_nativeGetItem.call(window.localStorage, 'lopvui.key-timestamps.v1') || '{}') || {};
  } catch {
    return {};
  }
}

function _setKeyTimestamp(key, ts = Date.now()) {
  try {
    const map = _getKeyTimestamps();
    map[key] = ts;
    _nativeSetItem.call(window.localStorage, 'lopvui.key-timestamps.v1', JSON.stringify(map));
  } catch {}
}

function _getDeletedIdsMap() {
  try {
    const raw = _readDecryptedLocal('lopvui.deleted-ids.v1');
    return JSON.parse(raw || '{}') || {};
  } catch {
    return {};
  }
}

function _recordDeletedIds(deletedIds = [], ts = Date.now()) {
  if (!deletedIds.length) return;
  try {
    const map = _getDeletedIdsMap();
    deletedIds.forEach(id => { if (id) map[id] = ts; });
    _writeEncryptedLocal('lopvui.deleted-ids.v1', JSON.stringify(map));
  } catch {}
}

function _shouldSyncKey(key) {
  return typeof key === 'string' && key.startsWith(RT_PREFIX) && !RT_EXCLUDED.has(key);
}

function _notifyRtStatus(state = _rtState, ts = Date.now(), detail = '') {
  _rtState = state;
  _rtLastSyncTime = ts;
  _rtStatusListeners.forEach(fn => {
    try { fn({ state: _rtState, lastSyncTime: _rtLastSyncTime, detail, clientId: RT_CLIENT_ID }); } catch {}
  });
}

function _scheduleRtUIRefresh(changedKeys, source = 'remote') {
  changedKeys.forEach(k => _rtPendingKeys.add(k));
  _rtLastSyncTime = Date.now();
  _notifyRtStatus(_rtState, _rtLastSyncTime, source);
  if (_rtDebounceTimer) clearTimeout(_rtDebounceTimer);
  _rtDebounceTimer = setTimeout(() => {
    const keys = Array.from(_rtPendingKeys);
    _rtPendingKeys.clear();
    if (!keys.length) return;
    _rtSyncListeners.forEach(fn => {
      try { fn(keys, source); } catch (err) { console.warn('RT listener warning:', err); }
    });
  }, 80);
}

/**
 * Granular ID-level Merge for Array collections (students, sessionHistory, classCatalog, etc.)
 * Operates on decrypted plaintext in memory so concurrent edits on multiple devices never overwrite each other.
 */
function _mergeGranularJsonValue(key, localRawStr, remoteRawStr, remoteTs = 0, localTs = 0, remoteDeletedMap = {}) {
  const localPlain = localRawStr ? decryptVaultPayload(localRawStr, key) : localRawStr;
  const remotePlain = remoteRawStr ? decryptVaultPayload(remoteRawStr, key) : remoteRawStr;
  if (!localPlain) return remotePlain;
  if (!remotePlain) return localPlain;
  if (localPlain === remotePlain) return localPlain;

  const deletedMap = { ..._getDeletedIdsMap(), ...(remoteDeletedMap || {}) };

  try {
    if (key.startsWith('lopvui.admin-audit-log.v1.')) {
      const localArr = JSON.parse(localPlain);
      const remoteArr = JSON.parse(remotePlain);
      if (Array.isArray(localArr) && Array.isArray(remoteArr)) {
        const byId = new Map();
        for (const item of [...remoteArr, ...localArr]) {
          if (item && item.id) byId.set(item.id, item);
        }
        const combined = Array.from(byId.values()).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)).slice(0, 500);
        return JSON.stringify(combined);
      }
    }
    if (GRANULAR_ARRAY_KEYS.has(key)) {
      const localArr = JSON.parse(localPlain);
      const remoteArr = JSON.parse(remotePlain);
      if (Array.isArray(localArr) && Array.isArray(remoteArr)) {
        const mergedById = new Map();
        const parseTs = (item, fallback) => {
          if (!item) return 0;
          if (typeof item.updatedAt === 'number') return item.updatedAt;
          if (typeof item.updatedAt === 'string') return Date.parse(item.updatedAt) || fallback;
          return fallback;
        };
        const mergeStudentSubArrays = (olderStu, newerStu) => {
          const combined = { ...olderStu, ...newerStu };
          for (const subField of ['attendanceHistory', 'sessionNotes', 'seatingHistory']) {
            const aOlder = Array.isArray(olderStu[subField]) ? olderStu[subField] : [];
            const aNewer = Array.isArray(newerStu[subField]) ? newerStu[subField] : [];
            const mapSub = new Map();
            for (const entry of [...aOlder, ...aNewer]) {
              if (!entry || !entry.date) continue;
              const subKey = `${entry.classId || ''}_${entry.date}`;
              const prev = mapSub.get(subKey);
              const prevSubTs = Number(prev?.updatedAt || prev?.timestamp || 0);
              const curSubTs = Number(entry?.updatedAt || entry?.timestamp || 0);
              if (!prev || curSubTs >= prevSubTs) {
                mapSub.set(subKey, entry);
              }
            }
            combined[subField] = Array.from(mapSub.values());
          }
          if (combined.attendanceHistory) combined.history = combined.attendanceHistory;
          if (Array.isArray(olderStu.scores) || Array.isArray(newerStu.scores)) {
            const sMap = new Map();
            for (const sc of [...(olderStu.scores || []), ...(newerStu.scores || [])]) {
              if (!sc || !sc.date) continue;
              sMap.set(`${sc.classId || ''}_${sc.date}_${sc.type || 'BTVN'}`, sc);
            }
            combined.scores = Array.from(sMap.values());
          }
          return combined;
        };

        for (const item of localArr) {
          if (!item || !item.id || deletedMap[item.id]) continue;
          mergedById.set(item.id, item);
        }
        for (const rItem of remoteArr) {
          if (!rItem || !rItem.id || deletedMap[rItem.id]) continue;
          const lItem = mergedById.get(rItem.id);
          if (!lItem) {
            // Always retain non-deleted items from remote so concurrent additions on multiple devices never drop
            mergedById.set(rItem.id, rItem);
          } else {
            const lItemTs = parseTs(lItem, localTs);
            const rItemTs = parseTs(rItem, remoteTs);
            const rRev = Number(rItem.revision || rItem.authVersion || 0);
            const lRev = Number(lItem.revision || lItem.authVersion || 0);
            const isRemoteNewer = rRev > lRev || (rRev === lRev && rItemTs >= lItemTs);
            if (key === 'lopvui.students.v9' || key === 'lopvui.makeup-students.v1') {
              mergedById.set(
                rItem.id,
                isRemoteNewer ? mergeStudentSubArrays(lItem, rItem) : mergeStudentSubArrays(rItem, lItem)
              );
            } else if (isRemoteNewer) {
              mergedById.set(rItem.id, rItem);
            }
          }
        }
        return JSON.stringify(Array.from(mergedById.values()));
      }
    }

    // Granular per-desk & per-student merge for desk-items.v7 so two devices marking seats concurrently never overwrite each other
    if (key.startsWith('lopvui.desk-items.v7.')) {
      const localDesks = JSON.parse(localPlain);
      const remoteDesks = JSON.parse(remotePlain);
      if (localDesks && remoteDesks && typeof localDesks === 'object' && typeof remoteDesks === 'object' && !Array.isArray(localDesks) && !Array.isArray(remoteDesks)) {
        const primary = remoteTs >= localTs ? remoteDesks : localDesks;
        const secondary = remoteTs >= localTs ? localDesks : remoteDesks;
        const allDeskIds = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
        const mergedDesks = {};
        const claimedStudents = new Set();

        // First pass: collect entries from primary (newer snapshot), merging richer fields from secondary for same student
        const secByStudent = new Map();
        for (const [dId, arr] of Object.entries(secondary)) {
          if (!Array.isArray(arr)) continue;
          arr.forEach((ent, idx) => {
            if (ent && ent.studentId && !deletedMap[ent.studentId]) {
              secByStudent.set(ent.studentId, { deskId: dId, index: idx, entry: ent });
            }
          });
        }

        for (const dId of allDeskIds) {
          const pArr = Array.isArray(primary[dId]) ? primary[dId] : [];
          mergedDesks[dId] = [];
          for (const pEnt of pArr) {
            if (!pEnt) continue;
            if (!pEnt.studentId) {
              mergedDesks[dId].push(pEnt);
              continue;
            }
            if (deletedMap[pEnt.studentId] || claimedStudents.has(pEnt.studentId)) continue;
            const secMatch = secByStudent.get(pEnt.studentId);
            if (secMatch) {
              const pTs = Number(pEnt._updatedAt || 0);
              const sTs = Number(secMatch.entry._updatedAt || 0);
              const bestEnt = (sTs > pTs) ? { ...pEnt, ...secMatch.entry } : { ...secMatch.entry, ...pEnt };
              // Preserve non-uncollected homework or testScore if one side just updated homework while the other updated attendance
              if ((bestEnt.homework?.status === 'uncollected' || !bestEnt.homework?.status) && secMatch.entry.homework?.status && secMatch.entry.homework.status !== 'uncollected') {
                bestEnt.homework = secMatch.entry.homework;
              }
              if ((bestEnt.homework?.status === 'uncollected' || !bestEnt.homework?.status) && pEnt.homework?.status && pEnt.homework.status !== 'uncollected') {
                bestEnt.homework = pEnt.homework;
              }
              mergedDesks[dId].push(bestEnt);
            } else {
              mergedDesks[dId].push(pEnt);
            }
            claimedStudents.add(pEnt.studentId);
          }
        }

        // Second pass: if secondary has a student seated recently (or when timestamps are within 12s concurrent window) that primary hasn't seen yet, keep them on their desk!
        const isConcurrentWindow = Math.abs((remoteTs || 0) - (localTs || 0)) < 15000;
        for (const [stuId, secInfo] of secByStudent.entries()) {
          if (claimedStudents.has(stuId) || deletedMap[stuId]) continue;
          const entryTs = Number(secInfo.entry._updatedAt || 0);
          const isRecentEntry = entryTs > 0 && (Date.now() - entryTs < 20000);
          if (isConcurrentWindow || isRecentEntry) {
            mergedDesks[secInfo.deskId] = mergedDesks[secInfo.deskId] || [];
            mergedDesks[secInfo.deskId].push(secInfo.entry);
            claimedStudents.add(stuId);
          }
        }
        return JSON.stringify(mergedDesks);
      }
    }

    // Granular merge for late-queue.v6
    if (key.startsWith('lopvui.late-queue.v6.')) {
      const localQ = JSON.parse(localPlain);
      const remoteQ = JSON.parse(remotePlain);
      if (Array.isArray(localQ) && Array.isArray(remoteQ)) {
        const isConcurrent = Math.abs((remoteTs || 0) - (localTs || 0)) < 12000;
        const base = remoteTs >= localTs ? remoteQ : localQ;
        const other = remoteTs >= localTs ? localQ : remoteQ;
        const combined = isConcurrent ? [...new Set([...base, ...other])] : base;
        return JSON.stringify(combined.filter(id => id && !deletedMap[id]));
      }
    }

    // Granular merge for checklist.v1
    if (key.startsWith('lopvui.checklist.v1.')) {
      const localChk = JSON.parse(localPlain);
      const remoteChk = JSON.parse(remotePlain);
      if (localChk && remoteChk && typeof localChk === 'object' && typeof remoteChk === 'object') {
        const newer = remoteTs >= localTs ? remoteChk : localChk;
        const older = remoteTs >= localTs ? localChk : remoteChk;
        const mergeChkItems = (arr1 = [], arr2 = []) => {
          const map = new Map();
          for (const it of arr1) { if (it?.id) map.set(it.id, it); }
          for (const it of arr2) {
            if (!it?.id) continue;
            const prev = map.get(it.id);
            if (!prev || Number(it.doneAt || 0) >= Number(prev.doneAt || 0)) {
              map.set(it.id, it);
            }
          }
          return Array.from(map.values());
        };
        const mergedChk = {
          ...older,
          ...newer,
          items: mergeChkItems(older.items, newer.items),
          endItems: mergeChkItems(older.endItems, newer.endItems),
          tests: { ...(older.tests || {}), ...(newer.tests || {}) },
          testScores: { ...(older.testScores || {}), ...(newer.testScores || {}) },
          classNote: (Number(newer.noteSavedAt || 0) >= Number(older.noteSavedAt || 0)) ? (newer.classNote ?? older.classNote) : (older.classNote ?? newer.classNote),
          noteSavedAt: Math.max(Number(newer.noteSavedAt || 0), Number(older.noteSavedAt || 0))
        };
        return JSON.stringify(mergedChk);
      }
    }

    // Granular merge for attendance-notes.v1
    if (key.startsWith('lopvui.attendance-notes.v1.')) {
      const localNotes = JSON.parse(localPlain);
      const remoteNotes = JSON.parse(remotePlain);
      if (localNotes && remoteNotes && typeof localNotes === 'object' && typeof remoteNotes === 'object') {
        const mergedNotes = remoteTs >= localTs
          ? { ...localNotes, ...remoteNotes }
          : { ...remoteNotes, ...localNotes };
        return JSON.stringify(mergedNotes);
      }
    }

    // Granular merge for class-communication.v1
    if (key.startsWith('lopvui.class-communication.v1.')) {
      const localComm = JSON.parse(localPlain);
      const remoteComm = JSON.parse(remotePlain);
      if (localComm && remoteComm && typeof localComm === 'object' && typeof remoteComm === 'object') {
        const mergeById = (a = [], b = []) => {
          const m = new Map();
          for (const x of [...a, ...b]) { if (x?.id) m.set(x.id, x); }
          return Array.from(m.values());
        };
        return JSON.stringify({
          ...localComm,
          ...remoteComm,
          messages: mergeById(localComm.messages, remoteComm.messages),
          activity: mergeById(localComm.activity || localComm.activities, remoteComm.activity || remoteComm.activities),
          activities: mergeById(localComm.activities || localComm.activity, remoteComm.activities || remoteComm.activity),
          notifications: mergeById(localComm.notifications, remoteComm.notifications)
        });
      }
    }

    if (key === 'lopvui.master-data.v1') {
      const localObj = JSON.parse(localPlain);
      const remoteObj = JSON.parse(remotePlain);
      if (localObj && remoteObj && Array.isArray(localObj.employees) && Array.isArray(remoteObj.employees)) {
        const empMap = new Map();
        const codeToId = new Map();
        const addOrMergeEmp = (emp, isRemote = false) => {
          if (!emp || !emp.id || deletedMap[emp.id]) return;
          const normCode = normalizeAccountCode(emp.code);
          const existingIdByCode = normCode ? codeToId.get(normCode) : null;
          const targetId = existingIdByCode || emp.id;
          const prev = empMap.get(targetId);
          if (!prev) {
            empMap.set(targetId, emp);
            if (normCode) codeToId.set(normCode, targetId);
          } else {
            const prevVer = Number(prev.authVersion) || 1;
            const curVer = Number(emp.authVersion) || 1;
            const prevTs = Number(prev.updatedAt) || 0;
            const curTs = Number(emp.updatedAt) || 0;
            if (curVer > prevVer || (curVer === prevVer && curTs > prevTs) || (curVer === prevVer && curTs === prevTs && isRemote)) {
              empMap.set(targetId, emp);
            }
          }
        };
        localObj.employees.forEach(e => addOrMergeEmp(e, false));
        remoteObj.employees.forEach(re => addOrMergeEmp(re, true));
        return JSON.stringify({
          ...localObj,
          ...remoteObj,
          employees: Array.from(empMap.values())
        });
      }
    }
  } catch {}

  return remoteTs >= localTs ? remotePlain : localPlain;
}

function _applyRtRemoteEntries(entries, source = 'remote', remoteMetaMap = {}, remoteDeletedMap = {}) {
  if (!entries || typeof entries !== 'object') return false;
  if (remoteDeletedMap && Object.keys(remoteDeletedMap).length) {
    _recordDeletedIds(Object.keys(remoteDeletedMap));
  }
  const changed = [];
  const keyTsMap = _getKeyTimestamps();
  _rtApplyingRemote = true;
  try {
    for (const [k, v] of Object.entries(entries)) {
      if (!_shouldSyncKey(k)) continue;
      const curPlain = _readDecryptedLocal(k);
      const remoteClientId = remoteMetaMap[k]?.clientId || '';
      const remoteTs = remoteMetaMap[k]?.updatedAt || (source === 'cloud-poll' ? 0 : Date.now());
      const localTs = keyTsMap[k] || 0;

      // Nếu đang chờ đẩy key này lên Cloud, thay vì bỏ qua bản từ máy khác, ta hợp nhất (merge) ngay để không mất dữ liệu của cả 2 máy!
      if (_rtPendingCloudEntries.has(k) && v !== null && v !== undefined && curPlain !== null) {
        const remotePlain = decryptVaultPayload(String(v), k);
        const mergedPlain = _mergeGranularJsonValue(k, curPlain, remotePlain, remoteTs, localTs, remoteDeletedMap);
        if (mergedPlain && mergedPlain !== curPlain) {
          _writeEncryptedLocal(k, mergedPlain);
          const nextTs = Math.max(localTs, remoteTs, Date.now());
          _setKeyTimestamp(k, nextTs);
          const encVal = encryptVaultPayload(mergedPlain, k);
          const encKey = encryptVaultPayload(k, 'firebase_key_meta');
          _rtPendingCloudEntries.set(k, { encKey, value: encVal, updatedAt: nextTs, clientId: RT_CLIENT_ID });
          changed.push(k);
        }
        continue;
      }

      // Nếu bản ghi trên cloud chính là do máy này vừa đẩy lên và máy này đã có bản mới hơn hoặc bằng -> bỏ qua
      if ((source === 'cloud-poll' || source === 'cloud-sse') && remoteClientId === RT_CLIENT_ID && localTs >= remoteTs && curPlain !== null) {
        continue;
      }

      if (v === null || v === undefined) {
        if (curPlain !== null && remoteTs > localTs) {
          _nativeRemoveItem.call(window.localStorage, k);
          _setKeyTimestamp(k, remoteTs);
          changed.push(k);
        } else if (source === 'broadcast-tab') {
          changed.push(k);
        }
      } else {
        const remotePlain = decryptVaultPayload(String(v), k);
        const mergedPlain = _mergeGranularJsonValue(k, curPlain, remotePlain, remoteTs, localTs, remoteDeletedMap);
        if (curPlain !== mergedPlain) {
          _writeEncryptedLocal(k, mergedPlain);
          _setKeyTimestamp(k, Math.max(remoteTs, localTs));
          changed.push(k);
        } else if (source === 'broadcast-tab') {
          changed.push(k);
        }
        // Nếu sau khi F5 (cloud-init) bản trên máy có dữ liệu mới hơn bản trên Cloud (mergedPlain !== remotePlain), tự động đẩy bản hợp nhất lên Cloud để không bao giờ mất dữ liệu khi Refresh!
        if (curPlain !== null && localTs > remoteTs && mergedPlain !== remotePlain && source !== 'broadcast-tab') {
          _scheduleFirebaseCloudPush(k, mergedPlain, localTs);
        }
      }
    }
  } catch {} finally {
    _rtApplyingRemote = false;
  }
  if (changed.length > 0) {
    _scheduleRtUIRefresh(changed, source);
    return true;
  }
  return false;
}

function _encodeFirebaseSafeKey(key) {
  const h1 = _hashContext32(key, 0x811C9DC5).toString(16).padStart(8, '0');
  const h2 = _hashContext32(key + '::fbk', 0x510E527F).toString(16).padStart(8, '0');
  return `k_${h1}${h2}`;
}

const _HEAVY_ARCHIVE_KEYS = new Set([
  'lopvui.students.v9',
  'lopvui.session-history.v2'
]);

function _scheduleFirebaseCloudPush(key, plainOrEncVal, ts = Date.now()) {
  const dbUrl = getConfiguredFirebaseDbUrl();
  if (!dbUrl || !_shouldSyncKey(key)) return;
  const encVal = plainOrEncVal === null || plainOrEncVal === undefined
    ? null
    : encryptVaultPayload(decryptVaultPayload(String(plainOrEncVal), key), key);
  const encKey = encryptVaultPayload(key, 'firebase_key_meta');
  _rtPendingCloudEntries.set(key, { encKey, value: encVal, updatedAt: ts, clientId: RT_CLIENT_ID });
  if (_rtCloudPushTimer) clearTimeout(_rtCloudPushTimer);
  // Fast 120ms push for live session / account keys so concurrent devices sync in near real-time; 350ms for heavy archive keys
  const hasOnlyHeavyKeys = Array.from(_rtPendingCloudEntries.keys()).every(k => _HEAVY_ARCHIVE_KEYS.has(k));
  const delayMs = hasOnlyHeavyKeys ? 350 : 120;
  _rtCloudPushTimer = setTimeout(() => _flushFirebaseCloudPush(false), delayMs);
}

let _lastSeenCloudMetaTs = 0;
let _seenSafeKeyTimestamps = {};
let _lastSyncedDeletedCount = 0;
let _rtCloudEventSource = null;

async function _flushFirebaseCloudPush(isUnloading = false) {
  const dbUrl = getConfiguredFirebaseDbUrl();
  if (!dbUrl || !_rtPendingCloudEntries.size) return;
  if (_rtCloudPushTimer) {
    clearTimeout(_rtCloudPushTimer);
    _rtCloudPushTimer = null;
  }
  const batch = Array.from(_rtPendingCloudEntries.entries());
  _rtPendingCloudEntries.clear();

  const now = Date.now();
  const kvPayload = {};
  const metaKeyTsPatch = {};
  for (const [k, item] of batch) {
    const safeK = _encodeFirebaseSafeKey(k);
    const itemTs = item.updatedAt || now;
    kvPayload[safeK] = item;
    metaKeyTsPatch[safeK] = itemTs;
    _seenSafeKeyTimestamps[safeK] = itemTs;
  }

  const kvBody = JSON.stringify(kvPayload);
  const useKeepalive = Boolean(isUnloading || kvBody.length < 58000);

  _rtIsPushingCloud = true;
  try {
    const res = await fetch(`${dbUrl}/lopvui_cloud_v3/kv.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: kvBody,
      keepalive: useKeepalive
    });
    const delMap = _getDeletedIdsMap();
    const delCount = Object.keys(delMap).length;
    if (delCount > _lastSyncedDeletedCount) {
      _lastSyncedDeletedCount = delCount;
      const delBody = JSON.stringify(delMap);
      await fetch(`${dbUrl}/lopvui_cloud_v3/deletedIds.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: delBody,
        keepalive: delBody.length < 58000
      });
    }
    const metaBody = JSON.stringify({
      cleanSlateV35: true,
      encryptedV38: true,
      deltaSyncV392: true,
      lastUpdatedAt: now,
      lastClientId: RT_CLIENT_ID,
      deletedCount: delCount
    });
    const tsBody = JSON.stringify(metaKeyTsPatch);
    await Promise.all([
      fetch(`${dbUrl}/lopvui_cloud_v3/meta.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: metaBody,
        keepalive: true
      }),
      fetch(`${dbUrl}/lopvui_cloud_v3/meta/keyTimestamps.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: tsBody,
        keepalive: tsBody.length < 58000
      })
    ]);
    _lastSeenCloudMetaTs = Math.max(_lastSeenCloudMetaTs, now);
    if (res.ok) {
      _notifyRtStatus('realtime-cloud', now, 'cloud-pushed');
    }
  } catch {} finally {
    _rtIsPushingCloud = false;
    // If more entries were queued while pushing, flush them immediately
    if (_rtPendingCloudEntries.size > 0 && !_rtCloudPushTimer) {
      _rtCloudPushTimer = setTimeout(() => _flushFirebaseCloudPush(false), 120);
    }
  }
}

/**
 * Tải toàn bộ 1 lần duy nhất khi khởi tạo thiết bị mới hoặc nâng cấp cấu trúc meta
 */
async function _pullFullCloudSnapshotOnce(source = 'cloud-init') {
  const dbUrl = getConfiguredFirebaseDbUrl();
  if (!dbUrl) return { ok: false, reason: 'no-url' };
  try {
    const res = await fetch(`${dbUrl}/lopvui_cloud_v3.json`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    _notifyRtStatus('realtime-cloud', Date.now(), 'connected');
    if (!data || typeof data !== 'object') {
      return { ok: true, emptyCloud: true, changed: false };
    }
    const kv = data.kv || {};
    const remoteDeleted = data.deletedIds || {};
    _lastSyncedDeletedCount = Object.keys(remoteDeleted).length;
    const entries = {};
    const metaMap = {};
    const keyTimestamps = {};
    let maxTs = data.meta?.lastUpdatedAt || data.lastFullPushAt || Date.now();
    for (const [safeK, item] of Object.entries(kv)) {
      if (!item) continue;
      const itemTs = item.updatedAt || maxTs;
      keyTimestamps[safeK] = itemTs;
      _seenSafeKeyTimestamps[safeK] = itemTs;
      if (itemTs > maxTs) maxTs = itemTs;
      const resolvedKey = item.encKey
        ? decryptVaultPayload(item.encKey, 'firebase_key_meta')
        : item.rawKey;
      if (resolvedKey && _shouldSyncKey(resolvedKey)) {
        entries[resolvedKey] = item.value;
        metaMap[resolvedKey] = { updatedAt: itemTs, clientId: item.clientId || '' };
      }
    }
    _lastSeenCloudMetaTs = maxTs;
    // Nếu trên Cloud chưa có nhánh /meta (từ bản v3.8/v3.9 cũ), tự động ghi nhánh /meta nhẹ lên Cloud
    if (!data.meta || !data.meta.deltaSyncV392) {
      fetch(`${dbUrl}/lopvui_cloud_v3/meta.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanSlateV35: true,
          encryptedV38: true,
          deltaSyncV392: true,
          lastUpdatedAt: maxTs,
          lastClientId: RT_CLIENT_ID,
          deletedCount: _lastSyncedDeletedCount,
          keyTimestamps
        })
      }).catch(() => {});
    }
    const changed = _applyRtRemoteEntries(entries, source, metaMap, remoteDeleted);
    return { ok: true, emptyCloud: Object.keys(entries).length === 0, changed, count: Object.keys(entries).length };
  } catch (err) {
    return { ok: false, reason: String(err?.message || 'network-error') };
  }
}

/**
 * Đồng bộ Delta siêu tiết kiệm băng thông (v3.9.2):
 * Bước 1: Chỉ tải /lopvui_cloud_v3/meta.json (~250 bytes).
 * Bước 2: Nếu lastUpdatedAt không đổi -> DỪNG NGAY (0 KB tải thêm!).
 * Bước 3: Nếu có thay đổi -> chỉ tải đúng những safeKey có timestamp mới hơn máy hiện tại!
 */
async function pullFromFirebaseCloudNow(source = 'cloud-pull') {
  const dbUrl = getConfiguredFirebaseDbUrl();
  if (!dbUrl) return { ok: false, reason: 'no-url' };
  try {
    const metaRes = await fetch(`${dbUrl}/lopvui_cloud_v3/meta.json`, { cache: 'no-store' });
    if (!metaRes.ok) return { ok: false, reason: `HTTP ${metaRes.status}` };
    const meta = await metaRes.json();
    _notifyRtStatus('realtime-cloud', Date.now(), 'connected');

    // Nếu chưa có nhánh meta trên Cloud, chạy đồng bộ đầy đủ 1 lần để khởi tạo meta
    if (!meta || typeof meta !== 'object' || !meta.deltaSyncV392) {
      return await _pullFullCloudSnapshotOnce(source);
    }

    const remoteLastUpdated = Number(meta.lastUpdatedAt) || 0;
    const remoteKeyTsMap = meta.keyTimestamps || {};

    // Nếu không phải lần khởi động đầu tiên và không có thay đổi nào mới trên Cloud -> tốn đúng ~250 bytes!
    if (source === 'cloud-poll' && _lastSeenCloudMetaTs > 0 && remoteLastUpdated <= _lastSeenCloudMetaTs) {
      return { ok: true, emptyCloud: false, changed: false, count: 0 };
    }

    // Xác định danh sách các safeKey thực sự có thay đổi mới hơn bản máy đang giữ
    const changedSafeKeys = Object.keys(remoteKeyTsMap).filter(safeK => {
      const rTs = Number(remoteKeyTsMap[safeK]) || 0;
      const seenTs = Number(_seenSafeKeyTimestamps[safeK]) || 0;
      return rTs > seenTs;
    });

    if (!changedSafeKeys.length && _lastSeenCloudMetaTs > 0) {
      _lastSeenCloudMetaTs = Math.max(_lastSeenCloudMetaTs, remoteLastUpdated);
      return { ok: true, emptyCloud: Object.keys(remoteKeyTsMap).length === 0, changed: false, count: 0 };
    }

    // Nếu là lần đầu mở trang và có nhiều hơn 8 key cần tải -> tải 1 lần gói tổng hợp cho nhanh
    if (_lastSeenCloudMetaTs === 0 && changedSafeKeys.length > 8) {
      return await _pullFullCloudSnapshotOnce(source);
    }

    // Chỉ tải từng key vừa thay đổi (vài KB thay vì cả cục nhiều MB)
    const entries = {};
    const metaMap = {};
    await Promise.all(changedSafeKeys.map(async (safeK) => {
      try {
        const kRes = await fetch(`${dbUrl}/lopvui_cloud_v3/kv/${safeK}.json`, { cache: 'no-store' });
        if (!kRes.ok) return;
        const item = await kRes.json();
        const rTs = Number(remoteKeyTsMap[safeK]) || Date.now();
        _seenSafeKeyTimestamps[safeK] = rTs;
        if (!item) return;
        const resolvedKey = item.encKey
          ? decryptVaultPayload(item.encKey, 'firebase_key_meta')
          : item.rawKey;
        if (resolvedKey && _shouldSyncKey(resolvedKey)) {
          entries[resolvedKey] = item.value;
          metaMap[resolvedKey] = { updatedAt: item.updatedAt || rTs, clientId: item.clientId || '' };
        }
      } catch {}
    }));

    let remoteDeleted = {};
    if ((Number(meta.deletedCount) || 0) > _lastSyncedDeletedCount) {
      try {
        const delRes = await fetch(`${dbUrl}/lopvui_cloud_v3/deletedIds.json`, { cache: 'no-store' });
        if (delRes.ok) {
          remoteDeleted = (await delRes.json()) || {};
          _lastSyncedDeletedCount = Object.keys(remoteDeleted).length;
        }
      } catch {}
    }

    _lastSeenCloudMetaTs = Math.max(_lastSeenCloudMetaTs, remoteLastUpdated);
    const changed = _applyRtRemoteEntries(entries, source, metaMap, remoteDeleted);
    return { ok: true, emptyCloud: Object.keys(remoteKeyTsMap).length === 0, changed, count: Object.keys(entries).length };
  } catch (err) {
    return { ok: false, reason: String(err?.message || 'network-error') };
  }
}

async function pushAllLocalSnapshotToFirebaseCloud(markCleanSlate = true) {
  const dbUrl = getConfiguredFirebaseDbUrl();
  if (!dbUrl) return { ok: false, reason: 'no-url' };
  const kvPayload = {};
  const keyTimestamps = {};
  const tsMap = _getKeyTimestamps();
  const now = Date.now();
  let count = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && _shouldSyncKey(k)) {
        const plainVal = _readDecryptedLocal(k);
        if (plainVal !== null) {
          const safeK = _encodeFirebaseSafeKey(k);
          const kTs = tsMap[k] || now;
          kvPayload[safeK] = {
            encKey: encryptVaultPayload(k, 'firebase_key_meta'),
            value: encryptVaultPayload(plainVal, k),
            updatedAt: kTs,
            clientId: RT_CLIENT_ID
          };
          keyTimestamps[safeK] = kTs;
          _seenSafeKeyTimestamps[safeK] = kTs;
          count++;
        }
      }
    }
    const delMap = _getDeletedIdsMap();
    _lastSyncedDeletedCount = Object.keys(delMap).length;
    const res = await fetch(`${dbUrl}/lopvui_cloud_v3.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meta: {
          cleanSlateV35: true,
          encryptedV38: true,
          deltaSyncV392: true,
          lastUpdatedAt: now,
          lastClientId: RT_CLIENT_ID,
          deletedCount: _lastSyncedDeletedCount,
          keyTimestamps
        },
        kv: kvPayload,
        deletedIds: delMap,
        cleanSlateV35: true,
        encryptedV38: true,
        lastFullPushAt: now
      })
    });
    _lastSeenCloudMetaTs = now;
    if (res.ok) {
      _notifyRtStatus('realtime-cloud', now, 'full-push');
      return { ok: true, count };
    }
    return { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: String(err?.message || 'network-error') };
  }
}

function _migrateAllLocalStorageKeysToEncrypted() {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && _shouldEncryptKey(k)) {
        const raw = _nativeGetItem.call(window.localStorage, k);
        if (raw && !String(raw).startsWith('lvenc_v38$')) {
          _nativeSetItem.call(window.localStorage, k, encryptVaultPayload(raw, k));
        }
      }
    }
  } catch {}
}

// KÍCH HOẠT NGAY LẬP TỨC BỘ GIẢI MÃ / MÃ HOÁ LOCALSTORAGE TRƯỚC KHI ĐỌC BẤT KỲ DỮ LIỆU NÀO KHI KHỞI ĐỘNG
function _installStorageVaultInterceptor() {
  if (window.__lopvuiVaultStorageInstalled) return;
  window.__lopvuiVaultStorageInstalled = true;
  try {
    Storage.prototype.getItem = function(key) {
      const raw = _nativeGetItem.call(this, key);
      if (raw === null || raw === undefined) return null;
      if (this === window.localStorage && String(raw).startsWith('lvenc_v38$')) {
        return decryptVaultPayload(raw, String(key));
      }
      return raw;
    };
    Storage.prototype.setItem = function(key, value) {
      const kStr = String(key);
      let prevPlain = null;
      if (this === window.localStorage) {
        try { prevPlain = _readDecryptedLocal(kStr); } catch {}
      }
      const plainStr = decryptVaultPayload(String(value), kStr);
      const toStore = (this === window.localStorage && _shouldEncryptKey(kStr))
        ? encryptVaultPayload(plainStr, kStr)
        : String(value);
      try { _nativeSetItem.call(this, key, toStore); } catch { return; }

      if (this === window.localStorage && _shouldSyncKey(kStr) && !_rtApplyingRemote) {
        if (prevPlain !== plainStr) {
          const now = Date.now();
          _rtLastLocalWriteAt = now;
          if (prevPlain && GRANULAR_ARRAY_KEYS.has(kStr)) {
            try {
              const oldArr = JSON.parse(prevPlain);
              const newArr = JSON.parse(plainStr);
              if (Array.isArray(oldArr) && Array.isArray(newArr)) {
                const newIds = new Set(newArr.map(x => x?.id).filter(Boolean));
                const removed = oldArr.map(x => x?.id).filter(id => id && !newIds.has(id));
                if (removed.length) _recordDeletedIds(removed, now);
              }
            } catch {}
          }
          _setKeyTimestamp(kStr, now);
          if (_rtChannel) {
            try { _rtChannel.postMessage({ type: 'sync-entries', clientId: RT_CLIENT_ID, timestamp: now, entries: { [kStr]: toStore } }); } catch {}
          }
          _scheduleFirebaseCloudPush(kStr, toStore, now);
          _notifyRtStatus(getConfiguredFirebaseDbUrl() ? 'realtime-cloud' : _rtState, now, 'local-save');
        }
      }
    };
    Storage.prototype.removeItem = function(key) {
      const kStr = String(key);
      let had = false;
      try { had = _nativeGetItem.call(this, key) !== null; } catch {}
      try { _nativeRemoveItem.call(this, key); } catch { return; }
      if (this === window.localStorage && _shouldSyncKey(kStr) && !_rtApplyingRemote && had) {
        const now = Date.now();
        _rtLastLocalWriteAt = now;
        _setKeyTimestamp(kStr, now);
        if (_rtChannel) {
          try { _rtChannel.postMessage({ type: 'sync-entries', clientId: RT_CLIENT_ID, timestamp: now, entries: { [kStr]: null } }); } catch {}
        }
        _scheduleFirebaseCloudPush(kStr, null, now);
        _notifyRtStatus(getConfiguredFirebaseDbUrl() ? 'realtime-cloud' : _rtState, now, 'local-save');
      }
    };
  } catch {}
}
_installStorageVaultInterceptor();

function initRealtimeSync(onSyncCallback) {
  if (typeof onSyncCallback === 'function') _rtSyncListeners.add(onSyncCallback);
  if (!window.__lopvuiRtInitV34) {
    window.__lopvuiRtInitV34 = true;
    _installStorageVaultInterceptor();
    _migrateAllLocalStorageKeysToEncrypted();

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        _rtChannel = new BroadcastChannel(RT_CHANNEL_NAME);
        _rtChannel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.clientId === RT_CLIENT_ID) return;
          if (data.type === 'sync-entries' && data.entries) {
            _applyRtRemoteEntries(data.entries, 'broadcast-tab');
          } else if (data.type === 'force-refresh-all') {
            _scheduleRtUIRefresh(['*'], 'broadcast-tab');
          }
        };
      } catch {}
    }

    window.addEventListener('storage', (event) => {
      if (_rtApplyingRemote) return;
      if (!event.key) {
        _scheduleRtUIRefresh(['*'], 'storage-event');
        return;
      }
      if (!_shouldSyncKey(event.key)) return;
      _scheduleRtUIRefresh([event.key], 'storage-event');
    });

    const _connectFirebaseMetaSSE = () => {
      const dbUrl = getConfiguredFirebaseDbUrl();
      if (!dbUrl || typeof EventSource === 'undefined') return;
      try {
        if (_rtCloudEventSource) {
          try { _rtCloudEventSource.close(); } catch {}
          _rtCloudEventSource = null;
        }
        const es = new EventSource(`${dbUrl}/lopvui_cloud_v3/meta.json`);
        _rtCloudEventSource = es;
        const handleMetaStream = (ev) => {
          try {
            if (!ev || !ev.data) return;
            const parsed = JSON.parse(ev.data);
            const payload = parsed?.data;
            if (!payload || typeof payload !== 'object') return;
            const remoteClient = payload.lastClientId || '';
            const remoteUpdated = Number(payload.lastUpdatedAt) || 0;
            if (remoteClient === RT_CLIENT_ID && remoteUpdated <= _lastSeenCloudMetaTs) return;
            if (remoteUpdated > _lastSeenCloudMetaTs || remoteClient !== RT_CLIENT_ID) {
              pullFromFirebaseCloudNow('cloud-sse');
            }
          } catch {}
        };
        es.addEventListener('put', handleMetaStream);
        es.addEventListener('patch', handleMetaStream);
        es.onerror = () => {
          try { es.close(); } catch {}
          _rtCloudEventSource = null;
        };
      } catch {}
    };

    if (getConfiguredFirebaseDbUrl()) {
      _notifyRtStatus('realtime-cloud', Date.now(), 'init');
      (async () => {
        const res = await pullFromFirebaseCloudNow('cloud-init');
        if (res.ok && res.emptyCloud) {
          await pushAllLocalSnapshotToFirebaseCloud(true);
        }
        _connectFirebaseMetaSSE();
      })();
    }

    let _lastUserActivityAt = Date.now();
    let _lastCloudPollAt = Date.now();
    const _markUserActive = () => {
      const now = Date.now();
      const wasIdle = (now - _lastUserActivityAt) > 10000;
      _lastUserActivityAt = now;
      if (wasIdle && (now - _lastCloudPollAt > 3000) && getConfiguredFirebaseDbUrl() && !document.hidden) {
        _lastCloudPollAt = now;
        pullFromFirebaseCloudNow('cloud-poll');
      }
    };
    ['pointerdown', 'keydown', 'touchstart', 'focus'].forEach(evt => {
      window.addEventListener(evt, _markUserActive, { passive: true });
    });

    // Khi Refresh (beforeunload), đóng trang (pagehide) hoặc ẩn tab: đẩy ngay lập tức với cờ keepalive=true để không bao giờ mất dữ liệu khi F5
    window.addEventListener('beforeunload', () => {
      if (_rtPendingCloudEntries.size > 0) _flushFirebaseCloudPush(true);
    });
    window.addEventListener('pagehide', () => {
      if (_rtPendingCloudEntries.size > 0) _flushFirebaseCloudPush(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (_rtPendingCloudEntries.size > 0) _flushFirebaseCloudPush(true);
      } else if (getConfiguredFirebaseDbUrl()) {
        _lastUserActivityAt = Date.now();
        _lastCloudPollAt = Date.now();
        pullFromFirebaseCloudNow('cloud-poll');
        if (!_rtCloudEventSource || _rtCloudEventSource.readyState === 2) {
          _connectFirebaseMetaSSE();
        }
      }
    });

    // Adaptive Cloud Polling: 2s khi đang mở ca học (hoặc 5s khi đã có kết nối SSE), giảm xuống 16s–45s khi máy chờ (idle)
    setInterval(() => {
      if (getConfiguredFirebaseDbUrl()) {
        if (typeof document !== 'undefined' && document.hidden) return;
        const now = Date.now();
        if (_rtIsPushingCloud) return;
        if (_rtPendingCloudEntries.size > 0) {
          _flushFirebaseCloudPush(false);
        }
        const sseHealthy = Boolean(_rtCloudEventSource && _rtCloudEventSource.readyState === 1);
        if (!_rtCloudEventSource || _rtCloudEventSource.readyState === 2) {
          _connectFirebaseMetaSSE();
        }
        const idleMs = now - _lastUserActivityAt;
        const activeInterval = sseHealthy ? 4500 : 2000;
        const minInterval = idleMs < 180000 ? activeInterval : (idleMs < 900000 ? 16000 : 45000);
        if (now - _lastCloudPollAt < minInterval - 150) return;
        _lastCloudPollAt = now;
        pullFromFirebaseCloudNow('cloud-poll');
      }
    }, 2000);

    // Tự động dọn dẹp các key nháp theo ngày của những ca đã đóng quá 45 ngày (đã lưu trong session-history.v2)
    setTimeout(() => {
      try { cleanupStaleDailyScratchKeys(45, false); } catch {}
    }, 3500);
  }
  return {
    clientId: RT_CLIENT_ID,
    forceSyncNow,
    getConfiguredFirebaseDbUrl,
    setConfiguredFirebaseDbUrl,
    pullFromFirebaseCloudNow,
    pushAllLocalSnapshotToFirebaseCloud,
    onStatusChange: (cb) => {
      _rtStatusListeners.add(cb);
      cb({ state: getConfiguredFirebaseDbUrl() ? 'realtime-cloud' : _rtState, lastSyncTime: _rtLastSyncTime, clientId: RT_CLIENT_ID });
    }
  };
}

async function forceSyncNow(reason = 'manual-click') {
  if (getConfiguredFirebaseDbUrl()) {
    await pullFromFirebaseCloudNow(reason);
  }
  _scheduleRtUIRefresh(['*'], reason);
}
// Mỗi bàn chứa danh sách học sinh riêng; kéo thả chỉ sắp xếp trong bàn đích.
const baseLayout=[
  {id:'aisle-1',desks:[{id:'d11',seats:2,dividerAfter:false},{id:'d12',seats:2,dividerAfter:true},{id:'d13',seats:2,dividerAfter:false}]},
  {id:'aisle-2',desks:[{id:'d21',seats:2,dividerAfter:false},{id:'d22',seats:2,dividerAfter:true},{id:'d23',seats:2,dividerAfter:false}]},
  {id:'aisle-3',desks:[{id:'d31',seats:2,dividerAfter:false},{id:'d32',seats:2,dividerAfter:false}]}
];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
// v3.5+ Clean-Slate & v3.8 Encryption Initialization
(function ensureCleanSlateV35() {
  try {
    if (_nativeGetItem.call(localStorage, 'lopvui.clean-slate.v35') !== '1') {
      const savedDriveCfg = _readDecryptedLocal('lopvui.google-drive-photo-config.v1');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lopvui.')) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => _nativeRemoveItem.call(localStorage, k));
      if (savedDriveCfg) _writeEncryptedLocal('lopvui.google-drive-photo-config.v1', savedDriveCfg);
      _writeEncryptedLocal('lopvui.class-catalog.v1', '[]');
      _writeEncryptedLocal('lopvui.students.v9', '[]');
      _writeEncryptedLocal('lopvui.makeup-students.v1', '[]');
      _writeEncryptedLocal('lopvui.session-history.v2', '[]');
      _writeEncryptedLocal('lopvui.tutoring-sessions.v1', '[]');
      _writeEncryptedLocal('lopvui.room-templates.v1', '[]');
      _writeEncryptedLocal('lopvui.class-session-changes.v1', '{}');
      _nativeSetItem.call(localStorage, 'lopvui.explicit-logout.v1', '1');
      _nativeSetItem.call(localStorage, 'lopvui.clean-slate.v35', '1');
    } else {
      _migrateAllLocalStorageKeysToEncrypted();
    }
  } catch {}
})();
let masterData=loadMasterData();
let sessionChanges=loadClassSessionChanges();
let signedInAccount=read('lopvui.signed-in-account.v1',{employeeId:'employee-ta-001',role:'assistant'});
let classCatalog=loadClassCatalog(localStorage,masterData);
const defaultClassId='class-math-8a-algebra';
// Undo history & Teacher view state
let isTeacherView = false;
let isSeatingEditMode = false;
function updateSeatingEditBtn() {
  const btn = $('#toggle-seating-edit-btn');
  if (!btn) return;
  btn.classList.toggle('active', isSeatingEditMode);
  if (isSeatingEditMode) {
    btn.textContent = 'Sửa sơ đồ: BẬT';
    btn.style.background = '#eaf5ec';
    btn.style.color = '#1f5f33';
    btn.style.borderColor = '#86c292';
  } else {
    btn.textContent = 'Sửa sơ đồ: TẮT';
    btn.style.background = '#f9fafb';
    btn.style.color = '#6b7280';
    btn.style.borderColor = '#d1d5db';
  }
}
const seatingUndoStack = [];
function pushSeatingUndo() {
  if (seatingUndoStack.length > 25) seatingUndoStack.shift();
  seatingUndoStack.push({
    deskItems: JSON.parse(JSON.stringify(deskItems)),
    lateQueue: [...lateQueue],
    studentsSnapshot: JSON.parse(JSON.stringify(students)),
    makeupStudentsSnapshot: JSON.parse(JSON.stringify(makeupStudents)),
    studentsHomework: students.map(s => ({ id: s.id, homework: s.homework ? { ...s.homework } : null }))
  });
  updateUndoButton();
}
function updateUndoButton() {
  const btn = $('#undo-layout-button');
  if (btn) btn.disabled = seatingUndoStack.length === 0;
}
function currentActorInfo() {
  const acc = window.__featuresApp?.getSignedInAccount ? window.__featuresApp.getSignedInAccount() : null;
  const empId = acc?.employeeId || currentEmployeeId || '';
  const emp = (masterData.employees || []).find(e => e && e.id === empId) || null;
  const role = emp?.role || acc?.role || selectedRole() || 'assistant';
  const name = emp?.name || acc?.name || currentStaffName() || 'Nhân sự';
  const code = emp?.code || acc?.code || '';
  return { id: empId, code, name, role };
}

let _activeAdminLogSession = { classId: 'all', date: 'all' };

function logAdminSessionAction(action, detail = '', category = 'session', dedupeKey = '', customClassId = null, customDate = null) {
  try {
    const targetClassId = customClassId || CURRENT_CLASS_ID || '_system_';
    const targetDate = customDate || checklistDate || '_class_';
    if (!targetClassId || !targetDate) return;
    const actor = currentActorInfo();
    if (typeof appendSessionAdminAuditLog === 'function') {
      appendSessionAdminAuditLog({
        classId: targetClassId,
        date: targetDate,
        actor,
        category,
        action,
        detail,
        dedupeKey
      }, localStorage);
      // Nếu là hành động cấp quản lý ca (sửa ca, xoá ca, mở/đóng ca) mà có ngày cụ thể, ghi đồng thời vào mục quản lý lớp (_class_) để dễ tra cứu tổng hợp
      if (targetDate !== '_class_' && (category === 'class' || action.startsWith('Xoá ca') || action.startsWith('Chỉnh sửa thông tin ca') || action.startsWith('Tạo bổ sung ca'))) {
        appendSessionAdminAuditLog({
          classId: targetClassId,
          date: '_class_',
          actor,
          category: 'class',
          action,
          detail: `Ca ngày ${formatDateDDMMYYYY(targetDate)} · ${detail}`,
          dedupeKey: dedupeKey ? `${dedupeKey}-cls` : ''
        }, localStorage);
      }
    }
    updateAdminLogButtonVisibilityAndCount();
    const dlg = document.getElementById('session-admin-log-dialog');
    if (dlg && dlg.open) {
      renderSessionAdminLogDialogContent();
    }
    const mgmtPanel = document.getElementById('mgmt-panel-admin-log');
    if (mgmtPanel && !mgmtPanel.hidden) {
      renderManagementAdminLogPanel();
    }
  } catch (err) {
    console.warn('Admin audit log error:', err);
  }
}
window.__logAdminSessionAction = logAdminSessionAction;

function formatDateDDMMYYYY(dateStr) {
  const s = String(dateStr || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s || '—';
}

function formatTimestampFullVN(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

function updateAdminLogButtonVisibilityAndCount() {
  const isAdmin = selectedRole() === 'admin';
  const mgmtTab = document.getElementById('mgmt-tab-admin-log');
  if (mgmtTab) {
    mgmtTab.hidden = !isAdmin;
    mgmtTab.style.display = isAdmin ? '' : 'none';
  }
  if (!isAdmin) {
    const mgmtPanel = document.getElementById('mgmt-panel-admin-log');
    if (mgmtPanel && !mgmtPanel.hidden) {
      mgmtPanel.hidden = true;
      document.getElementById('mgmt-tab-classes')?.click();
    }
  }
}
window.__updateAdminLogBtnVisibility = updateAdminLogButtonVisibilityAndCount;

const ADMIN_LOG_CATEGORY_LABELS = {
  class: 'Cài đặt Lớp & Lịch học',
  session: 'Quản lý Ca học',
  attendance: 'Điểm danh & Chỗ ngồi',
  homework: 'Bài tập về nhà',
  score: 'Điểm số',
  student: 'Hồ sơ Học sinh',
  checklist: 'Checklist & Bàn giao',
  layout: 'Sơ đồ Bàn ghế'
};

const ADMIN_LOG_ROLE_LABELS = {
  admin: 'Admin',
  office: 'Văn phòng',
  teacher: 'Giáo viên',
  assistant: 'Trợ giảng'
};

function buildCombinedAdminAuditLogs(classId, date) {
  const rawLogs = typeof loadSessionAdminAuditLogs === 'function'
    ? loadSessionAdminAuditLogs(classId, date, localStorage)
    : [];
  if (date === '_class_') {
    return [...rawLogs].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
  }
  const comm = loadClassCommunication(classId, date) || { activities: [], messages: [] };
  const existingKeys = new Set(rawLogs.map(item => `${Math.floor((Number(item.timestamp) || 0) / 5000)}_${item.action}`));
  const legacyItems = [];

  (comm.activities || comm.activity || []).forEach(act => {
    const ts = typeof act.createdAt === 'number' ? act.createdAt : (Date.parse(act.createdAt) || Date.now());
    const text = String(act.text || '').trim();
    if (!text) return;
    const approxKey = `${Math.floor(ts / 5000)}_${text}`;
    if (existingKeys.has(approxKey)) return;
    let inferredName = 'Nhân sự ca trực';
    let inferredCode = '';
    let inferredRole = 'assistant';
    for (const emp of (masterData.employees || [])) {
      if (emp?.name && text.startsWith(emp.name)) {
        inferredName = emp.name;
        inferredCode = emp.code || '';
        inferredRole = emp.role || 'assistant';
        break;
      }
    }
    legacyItems.push({
      id: act.id || `act-${ts}`,
      classId,
      date,
      timestamp: ts,
      timeStr: new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actorId: '',
      actorCode: inferredCode,
      actorName: inferredName,
      actorRole: inferredRole,
      category: act.kind === 'homework' ? 'homework' : act.kind === 'checklist' || act.kind === 'handover' ? 'checklist' : 'attendance',
      action: text,
      detail: ''
    });
  });

  return [...rawLogs, ...legacyItems].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

function collectAllAdminAuditStructure() {
  // Discover all (classId, date) pairs from classCatalog, sessionHistory, and localStorage audit/communication keys
  const classMap = new Map();
  for (const c of (classCatalog || [])) {
    if (c && c.id) {
      classMap.set(c.id, { id: c.id, name: c.name || c.code || c.id, code: c.code || c.id, sessions: new Set(['_class_']) });
    }
  }
  const allHist = loadSessionHistory() || [];
  for (const s of allHist) {
    if (!s || !s.classId) continue;
    if (!classMap.has(s.classId)) {
      classMap.set(s.classId, { id: s.classId, name: s.className || s.classCode || s.classId, code: s.classCode || s.classId, sessions: new Set(['_class_']) });
    }
    if (s.date) classMap.get(s.classId).sessions.add(s.date);
  }

  const auditPrefix = 'lopvui.admin-audit-log.v1.';
  const commPrefix = 'lopvui.class-communication.v1.';
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(auditPrefix) || k.startsWith(commPrefix)) {
      const rest = k.startsWith(auditPrefix) ? k.slice(auditPrefix.length) : k.slice(commPrefix.length);
      const lastDot = rest.lastIndexOf('.');
      if (lastDot <= 0) continue;
      const cid = rest.slice(0, lastDot);
      const dt = rest.slice(lastDot + 1);
      if (!cid || !dt) continue;
      if (!classMap.has(cid)) {
        const resolved = resolveClass(cid);
        classMap.set(cid, {
          id: cid,
          name: resolved?.name || cid,
          code: resolved?.code || cid,
          sessions: new Set(['_class_'])
        });
      }
      classMap.get(cid).sessions.add(dt);
    }
  }
  return { classMap, allHist };
}

function renderAdminLogTextToElements({
  classSelectEl,
  sessionSelectEl,
  accountSelectEl,
  searchInputEl,
  chipsEl,
  textOutputEl,
  countEl,
  preferredClassId = null,
  preferredDate = null
}) {
  const { classMap, allHist } = collectAllAdminAuditStructure();
  const classesList = Array.from(classMap.values());

  // 1. Populate Class Select
  if (classSelectEl) {
    const curClassVal = preferredClassId !== null ? preferredClassId : (classSelectEl.value || 'all');
    classSelectEl.innerHTML = `<option value="all">📚 Tất cả các lớp (${classesList.length} lớp)</option>` +
      classesList.map(c => `<option value="${escapeHtml(c.id)}">🏫 ${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('');
    if ([...classSelectEl.options].some(o => o.value === curClassVal)) {
      classSelectEl.value = curClassVal;
    } else {
      classSelectEl.value = 'all';
    }
  }
  const selectedClassId = classSelectEl?.value || 'all';

  // 2. Populate Session Select based on selectedClassId
  if (sessionSelectEl) {
    const curSessVal = preferredDate !== null ? preferredDate : (sessionSelectEl.value || 'all');
    const sessionDatesSet = new Set();
    if (selectedClassId === 'all') {
      classesList.forEach(c => c.sessions.forEach(d => { if (d !== '_class_') sessionDatesSet.add(d); }));
    } else if (classMap.has(selectedClassId)) {
      classMap.get(selectedClassId).sessions.forEach(d => { if (d !== '_class_') sessionDatesSet.add(d); });
    }
    const sortedDates = Array.from(sessionDatesSet).sort((a, b) => String(b).localeCompare(String(a)));
    sessionSelectEl.innerHTML =
      `<option value="all">🗓 Tất cả các ca học & Thao tác lớp</option>` +
      `<option value="_class_">⚙ Chỉ thao tác Cài đặt lớp / Edit ca / Xoá ca</option>` +
      sortedDates.map(d => {
        const histMatch = selectedClassId !== 'all'
          ? allHist.find(s => s.classId === selectedClassId && s.date === d)
          : null;
        const lesson = histMatch?.lessonTitle ? ` · ${histMatch.lessonTitle}` : '';
        return `<option value="${escapeHtml(d)}">📅 Ca ngày ${escapeHtml(formatDateDDMMYYYY(d))}${escapeHtml(lesson)}</option>`;
      }).join('');
    if ([...sessionSelectEl.options].some(o => o.value === curSessVal)) {
      sessionSelectEl.value = curSessVal;
    } else {
      sessionSelectEl.value = 'all';
    }
  }
  const selectedSession = sessionSelectEl?.value || 'all';

  // 3. Gather all matching logs grouped by class -> session
  const targetClasses = selectedClassId === 'all'
    ? classesList
    : (classMap.has(selectedClassId) ? [classMap.get(selectedClassId)] : []);

  const allCollectedEntries = [];
  const structuredByClass = [];

  for (const clsObj of targetClasses) {
    const datesToRead = [];
    if (selectedSession === 'all') {
      if (clsObj.sessions.has('_class_')) datesToRead.push('_class_');
      const otherDates = Array.from(clsObj.sessions).filter(d => d !== '_class_').sort((a, b) => String(b).localeCompare(String(a)));
      datesToRead.push(...otherDates);
    } else {
      datesToRead.push(selectedSession);
    }

    const sessionBlocks = [];
    for (const dt of datesToRead) {
      const items = buildCombinedAdminAuditLogs(clsObj.id, dt);
      if (items.length > 0) {
        items.forEach(it => allCollectedEntries.push(it));
        sessionBlocks.push({ date: dt, items });
      }
    }
    if (sessionBlocks.length > 0) {
      structuredByClass.push({ cls: clsObj, sessionBlocks });
    }
  }

  // 4. Compute Account Stats & Populate Account Filter
  const accountStats = new Map();
  allCollectedEntries.forEach(item => {
    const key = item.actorCode ? `${item.actorName} (${item.actorCode})` : (item.actorName || 'Không rõ');
    const prev = accountStats.get(key) || { key, name: item.actorName || 'Không rõ', code: item.actorCode || '', role: item.actorRole || 'assistant', count: 0 };
    prev.count++;
    accountStats.set(key, prev);
  });

  if (accountSelectEl) {
    const prevAcc = accountSelectEl.value || 'all';
    accountSelectEl.innerHTML = `<option value="all">👤 Tất cả tài khoản (${allCollectedEntries.length})</option>` +
      Array.from(accountStats.values()).map(acc => {
        const rLabel = ADMIN_LOG_ROLE_LABELS[acc.role] || acc.role;
        const text = acc.code ? `${acc.name} · #${acc.code} (${rLabel}) [${acc.count}]` : `${acc.name} (${rLabel}) [${acc.count}]`;
        return `<option value="${escapeHtml(acc.key)}">${escapeHtml(text)}</option>`;
      }).join('');
    if ([...accountSelectEl.options].some(o => o.value === prevAcc)) {
      accountSelectEl.value = prevAcc;
    } else {
      accountSelectEl.value = 'all';
    }
  }

  const selectedAcc = accountSelectEl?.value || 'all';
  const query = normalizeSearchText(searchInputEl?.value || '');

  if (chipsEl) {
    if (!accountStats.size) {
      chipsEl.innerHTML = `<span style="font-size:12.5px; color:#64748b;">Chưa có thao tác nào được ghi nhận.</span>`;
    } else {
      chipsEl.innerHTML = `<button type="button" class="admin-log-acc-chip ${selectedAcc === 'all' ? 'active' : ''}" data-admin-log-acc-chip="all">Tất cả tài khoản <span class="chip-count">${allCollectedEntries.length}</span></button>` +
        Array.from(accountStats.values()).map(acc => {
          const rLabel = ADMIN_LOG_ROLE_LABELS[acc.role] || acc.role;
          const display = acc.code ? `${acc.name} (#${acc.code} · ${rLabel})` : `${acc.name} (${rLabel})`;
          return `<button type="button" class="admin-log-acc-chip ${selectedAcc === acc.key ? 'active' : ''}" data-admin-log-acc-chip="${escapeHtml(acc.key)}">👤 ${escapeHtml(display)} <span class="chip-count">${acc.count}</span></button>`;
        }).join('');
      chipsEl.querySelectorAll('[data-admin-log-acc-chip]').forEach(chip => {
        chip.onclick = () => {
          if (accountSelectEl) {
            accountSelectEl.value = chip.dataset.adminLogAccChip;
            renderAdminLogTextToElements({ classSelectEl, sessionSelectEl, accountSelectEl, searchInputEl, chipsEl, textOutputEl, countEl });
          }
        };
      });
    }
  }

  // 5. Build Plain Text Output grouped by Class and each Session in the Class
  const textLines = [];
  let totalFiltered = 0;

  for (const group of structuredByClass) {
    const classBlocksText = [];
    for (const block of group.sessionBlocks) {
      const matchedItems = block.items.filter(item => {
        const accKey = item.actorCode ? `${item.actorName} (${item.actorCode})` : (item.actorName || 'Không rõ');
        if (selectedAcc !== 'all' && accKey !== selectedAcc) return false;
        if (query) {
          const hay = normalizeSearchText(`${item.actorName} ${item.actorCode} ${item.action} ${item.detail} ${ADMIN_LOG_CATEGORY_LABELS[item.category] || ''}`);
          if (!hay.includes(query)) return false;
        }
        return true;
      });
      if (!matchedItems.length) continue;
      totalFiltered += matchedItems.length;

      let sessionHeader = '';
      if (block.date === '_class_') {
        sessionHeader = `--- [QUẢN LÝ CÀI ĐẶT LỚP · EDIT THÔNG TIN LỚP / EDIT CA / XOÁ CA] (${matchedItems.length} thao tác) ---`;
      } else {
        const histRec = allHist.find(s => s.classId === group.cls.id && s.date === block.date);
        const lessonInfo = histRec?.lessonTitle ? ` · Bài học: ${histRec.lessonTitle}` : '';
        const statusInfo = histRec ? (histRec.status === 'closed' ? ' · [Đã đóng ca]' : ' · [Đang mở]') : ' · [Ca đã xoá hoặc chưa lưu lịch sử]';
        sessionHeader = `--- [CA HỌC NGÀY ${formatDateDDMMYYYY(block.date)}${lessonInfo}${statusInfo}] (${matchedItems.length} thao tác) ---`;
      }

      const itemLines = matchedItems.map(item => {
        const fullTime = formatTimestampFullVN(item.timestamp);
        const roleLabel = ADMIN_LOG_ROLE_LABELS[item.actorRole] || item.actorRole || 'Nhân sự';
        const actorTag = item.actorCode
          ? `${item.actorName || 'Không rõ'} (#${item.actorCode} · ${roleLabel})`
          : `${item.actorName || 'Không rõ'} (${roleLabel})`;
        const catLabel = ADMIN_LOG_CATEGORY_LABELS[item.category] || item.category || 'Thao tác';
        const detailPart = item.detail ? ` — ${item.detail}` : '';
        return `  • [${fullTime}] [${actorTag}] [${catLabel}] ${item.action || ''}${detailPart}`;
      });

      classBlocksText.push(`${sessionHeader}\n${itemLines.join('\n')}`);
    }

    if (classBlocksText.length > 0) {
      textLines.push(
        `================================================================================\n` +
        `LỚP: ${group.cls.name} (MÃ LỚP: ${group.cls.code})\n` +
        `================================================================================\n` +
        classBlocksText.join('\n\n')
      );
    }
  }

  const finalPlainText = textLines.length
    ? textLines.join('\n\n\n')
    : 'Chưa có dữ liệu nhật ký thao tác nào khớp với bộ lọc hiện tại.';

  if (textOutputEl) {
    textOutputEl.textContent = finalPlainText;
  }
  if (countEl) {
    countEl.textContent = `🛡 ${totalFiltered} / ${allCollectedEntries.length} thao tác (${accountStats.size} tài khoản)`;
  }
  return finalPlainText;
}

function renderManagementAdminLogPanel(preferredClassId = null, preferredDate = null) {
  if (selectedRole() !== 'admin') return '';
  return renderAdminLogTextToElements({
    classSelectEl: document.getElementById('mgmt-admin-log-class-filter'),
    sessionSelectEl: document.getElementById('mgmt-admin-log-session-filter'),
    accountSelectEl: document.getElementById('mgmt-admin-log-account-filter'),
    searchInputEl: document.getElementById('mgmt-admin-log-search-input'),
    chipsEl: document.getElementById('mgmt-admin-log-account-chips'),
    textOutputEl: document.getElementById('mgmt-admin-log-text-output'),
    countEl: document.getElementById('mgmt-admin-log-total-badge'),
    preferredClassId,
    preferredDate
  });
}
window.__renderManagementAdminLogPanel = renderManagementAdminLogPanel;

function renderSessionAdminLogDialogContent(preferredClassId = null, preferredDate = null) {
  if (selectedRole() !== 'admin') return '';
  const cId = preferredClassId !== null ? preferredClassId : (_activeAdminLogSession.classId || 'all');
  const dt = preferredDate !== null ? preferredDate : (_activeAdminLogSession.date || 'all');
  return renderAdminLogTextToElements({
    classSelectEl: document.getElementById('admin-log-class-filter'),
    sessionSelectEl: document.getElementById('admin-log-session-filter'),
    accountSelectEl: document.getElementById('admin-log-account-filter'),
    searchInputEl: document.getElementById('admin-log-search-input'),
    chipsEl: document.getElementById('admin-log-account-summary'),
    textOutputEl: document.getElementById('admin-log-text-output'),
    countEl: document.getElementById('admin-log-footer-count'),
    preferredClassId: cId,
    preferredDate: dt
  });
}

function openSessionAdminLogDialog(classId = null, date = null) {
  if (selectedRole() !== 'admin') {
    toast('Chỉ tài khoản Admin mới có quyền xem Nhật ký Admin Log.');
    return;
  }
  _activeAdminLogSession = {
    classId: classId || 'all',
    date: date || 'all'
  };
  const dlg = document.getElementById('session-admin-log-dialog');
  if (!dlg) return;
  renderSessionAdminLogDialogContent(_activeAdminLogSession.classId, _activeAdminLogSession.date);
  if (!dlg.open) dlg.showModal();
}
window.__openSessionAdminLogDialog = openSessionAdminLogDialog;

function copyTextToClipboardWithToast(text, label = 'Nhật ký Admin Log') {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      toast(`✓ Đã copy toàn bộ nội dung ${label} vào bộ nhớ tạm.`);
    }).catch(() => {
      toast(`Đã chuẩn bị nội dung ${label}.`);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(`✓ Đã copy toàn bộ nội dung ${label}.`); } catch {}
    ta.remove();
  }
}

function downloadPlainTextFile(text, filename = 'Admin-Log.txt') {
  const blob = new Blob([text || ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 250);
  toast(`✓ Đã tải xuống file ${filename}`);
}

function undoSeating() {
  if (!seatingUndoStack.length) {
    toast('Không có thao tác nào để hoàn tác.');
    return;
  }
  const prev = seatingUndoStack.pop();
  deskItems = prev.deskItems;
  lateQueue = prev.lateQueue;
  if (Array.isArray(prev.studentsSnapshot)) {
    students = prev.studentsSnapshot;
  }
  if (Array.isArray(prev.makeupStudentsSnapshot)) {
    makeupStudents = prev.makeupStudentsSnapshot;
  }
  if (Array.isArray(prev.studentsHomework)) {
    prev.studentsHomework.forEach(sh => {
      const s = studentById(sh.id);
      if (s) s.homework = sh.homework;
    });
  }
  save();
  render();
  updateUndoButton();
  logAdminSessionAction('Hoàn tác sơ đồ lớp (Undo)', 'Khôi phục trạng thái bàn ghế & điểm danh trước đó', 'layout');
  toast('Đã hoàn tác thao tác trên sơ đồ lớp.');
}

let currentEmployeeId=signedInAccount?.employeeId||'employee-ta-001';
const requestedClassId=new URLSearchParams(location.search).get('class');
let CURRENT_CLASS_ID=classCatalog.some(item=>item.id===requestedClassId)?requestedClassId:defaultClassId;
const EMPTY_CLASS_FALLBACK = {
  id: 'empty-class',
  code: 'CHUA_CO_LOP',
  name: 'Chưa có lớp học',
  subject: 'Toán',
  grade: '2013',
  room: 'Chưa xếp phòng',
  weekday: 1,
  startTime: '15:30',
  endTime: '17:00',
  teacherIds: [],
  assistantIds: [],
  officeIds: [],
  teacherName: '—',
  assistantName: '—',
  defaultLayout: baseLayout,
  defaultChecklist: { startItems: ['Lau bảng', 'Bật đèn và kiểm tra quạt/điều hòa', 'Chuẩn bị tài liệu và bài tập'], endItems: [] },
  defaultNotifications: []
};
const activeClassConfig=()=>classCatalog.find(item=>item.id===CURRENT_CLASS_ID)||classCatalog[0]||EMPTY_CLASS_FALLBACK;
let configClass=activeClassConfig();
const loadedStudentRecords=loadStudentRecords(CURRENT_CLASS_ID);
let students=loadedStudentRecords.students;
let makeupStudents=loadedStudentRecords.makeupStudents;
let lateQueue=[];
const requestedSessionDate=new URLSearchParams(location.search).get('date');
let checklistDate=/^\d{4}-\d{2}-\d{2}$/.test(requestedSessionDate||'')?requestedSessionDate:new Date().toLocaleDateString('sv-SE');
const legacySessionFallback=CURRENT_CLASS_ID===defaultClassId&&checklistDate===new Date().toLocaleDateString('sv-SE');
let layout=read(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`,legacySessionFallback?read('lopvui.layout.v5',configClass?.defaultLayout||baseLayout):(configClass?.defaultLayout||baseLayout));
lateQueue=read(`lopvui.late-queue.v6.${CURRENT_CLASS_ID}.${checklistDate}`,legacySessionFallback?read('lopvui.late-queue.v6',[]):[]);
const getChecklistKey=()=>`lopvui.checklist.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
const getAttendanceNotesKey=()=>`lopvui.attendance-notes.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
let attendanceNotes=read(getAttendanceNotesKey(),{});
let classCommunication=loadClassCommunication(CURRENT_CLASS_ID,checklistDate);
const defaultChecklistItems=(configClass?.defaultChecklist?.startItems||['Lau bảng','Bật đèn và kiểm tra quạt/điều hòa','Chuẩn bị tài liệu và bài tập','Kiểm tra bàn ghế, cửa sổ và phòng học']).map((label,index)=>({id:`default-${index+1}`,label,done:false}));
const defaultEndChecklistItems=(configClass?.defaultChecklist?.endItems||[]).map((label,index)=>({id:`end-default-${index+1}`,label,done:false}));
function defaultChecklist() {
  return {
    items: defaultChecklistItems.map(item => ({ ...item, done: false })),
    endItems: defaultEndChecklistItems.map(item => ({ ...item, done: false })),
    classNote: '',
    parentGeneralNote: '',
    tests: {},
    testScores: {},
    testCollectionMode: false,
    handover: null,
    workStart: null
  };
}
const legacyChecklist= CURRENT_CLASS_ID===defaultClassId?read(`lopvui.checklist.v1.${checklistDate}`,null):null;
let checklist=read(getChecklistKey(),legacyChecklist||{items:defaultChecklistItems.map(item=>({...item,done:false})),classNote:'',tests:{},testScores:{},testCollectionMode:false,handover:null,workStart:null});
checklist.testScores = checklist.testScores || {};
checklist.items=Array.isArray(checklist.items)?checklist.items:defaultChecklistItems.map(item=>({...item,done:false}));checklist.tests=checklist.tests||{};
checklist.endItems=Array.isArray(checklist.endItems)?checklist.endItems:defaultEndChecklistItems.map(item=>({...item}));
function reminderScheduleText(rule){const anchor=rule.anchor==='end'?'Giờ kết thúc':'Giờ bắt đầu',offset=Number(rule.offsetMinutes)||0;return anchor+(offset?` ${offset>0?'+':''}${offset} phút`:'');}
function mergeReminderItems(items,anchor){for(const rule of configClass?.defaultNotifications||[]){if((rule.anchor==='end'?'end':'start')!==anchor)continue;const id='reminder-'+rule.id,label='Reminder: '+(rule.title||'Nhắc việc')+' · '+reminderScheduleText(rule);let item=items.find(entry=>entry.id===id);if(!item){item={id,label,done:false,kind:'reminder',reminderRuleId:rule.id};items.push(item);}item.label=label;item.kind='reminder';item.reminderRuleId=rule.id;}}
mergeReminderItems(checklist.items,'start');mergeReminderItems(checklist.endItems,'end');
checklist.testRequired=Boolean(checklist.testRequired);
const legacy=legacySessionFallback?read('lopvui.session-seats.v6',null):null;
function migrateSeats(){const grouped={};for(const aisle of layout)for(const desk of aisle.desks)grouped[desk.id]=[];if(Array.isArray(legacy)){const keys=layout.flatMap(a=>a.desks.flatMap(d=>Array.from({length:d.seats||2},()=>d.id)));legacy.forEach((entry,i)=>{if(entry&&keys[i])grouped[keys[i]].push(entry);});}return grouped;}
let deskItems=read(`lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}`,legacySessionFallback?read('lopvui.desk-items.v7',null):null)||migrateSeats();
let activeSpot=null,selectedStudentId=null,selectedLateId=null,activeProfileId=null,lateHomeworkSelected=false,dragState=null,suppressClick=false;
const classroom=document.querySelector('#classroom');const $=selector=>document.querySelector(selector);
const studentIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.5"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg>';
const toast=message=>{const el=$('#toast'),host=document.querySelector('dialog[open]')||document.querySelector('.app-shell');if(host&&!host.contains(el))host.append(el);el.textContent=message;el.classList.add('show');clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>{el.classList.remove('show');const shell=document.querySelector('.app-shell');if(shell&&!shell.contains(el))shell.append(el);},2500);};
const save=()=>{
  const now = Date.now();
  for (const dId of Object.keys(deskItems || {})) {
    if (Array.isArray(deskItems[dId])) {
      deskItems[dId].forEach(ent => {
        if (ent && typeof ent === 'object' && !ent._updatedAt) ent._updatedAt = now;
      });
    }
  }
  localStorage.setItem(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`,JSON.stringify(layout));
  localStorage.setItem(`lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}`,JSON.stringify(deskItems));
  localStorage.setItem(`lopvui.late-queue.v6.${CURRENT_CLASS_ID}.${checklistDate}`,JSON.stringify(lateQueue));
  syncLiveSessionData();
  saveStudentRecords(students,makeupStudents);
};
const saveChecklist=()=>{
  localStorage.setItem(getChecklistKey(),JSON.stringify(checklist));
  syncLiveSessionData();
};
const desks=()=>layout.flatMap((aisle,ci)=>aisle.desks.map((desk,di)=>({aisle,desk,ci,di})));
const allEntries=()=>desks().flatMap(({desk})=>(deskItems[desk.id]||[]).map((entry,index)=>({entry,deskId:desk.id,index})));
const homeworkLabel=status=>({uncollected:'Chưa thu',not_submitted:'Chưa nộp',submitted:'Đã nộp',graded:'Đã nộp'})[status]||'Chưa thu';
const homeworkSymbol=record=>(record?.score!==null&&record?.score!==undefined&&record?.score!=='')?formatScoreVN(record.score):({not_submitted:'×',submitted:'✓',graded:'✓',uncollected:'·'})[record?.status]||'·';
const homeworkClass=status=>({not_submitted:'hw-missing',submitted:'hw-collected',graded:'hw-graded',uncollected:'hw-uncollected'})[status]||'hw-uncollected';
const attendanceLabel=status=>({present:'Có mặt',late:'Đi muộn',absent_excused:'Vắng có phép',absent_unexcused:'Vắng không phép'})[status]||'Chưa điểm danh';

function extractClassStartTimeStr(clsObj) {
  const c = clsObj || activeClassConfig();
  if (c?.startTime && /^\d{1,2}:\d{2}$/.test(String(c.startTime).trim())) {
    const [h, m] = String(c.startTime).trim().split(':').map(Number);
    return `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
  }
  const m = String(c?.scheduleText || c?.time || '').match(/(\d{1,2}:\d{2})/);
  if (m) {
    const [h, min] = m[1].split(':').map(Number);
    return `${String(h || 0).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}`;
  }
  return '18:00';
}

function _addLateMinutesToTimeStr(timeStr, minsToAdd) {
  const m = String(timeStr || '18:00').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const total = ((Number(m[1]) * 60 + Number(m[2]) + (Number(minsToAdd) || 0)) % 1440 + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function resolveLateDetails(student, entry = null, clsObj = null, dateStr = null) {
  const c = clsObj || activeClassConfig();
  const cId = c?.id || CURRENT_CLASS_ID;
  const dStr = dateStr || checklistDate;
  const startTime = extractClassStartTimeStr(c);
  const [stH, stM] = startTime.split(':').map(Number);
  const startTotal = (stH || 0) * 60 + (stM || 0);

  const attObj = entry?.attendance || student?.attendance || null;
  const attHist = (student?.attendanceHistory || []).find(h => (!cId || !h.classId || h.classId === cId) && (!dStr || h.date === dStr));

  let arrivalTime = attObj?.arrivalTime || attObj?.time || student?.arrivalTime || attHist?.time || attHist?.arrivalTime || '';
  if (arrivalTime && !/^\d{1,2}:\d{2}$/.test(String(arrivalTime).trim())) {
    const tm = String(arrivalTime).match(/(\d{1,2}:\d{2})/);
    arrivalTime = tm ? tm[1] : '';
  }

  let rawMins = attObj?.lateMinutes ?? attObj?.minutesLate ?? student?.lateMinutes ?? attHist?.lateMinutes ?? attHist?.minutesLate ?? null;
  let mins = (rawMins !== null && rawMins !== undefined && rawMins !== '') ? Number(rawMins) : null;

  // Luôn tự động tính số phút muộn dựa trên Giờ đến lớp (arrivalTime) và Giờ vào học (startTime)
  if (arrivalTime) {
    const [arH, arM] = arrivalTime.split(':').map(Number);
    const diff = ((arH || 0) * 60 + (arM || 0)) - startTotal;
    if (diff <= 0) {
      // Đến trước hoặc đúng giờ vào học -> 0 phút muộn (không gắn tag muộn)
      mins = 0;
    } else {
      mins = diff;
    }
  } else if (attObj?.status === 'present' || (!attObj && attHist?.status === 'present')) {
    mins = 0;
  } else if (mins === null || Number.isNaN(mins) || mins < 0) {
    mins = attObj?.status === 'late' ? 10 : 0;
  }

  if (!arrivalTime && mins > 0) {
    arrivalTime = _addLateMinutesToTimeStr(startTime, mins);
  }

  const isLate = mins > 0 && (attObj?.status !== 'present');
  return {
    startTime,
    arrivalTime,
    lateMinutes: isLate ? mins : 0,
    minutesLate: isLate ? mins : 0,
    isLate,
    badgeText: isLate ? `Đi muộn ${mins}p (${arrivalTime})` : `Đúng giờ${arrivalTime ? ` (${arrivalTime})` : ''}`,
    shortBadgeText: isLate ? `Muộn ${mins}p (${arrivalTime})` : `Đúng giờ${arrivalTime ? ` (${arrivalTime})` : ''}`,
    reportText: isLate ? `muộn ${mins}’ - ${arrivalTime}` : 'Có mặt'
  };
}

function isStudentLateInSession(student, seatedEntry = null, clsObj = null, dateStr = null) {
  if (!student && !seatedEntry) return false;
  const att = seatedEntry?.attendance || student?.attendance || null;
  if (att?.status === 'present') return false;
  const det = resolveLateDetails(student, seatedEntry, clsObj, dateStr);
  return Boolean(det.isLate && det.lateMinutes > 0);
}
const studentById=id=>students.find(s=>s.id===id)||makeupStudents.find(s=>s.id===id);
const sessionNoteFor=id=>attendanceNotes[id]??studentById(id)?.sessionNotes?.find(note=>note.classId===CURRENT_CLASS_ID&&note.date===checklistDate)?.note??'';
function saveSessionNote(id,value){
  attendanceNotes[id]=value;
  localStorage.setItem(getAttendanceNotesKey(),JSON.stringify(attendanceNotes));
  const student=studentById(id);
  if(student){
    student.sessionNotes=student.sessionNotes||[];
    let note=student.sessionNotes.find(item=>item.classId===CURRENT_CLASS_ID&&item.date===checklistDate);
    if(!note&&!value){
      save();
      return;
    }
    if(!note){
      note={classId:CURRENT_CLASS_ID,date:checklistDate,note:'',updatedAt:Date.now()};
      student.sessionNotes.push(note);
    }
    note.note=value;
    note.updatedAt=Date.now();
    save();
    logAdminSessionAction(`Cập nhật ghi chú buổi học của HS ${student.name}`, value ? `Nội dung: "${value}"` : 'Đã xoá ghi chú buổi học', 'student', `sess-note-${student.id}`);
  }
}
for(const student of [...students,...makeupStudents])if(!(student.id in attendanceNotes)){const saved=student.sessionNotes?.find(note=>note.classId===CURRENT_CLASS_ID&&note.date===checklistDate);if(saved)attendanceNotes[student.id]=saved.note;}
const classStudents=()=>students.filter(student=>(student.classIds||[]).includes(CURRENT_CLASS_ID));
const isMakeupInCurrentSession=(student, placementsMap=null, lateSetOrArr=null)=>{
  if (!student) return false;
  if (placementsMap && placementsMap.has(student.id)) return true;
  if (lateSetOrArr) {
    if (lateSetOrArr instanceof Set && lateSetOrArr.has(student.id)) return true;
    if (Array.isArray(lateSetOrArr) && lateSetOrArr.includes(student.id)) return true;
  }
  return student.attendingClassId === CURRENT_CLASS_ID && student.attendingSessionDate === checklistDate;
};
const splitStudentName=name=>{const parts=String(name||'').trim().split(/\s+/).filter(Boolean);return {familyName:parts.slice(0,-1).join(' '),givenName:parts.at(-1)||''};};
function createStudentProfile({name,familyName=undefined,givenName=undefined,school='',kind='regular',parentContact={name:'',phone:''},studentCode=null,classIds=null,enrollmentStatus='Học',tags=[],isNew=undefined}){
  const makeup=kind==='makeup';
  const cleanCode=(studentCode&&String(studentCode).trim())?String(studentCode).trim().toUpperCase():null;
  const splitParts=splitStudentName(name);
  const resolvedClassIds = makeup
    ? []
    : (Array.isArray(classIds) ? [...new Set(classIds.filter(Boolean))] : [CURRENT_CLASS_ID]);
  const isNewStudent = isNew !== undefined ? Boolean(isNew) : !makeup;
  const baseTags = (Array.isArray(tags) ? [...tags] : []).filter(t => String(t || '').trim().toLowerCase() !== 'học bù');
  if (!makeup && isNewStudent && !baseTags.includes('Mới')) {
    baseTags.unshift('Mới');
  }
  const id = `stu-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const profile = {
    id,
    familyName: familyName !== undefined && familyName !== '' ? familyName : splitParts.familyName,
    givenName: givenName !== undefined && givenName !== '' ? givenName : splitParts.givenName,
    studentCode:cleanCode,
    name,
    school:makeup?'':school,
    sourceClassName:makeup?school:'',
    attendingClassId:makeup?CURRENT_CLASS_ID:null,
    attendingSessionDate:makeup?checklistDate:null,
    classIds:resolvedClassIds,
    courseIds:[],
    parentContact:{name:parentContact?.name||'',phone:parentContact?.phone||''},
    enrollmentStatus: (enrollmentStatus && String(enrollmentStatus).trim()) ? String(enrollmentStatus).trim() : 'Học',
    photoURL:null,
    photoDriveFileId:null,
    photoDriveFileName:null,
    scores:[],
    attendanceHistory:[],
    seatingHistory:[],
    notes:[],
    learningNotes:'',
    tags:[...new Set(baseTags.filter(Boolean))],
    isNew:isNewStudent,
    studentType:makeup?'makeup':'regular',
    createdAt:Date.now()
  };
  profile.photoDriveFileName = buildStudentDrivePhotoFileName(profile, classCatalog);
  return profile;
}
const currentStaffName=()=>masterData?.employees?.find(e=>e.id===currentEmployeeId)?.name||document.querySelector('.user-name')?.childNodes[0]?.textContent.trim()||'Trợ giảng';
const personalWorkKey=()=>`lopvui.personal-work.v2.${currentEmployeeId||'employee-ta-001'}`;
const loadPersonalWorkDays=()=>{
  const v2 = read(personalWorkKey(), null);
  if (v2 && typeof v2 === 'object' && Object.keys(v2).length > 0) return v2;
  const legacyKey = `lopvui.personal-work.v1.${encodeURIComponent(currentStaffName().trim().toLocaleLowerCase('vi'))}`;
  const v1 = read(legacyKey, {});
  if (v1 && typeof v1 === 'object' && Object.keys(v1).length > 0) {
    try { localStorage.setItem(personalWorkKey(), JSON.stringify(v1)); } catch {}
    return v1;
  }
  return v2 || {};
};
let personalWorkDays=loadPersonalWorkDays();
const renderPersonalWork=()=>{const didWork=Boolean(personalWorkDays[checklistDate]),button=$('#personal-work-toggle'),status=$('#personal-work-status');if(!button||!status)return;button.setAttribute('aria-pressed',String(didWork));button.classList.toggle('checked',didWork);button.textContent=didWork?'✓ Đã xác nhận đi làm hôm nay':'✓ Tôi có đi làm hôm nay';status.textContent=didWork?`Bạn đã tự xác nhận đi làm hôm nay (${checklistDate}).`:`Chưa xác nhận hôm nay · ${checklistDate}`;};
$('#personal-work-toggle').onclick=()=>{if(personalWorkDays[checklistDate])delete personalWorkDays[checklistDate];else personalWorkDays[checklistDate]={staff:currentStaffName(),at:Date.now()};localStorage.setItem(personalWorkKey(),JSON.stringify(personalWorkDays));renderPersonalWork();};
renderPersonalWork();
const assignedIds=()=>new Set(allEntries().map(x=>x.entry.studentId).filter(Boolean));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const communicationTime=timestamp=>new Date(timestamp).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
function persistClassCommunication(){saveClassCommunication(CURRENT_CLASS_ID,checklistDate,classCommunication);}
function renderClassCommunication(){const messages=$('#chat-message-list'),activity=$('#activity-log-list');if(!messages||!activity)return;$('#chat-message-count').textContent=`${classCommunication.messages.filter(item=>item.kind==='user').length} tin`;messages.innerHTML=classCommunication.messages.map(item=>item.kind==='system'?`<article class="chat-system-message"><span></span><div><p>${escapeHtml(item.text)}</p><time>${communicationTime(item.createdAt)}</time></div></article>`:`<article class="chat-message"><div class="chat-message-meta"><strong>${escapeHtml(item.author||'Trợ giảng')}</strong><time>${communicationTime(item.createdAt)}</time></div><p>${escapeHtml(item.text).replace(/\n/g,'<br>')}</p></article>`).join('')||'<div class="chat-empty-state"><span></span><strong>Chưa có tin nhắn</strong><small>Gửi trao đổi đầu tiên cho nhân sự trong lớp.</small></div>';activity.innerHTML=classCommunication.activity.map(item=>`<article class="activity-log-item"><span class="activity-log-dot ${escapeHtml(item.type||'system')}"></span><div><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.actor||'Hệ thống')} · ${communicationTime(item.createdAt)}</small></div></article>`).join('')||'<div class="chat-empty-state activity-empty"><span></span><strong>Chưa có hoạt động</strong><small>Hệ thống sẽ ghi lại các mốc chính trong ca.</small></div>';messages.scrollTop=messages.scrollHeight;}
function renderNotifications(){const list=$('#notification-list');if(!list)return;const unread=classCommunication.notifications.filter(item=>!item.read).length;$('#notification-badge').textContent=unread>9?'9+':String(unread);$('#notification-badge').hidden=!unread;$('#notification-unread-label').textContent=unread?`${unread} thông báo chưa đọc`:'Đã xem hết thông báo';$('#notification-permission-status').textContent=('Notification'in window)?(Notification.permission==='granted'?'Thông báo trên thiết bị đã bật.':Notification.permission==='denied'?'Trình duyệt đang chặn thông báo trên thiết bị.':'Thông báo trên thiết bị đang tắt.'):'Trình duyệt này chưa hỗ trợ thông báo.';list.innerHTML=classCommunication.notifications.length?classCommunication.notifications.slice().reverse().map(item=>`<article class="notification-item ${item.read?'':'unread'}"><span class="notification-item-icon ${escapeHtml(item.type)}">${item.type==='chat'?'':item.type==='homework'?'✓':item.type==='attendance'?'✓':item.type==='reminder'?'':''}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${communicationTime(item.createdAt)}</small></div></article>`).join(''):'<div class="notification-empty">Chưa có thông báo trong ca học này.</div>';}
function createClassNotification(title,body,type='system',key=''){if(key&&classCommunication.notifications.some(item=>item.key===key))return;const createdAt=Date.now(),notification={id:`notice-${createdAt}-${Math.random().toString(36).slice(2,6)}`,key,title,body,type,createdAt,read:false};classCommunication.notifications.push(notification);classCommunication.notifications=classCommunication.notifications.slice(-100);persistClassCommunication();renderNotifications();if('Notification'in window&&Notification.permission==='granted'){try{new Notification(title,{body,tag:key||notification.id});}catch{}}if($('#notification-panel')&&!$('#notification-panel').hidden)$('#notification-panel').classList.add('has-new');}
function addClassActivity(text,type='system'){const createdAt=Date.now();classCommunication.activity.push({id:`log-${createdAt}-${Math.random().toString(36).slice(2,6)}`,type,text,actor:currentStaffName(),createdAt});classCommunication.messages.push({id:`bot-${createdAt}-${Math.random().toString(36).slice(2,6)}`,kind:'system',text,createdAt});classCommunication.activity=classCommunication.activity.slice(-250);classCommunication.messages=classCommunication.messages.slice(-250);if(type==='homework')createClassNotification('Đã cập nhật BTVN',text,'homework');else if(type==='attendance'&&text.startsWith('Hoàn tất ghi nhận'))createClassNotification('Đã chốt điểm danh',text,'attendance');persistClassCommunication();if(!$('#chat-view').hidden)renderClassCommunication();}
$('#notification-toggle').onclick=()=>{const panel=$('#notification-panel'),opening=panel.hidden;panel.hidden=!opening;$('#notification-toggle').setAttribute('aria-expanded',String(opening));if(opening){classCommunication.notifications.forEach(item=>item.read=true);persistClassCommunication();renderNotifications();}};
$('#notification-read-all').onclick=()=>{classCommunication.notifications.forEach(item=>item.read=true);persistClassCommunication();renderNotifications();};
$('#enable-browser-notifications').onclick=async()=>{if(!('Notification'in window)){toast('Trình duyệt này chưa hỗ trợ thông báo trên thiết bị.');return;}try{const permission=await Notification.requestPermission();renderNotifications();if(permission==='granted')toast('Đã bật thông báo trên thiết bị khi trang web đang mở.');else toast('Chưa cấp quyền thông báo trên thiết bị.');}catch{toast('Không thể bật thông báo trên thiết bị trong trình duyệt này.');}};
document.addEventListener('click',event=>{const anchor=$('.notification-anchor');if(anchor&&!anchor.contains(event.target)&&!$('#notification-panel').hidden){$('#notification-panel').hidden=true;$('#notification-toggle').setAttribute('aria-expanded','false');}});
$('#chat-compose-form').addEventListener('submit',event=>{event.preventDefault();const field=$('#chat-message-input'),text=field.value.trim();if(!text)return;const createdAt=Date.now(),author=currentStaffName();classCommunication.messages.push({id:`msg-${createdAt}-${Math.random().toString(36).slice(2,6)}`,kind:'user',author,text,createdAt});createClassNotification('Tin nhắn mới',`${author}: ${text}`,'chat');persistClassCommunication();field.value='';renderClassCommunication();field.focus();});
$('#chat-message-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('#chat-compose-form').requestSubmit();}});
renderNotifications();
window.addEventListener('storage',event=>{if(event.key!==`lopvui.class-communication.v1.${CURRENT_CLASS_ID}.${checklistDate}`||!event.newValue)return;const previousIds=new Set(classCommunication.notifications.map(item=>item.id));classCommunication=loadClassCommunication(CURRENT_CLASS_ID,checklistDate);renderNotifications();if(!$('#chat-view').hidden)renderClassCommunication();const incoming=classCommunication.notifications.filter(item=>!previousIds.has(item.id)&&!item.read);if(incoming.length&&'Notification'in window&&Notification.permission==='granted')incoming.forEach(item=>{try{new Notification(item.title,{body:item.body,tag:item.key||item.id});}catch{}});});
function scheduleDefaultNotifications(){const sessionDate=new Date(`${checklistDate}T00:00:00`),start=classScheduleStamp(configClass,sessionDate),end=new Date(`${checklistDate}T${configClass.endTime}:00`),now=new Date();for(const rule of configClass.defaultNotifications||[]){const anchor=rule.anchor==='end'?end:start,due=new Date(anchor.getTime()+Number(rule.offsetMinutes||0)*60000),key=`class-rule-${CURRENT_CLASS_ID}-${checklistDate}-${rule.id}`;if(classCommunication.notifications.some(item=>item.key===key))continue;const notify=()=>{createClassNotification(rule.title||'Nhắc việc theo ca',rule.body||rule.title||'Đến mốc công việc của lớp.','reminder',key);addClassActivity(`Thông báo theo lịch lớp: ${rule.title||rule.body||'Nhắc việc'}`,'system');};if(now>=due&&now<new Date(due.getTime()+15*60*1000))notify();else if(now<due)setTimeout(()=>{if(new Date().toLocaleDateString('sv-SE')===checklistDate)notify();},due-now);}}
scheduleDefaultNotifications();
function studentTagList(student){
  const list = (Array.isArray(student?.tags) ? [...student.tags].filter(Boolean) : []).filter(t => String(t || '').trim().toLowerCase() !== 'học bù');
  if (student?.isNew && student?.studentType !== 'makeup' && !list.some(t => String(t).toLowerCase() === 'mới')) {
    list.unshift('Mới');
  }
  return list;
}
function studentSearchMeta(student){const tags=studentTagList(student);return `<small>${escapeHtml(student.studentType==='makeup'?`Học bù · ${student.sourceClassName||'chưa rõ lớp'}`:student.school||'Hồ sơ đã lưu')}</small>${tags.length?`<span class="student-tag-row">${tags.map(tag=>`<span class="student-tag ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}</span>`).join('')}</span>`:''}`;}
function renderInlineTags(student){return studentTagList(student).map(tag=>`<span class="student-tag-inline ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}</span>`).join('');}
function renderStudentInfo(selector,student){
  const host=$(selector);
  if(!host)return;
  if(!student){
    host.hidden=true;
    host.style.display='none';
    host.innerHTML='';
    return;
  }
  const storedTags=student.tags||[],allTags=studentTagList(student);
  const isMakeup = student.studentType === 'makeup' || makeupStudents.some(m => m.id === student.id);
  const metaText = isMakeup
    ? `Học bù · Lớp gốc: ${student.sourceClassName || student.school || 'Chưa rõ lớp'}`
    : `Trường: ${student.school || 'Chưa cập nhật trường/lớp'}${student.studentCode ? ` · Mã HS: ${student.studentCode}` : ''}`;
  host.hidden=false;
  host.removeAttribute('hidden');
  host.style.display='block';
  host.innerHTML=`<div class="selected-student-summary">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
      <button type="button" class="student-profile-name" data-profile-name="${escapeHtml(student.id)}">${escapeHtml(student.name)}</button>
      <span class="room-chip" style="background:#dcfce7; color:#166534; font-weight:800; font-size:12.5px; padding:3px 9px; border:1px solid #86efac;">✓ Đã chọn</span>
    </div>
    <small>${escapeHtml(metaText)}</small>
  </div>
  <div class="student-tag-row">${isMakeup ? '<span class="student-tag" style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe;">Học bù</span>' : ''}${allTags.map(tag=>{const storedIndex=storedTags.indexOf(tag),removable=storedIndex>=0;return `<span class="student-tag ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}${removable?`<button type="button" aria-label="Xóa tag ${escapeHtml(tag)}" data-remove-tag="${storedIndex}" data-student-id="${escapeHtml(student.id)}">×</button>`:''}</span>`;}).join('')}</div>
  <div class="student-tag-editor"><input type="text" data-tag-input="${escapeHtml(student.id)}" placeholder="Thêm tag, ví dụ: Cần chú ý" /><button type="button" data-add-tag="${escapeHtml(student.id)}">Thêm tag</button></div>`;
  host.querySelector('[data-profile-name]')?.addEventListener('click',()=>{ openStudentSessionProfile(student.id, CURRENT_CLASS_ID, checklistDate); });
}
function refreshStudentInfo(){renderStudentInfo('#selected-student-info',selectedStudentId?studentById(selectedStudentId):null);renderStudentInfo('#late-history',selectedLateId?studentById(selectedLateId):null);}
function addStudentTag(id,input){const student=studentById(id),tag=input.value.trim();if(!student||!tag)return;student.tags=student.tags||[];if(student.tags.some(item=>normalizeSearchText(item)===normalizeSearchText(tag))){toast('Tag này đã có trong hồ sơ.');return;}student.tags.push(tag);save();render();refreshStudentInfo();logAdminSessionAction(`Gắn tag cho HS ${student.name}`, `Tag: "${tag}"`, 'student');}
document.addEventListener('click',e=>{const add=e.target.closest('[data-add-tag]');if(add){const host=add.closest('.selected-student-info'),input=host?.querySelector('[data-tag-input]');addStudentTag(add.dataset.addTag,input);return;}const remove=e.target.closest('[data-remove-tag]');if(remove){const student=studentById(remove.dataset.studentId);if(!student)return;const removedTag=student.tags?.[Number(remove.dataset.removeTag)]||'';student.tags.splice(Number(remove.dataset.removeTag),1);save();render();refreshStudentInfo();logAdminSessionAction(`Gỡ tag khỏi HS ${student.name}`, `Tag đã gỡ: "${removedTag}"`, 'student');}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-tag-input]')){e.preventDefault();addStudentTag(e.target.dataset.tagInput,e.target);}});
function sessionStudentIds(){return [...new Set([...allEntries().map(({entry})=>entry.studentId).filter(Boolean),...lateQueue])].filter(id=>studentById(id));}
function renderChecklistCore(){
  const itemsHost=$('#checklist-items');
  if(!itemsHost)return;
  const completed=checklist.items.filter(item=>item.done).length;
  $('#checklist-progress-count').textContent=`${completed}/${checklist.items.length}`;
  const renderItemRow = (item, isEnd = false) => {
    const cbAttr = isEnd ? `data-end-checklist-item="${escapeHtml(item.id)}"` : `data-checklist-item="${escapeHtml(item.id)}"`;
    const lblAttr = isEnd ? `data-end-checklist-label="${escapeHtml(item.id)}"` : `data-checklist-label="${escapeHtml(item.id)}"`;
    const rmAttr = isEnd ? `data-end-checklist-remove="${escapeHtml(item.id)}"` : `data-remove-checklist-item="${escapeHtml(item.id)}"`;
    const doneSub = item.done
      ? `Đã hoàn thành bởi ${escapeHtml(item.doneBy||'Trợ giảng')}${item.doneAt?` · ${new Date(item.doneAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`:''}`
      : 'Chưa hoàn thành';
    const labelHtml = item.kind === 'reminder'
      ? `<div class="checklist-label-wrap-text" role="text">${escapeHtml(item.label)}</div>`
      : `<textarea rows="1" class="checklist-label-input checklist-label-textarea" ${lblAttr} aria-label="Tên công việc">${escapeHtml(item.label)}</textarea>`;
    return `<div class="checklist-item ${item.done?'complete':''} ${item.kind==='reminder'?'reminder-checklist-item':''}">
      <input type="checkbox" ${cbAttr} aria-label="Đánh dấu ${escapeHtml(item.label)}" ${item.done?'checked':''}>
      <span class="checklist-checkmark"></span>
      ${item.kind==='reminder'?'<span class="reminder-type-pill">Reminder</span>':''}
      <span class="checklist-item-copy">
        ${labelHtml}
        <small>${doneSub}</small>
      </span>
      <button type="button" class="checklist-remove" ${rmAttr} aria-label="Xóa mục ${escapeHtml(item.label)}">×</button>
    </div>`;
  };
  itemsHost.innerHTML=checklist.items.map(item=>renderItemRow(item, false)).join('')||'<div class="empty-list">Chưa có công việc. Thêm các yêu cầu của ca học này.</div>';
  const endHost=$('#end-checklist-items');
  if(endHost)endHost.innerHTML=checklist.endItems.map(item=>renderItemRow(item, true)).join('')||'<div class="empty-list">Chưa có công việc cuối giờ.</div>';

  // Auto-resize checklist textareas so multi-line tasks show 100% of their text without truncation
  document.querySelectorAll('.checklist-label-textarea').forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(26, ta.scrollHeight)}px`;
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = `${Math.max(26, ta.scrollHeight)}px`;
    });
  });

  const totalItems=checklist.items.length+checklist.endItems.length,doneItems=[...checklist.items,...checklist.endItems].filter(item=>item.done).length;
  $('#checklist-progress-count').textContent=`${doneItems}/${totalItems}`;
  const started=Boolean(checklist.workStart);
  $('#shift-start-status').textContent=started?'Đã xác nhận ca':'Chưa bắt đầu';
  $('#shift-start-status').classList.toggle('done',started);
  $('#shift-start-log').textContent=started?`Ca làm được xác nhận bởi ${checklist.workStart.name} lúc ${new Date(checklist.workStart.at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`:'Ca làm sẽ được ghi nhận khi hoàn tất mục đầu tiên.';
  const note=$('#session-note');
  if(note&&document.activeElement!==note)note.value=checklist.classNote||'';
  const parentNote=$('#parent-general-note');
  if(parentNote&&document.activeElement!==parentNote)parentNote.value=checklist.parentGeneralNote||'';
  $('#session-note-status').textContent=checklist.noteSavedAt?`Đã lưu lúc ${new Date(checklist.noteSavedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`:'';
  if($('#test-required-toggle'))$('#test-required-toggle').checked=Boolean(checklist.testRequired);
  if($('#scores-tab-test-toggle'))$('#scores-tab-test-toggle').checked=Boolean(checklist.testRequired);
  if($('#test-collection-tools'))$('#test-collection-tools').hidden=!checklist.testRequired;
  const handover=checklist.handover;
  if($('#handover-status'))$('#handover-status').textContent=handover?`Đã xác nhận trợ giảng cầm bài về: ${handover.person} lúc ${new Date(handover.at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`:'Chưa xác nhận trợ giảng cầm bài về.';
  if($('#handover-person')&&document.activeElement!==$('#handover-person'))$('#handover-person').value=handover?.person||'';
  if($('#confirm-handover'))$('#confirm-handover').textContent=handover?'Cập nhật người cầm bài':'Xác nhận cầm bài về';
}

function safeHttpUrl(value){try{const url=new URL(String(value||'').trim());return url.protocol==='http:'||url.protocol==='https:'?url.href:'';}catch{return '';}}
function renderChecklistDetails(){for(const field of document.querySelectorAll('[data-checklist-field]'))if(document.activeElement!==field)field.value=checklist[field.dataset.checklistField]||'';for(const [key,linkId] of [['notebookLink','notebook-link-open'],['homeworkLink','homework-link-open']]){const link=document.getElementById(linkId),safeUrl=safeHttpUrl(checklist[key]);if(link){link.hidden=!safeUrl;if(safeUrl)link.href=safeUrl;}}}
function renderChecklist(){renderChecklistCore();renderChecklistDetails();}
document.querySelectorAll('[data-checklist-field]').forEach(field=>field.addEventListener('input',()=>{const key=field.dataset.checklistField;checklist[key]=field.value;saveChecklist();const status=key==='lessonTitle'?$('#lesson-title-status'):$('#homework-details-status');if(status)status.textContent='Đã lưu';if(key==='notebookLink'||key==='homeworkLink')renderChecklistDetails();logAdminSessionAction(`Cập nhật thông tin bài học (${key})`, `Giá trị: "${field.value.trim()}"`, 'checklist', `chk-field-${key}`);}));
$('#checklist-items').addEventListener('change',e=>{const input=e.target.closest('[data-checklist-item]');if(!input)return;const item=checklist.items.find(entry=>entry.id===input.dataset.checklistItem);if(!item)return;item.done=input.checked;item.doneBy=input.checked?currentStaffName():null;item.doneAt=input.checked?Date.now():null;if(checklist.items[0]?.id===item.id&&input.checked&&!checklist.workStart)checklist.workStart={name:currentStaffName(),at:Date.now()};addClassActivity(`${currentStaffName()} đã ${input.checked?'hoàn thành':'bỏ đánh dấu'}: ${item.label}`,'checklist');logAdminSessionAction(`${input.checked?'Hoàn thành':'Bỏ tích'} checklist đầu giờ`, `Mục: ${item.label}`, 'checklist');if(checklist.items.length&&checklist.items.every(entry=>entry.done)){createClassNotification('Checklist setup đã xong','Tất cả công việc chuẩn bị đầu giờ đã được hoàn thành.','checklist',`setup-done-${checklistDate}`);addClassActivity(`${currentStaffName()} đã hoàn thành toàn bộ checklist setup đầu giờ`,'checklist');}saveChecklist();renderChecklist();});
$('#checklist-items').addEventListener('change',e=>{const input=e.target.closest('[data-checklist-label]');if(!input)return;const item=checklist.items.find(entry=>entry.id===input.dataset.checklistLabel);if(!item)return;const label=input.value.trim();if(!label){input.value=item.label;toast('Tên công việc không được để trống.');return;}item.label=label;saveChecklist();logAdminSessionAction('Đổi tên mục checklist đầu giờ', `Nội dung: ${label}`, 'checklist', `chk-lbl-${item.id}`);});
$('#checklist-items').addEventListener('click',e=>{const button=e.target.closest('[data-remove-checklist-item]');if(!button)return;const removed=checklist.items.find(i=>i.id===button.dataset.removeChecklistItem);checklist.items=checklist.items.filter(item=>item.id!==button.dataset.removeChecklistItem);saveChecklist();renderChecklist();logAdminSessionAction('Xoá mục checklist đầu giờ', `Mục: ${removed?.label || ''}`, 'checklist');});
$('#add-checklist-item').onclick=()=>{const item={id:`task-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,label:'Việc mới',done:false};checklist.items.push(item);saveChecklist();renderChecklist();logAdminSessionAction('Thêm mục checklist đầu giờ mới', '', 'checklist');const input=$(`[data-checklist-label="${item.id}"]`);input?.focus();input?.select?.();};
$('#end-checklist-items').addEventListener('change',e=>{const input=e.target.closest('[data-end-checklist-item]');if(input){const item=checklist.endItems.find(row=>row.id===input.dataset.endChecklistItem);if(!item)return;item.done=input.checked;item.doneBy=input.checked?currentStaffName():null;item.doneAt=input.checked?Date.now():null;addClassActivity(`${currentStaffName()} đã ${input.checked?'hoàn thành':'bỏ đánh dấu'}: ${item.label}`,'checklist');logAdminSessionAction(`${input.checked?'Hoàn thành':'Bỏ tích'} checklist cuối giờ`, `Mục: ${item.label}`, 'checklist');saveChecklist();renderChecklist();return;}const label=e.target.closest('[data-end-checklist-label]');if(!label)return;const item=checklist.endItems.find(row=>row.id===label.dataset.endChecklistLabel);if(item&&label.value.trim()){item.label=label.value.trim();saveChecklist();logAdminSessionAction('Đổi tên mục checklist cuối giờ', `Nội dung: ${item.label}`, 'checklist', `end-chk-lbl-${item.id}`);}else if(item)label.value=item.label;});
$('#end-checklist-items').addEventListener('click',e=>{const button=e.target.closest('[data-end-checklist-remove]');if(!button)return;const item=checklist.endItems.find(row=>row.id===button.dataset.endChecklistRemove);if(item&&confirm(`Xóa mục “${item.label}” khỏi checklist?`)){checklist.endItems=checklist.endItems.filter(row=>row.id!==item.id);saveChecklist();renderChecklist();logAdminSessionAction('Xoá mục checklist cuối giờ', `Mục: ${item.label}`, 'checklist');}});
$('#add-end-checklist-item').onclick=()=>{const item={id:`end-task-${Date.now()}`,label:'Việc mới',done:false};checklist.endItems.push(item);saveChecklist();renderChecklist();logAdminSessionAction('Thêm mục checklist cuối giờ mới', '', 'checklist');const input=$(`[data-end-checklist-label="${item.id}"]`);input?.focus();input?.select?.();};
$('#save-session-note').onclick=()=>{checklist.classNote=$('#session-note').value.trim();if($('#parent-general-note'))checklist.parentGeneralNote=$('#parent-general-note').value.trim();checklist.noteSavedAt=Date.now();saveChecklist();addClassActivity(`${currentStaffName()} đã lưu ghi chú chung của buổi học`,'checklist');logAdminSessionAction('Lưu ghi chú trong ca & ghi chú gửi phụ huynh', `Ghi chú ca: "${checklist.classNote || '—'}" · Ghi chú gửi PH: "${checklist.parentGeneralNote || '—'}"`, 'checklist', 'save-session-note');renderChecklist();toast('Đã lưu ghi chú buổi học & ghi chú chung gửi phụ huynh.');};
$('#session-note')?.addEventListener('input',()=>{checklist.classNote=$('#session-note').value;checklist.noteSavedAt=Date.now();saveChecklist();logAdminSessionAction('Cập nhật ghi chú chung của buổi học', checklist.classNote ? `Nội dung: "${checklist.classNote.slice(0, 120)}"` : 'Trống', 'checklist', 'auto-session-note');const st=$('#session-note-status');if(st)st.textContent=`Đã tự động lưu lúc ${new Date(checklist.noteSavedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`;});
$('#handover-person')?.addEventListener('input',()=>{const person=$('#handover-person').value.trim();checklist.handover=person?{person,at:checklist.handover?.at||Date.now()}:null;saveChecklist();});
function handleToggleTestRequired(checked) {
  checklist.testRequired = Boolean(checked);
  if ($('#test-required-toggle')) $('#test-required-toggle').checked = checklist.testRequired;
  if ($('#scores-tab-test-toggle')) $('#scores-tab-test-toggle').checked = checklist.testRequired;
  addClassActivity(checklist.testRequired ? 'Đã bật: Ca này có test' : 'Đã tắt: Ca này có test', 'checklist');
  logAdminSessionAction(checklist.testRequired ? 'Bật chế độ: Ca học có bài Test' : 'Tắt chế độ: Ca học có bài Test', '', 'checklist');
  saveChecklist();
  renderChecklist();
  if (typeof renderScoresView === 'function') renderScoresView();
}
$('#test-required-toggle')?.addEventListener('change', e => handleToggleTestRequired(e.target.checked));
$('#scores-tab-test-toggle')?.addEventListener('change', e => handleToggleTestRequired(e.target.checked));
$('#confirm-handover').onclick=()=>{const person=$('#handover-person').value.trim();if(!person){toast('Nhập tên trợ giảng cầm bài về chấm.');$('#handover-person').focus();return;}checklist.handover={person,at:Date.now()};addClassActivity(`Trợ giảng cầm bài test về chấm: ${person}`,'handover');logAdminSessionAction('Xác nhận trợ giảng cầm bài về chấm', `Người nhận: ${person}`, 'checklist');saveChecklist();renderChecklist();toast(`Đã ghi nhận trợ giảng cầm bài về: ${person}.`);};
function setClassView(view){
  const chatVisible=view==='chat',scoresVisible=view==='scores',checklistVisible=view==='checklist',studentsVisible=view==='students';
  const seatingVisible=!chatVisible&&!scoresVisible&&!checklistVisible&&!studentsVisible;
  if (seatingVisible) {
    isSeatingEditMode = false;
    updateSeatingEditBtn();
    const cw = document.querySelector('.classroom-wrap');
    if (cw) cw.classList.remove('seating-edit-mode-on');
  }
  const syncViewVis=(sel,vis)=>{const el=$(sel);if(!el)return;el.hidden=!vis;el.style.display=vis?'':'none';};
  syncViewVis('#chat-view',chatVisible);
  syncViewVis('#seating-view',seatingVisible);
  syncViewVis('#scores-view',scoresVisible);
  syncViewVis('#checklist-view',checklistVisible);
  syncViewVis('#students-view',studentsVisible);
  $('#chat-view-tab')?.classList.toggle('active',chatVisible);
  $('#seating-view-tab')?.classList.toggle('active',seatingVisible);
  $('#scores-view-tab')?.classList.toggle('active',scoresVisible);
  $('#checklist-view-tab')?.classList.toggle('active',checklistVisible);
  $('#students-view-tab')?.classList.toggle('active',studentsVisible);
  $('#class-chat-nav')?.classList.toggle('active',chatVisible);
  $('#class-room-nav')?.classList.toggle('active',seatingVisible);
  $('#scores-sidebar-tab')?.classList.toggle('active',scoresVisible);
  $('#checklist-sidebar-tab')?.classList.toggle('active',checklistVisible);
  $('#students-tab')?.classList.toggle('active',studentsVisible);
  if(chatVisible)renderClassCommunication();
  if(scoresVisible&&typeof renderScoresView==='function')renderScoresView();
  if(checklistVisible)renderChecklist();
  if(studentsVisible)renderStudentList();
}
function updateSubtabUrl(subtab) {
  const c = activeClassConfig();
  const sub = isClassHistoryViewMode ? `history/${checklistDate}/${subtab}` : `live/${subtab}`;
  try { history.replaceState({}, '', `/class/${c?.code || CURRENT_CLASS_ID}/${sub}`); } catch {}
}
$('#chat-view-tab').onclick=()=>{ setClassView('chat'); updateSubtabUrl('chatlog'); };
$('#seating-view-tab').onclick=()=>{ setClassView('seating'); updateSubtabUrl('map'); };
$('#scores-view-tab')?.addEventListener('click', ()=>{ setClassView('scores'); updateSubtabUrl('scores'); });
$('#scores-sidebar-tab')?.addEventListener('click', ()=>{ setClassView('scores'); updateSubtabUrl('scores'); });
$('#checklist-view-tab').onclick=()=>{ setClassView('checklist'); updateSubtabUrl('checklist'); };
$('#students-view-tab').onclick=()=>{ setClassView('students'); updateSubtabUrl('students'); };
const weekdayNames=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const selectedRole=()=>['assistant','office','teacher','admin'].includes(signedInAccount?.role)?signedInAccount.role:'assistant';
function occurrenceDate(classInfo,from=new Date()){const date=new Date(from);date.setHours(0,0,0,0);let days=(Number(classInfo.weekday)-date.getDay()+7)%7;const startToday=new Date(date),endToday=new Date(date);const [hour,minute]=String(classInfo.startTime||'15:30').split(':').map(Number),[endHour,endMinute]=String(classInfo.endTime||'17:00').split(':').map(Number);startToday.setHours(hour,minute,0,0);endToday.setHours(endHour,endMinute,0,0);if(days===0&&startToday<from&&from>=endToday)days=7;date.setDate(date.getDate()+days);return date;}
function formatSessionDate(date){const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);const dateOnly=new Date(date);dateOnly.setHours(0,0,0,0);if(dateOnly.getTime()===today.getTime())return 'Hôm nay';if(dateOnly.getTime()===tomorrow.getTime())return 'Ngày mai';return `${weekdayNames[date.getDay()]}, ${date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})}`;}
function classScheduleStamp(classInfo,date){const [hour,minute]=String(classInfo.startTime||'15:30').split(':').map(Number),stamp=new Date(date);stamp.setHours(hour,minute,0,0);return stamp;}
function normalizeIsoDateString(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return date.trim();
  try { return new Date(date).toLocaleDateString('sv-SE'); } catch { return String(date || ''); }
}
function sessionChangeKey(classId,date){return classId+'::'+normalizeIsoDateString(date);}
function getSessionChange(classId,date){
  const iso = normalizeIsoDateString(date);
  return sessionChanges[`${classId}::${iso}`] || sessionChanges[`${classId}:${iso}`] || null;
}
function assignedIdsFor(item,change,role){const field={teacher:'teacherIds',assistant:'assistantIds',office:'officeIds'}[role];if(!field)return [];const override=change&&Object.prototype.hasOwnProperty.call(change,field)?change[field]:undefined;return override===undefined?(item[field]||[]):override;}
function employeeNames(ids){return ids.map(id=>masterData.employees.find(employee=>employee.id===id)?.name).filter(Boolean).join(', ')||'Chưa phân công';}
function isClassAssignedToCurrentAccount(item) {
  if (!item) return false;
  const role = selectedRole();
  if (role === 'admin' || !currentEmployeeId) return true;
  const inRegular = (item.teacherIds || []).includes(currentEmployeeId)
    || item.teacherId === currentEmployeeId
    || (item.assistantIds || []).includes(currentEmployeeId)
    || (item.officeIds || []).includes(currentEmployeeId);
  if (inRegular) return true;
  for (const ch of Object.values(sessionChanges || {})) {
    if (ch && ch.classId === item.id) {
      if ((ch.teacherIds || []).includes(currentEmployeeId) || ch.teacherId === currentEmployeeId || (ch.assistantIds || []).includes(currentEmployeeId) || (ch.officeIds || []).includes(currentEmployeeId)) {
        return true;
      }
    }
  }
  return false;
}
function getVisibleClassesForAccount() {
  const role = selectedRole();
  if (role === 'admin' || !currentEmployeeId) return classCatalog;
  return classCatalog.filter(isClassAssignedToCurrentAccount);
}
function assignedShiftInstances(role){
  const results=[];
  for(const item of classCatalog){
    for(const offset of [0,1,2,3,4,5,6]){
      const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+offset);
      if(date.getDay()!==Number(item.weekday))continue;
      const dateKey=date.toLocaleDateString('sv-SE'),change=getSessionChange(item.id,dateKey);
      if(change?.status==='cancelled')continue;
      if(role!=='admin'&&currentEmployeeId&&!assignedIdsFor(item,change,role).includes(currentEmployeeId)&&!isClassAssignedToCurrentAccount(item))continue;
      results.push({item,date,change});
      break;
    }
  }
  for(const change of Object.values(sessionChanges)){
    if(change?.status!=='makeup'||!change.date)continue;
    const item=classCatalog.find(row=>row.id===change.classId),date=new Date(`${change.date}T00:00:00`);
    if(item&&(role==='admin'||!currentEmployeeId||assignedIdsFor(item,change,role).includes(currentEmployeeId)||isClassAssignedToCurrentAccount(item))&&!results.some(row=>row.item.id===item.id&&row.date.toLocaleDateString('sv-SE')===change.date))results.push({item,date,change});
  }
  return results;
}
function scheduleCard(classInfo,dateArg,changeArg){const date=dateArg||occurrenceDate(classInfo),change=changeArg===undefined?getSessionChange(classInfo.id,date):changeArg,start=classScheduleStamp(classInfo,date),end=new Date(date);const [endHour,endMinute]=String(classInfo.endTime||'17:00').split(':').map(Number);end.setHours(endHour,endMinute,0,0);const ongoing=new Date()>=start&&new Date()<end,status=ongoing?'Đang diễn ra':change?.status==='makeup'?'Học bù':'Sắp tới',dateText=formatSessionDate(date),teacherNames=employeeNames(assignedIdsFor(classInfo,change,'teacher')),assistantNames=employeeNames(assignedIdsFor(classInfo,change,'assistant')),chip=change?.status==='makeup'?'<span class="shift-state live">Học bù</span>':change?.note?'<span class="shift-state">Đã điều chỉnh</span>':'';return '<article class="shift-card '+(ongoing?'ongoing':'')+'" style="cursor:pointer;" data-enter-class="'+escapeHtml(classInfo.id)+'" data-session-date="'+date.toLocaleDateString('sv-SE')+'"><div class="shift-card-icon">'+(ongoing?'◉':'')+'</div><div class="shift-card-main"><div class="shift-card-title"><strong style="font-size:16px; color:#214e2d;">'+escapeHtml(classInfo.code||classInfo.name)+'</strong><span class="room-chip" style="background:#eaf5ec; color:#27673b; font-weight:700;">Khối '+escapeHtml(classInfo.grade||'—')+'</span><span class="shift-state '+(ongoing?'live':'')+'">'+status+'</span>'+chip+'</div><p>'+escapeHtml(classInfo.subject||'Lớp học')+' · '+escapeHtml(classInfo.room||'Chưa xếp phòng')+'</p><div class="shift-card-details"><span> '+escapeHtml(dateText)+' · '+escapeHtml(classInfo.startTime)+'–'+escapeHtml(classInfo.endTime)+'</span><span>Giáo viên: '+escapeHtml(teacherNames)+' · Trợ giảng: '+escapeHtml(assistantNames)+'</span></div></div><button type="button" class="primary-button" data-enter-class="'+escapeHtml(classInfo.id)+'" data-session-date="'+date.toLocaleDateString('sv-SE')+'">'+(ongoing?'Mở lớp':'Xem lớp')+'</button></article>';}
function renderMainMenu(){
  const role=selectedRole(),workPanel=$('#work-menu-panel'),managed=$('#managed-class-list');
  const _curEmp=masterData?.employees?.find(e=>e.id===currentEmployeeId);if(document.querySelector('.user-name small'))document.querySelector('.user-name small').textContent=({assistant:'Trợ giảng',office:'Văn phòng',teacher:'Giáo viên',admin:'Admin'})[role]+(_curEmp?.code?' · '+_curEmp.code:'');window.__featuresApp?.updateCurrentUserDisplay?.();
  $('#main-menu-title').textContent=$('#management-menu-panel').hidden?'Ca làm & Lớp phụ trách':'Quản lý lớp học';
  $('#main-menu-description').textContent=$('#management-menu-panel').hidden?'Chọn ca làm hôm nay hoặc lớp phụ trách để mở trang tổng quan lớp học.':'Cập nhật người phụ trách, lịch học, phòng và thiết lập mặc định cho từng lớp.';
  $('#work-menu-tab').classList.toggle('active',workPanel&&!workPanel.hidden);
  $('#management-menu-tab').classList.toggle('active',!$('#management-menu-panel').hidden);
  $('#work-menu-nav').classList.toggle('active',workPanel&&!workPanel.hidden);
  $('#management-menu-nav').classList.toggle('active',!$('#management-menu-panel').hidden);
  const roleField={assistant:'assistantIds',office:'officeIds',teacher:'teacherIds'}[role];
  const assignedClasses=getVisibleClassesForAccount();
  const myClasses=role==='admin'?classCatalog:assignedClasses;

  const today=new Date();
  today.setHours(0,0,0,0);
  const todayIso=today.toLocaleDateString('sv-SE');
  const todayShifts=myClasses.filter(item=>{
    const change=getSessionChange(item.id,today);
    if(change?.status==='cancelled')return false;
    return Number(item.weekday)===today.getDay()||change?.status==='makeup';
  });

  $('#ongoing-shift-list').innerHTML=todayShifts.map(item=>scheduleCard(item,today,getSessionChange(item.id,today))).join('')
    ||`<div class="menu-empty compact-empty"><strong style="display:block; margin-bottom:4px;">Hôm nay (${today.toLocaleDateString('vi-VN')}) không có ca cố định theo lịch.</strong><small style="display:block;">Bạn có thể bấm vào các lớp phụ trách bên dưới để xem lịch sử hoặc mở ca mới.</small></div>`;

  $('#upcoming-shift-list').innerHTML=myClasses.map(item=>{
    const nextDate=occurrenceDate(item);
    return scheduleCard(item,nextDate,getSessionChange(item.id,nextDate));
  }).join('')||`<div class="menu-empty compact-empty">Chưa có lớp phụ trách nào.</div>`;

  $('#management-scope-note').textContent=role==='admin'?'Admin có thể quản lý tất cả lớp và nhân viên.':`Bạn đang xem các lớp được phân công cho tài khoản ${({assistant:'trợ giảng',office:'văn phòng',teacher:'giáo viên'})[role]}.`;
  const editable=getVisibleClassesForAccount();
  $('#management-class-count').textContent=`${editable.length} lớp`;
  const allQuick = $('#all-classes-quick-list');
  if (allQuick) {
    allQuick.innerHTML = classCatalog.map(item => {
      const date = occurrenceDate(item);
      return `<article class="shift-card" style="cursor:pointer;" data-enter-class="${escapeHtml(item.id)}" data-session-date="${date.toLocaleDateString('sv-SE')}">
        <div class="shift-card-icon"></div>
        <div class="shift-card-main">
          <div class="shift-card-title">
            <strong style="font-size:16px; color:#214e2d;">${escapeHtml(item.code || item.name)}</strong>
            <span class="room-chip" style="background:#eaf5ec; color:#27673b; font-weight:700;">${escapeHtml(formatBirthYearInline(item.grade))}</span>
            <span class="room-chip" style="background:#f2f5f2; color:#556858;">${escapeHtml(item.room || 'Phòng học')}</span>
          </div>
          <p>${escapeHtml(item.subject || 'Lớp học')} · ${escapeHtml(item.name)}</p>
          <div class="shift-card-details">
            <span> ${weekdayNames[item.weekday]} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</span>
            <span>GV: ${escapeHtml(item.teacherName || '—')} · TA: ${escapeHtml(item.assistantName || '—')}</span>
          </div>
        </div>
        <button type="button" class="primary-button" data-enter-class="${escapeHtml(item.id)}" data-session-date="${date.toLocaleDateString('sv-SE')}">Vào lớp</button>
      </article>`;
    }).join('') || '<div class="menu-empty">Chưa có lớp học nào trong hệ thống.</div>';
  }managed.innerHTML=editable.map(item=>`<article class="managed-class-card"><div class="managed-class-header-stack"><div class="managed-class-header-row1"><strong class="managed-class-title">${escapeHtml(item.name)}</strong><div class="managed-class-heading-right"><span class="room-chip">${escapeHtml(item.room||'Chưa xếp phòng')}</span><div class="card-more-menu-wrap"><button type="button" class="outline-button card-more-toggle-btn" data-toggle-card-more="${escapeHtml(item.id)}" aria-label="Tùy chọn quản lý lớp" title="Tùy chọn quản trị lớp">⋯</button><div class="card-more-dropdown" hidden><button type="button" class="card-more-item" data-roster-class="${escapeHtml(item.id)}">Danh sách gốc</button><button type="button" class="card-more-item" data-edit-class="${escapeHtml(item.id)}">Sửa lớp</button><button type="button" class="card-more-item" data-edit-session="${escapeHtml(item.id)}">Đổi lịch buổi</button>${role==='admin'?`<button type="button" class="card-more-item" data-admin-log-class="${escapeHtml(item.id)}" style="color:#4f46e5; font-weight:700;">🛡 Nhật ký Admin (Log)</button>`:''}<button type="button" class="card-more-item text-danger" data-delete-class="${escapeHtml(item.id)}">Xóa lớp</button></div></div></div></div><div class="managed-class-header-row2"><span class="room-chip" style="background:#eaf5ec; color:#27673b; font-weight:700;">MÃ: ${escapeHtml(item.code||item.id)}</span><span class="room-chip" style="background:#f0f4f8; color:#3d4d5c; font-weight:600;">${escapeHtml(formatBirthYearInline(item.grade))}</span><span class="room-chip" style="background:#f5f3ff; color:#5b21b6; font-weight:600;">${escapeHtml(item.subject||'Chưa có môn học')}</span></div></div><div class="managed-class-details managed-class-grid-2col"><span><small>Giáo viên · ${escapeHtml((item.teacherIds||[item.teacherId]).map(id=>masterData.employees.find(employee=>employee.id===id)?.code||'').filter(Boolean).join(', '))}</small>${escapeHtml(item.teacherName)}</span><span><small>Trợ giảng · ${escapeHtml((item.assistantIds||[]).map(id=>masterData.employees.find(employee=>employee.id===id)?.code||'').filter(Boolean).join(', '))}</small>${escapeHtml(item.assistantName)}</span><span><small>Văn phòng · ${escapeHtml((item.officeIds||[]).map(id=>masterData.employees.find(employee=>employee.id===id)?.code||'').filter(Boolean).join(', '))}</small>${escapeHtml(employeeNames(item.officeIds||[]))}</span><span><small>Lịch học</small>${weekdayNames[item.weekday]} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</span><span><small>Sơ đồ mặc định</small>${item.defaultLayout.length} dãy · ${item.defaultLayout.map(row=>row.desks.length).join(' / ')} bàn</span><span><small>Checklist & Nhắc việc</small>${item.defaultChecklist.startItems.length} đầu · ${item.defaultChecklist.endItems.length} cuối · ${item.defaultNotifications.length} mốc</span></div><div class="managed-class-actions managed-class-primary-actions managed-class-single-action"><button type="button" class="outline-button btn-view-class-history" data-class-history="${escapeHtml(item.id)}" style="width:100%; justify-content:center; font-weight:700;">Tổng quan & Lịch sử</button></div></article>`).join('')||'<div class="menu-empty">Chưa có lớp nào trong danh sách.</div>';if($('#add-class-button'))$('#add-class-button').hidden=!(role==='office'||role==='admin');if($('#manage-employees-button'))$('#manage-employees-button').hidden=role!=='admin';
  if($('#mgmt-tab-staff')){$('#mgmt-tab-staff').hidden=role!=='admin';$('#mgmt-tab-staff').style.display=role==='admin'?'':'none';}
  if($('#mgmt-tab-admin-log')){$('#mgmt-tab-admin-log').hidden=role!=='admin';$('#mgmt-tab-admin-log').style.display=role==='admin'?'':'none';}
  if(role!=='admin'&&$('#mgmt-panel-staff')&&!$('#mgmt-panel-staff').hidden){$('#mgmt-panel-staff').hidden=true;if($('#staff-table-tbody'))$('#staff-table-tbody').innerHTML='';$('#mgmt-tab-classes')?.click();}
}
function setMainMenuPanel(panel){
  try {
    if (location.pathname !== '/' && location.pathname !== '/class') {
      history.pushState({}, '', '/');
    } else {
      const url = new URL(location.href);
      if (url.searchParams.has('view') || url.searchParams.has('class') || url.searchParams.has('date')) {
        url.search = '';
        url.hash = '';
        history.pushState({}, '', '/');
      }
    }
  } catch {}
  if ($('#main-menu-view')) {
    $('#main-menu-view').hidden = false;
    $('#main-menu-view').style.display = '';
  }
  if ($('#class-workspace')) {
    $('#class-workspace').hidden = true;
    $('#class-workspace').style.display = '';
  }
  if ($('#class-general-view')) {
    $('#class-general-view').hidden = true;
    $('#class-general-view').style.display = '';
  }
  if ($('#class-nav-group')) $('#class-nav-group').hidden = true;
  if ($('#class-nav-label')) $('#class-nav-label').hidden = true;
  if ($('#main-menu-shortcut')) $('#main-menu-shortcut').hidden = true;
  $('#topbar-crumb-label').textContent='Menu chính';
  const crumbSub = document.querySelector('.crumb strong') || $('#topbar-crumb-sub');
  const panelTitles = { work: 'Đi làm', tutoring: 'Lớp bổ trợ', management: 'Quản lý', portal: 'Chấm công của tôi' };
  if (crumbSub) crumbSub.textContent = panelTitles[panel] || 'Đi làm';

  $('#work-menu-panel').hidden = panel !== 'work';
  const tutoringPanel = $('#tutoring-menu-panel');
  if (tutoringPanel) tutoringPanel.hidden = panel !== 'tutoring';
  $('#management-menu-panel').hidden = panel !== 'management';
  const portalPanel = $('#portal-menu-panel');
  if (portalPanel) portalPanel.hidden = panel !== 'portal';

  $('#work-menu-tab')?.classList.toggle('active', panel === 'work');
  $('#tutoring-menu-tab-btn')?.classList.toggle('active', panel === 'tutoring');
  $('#management-menu-tab')?.classList.toggle('active', panel === 'management');
  $('#portal-menu-tab-btn')?.classList.toggle('active', panel === 'portal');

  $('#work-menu-nav')?.classList.toggle('active', panel === 'work');
  $('#tutoring-menu-nav')?.classList.toggle('active', panel === 'tutoring');
  $('#management-menu-nav')?.classList.toggle('active', panel === 'management');
  $('#portal-menu-nav')?.classList.toggle('active', panel === 'portal');

  if (panel === 'work' || panel === 'management') {
    renderMainMenu();
  } else if (panel === 'tutoring' && window.__featuresApp?.renderTutoringModule) {
    window.__featuresApp.renderTutoringModule();
  } else if (panel === 'portal' && window.__featuresApp?.renderTAPortal) {
    window.__featuresApp.renderTAPortal();
  }
}
function showClassWorkspace(){
  const item = activeClassConfig();
  if (!item) return;
  if ($('#main-menu-view')) {
    $('#main-menu-view').hidden = true;
    $('#main-menu-view').style.display = '';
  }
  if ($('#class-general-view')) {
    $('#class-general-view').hidden = true;
    $('#class-general-view').style.display = '';
  }
  if ($('#class-workspace')) {
    $('#class-workspace').hidden = false;
    $('#class-workspace').style.display = '';
  }
  if ($('#class-nav-group')) $('#class-nav-group').hidden = false;
  if ($('#class-nav-label')) $('#class-nav-label').hidden = false;
  if ($('#main-menu-shortcut')) $('#main-menu-shortcut').hidden = false;
  if ($('#topbar-crumb-label')) $('#topbar-crumb-label').textContent = 'Lớp của tôi';
  
  if ($('#active-class-name')) $('#active-class-name').textContent = item.code || item.name;
  if ($('#active-class-subject')) $('#active-class-subject').textContent = (item.subject || 'LỚP HỌC').toLocaleUpperCase('vi');
  if ($('#active-class-code-badge')) $('#active-class-code-badge').textContent = `MÃ: ${item.code || item.id}`;
  if ($('#active-class-grade-badge')) $('#active-class-grade-badge').textContent = formatBirthYearBadge(item.grade);
  if ($('#active-class-room')) $('#active-class-room').textContent = item.room || 'Phòng học';
  
  const activeChange = getSessionChange(item.id, checklistDate);
  if ($('#active-class-teacher')) $('#active-class-teacher').textContent = employeeNames(assignedIdsFor(item, activeChange, 'teacher'));
  const assistantNode = $('#class-session-assistants');
  if (assistantNode) assistantNode.textContent = 'Trợ giảng: ' + employeeNames(assignedIdsFor(item, activeChange, 'assistant'));
  
  const eyebrow = $('#class-session-eyebrow');
  if (eyebrow) {
    const isMakeup = activeChange?.status === 'makeup';
    eyebrow.textContent = `${isMakeup ? 'HỌC BÙ · ' : ''}${weekdayNames[item.weekday]?.toLocaleUpperCase('vi') || ''} · ${formatSessionDate(new Date(`${checklistDate}T00:00:00`))} · CA ${item.startTime}–${item.endTime}`;
  }
  
  const crumbStrong = document.querySelector('.crumb strong');
  if (crumbStrong) crumbStrong.textContent = `${item.code || item.name} · ${item.subject || 'Lớp học'}`;
  
  const sessionStart = classScheduleStamp(item, new Date(`${checklistDate}T00:00:00`));
  const [endH, endM] = String(item.endTime || '17:00').split(':').map(Number);
  const sessionEnd = new Date(`${checklistDate}T00:00:00`);
  sessionEnd.setHours(endH || 17, endM || 0, 0, 0);
  const activeNow = new Date() >= sessionStart && new Date() < sessionEnd;
  const legacyBadge = document.querySelector('.class-page-heading .session-badge');
  if (legacyBadge) legacyBadge.innerHTML = `<span></span> ${activeNow ? 'Đang diễn ra' : 'Ca sắp tới'}`;
  
  if ($('#chat-class-label')) $('#chat-class-label').textContent = `TRAO ĐỔI TRONG CA · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;
  if ($('#checklist-class-label')) $('#checklist-class-label').textContent = `CA ${item.startTime}–${item.endTime} · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;
  if ($('#student-list-class-label')) $('#student-list-class-label').textContent = `DANH SÁCH LỚP · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;
  if ($('#scores-class-label')) $('#scores-class-label').textContent = `NHẬP ĐIỂM TRONG CA · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;

  setClassView('seating');
  render();
  window.__featuresApp?.onClassWorkspaceOpened?.();
}
function reloadClassSessionData(classId, date) {
  CURRENT_CLASS_ID = classId;
  checklistDate = date;
  configClass = activeClassConfig();

  const loaded = loadStudentRecords(CURRENT_CLASS_ID);
  students = loaded.students;
  makeupStudents = loaded.makeupStudents;

  const cfg = activeClassConfig();
  layout = read(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`, null);
  if (!Array.isArray(layout) || !layout.length) {
    layout = structuredClone(cfg?.defaultLayout || baseLayout);
  }

  lateQueue = read(`lopvui.late-queue.v6.${CURRENT_CLASS_ID}.${checklistDate}`, []);
  attendanceNotes = read(`lopvui.attendance-notes.v1.${CURRENT_CLASS_ID}.${checklistDate}`, {});
  classCommunication = loadClassCommunication(CURRENT_CLASS_ID, checklistDate);

  const defaultChecklistItems = (cfg?.defaultChecklist?.startItems || ['Lau bảng','Bật đèn và kiểm tra quạt/điều hòa','Chuẩn bị tài liệu và bài tập','Kiểm tra bàn ghế, cửa sổ và phòng học']).map((label, index) => ({ id: `default-${index+1}`, label, done: false }));
  const defaultEndChecklistItems = (cfg?.defaultChecklist?.endItems || []).map((label, index) => ({ id: `end-default-${index+1}`, label, done: false }));
  const chkKey = `lopvui.checklist.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
  checklist = read(chkKey, { items: defaultChecklistItems.map(item => ({ ...item, done: false })), classNote: '', tests: {}, testCollectionMode: false, handover: null, workStart: null });
  checklist.items = Array.isArray(checklist.items) ? checklist.items : defaultChecklistItems.map(item => ({ ...item, done: false }));
  checklist.endItems = Array.isArray(checklist.endItems) ? checklist.endItems : defaultEndChecklistItems.map(item => ({ ...item }));
  mergeReminderItems(checklist.items, 'start');
  mergeReminderItems(checklist.endItems, 'end');

  deskItems = read(`lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}`, null);
  if (!deskItems || typeof deskItems !== 'object') {
    deskItems = {};
  }
  const histRecord = window.__featuresApp?.getSessionRecord ? window.__featuresApp.getSessionRecord(CURRENT_CLASS_ID, checklistDate) : null;
  if ((!deskItems || !Object.keys(deskItems).length) && histRecord?.deskItems) {
    deskItems = structuredClone(histRecord.deskItems);
  }
  if ((!layout || !layout.length) && histRecord?.layout) {
    layout = structuredClone(histRecord.layout);
  }
  if (histRecord?.lessonTitle) {
    checklist.lessonTitle = histRecord.lessonTitle;
    const titleInput = $('#lesson-title');
    if (titleInput && document.activeElement !== titleInput) titleInput.value = histRecord.lessonTitle;
  }
  if (histRecord?.finalNote) {
    checklist.classNote = histRecord.finalNote;
    const noteInput = $('#session-note');
    if (noteInput && document.activeElement !== noteInput) noteInput.value = histRecord.finalNote;
  }
  for (const { desk } of desks()) {
    deskItems[desk.id] = deskItems[desk.id] || [];
  }

  // Hydrate attendanceNotes & scope student transient fields (.attendance, .homework) strictly to (CURRENT_CLASS_ID, checklistDate)
  const seatedEntries = allEntries().filter(e => e.entry.studentId);
  const seatedMap = new Map(seatedEntries.map(e => [e.entry.studentId, e.entry]));
  const lateSet = new Set(lateQueue);

  for (const student of [...students, ...makeupStudents]) {
    const savedNote = student.sessionNotes?.find(note => note.classId === CURRENT_CLASS_ID && note.date === checklistDate);
    if (!(student.id in attendanceNotes) && savedNote?.note) {
      attendanceNotes[student.id] = savedNote.note;
    }

    const seatedEntry = seatedMap.get(student.id);
    const snapEntry = histRecord?.studentsSnapshot?.find(s => s.studentId === student.id);
    const attHistEntry = (student.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
    const scoreEntry = (student.scores || []).find(sc => sc.classId === CURRENT_CLASS_ID && sc.date === checklistDate && sc.type !== 'BTVN');

    const resolvedArrivalTime = seatedEntry?.attendance?.arrivalTime || attHistEntry?.time || attHistEntry?.arrivalTime || snapEntry?.attendance?.arrivalTime || null;
    if (seatedEntry) {
      student.attendance = seatedEntry.attendance || attHistEntry || { status: 'present' };
      if (resolvedArrivalTime && student.attendance) student.attendance.arrivalTime = resolvedArrivalTime;
      student.homework = seatedEntry.homework || (savedNote?.homeworkStatus ? { status: savedNote.homeworkStatus, score: savedNote.homeworkScore ?? null, reason: savedNote.homeworkReason || '' } : { status: 'uncollected' });
      student.arrivalTime = resolvedArrivalTime;
    } else if (lateSet.has(student.id)) {
      const det = resolveLateDetails(student, { attendance: attHistEntry || student.attendance });
      student.attendance = attHistEntry
        ? { ...attHistEntry, status: det.isLate ? 'late' : 'present', arrivalTime: resolvedArrivalTime || det.arrivalTime, lateMinutes: det.lateMinutes, minutesLate: det.lateMinutes }
        : { status: det.isLate ? 'late' : 'present', arrivalTime: resolvedArrivalTime || det.arrivalTime, lateMinutes: det.lateMinutes, minutesLate: det.lateMinutes };
      student.homework = savedNote?.homeworkStatus ? { status: savedNote.homeworkStatus, score: savedNote.homeworkScore ?? null, reason: savedNote.homeworkReason || '' } : { status: 'uncollected' };
      student.arrivalTime = resolvedArrivalTime || det.arrivalTime;
    } else if (attHistEntry) {
      student.attendance = { status: attHistEntry.status, arrivalTime: resolvedArrivalTime, reason: attHistEntry.reason || '', lateMinutes: attHistEntry.lateMinutes || attHistEntry.minutesLate || 0, minutesLate: attHistEntry.minutesLate || attHistEntry.lateMinutes || 0 };
      student.homework = savedNote?.homeworkStatus ? { status: savedNote.homeworkStatus, score: savedNote.homeworkScore ?? null, reason: savedNote.homeworkReason || '' } : (attHistEntry.homework || { status: 'uncollected' });
      student.arrivalTime = resolvedArrivalTime;
    } else if (snapEntry) {
      student.attendance = snapEntry.attendance || null;
      student.homework = snapEntry.homework || { status: 'uncollected' };
      student.arrivalTime = resolvedArrivalTime;
    } else {
      student.attendance = null;
      student.homework = { status: 'uncollected' };
      student.arrivalTime = null;
      student.lateMinutes = 0;
    }
    if (student.homework?.status === 'graded') student.homework.status = 'submitted';
    if (seatedEntry?.homework?.status === 'graded') seatedEntry.homework.status = 'submitted';

    student.testScore = seatedEntry?.testScore ?? checklist.testScores?.[student.id] ?? snapEntry?.testScore ?? scoreEntry?.score ?? null;
  }
}


let isClassHistoryViewMode = false;

function resolveClass(ref) {
  if (!ref) return null;
  const catalog = classCatalog || [];
  const clean = String(ref).trim().toLowerCase();
  if (clean === 'class-tutoring' || clean === 'botro' || clean === 'lop-bo-tro') {
    return TUTORING_CLASS_CONFIG;
  }
  return catalog.find(c => (c.code && c.code.toLowerCase() === clean) || c.id.toLowerCase() === clean) || null;
}

function resolveStudent(ref) {
  if (!ref) return null;
  const all = [...(students || []), ...(makeupStudents || [])];
  const clean = String(ref).trim().toLowerCase();
  return all.find(s => (s.studentCode && s.studentCode.toLowerCase() === clean) || s.id.toLowerCase() === clean) || null;
}

function highlightStudentSeat(studentId) {
  const person = studentById(studentId);
  const targetBtn = Array.from(document.querySelectorAll('.seat.occupied')).find(el => {
    const deskId = el.dataset.deskId;
    const idx = Number(el.dataset.entryIndex);
    const entry = deskItems[deskId]?.[idx];
    return entry && entry.studentId === studentId;
  });
  if (targetBtn) {
    document.querySelectorAll('.seat-target-highlighted').forEach(b => b.classList.remove('seat-target-highlighted'));
    targetBtn.classList.add('seat-target-highlighted');
    targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Đang làm nổi bật vị trí ngồi của ${person?.name || 'học sinh'} trong buổi học.`);
  } else {
    toast(`Học sinh ${person?.name || ''} chưa ngồi vào bàn hoặc vắng mặt trong buổi học này.`);
  }
}

function resetSessionForNewShift(classId, date, staffName) {
  const cfg = classCatalog.find(c => c.id === classId);
  const defaultLayout = cfg?.defaultLayout || baseLayout;
  layout = structuredClone(defaultLayout);
  deskItems = {};
  lateQueue = [];
  localStorage.setItem(`lopvui.layout.v5.${classId}.${date}`, JSON.stringify(layout));
  localStorage.setItem(`lopvui.desk-items.v7.${classId}.${date}`, JSON.stringify({}));
  localStorage.setItem(`lopvui.late-queue.v6.${classId}.${date}`, JSON.stringify([]));
  localStorage.setItem(`lopvui.finalized-session.v1.${classId}.${date}`, JSON.stringify({ closed: true, date: Date.now(), staff: staffName }));
  for (const { desk } of desks()) {
    deskItems[desk.id] = [];
  }
  render();
}

let activeGeneralTab = 'history';

function setGeneralViewTab(tabName = 'history') {
  activeGeneralTab = tabName === 'students' ? 'students' : 'history';
  const histBtn = $('#general-tab-history-btn');
  const stuBtn = $('#general-tab-students-btn');
  const histPanel = $('#general-panel-history');
  const stuPanel = $('#general-panel-students');
  if (histBtn) histBtn.classList.toggle('active', activeGeneralTab === 'history');
  if (stuBtn) stuBtn.classList.toggle('active', activeGeneralTab === 'students');
  if (histPanel) histPanel.hidden = activeGeneralTab !== 'history';
  if (stuPanel) stuPanel.hidden = activeGeneralTab !== 'students';
}

function renderClassGeneralView(classId, preferredTab = null) {
  const cls = resolveClass(classId) || activeClassConfig();
  if (!cls) return;
  CURRENT_CLASS_ID = cls.id;

  if (preferredTab) {
    setGeneralViewTab(preferredTab);
  } else {
    setGeneralViewTab(activeGeneralTab || 'history');
  }

  if ($('#main-menu-shortcut')) $('#main-menu-shortcut').hidden = true;
  $('#topbar-crumb-label').textContent = 'Tổng quan lớp học';
  const crumbSub = document.querySelector('.crumb strong') || $('#topbar-crumb-sub');
  if (crumbSub) crumbSub.textContent = `${cls.code || cls.id} · ${cls.name}`;

  if ($('#general-class-name')) $('#general-class-name').textContent = cls.name || cls.code;
  if ($('#general-class-subject')) $('#general-class-subject').textContent = (cls.subject || 'LỚP HỌC').toLocaleUpperCase('vi');
  if ($('#general-class-code-badge')) $('#general-class-code-badge').textContent = `MÃ: ${cls.code || cls.id}`;
  if ($('#general-class-grade-badge')) $('#general-class-grade-badge').textContent = formatBirthYearBadge(cls.grade);
  if ($('#general-class-room')) $('#general-class-room').textContent = cls.room || 'Phòng học';
  if ($('#general-class-teacher')) $('#general-class-teacher').textContent = cls.teacherName || 'Chưa xếp GV';
  if ($('#general-class-assistants')) $('#general-class-assistants').textContent = 'Trợ giảng: ' + (cls.assistantName || 'Chưa xếp TA');
  if ($('#general-class-schedule')) $('#general-class-schedule').textContent = `${weekdayNames[cls.weekday] || 'Lịch'} · ${cls.startTime}–${cls.endTime}`;

  const roster = students.filter(s => (s.classIds || []).includes(cls.id));
  const classMakeupsForGeneral = []; // Học sinh học bù chỉ xuất hiện trong đúng buổi học hôm đó, không hiện trong danh sách lớp cố định
  if ($('#general-roster-count')) $('#general-roster-count').textContent = `${roster.length} học sinh${classMakeupsForGeneral.length ? ` (+${classMakeupsForGeneral.length} học bù)` : ''}`;
  if ($('#general-stat-total')) $('#general-stat-total').textContent = roster.length;

  const allHist = window.__featuresApp?.loadSessionHistory ? window.__featuresApp.loadSessionHistory() : (typeof sessionHistoryRepo.loadSessionHistory === 'function' ? sessionHistoryRepo.loadSessionHistory() : []);
  const classSessions = allHist.filter(s => s.classId === cls.id).sort((a, b) => b.date.localeCompare(a.date));

  if ($('#general-stat-sessions')) $('#general-stat-sessions').textContent = classSessions.length;
  if ($('#general-history-count')) $('#general-history-count').textContent = `${classSessions.length} buổi`;

  let totalRecorded = 0;
  let totalPresent = 0;
  let totalHwDone = 0;
  let totalHwPossible = 0;

  classSessions.forEach(s => {
    if (s.stats) {
      totalRecorded += (s.stats.total || s.studentsSnapshot?.length || 0);
      totalPresent += (s.stats.present || 0);
      if (!s.noHomework && s.hasBtvn !== false) {
        totalHwDone += (s.stats.homeworkDone || 0);
        totalHwPossible += (s.stats.present || s.stats.total || 0);
      }
    }
  });

  const attRate = totalRecorded ? Math.round((totalPresent / totalRecorded) * 100) : 100;
  const hwRate = totalHwPossible ? Math.round((totalHwDone / totalHwPossible) * 100) : 100;

  if ($('#general-stat-attendance')) $('#general-stat-attendance').textContent = `${attRate}%`;
  if ($('#general-stat-homework')) $('#general-stat-homework').textContent = `${hwRate}%`;

  // Wire tab buttons
  const histTabBtn = $('#general-tab-history-btn');
  const stuTabBtn = $('#general-tab-students-btn');
  if (histTabBtn) histTabBtn.onclick = () => setGeneralViewTab('history');
  if (stuTabBtn) stuTabBtn.onclick = () => setGeneralViewTab('students');

  // TAB 1: Render past sessions list
  const listEl = $('#general-history-sessions-list');
  if (listEl) {
    if (!classSessions.length) {
      listEl.innerHTML = '<div class="menu-empty" style="padding:20px; text-align:center;">Lớp chưa có buổi học nào được ghi nhận trong lịch sử. Bấm "▶ Vào lớp (Mở ca mới)" ở trên để bắt đầu.</div>';
    } else {
      listEl.innerHTML = classSessions.map(s => {
        const isClosed = s.status === 'closed';
        const dFormatted = new Date(`${s.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        const staff = s.closedBy?.name || s.startedBy?.name || s.assistantName || 'Trợ giảng';
        const hasTestBadge = s.hasTest || (s.studentsSnapshot || []).some(st => st.testScore !== null && st.testScore !== undefined)
          ? '<span class="room-chip" style="background:#f5f3ff; color:#5b21b6; font-weight:700; font-size:13px;">Có bài Test</span>'
          : '';
        const hasBtvnBadge = (s.hasBtvn !== false && !s.noHomework)
          ? '<span class="room-chip" style="background:#f0fdf4; color:#166534; font-weight:700; font-size:13px;">Thu BTVN</span>'
          : '<span class="room-chip" style="background:#f3f4f6; color:#4b5563; font-size:13px;">Không có BTVN</span>';

        return `
          <div class="portal-stat-card general-session-card" data-open-session-card="${escapeHtml(s.date)}" style="padding:13px 16px; background:#fff; border:1px solid #dce5dd; border-radius:9px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong style="color:#21442a; font-size:15.5px;">${escapeHtml(dFormatted)}</strong>
                <span class="room-chip" style="font-size:15.5px; background:${isClosed ? '#eaf5ec' : '#fef3c7'}; color:${isClosed ? '#2e6d42' : '#92400e'}; font-weight:700;">
                  ${isClosed ? '✓ Đã đóng ca' : '● Đang mở'}
                </span>
                ${hasBtvnBadge}
                ${hasTestBadge}
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="outline-button" data-score-history-date="${escapeHtml(s.date)}" style="padding:7px 12px; font-size:13px; background:#f5f3ff; color:#5b21b6; border-color:#c4b5fd; font-weight:700;">
                  Nhập / Xem điểm
                </button>
                <button type="button" class="primary-button" data-view-history-date="${escapeHtml(s.date)}" style="padding:7px 12px; font-size:13px; background:#2e6d42; font-weight:700;">
                  ${isClosed ? 'Xem lại ca học' : 'Vào ca trực (Live)'}
                </button>
                ${selectedRole() === 'admin' ? `<button type="button" class="outline-button btn-admin-log" data-admin-log-session-date="${escapeHtml(s.date)}" style="padding:7px 11px; font-size:13px;" title="Xem Nhật ký Admin Log của ca học ngày ${escapeHtml(dFormatted)} (Chỉ Admin thấy)">🛡 Admin Log</button>` : ''}
                <button type="button" class="outline-button" data-edit-session-date="${escapeHtml(s.date)}" style="padding:7px 11px; font-size:13px; font-weight:700; color:#1e40af; border-color:#bfdbfe; background:#eff6ff;" title="Sửa thông tin ca học này">
                  ✎ Sửa ca
                </button>
                <button type="button" class="outline-button text-danger" data-delete-session-date="${escapeHtml(s.date)}" style="padding:7px 11px; font-size:13px; font-weight:700; color:#b91c1c; border-color:#fca5a5; background:#fef2f2;" title="Xoá ca học này và xoá dữ liệu buổi học trong hồ sơ học sinh">
                  🗑 Xoá ca
                </button>
              </div>
            </div>
            <p style="margin:2px 0 6px; font-size:14.5px; color:#2b4231; font-weight:700;">
              Bài học: ${escapeHtml(s.lessonTitle || 'Buổi học ' + s.date)}
            </p>
            <div style="display:flex; gap:14px; font-size:13.5px; color:#5e7164; flex-wrap:wrap;">
              <span>Trực ca: <strong>${escapeHtml(staff)}</strong></span>
              <span>Có mặt: <strong style="color:#2e6d42;">${s.stats?.present || 0}/${s.stats?.total || s.studentsSnapshot?.length || 0}</strong></span>
              <span>Đi muộn: <strong style="color:#bc7b26;">${s.stats?.late || 0}</strong></span>
              <span>Vắng: <strong style="color:#c13b30;">${s.stats?.absent || 0}</strong></span>
              <span>BTVN: <strong>${s.stats?.homeworkDone || 0}</strong></span>
            </div>
            ${s.finalNote ? `<p style="margin:6px 0 0; font-size:13.5px; color:#556658; font-style:italic; border-top:1px dashed #e2e8e3; padding-top:4px;">"${escapeHtml(s.finalNote)}"</p>` : ''}
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-score-history-date]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const d = btn.dataset.scoreHistoryDate;
          const sess = classSessions.find(x => x.date === d);
          const isClosed = Boolean(sess && sess.status === 'closed');
          enterClass(cls.id, d, isClosed, 'scores');
          updateSubtabUrl('scores');
        };
      });
      listEl.querySelectorAll('[data-view-history-date]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const d = btn.dataset.viewHistoryDate;
          const sess = classSessions.find(x => x.date === d);
          const isClosed = Boolean(sess && sess.status === 'closed');
          if (!isClosed) {
            enterClass(cls.id, d, false, 'seating');
            updateSubtabUrl('map');
          } else {
            navigateTo(`class/${cls.code || cls.id}/history/${d}/map`);
          }
        };
      });
      listEl.querySelectorAll('[data-admin-log-session-date]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          openSessionAdminLogDialog(cls.id, btn.dataset.adminLogSessionDate);
        };
      });
      listEl.querySelectorAll('[data-edit-session-date]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          openManagePastSessionDialog(cls.id, btn.dataset.editSessionDate);
        };
      });
      listEl.querySelectorAll('[data-delete-session-date]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          deleteClassSessionAndStudentData(cls.id, btn.dataset.deleteSessionDate);
        };
      });
      listEl.querySelectorAll('[data-open-session-card]').forEach(card => {
        card.onclick = (e) => {
          if (e.target.closest('button')) return;
          const d = card.dataset.openSessionCard;
          const sess = classSessions.find(x => x.date === d);
          const isClosed = Boolean(sess && sess.status === 'closed');
          if (!isClosed) {
            enterClass(cls.id, d, false, 'seating');
            updateSubtabUrl('map');
          } else {
            navigateTo(`class/${cls.code || cls.id}/history/${d}/map`);
          }
        };
      });
    }
  }

  // TAB 2: Render class student table with 4 most recent sessions timeline columns:
  // Họ đệm | Tên | Trường | [23/9 | BTVN | TEST | 30/9 | BTVN | 7/10 | TEST | 14/10 | BTVN] | Ghi chú học lực
  const rosterThead = $('#general-roster-thead');
  const rosterTbody = $('#general-roster-table-body');
  const genWarnFilter = $('#general-student-warning-filter');
  if (genWarnFilter && !genWarnFilter.dataset.bound) {
    genWarnFilter.dataset.bound = '1';
    genWarnFilter.addEventListener('change', () => renderClassGeneralView(cls.id, 'students'));
  }
  if (rosterThead && rosterTbody) {
    const warnFilterMode = genWarnFilter?.value || 'all';
    const rawCombinedStudents = [
      ...[...roster].sort((a, b) => {
        const aG = a.givenName || splitStudentName(a.name).givenName;
        const bG = b.givenName || splitStudentName(b.name).givenName;
        return aG.localeCompare(bG, 'vi') || (a.familyName || '').localeCompare(b.familyName || '', 'vi');
      }),
      ...classMakeupsForGeneral
    ];
    const combinedStudents = warnFilterMode === 'warning'
      ? rawCombinedStudents.filter(s => evaluateStudentEarlyWarning(s, cls.id, classSessions).hasWarning)
      : rawCombinedStudents;

    // Take the 4 most recent sessions, ordered chronologically from left to right (oldest -> newest of the 4)
    const recent4Chronological = classSessions.slice(0, 4).reverse();
    const timelineCols = [];

    for (const sess of recent4Chronological) {
      const shortDM = formatShortDayMonth(sess.date);
      timelineCols.push({
        kind: 'att',
        date: sess.date,
        shortDM,
        lessonTitle: sess.lessonTitle || `Buổi ${shortDM}`,
        session: sess
      });

      // Check if this session had BTVN collection
      const hasBtvn = sess.hasBtvn !== undefined
        ? Boolean(sess.hasBtvn)
        : (!sess.noHomework && (
            (sess.studentsSnapshot || []).some(st => st.homework?.score !== null && st.homework?.score !== undefined || st.homework?.status === 'submitted' || st.homework?.status === 'graded' || st.homework?.status === 'not_submitted')
            || combinedStudents.some(stu => (stu.sessionNotes || []).some(sn => sn.classId === cls.id && sn.date === sess.date && (sn.homeworkScore !== null && sn.homeworkScore !== undefined || sn.homeworkStatus === 'graded' || sn.homeworkStatus === 'submitted' || sn.homeworkStatus === 'not_submitted')))
          ));
      if (hasBtvn) {
        timelineCols.push({
          kind: 'btvn',
          date: sess.date,
          shortDM,
          lessonTitle: sess.lessonTitle || `Buổi ${shortDM}`,
          session: sess
        });
      }

      // Check if this session had a TEST
      const hasTest = sess.hasTest !== undefined
        ? Boolean(sess.hasTest)
        : (
            (sess.studentsSnapshot || []).some(st => st.testScore !== null && st.testScore !== undefined)
            || combinedStudents.some(stu =>
                (stu.sessionNotes || []).some(sn => sn.classId === cls.id && sn.date === sess.date && sn.testScore !== null && sn.testScore !== undefined)
                || (stu.scores || []).some(sc => sc.classId === cls.id && sc.date === sess.date && sc.type && sc.type.toLowerCase() !== 'btvn')
              )
          );
      if (hasTest) {
        timelineCols.push({
          kind: 'test',
          date: sess.date,
          shortDM,
          lessonTitle: sess.lessonTitle || `Buổi ${shortDM}`,
          session: sess
        });
      }
    }

    rosterThead.innerHTML = `
      <tr>
        <th>Họ đệm</th>
        <th>Tên</th>
        <th>Trường</th>
        ${timelineCols.map(col => {
          if (col.kind === 'att') {
            return `<th class="timeline-date-th" title="Điểm danh ngày ${escapeHtml(col.shortDM)}: ${escapeHtml(col.lessonTitle)}">${escapeHtml(col.shortDM)}</th>`;
          }
          if (col.kind === 'btvn') {
            return `<th class="timeline-btvn-th" title="Điểm BTVN ngày ${escapeHtml(col.shortDM)}: ${escapeHtml(col.lessonTitle)}">BTVN</th>`;
          }
          return `<th class="timeline-test-th" title="Điểm TEST ngày ${escapeHtml(col.shortDM)}: ${escapeHtml(col.lessonTitle)}">TEST</th>`;
        }).join('')}
        <th style="min-width:180px;">Ghi chú học lực</th>
      </tr>
    `;

    const totalCols = 4 + timelineCols.length;
    if (!combinedStudents.length) {
      rosterTbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center; padding:18px; color:#87968a;">Lớp chưa có học sinh nào.</td></tr>`;
    } else {
      const lookupStudentSessionCell = (stu, col) => {
        const snap = col.session?.studentsSnapshot?.find(x => x.studentId === stu.id);
        const sn = (stu.sessionNotes || []).find(n => (n.classId === cls.id || !n.classId) && n.date === col.date);
        const att = (stu.attendanceHistory || []).find(h => (h.classId === cls.id || !h.classId) && h.date === col.date);
        const dayScores = (stu.scores || []).filter(sc => (sc.classId === cls.id || !sc.classId) && sc.date === col.date);

        const attStatus = snap?.attendance?.status || att?.status || null;
        if (col.kind === 'att') {
          if (attStatus === 'present') return `<span class="att-sym-present" title="Có mặt (${col.shortDM})">✓</span>`;
          if (attStatus === 'late') return `<span class="att-sym-late" title="Đi muộn (${col.shortDM})">M</span>`;
          if (attStatus && attStatus.startsWith('absent')) return `<span class="att-sym-absent" title="Vắng mặt (${col.shortDM})">×</span>`;
          return `<span style="color:#9ca3af;" title="Chưa có dữ liệu">/</span>`;
        }

        if (col.kind === 'btvn') {
          const btvnObj = dayScores.find(sc => !sc.type || sc.type.toLowerCase() === 'btvn');
          const scoreVal = sn?.homeworkScore !== undefined
            ? sn.homeworkScore
            : (snap?.homework?.score !== undefined ? snap.homework.score : btvnObj?.score);
          if (scoreVal !== null && scoreVal !== undefined && scoreVal !== '') {
            return `<strong>${escapeHtml(formatScoreVN(scoreVal, '/'))}</strong>`;
          }
          const hwSt = sn?.homeworkStatus || snap?.homework?.status;
          if (hwSt === 'not_submitted') return `<span class="att-sym-absent" title="Không nộp BTVN">×</span>`;
          if (hwSt === 'submitted') return `<span class="att-sym-present" title="Đã nộp BTVN">✓</span>`;
          return `<span style="color:#9ca3af;">/</span>`;
        }

        if (col.kind === 'test') {
          const testObj = dayScores.find(sc => sc.type && sc.type.toLowerCase() !== 'btvn');
          const testVal = sn?.testScore !== undefined
            ? sn.testScore
            : (snap?.testScore !== undefined ? snap.testScore : testObj?.score);
          if (testVal !== null && testVal !== undefined && testVal !== '') {
            return `<strong>${escapeHtml(formatScoreVN(testVal, '/'))}</strong>`;
          }
          return `<span style="color:#9ca3af;">/</span>`;
        }
        return '/';
      };

      rosterTbody.innerHTML = combinedStudents.map(s => {
        const parts = splitStudentName(s.name);
        const fam = s.familyName ?? parts.familyName;
        const giv = s.givenName ?? parts.givenName;
        const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(cls.id);
        const schoolText = isMakeup ? `Học Bù (${s.sourceClassName || s.school || 'T2'})` : (s.school || '—');

        const timelineCellsHtml = timelineCols.map(col => {
          const cellHtml = lookupStudentSessionCell(s, col);
          const tdClass = col.kind === 'att'
            ? 'timeline-att-td'
            : `timeline-score-td ${col.kind === 'test' ? 'test-col' : ''}`;
          return `<td class="${tdClass}" data-open-general-score-history="${escapeHtml(s.id)}" style="cursor:pointer;" title="Bấm để xem chi tiết lịch sử điểm của ${escapeHtml(s.name)}">${cellHtml}</td>`;
        }).join('');

        return `
          <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
            <td>
              <button type="button" class="student-name-history-btn" data-open-general-score-history="${escapeHtml(s.id)}" style="text-decoration:none; color:${isMakeup ? '#6d28d9' : '#395140'}; font-weight:${isMakeup ? '700' : '500'};" title="Bấm để xem kỹ lịch sử điểm & chuyên cần của ${escapeHtml(s.name)}">${escapeHtml(fam || '—')}</button>
            </td>
            <td>
              <button type="button" class="student-name-history-btn" data-open-general-score-history="${escapeHtml(s.id)}" title="Bấm để xem kỹ lịch sử điểm & chuyên cần của ${escapeHtml(s.name)}">
                <strong style="color:${isMakeup ? '#581c87' : '#1b522c'};">${escapeHtml(giv || s.name)}</strong>
              </button>
              ${(() => {
                const ew = evaluateStudentEarlyWarning(s, cls.id, classSessions);
                const sessPill = ew.totalRecordedCount > 0 ? `<span class="session-count-pill" title="Đã tham gia ${ew.attendedCount}/${ew.totalRecordedCount} buổi của lớp">${ew.attendedCount}/${ew.totalRecordedCount}b</span>` : '';
                const warnPill = ew.hasWarning ? `<span class="early-warning-pill" title="Cảnh báo sớm: ${escapeHtml(ew.tooltip)}">⚠ ${escapeHtml(ew.badgeText)}</span>` : '';
                return renderInlineTags(s) + sessPill + warnPill;
              })()}
            </td>
            <td>
              ${isMakeup ? `<span class="makeup-school-tag">${escapeHtml(schoolText)}</span>` : escapeHtml(schoolText)}
            </td>
            ${timelineCellsHtml}
            <td class="col-allow-wrap">
              <input type="text" class="attendance-note-input" data-general-learning-note="${escapeHtml(s.id)}" value="${escapeHtml(s.learningNotes || '')}" placeholder="Nhập ghi chú học lực..." style="width:100%;" />
            </td>
          </tr>
        `;
      }).join('');

      rosterTbody.querySelectorAll('[data-open-general-score-history]').forEach(el => {
        el.onclick = () => {
          if (el.classList.contains('student-name-history-btn') && window.__featuresApp?.openStudentClassProfile) {
            window.__featuresApp.openStudentClassProfile(el.dataset.openGeneralScoreHistory, cls.id);
          } else {
            openStudentScoreHistoryDialog(el.dataset.openGeneralScoreHistory, cls.id, true);
          }
        };
      });

      rosterTbody.querySelectorAll('[data-general-learning-note]').forEach(inp => {
        inp.addEventListener('input', () => {
          saveStudentLearningNote(inp.dataset.generalLearningNote, inp.value);
        });
      });
    }
  }

  // Setup general view buttons
  if ($('#general-enter-live-btn')) {
    $('#general-enter-live-btn').onclick = () => {
      const todayIso = new Date().toLocaleDateString('sv-SE');
      const rec = window.__featuresApp?.getSessionRecord ? window.__featuresApp.getSessionRecord(cls.id, todayIso) : null;
      if (!rec || rec.status === 'closed') {
        // Initialize fresh session with default room layout and default checklist
        const defaultLay = structuredClone(cls.defaultLayout || baseLayout);
        localStorage.setItem(`lopvui.layout.v5.${cls.id}.${todayIso}`, JSON.stringify(defaultLay));
        localStorage.setItem(`lopvui.desk-items.v7.${cls.id}.${todayIso}`, JSON.stringify({}));
        localStorage.setItem(`lopvui.late-queue.v6.${cls.id}.${todayIso}`, JSON.stringify([]));
        localStorage.setItem(`lopvui.attendance-notes.v1.${cls.id}.${todayIso}`, JSON.stringify({}));
        localStorage.removeItem(`lopvui.finalized-session.v1.${cls.id}.${todayIso}`);
        localStorage.removeItem(`lopvui.checklist.v1.${cls.id}.${todayIso}`);
        window.__featuresApp?.openNewShiftSession?.(cls.id, todayIso);
      }
      navigateTo(`class/${cls.code || cls.id}/live/map`);
    };
  }
  if ($('#general-add-past-session-btn')) {
    $('#general-add-past-session-btn').onclick = () => {
      openManagePastSessionDialog(cls.id, null);
    };
  }
  if ($('#general-edit-class-btn')) {
    $('#general-edit-class-btn').onclick = () => {
      openClassConfig(cls.id);
    };
  }
  if ($('#general-roster-btn')) {
    $('#general-roster-btn').onclick = () => {
      if (window.__featuresApp?.openRosterAdmin) window.__featuresApp.openRosterAdmin(cls.id);
    };
  }
  if ($('#general-back-classes-btn')) {
    $('#general-back-classes-btn').onclick = () => {
      navigateTo('class');
    };
  }
  if ($('#general-export-roster-btn')) {
    $('#general-export-roster-btn').onclick = () => {
      const records = roster.map(s => ({
        student: s,
        seat: '—',
        attendance: null,
        homework: { status: 'uncollected' }
      }));
      window.__featuresApp?.exportRoster?.(cls.name, records) || toast('Đã xuất danh sách lớp.');
    };
  }
}

function enterClass(classId, date, isHistoryMode = false, targetView = 'seating') {
  const cls = resolveClass(classId);
  if (!cls) return;
  CURRENT_CLASS_ID = cls.id;
  checklistDate = date || new Date().toLocaleDateString('sv-SE');
  isClassHistoryViewMode = Boolean(isHistoryMode);

  reloadClassSessionData(CURRENT_CLASS_ID, checklistDate);
  showClassWorkspace();

  const histBanner = $('#history-session-banner');
  const histRecord = window.__featuresApp?.getSessionRecord ? window.__featuresApp.getSessionRecord(CURRENT_CLASS_ID, checklistDate) : null;

  const isActuallyClosed = Boolean(histRecord && histRecord.status === 'closed');
  if (isClassHistoryViewMode && isActuallyClosed) {
    isClassHistoryViewMode = true;
    if (histBanner) {
      histBanner.hidden = false;
      $('#history-banner-date').textContent = new Date(`${checklistDate}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      $('#history-banner-lesson').textContent = `Bài học: ${histRecord?.lessonTitle || '—'}`;
      $('#history-banner-staff').textContent = `Trợ giảng: ${histRecord?.closedBy?.name || histRecord?.assistantName || cls.assistantName || '—'}`;
    }
    const badge = $('#session-status-badge');
    if (badge) {
      badge.className = 'session-badge-state closed';
      badge.innerHTML = '● Đã đóng ca (Lịch sử)';
    }
    if ($('#checklist-close-session-panel')) $('#checklist-close-session-panel').hidden = true;
  } else {
    isClassHistoryViewMode = false;
    if (histBanner) histBanner.hidden = true;
    if ($('#checklist-close-session-panel')) $('#checklist-close-session-panel').hidden = false;
    window.__featuresApp?.updateSessionStateUI?.();
  }
  if ($('#close-session-btn')) $('#close-session-btn').hidden = true;
  if ($('#open-session-btn')) $('#open-session-btn').hidden = true;

  // Setup banner navigation buttons
  if ($('#history-back-general-btn')) {
    $('#history-back-general-btn').onclick = () => navigateTo(`class/${cls.code || cls.id}/general`);
  }
  if ($('#history-switch-live-btn')) {
    $('#history-switch-live-btn').onclick = () => navigateTo(`class/${cls.code || cls.id}/live/map`);
  }
  if ($('#header-class-general-btn')) {
    $('#header-class-general-btn').hidden = Boolean(isClassHistoryViewMode);
    $('#header-class-general-btn').onclick = () => navigateTo(`class/${cls.code || cls.id}/general`);
  }
  if ($('#header-edit-class-btn')) {
    $('#header-edit-class-btn').hidden = (selectedRole() !== 'admin' && selectedRole() !== 'office');
    $('#header-edit-class-btn').onclick = () => openClassConfig(cls.id);
  }
  if ($('#session-admin-log-btn')) {
    updateAdminLogButtonVisibilityAndCount();
    $('#session-admin-log-btn').onclick = () => openSessionAdminLogDialog(CURRENT_CLASS_ID, checklistDate);
  }

  setClassView(targetView === 'chatlog' ? 'chat' : targetView === 'scores' ? 'scores' : targetView === 'checklist' ? 'checklist' : targetView === 'students' ? 'students' : 'seating');
  render();
  window.__featuresApp?.onClassWorkspaceOpened?.();
}

function exitToMainMenu() {
  $('#class-general-view').hidden = true;
  $('#class-workspace').hidden = true;
  $('#main-menu-view').hidden = false;
  setMainMenuPanel('work');
  renderMainMenu();
}

function navigateTo(path, replace = false) {
  const cleanPath = path.replace(/^\//, '');
  const url = '/' + cleanPath;
  try {
    if (replace) {
      history.replaceState({ path: cleanPath }, '', url);
    } else {
      history.pushState({ path: cleanPath }, '', url);
    }
  } catch (e) {
    location.hash = cleanPath;
  }
  handleRoute();
}

function handleRoute() {
  let path = location.hash ? location.hash.replace(/^#\/?/, '') : location.pathname.replace(/^\//, '');
  const params = new URLSearchParams(location.search);
  if (!path && params.get('view') === 'class' && params.get('class')) {
    const c = resolveClass(params.get('class'));
    path = `class/${c?.code || params.get('class')}/live/map`;
  }
  if (!path) path = 'class';

  const parts = path.split('/').filter(Boolean);

  // Route: class
  if (parts[0] === 'class' || parts[0] === 'classes') {
    if (parts.length === 1) {
      exitToMainMenu();
      return;
    }

    const classRef = parts[1];
    const cls = resolveClass(classRef);
    if (!cls) {
      toast(`Không tìm thấy lớp: ${classRef}`);
      exitToMainMenu();
      return;
    }

    const action = parts[2] || 'general';

    if (action === 'general') {
      $('#main-menu-view').hidden = true;
      $('#class-workspace').hidden = true;
      $('#class-general-view').hidden = false;
      renderClassGeneralView(cls.id);
      return;
    }

    if (action === 'live') {
      const subtab = parts[3] || 'map';
      const today = new Date().toLocaleDateString('sv-SE');
      enterClass(cls.id, today, false, subtab);
      return;
    }

    if (action === 'history') {
      const dateArg = parts[3];
      const subtab = parts[4] || 'map';
      const allHist = window.__featuresApp?.loadSessionHistory ? window.__featuresApp.loadSessionHistory() : [];
      const classHist = allHist.filter(s => s.classId === cls.id);
      let targetDate = dateArg;
      if (!targetDate && classHist.length) {
        targetDate = classHist[0].date;
      } else if (targetDate) {
        const match = classHist.find(s => s.date === targetDate || s.id.includes(targetDate));
        if (match) targetDate = match.date;
      }
      if (!targetDate) targetDate = new Date().toLocaleDateString('sv-SE');
      enterClass(cls.id, targetDate, true, subtab);
      return;
    }

    enterClass(cls.id, new Date().toLocaleDateString('sv-SE'), false, 'seating');
    return;
  }

  // Route: students
  if (parts[0] === 'students') {
    if (parts.length === 1) {
      if (window.__featuresApp?.renderMasterStudentDirectory) {
        window.__featuresApp.renderMasterStudentDirectory();
        $('#student-directory-dialog')?.showModal();
      }
      return;
    }

    const studentRef = parts[1];
    const stu = resolveStudent(studentRef);
    if (!stu) {
      toast(`Không tìm thấy học sinh: ${studentRef}`);
      return;
    }

    if (parts.length === 2) {
      openStudentProfile(stu.id);
      return;
    }

    if (parts[2] === 'class' && parts[3]) {
      const classRef = parts[3];
      const cls = resolveClass(classRef);
      if (!cls) {
        toast(`Không tìm thấy lớp: ${classRef}`);
        return;
      }

      if (parts.length === 4) {
        if (window.__featuresApp?.openStudentClassProfile) {
          window.__featuresApp.openStudentClassProfile(stu.id, cls.id);
        }
        return;
      }

      if (parts[4] === 'history') {
        let targetDate = null;
        if (parts[5] === 'map') {
          const seatEntry = stu.seatingHistory?.find(sh => sh.classId === cls.id);
          const attEntry = stu.attendanceHistory?.find(ah => ah.classId === cls.id);
          targetDate = seatEntry?.date || attEntry?.date;
          if (!targetDate) {
            const allHist = window.__featuresApp?.loadSessionHistory ? window.__featuresApp.loadSessionHistory() : [];
            const classHist = allHist.filter(s => s.classId === cls.id);
            targetDate = classHist[0]?.date || new Date().toLocaleDateString('sv-SE');
          }
        } else {
          targetDate = parts[5];
        }

        enterClass(cls.id, targetDate, true, 'seating');
        $('#student-profile-dialog')?.close();
        $('#student-class-profile-dialog')?.close();

        setTimeout(() => {
          highlightStudentSeat(stu.id);
        }, 250);
        return;
      }
    }
  }
}

$('#work-menu-nav').onclick=()=>setMainMenuPanel('work');$('#management-menu-nav').onclick=()=>setMainMenuPanel('management');$('#work-menu-tab').onclick=()=>setMainMenuPanel('work');$('#management-menu-tab').onclick=()=>setMainMenuPanel('management');
$('#main-menu-shortcut').onclick=()=>navigateTo('class');
window.addEventListener('popstate', handleRoute);
window.addEventListener('hashchange', handleRoute);
document.addEventListener('click',event=>{
  const enterLive=event.target.closest('[data-enter-live-class]');
  if(enterLive){
    event.preventDefault();
    const targetCls = resolveClass(enterLive.dataset.enterLiveClass);
    navigateTo(`class/${targetCls?.code || enterLive.dataset.enterLiveClass}/live/map`);
    return;
  }
  const enter=event.target.closest('[data-enter-class]');
  if(enter){
    event.preventDefault();
    const targetCls = resolveClass(enter.dataset.enterClass);
    navigateTo(`class/${targetCls?.code || enter.dataset.enterClass}/general`);
    return;
  }
  const histBtn=event.target.closest('[data-class-history]');
  if(histBtn){
    event.preventDefault();
    const targetCls = resolveClass(histBtn.dataset.classHistory);
    navigateTo(`class/${targetCls?.code || histBtn.dataset.classHistory}/general`);
    return;
  }
  const rosterBtn=event.target.closest('[data-roster-class]');
  if(rosterBtn){
    event.preventDefault();
    if(window.__featuresApp?.openRosterAdmin){window.__featuresApp.openRosterAdmin(rosterBtn.dataset.rosterClass);}
    return;
  }
  const seatMapBtn=event.target.closest('[data-view-seat-student]');
  if(seatMapBtn){
    event.preventDefault();
    const targetClass=seatMapBtn.dataset.viewSeatClass||CURRENT_CLASS_ID;
    const targetDate=seatMapBtn.dataset.viewSeatDate||checklistDate;
    const targetStudentId=seatMapBtn.dataset.viewSeatStudent;
    const targetCls=resolveClass(targetClass);
    const targetStu=resolveStudent(targetStudentId);
    $('#student-profile-dialog')?.close();
    $('#student-class-profile-dialog')?.close();
    navigateTo(`students/${targetStu?.studentCode || targetStudentId}/class/${targetCls?.code || targetClass}/history/${targetDate}/map`);
    return;
  }
  const sessionEdit=event.target.closest('[data-edit-session]');if(sessionEdit){if(window.__featuresApp?.openSessionScheduleDialog){window.__featuresApp.openSessionScheduleDialog(sessionEdit.dataset.editSession);}else{openSessionChange(sessionEdit.dataset.editSession);}return;}
  const adminLogClsBtn=event.target.closest('[data-admin-log-class]');if(adminLogClsBtn){const cid=adminLogClsBtn.dataset.adminLogClass;openSessionAdminLogDialog(cid,'all');return;}const edit=event.target.closest('[data-edit-class]');if(edit){openClassConfig(edit.dataset.editClass);return;}const remove=event.target.closest('[data-delete-class]');if(remove){const item=classCatalog.find(row=>row.id===remove.dataset.deleteClass);if(item&&window.confirm(`Xóa lớp ${item.name} khỏi danh sách quản lý? Học sinh thuộc lớp này sẽ được gỡ liên kết lớp tự động.`)){logAdminSessionAction(`Xoá lớp học "${item.name}"`, `Mã lớp: ${item.code || item.id} · Phòng: ${item.room || '—'} · GV: ${item.teacherName || '—'} · TA: ${item.assistantName || '—'}`, 'class', '', item.id, '_class_');classCatalog=classCatalog.filter(row=>row.id!==item.id);students.forEach(s=>{if(Array.isArray(s.classIds))s.classIds=s.classIds.filter(cid=>cid!==item.id);});makeupStudents.forEach(m=>{if(m.attendingClassId===item.id)m.attendingClassId=classCatalog[0]?.id||null;});saveStudentRecords(students,makeupStudents);saveClassCatalog(classCatalog);renderMainMenu();toast(`Đã xóa lớp ${item.name} và làm sạch dữ liệu liên kết.`);}}});
function roleLabel(role){return ({assistant:'Trợ giảng',office:'Văn phòng',teacher:'Giáo viên',admin:'Admin'})[role]||role;}
function renderEmployeeAdminList(){const host=$('#employee-admin-list');host.innerHTML=masterData.employees.map(employee=>'<div class="employee-admin-row" data-employee-id="'+escapeHtml(employee.id)+'"><label class="field-label">Mã<input data-employee-code value="'+escapeHtml(employee.code)+'" required></label><label class="field-label">Họ tên<input data-employee-name value="'+escapeHtml(employee.name)+'" required></label><label class="field-label">Vai trò<select data-employee-role><option value="assistant" '+(employee.role==='assistant'?'selected':'')+'>Trợ giảng</option><option value="office" '+(employee.role==='office'?'selected':'')+'>Văn phòng</option><option value="teacher" '+(employee.role==='teacher'?'selected':'')+'>Giáo viên</option><option value="admin" '+(employee.role==='admin'?'selected':'')+'>Admin</option></select></label></div>').join('');}
if($('#manage-employees-button'))$('#manage-employees-button').onclick=()=>{
  setMainMenuPanel('management');
  $('#mgmt-tab-staff')?.click();
  if (window.__featuresApp?.renderStaffManagement) {
    window.__featuresApp.renderStaffManagement();
  }
};$('#close-employee-admin').onclick=()=>$('#employee-admin-dialog').close();$('#employee-admin-form').addEventListener('submit',event=>{event.preventDefault();const edits=[...document.querySelectorAll('[data-employee-id]')].map(row=>({id:row.dataset.employeeId,code:row.querySelector('[data-employee-code]').value.trim(),name:row.querySelector('[data-employee-name]').value.trim(),role:row.querySelector('[data-employee-role]').value})),code=$('#employee-code-input').value.trim(),name=$('#employee-name-input').value.trim(),role=$('#employee-role-input').value;if(!code||!name)return;const combinedCodes=[...edits.map(item=>item.code),...(code?[code]:[])];if(new Set(combinedCodes.map(item=>item.toLocaleUpperCase())).size!==combinedCodes.length){toast('Mã nhân viên phải là duy nhất.');return;}for(const update of edits){const old=masterData.employees.find(item=>item.id===update.id);if(!old)continue;Object.assign(old,update);Object.assign(old,normalizeEmployeeAccount(old));if(old.role!==update.role){for(const item of classCatalog){for(const field of ['teacherIds','assistantIds','officeIds'])item[field]=(item[field]||[]).filter(id=>id!==old.id);if(update.role==='teacher')(item.teacherIds||=[]).push(old.id);if(update.role==='assistant')(item.assistantIds||=[]).push(old.id);if(update.role==='office')(item.officeIds||=[]).push(old.id);item.teacherId=item.teacherIds?.[0]||'';item.teacherName=employeeNames(item.teacherIds||[]);item.assistantName=employeeNames(item.assistantIds||[]);}}}if(code){masterData.employees.push(normalizeEmployeeAccount({id:'employee-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),code,name,role,password:role==='admin'?'admin123':'123456',isActive:true,authVersion:1}));}saveMasterData(masterData);saveClassCatalog(classCatalog);$('#employee-code-input').value='';$('#employee-name-input').value='';renderEmployeeAdminList();renderMainMenu();toast('Đã lưu danh sách nhân viên.');});
function fillSessionStaffSelect(select,role,selectedIds=[]){const names=masterData.employees.filter(employee=>employee.role===role).map(employee=>'<option value="'+escapeHtml(employee.id)+'" '+(selectedIds.includes(employee.id)?'selected':'')+'>'+escapeHtml(employee.name)+' · '+escapeHtml(employee.code)+'</option>').join('');select.innerHTML='<option value="@none">Không phân công '+(role==='assistant'?'trợ giảng':'giáo viên')+'</option>'+names;for(const option of select.options)if(option.value==='@none')option.selected=false;}
function openSessionChange(classId){const item=classCatalog.find(row=>row.id===classId);if(!item)return;$('#session-change-class-id').value=classId;const date=occurrenceDate(item).toLocaleDateString('sv-SE');$('#session-change-date').value=date;const existing=getSessionChange(classId,date);$('#session-change-type').value=existing?.status==='cancelled'?'cancel':existing?.status==='makeup'?'makeup':existing?.note?'staff_change':'staff_change';$('#session-makeup-date').value='';$('#makeup-date-field').hidden=!['makeup','holiday_makeup'].includes($('#session-change-type').value);$('#session-change-note').value=existing?.note||'';fillSessionStaffSelect($('#session-change-teachers'),'teacher',existing?.teacherIds||[]);fillSessionStaffSelect($('#session-change-assistants'),'assistant',existing?.assistantIds||[]);$('#session-change-dialog').showModal();}
$('#close-session-change').onclick=()=>$('#session-change-dialog').close();$('#cancel-session-change').onclick=()=>$('#session-change-dialog').close();$('#session-change-type').onchange=event=>{$('#makeup-date-field').hidden=!['makeup','holiday_makeup'].includes(event.target.value);};$('#session-change-form').addEventListener('submit',event=>{event.preventDefault();const classId=$('#session-change-class-id').value,item=classCatalog.find(row=>row.id===classId),date=$('#session-change-date').value,type=$('#session-change-type').value;if(!item||!date)return;const readIds=select=>{const ids=[...select.selectedOptions].map(option=>option.value);if(ids.includes('@none'))return [];return ids.length?ids:undefined;},teacherIds=readIds($('#session-change-teachers')),assistantIds=readIds($('#session-change-assistants')),note=$('#session-change-note').value.trim(),makeRecord=(sessionDate,status)=>({classId,date:sessionDate,status,teacherIds,assistantIds,note,updatedAt:Date.now(),updatedBy:currentEmployeeId});if(type==='holiday_makeup'){sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'cancelled'),note:note||'Nghỉ lễ'};const makeupDate=$('#session-makeup-date').value;if(makeupDate)sessionChanges[sessionChangeKey(classId,makeupDate)]={...makeRecord(makeupDate,'makeup'),sourceDate:date,note:note||'Buổi học bù'};}else if(type==='cancel'){sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'cancelled'),note:note||'Lớp nghỉ'};}else if(type==='makeup'){sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'makeup'),note:note||'Buổi học bù'};}else{sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'scheduled')};}saveClassSessionChanges(sessionChanges);logAdminSessionAction(`Điều chỉnh lịch buổi học (${formatDateDDMMYYYY(date)})`, `Lớp: ${item.name} (${item.code || item.id}) · Loại: ${type} · Ghi chú: "${note || '—'}"`, 'class', '', classId, date);$('#session-change-dialog').close();renderMainMenu();toast('Đã lưu điều chỉnh cho buổi học.');});
function layoutCounts(item){return item.defaultLayout.map(row=>row.desks.length);}

// v1.9: 5-Minute Time Rounding & Class Duration Helpers
function roundTimeTo5Minutes(timeStr, fallback = '15:30') {
  const raw = String(timeStr || fallback).trim();
  const match = raw.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return fallback;
  let h = Number(match[1]) || 0;
  let m = Number(match[2]) || 0;
  let total = Math.round((h * 60 + m) / 5) * 5;
  total = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseDurationTo5Minutes(raw, fallback = 90) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return fallback;
  const hmMatch = text.match(/^(\d{1,2})\s*[:gh]\s*(\d{1,2})?/);
  if (hmMatch) {
    const h = Number(hmMatch[1]) || 0;
    const m = Number(hmMatch[2]) || 0;
    const total = Math.round((h * 60 + m) / 5) * 5;
    return Math.max(5, Math.min(480, total || fallback));
  }
  const num = Number(text.replace(/[^0-9]/g, ''));
  if (!num) return fallback;
  const rounded = Math.round(num / 5) * 5;
  return Math.max(5, Math.min(480, rounded || fallback));
}

function formatDurationBadge(mins) {
  const m = Math.max(5, Math.round((Number(mins) || 90) / 5) * 5);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  const clock = `${h}:${String(rem).padStart(2, '0')}`;
  const human = h > 0 ? (rem > 0 ? `${h}g${rem}p` : `${h}g`) : `${rem}p`;
  return `${clock} [${human}]`;
}

function addMinutesToTimeStr(startTime, durationMins) {
  const cleanStart = roundTimeTo5Minutes(startTime, '15:30');
  const [h, m] = cleanStart.split(':').map(Number);
  const dur = Math.max(5, Math.round((Number(durationMins) || 90) / 5) * 5);
  const total = ((h * 60 + m + dur) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function diffTimeDurationMinutes(startTime, endTime, fallback = 90) {
  const s = roundTimeTo5Minutes(startTime, '15:30').split(':').map(Number);
  const e = roundTimeTo5Minutes(endTime, '17:00').split(':').map(Number);
  let diff = (e[0] * 60 + e[1]) - (s[0] * 60 + s[1]);
  if (diff <= 0) diff += 1440;
  const rounded = Math.round(diff / 5) * 5;
  return (rounded >= 5 && rounded <= 480) ? rounded : fallback;
}

const DURATION_PRESET_VALUES = ['45', '60', '75', '90', '120', '150', '180'];

function syncDurationUI({ startSel, endSel, durationSel, customWrapSel, customInputSel, previewSel }) {
  const startEl = $(startSel);
  const endEl = $(endSel);
  const durSelect = $(durationSel);
  const customWrap = customWrapSel ? $(customWrapSel) : null;
  const customInput = customInputSel ? $(customInputSel) : null;
  const previewEl = previewSel ? $(previewSel) : null;
  if (!startEl || !endEl || !durSelect) return;

  const cleanStart = roundTimeTo5Minutes(startEl.value || '15:30');
  if (startEl.value !== cleanStart) startEl.value = cleanStart;

  const isCustom = durSelect.value === 'custom';
  if (customWrap) customWrap.hidden = !isCustom;
  const durMins = isCustom
    ? parseDurationTo5Minutes(customInput?.value || '90', 90)
    : (Number(durSelect.value) || 90);

  const computedEnd = addMinutesToTimeStr(cleanStart, durMins);
  endEl.value = computedEnd;
  if (previewEl) {
    previewEl.textContent = `Ca học: ${cleanStart} – ${computedEnd} (${formatDurationBadge(durMins)})`;
  }
}

function setDurationFieldsFromStartEnd({ startTime, endTime, startSel, endSel, durationSel, customWrapSel, customInputSel, previewSel }) {
  const startEl = $(startSel);
  const endEl = $(endSel);
  const durSelect = $(durationSel);
  const customWrap = customWrapSel ? $(customWrapSel) : null;
  const customInput = customInputSel ? $(customInputSel) : null;
  const cleanStart = roundTimeTo5Minutes(startTime || '15:30');
  const cleanEnd = roundTimeTo5Minutes(endTime || '17:00');
  if (startEl) startEl.value = cleanStart;
  if (endEl) endEl.value = cleanEnd;
  const mins = diffTimeDurationMinutes(cleanStart, cleanEnd, 90);
  if (durSelect) {
    if (DURATION_PRESET_VALUES.includes(String(mins))) {
      durSelect.value = String(mins);
      if (customWrap) customWrap.hidden = true;
    } else {
      durSelect.value = 'custom';
      if (customWrap) customWrap.hidden = false;
      if (customInput) {
        const h = Math.floor(mins / 60);
        const rem = mins % 60;
        customInput.value = `${h}:${String(rem).padStart(2, '0')}`;
      }
    }
  }
  syncDurationUI({ startSel, endSel, durationSel, customWrapSel, customInputSel, previewSel });
}

window.__timeHelpers = {
  roundTimeTo5Minutes,
  parseDurationTo5Minutes,
  formatDurationBadge,
  addMinutesToTimeStr,
  diffTimeDurationMinutes,
  syncDurationUI,
  setDurationFieldsFromStartEnd
};

function renderStaffSearchPicker(role, query = '') {
  const cfg = role === 'teacher'
    ? { ids: selectedTeacherIds, inputSel: '#config-teacher-search', optionsSel: '#config-teacher-options', choiceSel: '#config-teacher-choice' }
    : role === 'office'
    ? { ids: selectedOfficeIds, inputSel: '#config-office-search', optionsSel: '#config-office-options', choiceSel: '#config-office-choice' }
    : { ids: selectedAssistantIds, inputSel: '#config-assistant-search', optionsSel: '#config-assistant-options', choiceSel: '#config-assistant-choice' };

  const optionsHost = $(cfg.optionsSel);
  if (!optionsHost) return;
  const pool = (masterData.employees || []).filter(emp => emp.role === role && !cfg.ids.includes(emp.id));
  const trimmed = String(query || '').trim();
  const matches = trimmed
    ? searchRecords(pool, trimmed, {
        fields: emp => [
          { value: emp.name, weight: 1.3 },
          { value: emp.code, weight: 1.2 },
          { value: emp.phone, weight: 1.0 }
        ]
      })
    : pool;

  if (!matches.length) {
    optionsHost.innerHTML = `<div class="empty-list">${trimmed ? 'Không tìm thấy nhân sự phù hợp.' : 'Đã chọn hết nhân sự trong nhóm này.'}</div>`;
    return;
  }

  optionsHost.innerHTML = matches.map(emp => `
    <button type="button" class="student-option staff-search-option" data-pick-staff-id="${escapeHtml(emp.id)}" data-pick-staff-role="${escapeHtml(role)}">
      <span class="student-option-name"><strong>${escapeHtml(emp.name)}</strong> <small>· Mã: ${escapeHtml(emp.code || '—')}</small></span>
      <span class="student-check">Chọn</span>
    </button>
  `).join('');

  optionsHost.querySelectorAll('[data-pick-staff-id]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const empId = btn.dataset.pickStaffId;
      if (empId && !cfg.ids.includes(empId)) {
        cfg.ids.push(empId);
      }
      const inp = $(cfg.inputSel);
      if (inp) {
        inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      optionsHost.hidden = true;
      renderStaffSelection();
      renderEmployeeOptions($(cfg.choiceSel), role, cfg.ids);
    };
  });
}

function initClassConfigStaffSearchAndTime() {
  for (const [role, inputSel, optionsSel] of [
    ['teacher', '#config-teacher-search', '#config-teacher-options'],
    ['assistant', '#config-assistant-search', '#config-assistant-options'],
    ['office', '#config-office-search', '#config-office-options']
  ]) {
    const inp = $(inputSel);
    const optHost = $(optionsSel);
    if (!inp || !optHost || inp.dataset.staffSearchBound === '1') continue;
    inp.dataset.staffSearchBound = '1';

    inp.addEventListener('focus', () => {
      renderStaffSearchPicker(role, inp.value);
      optHost.hidden = false;
    });
    inp.addEventListener('input', () => {
      renderStaffSearchPicker(role, inp.value);
      optHost.hidden = false;
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const firstBtn = optHost.querySelector('[data-pick-staff-id]');
        if (firstBtn) {
          e.preventDefault();
          firstBtn.click();
        }
      } else if (e.key === 'Escape') {
        optHost.hidden = true;
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.staff-search-picker-wrap')) {
      ['#config-teacher-options', '#config-assistant-options', '#config-office-options', '#sched-makeup-assistant-options', '#sched-next-assistant-options'].forEach(sel => {
        const el = $(sel);
        if (el) el.hidden = true;
      });
    }
  });

  const cfgTimeParams = {
    startSel: '#config-class-start',
    endSel: '#config-class-end',
    durationSel: '#config-class-duration',
    customWrapSel: '#config-class-duration-custom-wrap',
    customInputSel: '#config-class-duration-custom',
    previewSel: '#config-class-time-preview'
  };
  $('#config-class-start')?.addEventListener('change', () => syncDurationUI(cfgTimeParams));
  $('#config-class-start')?.addEventListener('blur', () => syncDurationUI(cfgTimeParams));
  $('#config-class-duration')?.addEventListener('change', () => syncDurationUI(cfgTimeParams));
  $('#config-class-duration-custom')?.addEventListener('input', () => syncDurationUI(cfgTimeParams));
  $('#config-class-duration-custom')?.addEventListener('change', () => syncDurationUI(cfgTimeParams));
}

let selectedTeacherIds=[],selectedAssistantIds=[],selectedOfficeIds=[];
function renderStaffSelection(){for(const [ids,hostId,role] of [[selectedTeacherIds,'config-teachers-selected','teacher'],[selectedAssistantIds,'config-assistants-selected','assistant'],[selectedOfficeIds,'config-office-selected','office']]){const host=$('#'+hostId);host.innerHTML=ids.map(id=>{const employee=masterData.employees.find(item=>item.id===id);return employee?`<span class="staff-chip">${escapeHtml(employee.name)} <small>${escapeHtml(employee.code)}</small><button type="button" data-remove-staff="${escapeHtml(id)}" data-staff-role="${role}" aria-label="Bỏ ${escapeHtml(employee.name)}">×</button></span>`:'';}).join('')||'<small class="staff-picker-empty">Chưa chọn nhân viên</small>';}}
function renderEmployeeOptions(select,role,selected){const available=masterData.employees.filter(employee=>employee.role===role&&!selected.includes(employee.id));select.innerHTML='<option value="">Chọn nhân viên…</option>'+available.map(employee=>`<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.name)} · ${escapeHtml(employee.code)}</option>`).join('');}
function renderMasterDataChoices(item){$('#config-class-subject').innerHTML=masterData.subjects.map(subject=>`<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join('');if(item?.subjectId)$('#config-class-subject').value=item.subjectId;selectedTeacherIds=item?.teacherIds?.slice()||(item?.teacherId?[item.teacherId]:[]);selectedAssistantIds=item?.assistantIds?.slice()||((selectedRole()==='assistant'?[currentEmployeeId]:[]));selectedOfficeIds=item?.officeIds?.slice()||((selectedRole()==='office'?[currentEmployeeId]:[]));renderStaffSelection();renderEmployeeOptions($('#config-teacher-choice'),'teacher',selectedTeacherIds);renderEmployeeOptions($('#config-assistant-choice'),'assistant',selectedAssistantIds);renderEmployeeOptions($('#config-office-choice'),'office',selectedOfficeIds);}
function readConfigNotifications(){return [...document.querySelectorAll('.config-notification-row')].map(row=>({id:row.dataset.ruleId||`rule-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,anchor:row.querySelector('[data-rule-anchor]').value,offsetMinutes:Number(row.querySelector('[data-rule-offset]').value)||0,title:row.querySelector('[data-rule-title]').value.trim(),body:row.querySelector('[data-rule-body]').value.trim()})).filter(rule=>rule.title||rule.body);}
function renderConfigNotifications(rules){$('#config-notification-list').innerHTML=rules.map((rule,index)=>`<div class="config-notification-row reminder-subcard" data-rule-id="${escapeHtml(rule.id||`notice-${index+1}`)}"><div class="reminder-subcard-header"><span class="reminder-subcard-title">Mốc nhắc nhở #${index+1}</span><button type="button" class="remove-config-notification" data-remove-notification="${index}" aria-label="Xóa mốc nhắc nhở" title="Xóa mốc nhắc nhở này">×</button></div><div class="reminder-subcard-grid2"><label class="field-label">Mốc thời gian<select data-rule-anchor aria-label="Mốc tính thông báo"><option value="start" ${rule.anchor==='start'?'selected':''}>Giờ bắt đầu</option><option value="end" ${rule.anchor==='end'?'selected':''}>Giờ kết thúc</option></select></label><label class="field-label">Lệch phút (âm = trước, dương = sau)<input data-rule-offset type="number" value="${Number(rule.offsetMinutes)||0}" aria-label="Số phút lệch mốc" /></label></div><label class="field-label reminder-full-row">Tiêu đề nhắc nhở<input data-rule-title required value="${escapeHtml(rule.title||'')}" placeholder="Ví dụ: Thu BTVN đầu giờ" /></label><label class="field-label reminder-full-row">Nội dung chi tiết<input data-rule-body value="${escapeHtml(rule.body||'')}" placeholder="Nhập trọn vẹn nội dung cần nhắc (VD: Kiểm tra phòng và bật điều hòa)..." /></label></div>`).join('')||'<div class="notification-config-empty">Chưa có mốc thông báo. Thêm mốc nếu lớp cần nhắc tự động.</div>';}
function openClassConfig(id=''){
  const item=classCatalog.find(row=>row.id===id);
  $('#class-config-title').textContent=item?'Chỉnh sửa lớp':'Thêm lớp học';
  $('#config-class-id').value=item?.id||'';
  $('#config-class-name').value=item?.name||'';
  if($('#config-class-code'))$('#config-class-code').value=item?.code||(item?.id?item.id.replace(/^class-/,'').toUpperCase().replace(/[^A-Z0-9]/g,''):'');
  if($('#config-class-grade'))$('#config-class-grade').value=normalizeGradeToBirthYear(item?.grade||'2013');
  renderMasterDataChoices(item);
  $('#config-class-weekday').value=String(item?.weekday??1);
  initClassConfigStaffSearchAndTime();
  setDurationFieldsFromStartEnd({
    startTime: item?.startTime || '15:30',
    endTime: item?.endTime || '17:00',
    startSel: '#config-class-start',
    endSel: '#config-class-end',
    durationSel: '#config-class-duration',
    customWrapSel: '#config-class-duration-custom-wrap',
    customInputSel: '#config-class-duration-custom',
    previewSel: '#config-class-time-preview'
  });
  ['#config-teacher-search', '#config-assistant-search', '#config-office-search'].forEach(s => { if ($(s)) $(s).value = ''; });
  ['#config-teacher-options', '#config-assistant-options', '#config-office-options'].forEach(s => { if ($(s)) $(s).hidden = true; });

  // Populate & select Room from Room Templates list
  const roomSelect = $('#config-room-template-select');
  const templates = window.__featuresApp?.loadRoomTemplates ? window.__featuresApp.loadRoomTemplates() : [];
  if (roomSelect && templates.length) {
    roomSelect.innerHTML = templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.roomCode ? `${t.roomCode} · ${t.name}` : t.name)} (${t.aisles} dãy · ${(t.desksPerAisle || []).join('-')} bàn)</option>`).join('');
    const matched = templates.find(t =>
      (item?.roomTemplateId && t.id === item.roomTemplateId) ||
      (item?.room && (t.roomCode === item.room || t.name === item.room))
    ) || templates[0];
    roomSelect.value = matched.id;
    if ($('#config-class-room')) $('#config-class-room').value = matched.roomCode || matched.name;
    if ($('#config-layout-aisles')) $('#config-layout-aisles').value = matched.aisles || 3;
    if ($('#config-layout-desks')) $('#config-layout-desks').value = (matched.desksPerAisle || [3,3,2]).join(', ');
  }

  $('#config-start-checklist').value=(item?.defaultChecklist.startItems||[]).join('\n');
  $('#config-end-checklist').value=(item?.defaultChecklist.endItems||[]).join('\n');
  renderConfigNotifications(item?.defaultNotifications||[]);
  $('#class-config-dialog').showModal();
}
$('#add-class-button').onclick=()=>openClassConfig();$('#close-class-config').onclick=()=>$('#class-config-dialog').close();$('#cancel-class-config').onclick=()=>$('#class-config-dialog').close();
function addSelectedEmployee(role){const select=role==='teacher'?$('#config-teacher-choice'):role==='office'?$('#config-office-choice'):$('#config-assistant-choice'),ids=role==='teacher'?selectedTeacherIds:role==='office'?selectedOfficeIds:selectedAssistantIds;if(select.value&&!ids.includes(select.value))ids.push(select.value);select.value='';renderStaffSelection();renderEmployeeOptions(select,role,ids);}
$('#add-config-teacher').onclick=()=>addSelectedEmployee('teacher');$('#add-config-assistant').onclick=()=>addSelectedEmployee('assistant');$('#add-config-office').onclick=()=>addSelectedEmployee('office');document.querySelector('.staff-picker').parentElement.addEventListener('click',event=>{const button=event.target.closest('[data-remove-staff]');if(!button)return;const ids=button.dataset.staffRole==='teacher'?selectedTeacherIds:button.dataset.staffRole==='office'?selectedOfficeIds:selectedAssistantIds;const index=ids.indexOf(button.dataset.removeStaff);if(index>=0)ids.splice(index,1);renderStaffSelection();renderEmployeeOptions(button.dataset.staffRole==='teacher'?$('#config-teacher-choice'):button.dataset.staffRole==='office'?$('#config-office-choice'):$('#config-assistant-choice'),button.dataset.staffRole,ids);});
$('#add-config-notification').onclick=()=>{const rules=readConfigNotifications();rules.push({id:`rule-${Date.now()}`,anchor:'start',offsetMinutes:0,title:'Thông báo mới',body:''});renderConfigNotifications(rules);};$('#config-notification-list').addEventListener('click',event=>{const remove=event.target.closest('[data-remove-notification]');if(!remove)return;const rules=readConfigNotifications();rules.splice(Number(remove.dataset.removeNotification),1);renderConfigNotifications(rules);});
$('#class-config-form').addEventListener('submit',event=>{
  event.preventDefault();
  const id=$('#config-class-id').value||`class-${Date.now().toString(36)}`,
        teacherIds=[...selectedTeacherIds],
        assistantIds=[...selectedAssistantIds],
        officeIds=[...selectedOfficeIds];
  if(!teacherIds.length||!assistantIds.length){
    toast('Chọn ít nhất một giáo viên và một trợ giảng phụ trách lớp.');
    return;
  }
  const templates = window.__featuresApp?.loadRoomTemplates ? window.__featuresApp.loadRoomTemplates() : [];
  const selectedTplId = $('#config-room-template-select')?.value;
  const selectedTpl = templates.find(t => t.id === selectedTplId) || templates[0];
  const roomName = selectedTpl ? (selectedTpl.roomCode || selectedTpl.name) : ($('#config-class-room')?.value?.trim() || 'P1-T3-CS1');
  const autoLayout = (selectedTpl && window.__featuresApp?.buildLayoutFromTemplate)
    ? window.__featuresApp.buildLayoutFromTemplate(id, selectedTpl)
    : structuredClone(baseLayout);

  const subject=masterData.subjects.find(item=>item.id===$('#config-class-subject').value),
        teachers=masterData.employees.filter(item=>teacherIds.includes(item.id)),
        assistants=masterData.employees.filter(item=>assistantIds.includes(item.id)),
        startItems=$('#config-start-checklist').value.split('\n').map(value=>value.trim()).filter(Boolean),
        endItems=$('#config-end-checklist').value.split('\n').map(value=>value.trim()).filter(Boolean),
        old=classCatalog.find(item=>item.id===id),
        code=($('#config-class-code')?.value||'').trim().toUpperCase(),
        grade=normalizeGradeToBirthYear(($('#config-class-grade')?.value||'2013').trim()),
        classInfo={
          id,
          code,
          grade,
          name:$('#config-class-name').value.trim(),
          subjectId:subject?.id||'',
          subject:subject?.name||'',
          teacherIds,
          teacherId:teacherIds[0]||'',
          teacherName:teachers.map(item=>item.name).join(', '),
          assistantIds,
          officeIds,
          assistantName:assistants.map(item=>item.name).join(', '),
          weekday:Number($('#config-class-weekday').value),
          startTime:roundTimeTo5Minutes($('#config-class-start').value || '15:30'),
          endTime:(syncDurationUI({startSel:'#config-class-start',endSel:'#config-class-end',durationSel:'#config-class-duration',customWrapSel:'#config-class-duration-custom-wrap',customInputSel:'#config-class-duration-custom',previewSel:'#config-class-time-preview'}), $('#config-class-end').value || '17:00'),
          room:roomName,
          roomTemplateId:selectedTpl?.id||'',
          defaultLayout:autoLayout,
          defaultChecklist:{startItems,endItems},
          defaultNotifications:readConfigNotifications()
        };
  if(old)classCatalog=classCatalog.map(item=>item.id===id?classInfo:item);
  else classCatalog.push(classInfo);
  saveClassCatalog(classCatalog);
  logAdminSessionAction(
    old ? `Sửa thông tin lớp "${classInfo.name}"` : `Thêm lớp học mới "${classInfo.name}"`,
    `Mã lớp: ${classInfo.code || classInfo.id} · Phòng: ${classInfo.room} · Lịch: ${weekdayNames[classInfo.weekday]} ${classInfo.startTime}–${classInfo.endTime} · GV: ${classInfo.teacherName || '—'} · TA: ${classInfo.assistantName || '—'}`,
    'class',
    '',
    classInfo.id,
    '_class_'
  );

  // Auto-update active session layout if room changed
  if (id === CURRENT_CLASS_ID) {
    configClass = classInfo;
    layout = structuredClone(autoLayout);
    for (const { desk } of desks()) deskItems[desk.id] ??= [];
    localStorage.setItem(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`, JSON.stringify(layout));
  }

  $('#class-config-dialog').close();
  renderMainMenu();
  if($('#class-general-view')&&!$('#class-general-view').hidden){renderClassGeneralView(classInfo.id);}
  if($('#class-workspace')&&!$('#class-workspace').hidden){showClassWorkspace();}
  toast(old?'Đã cập nhật cấu hình lớp và đồng bộ sơ đồ theo phòng học.':'Đã thêm lớp học.');
});
// initial query will run after setupFeatures
let liveClassSortKey = 'name';
let liveClassSortOrder = 'asc';
let selectedLiveClassStudentIds = new Set();

function renderStudentList(){
  const host=$('#student-list-items'),makeupHost=$('#makeup-list-items');if(!host)return;
  if (makeupHost) {
    makeupHost.innerHTML = '';
    const makeupSec = makeupHost.closest('.makeup-roster-section');
    if (makeupSec) makeupSec.hidden = true;
  }
  const placements=new Map(allEntries().filter(({entry})=>entry.studentId).map(place=>[place.entry.studentId,place]));
  const lateIds=new Set(lateQueue);
  const byGivenName=(a,b)=>{const aGiven=a.givenName||splitStudentName(a.name).givenName,bGiven=b.givenName||splitStudentName(b.name).givenName,aFamily=a.familyName||splitStudentName(a.name).familyName,bFamily=b.familyName||splitStudentName(b.name).familyName;return aGiven.localeCompare(bGiven,'vi')||aFamily.localeCompare(bFamily,'vi');};
  const roster=classStudents();
  const classMakeups=makeupStudents.filter(student=>isMakeupInCurrentSession(student, placements, lateIds));

  const buildRecord=(student, idx, isMakeupRow = false)=>{
    const id=student.id;
    const place=placements.get(id);
    const desk=place&&desks().find(item=>item.desk.id===place.deskId);
    const inLate=lateIds.has(id);
    const attHist=(student.attendanceHistory||[]).find(h=>h.classId===CURRENT_CLASS_ID&&h.date===checklistDate);
    const sessNote=(student.sessionNotes||[]).find(n=>n.classId===CURRENT_CLASS_ID&&n.date===checklistDate);

    const rawAtt = place?.entry.attendance
      || (inLate ? (student.attendance || (attHist ? { status: attHist.status, arrivalTime: attHist.time || attHist.arrivalTime, lateMinutes: attHist.lateMinutes ?? attHist.minutesLate } : { status: 'late' })) : null)
      || (attHist ? { status: attHist.status, reason: attHist.reason, arrivalTime: attHist.time || attHist.arrivalTime, lateMinutes: attHist.lateMinutes ?? attHist.minutesLate } : null);
    const lateCheckDet = rawAtt ? resolveLateDetails(student, place?.entry || { attendance: rawAtt }) : null;
    const attendance = (rawAtt && (rawAtt.status === 'late' || inLate))
      ? (lateCheckDet?.isLate
          ? { ...rawAtt, status: 'late', ...lateCheckDet }
          : { ...rawAtt, status: 'present', arrivalTime: lateCheckDet?.arrivalTime || rawAtt.arrivalTime || null, lateMinutes: 0, minutesLate: 0 })
      : rawAtt;

    const homework = place?.entry.homework
      || (inLate && student.homework ? student.homework : null)
      || (sessNote?.homeworkStatus ? { status: sessNote.homeworkStatus, score: sessNote.homeworkScore ?? null, reason: sessNote.homeworkReason || '' } : null)
      || { status: 'uncollected' };

    const seat = desk ? `Dãy ${desk.ci+1} · Bàn ${desk.di+1}` : (inLate ? (attendance?.status === 'late' ? 'Cuối lớp (Đi muộn)' : 'Cuối lớp (Chờ xếp chỗ)') : 'Chưa xếp chỗ');
    const testScore = place?.entry.testScore ?? checklist.testScores?.[id] ?? student.testScore ?? null;
    const note = sessionNoteFor(id) || '';
    const parts = splitStudentName(student.name);
    const familyName = student.familyName ?? parts.familyName;
    const givenName = student.givenName ?? parts.givenName;

    return { student, familyName, givenName, isMakeupRow: isMakeupRow || student.studentType === 'makeup', originalIndex: idx + 1, attendance, homework, seat, testScore, note };
  };

  const records=roster.map((s, idx)=>buildRecord(s, idx, false));
  const makeupRecords=classMakeups.map((s, idx)=>buildRecord(s, idx, true));
  const allSessionRecords=[...records, ...makeupRecords];

  const present=allSessionRecords.filter(r=>r.attendance?.status==='present').length;
  const late=allSessionRecords.filter(r=>r.attendance?.status==='late').length;
  const absent=records.filter(r=>r.attendance?.status==='absent'||r.attendance?.status==='absent_excused'||r.attendance?.status==='absent_unexcused').length;
  const noHomework=allSessionRecords.filter(r=>r.homework.status==='not_submitted').length;
  const attendedRegularCount=records.filter(r=>r.attendance?.status==='present'||r.attendance?.status==='late').length;
  const attendedTotalCount=present+late;

  $('#session-student-total').textContent=`Đã điểm danh ${attendedRegularCount}/${records.length} học sinh trong danh sách${makeupRecords.length ? ` (+${makeupRecords.length} học bù)` : ''}`;
  if ($('#list-roster-attendance-count')) {
    $('#list-roster-attendance-count').textContent = `${attendedRegularCount} / ${records.length}`;
  }
  if ($('#list-roster-attendance-sub')) {
    $('#list-roster-attendance-sub').textContent = makeupRecords.length
      ? `Trong DS lớp (+${makeupRecords.length} học bù · Tổng có mặt: ${attendedTotalCount})`
      : 'Đã điểm danh / Sĩ số danh sách lớp';
  }
  if ($('#list-present-count')) $('#list-present-count').textContent=present;
  if ($('#list-late-count')) $('#list-late-count').textContent=late;
  if ($('#list-absent-count')) $('#list-absent-count').textContent=absent;
  if ($('#list-homework-count')) $('#list-homework-count').textContent=noHomework;

  if (document.activeElement && host.contains(document.activeElement) && document.activeElement.matches('[data-session-note], [data-live-list-hw-score], [data-live-list-test-score]')) {
    return;
  }

  const query=$('#student-list-search').value.trim(),filter=$('#student-list-filter').value;
  const filterAndSort = (list) => {
    let items = [...list];
    if(query){
      const ranked=searchStudents(items.map(record=>record.student),query),order=new Map(ranked.map((student,index)=>[student.id,index]));
      items=items.filter(record=>order.has(record.student.id)).sort((a,b)=>order.get(a.student.id)-order.get(b.student.id));
    }
    if(filter==='present')items=items.filter(r=>r.attendance?.status==='present');
    if(filter==='late')items=items.filter(r=>r.attendance?.status==='late');
    if(filter==='absent')items=items.filter(r=>r.attendance?.status==='absent'||r.attendance?.status==='absent_excused'||r.attendance?.status==='absent_unexcused');
    if(filter==='unmarked')items=items.filter(r=>!r.attendance?.status);
    if(filter==='homework')items=items.filter(r=>r.homework.status==='not_submitted');
    if(filter==='warning')items=items.filter(r=>evaluateStudentEarlyWarning(r.student, CURRENT_CLASS_ID).hasWarning);
    if(filter==='makeup')items=items.filter(r=>r.isMakeupRow);

    items.sort((a, b) => {
      let cmp = 0;
      if (liveClassSortKey === 'family') {
        cmp = (a.familyName || '').localeCompare(b.familyName || '', 'vi') || (a.givenName || '').localeCompare(b.givenName || '', 'vi');
      } else if (liveClassSortKey === 'name') {
        cmp = byGivenName(a.student, b.student);
      } else if (liveClassSortKey === 'school') {
        cmp = (a.student.school || a.student.sourceClassName || '').localeCompare(b.student.school || b.student.sourceClassName || '', 'vi');
      } else if (liveClassSortKey === 'seat') {
        cmp = (a.seat || '').localeCompare(b.seat || '', 'vi');
      } else if (liveClassSortKey === 'attendance') {
        const attOrder = { present: 1, late: 2, absent_excused: 3, absent_unexcused: 4, absent: 5 };
        cmp = (attOrder[a.attendance?.status] || 99) - (attOrder[b.attendance?.status] || 99);
      } else if (liveClassSortKey === 'homework') {
        const hwOrder = { graded: 1, submitted: 2, uncollected: 3, not_submitted: 4 };
        cmp = (hwOrder[a.homework?.status] || 99) - (hwOrder[b.homework?.status] || 99);
      } else if (liveClassSortKey === 'score') {
        const aSc = a.homework?.score ?? a.testScore ?? -1;
        const bSc = b.homework?.score ?? b.testScore ?? -1;
        cmp = aSc - bSc;
      } else if (liveClassSortKey === 'note') {
        cmp = (a.note || '').localeCompare(b.note || '', 'vi');
      } else {
        cmp = a.originalIndex - b.originalIndex;
      }
      return liveClassSortOrder === 'desc' ? -cmp : cmp;
    });
    return items;
  };

  // Makeup students are always placed at the bottom of the main table
  const visibleRegular = filter === 'makeup' ? [] : filterAndSort(records);
  const visibleMakeup = filterAndSort(makeupRecords);
  const visible = [...visibleRegular, ...visibleMakeup];

  const getLiveTableColumnOrder = () => {
    const defaultCols = ['family', 'name', 'school', 'seat', 'attendance', 'homework', 'score', 'note'];
    try {
      const saved = JSON.parse(localStorage.getItem('lopvui.column-order.live.v1') || 'null');
      if (Array.isArray(saved) && saved.length) {
        const valid = saved.filter(k => defaultCols.includes(k));
        defaultCols.forEach(k => { if (!valid.includes(k)) valid.push(k); });
        return valid;
      }
    } catch {}
    return defaultCols;
  };

  const renderUnifiedTable = (items) => {
    if (!items.length) {
      return `<div class="empty-list">${allSessionRecords.length ? 'Không có học sinh phù hợp với bộ lọc.' : 'Danh sách lớp hiện chưa có hồ sơ học sinh.'}</div>`;
    }
    const sortIcon = (key) => liveClassSortKey === key ? (liveClassSortOrder === 'asc' ? '▲' : '▼') : '⇅';
    const sortClass = (key) => liveClassSortKey === key ? (liveClassSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';
    const colOrder = getLiveTableColumnOrder();

    const colHeaderMap = {
      family: `<th class="sortable-th ${sortClass('family')}" data-live-sort="family">Họ đệm <span class="sort-icon">${sortIcon('family')}</span></th>`,
      name: `<th class="sortable-th ${sortClass('name')}" data-live-sort="name">Tên <span class="sort-icon">${sortIcon('name')}</span></th>`,
      school: `<th class="sortable-th ${sortClass('school')}" data-live-sort="school">Trường <span class="sort-icon">${sortIcon('school')}</span></th>`,
      seat: `<th class="sortable-th ${sortClass('seat')}" data-live-sort="seat">Vị trí ngồi <span class="sort-icon">${sortIcon('seat')}</span></th>`,
      attendance: `<th class="sortable-th ${sortClass('attendance')}" data-live-sort="attendance">Trạng thái điểm danh <span class="sort-icon">${sortIcon('attendance')}</span></th>`,
      homework: `<th class="sortable-th ${sortClass('homework')}" data-live-sort="homework">Trạng thái BTVN <span class="sort-icon">${sortIcon('homework')}</span></th>`,
      score: `<th class="sortable-th ${sortClass('score')}" data-live-sort="score" style="text-align:center;">Điểm BTVN / Test <span class="sort-icon">${sortIcon('score')}</span></th>`,
      note: `<th class="sortable-th ${sortClass('note')}" data-live-sort="note">Ghi chú buổi học <span class="sort-icon">${sortIcon('note')}</span></th>`
    };

    const bulkBarHtml = `
      <div id="live-student-bulk-bar" class="bulk-actions-bar" ${selectedLiveClassStudentIds.size ? '' : 'hidden'} style="margin-bottom:10px;">
        <div class="bulk-actions-info">
          <span>Đã chọn <strong id="live-student-bulk-count">${selectedLiveClassStudentIds.size}</strong> học sinh:</span>
        </div>
        <div class="bulk-actions-buttons">
          <button type="button" class="outline-button" id="live-bulk-add-tag">Thêm tag</button>
          <button type="button" class="outline-button" id="live-bulk-remove-tag">Xóa tag</button>
          <button type="button" class="outline-button" id="live-bulk-add-class">Thêm vào lớp khác</button>
          <button type="button" class="outline-button" id="live-bulk-move-class">Chuyển lớp</button>
          <button type="button" class="outline-button text-danger" id="live-bulk-remove-class">Bỏ khỏi lớp</button>
          <button type="button" class="outline-button text-danger" id="live-bulk-delete-student" style="background:#fef2f2; border-color:#fca5a5; color:#b91c1c; font-weight:700;">🗑 Xoá học sinh</button>
          <button type="button" class="outline-button" id="live-bulk-clear">Bỏ chọn</button>
        </div>
      </div>
    `;

    return `
      ${bulkBarHtml}
      <div class="attendance-table-wrap">
        <table class="attendance-report-table" style="font-size:14px;">
          <thead>
            <tr>
              <th style="width:36px; text-align:center;"><input type="checkbox" id="live-student-select-all" ${visible.length && visible.every(i => selectedLiveClassStudentIds.has(i.student.id)) ? 'checked' : ''} title="Chọn tất cả" /></th>
              ${colOrder.map(k => colHeaderMap[k] || '').join('')}
              <th style="width:110px; text-align:center;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(({student, familyName, givenName, isMakeupRow, attendance, homework, seat, testScore, note}) => {
              const attStatus = attendance?.status;
              const lateDet = attStatus === 'late' ? resolveLateDetails(student, { attendance }) : null;
              const statusBadge = attStatus === 'present'
                ? '<span class="student-state state-present">✓ Có mặt</span>'
                : attStatus === 'late'
                  ? `<span class="student-state state-late">Đi muộn ${lateDet.lateMinutes}p (${escapeHtml(lateDet.arrivalTime)})</span>`
                  : (attStatus === 'absent' || attStatus === 'absent_excused' || attStatus === 'absent_unexcused')
                    ? `<span class="student-state state-missing">× ${attStatus === 'absent_excused' ? 'Vắng có phép' : 'Vắng mặt'}</span>`
                    : '<span class="student-state state-pending">Chưa điểm danh</span>';

              const reasonMap = { not_done: 'Chưa làm', forgot: 'Quên vở', missed_previous: 'Nghỉ buổi trước' };
              const reasonText = reasonMap[homework.reason] || homework.reason || '';
              const hwBadge = homework.status === 'not_submitted'
                ? `<span class="student-state state-missing">× Chưa nộp${reasonText ? ` (${escapeHtml(reasonText)})` : ''}</span>`
                : (homework.status === 'submitted' || homework.status === 'graded')
                  ? '<span class="student-state state-collected">✓ Đã nộp</span>'
                  : '<span class="student-state state-pending">· Chưa thu</span>';

              const hwScStr = (homework.score !== null && homework.score !== undefined && homework.score !== '') ? formatScoreVN(homework.score) : '';
              const testScStr = (testScore !== null && testScore !== undefined && testScore !== '') ? formatScoreVN(testScore) : '';
              const scoreCellHtml = `
                <div style="display:inline-flex; align-items:center; gap:6px; justify-content:center;">
                  <input type="text" inputmode="decimal" class="manual-score-input" data-live-list-hw-score="${escapeHtml(student.id)}" value="${escapeHtml(hwScStr)}" placeholder="BTVN" title="Nhập điểm BTVN (VD: 7,5)" style="width:62px; text-align:center;" />
                  ${checklist?.testRequired || testScStr ? `<input type="text" inputmode="decimal" class="manual-score-input" data-live-list-test-score="${escapeHtml(student.id)}" value="${escapeHtml(testScStr)}" placeholder="Test" title="Nhập điểm Test (VD: 8,5)" style="width:62px; text-align:center;" />` : ''}
                </div>
              `;

              const schoolLabel = isMakeupRow
                ? `Học Bù (${student.sourceClassName || student.school || 'T2'})`
                : (student.school || '—');

              const cellMap = {
                family: `<td><button type="button" data-open-student-profile="${escapeHtml(student.id)}" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font:inherit; color:${isMakeupRow ? '#6d28d9' : '#395140'}; font-weight:${isMakeupRow ? '700' : '500'};">${escapeHtml(familyName || '—')}</button></td>`,
                name: `<td><button type="button" data-open-student-profile="${escapeHtml(student.id)}" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font:inherit;"><strong style="color:${isMakeupRow ? '#6d28d9' : '#214e2d'};">${escapeHtml(givenName || student.name)}</strong>${renderInlineTags(student)}${(() => { const ew = evaluateStudentEarlyWarning(student, CURRENT_CLASS_ID); return (ew.hasWarning ? `<span class="early-warning-pill" title="Cảnh báo: ${escapeHtml(ew.tooltip)}">⚠ ${escapeHtml(ew.badgeText)}</span>` : ''); })()}</button></td>`,
                school: `<td>${isMakeupRow ? `<span class="makeup-school-tag">${escapeHtml(schoolLabel)}</span>` : escapeHtml(schoolLabel)}</td>`,
                seat: `<td><span class="room-chip">${escapeHtml(seat)}</span></td>`,
                attendance: `<td>${statusBadge}</td>`,
                homework: `<td>${hwBadge}</td>`,
                score: `<td style="text-align:center; white-space:nowrap;">${scoreCellHtml}</td>`,
                note: `<td class="col-allow-wrap"><input class="attendance-note-input" data-session-note="${escapeHtml(student.id)}" aria-label="Ghi chú chung cho ${escapeHtml(student.name)}" placeholder="Nhập ghi chú buổi học..." value="${escapeHtml(note)}" style="width:100%; min-width:130px;" /></td>`
              };

              return `
                <tr class="${isMakeupRow ? 'makeup-row-tr' : ''}">
                  <td style="text-align:center;">
                    <input type="checkbox" class="live-student-cb" data-student-id="${escapeHtml(student.id)}" ${selectedLiveClassStudentIds.has(student.id) ? 'checked' : ''} />
                  </td>
                  ${colOrder.map(k => cellMap[k] || '').join('')}
                  <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="outline-button find-seat-btn" data-find-seat-student="${escapeHtml(student.id)}" title="Mở sơ đồ lớp và tìm nhanh chỗ ngồi học sinh này">Tìm chỗ</button>
                    <button type="button" class="outline-button text-danger" data-delete-class-student="${escapeHtml(student.id)}" style="padding:5px 8px; font-size:12.5px; margin-left:4px;" title="Xoá học sinh này khỏi danh sách">Xoá</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };
  host.innerHTML = renderUnifiedTable(visible);

  // Wire inline score inputs in #student-list-items
  host.querySelectorAll('[data-live-list-hw-score]').forEach(inp => {
    inp.addEventListener('input', () => {
      applyStudentManualScore(inp.dataset.liveListHwScore, 'hw', inp.value);
    });
  });
  host.querySelectorAll('[data-live-list-test-score]').forEach(inp => {
    inp.addEventListener('input', () => {
      applyStudentManualScore(inp.dataset.liveListTestScore, 'test', inp.value);
    });
  });

  // Wire sort headers in #student-list-items
  host.querySelectorAll('th[data-live-sort]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.liveSort;
      if (liveClassSortKey === key) {
        liveClassSortOrder = liveClassSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        liveClassSortKey = key;
        liveClassSortOrder = 'asc';
      }
      renderStudentList();
    };
  });

  // Wire checkboxes & bulk actions in #student-list-items
  host.querySelectorAll('.live-student-cb').forEach(cb => {
    cb.onchange = () => {
      if (cb.checked) selectedLiveClassStudentIds.add(cb.dataset.studentId);
      else selectedLiveClassStudentIds.delete(cb.dataset.studentId);
      renderStudentList();
    };
  });

  const selectAllLive = host.querySelector('#live-student-select-all');
  if (selectAllLive) {
    selectAllLive.onchange = () => {
      if (selectAllLive.checked) visible.forEach(item => selectedLiveClassStudentIds.add(item.student.id));
      else selectedLiveClassStudentIds.clear();
      renderStudentList();
    };
  }

  host.querySelector('#live-bulk-clear')?.addEventListener('click', () => {
    selectedLiveClassStudentIds.clear();
    renderStudentList();
  });

  host.querySelector('#live-bulk-add-tag')?.addEventListener('click', () => {
    if (window.__featuresApp?.openBulkStudentActionDialog) {
      window.__featuresApp.openBulkStudentActionDialog({
        mode: 'add-tag',
        studentIds: Array.from(selectedLiveClassStudentIds),
        currentClassId: CURRENT_CLASS_ID,
        onComplete: () => { save(); render(); }
      });
    }
  });

  host.querySelector('#live-bulk-remove-tag')?.addEventListener('click', () => {
    if (window.__featuresApp?.openBulkStudentActionDialog) {
      window.__featuresApp.openBulkStudentActionDialog({
        mode: 'remove-tag',
        studentIds: Array.from(selectedLiveClassStudentIds),
        currentClassId: CURRENT_CLASS_ID,
        onComplete: () => { save(); render(); }
      });
    }
  });

  host.querySelector('#live-bulk-add-class')?.addEventListener('click', () => {
    if (window.__featuresApp?.openBulkStudentActionDialog) {
      window.__featuresApp.openBulkStudentActionDialog({
        mode: 'add-class',
        studentIds: Array.from(selectedLiveClassStudentIds),
        currentClassId: CURRENT_CLASS_ID,
        onComplete: () => { save(); render(); }
      });
    }
  });

  host.querySelector('#live-bulk-move-class')?.addEventListener('click', () => {
    if (window.__featuresApp?.openBulkStudentActionDialog) {
      window.__featuresApp.openBulkStudentActionDialog({
        mode: 'move-class',
        studentIds: Array.from(selectedLiveClassStudentIds),
        currentClassId: CURRENT_CLASS_ID,
        onComplete: () => {
          selectedLiveClassStudentIds.clear();
          save();
          render();
        }
      });
    }
  });

  const deleteStudentsFromClassAndSystem = (targetIds) => {
    const idSet = new Set(targetIds.filter(Boolean));
    if (!idSet.size) return;
    const deletedNames = [...students, ...makeupStudents].filter(s => idSet.has(s.id)).map(s => s.name);
    logAdminSessionAction(`Xoá ${deletedNames.length} học sinh khỏi lớp & hệ thống`, `Học sinh: ${deletedNames.join(', ')}`, 'student');
    students = students.filter(s => !idSet.has(s.id));
    makeupStudents = makeupStudents.filter(s => !idSet.has(s.id));
    for (const { desk } of desks()) {
      deskItems[desk.id] = (deskItems[desk.id] || []).filter(entry => !idSet.has(entry.studentId));
    }
    lateQueue = lateQueue.filter(id => !idSet.has(id));
    idSet.forEach(id => {
      delete attendanceNotes[id];
      selectedLiveClassStudentIds.delete(id);
    });
    localStorage.setItem(getAttendanceNotesKey(), JSON.stringify(attendanceNotes));
    saveStudentRecords(students, makeupStudents);
    save();
    render();
  };

  host.querySelector('#live-bulk-remove-class')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    if (!confirm(`Xác nhận bỏ ${selectedLiveClassStudentIds.size} học sinh đã chọn khỏi lớp này?`)) return;
    const removedNames = [];
    selectedLiveClassStudentIds.forEach(id => {
      const s = studentById(id);
      if (s) {
        removedNames.push(s.name);
        s.classIds = (s.classIds || []).filter(cid => cid !== CURRENT_CLASS_ID);
        if (s.attendingClassId === CURRENT_CLASS_ID) s.attendingClassId = null;
      }
      for (const { desk } of desks()) {
        deskItems[desk.id] = (deskItems[desk.id] || []).filter(entry => entry.studentId !== id);
      }
      lateQueue = lateQueue.filter(lid => lid !== id);
    });
    selectedLiveClassStudentIds.clear();
    save();
    logAdminSessionAction(`Bỏ ${removedNames.length} học sinh khỏi danh sách lớp`, `Học sinh: ${removedNames.join(', ')}`, 'student');
    render();
    toast('Đã bỏ học sinh đã chọn khỏi lớp.');
  });

  host.querySelector('#live-bulk-delete-student')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    const count = selectedLiveClassStudentIds.size;
    if (!confirm(`Xác nhận XOÁ ${count} học sinh đã chọn khỏi danh sách và hệ thống?`)) return;
    deleteStudentsFromClassAndSystem(Array.from(selectedLiveClassStudentIds));
    toast(`Đã xoá ${count} học sinh khỏi hệ thống.`);
  });

  host.querySelectorAll('[data-delete-class-student]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const stuId = btn.dataset.deleteClassStudent;
      const stu = studentById(stuId);
      if (!stu) return;
      if (!confirm(`Xác nhận xoá học sinh "${stu.name}" khỏi danh sách và hệ thống?`)) return;
      deleteStudentsFromClassAndSystem([stuId]);
      toast(`Đã xoá học sinh ${stu.name}.`);
    });
  });
}
$('#student-list-search').addEventListener('input',renderStudentList);$('#student-list-filter').addEventListener('change',renderStudentList);
function renderAttendanceExport(){
  const dateLabel = new Date(`${checklistDate}T00:00:00`).toLocaleDateString('vi-VN');
  const placements = new Map(allEntries().filter(({entry})=>entry.studentId).map(({entry})=>[entry.studentId,entry.attendance?.status||'present']));
  for(const id of lateQueue)placements.set(id,studentById(id)?.attendance?.status||'late');
  
  // Sort alphabetically by Vietnamese given name then family name
  const roster = [...classStudents()].sort((a,b)=>{
    const aGiven = a.givenName || splitStudentName(a.name).givenName;
    const bGiven = b.givenName || splitStudentName(b.name).givenName;
    const aFamily = a.familyName || splitStudentName(a.name).familyName;
    const bFamily = b.familyName || splitStudentName(b.name).familyName;
    return aGiven.localeCompare(bGiven,'vi') || aFamily.localeCompare(bFamily,'vi');
  });

  const mainRows = roster.map(student=>{
    const attendance = placements.get(student.id), status = attendance ? attendanceLabel(attendance) : 'Vắng';
    const fam = student.familyName || splitStudentName(student.name).familyName;
    const giv = student.givenName || splitStudentName(student.name).givenName;
    return `<tr><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong></td><td>${escapeHtml(student.studentCode || '—')}</td><td>${escapeHtml(student.school || '')}</td><td>${escapeHtml(status)}</td><td><input class="attendance-note-input" data-session-note="${escapeHtml(student.id)}" aria-label="Ghi chú chung cho ${escapeHtml(student.name)}" value="${escapeHtml(sessionNoteFor(student.id))}" /></td></tr>`;
  }).join('');

  const sessionMakeups = makeupStudents.filter(student=>isMakeupInCurrentSession(student, placements, lateQueue)).sort((a,b)=>{
    const aGiven = a.givenName || splitStudentName(a.name).givenName;
    const bGiven = b.givenName || splitStudentName(b.name).givenName;
    return aGiven.localeCompare(bGiven,'vi') || (a.familyName||'').localeCompare(b.familyName||'','vi');
  });

  const makeupRows = sessionMakeups.map(student=>{
    const fam = student.familyName || splitStudentName(student.name).familyName;
    const giv = student.givenName || splitStudentName(student.name).givenName;
    return `<tr><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong></td><td>${escapeHtml(student.studentCode || '—')}</td><td>${escapeHtml(student.sourceClassName || '')}</td><td><input class="attendance-note-input" data-session-note="${escapeHtml(student.id)}" aria-label="Ghi chú chung cho học sinh học bù ${escapeHtml(student.name)}" value="${escapeHtml(sessionNoteFor(student.id))}" /></td></tr>`;
  }).join('');

  const curClass = activeClassConfig();
  $('#attendance-export-content').innerHTML = `
    <div class="attendance-report-heading">
      <strong>${escapeHtml(curClass.code || curClass.name)} · ${escapeHtml(curClass.name)}</strong>
      <span>Ngày học: ${escapeHtml(dateLabel)} · Phòng: ${escapeHtml(curClass.room || '—')}</span>
    </div>
    <h3>Danh sách chính · ${roster.length} học sinh (Xếp theo Alphabet)</h3>
    <div class="attendance-table-wrap">
      <table class="attendance-report-table">
        <thead>
          <tr>
            <th>Họ đệm</th>
            <th>Tên</th>
            <th>Mã HS</th>
            <th>Trường</th>
            <th>Điểm danh (${escapeHtml(dateLabel)})</th>
            <th>Ghi chú chung</th>
          </tr>
        </thead>
        <tbody>${mainRows || '<tr><td colspan="6">Lớp chưa có học sinh.</td></tr>'}</tbody>
      </table>
    </div>
    <h3 class="makeup-report-title">Học bù trong buổi này · ${sessionMakeups.length} học sinh</h3>
    <div class="attendance-table-wrap">
      <table class="attendance-report-table makeup-report-table">
        <thead>
          <tr>
            <th>Họ đệm</th>
            <th>Tên</th>
            <th>Mã HS</th>
            <th>Bù của lớp</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>${makeupRows || '<tr><td colspan="5">Không có học sinh học bù trong buổi này.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}
$('#export-attendance-button').onclick=()=>{if(window.__featuresApp?.renderReportCenter){window.__featuresApp.renderReportCenter('teacher-summary');}else{renderAttendanceExport();}$('#attendance-export-dialog').showModal();};
document.addEventListener('input',event=>{
  const input=event.target.closest('[data-session-note]');
  if(input && input.dataset.sessionNote){
    saveSessionNote(input.dataset.sessionNote,input.value);
    return;
  }
  if(event.target?.id === 'seat-general-note'){
    const targetId = selectedStudentId || currentEntry()?.studentId;
    if(targetId){
      event.target.dataset.sessionNote = targetId;
      saveSessionNote(targetId, event.target.value);
    }
  } else if(event.target?.id === 'late-general-note'){
    if(selectedLateId){
      event.target.dataset.sessionNote = selectedLateId;
      saveSessionNote(selectedLateId, event.target.value);
    }
  }
});
$('#close-attendance-export').onclick=()=>$('#attendance-export-dialog').close();$('#close-attendance-export-back-btn')?.addEventListener('click',()=>$('#attendance-export-dialog').close());$('#close-attendance-export-bottom-btn')?.addEventListener('click',()=>$('#attendance-export-dialog').close());if($('#close-attendance-export-secondary'))$('#close-attendance-export-secondary').onclick=()=>$('#attendance-export-dialog').close();$('#print-attendance-export').onclick=()=>window.print();
function profileDate(item){return item.date||new Date(item.timestamp||Date.now()).toLocaleDateString('vi-VN');}
let isGeneralProfileEditMode = false;
let activeProfileEnrolledClassIds = [];

function closeDialogSafely(dlgOrSel) {
  const dlg = typeof dlgOrSel === 'string' ? document.querySelector(dlgOrSel) : dlgOrSel;
  if (!dlg) return;
  try { if (dlg.open) dlg.close(); } catch {}
  try { dlg.removeAttribute('open'); } catch {}
}

function setGeneralStudentProfileEditMode(editable = false) {
  isGeneralProfileEditMode = Boolean(editable);
  const dlg = $('#student-profile-dialog');
  if (!dlg) return;
  const unlockBtn = $('#unlock-student-profile-btn');
  const actionsBar = $('#student-profile-actions-bar');
  if (unlockBtn) {
    unlockBtn.textContent = isGeneralProfileEditMode ? 'Đang sửa' : 'Sửa';
    unlockBtn.classList.toggle('active', isGeneralProfileEditMode);
    unlockBtn.hidden = isGeneralProfileEditMode;
  }
  if (actionsBar) {
    actionsBar.hidden = !isGeneralProfileEditMode;
  }
  dlg.querySelectorAll('.profile-edit-grid input, .profile-edit-grid textarea, .profile-edit-grid select').forEach(el => {
    if (el.tagName === 'LABEL') {
      el.hidden = !isGeneralProfileEditMode;
    } else {
      el.disabled = !isGeneralProfileEditMode;
    }
  });
  // Hide/show class add picker & remove '×' buttons & tag editor input according to edit mode
  dlg.querySelectorAll('[data-remove-class-chip], #profile-class-picker-row, #profile-tag-input-wrap, #profile-photo-url-wrap').forEach(el => {
    el.hidden = !isGeneralProfileEditMode;
  });
  dlg.querySelectorAll('#profile-tag-readonly-chips').forEach(el => {
    el.hidden = isGeneralProfileEditMode;
  });
}

function openStudentProfile(id, origin = null){
  const student=studentById(id);if(!student)return;activeProfileId=id;
  if(origin) previousStudentProfileOrigin = origin;
  const parts=splitStudentName(student.name),familyName=student.familyName??parts.familyName,givenName=student.givenName??parts.givenName;
  const tags=student.tags||[];
  const tagBadges=tags.map(tag=>`<span class="profile-chip profile-tag-chip">${escapeHtml(tag)}</span>`).join('')||'<small style="color:#8a998c; font-style:italic;">Chưa gắn tag</small>';
  const resolvedPhoto = resolveStudentPhotoUrls(student);
  const photo = resolvedPhoto.thumbUrl;
  const autoDriveFileName = buildStudentDrivePhotoFileName(student, classCatalog);
  if (!student.photoDriveFileName) student.photoDriveFileName = autoDriveFileName;
  const officeNoteVal = student.officeNotes ?? '';

  const initialChar = escapeHtml((givenName || student.name || 'H').charAt(0).toUpperCase());
  const stEnrollment = (student.enrollmentStatus && String(student.enrollmentStatus).trim()) ? String(student.enrollmentStatus).trim() : 'Học';
  const allAvailableClasses = [...classCatalog];
  if (!allAvailableClasses.some(c => c.id === 'class-tutoring')) {
    allAvailableClasses.push(TUTORING_CLASS_CONFIG);
  }
  let enrolledClassIds = [...(student.classIds || [])];
  activeProfileEnrolledClassIds = enrolledClassIds;
  const enrolledClassNames = enrolledClassIds
    .map(cid => {
      const c = allAvailableClasses.find(x => x.id === cid);
      return c ? (c.code || c.name) : cid;
    })
    .filter(Boolean);

  const portraitBlock = photo ? `
    <div class="student-portrait-showcase">
      <button type="button" id="student-photo-expand" class="student-portrait-frame-btn" title="Bấm để phóng to ảnh ${escapeHtml(student.name)}" aria-label="Mở ảnh ${escapeHtml(student.name)} cỡ lớn">
        <img class="profile-portrait profile-portrait-lg" id="profile-portrait-preview" src="${escapeHtml(photo)}" alt="Ảnh chân dung ${escapeHtml(student.name)}" />
        <span class="portrait-zoom-hint">🔍 Phóng to</span>
      </button>
      <div class="student-portrait-actions has-photo">
        <label id="profile-upload-portrait-label" class="portrait-action-btn edit" title="Đổi ảnh chân dung khác">
          📷 Đổi ảnh
          <input type="file" id="profile-upload-portrait-input" accept="image/*" style="display:none;" />
        </label>
        <button type="button" id="profile-remove-photo-btn" class="portrait-action-btn remove" title="Xóa ảnh chân dung">Xóa</button>
      </div>
    </div>
  ` : `
    <div class="student-portrait-showcase">
      <div id="profile-portrait-preview" class="profile-portrait profile-portrait-lg profile-portrait-placeholder" title="Có thể bấm nút bên dưới hoặc nhấn Ctrl+V để dán ảnh trực tiếp">
        <div class="portrait-placeholder-circle">${initialChar}</div>
        <small class="portrait-placeholder-caption">Chưa có ảnh</small>
      </div>
      <div class="student-portrait-actions no-photo">
        <label id="profile-upload-portrait-label" class="portrait-action-btn upload">
          📷 Tải ảnh lên
          <input type="file" id="profile-upload-portrait-input" accept="image/*" style="display:none;" />
        </label>
      </div>
    </div>
  `;

  $('#student-profile-content').innerHTML=`
    <div class="student-profile-hero-card">
      ${portraitBlock}
      <div class="student-hero-info">
        <div class="student-hero-title-row">
          <div class="student-hero-name-wrap">
            <strong class="student-hero-name">${escapeHtml(student.name)}</strong>
            ${renderInlineTags(student)}
          </div>
          <span class="enrollment-status-pill status-text-hoc">● ${escapeHtml(stEnrollment)}</span>
        </div>
        <div class="student-hero-meta-grid">
          <div class="hero-meta-item">
            <span class="hero-meta-label">Mã học sinh</span>
            <strong class="hero-meta-value code">${escapeHtml(student.studentCode || 'Chưa cấp mã')}</strong>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-label">${student.studentType === 'makeup' ? 'Phân loại' : 'Trường học'}</span>
            <strong class="hero-meta-value">${escapeHtml(student.studentType === 'makeup' ? `Học bù (${student.sourceClassName || 'Lớp khác'})` : (student.school || 'Chưa cập nhật'))}</strong>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-label">Phụ huynh & SĐT</span>
            <strong class="hero-meta-value">${escapeHtml([student.parentContact?.name, student.parentContact?.phone].filter(Boolean).join(' · ') || 'Chưa cập nhật')}</strong>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-label">Lớp theo học</span>
            <strong class="hero-meta-value">${escapeHtml(enrolledClassNames.length ? enrolledClassNames.join(', ') : (student.studentType === 'makeup' ? 'Học bù theo buổi' : 'Chưa xếp lớp'))}</strong>
          </div>
          ${officeNoteVal ? `
            <div class="hero-meta-item hero-meta-wide">
              <span class="hero-meta-label">Ghi chú văn phòng</span>
              <span class="hero-meta-note">${escapeHtml(officeNoteVal)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
    <div class="profile-edit-grid">
      <label class="field-label">Họ và tên đệm<input id="profile-family-name" value="${escapeHtml(familyName)}" /></label>
      <label class="field-label">Tên<input id="profile-given-name" value="${escapeHtml(givenName)}" /></label>
      <label class="field-label">Trường học<input id="profile-school" value="${escapeHtml(student.school||'')}" /></label>
      <label class="field-label">Mã học sinh<input id="profile-code" value="${escapeHtml(student.studentCode||'')}" placeholder="Ví dụ: K09.3049 (Nếu đổi mã, tên file ảnh Drive tự đổi theo)" style="text-transform:uppercase;" /></label>
      <label class="field-label">Tên phụ huynh<input id="profile-parent-name" value="${escapeHtml(student.parentContact?.name||'')}" placeholder="Không bắt buộc" /></label>
      <label class="field-label">SĐT phụ huynh<input id="profile-parent-phone" type="tel" value="${escapeHtml(student.parentContact?.phone||'')}" placeholder="Ví dụ: 0912345678" /></label>
      <div class="field-label profile-wide">
        <span>Trạng thái theo học</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <select id="profile-enrollment-status-select" style="flex:1 1 200px;">
            ${['Học', 'Chưa nhập học', 'Tạm nghỉ', 'Nghỉ', 'Trùng'].map(st => `<option value="${escapeHtml(st)}" ${(student.enrollmentStatus || 'Học') === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            <option value="__custom__" ${!['Học', 'Chưa nhập học', 'Tạm nghỉ', 'Nghỉ', 'Trùng'].includes(student.enrollmentStatus || 'Học') ? 'selected' : ''}>Khác (Tự nhập trạng thái...)</option>
          </select>
          <input id="profile-enrollment-status-custom" value="${!['Học', 'Chưa nhập học', 'Tạm nghỉ', 'Nghỉ', 'Trùng'].includes(student.enrollmentStatus || 'Học') ? escapeHtml(student.enrollmentStatus || '') : ''}" placeholder="Nhập trạng thái tùy chỉnh..." style="flex:1 1 220px; ${!['Học', 'Chưa nhập học', 'Tạm nghỉ', 'Nghỉ', 'Trùng'].includes(student.enrollmentStatus || 'Học') ? '' : 'display:none;'}" />
        </div>
      </div>

      <div class="field-label profile-wide">
        <span>Các lớp đang theo học <small style="font-weight:500; color:#5b7760;">(Bấm vào lớp để mở Hồ sơ học sinh trong Lớp)</small></span>
        <div id="profile-enrolled-classes-wrap" style="margin-top:6px; padding:10px 12px; background:#fbfdfb; border:1px solid #dce5dd; border-radius:8px;"></div>
      </div>

      <div class="field-label profile-wide">
        <span>Tag phân loại</span>
        <div id="profile-tag-readonly-chips" class="profile-chip-list" style="margin-top:6px;">${tagBadges}</div>
        <div id="profile-tag-input-wrap" style="margin-top:6px;" hidden>
          <input id="profile-tags" value="${escapeHtml(tags.join(', '))}" placeholder="Ví dụ: Mới, Cần chú ý, HS Giỏi, Mục tiêu 9+" />
        </div>
      </div>

      <label class="field-label profile-wide">Ghi chú văn phòng
        <textarea id="profile-office-notes" rows="3" placeholder="Ghi chú hành chính / học phí / liên hệ phụ huynh của văn phòng...">${escapeHtml(officeNoteVal)}</textarea>
      </label>

      <label class="field-label profile-wide" id="profile-photo-url-wrap" hidden>Link ảnh Google Drive hoặc URL trực tiếp
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="profile-photo-url" value="${escapeHtml(student.photoDriveFileId ? `https://drive.google.com/file/d/${student.photoDriveFileId}/view` : (student.photoURL||''))}" placeholder="Dán link chia sẻ Google Drive (https://drive.google.com/file/d/...) hoặc link ảnh..." style="flex:1;" />
          <button type="button" class="outline-button" id="open-drive-config-from-profile-btn" style="padding:7px 10px; font-size:12.5px; white-space:nowrap;">☁ Cấu hình Drive</button>
        </div>
      </label>
    </div>`;

  function renderEnrolledClassesUI() {
    const wrap = $('#profile-enrolled-classes-wrap');
    if (!wrap) return;

    const chipsHtml = enrolledClassIds.map(cid => {
      const c = allAvailableClasses.find(x => x.id === cid) || { id: cid, code: cid, name: cid };
      return `
        <span class="profile-class-chip" data-class-chip="${escapeHtml(cid)}">
          <button type="button" data-open-class-drilldown="${escapeHtml(cid)}" style="border:0; background:transparent; padding:0; font:inherit; color:#1f5f33; font-weight:800; cursor:pointer;" title="Bấm để mở Hồ sơ học sinh trong Lớp">${escapeHtml(c.code || c.name)} <small style="color:#56695b; font-weight:500;">(${escapeHtml(c.grade ? formatBirthYearInline(c.grade) : c.name)})</small> ↗</button>
          <button type="button" data-remove-class-chip="${escapeHtml(cid)}" title="Xóa lớp này khỏi học sinh" ${isGeneralProfileEditMode ? '' : 'hidden'}>×</button>
        </span>
      `;
    }).join('') || '<small style="color:#8a998c; font-style:italic;">Chưa gắn lớp nào</small>';

    const availableToAdd = allAvailableClasses.filter(c => !enrolledClassIds.includes(c.id));
    const addOptionsHtml = availableToAdd.map(c => `
      <option value="${escapeHtml(c.id)}">[${escapeHtml(c.code || c.id)}] ${escapeHtml(c.name)} (${c.grade ? formatBirthYearInline(c.grade) : 'Bổ trợ'})</option>
    `).join('');

    const pickerHtml = availableToAdd.length ? `
      <div id="profile-class-picker-row" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:10px;" ${isGeneralProfileEditMode ? '' : 'hidden'}>
        <select id="profile-class-to-add-select" style="padding:7px 10px; font-size:14px; border:1px solid #cbd8cd; border-radius:6px; background:#fff; outline:none; flex:1 1 180px;">
          ${addOptionsHtml}
        </select>
        <button type="button" id="profile-btn-add-class" class="primary-button" style="padding:8px 14px; font-size:14px; font-weight:700;">+ Thêm lớp</button>
      </div>
    ` : `<small id="profile-class-picker-row" style="color:#5b7760; font-weight:600; display:block; margin-top:6px;" ${isGeneralProfileEditMode ? '' : 'hidden'}>(Đã gắn tất cả các lớp)</small>`;

    wrap.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
        ${chipsHtml}
      </div>
      ${pickerHtml}
    `;

    wrap.querySelectorAll('[data-open-class-drilldown]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const targetClassId = btn.dataset.openClassDrilldown;
        $('#student-profile-dialog').close();
        if (window.__featuresApp?.openStudentClassProfile) {
          window.__featuresApp.openStudentClassProfile(student.id, targetClassId);
        }
      };
    });

    wrap.querySelectorAll('[data-remove-class-chip]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        if (!isGeneralProfileEditMode) return;
        const cid = btn.dataset.removeClassChip;
        enrolledClassIds = enrolledClassIds.filter(id => id !== cid);
        activeProfileEnrolledClassIds = enrolledClassIds;
        renderEnrolledClassesUI();
      };
    });

    const addBtn = wrap.querySelector('#profile-btn-add-class');
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.preventDefault();
        if (!isGeneralProfileEditMode) return;
        const select = wrap.querySelector('#profile-class-to-add-select');
        const selectedClassId = select?.value;
        if (selectedClassId && !enrolledClassIds.includes(selectedClassId)) {
          enrolledClassIds.push(selectedClassId);
          activeProfileEnrolledClassIds = enrolledClassIds;
          renderEnrolledClassesUI();
        }
      };
    }
  }

  renderEnrolledClassesUI();
  const statusSelectEl = $('#profile-enrollment-status-select');
  const statusCustomEl = $('#profile-enrollment-status-custom');
  if (statusSelectEl && statusCustomEl) {
    statusSelectEl.onchange = () => {
      const isCustom = statusSelectEl.value === '__custom__';
      statusCustomEl.style.display = isCustom ? 'block' : 'none';
      if (isCustom) statusCustomEl.focus();
    };
  }
  setGeneralStudentProfileEditMode(false);

  $('#open-drive-config-from-profile-btn')?.addEventListener('click', () => {
    $('#google-sheets-sync-btn')?.click();
  });

  if ($('#unlock-student-profile-btn')) {
    $('#unlock-student-profile-btn').onclick = () => {
      setGeneralStudentProfileEditMode(true);
      renderEnrolledClassesUI();
      $('#profile-family-name')?.focus();
    };
  }
  if ($('#cancel-student-profile-edit-btn')) {
    $('#cancel-student-profile-edit-btn').onclick = () => {
      openStudentProfile(student.id, origin);
    };
  }

  const handlePortraitImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast('Vui lòng chọn file hình ảnh (PNG, JPG, WebP...).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const rawDataUrl = loadEvt.target.result;
      const img = new Image();
      img.onload = async () => {
        let previewDataUrl = rawDataUrl;
        let fullDataUrl = rawDataUrl;
        try {
          // 1. Build Full-size high resolution (up to 1440x1920) for Google Drive & Zoom modal
          const maxFullW = 1440, maxFullH = 1920;
          let fw = img.width || maxFullW, fh = img.height || maxFullH;
          if (fw > maxFullW || fh > maxFullH) {
            const r = Math.min(maxFullW / fw, maxFullH / fh);
            fw = Math.round(fw * r);
            fh = Math.round(fh * r);
          }
          const cFull = document.createElement('canvas');
          cFull.width = fw; cFull.height = fh;
          const ctxFull = cFull.getContext('2d');
          ctxFull.fillStyle = '#ffffff';
          ctxFull.fillRect(0, 0, fw, fh);
          ctxFull.drawImage(img, 0, 0, fw, fh);
          fullDataUrl = cFull.toDataURL('image/jpeg', 0.90);

          // 2. Build fast card preview (480x640)
          const maxPrevW = 480, maxPrevH = 640;
          let pw = img.width || maxPrevW, ph = img.height || maxPrevH;
          if (pw > maxPrevW || ph > maxPrevH) {
            const r2 = Math.min(maxPrevW / pw, maxPrevH / ph);
            pw = Math.round(pw * r2);
            ph = Math.round(ph * r2);
          }
          const cPrev = document.createElement('canvas');
          cPrev.width = pw; cPrev.height = ph;
          const ctxPrev = cPrev.getContext('2d');
          ctxPrev.fillStyle = '#ffffff';
          ctxPrev.fillRect(0, 0, pw, ph);
          ctxPrev.drawImage(img, 0, 0, pw, ph);
          previewDataUrl = cPrev.toDataURL('image/jpeg', 0.85);
        } catch {}

        const res = await uploadStudentPhotoToDrive(student, fullDataUrl, previewDataUrl, classCatalog);
        saveStudentRecords(students, makeupStudents);
        save();
        render();
        toast(res?.uploadedToDrive
          ? `Đã tải ảnh Full-size lên Google Drive: ${res.fileName}`
          : `Đã lưu ảnh chân dung (${res?.fileName || student.name}).`);
        openStudentProfile(student.id, origin);
      };
      img.onerror = async () => {
        await uploadStudentPhotoToDrive(student, rawDataUrl, rawDataUrl, classCatalog);
        saveStudentRecords(students, makeupStudents);
        save();
        render();
        openStudentProfile(student.id, origin);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const uploadInput = $('#profile-upload-portrait-input');
  if (uploadInput) {
    uploadInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) handlePortraitImageFile(file);
    };
  }

  // Support Ctrl+V pasting image directly while #student-profile-dialog is open
  const dlgEl = $('#student-profile-dialog');
  if (dlgEl && !dlgEl.dataset.pasteBound) {
    dlgEl.dataset.pasteBound = '1';
    dlgEl.addEventListener('paste', (e) => {
      if (!dlgEl.open || !activeProfileId) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          const targetStu = studentById(activeProfileId);
          if (file && targetStu) {
            toast('Đang xử lý ảnh chân dung vừa dán (Ctrl+V)...');
            handlePortraitImageFile(file);
          }
          break;
        }
      }
    });
  }

  const removePhotoBtn = $('#profile-remove-photo-btn');
  if (removePhotoBtn) {
    removePhotoBtn.onclick = () => {
      if (!confirm('Bạn có chắc muốn xóa ảnh chân dung này?')) return;
      student.photoURL = null;
      student.photoFullURL = null;
      student.photoDriveFileId = null;
      saveStudentRecords(students, makeupStudents);
      save();
      render();
      toast('Đã xóa ảnh chân dung.');
      openStudentProfile(student.id, origin);
    };
  }

  $('#student-profile-content').querySelector('#student-photo-expand')?.addEventListener('click',()=>{
    const urls = resolveStudentPhotoUrls(student);
    const rawUrl = String(urls.fullUrl || $('#profile-photo-url')?.value || student.photoURL || '').trim();
    const cleanUrl = rawUrl.startsWith('data:image/') ? rawUrl : safeHttpUrl(rawUrl);
    if(!cleanUrl)return;
    $('#student-photo-full').src=cleanUrl;
    $('#student-photo-caption').textContent=`${student.name} (${student.photoDriveFileName || buildStudentDrivePhotoFileName(student, classCatalog)})`;
    $('#student-photo-dialog').showModal();
  });

  $('#student-profile-dialog').showModal();
}

const closeStudentProfile = () => {
  $('#student-profile-dialog').close();
  const origin = previousStudentProfileOrigin;
  previousStudentProfileOrigin = null;
  if (origin?.from === 'class-profile') {
    if (window.__featuresApp?.openStudentClassProfile) {
      window.__featuresApp.openStudentClassProfile(activeProfileId, origin.classId);
    }
  } else if (origin?.from === 'directory') {
    if (window.__featuresApp?.renderMasterStudentDirectory) {
      window.__featuresApp.renderMasterStudentDirectory();
      $('#student-directory-dialog')?.showModal();
    }
  }
};
$('#close-student-profile').onclick=closeStudentProfile;
if($('#close-student-profile-secondary'))$('#close-student-profile-secondary').onclick=closeStudentProfile;
$('#close-student-photo').onclick=()=>$('#student-photo-dialog').close();

$('#save-student-profile').onclick=async ()=>{
  const student=studentById(activeProfileId);
  if(!student)return;
  const familyName=$('#profile-family-name').value.trim(),
        givenName=$('#profile-given-name').value.trim(),
        name=[familyName,givenName].filter(Boolean).join(' '),
        photoValue=($('#profile-photo-url')?.value || '').trim();

  if(!name){
    toast('Hãy nhập họ tên học sinh.');
    $('#profile-given-name').focus();
    return;
  }

  let photo = student.photoURL || null;
  const extractedDriveId = extractGoogleDriveFileId(photoValue);
  if (extractedDriveId) {
    student.photoDriveFileId = extractedDriveId;
    photo = buildDrivePhotoUrl(extractedDriveId, 'w600');
    student.photoFullURL = buildDrivePhotoUrl(extractedDriveId, 'w2400');
  } else if (photoValue) {
    if (photoValue.startsWith('data:image/')) {
      photo = photoValue;
    } else {
      photo = safeHttpUrl(photoValue);
      if (!photo) {
        toast('Link ảnh cần là link Google Drive hoặc bắt đầu bằng http://, https://');
        $('#profile-photo-url').focus();
        return;
      }
    }
  } else {
    photo = null;
    student.photoDriveFileId = null;
    student.photoFullURL = null;
  }

  const rawCode = $('#profile-code').value.trim();
  const prevCode = student.studentCode || '';
  const prevName = student.name || '';

  student.studentCode = rawCode ? rawCode.toUpperCase() : null;
  student.familyName = familyName;
  student.givenName = givenName;
  student.name = name;
  student.school = $('#profile-school').value.trim();
  student.parentContact = {
    name: ($('#profile-parent-name')?.value || '').trim(),
    phone: ($('#profile-parent-phone')?.value ?? student.parentContact?.phone ?? '').trim()
  };
  const statusSelVal = $('#profile-enrollment-status-select')?.value || 'Học';
  const statusCustomVal = ($('#profile-enrollment-status-custom')?.value || '').trim();
  student.enrollmentStatus = statusSelVal === '__custom__' ? (statusCustomVal || 'Học') : statusSelVal;

  if (Array.isArray(activeProfileEnrolledClassIds)) {
    student.classIds = [...activeProfileEnrolledClassIds];
  }

  student.tags = [...new Set($('#profile-tags').value.split(',').map(tag=>tag.trim()).filter(Boolean))].filter(t => t.toLowerCase() !== 'học bù');
  student.photoURL = photo || null;
  if ($('#profile-office-notes')) {
    student.officeNotes = $('#profile-office-notes').value.trim();
  }
  student.updatedAt = Date.now();
  student.revision = (Number(student.revision) || 0) + 1;

  saveStudentRecords(students, makeupStudents);
  save();
  refreshAllActiveViews();
  closeDialogSafely('#student-profile-dialog');
  toast(`✓ Đã lưu thông tin hồ sơ của ${student.name}.`);

  // Đồng bộ đổi tên ảnh trên Google Drive dưới nền (không chặn giao diện)
  syncStudentDrivePhotoRename(student, classCatalog).then(renameRes => {
    if (renameRes?.renamed && (prevCode !== (student.studentCode || '') || prevName !== student.name)) {
      saveStudentRecords(students, makeupStudents);
    }
  }).catch(() => {});
};

// =========================================================================
// KIỂU 3: HỒ SƠ HỌC SINH TRONG BUỔI HỌC (SESSION-LEVEL STUDENT PROFILE)
// Cho phép chỉnh sửa trực tiếp (Inline Edit) Điểm danh, Vị trí ngồi, BTVN, Điểm BTVN, Điểm Test, Ghi chú buổi học
// =========================================================================
let activeSessionProfileCtx = null;

function openStudentSessionProfile(studentId, classId = CURRENT_CLASS_ID, sessionDate = checklistDate) {
  const student = studentById(studentId);
  if (!student) return;
  const targetClassId = classId || CURRENT_CLASS_ID;
  const targetDate = sessionDate || checklistDate;
  const cls = resolveClass(targetClassId) || activeClassConfig();
  const isCurrentLiveSession = (targetClassId === CURRENT_CLASS_ID && targetDate === checklistDate);
  const histSessRecord = window.__featuresApp?.getSessionRecord ? window.__featuresApp.getSessionRecord(targetClassId, targetDate) : null;
  const isNoHwForSession = isCurrentLiveSession
    ? Boolean(window.__featuresApp?.isNoHomeworkSession?.() || $('#session-no-hw-checkbox')?.checked)
    : Boolean(histSessRecord?.noHomework || histSessRecord?.hasBtvn === false);
  const hasTestForSession = isCurrentLiveSession
    ? Boolean(checklist?.testRequired || $('#test-required-toggle')?.checked || $('#scores-tab-test-toggle')?.checked)
    : Boolean(histSessRecord?.hasTest || (student.scores || []).some(sc => sc.classId === targetClassId && sc.date === targetDate && sc.type && sc.type !== 'BTVN'));

  activeSessionProfileCtx = { studentId, classId: targetClassId, sessionDate: targetDate };

  const dlg = $('#student-session-profile-dialog');
  if (!dlg) return;

  const dateFormatted = new Date(`${targetDate}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  $('#student-session-profile-eyebrow').textContent = `HỒ SƠ HỌC SINH TRONG BUỔI HỌC · ${cls?.code || cls?.name || ''}`;
  $('#student-session-profile-title').textContent = `${student.name} · Buổi ${dateFormatted}`;

  const placements = isCurrentLiveSession
    ? new Map(allEntries().filter(({ entry }) => entry.studentId).map(p => [p.entry.studentId, p]))
    : new Map();
  const place = placements.get(student.id);
  const inLate = isCurrentLiveSession && lateQueue.includes(student.id);

  const attHist = (student.attendanceHistory || []).find(h => h.classId === targetClassId && h.date === targetDate);
  const sessNoteObj = (student.sessionNotes || []).find(n => n.classId === targetClassId && n.date === targetDate);
  const btvnScoreObj = (student.scores || []).find(sc => sc.classId === targetClassId && sc.date === targetDate && (!sc.type || sc.type === 'BTVN'));
  const testScoreObj = (student.scores || []).find(sc => sc.classId === targetClassId && sc.date === targetDate && sc.type && sc.type !== 'BTVN');

  const curAttStatus = place?.entry.attendance?.status
    || (inLate ? 'late' : null)
    || attHist?.status
    || 'unmarked';
  const curLateMins = place?.entry.attendance?.lateMinutes
    || attHist?.lateMinutes
    || attHist?.minutesLate
    || 10;

  const curHwStatus = place?.entry.homework?.status
    || sessNoteObj?.homeworkStatus
    || attHist?.homework?.status
    || 'uncollected';
  const curHwReason = place?.entry.homework?.reason
    || sessNoteObj?.homeworkReason
    || '';
  const curHwScore = place?.entry.homework?.score
    ?? sessNoteObj?.homeworkScore
    ?? btvnScoreObj?.score
    ?? '';
  const curTestScore = place?.entry.testScore
    ?? (isCurrentLiveSession ? checklist.testScores?.[student.id] : null)
    ?? sessNoteObj?.testScore
    ?? testScoreObj?.score
    ?? '';
  const curNote = (isCurrentLiveSession ? sessionNoteFor(student.id) : '') || sessNoteObj?.note || '';

  const allDesksList = isCurrentLiveSession ? desks() : [];
  let currentDeskId = place?.deskId || '';
  if (!isCurrentLiveSession) {
    const sh = (student.seatingHistory || []).find(h => h.classId === targetClassId && h.date === targetDate);
    if (sh) currentDeskId = `aisle-${sh.aisle}-desk-${sh.desk}`;
  }

  const deskOptionsHtml = isCurrentLiveSession
    ? `<option value="">-- Chưa xếp bàn / Khu vực chờ --</option>` +
      allDesksList.map(d => `<option value="${escapeHtml(d.desk.id)}" ${d.desk.id === currentDeskId ? 'selected' : ''}>Dãy ${d.ci + 1} · Bàn ${d.di + 1}</option>`).join('')
    : `<option value="${escapeHtml(currentDeskId)}">${currentDeskId ? escapeHtml(currentDeskId) : 'Theo lịch sử buổi học'}</option>`;

  const parts = splitStudentName(student.name);
  const initial = (student.givenName || parts.givenName || student.name || 'H').charAt(0).toUpperCase();

  const resolvedSessPhoto = resolveStudentPhotoUrls(student);
  const sessThumbUrl = resolvedSessPhoto.thumbUrl || student.photoURL;

  $('#student-session-profile-content').innerHTML = `
    <div class="student-profile-hero-card session-hero-compact">
      <div class="student-portrait-showcase student-portrait-showcase-sm">
        ${sessThumbUrl ? `
          <button type="button" class="student-portrait-frame-btn" id="sess-prof-photo-expand" title="Bấm để phóng to ảnh chân dung">
            <img src="${escapeHtml(sessThumbUrl)}" alt="${escapeHtml(student.name)}" class="profile-portrait profile-portrait-md" />
            <span class="portrait-zoom-hint">🔍 Phóng to</span>
          </button>
        ` : `
          <div class="profile-portrait profile-portrait-md profile-portrait-placeholder">
            <div class="portrait-placeholder-circle sm">${escapeHtml(initial)}</div>
            <small class="portrait-placeholder-caption">Chưa có ảnh</small>
          </div>
        `}
      </div>
      <div class="student-hero-info">
        <div class="student-hero-title-row">
          <div class="student-hero-name-wrap">
            <strong class="student-hero-name" style="font-size:18px;">${escapeHtml(student.name)}</strong>
            ${renderInlineTags(student)}
          </div>
          <span class="enrollment-status-pill status-text-hoc">● ${escapeHtml(student.enrollmentStatus || 'Học')}</span>
        </div>
        <div class="student-hero-meta-grid">
          <div class="hero-meta-item">
            <span class="hero-meta-label">Mã học sinh</span>
            <strong class="hero-meta-value code">${escapeHtml(student.studentCode || 'Chưa cấp mã')}</strong>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-label">${student.studentType === 'makeup' ? 'Phân loại' : 'Trường học'}</span>
            <strong class="hero-meta-value">${escapeHtml(student.studentType === 'makeup' ? `Học bù (${student.sourceClassName || 'Lớp khác'})` : (student.school || 'Chưa cập nhật'))}</strong>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-label">Phụ huynh & SĐT</span>
            <strong class="hero-meta-value">${escapeHtml([student.parentContact?.name, student.parentContact?.phone].filter(Boolean).join(' · ') || 'Chưa cập nhật')}</strong>
          </div>
          <div class="hero-meta-item">
            <span class="hero-meta-label">Lớp buổi này</span>
            <strong class="hero-meta-value">${escapeHtml(cls?.code || cls?.name || '—')}</strong>
          </div>
          ${student.officeNotes ? `
            <div class="hero-meta-item hero-meta-wide">
              <span class="hero-meta-label">Ghi chú văn phòng</span>
              <span class="hero-meta-note">${escapeHtml(student.officeNotes)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="session-profile-inline-editor">
      <div class="eyebrow" style="margin-bottom:8px;">DỮ LIỆU TRONG BUỔI HỌC (CHỈNH SỬA TRỰC TIẾP - INLINE EDIT)</div>
      <div class="profile-edit-grid">
        <label class="field-label">Trạng thái Điểm danh
          <select id="sess-prof-att-status">
            <option value="unmarked" ${curAttStatus === 'unmarked' ? 'selected' : ''}>Chưa điểm danh</option>
            <option value="present" ${curAttStatus === 'present' ? 'selected' : ''}>Có mặt đúng giờ</option>
            <option value="late" ${curAttStatus === 'late' ? 'selected' : ''}>Đi muộn</option>
            <option value="absent_excused" ${curAttStatus === 'absent_excused' ? 'selected' : ''}>Vắng có phép</option>
            <option value="absent_unexcused" ${curAttStatus === 'absent_unexcused' || curAttStatus === 'absent' ? 'selected' : ''}>Vắng không phép</option>
          </select>
        </label>

        <label class="field-label" id="sess-prof-late-mins-wrap" ${curAttStatus === 'late' ? '' : 'hidden'}>Số phút đi muộn
          <input type="number" id="sess-prof-late-mins" min="0" max="180" step="5" value="${Number(curLateMins) || 10}" />
        </label>

        <label class="field-label">Vị trí chỗ ngồi trong buổi
          <select id="sess-prof-seat-select" ${isCurrentLiveSession ? '' : 'disabled'}>
            ${deskOptionsHtml}
          </select>
        </label>

        <label class="field-label">Trạng thái nộp BTVN
          <select id="sess-prof-hw-status">
            <option value="uncollected" ${curHwStatus === 'uncollected' ? 'selected' : ''}>Chưa thu</option>
            <option value="submitted" ${curHwStatus === 'submitted' || curHwStatus === 'graded' ? 'selected' : ''}>Đã nộp</option>
            <option value="not_submitted" ${curHwStatus === 'not_submitted' ? 'selected' : ''}>Chưa nộp</option>
          </select>
        </label>

        <label class="field-label" id="sess-prof-hw-reason-wrap" ${curHwStatus === 'not_submitted' ? '' : 'hidden'}>Lý do không nộp BTVN
          <select id="sess-prof-hw-reason">
            <option value="">Chọn lý do...</option>
            <option value="not_done" ${curHwReason === 'not_done' || curHwReason === 'Chưa làm' ? 'selected' : ''}>Chưa làm</option>
            <option value="forgot" ${curHwReason === 'forgot' || curHwReason === 'Quên' || curHwReason === 'Quên vở' ? 'selected' : ''}>Quên vở</option>
            <option value="missed_previous" ${curHwReason === 'missed_previous' ? 'selected' : ''}>Nghỉ buổi trước</option>
          </select>
        </label>

        <label class="field-label" id="sess-prof-hw-score-wrap" ${isNoHwForSession ? 'hidden style="display:none!important;"' : ''}>Điểm BTVN (0 – 10)
          <input type="text" inputmode="decimal" id="sess-prof-hw-score" placeholder="VD: 7,5" value="${escapeHtml(formatScoreVN(curHwScore))}" />
        </label>

        <label class="field-label" id="sess-prof-test-score-wrap" ${hasTestForSession ? '' : 'hidden style="display:none!important;"'}>Điểm Test (0 – 10)
          <input type="text" inputmode="decimal" id="sess-prof-test-score" placeholder="VD: 8,5" value="${escapeHtml(formatScoreVN(curTestScore))}" />
        </label>

        <label class="field-label profile-wide">Ghi chú trong buổi học
          <textarea id="sess-prof-note" rows="2" placeholder="Nhập ghi chú buổi học cho học sinh này...">${escapeHtml(curNote)}</textarea>
        </label>
      </div>
      <small id="sess-prof-autosave-hint" style="display:block; margin-top:8px; color:#2e6d42; font-weight:700;">Mọi thay đổi được lưu trực tiếp vào dữ liệu buổi học.</small>
    </div>
  `;

  const applyInlineSessionChanges = () => {
    const newAttStatus = $('#sess-prof-att-status')?.value || 'unmarked';
    const newLateMins = Number($('#sess-prof-late-mins')?.value) || 0;
    const newDeskId = $('#sess-prof-seat-select')?.value || '';
    let newHwStatus = $('#sess-prof-hw-status')?.value || 'uncollected';
    const newHwReason = $('#sess-prof-hw-reason')?.value || '';
    const rawHwScore = $('#sess-prof-hw-score')?.value?.trim() ?? '';
    const rawTestScore = $('#sess-prof-test-score')?.value?.trim() ?? '';
    const newNote = $('#sess-prof-note')?.value?.trim() ?? '';

    if ($('#sess-prof-late-mins-wrap')) $('#sess-prof-late-mins-wrap').hidden = (newAttStatus !== 'late');
    if ($('#sess-prof-hw-reason-wrap')) $('#sess-prof-hw-reason-wrap').hidden = (newHwStatus !== 'not_submitted');

    const parsedHw = parseScoreVN(rawHwScore);
    const parsedTest = parseScoreVN(rawTestScore);
    const numHwScore = (parsedHw !== null && !Number.isNaN(parsedHw)) ? parsedHw : null;
    const numTestScore = (parsedTest !== null && !Number.isNaN(parsedTest)) ? parsedTest : null;
    if (newHwStatus === 'graded') newHwStatus = 'submitted';
    if (numHwScore !== null && newHwStatus === 'uncollected') {
      newHwStatus = 'submitted';
      if ($('#sess-prof-hw-status')) $('#sess-prof-hw-status').value = 'submitted';
    }

    const hwObj = {
      status: newHwStatus,
      score: numHwScore,
      reason: newHwStatus === 'not_submitted' ? newHwReason : null,
      note: newNote
    };
    const attObj = newAttStatus === 'unmarked'
      ? null
      : { status: newAttStatus, lateMinutes: newAttStatus === 'late' ? newLateMins : 0, minutesLate: newAttStatus === 'late' ? newLateMins : 0 };

    if (isCurrentLiveSession) {
      const existingPlace = allEntries().find(p => p.entry.studentId === student.id);
      if (newDeskId && (!existingPlace || existingPlace.deskId !== newDeskId)) {
        if (existingPlace) {
          deskItems[existingPlace.deskId] = (deskItems[existingPlace.deskId] || []).filter(e => e.studentId !== student.id);
        }
        deskItems[newDeskId] = deskItems[newDeskId] || [];
        deskItems[newDeskId].push({ studentId: student.id, attendance: attObj, homework: hwObj, testScore: numTestScore });
        lateQueue = lateQueue.filter(id => id !== student.id);
      } else if (!newDeskId && existingPlace) {
        deskItems[existingPlace.deskId] = (deskItems[existingPlace.deskId] || []).filter(e => e.studentId !== student.id);
      }

      const activePlace = allEntries().find(p => p.entry.studentId === student.id);
      if (activePlace) {
        activePlace.entry.attendance = attObj;
        activePlace.entry.homework = hwObj;
        activePlace.entry.testScore = numTestScore;
      }

      student.attendance = attObj;
      student.homework = hwObj;
      student.testScore = numTestScore;
      if (checklist) {
        checklist.testScores = checklist.testScores || {};
        if (numTestScore !== null) checklist.testScores[student.id] = numTestScore;
        else delete checklist.testScores[student.id];
      }
      saveSessionNote(student.id, newNote);
    }

    student.attendanceHistory = Array.isArray(student.attendanceHistory) ? student.attendanceHistory : [];
    const ahIdx = student.attendanceHistory.findIndex(h => h.classId === targetClassId && h.date === targetDate);
    if (attObj) {
      const entry = { classId: targetClassId, date: targetDate, status: attObj.status, lateMinutes: attObj.lateMinutes || 0, minutesLate: attObj.lateMinutes || 0, homework: hwObj, timestamp: Date.now() };
      if (ahIdx >= 0) student.attendanceHistory[ahIdx] = entry;
      else student.attendanceHistory.unshift(entry);
    } else if (ahIdx >= 0) {
      student.attendanceHistory.splice(ahIdx, 1);
    }
    student.history = student.attendanceHistory;

    student.sessionNotes = Array.isArray(student.sessionNotes) ? student.sessionNotes : [];
    const snIdx = student.sessionNotes.findIndex(n => n.classId === targetClassId && n.date === targetDate);
    const snEntry = {
      ...(snIdx >= 0 ? student.sessionNotes[snIdx] : {}),
      classId: targetClassId,
      date: targetDate,
      homeworkStatus: hwObj.status,
      homeworkScore: numHwScore,
      homeworkReason: hwObj.reason || '',
      testScore: numTestScore,
      note: newNote
    };
    if (snIdx >= 0) student.sessionNotes[snIdx] = snEntry;
    else student.sessionNotes.unshift(snEntry);

    student.scores = Array.isArray(student.scores) ? student.scores : [];
    student.scores = student.scores.filter(sc => !(sc.classId === targetClassId && sc.date === targetDate));
    if (numHwScore !== null) {
      student.scores.unshift({ classId: targetClassId, date: targetDate, type: 'BTVN', score: numHwScore });
    }
    if (numTestScore !== null) {
      student.scores.unshift({ classId: targetClassId, date: targetDate, type: 'Test', score: numTestScore });
    }

    saveStudentRecords(students, makeupStudents);
    save();
    const attText = newAttStatus === 'present' ? 'Có mặt' : newAttStatus === 'late' ? `Đi muộn ${newLateMins}p` : newAttStatus.startsWith('absent') ? 'Vắng mặt' : 'Chưa điểm danh';
    const hwText = newHwStatus === 'submitted' ? 'Đã nộp BTVN' : newHwStatus === 'not_submitted' ? `Chưa nộp BTVN (${newHwReason})` : 'Chưa thu BTVN';
    logAdminSessionAction(
      `Cập nhật hồ sơ buổi học của HS ${student.name}`,
      `${attText} · ${hwText}${numHwScore !== null ? ` · Điểm BTVN: ${numHwScore}` : ''}${numTestScore !== null ? ` · Điểm Test: ${numTestScore}` : ''}${newNote ? ` · Ghi chú: "${newNote}"` : ''}`,
      'student',
      `inline-prof-${student.id}`,
      targetClassId,
      targetDate
    );
    render();
  };

  $('#student-session-profile-content').querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('change', applyInlineSessionChanges);
    if (el.tagName === 'TEXTAREA' || el.type === 'number') {
      el.addEventListener('input', applyInlineSessionChanges);
    }
  });

  $('#sess-prof-photo-expand')?.addEventListener('click', () => {
    if (!student.photoURL) return;
    $('#student-photo-full').src = student.photoURL;
    $('#student-photo-caption').textContent = student.name;
    $('#student-photo-dialog')?.showModal();
  });
  if ($('#close-student-session-profile')) {
    $('#close-student-session-profile').onclick = () => dlg.close();
  }
  if ($('#save-student-session-profile-btn')) {
    $('#save-student-session-profile-btn').onclick = () => {
      applyInlineSessionChanges();
      dlg.close();
      toast(`Đã lưu dữ liệu buổi học của ${student.name}.`);
    };
  }
  if ($('#session-profile-open-class-btn')) {
    $('#session-profile-open-class-btn').onclick = () => {
      applyInlineSessionChanges();
      dlg.close();
      if (window.__featuresApp?.openStudentClassProfile) {
        window.__featuresApp.openStudentClassProfile(student.id, targetClassId);
      }
    };
  }
  if ($('#session-profile-copy-zalo-btn')) {
    $('#session-profile-copy-zalo-btn').onclick = () => {
      applyInlineSessionChanges();
      if (window.__featuresApp?.copyParentZaloReportForStudent) {
        window.__featuresApp.copyParentZaloReportForStudent(student.id, targetClassId, targetDate);
      }
    };
  }

  dlg.showModal();
}
window.openStudentSessionProfile = openStudentSessionProfile;

function render(){
  updateAdminLogButtonVisibilityAndCount();
  const isNoHwActive = Boolean(window.__featuresApp?.isNoHomeworkSession?.());
  const seenSeatedIds = new Set();
  for(const {desk} of desks()){
    deskItems[desk.id]??=[];
    deskItems[desk.id] = deskItems[desk.id].filter(item => {
      if (!item || !item.studentId) return true;
      const stu = studentById(item.studentId);
      if (!stu) return false;
      if (seenSeatedIds.has(item.studentId)) return false;
      seenSeatedIds.add(item.studentId);
      return true;
    });
  }
  const occupants=allEntries();

  const classroomWrap = document.querySelector('.classroom-wrap');
  if (classroomWrap) {
    classroomWrap.classList.toggle('teacher-view-wrap', isTeacherView);
    classroomWrap.classList.toggle('seating-edit-mode-on', isSeatingEditMode);
    const boardLabel = classroomWrap.querySelector('.board-label');
    if (boardLabel) {
      boardLabel.innerHTML = isTeacherView 
        ? '<span></span>BẢNG VIẾT · BỤC GIẢNG (Góc nhìn Giáo viên từ bục giảng nhìn xuống)' 
        : '<span></span>BẢNG · ĐẦU LỚP';
    }
    const backSpan = classroomWrap.querySelector('.back-of-room > span');
    if (backSpan) {
      backSpan.textContent = isTeacherView ? 'CUỐI LỚP (Phía xa bục giảng)' : 'CUỐI LỚP';
    }
  }

  const displayLayout = isTeacherView 
    ? [...layout].reverse().map(aisle => ({
        ...aisle,
        desks: [...aisle.desks].reverse()
      }))
    : layout;

  const teacherNotice = $('#teacher-view-notice');
  if (teacherNotice) teacherNotice.hidden = !isTeacherView;

  const mapSearchQuery = normalizeSearchText($('#seating-map-search-input')?.value || '');

  classroom.innerHTML=displayLayout.map((aisle,ci)=>{
    const FIXED_SEAT_WIDTH = 116;
    const SEAT_GAP = 6;
    const DESK_EXTRA = isSeatingEditMode ? 38 : 14;
    const maxOccupants=Math.max(1,...aisle.desks.map(d=>(deskItems[d.id]||[]).length)),
          studentWidth = FIXED_SEAT_WIDTH,
          aisleWidth = Math.max(156, DESK_EXTRA + maxOccupants * FIXED_SEAT_WIDTH + Math.max(0, maxOccupants - 1) * SEAT_GAP);
    const origAisleIdx = isTeacherView ? (layout.length - 1 - ci) : ci;
    const sideLabel = isTeacherView ? (ci < displayLayout.length / 2 ? ' (Tay phải GV)' : ' (Tay trái GV)') : '';

    return `<div class="desk-row" style="--aisle-width:${aisleWidth}px;--max-occupants:${maxOccupants};--student-width:${studentWidth}px">
      <div class="row-label">
        <span>DÃY ${origAisleIdx+1}${sideLabel}</span>
        <button type="button" class="row-collect-hw-btn" data-collect-aisle="${origAisleIdx}" title="Thu BTVN cả dãy ${origAisleIdx+1}">Thu BTVN</button>
      </div>
      <div class="desks">${aisle.desks.map((desk, di)=>{
        const list=deskItems[desk.id]||[];
        const displayList = isTeacherView ? [...list].reverse() : list;
        const addBtnHtml = isSeatingEditMode ? `<button type="button" class="desk-add-compact-btn edit-active" data-add-to-desk="${desk.id}" title="Thêm vị trí ngồi vào bàn này">+</button>` : '';

        const seatsHtml = displayList.length ? displayList.map((entry,idx)=>{
          const origIndex = isTeacherView ? (list.length - 1 - idx) : idx;
          const student=studentById(entry.studentId),
                hw=entry.homework||student?.homework,
                att=entry.attendance||student?.attendance;
          const isMakeupStudent = Boolean(student && (student.studentType === 'makeup' || !(student.classIds || []).includes(CURRENT_CLASS_ID)));
          const isUncollectedWarn = Boolean(!isNoHwActive && student && (!hw || hw.status === 'uncollected'));
          const prevAtt = (student?.attendanceHistory || []).filter(h => (!h.classId || h.classId === CURRENT_CLASS_ID) && h.date && h.date < checklistDate).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
          const prevNote = (student?.sessionNotes || []).filter(n => (!n.classId || n.classId === CURRENT_CLASS_ID) && n.date && n.date < checklistDate).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
          const latestPrevDate = [prevAtt?.date, prevNote?.date].filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0];
          const isDebtWarn = Boolean(!isNoHwActive && latestPrevDate && (
            (prevAtt?.date === latestPrevDate && prevAtt?.homework?.status === 'not_submitted') ||
            (prevNote?.date === latestPrevDate && prevNote?.homeworkStatus === 'not_submitted' && (prevNote?.homeworkScore === null || prevNote?.homeworkScore === undefined))
          ));
          const warnClass = isUncollectedWarn ? 'seat-uncollected-warn' : (isDebtWarn ? 'seat-debt-warn' : '');
          const warnTag = isUncollectedWarn ? '<span class="seat-warning-tag warn-uncollected" title="Chưa thu BTVN buổi này">!</span>' : (isDebtWarn ? '<span class="seat-warning-tag warn-debt" title="Nợ BTVN buổi trước">!</span>' : '');
          const makeupBadgeHtml = isMakeupStudent ? '<span class="makeup-seat-badge" title="Học sinh học bù">BÙ</span>' : '';
          const lateSeatDet = (student && att?.status === 'late') ? resolveLateDetails(student, entry) : null;
          const isSeatActuallyLate = Boolean(lateSeatDet && lateSeatDet.isLate && lateSeatDet.lateMinutes > 0);
          const lateSeatPillHtml = isSeatActuallyLate ? `<span class="seat-late-pill" title="Đi muộn ${lateSeatDet.lateMinutes} phút (${escapeHtml(lateSeatDet.arrivalTime)})">Muộn ${lateSeatDet.lateMinutes}p</span>` : '';
          const isSearchMatch = Boolean(mapSearchQuery && student && matchesAcronymOrText(`${student.name} ${student.studentCode || ''} ${(student.tags || []).join(' ')}`, mapSearchQuery));
          return `<button class="seat occupied seat-token ${student?'seat-named':'seat-anonymous'} ${isMakeupStudent?'seat-makeup':''} ${isSeatActuallyLate?'attendance-late':''} ${warnClass} ${isSearchMatch?'seat-search-match':''}" data-entry-index="${origIndex}" data-desk-id="${desk.id}" data-student-id="${escapeHtml(student?.id||'')}" aria-label="${student?`${student.name}${isMakeupStudent?' (Học bù)':''}; BTVN ${homeworkLabel(hw?.status)}; ${attendanceLabel(att?.status)}`:'Biểu tượng học sinh chưa ghi tên'}">${student?'':`<span class="seat-symbol">${studentIcon}</span>`}${student?`<span class="seat-name">${makeupBadgeHtml}${escapeHtml(student.name)}${lateSeatPillHtml}${renderInlineTags(student)}${warnTag}<span class="homework-mark ${homeworkClass(hw?.status)}" title="${homeworkLabel(hw?.status)}">${homeworkSymbol(hw)}</span></span>`:hw?.status&&hw.status!=='uncollected'?`<span class="homework-mark ${homeworkClass(hw.status)}" title="${homeworkLabel(hw.status)}">${homeworkSymbol(hw)}</span>`:''}</button>`;
        }).join('') : '<span class="seat-empty-text">Bàn trống</span>';

        // Render desk divider right on the exact border between upper desk and lower desk
        let hasDivider = false;
        let dividerHtml = '';
        if (di < aisle.desks.length - 1) {
          const origDividerDeskIdx = isTeacherView ? (aisle.desks.length - 2 - di) : di;
          const origDividerDesk = layout[origAisleIdx]?.desks?.[origDividerDeskIdx];
          hasDivider = Boolean(origDividerDesk?.dividerAfter);
          if (hasDivider) {
            dividerHtml = `<div class="desk-divider-readonly" role="separator" aria-label="Vạch ngăn cách bàn"><span class="divider-line"></span></div>`;
          }
        }

        const deskHtml = `<div class="desk ${hasDivider ? 'has-divider-after' : ''}" data-desk-id="${desk.id}">
          <div class="desk-seats">${seatsHtml}</div>
          ${addBtnHtml}
        </div>`;

        return deskHtml + dividerHtml;
      }).join('')}</div>
    </div>`;
  }).join('');

  classroom.querySelectorAll('.row-collect-hw-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      collectAisleHomework(Number(btn.dataset.collectAisle));
    };
  });

  const named=occupants.filter(x=>x.entry.studentId && studentById(x.entry.studentId)),attended=named.filter(x=>x.entry.attendance||studentById(x.entry.studentId)?.attendance).length;
  const homeworkCounts={uncollected:0,not_submitted:0,submitted:0,graded:0};occupants.forEach(({entry})=>{const stu=entry.studentId?studentById(entry.studentId):null;const status=(entry.homework||stu?.homework)?.status||'uncollected';homeworkCounts[status]=(homeworkCounts[status]||0)+1;});
  const rosterList = classStudents();
  const rosterIds = new Set(rosterList.map(s => s.id));
  const makeupOnMapCount = new Set(named.map(x => x.entry.studentId).filter(id => id && !rosterIds.has(id))).size;
  const presentOnMapCount = occupants.length;
  const unmarkedOnMapCount = Math.max(0, presentOnMapCount - attended);
  $('#attendance-count').textContent=`${attended} / ${presentOnMapCount}`;
  const countSub = $('#attendance-count-sub');
  if (countSub) {
    if (unmarkedOnMapCount > 0) {
      countSub.textContent = `đã điểm danh / có mặt trên sơ đồ · còn ${unmarkedOnMapCount} chỗ chưa điểm danh${makeupOnMapCount > 0 ? ` (+${makeupOnMapCount} học bù)` : ''}`;
    } else {
      countSub.textContent = `đã điểm danh / có mặt trên sơ đồ${makeupOnMapCount > 0 ? ` (gồm ${makeupOnMapCount} học bù)` : ''}`;
    }
  }
  $('#remaining-count').textContent=`${unmarkedOnMapCount} học sinh trên sơ đồ chưa điểm danh (Đã điểm danh ${attended}/${presentOnMapCount} trên sơ đồ)`;
  const roomTplPill = $('#room-template-pill'); if (roomTplPill) roomTplPill.textContent = configClass?.room || 'Phòng học';
  const rosterListForAuto = classStudents();
  const allRosterMarked = rosterListForAuto.length > 0 && rosterListForAuto.every(stu => {
    const seated = occupants.find(o => o.entry.studentId === stu.id);
    const attSt = seated?.entry.attendance?.status || (lateQueue.includes(stu.id) ? 'late' : null) || (stu.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate)?.status;
    return Boolean(attSt);
  });
  // Avoid writing/removing localStorage keys inside render() so pure UI renders never trigger unnecessary Cloud pushes
  const finalizedBadge = $('#finalized-indicator-badge'); if (finalizedBadge) finalizedBadge.hidden = true;
  if (isNoHwActive) {
    $('#homework-count').textContent = '0';
    $('#homework-count-detail').textContent = 'Ca học này không có BTVN (Tự động/Đã chọn)';
  } else {
    const totalSubmittedHw = homeworkCounts.submitted + homeworkCounts.graded;
    $('#homework-count').textContent=homeworkCounts.not_submitted+totalSubmittedHw;
    $('#homework-count-detail').textContent=`${totalSubmittedHw} đã nộp · ${homeworkCounts.not_submitted} chưa nộp · ${homeworkCounts.uncollected} chưa thu`;
  }
  $('#seat-count').textContent=`${desks().length} bàn`;
  $('#roster-count').textContent=`${classStudents().length} học sinh trong danh sách lớp`;
  $('#finalize-button').disabled=!occupants.length;
  $('#pool-count').textContent='Kéo biểu tượng ở giữa vào bàn bất kỳ (hoặc chạm để thêm nhanh)';
  const quickCarryBtn = $('#quick-carryover-seating-btn');
  if (quickCarryBtn) {
    const prevSess = (!isClassHistoryViewMode && named.length === 0)
      ? getPreviousSessionSeatingRecord(CURRENT_CLASS_ID, checklistDate)
      : null;
    if (prevSess) {
      quickCarryBtn.hidden = false;
      quickCarryBtn.textContent = `↺ Xếp chỗ theo buổi trước (${formatShortDayMonth(prevSess.date)})`;
    } else {
      quickCarryBtn.hidden = true;
    }
  }
  $('#student-pool').innerHTML=`<button type="button" class="pool-token pool-token-rect" data-pool-token="0" aria-label="Kéo biểu tượng học sinh vào bàn"><span class="pool-token-icon">${studentIcon}</span><span class="pool-token-label">+ Kéo học sinh mới vào bàn (hoặc chạm để thêm)</span></button>`;
  $('#late-area').innerHTML=lateQueue.map(id=>{
    const s=studentById(id);
    if(!s)return '';
    const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(CURRENT_CLASS_ID);
    const lateDet = resolveLateDetails(s, null);
    const isActuallyLate = Boolean(lateDet.isLate && lateDet.lateMinutes > 0 && s.attendance?.status !== 'present');
    const subText = isActuallyLate
      ? `Muộn ${lateDet.lateMinutes}p · ${escapeHtml(lateDet.arrivalTime)}`
      : `${lateDet.arrivalTime ? `Đến ${escapeHtml(lateDet.arrivalTime)}` : 'Đúng giờ'} · Chờ xếp chỗ`;
    return `<button type="button" class="late-token ${isActuallyLate ? '' : 'late-token-ontime'} ${isMakeup ? 'late-makeup' : ''}" data-late-key="${id}" aria-label="${s.name}; kéo vào bàn"><span></span><span class="late-name">${isMakeup ? '<span class="makeup-seat-badge">BÙ</span>' : ''}${escapeHtml(s.name)}</span><small>${subText}</small></button>`;
  }).join('')||'<span class="late-empty">Học sinh đến lớp (chờ xếp chỗ) hoặc đi muộn sẽ chờ tại đây. Kéo vào bàn khi sẵn sàng.</span>';
  const placements = new Map(occupants.filter(({ entry }) => entry.studentId).map(place => [place.entry.studentId, place]));
  const lateSet = new Set(lateQueue);
  const allRosterAndMakeup = [...classStudents(), ...makeupStudents.filter(m => isMakeupInCurrentSession(m, placements, lateSet))];
  $('#roster-list').innerHTML=allRosterAndMakeup.map(s=>{
    const parts = splitStudentName(s.name);
    const fam = s.familyName ?? parts.familyName;
    const giv = s.givenName ?? parts.givenName;
    const isMakeup = s.studentType === 'makeup';
    const seatedPlace = allEntries().find(place=>place.entry.studentId===s.id);
    return `<div class="student-option roster-option" style="justify-content:space-between;"><span class="student-option-name"><strong>${escapeHtml(fam)} ${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-school-tag">Học bù</span>' : ''}${renderInlineTags(s)}<small>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'Hồ sơ học sinh'))} · ${attendanceLabel(seatedPlace?.entry.attendance?.status)}</small></span><button type="button" class="outline-button find-seat-btn" data-find-seat-student="${escapeHtml(s.id)}">Tìm chỗ</button></div>`;
  }).join('')||'<div class="empty-list">Danh sách lớp chưa có hồ sơ.</div>';
  renderStudentList();renderChecklist();if(typeof renderScoresView==='function')renderScoresView();
}

function collectAisleHomework(aisleIndex) {
  const aisle = layout[aisleIndex];
  if (!aisle) return;
  pushSeatingUndo();
  let count = 0;
  aisle.desks.forEach(desk => {
    const list = deskItems[desk.id] || [];
    list.forEach(entry => {
      if (!entry) return;
      const s = entry.studentId ? studentById(entry.studentId) : null;
      const curHw = (entry.homework && entry.homework.status && entry.homework.status !== 'uncollected')
        ? entry.homework
        : (s?.homework && s.homework.status && s.homework.status !== 'uncollected')
          ? s.homework
          : (entry.homework || s?.homework || { status: 'uncollected' });
      const curStatus = curHw?.status || 'uncollected';
      const hasScore = curHw?.score !== null && curHw?.score !== undefined && curHw?.score !== '';
      // Chỉ đánh dấu Đã thu (submitted) cho học sinh đang ở trạng thái Chưa thu trong dãy (dù đã điểm danh hay chưa)
      // Tuyệt đối không đánh dấu đã thu cho học sinh đang có trạng thái Không nộp (not_submitted)
      if (curStatus === 'uncollected' && curStatus !== 'not_submitted' && !hasScore) {
        const nextHw = {
          ...(curHw || {}),
          status: 'submitted',
          reason: null,
          score: null,
          note: curHw?.note || (entry.studentId ? sessionNoteFor(entry.studentId) : '') || ''
        };
        entry.homework = nextHw;
        if (s) {
          s.homework = nextHw;
          if (entry.attendance || s.attendance) {
            const att = entry.attendance || s.attendance;
            entry.attendance = att;
            s.attendance = att;
            recordHistory(s, att, nextHw);
          } else {
            s.sessionNotes = Array.isArray(s.sessionNotes) ? s.sessionNotes : [];
            const noteIdx = s.sessionNotes.findIndex(n => n.classId === CURRENT_CLASS_ID && n.date === checklistDate);
            const noteEntry = {
              ...(noteIdx >= 0 ? s.sessionNotes[noteIdx] : {}),
              classId: CURRENT_CLASS_ID,
              date: checklistDate,
              homeworkStatus: 'submitted',
              homeworkReason: '',
              homeworkScore: null,
              updatedAt: Date.now()
            };
            if (noteIdx >= 0) s.sessionNotes[noteIdx] = noteEntry;
            else s.sessionNotes.unshift(noteEntry);
          }
          s.updatedAt = Date.now();
          s.revision = (Number(s.revision) || 0) + 1;
        }
        count++;
      }
    });
  });
  save();
  if (count > 0) {
    logAdminSessionAction(`Thu BTVN nhanh cả Dãy ${aisleIndex + 1}`, `Đã đánh dấu nộp BTVN cho ${count} học sinh tại Dãy ${aisleIndex + 1}`, 'homework');
  }
  render();
  toast(count > 0 ? `✓ Đã thu BTVN cho ${count} học sinh chưa thu tại Dãy ${aisleIndex + 1}.` : `Không có học sinh nào ở trạng thái Chưa thu tại Dãy ${aisleIndex + 1}.`);
}

// Hook toolbar buttons
const undoLayoutBtn = $('#undo-layout-button');
if (undoLayoutBtn) undoLayoutBtn.onclick = undoSeating;

const toggleSeatingEditBtn = $('#toggle-seating-edit-btn');
if (toggleSeatingEditBtn) {
  toggleSeatingEditBtn.onclick = () => {
    isSeatingEditMode = !isSeatingEditMode;
    updateSeatingEditBtn();
    render();
    toast(isSeatingEditMode 
      ? 'Chế độ sửa sơ đồ: ĐANG BẬT (Cho phép kéo thả và nút + thêm học sinh).' 
      : 'Chế độ sửa sơ đồ: ĐÃ KHÓA (Khóa sửa sơ đồ; vẫn kéo được học sinh đi muộn vào bàn và bấm điểm danh).');
  };
}

const teacherViewBtn = $('#teacher-view-button');
if (teacherViewBtn) {
  teacherViewBtn.onclick = () => {
    isTeacherView = !isTeacherView;
    teacherViewBtn.classList.toggle('active', isTeacherView);
    teacherViewBtn.style.background = isTeacherView ? '#233d31' : '';
    teacherViewBtn.style.color = isTeacherView ? '#fff' : '';
    teacherViewBtn.style.borderColor = isTeacherView ? '#233d31' : '';
    teacherViewBtn.textContent = isTeacherView ? 'Góc nhìn GV (Bật)' : 'Góc nhìn Giáo viên';
    render();
    toast(isTeacherView ? 'Đã bật góc nhìn Giáo viên (bục giảng nhìn xuống).' : 'Đã quay lại góc nhìn Trợ giảng.');
  };
}

// Global Ctrl+Z shortcut for seating undo
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !$('#seat-dialog')?.open && !$('#late-dialog')?.open) {
      e.preventDefault();
      undoSeating();
    }
  }
});

function growLayoutIfNeeded(){if(!layout.length)layout.push({id:`aisle-${Date.now()}`,desks:[]});layout.at(-1).desks.push({id:`desk-${Date.now()}`,seats:2});deskItems[layout.at(-1).desks.at(-1).id]=[];}
function findSpot(deskId,index){return {deskId,index};}
function currentEntry(){
  if (!activeSpot) return null;
  const list = deskItems[activeSpot.deskId];
  if (Array.isArray(list) && list[activeSpot.index]) {
    return list[activeSpot.index];
  }
  if (selectedStudentId && Array.isArray(list)) {
    const foundIdx = list.findIndex(item => item?.studentId === selectedStudentId);
    if (foundIdx >= 0) {
      activeSpot.index = foundIdx;
      return list[foundIdx];
    }
  }
  return null;
}
function ensureCurrentSeatEntry() {
  let entry = currentEntry();
  if (entry) return entry;
  if (!activeSpot || !activeSpot.deskId) {
    const firstDesk = desks()[0]?.desk;
    if (!firstDesk) growLayoutIfNeeded();
    const fallbackDeskId = desks()[0]?.desk?.id;
    if (!fallbackDeskId) return null;
    deskItems[fallbackDeskId] = Array.isArray(deskItems[fallbackDeskId]) ? deskItems[fallbackDeskId] : [];
    activeSpot = { deskId: fallbackDeskId, index: deskItems[fallbackDeskId].length };
  }
  const list = deskItems[activeSpot.deskId] || (deskItems[activeSpot.deskId] = []);
  const targetIdx = Math.max(0, Math.min(Number(activeSpot.index) || 0, list.length));
  if (!list[targetIdx]) {
    entry = { studentId: selectedStudentId || null, homework: { status: 'uncollected' }, attendance: null };
    list.splice(targetIdx, 0, entry);
    activeSpot.index = targetIdx;
  } else {
    entry = list[targetIdx];
  }
  return entry;
}
function isMakeupStudentRecord(person, stuId = null) {
  const id = stuId || person?.id;
  if (!person && !id) return false;
  if (person?.studentType === 'makeup') return true;
  if (id && makeupStudents.some(m => m.id === id)) return true;
  if (person && Array.isArray(person.classIds) && person.classIds.length > 0 && !person.classIds.includes(CURRENT_CLASS_ID)) return true;
  return false;
}
function isNewStudentRecord(person) {
  if (!person) return false;
  if (person.isNew === true) return true;
  if (Array.isArray(person.tags) && person.tags.some(t => String(t || '').trim().toLowerCase() === 'mới')) return true;
  return false;
}
function isStudentNewOrMakeup(student) {
  if (!student) return true;
  if (isMakeupStudentRecord(student) || isNewStudentRecord(student)) return true;
  if (Array.isArray(student.tags) && student.tags.some(t => String(t).toLowerCase() === 'học bù')) return true;
  return false;
}
function permanentlyDeleteStudentFromDatabase(stuId) {
  if (!stuId) return;
  resetStudentSessionRecord(stuId);
  students = students.filter(s => s.id !== stuId);
  makeupStudents = makeupStudents.filter(m => m.id !== stuId);
  for (const { desk } of desks()) {
    if (Array.isArray(deskItems[desk.id])) {
      deskItems[desk.id] = deskItems[desk.id].filter(item => item?.studentId !== stuId);
    }
  }
  lateQueue = lateQueue.filter(id => id !== stuId);
  _recordDeletedIds([stuId]);
  saveStudentRecords(students, makeupStudents);
}

function formatHomeworkDateDM(dateStr) {
  const raw = String(dateStr || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  return raw || '—';
}

function buildPreviousHomeworkHistoryLines(student) {
  if (!student || isStudentNewOrMakeup(student)) return [];
  const byDate = new Map();

  const ensureEntry = (date) => {
    if (!date || date === checklistDate) return null;
    if (!byDate.has(date)) {
      byDate.set(date, { date, attStatus: null, hwStatus: null, score: null, note: '' });
    }
    return byDate.get(date);
  };

  // 1. From student.attendanceHistory
  for (const att of (student.attendanceHistory || [])) {
    if (att.classId && att.classId !== CURRENT_CLASS_ID) continue;
    const item = ensureEntry(att.date);
    if (!item) continue;
    if (att.status) item.attStatus = att.status;
    if (att.homework?.status) item.hwStatus = att.homework.status;
    if (att.homework?.score !== undefined && att.homework?.score !== null && att.homework?.score !== '') {
      item.score = att.homework.score;
    }
    if (att.note && !item.note) item.note = att.note;
  }

  // 2. From student.scores (BTVN)
  for (const sc of (student.scores || [])) {
    if (sc.classId && sc.classId !== CURRENT_CLASS_ID) continue;
    if (sc.type && sc.type !== 'BTVN') continue;
    const item = ensureEntry(sc.date);
    if (!item) continue;
    if (sc.score !== undefined && sc.score !== null && sc.score !== '') {
      item.score = sc.score;
      if (!item.hwStatus || item.hwStatus === 'uncollected') item.hwStatus = 'graded';
    }
  }

  // 3. From student.sessionNotes
  for (const sn of (student.sessionNotes || [])) {
    if (sn.classId && sn.classId !== CURRENT_CLASS_ID) continue;
    const item = ensureEntry(sn.date);
    if (!item) continue;
    if (sn.attendanceStatusOverride) item.attOverride = sn.attendanceStatusOverride;
    if (sn.homeworkStatus) item.hwStatus = sn.homeworkStatus;
    if (sn.homeworkScore !== undefined && sn.homeworkScore !== null && sn.homeworkScore !== '') {
      item.score = sn.homeworkScore;
    }
    if (sn.note) item.note = sn.note;
    else if (sn.homeworkStatusNote && !item.note) item.note = sn.homeworkStatusNote;
  }

  // 4. Sort descending by date
  const sorted = [...byDate.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return sorted.slice(0, 8).map(row => {
    const dm = formatHomeworkDateDM(row.date);
    let attLabel = 'Đi học';
    if (row.attOverride) {
      attLabel = String(row.attOverride).toLowerCase().includes('vắng') ? 'Vắng' : 'Đi học';
    } else if (row.attStatus && String(row.attStatus).startsWith('absent')) {
      attLabel = 'Vắng';
    }

    const hasScore = row.score !== null && row.score !== undefined && row.score !== '';
    const isSubmitted = hasScore || row.hwStatus === 'submitted' || row.hwStatus === 'graded' || row.hwStatus === 'completed';
    const hwLabel = isSubmitted
      ? (hasScore ? `đã nộp (${formatScoreVN(row.score)})` : 'đã nộp')
      : 'chưa nộp';

    const cleanNote = String(row.note || '').trim();
    const notePart = cleanNote ? ` - (ghi chú: ${cleanNote})` : '';
    return `${dm}: ${attLabel} - ${hwLabel}${notePart}`;
  });
}

function renderHomeworkHistoryPanel(prefix) {
  const isSeat = prefix === 'homework';
  const status = $(isSeat ? '#homework-status' : '#late-homework-status')?.value || 'uncollected';
  const studentId = isSeat ? (selectedStudentId || currentEntry()?.studentId) : selectedLateId;
  const student = studentId ? studentById(studentId) : null;
  const wrap = $(isSeat ? '#seat-hw-history-section' : '#late-hw-history-section');
  const listEl = $(isSeat ? '#seat-hw-history-list' : '#late-hw-history-list');
  if (!wrap || !listEl) return;

  if (status !== 'not_submitted') {
    wrap.hidden = true;
    listEl.innerHTML = '';
    return;
  }

  if (!student) {
    wrap.hidden = false;
    listEl.innerHTML = '<div class="hw-history-empty">Chọn tên học sinh ở mục Điểm danh để xem lịch sử BTVN.</div>';
    return;
  }

  // Do NOT show homework history for new or makeup students
  if (isStudentNewOrMakeup(student)) {
    wrap.hidden = true;
    listEl.innerHTML = '';
    return;
  }

  const lines = buildPreviousHomeworkHistoryLines(student);
  wrap.hidden = false;
  if (!lines.length) {
    listEl.innerHTML = '<div class="hw-history-empty">Chưa có dữ liệu BTVN các buổi trước.</div>';
  } else {
    listEl.innerHTML = lines.map(line => `<div class="hw-history-item">${escapeHtml(line)}</div>`).join('');
  }
}

function resetStudentSessionRecord(studentId, targetClassId = CURRENT_CLASS_ID, targetDate = checklistDate) {
  if (!studentId) return;
  const person = studentById(studentId);
  if (person) {
    person.attendance = null;
    person.homework = { status: 'uncollected' };
    delete person.arrivalTime;
    delete person.lateMinutes;
    delete person.minutesLate;
    delete person.testScore;
    if (Array.isArray(person.attendanceHistory)) {
      person.attendanceHistory = person.attendanceHistory.filter(h => !((!h.classId || h.classId === targetClassId) && h.date === targetDate));
      person.history = person.attendanceHistory;
    }
    if (Array.isArray(person.sessionNotes)) {
      person.sessionNotes = person.sessionNotes.filter(n => !((!n.classId || n.classId === targetClassId) && n.date === targetDate));
    }
    if (Array.isArray(person.scores)) {
      person.scores = person.scores.filter(s => !((!s.classId || s.classId === targetClassId) && s.date === targetDate));
    }
    if (Array.isArray(person.seatingHistory)) {
      person.seatingHistory = person.seatingHistory.filter(sh => !((!sh.classId || sh.classId === targetClassId) && sh.date === targetDate));
    }
    person.updatedAt = Date.now();
    person.revision = (Number(person.revision) || 0) + 1;
    if (person.studentType === 'makeup' && person.attendingClassId === targetClassId && person.attendingSessionDate === targetDate) {
      const hasOtherHistory = (person.attendanceHistory || []).length > 0 || (person.scores || []).length > 0 || (person.sessionNotes || []).length > 0;
      if (!hasOtherHistory) {
        makeupStudents = makeupStudents.filter(m => m.id !== studentId);
      }
    }
  }
  if (targetClassId === CURRENT_CLASS_ID && targetDate === checklistDate) {
    lateQueue = lateQueue.filter(id => id !== studentId);
    if (checklist?.testScores && studentId in checklist.testScores) {
      delete checklist.testScores[studentId];
    }
    if (checklist?.tests && studentId in checklist.tests) {
      delete checklist.tests[studentId];
    }
    if (attendanceNotes && studentId in attendanceNotes) {
      delete attendanceNotes[studentId];
    }
  }
  saveSessionNote(studentId, '');
}

function setHomeworkFields(home={status:'uncollected'}){
  const normStatus = home.status === 'graded' ? 'submitted' : (home.status || 'uncollected');
  $('#homework-status').value=normStatus;
  $('#homework-score').value=formatScoreVN(home.score ?? '');
  $('#homework-reason').value=home.reason||'';
  toggleHomeworkFields(normStatus,'homework');
  document.querySelectorAll('[data-homework-choice]').forEach(button=>button.classList.toggle('selected',button.dataset.homeworkChoice===normStatus));
}

function toggleHomeworkFields(status,prefix){
  const isSeat = prefix === 'homework';
  const reasonFields=$(`#${isSeat?'no-homework-fields':'late-no-homework-fields'}`);
  if(reasonFields)reasonFields.hidden=status!=='not_submitted';
  const gradeField=$(`#${isSeat?'grade-field':'late-grade-field'}`);
  if(gradeField)gradeField.hidden=(status==='not_submitted');
  renderHomeworkHistoryPanel(prefix);
}

function showAttendance(att={}){if($('#attendance-status'))$('#attendance-status').value=att.status||'present';}

function identityPicker(query=''){
  const curEntry = currentEntry();
  const currentSeatStuId = curEntry?.studentId || selectedStudentId || null;
  const used=assignedIds();
  if(currentSeatStuId)used.delete(currentSeatStuId);
  const pool=[...classStudents(),...makeupStudents.filter(student=>isMakeupInCurrentSession(student, null, lateQueue))];
  const normQ = query.trim();
  const isSameAsCurrent = Boolean(currentSeatStuId && normQ && studentById(currentSeatStuId)?.name?.trim().toLowerCase() === normQ.toLowerCase());
  const effQuery = isSameAsCurrent ? '' : normQ;
  const matches=effQuery?searchStudents(pool,effQuery,{excludeIds:used}):pool.filter(s=>!used.has(s.id));
  const optionsEl = $('#student-options');
  if (!optionsEl) return;
  optionsEl.innerHTML=matches.map(s=>`<button type="button" class="student-option ${s.id === currentSeatStuId ? 'selected-option' : ''}" data-student="${escapeHtml(s.id)}"><span class="student-option-name">${escapeHtml(s.name)}${studentSearchMeta(s)}</span><span class="student-check">${s.id === currentSeatStuId ? '✓ Đang chọn' : 'Chọn'}</span></button>`).join('')||`<div class="empty-list">${effQuery?'Chưa có hồ sơ phù hợp.':'Nhập tên để tìm học sinh trong danh sách.'}</div>`;
  optionsEl.querySelectorAll('[data-student]').forEach(b=>{
    b.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
    });
    b.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      assignStudent(b.dataset.student);
    };
  });
}

function showIdentityForm(kind='new'){
  const makeup=kind==='makeup';
  $('#identity-kind-host').innerHTML=`<div class="identity-actions"><button type="button" class="outline-button ${!makeup?'active':''}" id="new-student-choice">Học sinh mới</button><button type="button" class="outline-button ${makeup?'active':''}" id="makeup-student-choice">Học bù</button></div>`;
  $('#new-student-choice').onclick=()=>showIdentityForm('new');
  $('#makeup-student-choice').onclick=()=>showIdentityForm('makeup');
  $('#identity-form-host').innerHTML=`<div class="identity-form"><strong>${makeup?'Thông tin học sinh học bù':'Thông tin học sinh mới'}</strong><label class="field-label">Họ và tên<input id="identity-name" placeholder="Ví dụ: Nguyễn Minh Anh" /></label><label class="field-label">${makeup?'Học bù lớp':'Trường'}<input id="identity-school" placeholder="${makeup?'Ví dụ: Toán 8B (không bắt buộc)':'Tên trường (không bắt buộc)'}" /></label>${makeup?'':'<label class="field-label">Tên phụ huynh<input id="identity-parent-name" placeholder="Không bắt buộc" /></label>'}<button type="button" class="primary-button confirm-seat" id="save-identity">Xác nhận học sinh</button></div>`;
  const formEl = $('#identity-form-host');
  setTimeout(() => {
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#identity-name')?.focus();
  }, 40);
  const submitIdentity = () => {
    const name = ($('#identity-name')?.value || '').trim();
    const rawSchool = ($('#identity-school')?.value || '').trim();
    const school = rawSchool || (makeup ? 'Chưa rõ lớp' : 'Chưa cập nhật trường');
    const parentContact = {
      name: $('#identity-parent-name')?.value?.trim() || '',
      phone: $('#identity-parent-phone')?.value?.trim() || ''
    };
    if (!name) {
      toast('Vui lòng nhập họ và tên học sinh.');
      $('#identity-name')?.focus();
      return;
    }
    const student = createStudentProfile({
      name,
      school,
      kind: makeup ? 'makeup' : 'regular',
      parentContact,
      isNew: !makeup,
      tags: makeup ? [] : ['Mới']
    });
    if (makeup) makeupStudents.push(student);
    else students.push(student);
    save();
    assignStudent(student.id);
  };
  $('#save-identity').onclick = (ev) => {
    ev.preventDefault();
    submitIdentity();
  };
  formEl?.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submitIdentity();
      }
    });
  });
}

if ($('#new-or-makeup-choice')) {
  $('#new-or-makeup-choice').onclick = () => {
    const formHost = $('#identity-form-host');
    const kindHost = $('#identity-kind-host');
    const btn = $('#new-or-makeup-choice');
    const isOpen = Boolean(formHost && formHost.innerHTML.trim());
    if (isOpen) {
      if (kindHost) kindHost.innerHTML = '';
      if (formHost) formHost.innerHTML = '';
      btn.classList.remove('active');
      btn.textContent = '+ Học sinh mới / Học bù';
      $('#student-search')?.focus();
    } else {
      btn.classList.add('active');
      btn.textContent = '× Đóng nhập Học sinh mới / Học bù';
      showIdentityForm('new');
    }
  };
}

function assignStudent(id){
  if (!id) return;
  const person = studentById(id);
  if (!person) return;
  pushSeatingUndo();
  const entry = ensureCurrentSeatEntry();
  if (!entry) return;

  // Giữ nguyên trạng thái BTVN đã đánh dấu trên ghế (VD: đã bấm Thu BTVN cả dãy hoặc chọn trạng thái BTVN trước khi chọn tên)
  const preservedSeatHw = (entry.homework && entry.homework.status && entry.homework.status !== 'uncollected')
    ? { ...entry.homework }
    : null;

  const prevStuId = entry.studentId;
  if (prevStuId && prevStuId !== id) {
    resetStudentSessionRecord(prevStuId);
    entry.attendance = null;
  }

  const wasInLateQueue = lateQueue.includes(id);
  for (const { desk } of desks()) {
    const list = deskItems[desk.id] || [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] !== entry && list[i]?.studentId === id) {
        list.splice(i, 1);
        if (activeSpot && activeSpot.deskId === desk.id && i < activeSpot.index) {
          activeSpot.index = Math.max(0, activeSpot.index - 1);
        }
      }
    }
  }
  lateQueue = lateQueue.filter(lid => lid !== id);

  entry.studentId = id;
  selectedStudentId = id;

  const uiHwStatus = $('#homework-status')?.value || 'uncollected';
  const uiHwReason = $('#homework-reason')?.value || null;
  const uiHwScore = parseScoreVN($('#homework-score')?.value?.trim() || '');
  const resolvedHw = preservedSeatHw
    || (uiHwStatus !== 'uncollected' ? {
         status: uiHwStatus === 'graded' ? 'submitted' : uiHwStatus,
         score: (uiHwScore !== null && !Number.isNaN(uiHwScore)) ? uiHwScore : null,
         reason: uiHwStatus === 'not_submitted' ? uiHwReason : null,
         note: entry.homework?.note || ''
       } : null)
    || (person.homework && person.homework.status && person.homework.status !== 'uncollected' ? { ...person.homework } : { status: 'uncollected' });

  entry.homework = resolvedHw;
  person.homework = resolvedHw;

  const lateDetCandidate = resolveLateDetails(person, entry);
  const isLateStudent = Boolean(
    (person.attendance?.status === 'late' || entry.attendance?.status === 'late') &&
    lateDetCandidate.isLate &&
    lateDetCandidate.lateMinutes > 0
  );
  if (isLateStudent) {
    entry.attendance = {
      status: 'late',
      arrivalTime: lateDetCandidate.arrivalTime,
      lateMinutes: lateDetCandidate.lateMinutes,
      minutesLate: lateDetCandidate.lateMinutes,
      reason: entry.homework?.reason || null,
      note: entry.homework?.note || ''
    };
    person.arrivalTime = lateDetCandidate.arrivalTime;
    person.lateMinutes = lateDetCandidate.lateMinutes;
  } else {
    entry.attendance = {
      status: 'present',
      arrivalTime: lateDetCandidate.arrivalTime || person.arrivalTime || null,
      lateMinutes: 0,
      minutesLate: 0,
      reason: entry.homework?.reason || null,
      note: entry.homework?.note || ''
    };
    person.lateMinutes = 0;
  }
  entry._updatedAt = Date.now();
  person.attendance = entry.attendance;
  person.updatedAt = Date.now();
  person.revision = (Number(person.revision) || 0) + 1;

  recordHistory(person, entry.attendance, entry.homework);
  if (activeSpot?.deskId) {
    recordSeatHistory(person, activeSpot.deskId, activeSpot.index);
  }
  const deskLabel = activeSpot?.deskId ? (desks().find(d => d.desk.id === activeSpot.deskId)?.label || activeSpot.deskId) : 'Bàn học';
  logAdminSessionAction(
    `Xếp chỗ & điểm danh HS ${person.name}`,
    `Vị trí: ${deskLabel} (Ghế ${(Number(activeSpot?.index) || 0) + 1}) · Trạng thái: ${isLateStudent ? `Đi muộn (${person.lateMinutes || 0}p)` : 'Có mặt đúng giờ'}`,
    'attendance'
  );

  const noteField = $('#seat-general-note');
  if (noteField) {
    const preTypedNote = (!noteField.dataset.sessionNote && noteField.value) ? noteField.value.trim() : '';
    const existingNote = sessionNoteFor(id);
    const resolvedNote = existingNote || preTypedNote;
    noteField.value = resolvedNote;
    noteField.dataset.sessionNote = id;
    noteField.disabled = false;
    if (resolvedNote) {
      saveSessionNote(id, resolvedNote);
    }
  }

  // Cập nhật ngay lập tức Card Học Sinh & giao diện trong #seat-dialog trước khi render nền
  $('#seat-dialog-title').textContent = person.name;
  if ($('#student-search')) {
    $('#student-search').value = person.name;
    $('#student-search').dispatchEvent(new Event('change'));
  }
  if ($('#student-options')) $('#student-options').hidden = true;
  if ($('#identity-kind-host')) $('#identity-kind-host').innerHTML = '';
  if ($('#identity-form-host')) $('#identity-form-host').innerHTML = '';
  if ($('#new-or-makeup-choice')) {
    $('#new-or-makeup-choice').classList.remove('active');
    $('#new-or-makeup-choice').textContent = '+ Học sinh mới / Học bù';
  }
  renderStudentInfo('#selected-student-info', person);
  setHomeworkFields(entry.homework || person.homework || { status: 'uncollected' });
  renderHomeworkHistoryPanel('homework');
  if ($('#seat-dialog-hint')) {
    $('#seat-dialog-hint').textContent = `✓ Đã chọn ${person.name}. Kiểm tra trạng thái BTVN rồi bấm Lưu.`;
  }

  try {
    save();
    render();
  } catch (err) {
    console.warn('assignStudent render warning:', err);
  }

  toast(`✓ Đã chọn & điểm danh: ${person.name}`);
}

function openStudent(deskId,index){
  activeSpot=findSpot(deskId,index);
  const entry=ensureCurrentSeatEntry();
  if(!entry)return;
  selectedStudentId=entry.studentId||null;
  const deskInfo=desks().find(x=>x.desk.id===deskId),noteField=$('#seat-general-note');
  const person = selectedStudentId ? studentById(selectedStudentId) : null;
  $('#seat-dialog-title').textContent=person ? person.name : `Dãy ${(deskInfo?.ci??0)+1} · Bàn ${(deskInfo?.di??0)+1} · Vị trí ${index+1}`;
  $('#seat-dialog-hint').textContent=person?`${person.name} · cập nhật điểm danh và BTVN.`:'Chọn tên học sinh bên dưới và cập nhật trạng thái BTVN.';
  $('#pick-student-section').hidden=false;
  $('#homework-section').hidden=false;
  $('#student-search').value=person?.name||'';
  $('#student-search').dispatchEvent(new Event('change'));
  noteField.value=selectedStudentId?sessionNoteFor(selectedStudentId):(entry.homework?.note||'');
  noteField.disabled=false;
  if(selectedStudentId)noteField.dataset.sessionNote=selectedStudentId;
  else delete noteField.dataset.sessionNote;
  identityPicker('');
  $('#student-options').hidden=Boolean(person);
  $('#identity-kind-host').innerHTML='';
  $('#identity-form-host').innerHTML='';
  if ($('#new-or-makeup-choice')) { $('#new-or-makeup-choice').classList.remove('active'); $('#new-or-makeup-choice').textContent = '+ Học sinh mới / Học bù'; }
  renderStudentInfo('#selected-student-info',person);
  setHomeworkFields(entry.homework||person?.homework||{status:'uncollected'});
  renderHomeworkHistoryPanel('homework');
  $('#seat-dialog').showModal();
}

function insertIntoDesk(entry,destDeskId,destIndex,source){
  pushSeatingUndo();const target=deskItems[destDeskId]||(deskItems[destDeskId]=[]);if(source?.type==='seat'){const from=deskItems[source.deskId];from.splice(source.index,1);if(source.deskId===destDeskId&&source.index<destIndex)destIndex--;}else if(source?.type==='late')lateQueue=lateQueue.filter(id=>id!==source.studentId);destIndex=Math.max(0,Math.min(destIndex,target.length));target.splice(destIndex,0,entry);const stu=studentById(entry.studentId);recordSeatHistory(stu,destDeskId,destIndex);const destLabel=desks().find(d=>d.desk.id===destDeskId)?.label||destDeskId;logAdminSessionAction(`Di chuyển chỗ ngồi ${stu?`HS ${stu.name}`:'ghế trống'}`, `Chuyển tới ${destLabel} (Ghế ${destIndex+1})`, 'attendance');save();render();}
function dropIndexAt(deskEl,x){const tokens=[...deskEl.querySelectorAll('.desk-seats [data-entry-index]')].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);if(!tokens.length)return 0;const centers=tokens.map(token=>{const r=token.getBoundingClientRect();return r.left+r.width/2;});if(x<centers[0])return 0;for(let i=1;i<centers.length;i++)if(x<centers[i])return i;return tokens.length;}
function showDropMarker(deskEl,index){const area=deskEl.querySelector('.desk-seats');if(!area)return;const marker=area.querySelector('.drop-marker')||document.createElement('span'),tokens=[...area.querySelectorAll('[data-entry-index]')].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left),rect=area.getBoundingClientRect();marker.className='drop-marker';marker.setAttribute('aria-hidden','true');let x=rect.width/2;if(tokens.length){if(index<=0){x=tokens[0].getBoundingClientRect().left-rect.left;}else if(index>=tokens.length){x=tokens.at(-1).getBoundingClientRect().right-rect.left;}else{x=(tokens[index-1].getBoundingClientRect().right+tokens[index].getBoundingClientRect().left)/2-rect.left;}}marker.style.left=`${Math.max(1,Math.min(rect.width-4,x-2))}px`;marker.style.top='2px';marker.style.height=`${Math.max(20,rect.height-4)}px`;if(!marker.isConnected)area.append(marker);}
function addAnonymousToDesk(deskId,index,openMenu=false){
  pushSeatingUndo();const list=deskItems[deskId]||(deskItems[deskId]=[]),entry={studentId:null,homework:{status:'uncollected'},attendance:null};list.splice(index,0,entry);save();render();if(openMenu)openStudent(deskId,index);}

document.querySelectorAll('[data-homework-choice]').forEach(button=>button.onclick=()=>{
  const status=button.dataset.homeworkChoice;
  $('#homework-status').value=status;
  toggleHomeworkFields(status,'homework');
  document.querySelectorAll('[data-homework-choice]').forEach(choice=>choice.classList.toggle('selected',choice===button));
  const entry = currentEntry();
  const person = entry?.studentId ? studentById(entry.studentId) : null;
  if (entry) {
    const scVal = parseScoreVN($('#homework-score')?.value?.trim() || '');
    const sharedNote = $('#seat-general-note')?.value?.trim() || '';
    const reasonVal = status === 'not_submitted' ? ($('#homework-reason')?.value || 'not_done') : null;
    entry.homework = {
      status,
      score: scVal !== null && !Number.isNaN(scVal) ? scVal : null,
      reason: reasonVal,
      note: sharedNote
    };
    if (person && status !== 'not_submitted') {
      person.homework = entry.homework;
      recordHistory(person, entry.attendance || person.attendance || { status: 'present' }, entry.homework);
    }
    logAdminSessionAction(
      `Chọn nhanh trạng thái BTVN: ${person ? person.name : 'Ghế chưa gán tên'}`,
      `Trạng thái BTVN: ${homeworkLabel(status)}${entry.homework.score !== null ? ` · Điểm: ${entry.homework.score}` : ''}`,
      'homework',
      person ? `hw-quick-${person.id}` : ''
    );
    save();
    render();
  }
});
$('#late-homework-status').addEventListener('change',e=>toggleHomeworkFields(e.target.value,'late'));

$('#save-homework').onclick=()=>{
  const entry=ensureCurrentSeatEntry();
  if(!entry){
    $('#seat-dialog').close();
    return;
  }

  // Tự động lưu học sinh mới/học bù nếu đang nhập tên mà chưa bấm xác nhận riêng
  const idNameInp = $('#identity-name')?.value?.trim();
  if (!entry.studentId && idNameInp) {
    const idSchoolInp = $('#identity-school')?.value?.trim() || '';
    const isMakeup = Boolean($('#identity-school')?.placeholder?.includes('Toán'));
    const parentContact = {
      name: $('#identity-parent-name')?.value?.trim() || '',
      phone: $('#identity-parent-phone')?.value?.trim() || ''
    };
    const student = createStudentProfile({
      name: idNameInp,
      school: idSchoolInp || (isMakeup ? 'Chưa rõ lớp' : 'Chưa rõ trường'),
      kind: isMakeup ? 'makeup' : 'regular',
      parentContact,
      tags: isMakeup ? [] : ['Mới'],
      isNew: !isMakeup
    });
    if (isMakeup) makeupStudents.push(student);
    else students.push(student);
    save();
    assignStudent(student.id);
    toast(`Đã tự động lưu ${student.name} vào hệ thống.`);
  }

  // Nếu người dùng đã gõ tên học sinh vào ô tìm kiếm nhưng bấm thẳng nút Lưu mà chưa bấm dòng gợi ý -> tự khớp học sinh đầu tiên
  const searchTyped = $('#student-search')?.value?.trim() || '';
  if (!entry.studentId && searchTyped) {
    const used = assignedIds();
    const pool = [...classStudents(), ...makeupStudents.filter(student => isMakeupInCurrentSession(student, null, lateQueue))];
    const matched = searchStudents(pool, searchTyped, { excludeIds: used });
    if (matched.length > 0) {
      assignStudent(matched[0].id);
    }
  }

  let status=$('#homework-status').value;
  if(status==='graded')status='submitted';
  const scoreValue=$('#homework-score').value.trim();
  const parsedScore=parseScoreVN(scoreValue);
  if(status==='uncollected'&&parsedScore!==null&&!Number.isNaN(parsedScore))status='submitted';
  if(status==='not_submitted'&&!$('#homework-reason').value){
    if (entry.studentId) {
      toast('Vui lòng chọn lý do chưa nộp BTVN.');
      $('#homework-reason')?.focus();
      return;
    } else {
      $('#homework-reason').value = 'not_done';
    }
  }
  if(scoreValue&&(Number.isNaN(parsedScore)||parsedScore<0||parsedScore>10)){
    toast('Điểm BTVN cần nằm trong khoảng 0 đến 10 (VD: 7,5).');
    return;
  }
  const sharedNote=$('#seat-general-note').value.trim();
  entry.homework={status,score:parsedScore!==null&&!Number.isNaN(parsedScore)?parsedScore:null,reason:status==='not_submitted'?($('#homework-reason').value||'not_done'):null,note:sharedNote};
  entry.homeworkSaved=true;

  if (!entry.studentId) {
    // Cho phép lưu trạng thái BTVN (VD: Không nộp / Đã nộp) trước khi điểm danh tên học sinh trên ghế
    save();
    closeDialogSafely('#seat-dialog');
    refreshAllActiveViews();
    toast('✓ Đã lưu trạng thái BTVN cho chỗ ngồi (chưa điểm danh tên).');
    return;
  }

  const person=studentById(entry.studentId);
  if(person){
    saveSessionNote(person.id,sharedNote);
    person.homework=entry.homework;
    recordStudentScore(person,entry.homework.score,'BTVN');
    const lateDet = resolveLateDetails(person, entry);
    const isLateAtt = Boolean((entry.attendance?.status === 'late' || person.attendance?.status === 'late') && lateDet.isLate && lateDet.lateMinutes > 0);
    if (isLateAtt) {
      entry.attendance = {
        status: 'late',
        arrivalTime: lateDet.arrivalTime,
        lateMinutes: lateDet.lateMinutes,
        minutesLate: lateDet.lateMinutes,
        reason: entry.homework.reason,
        note: sharedNote
      };
      person.arrivalTime = lateDet.arrivalTime;
      person.lateMinutes = lateDet.lateMinutes;
    } else {
      entry.attendance = {
        status: 'present',
        arrivalTime: lateDet.arrivalTime || person.arrivalTime || null,
        lateMinutes: 0,
        minutesLate: 0,
        reason: entry.homework.reason,
        note: sharedNote
      };
      person.lateMinutes = 0;
    }
    entry._updatedAt = Date.now();
    person.attendance=entry.attendance;
    if (activeSpot?.deskId !== undefined) {
      recordSeatHistory(person, activeSpot.deskId, activeSpot.index);
    }
    recordHistory(person,entry.attendance,entry.homework);
  }
  const allSeated = allEntries().filter(e => e.entry.studentId);
  const allAccounted = allSeated.length > 0 && allSeated.every(e => {
    const st = e.entry.homework?.status || studentById(e.entry.studentId)?.homework?.status;
    return st && st !== 'uncollected';
  });
  if (allAccounted && !checklist._allHwLogged) {
    checklist._allHwLogged = true;
    addClassActivity(`${currentStaffName()} đã thu và kiểm tra hết BTVN (${allSeated.length} học sinh)`, 'homework');
    createClassNotification('Đã thu hết BTVN', `Tất cả ${allSeated.length} học sinh có mặt đã được kiểm tra BTVN.`, 'homework');
  }
  if (person) {
    person.updatedAt = Date.now();
    person.revision = (Number(person.revision) || 0) + 1;
  }
  const deskLabel = activeSpot?.deskId ? (desks().find(d => d.desk.id === activeSpot.deskId)?.label || activeSpot.deskId) : 'Bàn học';
  logAdminSessionAction(
    person ? `Lưu điểm danh & BTVN cho HS ${person.name}` : `Lưu trạng thái ghế ngồi (${deskLabel})`,
    `${deskLabel} · Điểm danh: ${entry.attendance?.status === 'late' ? `Đi muộn (${entry.attendance?.lateMinutes || 0}p)` : 'Có mặt'} · BTVN: ${homeworkLabel(entry.homework?.status)}${entry.homework?.score !== null && entry.homework?.score !== undefined ? ` (${entry.homework.score}đ)` : ''}${entry.homework?.reason ? ` [${entry.homework.reason}]` : ''}${entry.homework?.note ? ` · Ghi chú: "${entry.homework.note}"` : ''}`,
    'homework'
  );
  save();
  closeDialogSafely('#seat-dialog');
  refreshAllActiveViews();
  toast(person ? `✓ Đã điểm danh & lưu BTVN cho ${person.name}.` : '✓ Đã lưu trạng thái chỗ ngồi.');
};

$('#student-search').addEventListener('focus', e => {
  identityPicker(e.target.value);
  $('#student-options').hidden = false;
});

$('#student-search').addEventListener('input',e=>{
  identityPicker(e.target.value);
  $('#student-options').hidden=false;
});

$('#close-seat').onclick=()=>$('#seat-dialog').close();

// Square Trash Button (#clear-seat):
// - Nếu ghế đã có học sinh (đã điểm danh): hiển thị bước confirm trước khi xoá để chống bấm nhầm.
//   + Với học sinh trong lớp: reset trạng thái học sinh đó về chưa điểm danh / chưa thu BTVN.
//   + Với học sinh học bù / học sinh mới: xoá khỏi sơ đồ lớp và xoá luôn học sinh đó khỏi database.
$('#clear-seat').onclick=()=>{
  if(!activeSpot)return;
  const entry=currentEntry();
  if(!entry){
    closeDialogSafely('#seat-dialog');
    return;
  }
  const stuId = entry.studentId || selectedStudentId;
  const person = stuId ? studentById(stuId) : null;

  if (stuId) {
    const isMakeup = isMakeupStudentRecord(person, stuId);
    const isNew = !isMakeup && isNewStudentRecord(person);
    const stuName = person?.name || 'học sinh này';
    const confirmMsg = (isMakeup || isNew)
      ? `Bạn có chắc chắn muốn xoá học sinh ${isMakeup ? 'học bù' : 'mới'} "${stuName}" khỏi sơ đồ lớp không?\n\nLưu ý: Học sinh ${isMakeup ? 'học bù' : 'mới'} này sẽ bị XOÁ LUÔN khỏi cơ sở dữ liệu.`
      : `Bạn có chắc chắn muốn xoá học sinh "${stuName}" khỏi sơ đồ lớp không?\n\nTrạng thái của học sinh sẽ được reset về Chưa điểm danh / Chưa thu BTVN.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    pushSeatingUndo();
    if (Array.isArray(deskItems[activeSpot.deskId])) {
      deskItems[activeSpot.deskId].splice(activeSpot.index, 1);
    }
    if (isMakeup || isNew) {
      permanentlyDeleteStudentFromDatabase(stuId);
      selectedStudentId = null;
      logAdminSessionAction(`Xoá HS ${isMakeup ? 'học bù' : 'mới'} ${stuName} khỏi ghế & CSDL`, '', 'attendance');
      save();
      closeDialogSafely('#seat-dialog');
      refreshAllActiveViews();
      toast(`✓ Đã xoá học sinh ${isMakeup ? 'học bù' : 'mới'} ${stuName} khỏi sơ đồ và cơ sở dữ liệu.`);
      return;
    } else {
      resetStudentSessionRecord(stuId);
      selectedStudentId = null;
      logAdminSessionAction(`Bỏ xếp chỗ HS ${stuName} khỏi sơ đồ`, 'Reset về trạng thái Chưa điểm danh / Chưa thu BTVN', 'attendance');
      save();
      closeDialogSafely('#seat-dialog');
      refreshAllActiveViews();
      toast(`✓ Đã xoá ${stuName} khỏi sơ đồ (reset về Chưa điểm danh / Chưa thu BTVN).`);
      return;
    }
  }

  pushSeatingUndo();
  if (Array.isArray(deskItems[activeSpot.deskId])) {
    deskItems[activeSpot.deskId].splice(activeSpot.index, 1);
  }
  selectedStudentId = null;
  save();
  closeDialogSafely('#seat-dialog');
  refreshAllActiveViews();
  toast('✓ Đã bỏ vị trí chỗ ngồi trống.');
};

classroom.addEventListener('click',e=>{
  if(suppressClick){e.preventDefault();suppressClick=false;return;}

  const token=e.target.closest('[data-entry-index]');
  if(token){openStudent(token.dataset.deskId,Number(token.dataset.entryIndex));return;}
  const add=e.target.closest('[data-add-to-desk]');
  if(add){if(!isSeatingEditMode)return;addAnonymousToDesk(add.dataset.addToDesk,(deskItems[add.dataset.addToDesk]||[]).length,false);return;}
});

// Track divider state inside #layout-dialog before saving
let draftAisleDividers = {};

function parseMobileColumnCount(rawVal, fallback = 3) {
  const digits = String(rawVal ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let num = Number(digits);
  // If user had "1" and typed another digit 2..8 on mobile ("12".."18"), use the newly typed digit!
  if (digits.length === 2 && digits.startsWith('1') && Number(digits[1]) >= 2 && Number(digits[1]) <= 8) {
    num = Number(digits[1]);
  }
  return Math.max(1, Math.min(8, num || fallback));
}

function renderAisleFields(syncInput = false){
  const colInput = $('#column-count');
  if (!colInput) return;
  const parsed = parseMobileColumnCount(colInput.value, layout.length || 3);
  if (parsed === null && !syncInput) {
    // Allow input to stay empty on mobile while the user is deleting to type a new digit!
    return;
  }
  const count = parsed ?? Math.max(1, Math.min(8, layout.length || 3));
  if (syncInput || String(colInput.value).length >= 2) {
    colInput.value = String(count);
  }

  const prior=[...document.querySelectorAll('[data-desk-count]')].map(x=>{
    const d = String(x.value || '').replace(/[^0-9]/g, '');
    return d ? Math.max(1, Math.min(30, Number(d))) : null;
  });

  $('#aisle-config').innerHTML=Array.from({length:count},(_,i)=>{
    const deskCount = prior[i] ?? layout[i]?.desks?.length ?? 3;
    if (!draftAisleDividers[i]) {
      draftAisleDividers[i] = new Set();
      (layout[i]?.desks || []).forEach((d, di) => {
        if (d.dividerAfter) draftAisleDividers[i].add(di);
      });
    }
    const chipsHtml = deskCount > 1
      ? Array.from({ length: deskCount - 1 }, (_, di) => {
          const isAct = draftAisleDividers[i].has(di);
          return `<button type="button" class="aisle-divider-chip ${isAct ? 'active' : ''}" data-aisle-divider-chip="${i}" data-divider-di="${di}">━ Giữa bàn ${di + 1} & ${di + 2}</button>`;
        }).join('')
      : '<small style="color:#87968a; font-size:13.5px;">Cần từ 2 bàn trở lên để đặt vạch phân cách</small>';

    return `<div class="aisle-config-card">
      <label class="field-label aisle-field" style="margin:0;">
        <span>Số bàn ở dãy ${i+1}</span>
        <div class="mobile-number-stepper">
          <button type="button" class="stepper-btn" data-aisle-dec="${i}" aria-label="Giảm số bàn dãy ${i+1}">-</button>
          <input type="text" inputmode="numeric" pattern="[0-9]*" value="${deskCount}" data-desk-count="${i}" required />
          <button type="button" class="stepper-btn" data-aisle-inc="${i}" aria-label="Tăng số bàn dãy ${i+1}">+</button>
        </div>
      </label>
      <div style="margin-top:6px;">
        <small style="color:#4b6352; font-size:13.5px; font-weight:700;">Vạch phân cách bàn (Dãy ${i+1}):</small>
        <div class="aisle-divider-chips" data-aisle-chips-wrap="${i}">${chipsHtml}</div>
      </div>
    </div>`;
  }).join('');

  // Wire per-aisle stepper & divider chips
  $('#aisle-config').querySelectorAll('[data-aisle-dec]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.aisleDec);
      const inp = $('#aisle-config').querySelector(`[data-desk-count="${idx}"]`);
      if (!inp) return;
      inp.value = String(Math.max(1, (Number(inp.value) || 1) - 1));
      renderAisleFields(false);
    };
  });
  $('#aisle-config').querySelectorAll('[data-aisle-inc]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.aisleInc);
      const inp = $('#aisle-config').querySelector(`[data-desk-count="${idx}"]`);
      if (!inp) return;
      inp.value = String(Math.min(30, (Number(inp.value) || 1) + 1));
      renderAisleFields(false);
    };
  });
  $('#aisle-config').querySelectorAll('[data-desk-count]').forEach(inp => {
    inp.addEventListener('change', () => {
      const d = String(inp.value || '').replace(/[^0-9]/g, '');
      inp.value = String(Math.max(1, Math.min(30, Number(d) || 3)));
      renderAisleFields(false);
    });
  });
  $('#aisle-config').querySelectorAll('[data-aisle-divider-chip]').forEach(chip => {
    chip.onclick = () => {
      const aIdx = Number(chip.dataset.aisleDividerChip);
      const dIdx = Number(chip.dataset.dividerDi);
      draftAisleDividers[aIdx] = draftAisleDividers[aIdx] || new Set();
      if (draftAisleDividers[aIdx].has(dIdx)) draftAisleDividers[aIdx].delete(dIdx);
      else draftAisleDividers[aIdx].add(dIdx);
      chip.classList.toggle('active', draftAisleDividers[aIdx].has(dIdx));
    };
  });
}

function applyPreviousSessionSeating(closeLayoutDialog = false) {
  const prevSess = getPreviousSessionSeatingRecord(CURRENT_CLASS_ID, checklistDate);
  if (!prevSess || !prevSess.deskItems) {
    toast('Lớp chưa có dữ liệu chỗ ngồi từ buổi học trước để kế thừa.');
    return;
  }
  const rosterSet = new Set(classStudents().map(s => s.id));
  const alreadySeatedIds = new Set(allEntries().map(x => x.entry.studentId).filter(Boolean));
  pushSeatingUndo();

  if (alreadySeatedIds.size === 0 && Array.isArray(prevSess.layout) && prevSess.layout.length > 0) {
    layout = structuredClone(prevSess.layout);
  }
  for (const { desk } of desks()) {
    deskItems[desk.id] = deskItems[desk.id] || [];
  }

  const curDesksList = desks();
  const prevLayout = Array.isArray(prevSess.layout) ? prevSess.layout : [];
  let placedCount = 0;

  for (const [prevDeskId, entriesArr] of Object.entries(prevSess.deskItems)) {
    if (!Array.isArray(entriesArr) || !entriesArr.length) continue;
    let targetDeskId = deskItems[prevDeskId] !== undefined ? prevDeskId : null;
    if (!targetDeskId) {
      for (let ci = 0; ci < prevLayout.length; ci++) {
        const di = (prevLayout[ci]?.desks || []).findIndex(d => d.id === prevDeskId);
        if (di >= 0 && layout[ci]?.desks?.[di]) {
          targetDeskId = layout[ci].desks[di].id;
          break;
        }
      }
    }
    if (!targetDeskId && curDesksList.length) {
      targetDeskId = curDesksList[0].desk.id;
    }
    if (!targetDeskId) continue;

    entriesArr.forEach(item => {
      const stuId = item?.studentId;
      if (!stuId || alreadySeatedIds.has(stuId)) return;
      const stu = studentById(stuId);
      if (!stu || (!rosterSet.has(stuId) && stu.studentType === 'makeup')) return;
      deskItems[targetDeskId] = deskItems[targetDeskId] || [];
      const existingNote = sessionNoteFor(stuId) || '';
      const attObj = { status: 'present' };
      const hwObj = { status: 'uncollected', score: null, reason: null, note: existingNote };
      deskItems[targetDeskId].push({
        studentId: stuId,
        attendance: attObj,
        homework: hwObj
      });
      stu.attendance = attObj;
      stu.homework = hwObj;
      alreadySeatedIds.add(stuId);
      placedCount++;
    });
  }

  if (placedCount === 0) {
    seatingUndoStack.pop();
    updateUndoButton();
    toast('Tất cả học sinh buổi trước đều đã có chỗ trên sơ đồ hiện tại.');
    return;
  }

  save();
  logAdminSessionAction(`Kế thừa sơ đồ chỗ ngồi từ buổi trước (${prevSess.date})`, `Đã tự động xếp chỗ cho ${placedCount} học sinh theo bàn buổi trước`, 'layout');
  render();
  if (closeLayoutDialog) {
    $('#layout-dialog')?.close();
  }
  toast(`✓ Đã xếp ${placedCount} học sinh theo đúng bàn buổi trước (${prevSess.date}). Có thể bấm ↩ Hoàn tác nếu cần.`);
}

$('#quick-carryover-seating-btn')?.addEventListener('click', () => applyPreviousSessionSeating(false));
$('#layout-dialog-carryover-btn')?.addEventListener('click', () => applyPreviousSessionSeating(true));

$('#edit-layout').onclick=()=>{
  draftAisleDividers = {};
  layout.forEach((aisle, ci) => {
    draftAisleDividers[ci] = new Set();
    (aisle.desks || []).forEach((d, di) => {
      if (d.dividerAfter) draftAisleDividers[ci].add(di);
    });
  });
  const prevSess = getPreviousSessionSeatingRecord(CURRENT_CLASS_ID, checklistDate);
  const carryBox = $('#layout-dialog-carryover-box');
  const carryHint = $('#layout-dialog-carryover-hint');
  if (carryBox) {
    carryBox.hidden = !prevSess;
    if (prevSess && carryHint) {
      carryHint.textContent = `Buổi gần nhất: ${prevSess.date} (${prevSess.lessonTitle || 'Đặt học sinh vào đúng bàn buổi trước'})`;
    }
  }
  $('#column-count').value=String(layout.length);
  renderAisleFields(true);
  $('#layout-dialog').showModal();
};
$('#column-count').addEventListener('input', () => renderAisleFields(false));
$('#column-count').addEventListener('change', () => renderAisleFields(true));
$('#column-count').addEventListener('blur', () => renderAisleFields(true));
$('#col-count-dec')?.addEventListener('click', () => {
  const cur = parseMobileColumnCount($('#column-count').value, layout.length || 3) || 1;
  $('#column-count').value = String(Math.max(1, cur - 1));
  renderAisleFields(true);
});
$('#col-count-inc')?.addEventListener('click', () => {
  const cur = parseMobileColumnCount($('#column-count').value, layout.length || 3) || 1;
  $('#column-count').value = String(Math.min(8, cur + 1));
  renderAisleFields(true);
});
$('#close-layout').onclick=()=>$('#layout-dialog').close();
$('#layout-form').addEventListener('submit',e=>{
  e.preventDefault();
  const count=parseMobileColumnCount($('#column-count').value, layout.length || 3) || 1;
  $('#column-count').value = String(count);
  const counts=[...document.querySelectorAll('[data-desk-count]')].slice(0,count).map(x=>Math.max(1,Math.min(30,Number(String(x.value||'').replace(/[^0-9]/g,''))||1)));
  const next=Array.from({length:count},(_,ci)=>({
    id:layout[ci]?.id||`aisle-${Date.now()}-${ci}`,
    desks:Array.from({length:counts[ci]},(_,di)=>{
      const existingDesk = layout[ci]?.desks[di];
      const hasDiv = Boolean(draftAisleDividers[ci]?.has(di) && di < counts[ci] - 1);
      return existingDesk
        ? { ...existingDesk, dividerAfter: hasDiv }
        : { id:`desk-${Date.now()}-${ci}-${di}`, seats:2, dividerAfter: hasDiv };
    })
  }));
  for(const old of desks()){
    if(!next.some(a=>a.desks.some(d=>d.id===old.desk.id))&&(deskItems[old.desk.id]||[]).length){
      next.at(-1).desks.push(old.desk);
      toast('Giữ lại bàn có học sinh để không mất dữ liệu.');
    }
  }
  layout=next;
  for(const {desk}of desks())deskItems[desk.id]??=[];
  save();
  logAdminSessionAction('Cập nhật cấu trúc sơ đồ bàn ghế', `Số dãy: ${count} · Bàn mỗi dãy: ${counts.join(', ')}`, 'layout');
  render();
  $('#layout-dialog').close();
  toast('Đã lưu bố trí sơ đồ lớp và vạch phân cách bàn.');
});

function historyHtml(id){const history=studentById(id)?.history||[],cutoff=Date.now()-28*86400000,rows=history.filter(x=>!x.timestamp||x.timestamp>=cutoff);return rows.length?rows.slice(0,12).map(x=>`<div class="history-row"><span>${x.date||''}</span><span class="history-attendance ${x.status==='late'?'late':''}">${x.status==='late'?'Đi muộn':'Đúng giờ'}${x.time?` · ${x.time}`:''}</span><span class="history-homework ${homeworkClass(x.homework?.status)}" title="${homeworkLabel(x.homework?.status)}">${homeworkSymbol(x.homework)}</span></div>`).join(''):'<div class="empty-list">Chưa có lịch sử 4 tuần được lưu.</div>';}
function recordHistory(student,attendance,homework){
  if(!student) return;
  student.attendanceHistory = Array.isArray(student.attendanceHistory) ? student.attendanceHistory : [];
  const isLate = attendance?.status === 'late';
  const lateDet = isLate ? resolveLateDetails(student, { attendance }) : null;
  const minsLate = isLate ? lateDet.lateMinutes : 0;
  const arrTime = isLate ? lateDet.arrivalTime : (attendance?.arrivalTime || null);
  const attEntry = {
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    status: attendance?.status || 'present',
    minutesLate: minsLate,
    lateMinutes: minsLate,
    time: arrTime,
    arrivalTime: arrTime,
    reason: attendance?.reason || null,
    homework: homework ? { ...homework } : { status: 'uncollected' },
    timestamp: Date.now()
  };
  const existingIdx = student.attendanceHistory.findIndex(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
  if (existingIdx >= 0) student.attendanceHistory[existingIdx] = attEntry;
  else student.attendanceHistory.unshift(attEntry);
  student.history = student.attendanceHistory;

  student.sessionNotes = Array.isArray(student.sessionNotes) ? student.sessionNotes : [];
  const noteIdx = student.sessionNotes.findIndex(n => n.classId === CURRENT_CLASS_ID && n.date === checklistDate);
  const noteText = sessionNoteFor(student.id) || '';
  const noteEntry = {
    ...(noteIdx >= 0 ? student.sessionNotes[noteIdx] : {}),
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    homeworkStatus: homework?.status || 'uncollected',
    homeworkReason: homework?.reason || '',
    homeworkScore: homework?.score ?? null,
    note: noteText,
    updatedAt: Date.now()
  };
  if (noteIdx >= 0) student.sessionNotes[noteIdx] = noteEntry;
  else student.sessionNotes.unshift(noteEntry);
}

function recordSeatHistory(student,deskId,index){
  if(!student) return;
  const spot = desks().find(item => item.desk.id === deskId);
  student.seatingHistory = Array.isArray(student.seatingHistory) ? student.seatingHistory : [];
  const seatEntry = {
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    deskId,
    aisle: spot ? spot.ci + 1 : null,
    desk: spot ? spot.di + 1 : null,
    position: (Number(index) || 0) + 1,
    timestamp: Date.now()
  };
  const seatIdx = student.seatingHistory.findIndex(sh => sh.classId === CURRENT_CLASS_ID && sh.date === checklistDate);
  if (seatIdx >= 0) student.seatingHistory[seatIdx] = seatEntry;
  else student.seatingHistory.unshift(seatEntry);
}

function recordStudentScore(student,score,type='BTVN'){
  if(!student) return;
  student.scores = Array.isArray(student.scores) ? student.scores : [];
  const scIdx = student.scores.findIndex(sc => sc.classId === CURRENT_CLASS_ID && sc.date === checklistDate && (sc.type === type || (!sc.type && type === 'BTVN')));
  if (score === null || score === undefined || score === '') {
    if (scIdx >= 0) student.scores.splice(scIdx, 1);
    return;
  }
  const scEntry = {
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    type,
    score: Number(score),
    timestamp: Date.now()
  };
  if (scIdx >= 0) student.scores[scIdx] = scEntry;
  else student.scores.unshift(scEntry);
}

let _isSyncingLive = false;
function syncLiveSessionData() {
  if (_isSyncingLive || isClassHistoryViewMode) return;
  _isSyncingLive = true;
  try {
    const classInfo = activeClassConfig();
    const roster = classStudents();
    const entries = allEntries();
    const lateSet = new Set(lateQueue);

    // Sync seated students into their history records
    entries.forEach(({ entry, deskId, index }) => {
      if (!entry.studentId) return;
      const stu = studentById(entry.studentId);
      if (!stu) return;
      const att = entry.attendance || stu.attendance || { status: lateSet.has(stu.id) ? 'late' : 'present' };
      const hw = entry.homework || stu.homework || { status: 'uncollected' };
      recordHistory(stu, att, hw);
      recordSeatHistory(stu, deskId, index);
      if (hw.score !== null && hw.score !== undefined) {
        recordStudentScore(stu, hw.score, 'BTVN');
      }
    });

    // Sync late queue students not yet seated
    const unseatedQueueIds = lateQueue.filter(id => !entries.some(e => e.entry.studentId === id));
    unseatedQueueIds.forEach(id => {
      const stu = studentById(id);
      if (!stu) return;
      const det = resolveLateDetails(stu, null);
      const att = stu.attendance || { status: det.isLate ? 'late' : 'present', arrivalTime: det.arrivalTime, lateMinutes: det.lateMinutes, minutesLate: det.lateMinutes };
      const hw = stu.homework || { status: 'uncollected' };
      recordHistory(stu, att, hw);
    });

    // Build real-time session snapshot for session-history-repository
    const unseatedLateCount = unseatedQueueIds.filter(id => isStudentLateInSession(studentById(id), null)).length;
    const unseatedOnTimeCount = unseatedQueueIds.length - unseatedLateCount;
    const presentCount = entries.filter(e => e.entry.studentId && !isStudentLateInSession(studentById(e.entry.studentId), e.entry)).length + unseatedOnTimeCount;
    const lateCount = entries.filter(e => e.entry.studentId && isStudentLateInSession(studentById(e.entry.studentId), e.entry)).length + unseatedLateCount;
    const totalRoster = roster.length;
    const absentCount = Math.max(0, totalRoster - presentCount - lateCount);
    const hwCount = entries.filter(e => e.entry.studentId && (e.entry.homework?.status === 'submitted' || e.entry.homework?.status === 'graded')).length;
    const testsCollected = Object.values(checklist?.tests || {}).filter(Boolean).length;

    const checklistSummary = [
      ...(checklist?.items || []).map(i => ({ label: i.label, done: Boolean(i.done), doneBy: i.doneBy || null })),
      ...(checklist?.endItems || []).map(i => ({ label: i.label, done: Boolean(i.done), doneBy: i.doneBy || null }))
    ];

    const studentsSnapshot = roster.map(s => {
      const seated = entries.find(e => e.entry.studentId === s.id);
      const inQueue = lateSet.has(s.id);
      const isLate = isStudentLateInSession(s, seated?.entry || null);
      const isPresent = Boolean(seated || inQueue);
      const attHist = (s.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
      const attStatus = isLate ? 'late' : isPresent ? 'present' : (attHist?.status || 'unrecorded');
      const minsLate = seated?.entry.attendance?.lateMinutes || seated?.entry.attendance?.minutesLate || s.attendance?.lateMinutes || attHist?.lateMinutes || 0;
      const hwStatus = seated?.entry.homework?.status || s.homework?.status || 'uncollected';
      const hwScore = seated?.entry.homework?.score ?? s.homework?.score ?? null;
      const hwReason = seated?.entry.homework?.reason || s.homework?.reason || '';
      const testScore = seated?.entry.testScore ?? checklist?.testScores?.[s.id] ?? s.testScore ?? null;
      const arrTime = seated?.entry.attendance?.arrivalTime || s.attendance?.arrivalTime || s.arrivalTime || attHist?.time || null;
      return {
        studentId: s.id,
        studentName: s.name,
        studentCode: s.studentCode || null,
        school: s.school || '',
        attendance: { status: attStatus, arrivalTime: arrTime, minutesLate: isLate ? (minsLate || 10) : 0, lateMinutes: isLate ? (minsLate || 10) : 0 },
        homework: { status: hwStatus === 'graded' ? 'submitted' : hwStatus, score: hwScore, reason: hwReason },
        testScore,
        note: sessionNoteFor(s.id) || ''
      };
    });

    const staffEmp = masterData?.employees?.find(e => e.id === currentEmployeeId);
    const currentUser = {
      id: currentEmployeeId,
      name: staffEmp?.name || currentStaffName(),
      role: selectedRole()
    };

    syncActiveClassSessionRecord(CURRENT_CLASS_ID, checklistDate, currentUser, {
      className: classInfo?.name || CURRENT_CLASS_ID,
      classCode: classInfo?.code || CURRENT_CLASS_ID,
      subject: classInfo?.subject || '',
      room: classInfo?.room || '',
      grade: classInfo?.grade || '',
      teacherName: classInfo?.teacherName || '',
      assistantName: classInfo?.assistantName || '',
      lessonTitle: checklist?.lessonTitle || '',
      sessionNote: checklist?.classNote || '',
      homeworkAssignment: checklist?.homeworkAssignment || '',
      homeworkLink: checklist?.homeworkLink || '',
      notebookLink: checklist?.notebookLink || '',
      checklistSummary,
      layout,
      deskItems,
      testHandover: checklist?.handover || null,
      students: studentsSnapshot,
      stats: {
        total: totalRoster,
        present: presentCount + lateCount,
        late: lateCount,
        absent: absentCount,
        homeworkDone: hwCount,
        testsCollected
      }
    });

    window.__featuresApp?.updateSessionStateUI?.();
  } catch (err) {
    console.warn('syncLiveSessionData error:', err);
  } finally {
    _isSyncingLive = false;
  }
}
function drawLatePicker(query=''){
  const normalized=query.trim();
  const excludeIds=[...assignedIds(),...lateQueue].filter(id => id !== selectedLateId);
  const exclSet=new Set(excludeIds);
  const pool=[...classStudents(),...makeupStudents.filter(student=>isMakeupInCurrentSession(student, null, lateQueue))];
  const isSameSelected = Boolean(selectedLateId && normalized && studentById(selectedLateId)?.name?.trim().toLowerCase() === normalized.toLowerCase());
  const effQuery = isSameSelected ? '' : normalized;
  const candidates=effQuery?searchStudents(pool,effQuery,{excludeIds}):pool.filter(s=>!exclSet.has(s.id));
  const lateOptionsEl = $('#late-options');
  if (!lateOptionsEl) return;
  lateOptionsEl.innerHTML=candidates.map(s=>`<button type="button" class="student-option ${s.id === selectedLateId ? 'selected-option' : ''}" data-late-student="${escapeHtml(s.id)}"><span class="student-option-name">${escapeHtml(s.name)}${studentSearchMeta(s)}</span><span class="student-check">${s.id === selectedLateId ? '✓ Đang chọn' : 'Chọn'}</span></button>`).join('')||`<div class="empty-list">${effQuery?'Không tìm thấy hồ sơ.':'Nhập tên để tìm học sinh.'}</div>`;
  lateOptionsEl.querySelectorAll('[data-late-student]').forEach(b=>{
    b.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
    });
    b.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      selectLateStudent(b.dataset.lateStudent);
    };
  });
}

function showLateIdentityForm(kind='new'){
  const makeup=kind==='makeup';
  $('#late-identity-host').innerHTML=`<div class="identity-actions"><button type="button" class="outline-button ${!makeup?'active':''}" id="late-new-student">Học sinh mới</button><button type="button" class="outline-button ${makeup?'active':''}" id="late-makeup-student">Học bù</button></div><div class="identity-form"><strong>${makeup?'Thông tin học sinh học bù':'Thông tin học sinh mới'}</strong><label class="field-label">Họ và tên<input id="late-full-name" placeholder="Ví dụ: Nguyễn Minh Anh" /></label><label class="field-label">${makeup?'Học bù lớp':'Trường'}<input id="late-school" placeholder="${makeup?'Ví dụ: Toán 8B (không bắt buộc)':'Tên trường (không bắt buộc)'}" /></label>${makeup?'':'<label class="field-label">Tên phụ huynh<input id="late-parent-name" placeholder="Không bắt buộc" /></label>'}<button type="button" class="primary-button confirm-seat" id="create-late-student">Xác nhận học sinh</button></div>`;
  $('#late-new-student').onclick=()=>showLateIdentityForm('new');
  $('#late-makeup-student').onclick=()=>showLateIdentityForm('makeup');
  const hostEl = $('#late-identity-host');
  setTimeout(() => {
    hostEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#late-full-name')?.focus();
  }, 40);
  const submitLateIdentity = () => {
    const name = ($('#late-full-name')?.value || '').trim();
    const rawSchool = ($('#late-school')?.value || '').trim();
    const school = rawSchool || (makeup ? 'Chưa rõ lớp' : 'Chưa cập nhật trường');
    const parentContact = {
      name: $('#late-parent-name')?.value?.trim() || '',
      phone: $('#late-parent-phone')?.value?.trim() || ''
    };
    if (!name) {
      toast('Vui lòng nhập họ và tên học sinh.');
      $('#late-full-name')?.focus();
      return;
    }
    const student = createStudentProfile({
      name,
      school,
      kind: makeup ? 'makeup' : 'regular',
      parentContact,
      isNew: !makeup,
      tags: makeup ? [] : ['Mới']
    });
    if (makeup) makeupStudents.push(student);
    else students.push(student);
    save();
    selectLateStudent(student.id);
  };
  $('#create-late-student').onclick = (ev) => {
    ev.preventDefault();
    submitLateIdentity();
  };
  hostEl?.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submitLateIdentity();
      }
    });
  });
}

if ($('#late-new-or-makeup')) {
  $('#late-new-or-makeup').onclick = () => {
    const hostEl = $('#late-identity-host');
    const btn = $('#late-new-or-makeup');
    const isOpen = Boolean(hostEl && hostEl.innerHTML.trim());
    if (isOpen) {
      hostEl.innerHTML = '';
      btn.classList.remove('active');
      btn.textContent = '+ Học sinh mới / Học bù';
      $('#late-search')?.focus();
    } else {
      btn.classList.add('active');
      btn.textContent = '× Đóng nhập Học sinh mới / Học bù';
      showLateIdentityForm('new');
    }
  };
}

function setLateHomeworkFields(home={status:'uncollected'}){
  const normStatus = home.status === 'graded' ? 'submitted' : (home.status || 'uncollected');
  $('#late-homework-status').value=normStatus;
  $('#late-homework-score').value=formatScoreVN(home.score ?? '');
  $('#late-homework-reason').value=home.reason||'';
  toggleHomeworkFields(normStatus,'late');
  document.querySelectorAll('[data-late-homework-choice]').forEach(button=>button.classList.toggle('selected',button.dataset.lateHomeworkChoice===normStatus));
}

function selectLateStudent(id){
  selectedLateId=id;
  lateHomeworkSelected=true;
  const student=studentById(id),noteField=$('#late-general-note');
  if (!student) return;
  const preTypedNote = (!noteField.dataset.sessionNote && noteField.value) ? noteField.value.trim() : '';
  const existingNote = sessionNoteFor(id);
  const resolvedNote = existingNote || preTypedNote;
  $('#late-search').value=student.name;
  $('#late-search').dispatchEvent(new Event('change'));
  noteField.value=resolvedNote;
  noteField.dataset.sessionNote=id;
  if (resolvedNote) saveSessionNote(id, resolvedNote);
  $('#late-options').hidden=true;
  $('#late-identity-host').innerHTML='';
  if ($('#late-new-or-makeup')) { $('#late-new-or-makeup').classList.remove('active'); $('#late-new-or-makeup').textContent = '+ Học sinh mới / Học bù'; }
  const detailSec = $('#late-detail-section');
  if (detailSec) {
    detailSec.hidden = false;
    detailSec.removeAttribute('hidden');
    detailSec.style.display = 'block';
  }
  renderStudentInfo('#late-history', student);
  const isAlreadyInCurrentSession = lateQueue.includes(id) || allEntries().some(e => e.entry.studentId === id);
  const nowHHMM = new Date().toTimeString().slice(0,5);
  const sessionArrTime = isAlreadyInCurrentSession ? (student.attendance?.arrivalTime || student.arrivalTime || '') : '';
  $('#arrival-time').value = sessionArrTime || $('#arrival-time').value || nowHHMM;
  setLateHomeworkFields(student.homework||{status:'uncollected'});
  renderHomeworkHistoryPanel('late');
  window.__featuresApp?.updateLateMinutesCalculation?.('arrival');
  toast(`✓ Đã chọn học sinh: ${student.name}`);
}

$('#arrival-time')?.addEventListener('change', () => {
  window.__featuresApp?.updateLateMinutesCalculation?.('arrival');
});
$('#arrival-time')?.addEventListener('input', () => {
  window.__featuresApp?.updateLateMinutesCalculation?.('arrival');
});
$('#late-minutes-input')?.addEventListener('input', () => {
  window.__featuresApp?.updateLateMinutesCalculation?.('minutes');
});
$('#late-minutes-input')?.addEventListener('change', () => {
  window.__featuresApp?.updateLateMinutesCalculation?.('minutes');
});

$('#late-button').onclick=()=>{
  $('#late-search').value='';
  $('#late-search').dispatchEvent(new Event('change'));
  $('#late-pick-section').hidden=false;
  $('#late-detail-section').hidden=true;
  $('#late-options').hidden=false;
  $('#late-identity-host').innerHTML='';
  if ($('#late-new-or-makeup')) { $('#late-new-or-makeup').classList.remove('active'); $('#late-new-or-makeup').textContent = '+ Học sinh mới / Học bù'; }
  $('#save-arrival-time').checked=true;
  $('#arrival-time-field').hidden=false;
  if ($('#arrival-time')) $('#arrival-time').value = new Date().toTimeString().slice(0, 5);
  if ($('#late-minutes-input')) $('#late-minutes-input').value = '';
  window.__featuresApp?.updateLateMinutesCalculation?.('arrival');
  selectedLateId=null;
  lateHomeworkSelected=false;
  setLateHomeworkFields({status:'uncollected'});
  renderHomeworkHistoryPanel('late');
  drawLatePicker();
  $('#late-dialog').showModal();
};

$('#late-search').addEventListener('focus', e => {
  drawLatePicker(e.target.value);
  $('#late-options').hidden = false;
});

$('#late-search').addEventListener('input',e=>{
  drawLatePicker(e.target.value);
  $('#late-options').hidden=false;
});

$('#close-late').onclick=()=>$('#late-dialog').close();
$('#save-arrival-time').onchange=e=>$('#arrival-time-field').hidden=!e.target.checked;
document.querySelectorAll('[data-late-homework-choice]').forEach(button=>button.onclick=()=>{const status=button.dataset.lateHomeworkChoice;lateHomeworkSelected=true;$('#late-homework-status').value=status;toggleHomeworkFields(status,'late');document.querySelectorAll('[data-late-homework-choice]').forEach(choice=>choice.classList.toggle('selected',choice===button));});
$('#late-homework-status').addEventListener('change',e=>{lateHomeworkSelected=true;toggleHomeworkFields(e.target.value,'late');});
$('#late-search').addEventListener('input',()=>{if(!selectedLateId){const noteField=$('#late-general-note');noteField.value='';delete noteField.dataset.sessionNote;}});
$('#late-button').addEventListener('click',()=>{const noteField=$('#late-general-note');noteField.value='';delete noteField.dataset.sessionNote;});

if ($('#clear-late-student')) {
  $('#clear-late-student').onclick = () => {
    const stuId = selectedLateId;
    const person = stuId ? studentById(stuId) : null;
    if (stuId) {
      const isMakeup = isMakeupStudentRecord(person, stuId);
      const isNew = !isMakeup && isNewStudentRecord(person);
      const stuName = person?.name || 'học sinh này';
      const confirmMsg = (isMakeup || isNew)
        ? `Bạn có chắc chắn muốn xoá học sinh ${isMakeup ? 'học bù' : 'mới'} "${stuName}" khỏi sơ đồ lớp không?\n\nLưu ý: Học sinh ${isMakeup ? 'học bù' : 'mới'} này sẽ bị XOÁ LUÔN khỏi cơ sở dữ liệu.`
        : `Bạn có chắc chắn muốn xoá học sinh "${stuName}" khỏi sơ đồ lớp không?\n\nTrạng thái của học sinh sẽ được reset về Chưa điểm danh / Chưa thu BTVN.`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
      pushSeatingUndo();
      if (isMakeup || isNew) {
        permanentlyDeleteStudentFromDatabase(stuId);
      } else {
        resetStudentSessionRecord(stuId);
        for (const { desk } of desks()) {
          deskItems[desk.id] = (deskItems[desk.id] || []).filter(entry => entry.studentId !== stuId);
        }
      }
      selectedLateId = null;
      $('#late-search').value = '';
      $('#late-detail-section').hidden = true;
      logAdminSessionAction(`Xoá HS đi muộn ${stuName} khỏi danh sách đi muộn`, (isMakeup || isNew) ? 'Xoá học sinh học bù/mới khỏi CSDL' : 'Reset về Chưa điểm danh', 'attendance');
      save();
      closeDialogSafely('#late-dialog');
      refreshAllActiveViews();
      toast((isMakeup || isNew)
        ? `✓ Đã xoá học sinh ${isMakeup ? 'học bù' : 'mới'} ${stuName} khỏi sơ đồ và cơ sở dữ liệu.`
        : `✓ Đã xoá ${stuName} khỏi sơ đồ (reset về Chưa điểm danh / Chưa thu BTVN).`);
      return;
    }
    selectedLateId = null;
    $('#late-search').value = '';
    $('#late-detail-section').hidden = true;
    closeDialogSafely('#late-dialog');
  };
}

$('#save-late').onclick=()=>{
  // Auto-create student if user typed in late-full-name without clicking Xác nhận riêng
  const lateNameInp = $('#late-full-name')?.value?.trim();
  if (!selectedLateId && lateNameInp) {
    const lateSchoolInp = $('#late-school')?.value?.trim() || 'Chưa rõ trường';
    const isMakeup = Boolean($('#late-school')?.placeholder?.includes('Toán'));
    const parentContact = {
      name: $('#late-parent-name')?.value?.trim() || '',
      phone: $('#late-parent-phone')?.value?.trim() || ''
    };
    const student = createStudentProfile({ name: lateNameInp, school: lateSchoolInp, kind: isMakeup ? 'makeup' : 'regular', parentContact, isNew: !isMakeup, tags: isMakeup ? [] : ['Mới'] });
    if (isMakeup) makeupStudents.push(student);
    else students.push(student);
    save();
    selectedLateId = student.id;
  }
  const lateTyped = $('#late-search')?.value?.trim() || '';
  if (!selectedLateId && lateTyped) {
    const excludeIds = [...assignedIds(), ...lateQueue];
    const pool = [...classStudents(), ...makeupStudents.filter(student => isMakeupInCurrentSession(student, null, lateQueue))];
    const matched = searchStudents(pool, lateTyped, { excludeIds });
    if (matched.length > 0) {
      selectLateStudent(matched[0].id);
    }
  }
  if(!selectedLateId){
    toast('Vui lòng chọn tên học sinh ở danh sách bên dưới trước khi xác nhận đi muộn.');
    $('#late-options').hidden = false;
    $('#late-search').focus();
    return;
  }
  let status=$('#late-homework-status').value||'uncollected';
  if(status==='graded')status='submitted';
  const scoreValue=$('#late-homework-score').value.trim();
  const parsedScore=parseScoreVN(scoreValue);
  if(status==='uncollected'&&parsedScore!==null&&!Number.isNaN(parsedScore))status='submitted';
  if(status==='not_submitted'&&!$('#late-homework-reason').value){toast('Chọn lý do chưa nộp BTVN.');return;}
  if(scoreValue&&(Number.isNaN(parsedScore)||parsedScore<0||parsedScore>10)){toast('Điểm BTVN cần nằm trong khoảng 0 đến 10 (VD: 7,5).');return;}
  const student=studentById(selectedLateId),sharedNote=$('#late-general-note').value.trim(),homework={status,score:parsedScore!==null&&!Number.isNaN(parsedScore)?parsedScore:null,reason:status==='not_submitted'?$('#late-homework-reason').value:null,note:sharedNote};
  const startTimeStr = extractClassStartTimeStr(activeClassConfig());
  const rawArrivalVal = ($('#arrival-time')?.value || '').trim();
  let lateMinutes = 0;
  if (rawArrivalVal && /^\d{1,2}:\d{2}$/.test(rawArrivalVal)) {
    const [stH, stM] = startTimeStr.split(':').map(Number);
    const [arH, arM] = rawArrivalVal.split(':').map(Number);
    const diff = ((arH || 0) * 60 + (arM || 0)) - ((stH || 0) * 60 + (stM || 0));
    lateMinutes = diff > 0 ? diff : 0;
  } else {
    const calcMins = window.__featuresApp?.updateLateMinutesCalculation?.('arrival') ?? 0;
    lateMinutes = Math.max(0, Number(calcMins) || 0);
  }
  const isActuallyLate = lateMinutes > 0;
  const arrivalVal = $('#save-arrival-time').checked
    ? (rawArrivalVal || _addLateMinutesToTimeStr(startTimeStr, lateMinutes))
    : (isActuallyLate ? _addLateMinutesToTimeStr(startTimeStr, lateMinutes) : startTimeStr);

  const attendance = isActuallyLate
    ? { status: 'late', arrivalTime: arrivalVal, lateMinutes, minutesLate: lateMinutes }
    : { status: 'present', arrivalTime: arrivalVal, lateMinutes: 0, minutesLate: 0 };

  saveSessionNote(student.id,sharedNote);
  student.homework=homework;
  recordStudentScore(student,homework.score,'BTVN');
  student.attendance=attendance;
  student.arrivalTime=attendance.arrivalTime;
  student.lateMinutes=attendance.lateMinutes;

  // Nếu học sinh đến trước/đúng giờ: xếp xuống khu vực Cuối lớp (lateQueue) và không gắn tag muộn
  const existingSeat = allEntries().find(e => e.entry.studentId === student.id);
  if (existingSeat) {
    if (!isActuallyLate) {
      for (const { desk } of desks()) {
        deskItems[desk.id] = (deskItems[desk.id] || []).filter(entry => entry.studentId !== student.id);
      }
      if (!lateQueue.includes(student.id)) lateQueue.push(student.id);
    } else {
      existingSeat.entry.attendance = attendance;
      existingSeat.entry.homework = homework;
      existingSeat.entry._updatedAt = Date.now();
    }
  } else if (!lateQueue.includes(student.id)) {
    lateQueue.push(student.id);
  }

  recordHistory(student,attendance,homework);
  student.updatedAt = Date.now();
  student.revision = (Number(student.revision) || 0) + 1;
  logAdminSessionAction(
    isActuallyLate ? `Điểm danh đi muộn: HS ${student.name}` : `Xếp xuống cuối lớp (đến đúng/trước giờ): HS ${student.name}`,
    `${isActuallyLate ? `Muộn ${lateMinutes} phút (đến lúc ${arrivalVal})` : `Đến lúc ${arrivalVal} (Đúng giờ, không gắn tag muộn)`} · BTVN: ${homeworkLabel(homework.status)}${homework.score !== null ? ` (${homework.score}đ)` : ''}${sharedNote ? ` · Ghi chú: "${sharedNote}"` : ''}`,
    'attendance'
  );
  save();
  closeDialogSafely('#late-dialog');
  refreshAllActiveViews();
  toast(isActuallyLate
    ? `✓ ${student.name} đã điểm danh đi muộn ${lateMinutes}p (${arrivalVal}) & lưu BTVN.`
    : `✓ ${student.name} đến trước/đúng giờ (${arrivalVal}) — đã xếp xuống cuối lớp (không gắn tag muộn).`);
};

function startDrag(source,element,x,y){
  if (!isSeatingEditMode && source?.type !== 'late') return;
  dragState={source,element,x,y,started:false,targetDesk:null,dropIndex:0,ghost:null};
}
$('#student-pool').addEventListener('pointerdown',e=>{const t=e.target.closest('[data-pool-token]');if(t)startDrag({type:'pool'},t,e.clientX,e.clientY);});
classroom.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-entry-index]');if(t)startDrag({type:'seat',deskId:t.dataset.deskId,index:Number(t.dataset.entryIndex)},t,e.clientX,e.clientY);});
$('#late-area').addEventListener('pointerdown',e=>{const t=e.target.closest('[data-late-key]');if(t)startDrag({type:'late',studentId:t.dataset.lateKey},t,e.clientX,e.clientY);});
document.addEventListener('pointermove',e=>{if(!dragState)return;if(!dragState.started&&Math.hypot(e.clientX-dragState.x,e.clientY-dragState.y)>7){dragState.started=true;dragState.element.classList.add('dragging');document.body.classList.add('is-dragging');dragState.ghost=document.createElement('div');dragState.ghost.className='drag-ghost';dragState.ghost.textContent=dragState.source.type==='pool'?'Học sinh mới':dragState.source.type==='late'?studentById(dragState.source.studentId)?.name:'Di chuyển trong bàn';document.body.append(dragState.ghost);}if(dragState.started){dragState.ghost.style.left=`${e.clientX+12}px`;dragState.ghost.style.top=`${e.clientY+12}px`;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.desk[data-desk-id]');if(target!==dragState.targetDesk){dragState.targetDesk?.classList.remove('desk-drop-target');dragState.targetDesk?.querySelector('.drop-marker')?.remove();dragState.targetDesk=target;target?.classList.add('desk-drop-target');}if(target){dragState.dropIndex=dropIndexAt(target,e.clientX,e.clientY);showDropMarker(target,dragState.dropIndex);}}});
document.addEventListener('pointerup',e=>{if(!dragState)return;const drag=dragState;dragState=null;drag.element.classList.remove('dragging');drag.targetDesk?.classList.remove('desk-drop-target');drag.targetDesk?.querySelector('.drop-marker')?.remove();drag.ghost?.remove();document.body.classList.remove('is-dragging');if(!drag.started)return;suppressClick=true;setTimeout(()=>suppressClick=false,120);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.desk[data-desk-id]');if(!target)return;const deskId=target.dataset.deskId,index=dropIndexAt(target,e.clientX,e.clientY);let entry,source;if(drag.source.type==='pool'){entry={studentId:null,homework:{status:'uncollected'},attendance:null};source={type:'pool'};}else if(drag.source.type==='late'){const person=studentById(drag.source.studentId);const lateDet=resolveLateDetails(person,null);const isLate=Boolean(lateDet.isLate&&lateDet.lateMinutes>0&&person.attendance?.status!=='present');const attObj=isLate?{...(person.attendance||{}),status:'late',arrivalTime:lateDet.arrivalTime,lateMinutes:lateDet.lateMinutes,minutesLate:lateDet.lateMinutes}:{...(person.attendance||{}),status:'present',arrivalTime:lateDet.arrivalTime||person.arrivalTime||null,lateMinutes:0,minutesLate:0};person.attendance=attObj;person.arrivalTime=attObj.arrivalTime;person.lateMinutes=attObj.lateMinutes;entry={studentId:person.id,homework:person.homework||{status:'uncollected'},attendance:attObj,_updatedAt:Date.now()};source={type:'late',studentId:person.id};}else{source=drag.source;entry=deskItems[source.deskId][source.index];}if(entry){insertIntoDesk(entry,deskId,index,source);toast('Đã đặt vào vị trí thả trong bàn; học sinh ở bàn khác không bị chuyển.');}});
$('#student-pool').addEventListener('click',e=>{if(suppressClick){e.preventDefault();return;}const token=e.target.closest('[data-pool-token]');if(!token)return;const first=desks()[0]?.desk;if(!first){growLayoutIfNeeded();}const deskId=desks()[0].desk.id,index=(deskItems[deskId]||[]).length;addAnonymousToDesk(deskId,index,false);});
$('#finalize-button').onclick=()=>{if(window.__featuresApp?.handleFinalizeAttendance){window.__featuresApp.handleFinalizeAttendance();return;}const pending=allEntries().filter(x=>!x.entry.studentId||!(x.entry.attendance||studentById(x.entry.studentId)?.attendance));if(pending.length){toast(`${pending.length} biểu tượng/học sinh chưa ghi tên hoặc chưa điểm danh.`);return;}addClassActivity(`${currentStaffName()} đã chốt danh sách ${allEntries().length} học sinh có mặt`,'attendance');toast(`Đã hoàn tất ghi nhận ${allEntries().length} học sinh có mặt.`);};
$('#close-students').onclick=()=>$('#students-dialog').close();
function refreshAllActiveViews() {
  try {
    renderNotifications();
    renderPersonalWork();
    if (!$('#chat-view')?.hidden) renderClassCommunication();
    if (!$('#class-workspace')?.hidden) {
      render();
      window.__featuresApp?.updateSessionStateUI?.();
      window.__featuresApp?.initSessionNoHomework?.();
    } else {
      renderStudentList();
      if (typeof renderScoresView === 'function') renderScoresView();
    }
    if ($('#class-general-view') && !$('#class-general-view').hidden) {
      renderClassGeneralView(CURRENT_CLASS_ID);
    }
    renderMainMenu();
    if ($('#mgmt-panel-students') && !$('#mgmt-panel-students').hidden) {
      window.__featuresApp?.renderMasterStudentDirectory?.();
    }
    if ($('#mgmt-panel-staff') && !$('#mgmt-panel-staff').hidden) {
      window.__featuresApp?.renderStaffManagement?.();
    }
    if ($('#mgmt-panel-templates') && !$('#mgmt-panel-templates').hidden) {
      window.__featuresApp?.renderRoomTemplatesList?.();
    }
    if ($('#tutoring-menu-panel') && !$('#tutoring-menu-panel').hidden) {
      window.__featuresApp?.renderTutoringModule?.();
    }
    if ($('#portal-menu-panel') && !$('#portal-menu-panel').hidden) {
      window.__featuresApp?.renderTAPortal?.();
    }
  } catch (err) {
    console.warn('refreshAllActiveViews error:', err);
  }
}

const features = setupFeatures({
  $,
  escapeHtml,
  toast,
  addClassActivity,
  createClassNotification,
  getMasterData: () => masterData,
  getClassCatalog: () => classCatalog,
  getVisibleClassesForAccount: () => getVisibleClassesForAccount(),
  formatScoreVN: (v, fb) => formatScoreVN(v, fb),
  parseScoreVN: (r) => parseScoreVN(r),
  renderStudentList: () => renderStudentList(),
  renderScoresView: () => renderScoresView(),
  renderClassGeneralView: (cid) => renderClassGeneralView(cid || CURRENT_CLASS_ID),
  refreshAllActiveViews: () => refreshAllActiveViews(),
  closeDialogSafely: (dlgOrSel) => closeDialogSafely(dlgOrSel),
  saveClassCatalog: (cats) => {
    if (Array.isArray(cats)) {
      const now = Date.now();
      cats.forEach(c => { if (c && typeof c === 'object') c.updatedAt = now; });
      classCatalog = cats;
    }
    saveClassCatalog(classCatalog);
    refreshAllActiveViews();
  },
  setMasterData: (m) => {
    masterData = m;
    saveMasterData(m);
    refreshAllActiveViews();
  },
  getSignedInAccount: () => signedInAccount,
  setSignedInAccount: (acc) => {
    signedInAccount = acc;
    currentEmployeeId = acc?.employeeId || null;
    personalWorkDays = loadPersonalWorkDays();
    renderPersonalWork();
  },
  getCurrentClassId: () => CURRENT_CLASS_ID,
  getActiveClassConfig: () => activeClassConfig(),
  getChecklistDate: () => checklistDate,
  classStudents: () => classStudents(),
  studentById: (id) => studentById(id),
  allEntries: () => allEntries(),
  getLateQueue: () => lateQueue,
  getStudents: () => students,
  getMakeupStudents: () => makeupStudents,
  saveStudentRecords: (st, mk) => {
    const now = Date.now();
    if (Array.isArray(st)) {
      st.forEach(s => { if (s && typeof s === 'object' && !s.updatedAt) s.updatedAt = now; });
      students = st;
    }
    if (Array.isArray(mk)) {
      mk.forEach(s => { if (s && typeof s === 'object' && !s.updatedAt) s.updatedAt = now; });
      makeupStudents = mk;
    }
    saveStudentRecords(students, makeupStudents);
    refreshAllActiveViews();
  },
  setLayout: (newLayout) => {
    if (Array.isArray(newLayout) && newLayout.length) {
      layout = newLayout;
      for (const { desk } of desks()) deskItems[desk.id] ??= [];
      save();
    }
  },
  sessionNoteFor: (id) => sessionNoteFor(id),
  saveSessionNote: (id, val) => saveSessionNote(id, val),
  syncLiveSessionData: () => syncLiveSessionData(),
  createStudentProfile: (p) => createStudentProfile(p),
  render: () => render(),
  renderMainMenu: () => renderMainMenu(),
  setMainMenuPanel: (p) => setMainMenuPanel(p),
  attendanceLabel: (st) => attendanceLabel(st),
  homeworkLabel: (st) => homeworkLabel(st),
  homeworkSymbol: (hw) => homeworkSymbol(hw),
  sessionChanges: () => sessionChanges,
  saveClassSessionChanges: (changes) => saveClassSessionChanges(changes),
  occurrenceDate: (cls) => occurrenceDate(cls),
  sessionChangeKey: (classId, date) => sessionChangeKey(classId, date),
  enterClass: (classId, date, isHistoryMode, targetView) => enterClass(classId, date, isHistoryMode, targetView),
  openStudentProfile: (id, origin) => openStudentProfile(id, origin),
  desks: () => desks(),
  getLayout: () => layout,
  getDeskItems: () => deskItems,
  resetSessionForNewShift: (classId, date, staffName) => resetSessionForNewShift(classId, date, staffName),
  navigateTo: (path, replace) => navigateTo(path, replace),
  resolveLateDetails: (student, entry, clsObj, dateStr) => resolveLateDetails(student, entry, clsObj, dateStr),
  isStudentLateInSession: (student, entry, clsObj, dateStr) => isStudentLateInSession(student, entry, clsObj, dateStr),
  pullFromFirebaseCloudNow: (src) => pullFromFirebaseCloudNow(src),
  openManagePastSessionDialog: (classId, editDate) => openManagePastSessionDialog(classId, editDate),
  deleteClassSessionAndStudentData: (classId, date) => deleteClassSessionAndStudentData(classId, date)
});
window.__featuresApp = features;

// Initialize continuous Real-time Sync across tabs, LAN devices, and views
function refreshUIOnRealtimeUpdate(changedKeys = [], source = 'remote') {
  if (source === 'local-save') return;
  // Always reload masterData & classCatalog even on login screen so new devices receive Admin's accounts immediately
  masterData = loadMasterData();
  classCatalog = loadClassCatalog(localStorage, masterData);
  sessionChanges = loadClassSessionChanges();
  const loginScr = document.getElementById('login-screen');
  if (loginScr && !loginScr.hidden && loginScr.style.display !== 'none') {
    window.__featuresApp?.renderLoginScreen?.();
    return;
  }
  const openDlg = document.querySelector('dialog[open]');
  if (openDlg) {
    // Keep in-memory session state synchronized even while a dialog is open so saving from the dialog never overwrites another device's concurrent edits!
    const preservedSpot = activeSpot ? { ...activeSpot } : null;
    const preservedEntry = (preservedSpot && deskItems[preservedSpot.deskId]?.[preservedSpot.index])
      ? structuredClone(deskItems[preservedSpot.deskId][preservedSpot.index])
      : null;
    reloadClassSessionData(CURRENT_CLASS_ID, checklistDate);
    if (preservedSpot && preservedEntry && openDlg.id === 'seat-dialog') {
      deskItems[preservedSpot.deskId] = deskItems[preservedSpot.deskId] || [];
      if (deskItems[preservedSpot.deskId][preservedSpot.index]) {
        deskItems[preservedSpot.deskId][preservedSpot.index] = preservedEntry;
      }
    }
    if (openDlg.id === 'attendance-export-dialog') {
      window.__featuresApp?.renderReportCenter?.();
    } else if (openDlg.id === 'session-admin-log-dialog') {
      updateAdminLogButtonVisibilityAndCount();
      renderSessionAdminLogDialogContent();
    }
    if (!$('#class-workspace')?.hidden) {
      render();
    }
    _rtPendingUIRefreshAfterDialog = true;
    return;
  }
  _rtPendingUIRefreshAfterDialog = false;

  // Reload master data, class catalog, and session changes
  masterData = loadMasterData();
  classCatalog = loadClassCatalog(localStorage, masterData);
  sessionChanges = loadClassSessionChanges();

  // Check if communication changed for notifications
  const commKey = `lopvui.class-communication.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
  const previousNoticeIds = new Set((classCommunication?.notifications || []).map(item => item.id));

  // Reload active class session data & student records
  reloadClassSessionData(CURRENT_CLASS_ID, checklistDate);
  personalWorkDays = loadPersonalWorkDays();
  window.__featuresApp?.verifyActiveSessionIntegrity?.();

  // Notify new incoming notifications if any
  if (changedKeys.includes(commKey) || changedKeys.includes('*')) {
    const incoming = (classCommunication?.notifications || []).filter(item => !previousNoticeIds.has(item.id) && !item.read);
    if (incoming.length && 'Notification' in window && Notification.permission === 'granted') {
      incoming.forEach(item => {
        try { new Notification(item.title, { body: item.body, tag: item.key || item.id }); } catch {}
      });
    }
  }

  // Re-render active views smoothly without disrupting active text inputs
  renderNotifications();
  renderPersonalWork();
  if (!$('#chat-view')?.hidden) renderClassCommunication();
  if (!$('#class-workspace')?.hidden) {
    render();
    window.__featuresApp?.updateSessionStateUI?.();
    window.__featuresApp?.initSessionNoHomework?.();
  }
  if ($('#class-general-view') && !$('#class-general-view').hidden) {
    renderClassGeneralView(CURRENT_CLASS_ID);
  }
  if ($('#main-menu-view') && !$('#main-menu-view').hidden) {
    if (!$('#work-menu-panel')?.hidden || !$('#management-menu-panel')?.hidden) {
      renderMainMenu();
    }
    if ($('#mgmt-panel-students') && !$('#mgmt-panel-students').hidden) {
      window.__featuresApp?.renderMasterStudentDirectory?.();
    }
    if ($('#mgmt-panel-staff') && !$('#mgmt-panel-staff').hidden) {
      window.__featuresApp?.renderStaffManagement?.();
    }
    if ($('#mgmt-panel-templates') && !$('#mgmt-panel-templates').hidden) {
      window.__featuresApp?.renderRoomTemplatesList?.();
    }
    if ($('#tutoring-menu-panel') && !$('#tutoring-menu-panel').hidden) {
      window.__featuresApp?.renderTutoringModule?.();
    }
    if ($('#portal-menu-panel') && !$('#portal-menu-panel').hidden) {
      window.__featuresApp?.renderTAPortal?.();
    }
  }
}

const realtimeController = initRealtimeSync((changedKeys, source) => {
  refreshUIOnRealtimeUpdate(changedKeys, source);
});

realtimeController.onStatusChange(({ state, lastSyncTime }) => {
  const badge = $('#realtime-sync-badge');
  if (!badge) return;
  const timeStr = new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const modeLabel = state === 'realtime-server'
    ? '● Đồng bộ LAN Real-time'
    : state === 'realtime-cloud'
      ? '● Đồng bộ Cloud Real-time'
      : '● Đồng bộ Real-time';
  badge.innerHTML = `<span class="rt-dot"></span><span>${modeLabel} · ${timeStr}</span>`;
  badge.classList.add('rt-pulse');
  clearTimeout(badge._pulseTimer);
  badge._pulseTimer = setTimeout(() => badge.classList.remove('rt-pulse'), 600);
});

document.addEventListener('click', (e) => {
  const rtBadge = e.target.closest('#realtime-sync-badge');
  if (rtBadge) {
    forceSyncNow('manual-click');
    toast('✓ Đã đồng bộ dữ liệu thời gian thực.');
    return;
  }

  // Global resilient delegation for main menu & sidebar tabs
  if (e.target.closest('#work-menu-nav') || e.target.closest('#work-menu-tab')) {
    setMainMenuPanel('work');
    return;
  }
  if (e.target.closest('#tutoring-menu-nav') || e.target.closest('#tutoring-menu-tab-btn')) {
    setMainMenuPanel('tutoring');
    return;
  }
  if (e.target.closest('#management-menu-nav') || e.target.closest('#management-menu-tab')) {
    setMainMenuPanel('management');
    return;
  }
  if (e.target.closest('#portal-menu-nav') || e.target.closest('#portal-menu-tab-btn')) {
    setMainMenuPanel('portal');
    return;
  }
  if (e.target.closest('#staff-menu-nav')) {
    setMainMenuPanel('management');
    $('#mgmt-tab-staff')?.click();
    return;
  }

  // Class workspace subtabs delegation
  if (e.target.closest('#chat-view-tab') || e.target.closest('#class-chat-nav')) {
    setClassView('chat');
    updateSubtabUrl('chatlog');
    return;
  }
  if (e.target.closest('#seating-view-tab') || e.target.closest('#class-room-nav')) {
    setClassView('seating');
    updateSubtabUrl('map');
    return;
  }
  if (e.target.closest('#scores-view-tab') || e.target.closest('#scores-sidebar-tab')) {
    setClassView('scores');
    updateSubtabUrl('scores');
    return;
  }
  if (e.target.closest('#checklist-view-tab') || e.target.closest('#checklist-sidebar-tab')) {
    setClassView('checklist');
    updateSubtabUrl('checklist');
    return;
  }
  if (e.target.closest('#students-view-tab') || e.target.closest('#students-tab')) {
    setClassView('students');
    updateSubtabUrl('students');
    return;
  }
});

if (!features?.checkAuthStatus || features.checkAuthStatus()) {
  handleRoute();
}


// ============================================================================
// v1.2 FEATURES:
// 1. Seating Map Quick Search (#seating-map-search-input & dropdown)
// 2. Find Seat Button ([data-find-seat-student]) from Student Lists to Map
// 3. Manual Score Entry Dialog (#manual-score-dialog) with Search & Enter nav
// 4. Universal Clear "×" Button on All Search Inputs
// ============================================================================

function renderSeatingMapSearchResults() {
  const input = $('#seating-map-search-input');
  const dropdown = $('#seating-map-search-results');
  if (!input || !dropdown) return;
  const rawQuery = input.value.trim();
  render(); // Re-render map so .seat-search-match highlights update
  if (!rawQuery) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    return;
  }

  const placements = new Map(allEntries().filter(({ entry }) => entry.studentId).map(place => [place.entry.studentId, place]));
  const lateSet = new Set(lateQueue);
  const pool = [...classStudents(), ...makeupStudents.filter(m => isMakeupInCurrentSession(m, placements, lateSet))];
  const matches = searchStudents(pool, rawQuery).slice(0, 10);

  if (!matches.length) {
    dropdown.innerHTML = '<div style="padding:8px 10px; font-size:14px; color:#7b8c7e; font-style:italic;">Không tìm thấy học sinh phù hợp trong lớp.</div>';
    dropdown.hidden = false;
    return;
  }

  dropdown.innerHTML = matches.map(s => {
    const place = placements.get(s.id);
    const deskSpot = place && desks().find(item => item.desk.id === place.deskId);
    const inLate = lateSet.has(s.id);
    const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(CURRENT_CLASS_ID);
    const seatLabel = deskSpot
      ? `Dãy ${deskSpot.ci + 1} · Bàn ${deskSpot.di + 1} (Vị trí ${place.index + 1})`
      : inLate
        ? 'Đang ở khu vực Đi muộn'
        : 'Chưa xếp vào bàn';
    const seatColor = deskSpot ? '#15803d' : inLate ? '#b45309' : '#6b7280';

    return `<button type="button" class="seating-search-result-item" data-locate-seat-student="${escapeHtml(s.id)}">
      <div>
        <strong style="color:${isMakeup ? '#581c87' : '#1e3a29'};">${escapeHtml(s.name)}</strong>
        ${isMakeup ? '<span class="makeup-school-tag">Học bù</span>' : ''}
        <small style="display:block; color:#6c7d70; font-size:13.5px;">${escapeHtml(s.studentCode || s.school || s.sourceClassName || '')}</small>
      </div>
      <span class="room-chip" style="font-size:15.5px; font-weight:700; color:${seatColor};">${escapeHtml(seatLabel)}</span>
    </button>`;
  }).join('');
  dropdown.hidden = false;

  dropdown.querySelectorAll('[data-locate-seat-student]').forEach(btn => {
    btn.onclick = () => {
      const stuId = btn.dataset.locateSeatStudent;
      dropdown.hidden = true;
      highlightStudentSeat(stuId);
    };
  });
}

const seatingMapSearchInput = $('#seating-map-search-input');
if (seatingMapSearchInput) {
  seatingMapSearchInput.addEventListener('input', renderSeatingMapSearchResults);
  seatingMapSearchInput.addEventListener('focus', () => {
    if (seatingMapSearchInput.value.trim()) renderSeatingMapSearchResults();
  });
  seatingMapSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstBtn = $('#seating-map-search-results')?.querySelector('[data-locate-seat-student]');
      if (firstBtn) firstBtn.click();
    }
  });
}

document.addEventListener('click', (e) => {
  const wrap = $('#seating-map-search-wrap');
  const dropdown = $('#seating-map-search-results');
  if (wrap && dropdown && !wrap.contains(e.target)) {
    dropdown.hidden = true;
  }

  // Find seat button from any student list (#students-view, #general-roster-table, #students-dialog)
  const findSeatBtn = e.target.closest('[data-find-seat-student]');
  if (findSeatBtn) {
    e.preventDefault();
    e.stopPropagation();
    const stuId = findSeatBtn.dataset.findSeatStudent;
    const targetClassId = findSeatBtn.dataset.findSeatClass || CURRENT_CLASS_ID;
    $('#students-dialog')?.close();
    if ($('#class-general-view') && !$('#class-general-view').hidden) {
      enterClass(targetClassId, checklistDate || new Date().toLocaleDateString('sv-SE'), false, 'seating');
    } else {
      setClassView('seating');
      updateSubtabUrl('map');
    }
    setTimeout(() => {
      highlightStudentSeat(stuId);
    }, 120);
    return;
  }
});

// ============================================================================
// v1.3: TAB NHẬP ĐIỂM (#scores-view) & HỘP THOẠI XEM KỸ ĐIỂM HỌC SINH (#student-score-history-dialog)
// ============================================================================

// formatScoreVN is defined at top of module

function formatShortDayMonth(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${Number(parts[2])}/${Number(parts[1])}`;
  }
  return dateStr;
}

/**
 * Trả về danh sách lịch sử điểm chi tiết của học sinh trong lớp:
 * Mỗi phần tử gồm: { scoreDisplay, statusDisplay, lessonDisplay, date, kind }
 * Với điểm BTVN: luôn ghi theo ngày và tên bài học của buổi thu & chấm bài.
 */
function getStudentScoreHistoryEntries(student, classId = CURRENT_CLASS_ID, includeAllDates = false) {
  if (!student) return [];
  const allHistSessions = window.__featuresApp?.loadSessionHistory
    ? window.__featuresApp.loadSessionHistory()
    : (typeof sessionHistoryRepo.loadSessionHistory === 'function' ? sessionHistoryRepo.loadSessionHistory() : []);
  const classSessions = allHistSessions.filter(s => s.classId === classId);

  // Collect all dates for this class from session history, student sessionNotes, attendanceHistory, and scores
  const dateSet = new Set();
  const shouldIncludeDate = (d) => Boolean(d && (includeAllDates || d !== checklistDate || classSessions.some(cs => cs.date === d && cs.status === 'closed')));
  classSessions.forEach(cs => {
    if (shouldIncludeDate(cs.date)) dateSet.add(cs.date);
  });
  (student.sessionNotes || []).forEach(sn => {
    if ((sn.classId === classId || !sn.classId) && shouldIncludeDate(sn.date)) dateSet.add(sn.date);
  });
  (student.attendanceHistory || []).forEach(ah => {
    if ((ah.classId === classId || !ah.classId) && shouldIncludeDate(ah.date)) dateSet.add(ah.date);
  });
  (student.scores || []).forEach(sc => {
    if ((sc.classId === classId || !sc.classId) && shouldIncludeDate(sc.date)) dateSet.add(sc.date);
  });

  const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  const entries = [];

  for (const date of sortedDates) {
    const shortDM = formatShortDayMonth(date);
    const sess = classSessions.find(cs => cs.date === date);
    const snap = sess?.studentsSnapshot?.find(s => s.studentId === student.id);
    const sn = (student.sessionNotes || []).find(n => (n.classId === classId || !n.classId) && n.date === date);
    const att = (student.attendanceHistory || []).find(h => (h.classId === classId || !h.classId) && h.date === date);
    const dayScores = (student.scores || []).filter(sc => (sc.classId === classId || !sc.classId) && sc.date === date);

    const testScoreObj = dayScores.find(sc => sc.type && sc.type.toLowerCase() !== 'btvn');
    const btvnScoreObj = dayScores.find(sc => !sc.type || sc.type.toLowerCase() === 'btvn');

    const lessonTitle = sn?.lessonTitle
      || sess?.lessonTitle
      || testScoreObj?.lessonTitle
      || btvnScoreObj?.lessonTitle
      || `Buổi học ${shortDM}`;

    const attStatus = snap?.attendance?.status || att?.status || 'present';
    const isAbsent = attStatus === 'absent' || attStatus === 'absent_excused' || attStatus === 'absent_unexcused';
    const noteText = (sn?.note ?? snap?.note ?? '').trim();

    // 1. Nếu buổi đó có bài Test -> thêm dòng Test trước (cùng ngày)
    const testVal = sn?.testScore ?? snap?.testScore ?? testScoreObj?.score;
    if (testVal !== undefined) {
      let testStatusText = sn?.attendanceStatusOverride || '';
      if (!testStatusText) {
        const baseAtt = isAbsent ? 'Vắng' : attStatus === 'late' ? 'Có đi học (Đi muộn)' : 'Có đi học';
        testStatusText = noteText && !sn?.homeworkStatusNote ? `${baseAtt} - ${noteText}` : baseAtt;
      }
      entries.push({
        date,
        kind: 'Test',
        scoreRaw: testVal,
        scoreDisplay: formatScoreVN(testVal, '/'),
        statusDisplay: testStatusText,
        lessonDisplay: `Test ${shortDM}: ${lessonTitle}`
      });
    }

    // 2. Dòng BTVN của buổi thu bài (ghi tên bài học của buổi thu & chấm bài hôm đó)
    const hwVal = sn?.homeworkScore !== undefined
      ? sn.homeworkScore
      : (snap?.homework?.score !== undefined ? snap.homework.score : btvnScoreObj?.score);
    const hwStatus = sn?.homeworkStatus || snap?.homework?.status || (hwVal !== null && hwVal !== undefined ? 'graded' : 'uncollected');

    let btvnStatusText = sn?.homeworkStatusNote || '';
    if (!btvnStatusText) {
      let base = 'Có đi học';
      if (isAbsent) {
        base = 'Vắng';
      } else if (hwStatus === 'not_submitted') {
        base = 'Có đi học (Không làm BTVN)';
      } else if (attStatus === 'late') {
        base = 'Có đi học (Đi muộn)';
      }
      btvnStatusText = noteText ? `${base} - ${noteText}` : base;
    }

    entries.push({
      date,
      kind: 'BTVN',
      scoreRaw: hwVal ?? null,
      scoreDisplay: formatScoreVN(hwVal, '/'),
      statusDisplay: btvnStatusText,
      lessonDisplay: `BTVN ${shortDM}: ${lessonTitle}`
    });
  }

  return entries;
}

function getRecentFourScoresSummary(student, classId = CURRENT_CLASS_ID) {
  const historyEntries = getStudentScoreHistoryEntries(student, classId);
  const recentFour = historyEntries.slice(0, 4).map(e => e.scoreDisplay);
  while (recentFour.length < 4) {
    recentFour.push('/');
  }
  return recentFour.join('; ');
}

function openStudentScoreHistoryDialog(studentId, targetClassId = CURRENT_CLASS_ID, includeAllDates = true) {
  const student = studentById(studentId);
  if (!student) return;
  const dialog = $('#student-score-history-dialog');
  if (!dialog) return;

  const isMakeup = student.studentType === 'makeup' || !(student.classIds || []).includes(targetClassId);
  const schoolOrMakeup = isMakeup
    ? `Học Bù (${student.sourceClassName || student.school || 'T2'})`
    : (student.school || 'Chưa rõ trường');

  const titleEl = $('#score-history-dialog-title');
  if (titleEl) {
    titleEl.textContent = `Điểm của học sinh ${student.name} - ${schoolOrMakeup}`;
  }

  const learningInput = $('#score-history-learning-note');
  if (learningInput) {
    learningInput.value = student.learningNotes || '';
    learningInput.oninput = () => {
      student.learningNotes = learningInput.value;
      saveStudentRecords(students, makeupStudents);
      save();
      // Sync input in scores tab if open
      const rowLearningInput = document.querySelector(`[data-learning-note="${CSS.escape(student.id)}"]`);
      if (rowLearningInput && document.activeElement !== rowLearningInput) {
        rowLearningInput.value = student.learningNotes;
      }
    };
  }

  const entries = getStudentScoreHistoryEntries(student, targetClassId, includeAllDates);
  const tbody = $('#score-history-tbody');
  if (tbody) {
    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:18px; color:#87968a;">Chưa có lịch sử điểm các buổi trước cho học sinh này.</td></tr>';
    } else {
      tbody.innerHTML = entries.map(item => {
        const isMissing = item.scoreDisplay === '/';
        return `<tr>
          <td style="text-align:center;"><span class="score-history-val ${isMissing ? 'missing' : ''}">${escapeHtml(item.scoreDisplay)}</span></td>
          <td><strong>${escapeHtml(item.statusDisplay)}</strong></td>
          <td>${escapeHtml(item.lessonDisplay)}</td>
        </tr>`;
      }).join('');
    }
  }

  dialog.showModal();
}

$('#close-score-history-dialog')?.addEventListener('click', () => $('#student-score-history-dialog')?.close());
$('#close-score-history-btn')?.addEventListener('click', () => $('#student-score-history-dialog')?.close());

function applyStudentManualScore(studentId, field, rawValue) {
  const student = studentById(studentId);
  if (!student) return;
  const cleanVal = String(rawValue ?? '').trim().replace(',', '.');
  const numVal = cleanVal === '' ? null : Math.max(0, Math.min(10, Number(cleanVal)));
  if (cleanVal !== '' && isNaN(numVal)) return;

  const seated = allEntries().find(e => e.entry.studentId === studentId);
  if (field === 'hw') {
    const prevHw = seated?.entry.homework || student.homework || { status: 'uncollected' };
    const basePrevSt = prevHw.status === 'graded' ? 'submitted' : (prevHw.status || 'uncollected');
    const nextStatus = numVal !== null
      ? (basePrevSt === 'not_submitted' ? 'not_submitted' : 'submitted')
      : basePrevSt;
    const nextHw = {
      ...prevHw,
      status: nextStatus,
      score: numVal
    };
    if (seated) {
      seated.entry.homework = nextHw;
      seated.entry.homeworkSaved = true;
    }
    student.homework = nextHw;
    recordStudentScore(student, numVal, 'BTVN');
    recordHistory(student, seated?.entry.attendance || student.attendance || { status: seated ? 'present' : 'unrecorded' }, nextHw);
  } else if (field === 'test') {
    checklist.testScores = checklist.testScores || {};
    if (numVal === null) {
      delete checklist.testScores[studentId];
    } else {
      checklist.testScores[studentId] = numVal;
    }
    if (seated) {
      seated.entry.testScore = numVal;
    }
    student.testScore = numVal;
    recordStudentScore(student, numVal, 'Test');
    saveChecklist();
  }
  save();
  logAdminSessionAction(
    `Nhập điểm ${field === 'test' ? 'bài Test' : 'BTVN'} cho HS ${student.name}`,
    `Điểm ${field === 'test' ? 'Test' : 'BTVN'}: ${numVal !== null ? numVal : 'Xoá điểm'}`,
    'score',
    `score-${field}-${student.id}`
  );
  const statusEl = $('#scores-tab-save-status');
  if (statusEl) {
    statusEl.textContent = `✓ Đã lưu điểm của ${student.name} lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }
}

function saveStudentLearningNote(studentId, value) {
  const student = studentById(studentId);
  if (!student) return;
  student.learningNotes = value;
  saveStudentRecords(students, makeupStudents);
  save();
  logAdminSessionAction(`Cập nhật ghi chú học lực của HS ${student.name}`, value ? `Nội dung: "${value}"` : 'Đã xoá trống', 'student', `learn-note-${student.id}`);
  const statusEl = $('#scores-tab-save-status');
  if (statusEl) {
    statusEl.textContent = `✓ Đã lưu ghi chú học lực của ${student.name}`;
  }
}

function renderScoresView() {
  const tbody = $('#scores-tab-tbody');
  if (!tbody) return;

  // Do not wipe DOM if user is actively typing inside #scores-tab-tbody
  if (document.activeElement && tbody.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
    return;
  }

  const hasTest = Boolean(checklist.testRequired);
  if ($('#scores-tab-test-toggle')) $('#scores-tab-test-toggle').checked = hasTest;
  const testTh = $('#scores-tab-test-th');
  if (testTh) testTh.hidden = !hasTest;

  const query = ($('#scores-tab-search')?.value || '').trim();
  const filter = $('#scores-tab-filter')?.value || 'all';

  const placements = new Map(allEntries().filter(({ entry }) => entry.studentId).map(place => [place.entry.studentId, place]));
  const lateSet = new Set(lateQueue);

  const byGivenName = (a, b) => {
    const aParts = splitStudentName(a.name);
    const bParts = splitStudentName(b.name);
    return (a.givenName || aParts.givenName).localeCompare(b.givenName || bParts.givenName, 'vi')
      || (a.familyName || aParts.familyName).localeCompare(b.familyName || bParts.familyName, 'vi');
  };

  const regularList = [...classStudents()];
  const makeupList = makeupStudents.filter(m => isMakeupInCurrentSession(m, placements, lateSet));
  const combinedStudents = [...regularList, ...makeupList];

  const buildScoreRowItem = (s) => {
    const place = placements.get(s.id);
    const inLate = lateSet.has(s.id);
    const attHist = (s.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
    const sessNote = (s.sessionNotes || []).find(n => n.classId === CURRENT_CLASS_ID && n.date === checklistDate);

    const rawAtt = place?.entry.attendance
      || (inLate ? (s.attendance || (attHist ? { status: attHist.status, arrivalTime: attHist.time || attHist.arrivalTime, lateMinutes: attHist.lateMinutes ?? attHist.minutesLate } : { status: 'late' })) : null)
      || (attHist ? { status: attHist.status, reason: attHist.reason, arrivalTime: attHist.time || attHist.arrivalTime, lateMinutes: attHist.lateMinutes ?? attHist.minutesLate } : null);
    const lateScoreCheck = rawAtt ? resolveLateDetails(s, place?.entry || { attendance: rawAtt }) : null;
    const attendance = (rawAtt && (rawAtt.status === 'late' || inLate))
      ? (lateScoreCheck?.isLate
          ? { ...rawAtt, status: 'late', ...lateScoreCheck }
          : { ...rawAtt, status: 'present', arrivalTime: lateScoreCheck?.arrivalTime || rawAtt.arrivalTime || null, lateMinutes: 0, minutesLate: 0 })
      : rawAtt;

    const hw = place?.entry.homework
      || (inLate && s.homework ? s.homework : null)
      || (sessNote?.homeworkStatus ? { status: sessNote.homeworkStatus, score: sessNote.homeworkScore ?? null, reason: sessNote.homeworkReason || '' } : null)
      || { status: 'uncollected', score: null };

    const attStatus = attendance?.status || 'unrecorded';
    const hwStatus = hw?.status || 'uncollected';
    const isAttended = Boolean(place || inLate || attStatus === 'present' || attStatus === 'late');
    const isHwCollected = hwStatus === 'submitted' || hwStatus === 'graded';

    // Priority Group:
    // 1: Đã điểm danh + Đã thu BTVN
    // 2: Đã điểm danh - Chưa thu / Không nộp BTVN
    // 3: Chưa được điểm danh / Vắng mặt
    const priorityGroup = isAttended ? (isHwCollected ? 1 : 2) : 3;

    const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(CURRENT_CLASS_ID);
    const schoolDisplay = isMakeup
      ? `Học Bù (${s.sourceClassName || s.school || 'T2'})`
      : (s.school || '—');

    const hwScore = hw?.score ?? null;
    const testScore = place?.entry.testScore ?? checklist.testScores?.[s.id] ?? s.testScore ?? null;
    const parts = splitStudentName(s.name);
    const recentFour = getRecentFourScoresSummary(s, CURRENT_CLASS_ID);

    return {
      student: s,
      familyName: s.familyName ?? parts.familyName,
      givenName: s.givenName ?? parts.givenName,
      schoolDisplay,
      isMakeup,
      attStatus,
      attendance,
      hwStatus,
      hw,
      hwScore,
      testScore,
      priorityGroup,
      recentFour,
      note: sessionNoteFor(s.id) || '',
      learningNotes: s.learningNotes || ''
    };
  };

  let items = combinedStudents.map(buildScoreRowItem);

  if (query) {
    const matchedIds = new Set(searchStudents(items.map(r => r.student), query).map(s => s.id));
    items = items.filter(r => matchedIds.has(r.student.id));
  }
  if (filter === 'group1') items = items.filter(r => r.priorityGroup === 1);
  if (filter === 'group2') items = items.filter(r => r.priorityGroup === 2);
  if (filter === 'group3') items = items.filter(r => r.priorityGroup === 3);
  if (filter === 'makeup') items = items.filter(r => r.isMakeup);

  // Sort strictly by priorityGroup (1 -> 2 -> 3), then alphabetically by Vietnamese givenName
  items.sort((a, b) => {
    if (a.priorityGroup !== b.priorityGroup) return a.priorityGroup - b.priorityGroup;
    return byGivenName(a.student, b.student);
  });

  const getScoresTableColumnOrder = () => {
    const defaultCols = ['family', 'name', 'school', 'status', 'recentScores', 'hwScore', 'testScore', 'note', 'learningNote'];
    try {
      const saved = JSON.parse(localStorage.getItem('lopvui.column-order.scores.v1') || 'null');
      if (Array.isArray(saved) && saved.length) {
        const valid = saved.filter(k => defaultCols.includes(k));
        defaultCols.forEach(k => { if (!valid.includes(k)) valid.push(k); });
        return valid.filter(k => hasTest || k !== 'testScore');
      }
    } catch {}
    return defaultCols.filter(k => hasTest || k !== 'testScore');
  };

  const activeScoreCols = getScoresTableColumnOrder();
  const scoreThMap = {
    family: '<th>Họ đệm</th>',
    name: '<th>Tên</th>',
    school: '<th>Trường</th>',
    status: '<th>Trạng thái</th>',
    recentScores: '<th style="text-align:center;">Điểm 4 bài gần nhất <small style="display:block; font-weight:500; font-size:12.5px; color:#5b21b6;">(Click xem chi tiết)</small></th>',
    hwScore: '<th style="width:95px; text-align:center;">Điểm BTVN</th>',
    testScore: '<th id="scores-tab-test-th" style="width:95px; text-align:center;">Điểm Test</th>',
    note: '<th style="min-width:150px;">Ghi chú buổi học</th>',
    learningNote: '<th style="min-width:170px;">Ghi chú chung của học sinh (Ghi chú học lực)</th>'
  };
  const scoresThead = $('#scores-tab-table thead');
  if (scoresThead) {
    scoresThead.innerHTML = `<tr>${activeScoreCols.map(k => scoreThMap[k] || '').join('')}</tr>`;
  }

  const colCount = activeScoreCols.length;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding:18px; color:#87968a;">Không có học sinh nào phù hợp với bộ lọc.</td></tr>`;
    return;
  }

  const groupLabels = {
    1: '✓ Nhóm 1: Đã điểm danh & Đã thu BTVN',
    2: '! Nhóm 2: Đã điểm danh · Chưa thu / Không nộp BTVN',
    3: '○ Nhóm 3: Chưa điểm danh / Vắng mặt'
  };

  let lastGroup = null;
  const htmlRows = [];

  for (const item of items) {
    if (item.priorityGroup !== lastGroup) {
      lastGroup = item.priorityGroup;
      const groupCount = items.filter(x => x.priorityGroup === lastGroup).length;
      htmlRows.push(`
        <tr class="scores-group-divider-row group-${lastGroup}">
          <td colspan="${colCount}"><div class="scores-group-sticky-label">${groupLabels[lastGroup]} (${groupCount} HS)</div></td>
        </tr>
      `);
    }

    const s = item.student;
    const lateDetScore = item.attStatus === 'late' ? resolveLateDetails(s, { attendance: item.attendance }) : null;
    const attText = item.attStatus === 'present'
      ? '<span class="student-state state-present">✓ Có mặt</span>'
      : item.attStatus === 'late'
        ? `<span class="student-state state-late">Đi muộn ${lateDetScore.lateMinutes}p (${escapeHtml(lateDetScore.arrivalTime)})</span>`
        : (item.attStatus === 'absent' || item.attStatus === 'absent_excused' || item.attStatus === 'absent_unexcused')
          ? `<span class="student-state state-missing">× ${item.attStatus === 'absent_excused' ? 'Vắng có phép' : 'Vắng mặt'}</span>`
          : '<span class="student-state state-pending">Chưa điểm danh</span>';

    const hwText = item.hwStatus === 'graded' || item.hwStatus === 'submitted'
      ? '<span class="student-state state-collected">Đã thu BTVN</span>'
      : item.hwStatus === 'not_submitted'
        ? `<span class="student-state state-missing">Không nộp BTVN${item.hw?.reason ? ` (${escapeHtml(item.hw.reason)})` : ''}</span>`
        : '<span class="student-state state-pending">Chưa thu BTVN</span>';

    const scoreTdMap = {
      family: `
        <td>
          <button type="button" data-open-student-profile="${escapeHtml(s.id)}" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font:inherit; color:${item.isMakeup ? '#6d28d9' : '#395140'}; font-weight:${item.isMakeup ? '700' : '600'};" title="Bấm mở Hồ sơ học sinh trong buổi học">
            ${escapeHtml(item.familyName || '—')}
          </button>
        </td>`,
      name: `
        <td>
          <button type="button" data-open-student-profile="${escapeHtml(s.id)}" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font:inherit;" title="Bấm mở Hồ sơ học sinh trong buổi học">
            <strong style="color:${item.isMakeup ? '#6d28d9' : '#214e2d'}; text-decoration:underline; text-underline-offset:2px;">${escapeHtml(item.givenName || s.name)}</strong>
            ${renderInlineTags(s)}
          </button>
        </td>`,
      school: `
        <td>
          ${item.isMakeup
            ? `<span class="makeup-school-tag">${escapeHtml(item.schoolDisplay)}</span>`
            : escapeHtml(item.schoolDisplay)}
        </td>`,
      status: `
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            ${attText}
            ${item.priorityGroup !== 3 ? hwText : ''}
          </div>
        </td>`,
      recentScores: `
        <td style="text-align:center;">
          <button type="button" class="recent-scores-btn" data-open-score-history="${escapeHtml(s.id)}" title="Click để xem chi tiết điểm các buổi trước của ${escapeHtml(s.name)}"><span>${escapeHtml(item.recentFour)}</span></button>
        </td>`,
      hwScore: `
        <td style="text-align:center;">
          <input type="text" inputmode="decimal" class="manual-score-input" data-score-tab-hw="${escapeHtml(s.id)}" value="${item.hwScore !== null && item.hwScore !== undefined ? escapeHtml(formatScoreVN(item.hwScore)) : ''}" placeholder="VD: 7,5" aria-label="Điểm BTVN ${escapeHtml(s.name)}" />
        </td>`,
      testScore: `
        <td style="text-align:center;">
          <input type="text" inputmode="decimal" class="manual-score-input" data-score-tab-test="${escapeHtml(s.id)}" value="${item.testScore !== null && item.testScore !== undefined ? escapeHtml(formatScoreVN(item.testScore)) : ''}" placeholder="VD: 8,5" aria-label="Điểm Test ${escapeHtml(s.name)}" />
        </td>`,
      note: `
        <td>
          <input type="text" class="attendance-note-input" data-session-note="${escapeHtml(s.id)}" value="${escapeHtml(item.note)}" placeholder="Ghi chú buổi học..." style="width:100%;" />
        </td>`,
      learningNote: `
        <td>
          <input type="text" class="attendance-note-input" data-learning-note="${escapeHtml(s.id)}" value="${escapeHtml(item.learningNotes)}" placeholder="Ghi chú học lực chung..." style="width:100%;" />
        </td>`
    };

    htmlRows.push(`
      <tr class="${item.isMakeup ? 'makeup-row-tr' : ''}" data-score-row-student="${escapeHtml(s.id)}">
        ${activeScoreCols.map(k => scoreTdMap[k] || '').join('')}
      </tr>
    `);
  }

  tbody.innerHTML = htmlRows.join('');

  // Wire click on recent-scores-btn to open detailed score history modal
  tbody.querySelectorAll('[data-open-score-history]').forEach(btn => {
    btn.onclick = () => openStudentScoreHistoryDialog(btn.dataset.openScoreHistory);
  });

  // Wire score inputs & Enter/Arrow navigation
  const wireInputs = (selector, field) => {
    const inputs = [...tbody.querySelectorAll(selector)];
    inputs.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        const stuId = inp.dataset[field === 'hw' ? 'scoreTabHw' : 'scoreTabTest'];
        applyStudentManualScore(stuId, field, inp.value);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = inputs[idx + 1];
          if (next) { next.focus(); next.select?.(); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = inputs[idx - 1];
          if (prev) { prev.focus(); prev.select?.(); }
        }
      });
    });
  };
  wireInputs('[data-score-tab-hw]', 'hw');
  if (hasTest) wireInputs('[data-score-tab-test]', 'test');

  // Wire learning notes input
  tbody.querySelectorAll('[data-learning-note]').forEach(inp => {
    inp.addEventListener('input', () => {
      saveStudentLearningNote(inp.dataset.learningNote, inp.value);
    });
  });
}

$('#scores-tab-search')?.addEventListener('input', renderScoresView);
$('#scores-tab-filter')?.addEventListener('change', renderScoresView);

// Universal Clear "×" Button on All Search Inputs
function initSearchClearButtons() {
  const selectors = [
    '#seating-map-search-input',
    '#student-list-search',
    '#scores-tab-search',
    '#student-search',
    '#late-search',
    '#master-student-search',
    '#tutoring-search',
    '#tutoring-student-search-input',
    '#staff-search-input',
    '#config-teacher-search',
    '#config-assistant-search',
    '#config-office-search',
    '#sched-makeup-assistant-search',
    '#sched-next-assistant-search'
  ];
  selectors.forEach(sel => {
    const input = document.querySelector(sel);
    if (!input || input.dataset.clearBtnEnhanced === '1') return;
    input.dataset.clearBtnEnhanced = '1';
    const parent = input.parentElement;
    if (!parent) return;

    // Wrap the input itself inside .search-input-box so vertical 50% centering is always relative to the input height, not a wrapping <label>
    let box = parent;
    if (!parent.classList.contains('search-input-box')) {
      box = document.createElement('div');
      box.className = 'search-input-box search-clear-wrap';
      parent.insertBefore(box, input);
      box.appendChild(input);
    } else {
      box.classList.add('search-clear-wrap');
    }

    input.style.paddingRight = '34px';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'search-clear-x-btn';
    clearBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    clearBtn.title = 'Xóa nội dung tìm kiếm';
    clearBtn.setAttribute('aria-label', 'Xóa nội dung tìm kiếm');
    clearBtn.hidden = !input.value;
    box.appendChild(clearBtn);

    const syncVisibility = () => {
      clearBtn.hidden = !input.value;
    };
    input.addEventListener('input', syncVisibility);
    input.addEventListener('change', syncVisibility);
    input.addEventListener('focus', syncVisibility);

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      clearBtn.hidden = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
    });
  });
}
initSearchClearButtons();


// Universal Backdrop Click-to-Close for all <dialog> elements (safe against layout shifts inside dialog)
document.querySelectorAll('dialog').forEach(dlg => {
  let pointerDownOnBackdrop = false;
  dlg.addEventListener('pointerdown', (e) => {
    if (e.target !== dlg) {
      pointerDownOnBackdrop = false;
      return;
    }
    const inner = dlg.querySelector('.dialog-form, form');
    if (inner) {
      const r = inner.getBoundingClientRect();
      pointerDownOnBackdrop = !(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    } else {
      const r = dlg.getBoundingClientRect();
      pointerDownOnBackdrop = !(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    }
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && pointerDownOnBackdrop && e.detail > 0) {
      dlg.close();
    }
    pointerDownOnBackdrop = false;
  });
  dlg.addEventListener('close', () => {
    if (_rtPendingUIRefreshAfterDialog) {
      _rtPendingUIRefreshAfterDialog = false;
      refreshUIOnRealtimeUpdate(['*'], 'dialog-closed');
    } else {
      refreshAllActiveViews();
    }
  });
});

// Universal tactile button feedback on press
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('button, .student-option, .homework-choice button');
  if (!btn || btn.disabled) return;
  btn.classList.add('btn-active-press');
  const clearPress = () => btn.classList.remove('btn-active-press');
  btn.addEventListener('pointerup', clearPress, { once: true });
  btn.addEventListener('pointercancel', clearPress, { once: true });
  btn.addEventListener('pointerleave', clearPress, { once: true });
}, { passive: true });


// v2.1: Tap-to-assign ("Chạm để xếp chỗ") on Seating Map & Managed Class Card '⋯' More Menu
let tapAssignSource = null;

function setTapAssignSource(source = null) {
  tapAssignSource = source;
  document.querySelectorAll('.pool-token, .late-token').forEach(el => el.classList.remove('tap-assign-active'));
  document.querySelectorAll('.desk[data-desk-id]').forEach(el => el.classList.toggle('desk-tap-target', Boolean(source)));
  const poolCountEl = $('#pool-count');
  if (poolCountEl) {
    if (source?.type === 'late') {
      const stu = studentById(source.studentId);
      poolCountEl.innerHTML = `<strong style="color:#4f46e5;">Đang chọn xếp chỗ cho ${escapeHtml(stu?.name || 'học sinh')} — Chạm vào bàn bất kỳ bên dưới để đặt vào bàn</strong>`;
    } else if (source?.type === 'pool') {
      poolCountEl.innerHTML = `<strong style="color:#4f46e5;">Đang chọn thêm học sinh — Chạm vào bàn bất kỳ bên dưới để xếp chỗ & chọn tên</strong>`;
    } else {
      poolCountEl.textContent = 'Chạm vào nút + trên bàn để chọn học sinh, hoặc chạm vào đây rồi chạm vào bàn bất kỳ';
    }
  }
}

document.addEventListener('click', (e) => {
  // 0. Open Session-level Student Profile (Kiểu 3) when clicking student name in #students-view or #scores-view
  const openSessProfBtn = e.target.closest('[data-open-student-profile]');
  if (openSessProfBtn) {
    e.preventDefault();
    e.stopPropagation();
    openStudentSessionProfile(openSessProfBtn.dataset.openStudentProfile, CURRENT_CLASS_ID, checklistDate);
    return;
  }

  // 1. Handle Managed Class Card '⋯' More Options menu
  const moreToggle = e.target.closest('[data-toggle-card-more]');
  if (moreToggle) {
    e.preventDefault();
    e.stopPropagation();
    const wrap = moreToggle.closest('.card-more-menu-wrap');
    const menu = wrap?.querySelector('.card-more-dropdown');
    const wasHidden = menu ? menu.hidden : true;
    document.querySelectorAll('.card-more-dropdown').forEach(m => { m.hidden = true; });
    if (menu) menu.hidden = !wasHidden;
    return;
  }
  if (!e.target.closest('.card-more-menu-wrap')) {
    document.querySelectorAll('.card-more-dropdown').forEach(m => { m.hidden = true; });
  } else if (e.target.closest('.card-more-item')) {
    document.querySelectorAll('.card-more-dropdown').forEach(m => { m.hidden = true; });
  }

  // 2. Tap-to-assign: Tapping a late student token toggles selection for tap-to-assign
  const lateToken = e.target.closest('[data-late-key]');
  if (lateToken && !suppressClick) {
    const stuId = lateToken.dataset.lateKey;
    if (tapAssignSource?.type === 'late' && tapAssignSource.studentId === stuId) {
      setTapAssignSource(null);
    } else {
      setTapAssignSource({ type: 'late', studentId: stuId });
      lateToken.classList.add('tap-assign-active');
      toast('Hãy chạm vào bàn bất kỳ trên sơ đồ để xếp chỗ cho học sinh.');
    }
    return;
  }

  // 3. Tap-to-assign: If tapAssignSource is active and user taps a desk, assign immediately!
  const tappedDesk = e.target.closest('.desk[data-desk-id]');
  if (tappedDesk && tapAssignSource && !e.target.closest('[data-entry-index]')) {
    e.preventDefault();
    e.stopPropagation();
    const deskId = tappedDesk.dataset.deskId;
    const list = deskItems[deskId] || (deskItems[deskId] = []);
    if (tapAssignSource.type === 'late') {
      const person = studentById(tapAssignSource.studentId);
      if (person) {
        const lateDet = resolveLateDetails(person, null);
        const isLate = Boolean(lateDet.isLate && lateDet.lateMinutes > 0 && person.attendance?.status !== 'present');
        const attObj = isLate ? {
          ...(person.attendance || {}),
          status: 'late',
          arrivalTime: lateDet.arrivalTime,
          lateMinutes: lateDet.lateMinutes,
          minutesLate: lateDet.lateMinutes
        } : {
          ...(person.attendance || {}),
          status: 'present',
          arrivalTime: lateDet.arrivalTime || person.arrivalTime || null,
          lateMinutes: 0,
          minutesLate: 0
        };
        person.attendance = attObj;
        person.arrivalTime = attObj.arrivalTime;
        person.lateMinutes = attObj.lateMinutes;
        const entry = {
          studentId: person.id,
          homework: person.homework || { status: 'uncollected' },
          attendance: attObj,
          _updatedAt: Date.now()
        };
        insertIntoDesk(entry, deskId, list.length, { type: 'late', studentId: person.id });
        toast(isLate ? `✓ Đã xếp ${person.name} (Muộn ${lateDet.lateMinutes}p) vào bàn.` : `✓ Đã xếp ${person.name} vào bàn.`);
      }
      setTapAssignSource(null);
    } else if (tapAssignSource.type === 'pool') {
      setTapAssignSource(null);
      addAnonymousToDesk(deskId, list.length, true);
    }
    return;
  }
});


function initVietnameseDateInputs() {
  const dateSelectors = [
    '#sched-makeup-date',
    '#sched-next-date',
    '#session-change-date',
    '#session-makeup-date',
    '#tutoring-date'
  ];
  const formatDateVN = (isoStr) => {
    const m = String(isoStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return isoStr || 'Chọn ngày...';
    return `${m[3]}/${m[2]}/${m[1]}`;
  };
  dateSelectors.forEach(sel => {
    const input = document.querySelector(sel);
    if (!input || input.dataset.vnDateEnhanced === '1') return;
    input.dataset.vnDateEnhanced = '1';
    const parent = input.parentElement;
    if (!parent) return;

    const wrap = document.createElement('div');
    wrap.className = 'vn-date-field-wrap';
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);

    const display = document.createElement('span');
    display.className = 'vn-date-display-text';
    display.textContent = formatDateVN(input.value);
    wrap.appendChild(display);

    const syncDateText = () => {
      display.textContent = formatDateVN(input.value);
    };
    input.addEventListener('input', syncDateText);
    input.addEventListener('change', syncDateText);
    input.addEventListener('focus', syncDateText);
    input.addEventListener('blur', syncDateText);

    // Observe programmatic .value changes when dialogs open
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc && desc.get && desc.set) {
      Object.defineProperty(input, 'value', {
        get() { return desc.get.call(this); },
        set(v) {
          desc.set.call(this, v);
          display.textContent = formatDateVN(v);
        },
        configurable: true
      });
    }
  });
}
initVietnameseDateInputs();

// ============================================================================
// v2.5: SEATING CHART SNAPSHOT & PNG IMAGE EXPORT
// ============================================================================

function getSeatingSnapshotData() {
  const isNoHwActive = Boolean(window.__featuresApp?.isNoHomeworkSession?.());
  const displayLayout = isTeacherView
    ? [...layout].reverse().map(a => ({ ...a, desks: [...a.desks].reverse() }))
    : layout;
  const occupants = allEntries();
  const named = occupants.filter(x => x.entry.studentId && studentById(x.entry.studentId));
  const rosterList = classStudents();
  const rosterIds = new Set(rosterList.map(s => s.id));
  const rosterTotal = rosterList.length;
  const extraMakeupIds = new Set([
    ...named.map(x => x.entry.studentId).filter(id => id && !rosterIds.has(id)),
    ...lateQueue.filter(id => id && !rosterIds.has(id))
  ]);
  const makeupCount = extraMakeupIds.size;
  const totalExpected = occupants.length;

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let hwDoneCount = 0;
  let hwMissingCount = 0;

  named.forEach(({ entry }) => {
    const stu = studentById(entry.studentId);
    const att = entry.attendance || stu?.attendance;
    const hw = entry.homework || stu?.homework;
    if (att?.status === 'present') presentCount++;
    else if (att?.status === 'late') lateCount++;
    else if (att?.status && att.status.startsWith('absent')) absentCount++;

    if (!isNoHwActive) {
      if (hw?.status === 'submitted' || hw?.status === 'graded' || (hw?.score !== null && hw?.score !== undefined && hw?.score !== '')) hwDoneCount++;
      else if (hw?.status === 'not_submitted') hwMissingCount++;
    }
  });

  const lateQueueStudents = lateQueue.map(id => studentById(id)).filter(Boolean);
  lateQueueStudents.forEach(s => {
    if (isStudentLateInSession(s, null)) lateCount++;
    else presentCount++;
  });

  return {
    isNoHwActive,
    displayLayout,
    rosterTotal,
    makeupCount,
    totalExpected,
    attendedCount: presentCount + lateCount,
    presentCount,
    lateCount,
    absentCount,
    hwDoneCount,
    hwMissingCount,
    lateQueueStudents
  };
}

function buildSeatingSnapshotHtml() {
  const data = getSeatingSnapshotData();
  const clsName = configClass?.name || 'Lớp học';
  const clsCode = configClass?.code || CURRENT_CLASS_ID;
  const clsRoom = configClass?.room || 'Phòng tiêu chuẩn';
  const clsGrade = formatBirthYearInline(configClass?.grade || '');
  const teacherName = configClass?.teacherName || '—';
  const assistantName = configClass?.assistantName || '—';
  const timeRange = (configClass?.startTime && configClass?.endTime)
    ? `${configClass.startTime}–${configClass.endTime}`
    : (configClass?.time || '');
  const dateParts = String(checklistDate || '').split('-');
  const vnDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : checklistDate;
  const lessonTitle = checklist?.lessonTitle ? String(checklist.lessonTitle).trim() : '';

  const boardBarHtml = `<div class="snapshot-board-bar">${isTeacherView ? 'BẢNG · ĐẦU LỚP (Góc nhìn Giáo viên từ bục giảng)' : 'BẢNG · ĐẦU LỚP'}</div>`;
  const backBarHtml = `<div class="snapshot-back-bar">CUỐI LỚP</div>`;

  const aislesHtml = data.displayLayout.map((aisle, ci) => {
    const origAisleIdx = isTeacherView ? (layout.length - 1 - ci) : ci;
    const sideLabel = isTeacherView ? (ci < data.displayLayout.length / 2 ? ' (Tay phải GV)' : ' (Tay trái GV)') : '';
    const maxOcc = Math.max(1, ...aisle.desks.map(d => (deskItems[d.id] || []).length));
    const aisleMinW = Math.max(148, maxOcc * 116 + Math.max(0, maxOcc - 1) * 6 + 16);

    const desksHtml = aisle.desks.map((desk, di) => {
      const list = deskItems[desk.id] || [];
      const displayList = isTeacherView ? [...list].reverse() : list;
      const origDeskIdx = isTeacherView ? (aisle.desks.length - 1 - di) : di;
      const origAisle = layout[origAisleIdx];
      const hasDividerAfter = isTeacherView
        ? Boolean(origAisle?.desks?.[origDeskIdx - 1]?.dividerAfter)
        : Boolean(desk.dividerAfter);

      const seatsHtml = displayList.length ? displayList.map(entry => {
        const stu = studentById(entry.studentId);
        const att = entry.attendance || stu?.attendance;
        const hw = entry.homework || stu?.homework;
        const isMakeup = Boolean(stu && (stu.studentType === 'makeup' || !(stu.classIds || []).includes(CURRENT_CLASS_ID)));
        const attStatus = att?.status || 'unmarked';
        // Trong ảnh sơ đồ lớp: không ghi trạng thái điểm danh trừ trạng thái Đi muộn (ghi rõ số phút đi muộn)
        let stateClass = stu ? 'snap-seat-present' : 'snap-seat-unmarked';
        let attBadgeHtml = '';
        if (stu && attStatus === 'late') {
          stateClass = 'snap-seat-late';
          const lateDet = resolveLateDetails(stu, entry);
          const lateLabel = `Muộn ${lateDet.lateMinutes}p${lateDet.arrivalTime ? ` (${lateDet.arrivalTime})` : ''}`;
          attBadgeHtml = `<span class="snap-badge snap-att-tag">${escapeHtml(lateLabel)}</span>`;
        }

        let hwBadgeHtml = '';
        if (!data.isNoHwActive && stu) {
          const hwSt = hw?.status || 'uncollected';
          const hwScore = (hw?.score !== null && hw?.score !== undefined && hw?.score !== '') ? hw.score : null;
          if (hwScore !== null) {
            hwBadgeHtml = `<span class="snap-badge snap-hw-graded">BTVN: ${escapeHtml(formatScoreVN(hwScore))}đ</span>`;
          } else if (hwSt === 'graded' || hwSt === 'submitted') {
            hwBadgeHtml = `<span class="snap-badge snap-hw-submitted">✓ Đã nộp</span>`;
          } else if (hwSt === 'not_submitted') {
            hwBadgeHtml = `<span class="snap-badge snap-hw-missing">× K.Nộp</span>`;
          } else {
            hwBadgeHtml = `<span class="snap-badge snap-hw-pending">· Chưa thu</span>`;
          }
        }

        const testScoreVal = (entry.testScore !== null && entry.testScore !== undefined && entry.testScore !== '')
          ? entry.testScore
          : ((stu?.testScore !== null && stu?.testScore !== undefined && stu?.testScore !== '') ? stu.testScore : null);
        const testBadgeHtml = testScoreVal !== null
          ? `<span class="snap-badge snap-test-score">Test: ${escapeHtml(formatScoreVN(testScoreVal))}đ</span>`
          : '';

        const makeupBadgeHtml = isMakeup ? `<span class="snap-badge snap-makeup-tag">BÙ</span>` : '';
        const stuTags = stu ? studentTagList(stu) : [];
        const tagsBadgesHtml = stuTags.map(tag => `<span class="snap-badge snap-stu-tag ${tag === 'Mới' ? 'snap-tag-new' : ''}">#${escapeHtml(tag)}</span>`).join('');

        return `
          <div class="snap-seat ${stateClass} ${isMakeup ? 'snap-seat-makeup' : ''}">
            <div class="snap-seat-name">${escapeHtml(stu ? stu.name : 'Chỗ trống')}</div>
            ${tagsBadgesHtml ? `<div class="snap-seat-tags-row">${tagsBadgesHtml}</div>` : ''}
            <div class="snap-seat-badges">
              ${attBadgeHtml}
              ${hwBadgeHtml}
              ${testBadgeHtml}
              ${makeupBadgeHtml}
            </div>
          </div>
        `;
      }).join('') : `<div class="snap-desk-empty">Bàn ${origDeskIdx + 1} trống</div>`;

      const dividerHtml = (di < aisle.desks.length - 1 && hasDividerAfter)
        ? `<div class="snap-desk-divider" title="Vạch phân cách bàn"></div>`
        : '';

      return `
        <div class="snap-desk">
          <div class="snap-desk-seats">${seatsHtml}</div>
        </div>
        ${dividerHtml}
      `;
    }).join('');

    return `
      <div class="snap-aisle" style="width:${aisleMinW}px; min-width:${aisleMinW}px;">
        <div class="snap-aisle-header">DÃY ${origAisleIdx + 1}${escapeHtml(sideLabel)}</div>
        <div class="snap-aisle-desks">${desksHtml}</div>
      </div>
    `;
  }).join('');

  const lateQueueHtml = data.lateQueueStudents.length ? `
    <div class="snap-late-queue">
      <strong>Học sinh cuối lớp (chờ xếp chỗ):</strong>
      ${data.lateQueueStudents.map(s => {
        const lDet = resolveLateDetails(s, null);
        return `<span class="snap-late-pill">${escapeHtml(s.name)} (${lDet.isLate ? `Muộn ${lDet.lateMinutes}p · ${escapeHtml(lDet.arrivalTime)}` : `Đúng giờ${lDet.arrivalTime ? ' · ' + escapeHtml(lDet.arrivalTime) : ''}`})</span>`;
      }).join('')}
    </div>
  ` : '';

  return `
    <div class="snap-header">
      <div class="snap-header-main">
        <div class="snap-title-row">
          <h3>${escapeHtml(clsName)}</h3>
          <span class="snap-chip snap-chip-primary">Mã: ${escapeHtml(clsCode)}</span>
          ${clsGrade && clsGrade !== '—' ? `<span class="snap-chip">${escapeHtml(clsGrade)}</span>` : ''}
          <span class="snap-chip">${escapeHtml(clsRoom)}</span>
        </div>
        <div class="snap-meta-row">
          <span><strong>Ngày:</strong> ${escapeHtml(vnDate)}${timeRange ? ` (${escapeHtml(timeRange)})` : ''}</span>
          <span>·</span>
          <span><strong>GV:</strong> ${escapeHtml(teacherName)}</span>
          <span>·</span>
          <span><strong>TA:</strong> ${escapeHtml(assistantName)}</span>
          ${lessonTitle ? `<span>·</span><span><strong>Bài học:</strong> ${escapeHtml(lessonTitle)}</span>` : ''}
        </div>
      </div>
      <div class="snap-stats-group">
        <div class="snap-stat-box">
          <small>Điểm danh</small>
          <strong>${data.attendedCount} / ${data.totalExpected}</strong>
          <span>Có mặt ${data.presentCount} · Muộn ${data.lateCount}</span>
        </div>
        <div class="snap-stat-box">
          <small>Bài tập về nhà</small>
          <strong>${data.isNoHwActive ? 'Không BTVN' : `${data.hwDoneCount} đã thu`}</strong>
          <span>${data.isNoHwActive ? 'Ca không thu BTVN' : `${data.hwMissingCount} không nộp`}</span>
        </div>
      </div>
    </div>

    <div class="snap-map-container">
      ${isTeacherView ? backBarHtml : boardBarHtml}
      <div class="snap-aisles-row">${aislesHtml}</div>
      ${lateQueueHtml}
      ${isTeacherView ? boardBarHtml : backBarHtml}
    </div>

    <div class="snap-legend">
      <span class="snap-legend-title">CHÚ THÍCH KÝ HIỆU:</span>
      <span class="snap-legend-item"><i class="snap-swatch snap-swatch-present"></i> Có mặt</span>
      <span class="snap-legend-item"><i class="snap-swatch snap-swatch-late"></i> Đi muộn</span>
      <span class="snap-legend-item"><i class="snap-swatch snap-swatch-absent"></i> Vắng mặt</span>
      <span class="snap-legend-item"><i class="snap-swatch snap-swatch-unmarked"></i> Chưa điểm danh</span>
      <span class="snap-legend-item"><b class="snap-leg-badge snap-hw-submitted">✓ Đã thu</b> Đã nộp BTVN</span>
      <span class="snap-legend-item"><b class="snap-leg-badge snap-hw-graded">BTVN: 9đ</b> Điểm BTVN</span>
      <span class="snap-legend-item"><b class="snap-leg-badge snap-hw-missing">× K.Nộp</b> Không nộp BTVN</span>
      <span class="snap-legend-item"><b class="snap-leg-badge snap-makeup-tag">BÙ</b> Học sinh học bù</span>
      <span class="snap-legend-item"><i class="snap-divider-swatch"></i> Vạch ngăn bàn</span>
    </div>
  `;
}

function fitSeatingSnapshotBoard() {
  const dlg = $('#seating-snapshot-dialog');
  const viewport = $('#seating-snapshot-viewport');
  const board = $('#seating-snapshot-board');
  if (!dlg || !dlg.open || !viewport || !board || board.hidden) return;

  board.style.transform = 'none';
  board.style.marginBottom = '0px';
  board.style.marginRight = '0px';

  const availW = Math.max(280, viewport.clientWidth - 20);
  const availH = Math.max(240, viewport.clientHeight - 20);
  const naturalW = board.scrollWidth || board.offsetWidth || 800;
  const naturalH = board.scrollHeight || board.offsetHeight || 500;

  const scaleW = availW / naturalW;
  const scaleH = availH / naturalH;
  const scale = Math.min(1, scaleW, scaleH);

  if (scale < 0.995) {
    board.style.transformOrigin = 'top center';
    board.style.transform = `scale(${scale.toFixed(4)})`;
    const scaledHeightDiff = naturalH * (1 - scale);
    board.style.marginBottom = `-${Math.round(scaledHeightDiff)}px`;
  }
}

function renderSeatingSnapshotCanvas() {
  const data = getSeatingSnapshotData();
  const clsName = configClass?.name || 'Lớp học';
  const clsCode = configClass?.code || CURRENT_CLASS_ID;
  const clsRoom = configClass?.room || 'Phòng tiêu chuẩn';
  const teacherName = configClass?.teacherName || '—';
  const assistantName = configClass?.assistantName || '—';
  const dateParts = String(checklistDate || '').split('-');
  const vnDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : checklistDate;

  const aisleCount = Math.max(1, data.displayLayout.length);
  const seatW = 136;
  const seatH = 68;
  const seatGap = 6;
  const deskPad = 8;
  const deskGap = 6;
  const aisleGap = 16;

  const aisleWidths = data.displayLayout.map(aisle => {
    const maxOcc = Math.max(1, ...aisle.desks.map(d => (deskItems[d.id] || []).length));
    return Math.max(172, maxOcc * seatW + Math.max(0, maxOcc - 1) * seatGap + deskPad * 2);
  });

  const totalAislesW = aisleWidths.reduce((a, b) => a + b, 0) + Math.max(0, aisleCount - 1) * aisleGap;
  const canvasW = Math.max(880, totalAislesW + 64);

  const maxDesksCount = Math.max(1, ...data.displayLayout.map(a => a.desks.length));
  const aislesAreaH = 34 + maxDesksCount * (seatH + deskPad * 2 + deskGap) + 24;
  const headerH = 68;
  const boardBarH = 32;
  const backBarH = 28;
  const legendH = 56;
  const canvasH = headerH + boardBarH + aislesAreaH + backBarH + legendH + 48;

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  roundRect(20, 12, canvasW - 40, headerH - 8, 10);
  ctx.fillStyle = '#f3f8f4';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#cfe0d2';
  ctx.stroke();

  // Smaller, balanced class title in exported image
  ctx.fillStyle = '#1e3a29';
  ctx.font = '800 15px sans-serif';
  ctx.fillText(`${clsName} (${clsCode}) · Phòng ${clsRoom}`, 32, 36);

  ctx.fillStyle = '#4b5e50';
  ctx.font = '600 12px sans-serif';
  ctx.fillText(`Ngày: ${vnDate}  |  GV: ${teacherName}  |  TA: ${assistantName}`, 32, 56);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1f5f33';
  ctx.font = '800 13.5px sans-serif';
  ctx.fillText(`Điểm danh sơ đồ: ${data.attendedCount}/${data.totalExpected} (Có mặt: ${data.presentCount} · Muộn: ${data.lateCount})`, canvasW - 32, 36);
  ctx.fillStyle = '#334155';
  ctx.font = '700 12px sans-serif';
  ctx.fillText(
    data.isNoHwActive
      ? 'BTVN: Ca học không có BTVN'
      : `BTVN: ${data.hwDoneCount} đã nộp · ${data.hwMissingCount} chưa nộp`,
    canvasW - 32,
    56
  );
  ctx.textAlign = 'left';

  let curY = headerH + 10;
  const barW = Math.min(340, canvasW - 120);
  roundRect((canvasW - barW) / 2, curY, barW, 24, 6);
  ctx.fillStyle = '#e8f3ea';
  ctx.fill();
  ctx.strokeStyle = '#9ec2a6';
  ctx.stroke();
  ctx.fillStyle = '#1e3a29';
  ctx.font = '800 11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isTeacherView ? 'CUỐI LỚP (GÓC NHÌN GIÁO VIÊN)' : 'BẢNG · ĐẦU LỚP', canvasW / 2, curY + 16);

  curY += 34;

  let curX = (canvasW - totalAislesW) / 2;

  data.displayLayout.forEach((aisle, ci) => {
    const origAisleIdx = isTeacherView ? (layout.length - 1 - ci) : ci;
    const colW = aisleWidths[ci];

    ctx.fillStyle = '#4d6553';
    ctx.font = '800 11.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DÃY ${origAisleIdx + 1}`, curX + colW / 2, curY + 13);

    let deskY = curY + 22;
    aisle.desks.forEach((desk, di) => {
      const list = deskItems[desk.id] || [];
      const displayList = isTeacherView ? [...list].reverse() : list;
      const origDeskIdx = isTeacherView ? (aisle.desks.length - 1 - di) : di;
      const origAisle = layout[origAisleIdx];
      const hasDividerAfter = isTeacherView
        ? Boolean(origAisle?.desks?.[origDeskIdx - 1]?.dividerAfter)
        : Boolean(desk.dividerAfter);

      const dH = seatH + deskPad * 2;
      roundRect(curX, deskY, colW, dH, 8);
      ctx.fillStyle = '#fbfdfb';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#cbd8cd';
      ctx.stroke();

      if (!displayList.length) {
        ctx.fillStyle = '#9aa89d';
        ctx.font = 'italic 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Bàn ${origDeskIdx + 1} trống`, curX + colW / 2, deskY + dH / 2 + 4);
      } else {
        const rowSeatsW = displayList.length * seatW + Math.max(0, displayList.length - 1) * seatGap;
        let seatX = curX + (colW - rowSeatsW) / 2;
        displayList.forEach(entry => {
          const stu = studentById(entry.studentId);
          const att = entry.attendance || stu?.attendance;
          const hw = entry.homework || stu?.homework;
          const isMakeup = Boolean(stu && (stu.studentType === 'makeup' || !(stu.classIds || []).includes(CURRENT_CLASS_ID)));
          const attSt = att?.status || 'unmarked';

          // Trong ảnh sơ đồ lớp: không ghi trạng thái điểm danh trừ trạng thái Đi muộn (ghi rõ số phút đi muộn)
          let bg = stu ? '#eaf5ec' : '#f3f7f3';
          let border = stu ? '#86c292' : '#ced9cf';
          let textCol = stu ? '#1b4d2a' : '#334155';
          let attTxt = '';
          if (stu && attSt === 'late') {
            bg = '#fff5e8'; border = '#e5b26d'; textCol = '#8a5311';
            const lateDet = resolveLateDetails(stu, entry);
            attTxt = `Muộn ${lateDet.lateMinutes}p${lateDet.arrivalTime ? ` (${lateDet.arrivalTime})` : ''}`;
          }
          if (isMakeup) {
            border = '#9333ea';
          }

          roundRect(seatX, deskY + deskPad, seatW, seatH, 6);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.lineWidth = isMakeup ? 2 : 1.2;
          ctx.strokeStyle = border;
          ctx.stroke();

          const fullName = stu ? stu.name : 'Chỗ trống';
          ctx.fillStyle = textCol;
          ctx.font = '700 11.5px sans-serif';
          ctx.textAlign = 'center';
          const shortName = fullName.length > 18 ? fullName.slice(0, 17) + '…' : fullName;
          ctx.fillText(shortName, seatX + seatW / 2, deskY + deskPad + 18);

          // Render Student Tags (#Mới, etc.) in exported image
          const stuTags = stu ? studentTagList(stu) : [];
          if (stuTags.length) {
            const tagLine = stuTags.map(t => `#${t}`).join(' ');
            const shortTags = tagLine.length > 22 ? tagLine.slice(0, 21) + '…' : tagLine;
            ctx.fillStyle = '#0f5132';
            ctx.font = '700 9.5px sans-serif';
            ctx.fillText(shortTags, seatX + seatW / 2, deskY + deskPad + 34);
          }

          let hwTxt = '';
          if (!data.isNoHwActive && stu) {
            const hwSt = hw?.status || 'uncollected';
            const hwScore = (hw?.score !== null && hw?.score !== undefined && hw?.score !== '') ? formatScoreVN(hw.score) : null;
            if (hwScore !== null) hwTxt = `BTVN:${hwScore}đ`;
            else if (hwSt === 'submitted' || hwSt === 'graded') hwTxt = '✓Đã nộp';
            else if (hwSt === 'not_submitted') hwTxt = '×Chưa nộp';
            else hwTxt = 'Chưa thu';
          }
          if (isMakeup) hwTxt = hwTxt ? `${hwTxt} [BÙ]` : '[BÙ]';

          const metaLine = [attTxt, hwTxt].filter(Boolean).join(' · ');
          if (metaLine) {
            ctx.fillStyle = attSt === 'late' ? '#9a3412' : '#475569';
            ctx.font = '700 9.6px sans-serif';
            ctx.fillText(metaLine, seatX + seatW / 2, deskY + deskPad + (stuTags.length ? 52 : 42));
          }

          seatX += seatW + seatGap;
        });
      }

      deskY += dH + deskGap;
      if (di < aisle.desks.length - 1 && hasDividerAfter) {
        ctx.fillStyle = '#1e3a29';
        ctx.fillRect(curX + 4, deskY - deskGap / 2 - 1.5, colW - 8, 3);
      }
    });

    curX += colW + aisleGap;
  });

  curY += aislesAreaH;

  roundRect((canvasW - barW) / 2, curY, barW, 24, 6);
  ctx.fillStyle = '#f3f6f4';
  ctx.fill();
  ctx.strokeStyle = '#cbd8cd';
  ctx.stroke();
  ctx.fillStyle = '#526356';
  ctx.font = '800 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isTeacherView ? 'BẢNG · ĐẦU LỚP' : 'CUỐI LỚP', canvasW / 2, curY + 16);

  curY += 32;

  roundRect(20, curY, canvasW - 40, 40, 8);
  ctx.fillStyle = '#f8faf8';
  ctx.fill();
  ctx.strokeStyle = '#d5e2d7';
  ctx.stroke();

  ctx.fillStyle = '#1e3a29';
  ctx.font = '700 11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'CHÚ THÍCH:  [Xanh lá] Có mặt trên sơ đồ  ·  [Vàng cam] Đi muộn (ghi rõ số phút)  ·  [✓Đã nộp] Đã nộp BTVN  ·  [BTVN: 7,5đ] Điểm BTVN  ·  [×Chưa nộp] Chưa nộp  ·  [BÙ] Học bù',
    canvasW / 2,
    curY + 24
  );

  return canvas.toDataURL('image/png');
}

function openSeatingSnapshotDialog() {
  const dlg = $('#seating-snapshot-dialog');
  const board = $('#seating-snapshot-board');
  const imgWrap = $('#seating-snapshot-img-wrap');
  const imgEl = $('#seating-snapshot-img');
  const modeBtn = $('#toggle-seating-img-mode-btn');
  if (!dlg || !board) return;

  board.innerHTML = buildSeatingSnapshotHtml();
  board.hidden = false;
  if (imgWrap) imgWrap.hidden = true;
  if (modeBtn) modeBtn.textContent = 'Chế độ Ảnh (Giữ để Lưu/Copy)';

  const dataUrl = renderSeatingSnapshotCanvas();
  if (imgEl) imgEl.src = dataUrl;

  dlg.showModal();
  requestAnimationFrame(() => {
    fitSeatingSnapshotBoard();
  });
}

$('#export-seating-image-btn')?.addEventListener('click', () => {
  openSeatingSnapshotDialog();
});

$('#close-seating-snapshot-btn')?.addEventListener('click', () => {
  $('#seating-snapshot-dialog')?.close();
});

$('#toggle-seating-img-mode-btn')?.addEventListener('click', () => {
  const board = $('#seating-snapshot-board');
  const imgWrap = $('#seating-snapshot-img-wrap');
  const imgEl = $('#seating-snapshot-img');
  const modeBtn = $('#toggle-seating-img-mode-btn');
  if (!board || !imgWrap) return;
  const showingImg = !imgWrap.hidden;
  if (showingImg) {
    imgWrap.hidden = true;
    board.hidden = false;
    if (modeBtn) modeBtn.textContent = 'Chế độ Ảnh (Giữ để Lưu/Copy)';
    requestAnimationFrame(() => fitSeatingSnapshotBoard());
  } else {
    if (imgEl) imgEl.src = renderSeatingSnapshotCanvas();
    board.hidden = true;
    imgWrap.hidden = false;
    if (modeBtn) modeBtn.textContent = 'Quay lại Khung Bảng';
  }
});

$('#download-seating-png-btn')?.addEventListener('click', () => {
  const dataUrl = renderSeatingSnapshotCanvas();
  const imgEl = $('#seating-snapshot-img');
  if (imgEl) imgEl.src = dataUrl;
  const clsCode = (configClass?.code || CURRENT_CLASS_ID || 'lop').replace(/[^a-zA-Z0-9_-]/g, '_');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `So-do-lop-${clsCode}-${checklistDate}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Đã xuất và tải xuống hình ảnh PNG sơ đồ lớp.');
});

window.addEventListener('resize', () => {
  if ($('#seating-snapshot-dialog')?.open) {
    fitSeatingSnapshotBoard();
  }
});





// ============================================================================
// v3.9: THÊM CA HỌC TRONG QUÁ KHỨ, SỬA CA HỌC & XOÁ CA HỌC (XOÁ LUÔN TRONG DATA HỌC SINH)
// ============================================================================

function deleteClassSessionAndStudentData(classId, date, skipConfirm = false) {
  const cls = resolveClass(classId) || { id: classId, name: classId, code: classId };
  if (!date) return false;
  const dFormatted = new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  if (!skipConfirm) {
    const ok = window.confirm(
      `Bạn có chắc chắn muốn XOÁ ca học ngày ${dFormatted} (${date}) của lớp ${cls.name}?\n\n` +
      `Lưu ý: Toàn bộ dữ liệu của buổi học này (điểm danh, điểm BTVN, điểm Test, vị trí ngồi, ghi chú buổi học) trong hồ sơ của tất cả học sinh cũng sẽ bị xoá sạch.`
    );
    if (!ok) return false;
  }

  // 1. Xoá khỏi lopvui.session-history.v2
  const allHist = loadSessionHistory();
  const nextHist = allHist.filter(s => !(s.classId === classId && s.date === date));
  saveSessionHistory(nextHist);

  // 2. Xoá toàn bộ localStorage keys của buổi học đó
  const deletedSessObj = allHist.find(s => s.classId === classId && s.date === date);
  logAdminSessionAction(
    `Xoá ca học ngày ${formatDateDDMMYYYY(date)}`,
    `Lớp: ${cls.name} (${cls.code || cls.id}) · Bài học: "${deletedSessObj?.lessonTitle || '—'}" · Đã xoá ca học và dữ liệu buổi học trong hồ sơ học sinh`,
    'session',
    '',
    classId,
    date
  );

  // Giữ nguyên lopvui.admin-audit-log.v1.${classId}.${date} để Admin luôn tra cứu được lịch sử ca bị xoá và ai đã xoá ca!
  const sessionKeysToRemove = [
    `lopvui.layout.v5.${classId}.${date}`,
    `lopvui.desk-items.v7.${classId}.${date}`,
    `lopvui.late-queue.v6.${classId}.${date}`,
    `lopvui.checklist.v1.${classId}.${date}`,
    `lopvui.attendance-notes.v1.${classId}.${date}`,
    `lopvui.class-communication.v1.${classId}.${date}`,
    `lopvui.finalized-session.v1.${classId}.${date}`,
    `lopvui.session-record.v1.${classId}.${date}`
  ];
  sessionKeysToRemove.forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });

  // Xoá trong session-overrides và sessionChanges nếu có
  try {
    const ovRaw = localStorage.getItem('lopvui.session-overrides.v1');
    if (ovRaw) {
      const ov = JSON.parse(ovRaw);
      delete ov[`${classId}:${date}`];
      localStorage.setItem('lopvui.session-overrides.v1', JSON.stringify(ov));
    }
  } catch {}
  if (sessionChanges) {
    delete sessionChanges[`${classId}::${date}`];
    delete sessionChanges[`${classId}:${date}`];
    saveClassSessionChanges(sessionChanges);
  }

  // 3. Xoá dữ liệu buổi học (classId, date) trong hồ sơ của TẤT CẢ học sinh chính thức và học bù
  const cleanStudentSessionArrays = (stu) => {
    if (!stu) return;
    if (Array.isArray(stu.attendanceHistory)) {
      stu.attendanceHistory = stu.attendanceHistory.filter(h => !((!h.classId || h.classId === classId) && h.date === date));
      stu.history = stu.attendanceHistory;
    }
    if (Array.isArray(stu.scores)) {
      stu.scores = stu.scores.filter(sc => !((!sc.classId || sc.classId === classId) && sc.date === date));
    }
    if (Array.isArray(stu.sessionNotes)) {
      stu.sessionNotes = stu.sessionNotes.filter(sn => !((!sn.classId || sn.classId === classId) && sn.date === date));
    }
    if (Array.isArray(stu.seatingHistory)) {
      stu.seatingHistory = stu.seatingHistory.filter(sh => !((!sh.classId || sh.classId === classId) && sh.date === date));
    }
    if (Array.isArray(stu.notes)) {
      stu.notes = stu.notes.filter(n => !((!n.classId || n.classId === classId) && n.date === date));
    }
    if (CURRENT_CLASS_ID === classId && checklistDate === date) {
      stu.attendance = null;
      stu.homework = { status: 'uncollected' };
      delete stu.arrivalTime;
      delete stu.lateMinutes;
      delete stu.minutesLate;
      delete stu.testScore;
    }
  };

  students.forEach(cleanStudentSessionArrays);
  makeupStudents.forEach(cleanStudentSessionArrays);

  // Loại bỏ học sinh học bù tạm thời được tạo riêng cho buổi học bị xoá này
  makeupStudents = makeupStudents.filter(m => {
    if (m.attendingClassId === classId && m.attendingSessionDate === date) {
      const hasOtherData = (m.attendanceHistory || []).length > 0 || (m.scores || []).length > 0 || (m.sessionNotes || []).length > 0;
      return hasOtherData;
    }
    return true;
  });

  saveStudentRecords(students, makeupStudents);

  // Nếu đang mở đúng ca bị xoá trên màn hình, nạp lại dữ liệu trống hoặc chuyển về trang tổng quan lớp
  if (CURRENT_CLASS_ID === classId && checklistDate === date) {
    deskItems = {};
    lateQueue = [];
    attendanceNotes = {};
    if (!$('#class-workspace')?.hidden) {
      navigateTo(`class/${cls.code || cls.id}`);
    }
  }

  if ($('#class-general-view') && !$('#class-general-view').hidden) {
    renderClassGeneralView(classId);
  }
  if ($('#class-history-dialog')?.open && window.__featuresApp?.openClassHistoryDialog) {
    window.__featuresApp.openClassHistoryDialog(classId);
  }
  renderMainMenu();
  forceSyncNow('delete-session');
  toast(`✓ Đã xoá ca học ngày ${date} và xoá dữ liệu buổi học trong hồ sơ học sinh.`);
  return true;
}

function openManagePastSessionDialog(classId, editDate = null) {
  const cls = resolveClass(classId) || activeClassConfig();
  if (!cls) return;
  const dlg = $('#past-session-manage-dialog');
  if (!dlg) return;

  const allHist = loadSessionHistory();
  const existingSession = editDate ? allHist.find(s => s.classId === cls.id && s.date === editDate) : null;

  $('#manage-session-class-id').value = cls.id;
  $('#manage-session-orig-date').value = editDate || '';

  const defaultPastDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE');
  };

  const targetDate = editDate || defaultPastDate();
  $('#manage-session-date').value = targetDate;

  let savedChk = {};
  if (editDate) {
    try {
      savedChk = JSON.parse(localStorage.getItem(`lopvui.checklist.v1.${cls.id}.${editDate}`) || '{}') || {};
    } catch {}
  }

  const isEditing = Boolean(editDate);
  $('#past-session-manage-eyebrow').textContent = `${cls.code || cls.id} · ${cls.name}`;
  $('#past-session-manage-title').textContent = isEditing
    ? `Sửa ca học ngày ${editDate.split('-').reverse().join('/')}`
    : `Thêm ca học trong quá khứ · ${cls.name}`;
  $('#past-session-manage-hint').textContent = isEditing
    ? 'Chỉnh sửa ngày học, tên bài học, giáo viên/trợ giảng hoặc cấu hình BTVN/Test của ca học này.'
    : 'Tạo bổ sung một ca học trong quá khứ cho lớp để lưu lịch sử điểm danh và nhập điểm BTVN / Test.';

  $('#manage-session-status').value = existingSession?.status || 'closed';
  $('#manage-session-lesson-title').value = existingSession?.lessonTitle || savedChk.lessonTitle || '';
  $('#manage-session-teacher').value = existingSession?.teacherName || cls.teacherName || '';
  $('#manage-session-assistant').value = existingSession?.assistantName || cls.assistantName || '';
  $('#manage-session-room').value = existingSession?.room || cls.room || '';
  $('#manage-session-hw-assignment').value = existingSession?.homeworkAssignment || savedChk.homeworkAssignment || '';
  $('#manage-session-note').value = existingSession?.finalNote || existingSession?.sessionNote || savedChk.classNote || '';

  const hasBtvn = existingSession
    ? (existingSession.hasBtvn !== undefined ? Boolean(existingSession.hasBtvn) : !existingSession.noHomework)
    : true;
  const hasTest = existingSession
    ? Boolean(existingSession.hasTest || savedChk.testRequired || (existingSession.studentsSnapshot || []).some(st => st.testScore !== null && st.testScore !== undefined))
    : false;

  $('#manage-session-has-btvn').checked = hasBtvn;
  $('#manage-session-has-test').checked = hasTest;

  const initPresentWrap = $('#manage-session-init-present-wrap');
  if (initPresentWrap) {
    initPresentWrap.style.display = isEditing ? 'none' : 'flex';
  }
  if ($('#manage-session-init-present')) {
    $('#manage-session-init-present').checked = !isEditing;
  }

  const delBtn = $('#manage-session-delete-btn');
  if (delBtn) {
    delBtn.hidden = !isEditing;
    delBtn.onclick = () => {
      dlg.close();
      deleteClassSessionAndStudentData(cls.id, editDate);
    };
  }

  dlg.showModal();
  setTimeout(() => {
    $('#manage-session-lesson-title')?.focus();
  }, 50);
}

function saveManagedPastSession(openAfterSave = false) {
  const classId = $('#manage-session-class-id')?.value || CURRENT_CLASS_ID;
  const origDate = ($('#manage-session-orig-date')?.value || '').trim();
  const newDate = ($('#manage-session-date')?.value || '').trim();
  const status = $('#manage-session-status')?.value || 'closed';
  const lessonTitle = ($('#manage-session-lesson-title')?.value || '').trim() || `Buổi học ${newDate}`;
  const teacherName = ($('#manage-session-teacher')?.value || '').trim();
  const assistantName = ($('#manage-session-assistant')?.value || '').trim();
  const room = ($('#manage-session-room')?.value || '').trim();
  const hwAssignment = ($('#manage-session-hw-assignment')?.value || '').trim();
  const sessionNote = ($('#manage-session-note')?.value || '').trim();
  const hasBtvn = Boolean($('#manage-session-has-btvn')?.checked);
  const hasTest = Boolean($('#manage-session-has-test')?.checked);
  const initPresent = !origDate && Boolean($('#manage-session-init-present')?.checked);

  if (!newDate) {
    toast('Vui lòng chọn ngày diễn ra ca học.');
    $('#manage-session-date')?.focus();
    return;
  }

  const cls = resolveClass(classId) || activeClassConfig();
  const allHist = loadSessionHistory();

  if ((!origDate || origDate !== newDate) && allHist.some(s => s.classId === classId && s.date === newDate)) {
    const overwrite = window.confirm(`Lớp ${cls?.name || classId} đã có một ca học vào ngày ${newDate}. Bạn có muốn cập nhật đè lên ca học ngày ${newDate} không?`);
    if (!overwrite) return;
  }

  // Nếu đang sửa ca học và người dùng đổi ngày (origDate -> newDate), di chuyển dữ liệu localStorage và dữ liệu học sinh sang ngày mới
  if (origDate && origDate !== newDate) {
    const keyPrefixes = [
      'lopvui.layout.v5',
      'lopvui.desk-items.v7',
      'lopvui.late-queue.v6',
      'lopvui.checklist.v1',
      'lopvui.attendance-notes.v1',
      'lopvui.class-communication.v1',
      'lopvui.finalized-session.v1',
      'lopvui.session-record.v1'
    ];
    keyPrefixes.forEach(prefix => {
      const oldK = `${prefix}.${classId}.${origDate}`;
      const newK = `${prefix}.${classId}.${newDate}`;
      const raw = localStorage.getItem(oldK);
      if (raw !== null) {
        localStorage.setItem(newK, raw);
        localStorage.removeItem(oldK);
      }
    });

    const migrateStudentDate = (stu) => {
      if (!stu) return;
      (stu.attendanceHistory || []).forEach(h => {
        if ((!h.classId || h.classId === classId) && h.date === origDate) h.date = newDate;
      });
      (stu.scores || []).forEach(sc => {
        if ((!sc.classId || sc.classId === classId) && sc.date === origDate) sc.date = newDate;
      });
      (stu.sessionNotes || []).forEach(sn => {
        if ((!sn.classId || sn.classId === classId) && sn.date === origDate) {
          sn.date = newDate;
          sn.lessonTitle = lessonTitle;
        }
      });
      (stu.seatingHistory || []).forEach(sh => {
        if ((!sh.classId || sh.classId === classId) && sh.date === origDate) sh.date = newDate;
      });
      if (stu.attendingClassId === classId && stu.attendingSessionDate === origDate) {
        stu.attendingSessionDate = newDate;
      }
    };
    students.forEach(migrateStudentDate);
    makeupStudents.forEach(migrateStudentDate);
  }

  // Cập nhật hoặc khởi tạo checklist của buổi học
  const chkKey = `lopvui.checklist.v1.${classId}.${newDate}`;
  let chkObj = null;
  try { chkObj = JSON.parse(localStorage.getItem(chkKey) || 'null'); } catch {}
  if (!chkObj || typeof chkObj !== 'object') {
    chkObj = defaultChecklist();
  }
  chkObj.lessonTitle = lessonTitle;
  chkObj.classNote = sessionNote;
  chkObj.homeworkAssignment = hwAssignment;
  chkObj.testRequired = hasTest;
  localStorage.setItem(chkKey, JSON.stringify(chkObj));

  setNoHomeworkStatus(classId, newDate, !hasBtvn);

  // Khởi tạo layout & deskItems cho buổi học nếu chưa có
  const layKey = `lopvui.layout.v5.${classId}.${newDate}`;
  const deskKey = `lopvui.desk-items.v7.${classId}.${newDate}`;
  let sessLayout = null;
  try { sessLayout = JSON.parse(localStorage.getItem(layKey) || 'null'); } catch {}
  if (!Array.isArray(sessLayout) || !sessLayout.length) {
    sessLayout = structuredClone(cls?.defaultLayout || baseLayout);
    localStorage.setItem(layKey, JSON.stringify(sessLayout));
  }

  let sessDeskItems = null;
  try { sessDeskItems = JSON.parse(localStorage.getItem(deskKey) || 'null'); } catch {}
  if (!sessDeskItems || typeof sessDeskItems !== 'object') {
    sessDeskItems = {};
    sessLayout.forEach(aisle => (aisle.desks || []).forEach(d => { sessDeskItems[d.id] = []; }));
  }

  const classRoster = students.filter(s => (s.classIds || []).includes(classId));

  if (initPresent && classRoster.length > 0) {
    const allDesksFlat = [];
    sessLayout.forEach((aisle, ci) => {
      (aisle.desks || []).forEach((d, di) => {
        allDesksFlat.push({ deskId: d.id, seats: d.seats || 2, ci, di });
      });
    });

    const hasAnySeated = Object.values(sessDeskItems).some(arr => Array.isArray(arr) && arr.some(e => e.studentId));
    let deskCursor = 0;

    classRoster.forEach((stu) => {
      stu.attendanceHistory = Array.isArray(stu.attendanceHistory) ? stu.attendanceHistory : [];
      if (!stu.attendanceHistory.some(h => h.classId === classId && h.date === newDate)) {
        stu.attendanceHistory.unshift({
          classId,
          date: newDate,
          status: 'present',
          minutesLate: 0,
          lateMinutes: 0,
          time: null,
          reason: null,
          homework: { status: hasBtvn ? 'submitted' : 'uncollected' },
          timestamp: Date.now()
        });
        stu.history = stu.attendanceHistory;
      }

      stu.sessionNotes = Array.isArray(stu.sessionNotes) ? stu.sessionNotes : [];
      const snIdx = stu.sessionNotes.findIndex(n => n.classId === classId && n.date === newDate);
      const snEntry = {
        ...(snIdx >= 0 ? stu.sessionNotes[snIdx] : {}),
        classId,
        date: newDate,
        lessonTitle,
        homeworkStatus: hasBtvn ? 'submitted' : 'uncollected',
        updatedAt: Date.now()
      };
      if (snIdx >= 0) stu.sessionNotes[snIdx] = snEntry;
      else stu.sessionNotes.unshift(snEntry);

      if (!hasAnySeated && allDesksFlat.length > 0) {
        while (deskCursor < allDesksFlat.length && (sessDeskItems[allDesksFlat[deskCursor].deskId] || []).length >= (allDesksFlat[deskCursor].seats || 2)) {
          deskCursor++;
        }
        const targetDesk = allDesksFlat[Math.min(deskCursor, allDesksFlat.length - 1)];
        if (targetDesk) {
          sessDeskItems[targetDesk.deskId] = sessDeskItems[targetDesk.deskId] || [];
          sessDeskItems[targetDesk.deskId].push({
            studentId: stu.id,
            attendance: { status: 'present' },
            homework: { status: hasBtvn ? 'submitted' : 'uncollected', score: null, reason: null, note: '' }
          });
        }
      }
    });
    localStorage.setItem(deskKey, JSON.stringify(sessDeskItems));
  } else if (origDate) {
    students.forEach(stu => {
      (stu.sessionNotes || []).forEach(sn => {
        if ((!sn.classId || sn.classId === classId) && sn.date === newDate) {
          sn.lessonTitle = lessonTitle;
        }
      });
    });
  }

  saveStudentRecords(students, makeupStudents);

  let recordIdx = allHist.findIndex(s => s.classId === classId && s.date === (origDate || newDate));
  if (origDate && origDate !== newDate) {
    for (let i = allHist.length - 1; i >= 0; i--) {
      if (allHist[i].classId === classId && allHist[i].date === newDate && i !== recordIdx) {
        allHist.splice(i, 1);
      }
    }
    recordIdx = allHist.findIndex(s => s.classId === classId && s.date === origDate);
  }

  const nowIso = new Date().toISOString();
  const operator = {
    id: currentEmployeeId || 'admin',
    name: currentStaffName(),
    role: selectedRole()
  };

  const existingRec = recordIdx >= 0 ? allHist[recordIdx] : null;
  const studentsSnap = existingRec?.studentsSnapshot?.length
    ? existingRec.studentsSnapshot.map(st => {
        const stuObj = studentById(st.studentId);
        const sn = (stuObj?.sessionNotes || []).find(n => n.classId === classId && n.date === newDate);
        return {
          ...st,
          testScore: sn?.testScore ?? st.testScore ?? null,
          homework: {
            ...(st.homework || {}),
            score: sn?.homeworkScore ?? st.homework?.score ?? null,
            status: sn?.homeworkStatus || st.homework?.status || 'uncollected'
          }
        };
      })
    : classRoster.map(s => {
        const attH = (s.attendanceHistory || []).find(h => h.classId === classId && h.date === newDate);
        const sn = (s.sessionNotes || []).find(n => n.classId === classId && n.date === newDate);
        const attSt = attH?.status || (initPresent ? 'present' : 'unrecorded');
        return {
          studentId: s.id,
          studentName: s.name,
          studentCode: s.studentCode || null,
          school: s.school || '',
          attendance: {
            status: attSt,
            arrivalTime: attH?.time || null,
            minutesLate: attH?.lateMinutes || 0,
            lateMinutes: attH?.lateMinutes || 0
          },
          homework: {
            status: sn?.homeworkStatus || (initPresent && hasBtvn ? 'submitted' : 'uncollected'),
            score: sn?.homeworkScore ?? null,
            reason: sn?.homeworkReason || ''
          },
          testScore: sn?.testScore ?? null,
          note: sn?.note || ''
        };
      });

  const presentCnt = studentsSnap.filter(s => s.attendance?.status === 'present' || s.attendance?.status === 'late').length;
  const lateCnt = studentsSnap.filter(s => s.attendance?.status === 'late').length;
  const absentCnt = Math.max(0, classRoster.length - presentCnt);
  const hwDoneCnt = studentsSnap.filter(s => s.homework?.status === 'submitted' || s.homework?.status === 'graded').length;

  const updatedRecord = {
    ...(existingRec || {}),
    id: `session-${classId}-${newDate}`,
    classId,
    classCode: cls?.code || classId,
    className: cls?.name || classId,
    subject: cls?.subject || existingRec?.subject || '',
    room: room || cls?.room || '',
    grade: cls?.grade || existingRec?.grade || '',
    teacherName: teacherName || cls?.teacherName || '',
    assistantName: assistantName || cls?.assistantName || '',
    date: newDate,
    status,
    lessonTitle,
    finalNote: sessionNote,
    sessionNote,
    homeworkAssignment: hwAssignment,
    hasBtvn,
    hasTest,
    noHomework: !hasBtvn,
    startedAt: existingRec?.startedAt || nowIso,
    startedBy: existingRec?.startedBy || operator,
    closedAt: status === 'closed' ? (existingRec?.closedAt || nowIso) : null,
    closedBy: status === 'closed' ? (existingRec?.closedBy || operator) : null,
    updatedAt: nowIso,
    updatedBy: operator,
    layout: existingRec?.layout || sessLayout,
    deskItems: existingRec?.deskItems || sessDeskItems,
    studentsSnapshot: studentsSnap,
    stats: {
      total: classRoster.length,
      present: presentCnt,
      late: lateCnt,
      absent: absentCnt,
      homeworkDone: hasBtvn ? hwDoneCnt : 0,
      testsCollected: existingRec?.stats?.testsCollected || 0
    }
  };

  if (recordIdx >= 0) {
    allHist[recordIdx] = updatedRecord;
  } else {
    allHist.push(updatedRecord);
  }
  saveSessionHistory(allHist);
  logAdminSessionAction(
    origDate ? `Chỉnh sửa thông tin ca học (${newDate})` : `Tạo bổ sung ca học quá khứ (${newDate})`,
    `Bài học: "${lessonTitle}" · Trạng thái: ${status === 'closed' ? 'Đã đóng ca' : 'Đang mở'} · GV: ${teacherName || '—'} · TA: ${assistantName || '—'}`,
    'session',
    '',
    classId,
    newDate
  );

  $('#past-session-manage-dialog')?.close();

  if (CURRENT_CLASS_ID === classId && (checklistDate === origDate || checklistDate === newDate)) {
    checklistDate = newDate;
    reloadClassSessionData(classId, newDate);
    render();
  }
  if ($('#class-general-view') && !$('#class-general-view').hidden) {
    renderClassGeneralView(classId);
  }
  if ($('#class-history-dialog')?.open && window.__featuresApp?.openClassHistoryDialog) {
    window.__featuresApp.openClassHistoryDialog(classId);
  }
  renderMainMenu();
  forceSyncNow('save-past-session');

  if (openAfterSave) {
    $('#class-history-dialog')?.close();
    enterClass(classId, newDate, status === 'closed', 'scores');
    updateSubtabUrl('scores');
    toast(`✓ Đã lưu và mở ca học ngày ${newDate} (${lessonTitle}).`);
  } else {
    toast(origDate ? `✓ Đã cập nhật thông tin ca học ngày ${newDate}.` : `✓ Đã thêm ca học ngày ${newDate} vào lịch sử lớp.`);
  }
}

$('#close-past-session-manage-dialog')?.addEventListener('click', () => {
  $('#past-session-manage-dialog')?.close();
});
$('#cancel-past-session-manage-btn')?.addEventListener('click', () => {
  $('#past-session-manage-dialog')?.close();
});
$('#past-session-manage-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  saveManagedPastSession(false);
});
$('#save-and-open-past-session-btn')?.addEventListener('click', () => {
  saveManagedPastSession(true);
});

// Wire Admin Audit Log Dialog & Management Panel events (Plain Text mode)
$('#close-admin-log-dialog')?.addEventListener('click', () => {
  $('#session-admin-log-dialog')?.close();
});
$('#close-admin-log-bottom-btn')?.addEventListener('click', () => {
  $('#session-admin-log-dialog')?.close();
});
$('#admin-log-class-filter')?.addEventListener('change', (e) => {
  _activeAdminLogSession.classId = e.target.value;
  _activeAdminLogSession.date = 'all';
  renderSessionAdminLogDialogContent(_activeAdminLogSession.classId, 'all');
});
$('#admin-log-session-filter')?.addEventListener('change', (e) => {
  _activeAdminLogSession.date = e.target.value;
  renderSessionAdminLogDialogContent(null, _activeAdminLogSession.date);
});
$('#admin-log-account-filter')?.addEventListener('change', () => {
  renderSessionAdminLogDialogContent();
});
$('#admin-log-search-input')?.addEventListener('input', () => {
  renderSessionAdminLogDialogContent();
});
$('#copy-admin-log-text-btn')?.addEventListener('click', () => {
  const txt = document.getElementById('admin-log-text-output')?.textContent || '';
  copyTextToClipboardWithToast(txt, 'Nhật ký Admin Log');
});
$('#export-admin-log-excel-btn')?.addEventListener('click', () => {
  const txt = document.getElementById('admin-log-text-output')?.textContent || '';
  const cVal = document.getElementById('admin-log-class-filter')?.value || 'TatCaLop';
  const sVal = document.getElementById('admin-log-session-filter')?.value || 'TatCaCa';
  downloadPlainTextFile(txt, `Admin-Log-${cVal}-${sVal}.txt`);
});

// Management Panel (#mgmt-panel-admin-log) filters & buttons
$('#mgmt-admin-log-class-filter')?.addEventListener('change', (e) => {
  renderManagementAdminLogPanel(e.target.value, 'all');
});
$('#mgmt-admin-log-session-filter')?.addEventListener('change', (e) => {
  renderManagementAdminLogPanel(null, e.target.value);
});
$('#mgmt-admin-log-account-filter')?.addEventListener('change', () => {
  renderManagementAdminLogPanel();
});
$('#mgmt-admin-log-search-input')?.addEventListener('input', () => {
  renderManagementAdminLogPanel();
});
$('#mgmt-copy-admin-log-btn')?.addEventListener('click', () => {
  const txt = document.getElementById('mgmt-admin-log-text-output')?.textContent || '';
  copyTextToClipboardWithToast(txt, 'Nhật ký Admin Log');
});
$('#mgmt-download-admin-log-txt-btn')?.addEventListener('click', () => {
  const txt = document.getElementById('mgmt-admin-log-text-output')?.textContent || '';
  const cVal = document.getElementById('mgmt-admin-log-class-filter')?.value || 'TatCaLop';
  const sVal = document.getElementById('mgmt-admin-log-session-filter')?.value || 'TatCaCa';
  downloadPlainTextFile(txt, `Admin-Log-${cVal}-${sVal}.txt`);
});
