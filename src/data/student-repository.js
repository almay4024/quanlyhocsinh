// Storage boundary for student records. Synchronizes automatically via localStorage + realtime-sync.js.
const STUDENTS_KEY = 'lopvui.students.v9';
const MAKEUP_KEY = 'lopvui.makeup-students.v1';

const getStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

const read = (key, fallback, storage = getStorage()) => {
  try {
    if (!storage) return fallback;
    return JSON.parse(storage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const splitName = student => {
  const parts = String(student.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    familyName: student.familyName ?? parts.slice(0, -1).join(' '),
    givenName: student.givenName ?? (parts.at(-1) || '')
  };
};

export const seedStudents = [];

export const seedMakeupStudents = [];

export function loadStudentRecords(currentClassId, storage = getStorage()) {
  let stored = read(STUDENTS_KEY, null, storage);
  let makeup = read(MAKEUP_KEY, null, storage);

  if (!Array.isArray(stored)) {
    stored = [];
  }
  if (!Array.isArray(makeup)) {
    makeup = structuredClone(seedMakeupStudents);
  }

  const regular = stored.filter(student => {
    if (!student || student.studentType === 'makeup') return false;
    const sc = String(student.studentCode || '').trim().toUpperCase();
    const sch = String(student.school || '').trim();
    // Purge corrupted single record where "HỌC" was mapped into studentCode or Date was mapped into school
    if (sc === 'HỌC' || sc === 'HOC' || sc === 'NGHỈ' || sc === 'TẠM NGHỈ') return false;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(sch) && /^[A-Za-z0-9._-]{3,16}$/.test(String(student.familyName || '').trim())) return false;
    return true;
  }).map(student => ({
    ...student,
    enrollmentStatus: student.enrollmentStatus || 'Học'
  }));

  const legacyMakeup = stored.filter(student => student && student.studentType === 'makeup').map(student => ({
    ...student,
    sourceClassName: student.sourceClassName || student.school || 'T2',
    attendingClassId: student.attendingClassId || currentClassId,
      attendingSessionDate: student.attendingSessionDate || student.attendanceHistory?.[0]?.date || student.sessionNotes?.[0]?.date || student.scores?.[0]?.date || null,
    classIds: []
  }));

  const normalized = regular.map((student) => {
    const studentCode = (student.studentCode && String(student.studentCode).trim())
      ? String(student.studentCode).trim().toUpperCase()
      : null;

    const seedMatch = seedStudents.find(s => s.id === student.id);
    const attHist = Array.isArray(student.attendanceHistory) ? [...student.attendanceHistory] : (Array.isArray(student.history) ? [...student.history] : []);
    const sessNotes = Array.isArray(student.sessionNotes) ? [...student.sessionNotes] : [];
    const scoreList = Array.isArray(student.scores) ? [...student.scores] : [];
    const seatHist = Array.isArray(student.seatingHistory) ? [...student.seatingHistory] : [];

    if (seedMatch) {
      (seedMatch.attendanceHistory || []).forEach(sh => {
        if (!attHist.some(h => h.date === sh.date && h.classId === sh.classId)) attHist.push(sh);
      });
      (seedMatch.sessionNotes || []).forEach(sn => {
        if (!sessNotes.some(n => n.date === sn.date && n.classId === sn.classId)) sessNotes.push(sn);
      });
      (seedMatch.scores || []).forEach(sc => {
        if (!scoreList.some(s => s.date === sc.date && s.classId === sc.classId && s.type === sc.type)) scoreList.push(sc);
      });
      (seedMatch.seatingHistory || []).forEach(seat => {
        if (!seatHist.some(s => s.date === seat.date && s.classId === seat.classId)) seatHist.push(seat);
      });
    }

    return {
      ...student,
      ...splitName(student),
      studentCode,
      classIds: Array.isArray(student.classIds) ? student.classIds : (currentClassId ? [currentClassId] : []),
      parentContact: {
        name: student.parentContact?.name || '',
        phone: student.parentContact?.phone || ''
      },
      photoURL: student.photoURL || null,
      courseIds: student.courseIds || [],
      attendanceHistory: attHist,
      seatingHistory: seatHist,
      sessionNotes: sessNotes,
      scores: scoreList,
      notes: student.notes || [],
      tags: (Array.isArray(student.tags) && student.tags.length) ? student.tags : (seedMatch?.tags?.length ? [...seedMatch.tags] : (student.isNew && Date.now() - (student.createdAt || 0) < 21 * 86400000 ? ['Mới'] : [])),
      learningNotes: student.learningNotes || seedMatch?.learningNotes || ''
    };
  });

  const makeupRecords = [...(Array.isArray(makeup) ? makeup : []), ...legacyMakeup].filter(Boolean).map((student) => {
    const studentCode = (student.studentCode && String(student.studentCode).trim())
      ? String(student.studentCode).trim().toUpperCase()
      : null;

    const seedMk = seedMakeupStudents.find(s => s.id === student.id);
    const attHist = Array.isArray(student.attendanceHistory) ? [...student.attendanceHistory] : (Array.isArray(student.history) ? [...student.history] : []);
    const seatHist = Array.isArray(student.seatingHistory) ? [...student.seatingHistory] : [];
    const sessNotes = Array.isArray(student.sessionNotes) ? [...student.sessionNotes] : [];
    const scoreList = Array.isArray(student.scores) ? [...student.scores] : [];

    if (seedMk) {
      (seedMk.sessionNotes || []).forEach(sn => {
        if (!sessNotes.some(n => n.date === sn.date && n.classId === sn.classId)) sessNotes.push(sn);
      });
      (seedMk.scores || []).forEach(sc => {
        if (!scoreList.some(s => s.date === sc.date && s.classId === sc.classId && s.type === sc.type)) scoreList.push(sc);
      });
    }

    return {
      ...student,
      ...splitName(student),
      studentCode,
      sourceClassName: student.sourceClassName || student.school || 'T2',
      attendingClassId: student.attendingClassId || currentClassId,
      attendingSessionDate: student.attendingSessionDate || student.attendanceHistory?.[0]?.date || student.sessionNotes?.[0]?.date || student.scores?.[0]?.date || null,
      parentContact: {
        name: student.parentContact?.name || '',
        phone: student.parentContact?.phone || ''
      },
      photoURL: student.photoURL || null,
      courseIds: student.courseIds || [],
      attendanceHistory: attHist,
      seatingHistory: seatHist,
      sessionNotes: sessNotes,
      scores: scoreList,
      notes: student.notes || [],
      tags: Array.isArray(student.tags) ? student.tags : [],
      learningNotes: student.learningNotes || seedMk?.learningNotes || '',
      studentType: 'makeup',
      classIds: []
    };
  });

  if (legacyMakeup.length && storage) {
    storage.setItem(STUDENTS_KEY, JSON.stringify(normalized));
    storage.setItem(MAKEUP_KEY, JSON.stringify(makeupRecords));
  }

  const photoStore = loadPhotoStore(storage);
  normalized.forEach(s => hydrateStudentPhoto(s, photoStore));
  makeupRecords.forEach(s => hydrateStudentPhoto(s, photoStore));
  return { students: normalized, makeupStudents: makeupRecords };
}

const PHOTOS_KEY = 'lopvui.student-photos.v1';

function loadPhotoStore(storage = getStorage()) {
  try {
    if (!storage) return {};
    return JSON.parse(storage.getItem(PHOTOS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function sanitizeStudentForStorage(s, photoStore) {
  if (!s || typeof s !== 'object') return null;
  const copy = { ...s };
  // Strip transient per-session UI state, duplicate history alias, and heavy full-size Base64 image
  delete copy.attendance;
  delete copy.homework;
  delete copy.testScore;
  delete copy.arrivalTime;
  delete copy.lateMinutes;
  delete copy.history;
  delete copy.photoFullURL;

  copy.studentCode = (copy.studentCode && String(copy.studentCode).trim())
    ? String(copy.studentCode).trim().toUpperCase()
    : null;

  // Prune stale CRDT tombstones older than 60 days so student objects don't bloat over time
  const tombCutoff = Date.now() - 60 * 86400000;
  for (const field of ['_deletedScores', '_removedAttendanceDates', '_removedSeatingDates']) {
    if (copy[field] && typeof copy[field] === 'object') {
      const pruned = {};
      for (const [k, ts] of Object.entries(copy[field])) {
        if ((Number(ts) || 0) >= tombCutoff) pruned[k] = ts;
      }
      if (Object.keys(pruned).length) copy[field] = pruned;
      else delete copy[field];
    }
  }

  // Nếu học sinh đã có ảnh trên Google Drive (photoDriveFileId), chỉ lưu link Drive nhẹ, xoá ảnh Base64 nặng
  if (copy.photoDriveFileId) {
    copy.photoURL = `https://drive.google.com/thumbnail?id=${encodeURIComponent(copy.photoDriveFileId)}&sz=w600`;
    delete photoStore[copy.id];
    copy.hasStoredPhoto = false;
  } else if (copy.photoURL && String(copy.photoURL).startsWith('data:image/')) {
    photoStore[copy.id] = copy.photoURL;
    copy.hasStoredPhoto = true;
    copy.photoURL = `@photo:${copy.id}`;
  } else if (!copy.photoURL) {
    delete photoStore[copy.id];
    copy.hasStoredPhoto = false;
  }
  copy.updatedAt = copy.updatedAt || Date.now();
  return copy;
}

export function hydrateStudentPhoto(student, photoStore) {
  if (!student) return student;
  if (student.photoURL && String(student.photoURL).startsWith('@photo:')) {
    const pid = String(student.photoURL).slice(7) || student.id;
    student.photoURL = photoStore[pid] || photoStore[student.id] || null;
  } else if (!student.photoURL && photoStore[student.id]) {
    student.photoURL = photoStore[student.id];
  }
  return student;
}

export function saveStudentRecords(students, makeupStudents, storage = getStorage()) {
  const photoStore = loadPhotoStore(storage);
  const prevPhotoJson = JSON.stringify(photoStore);
  const cleanStudents = (students || []).filter(Boolean).map(s => sanitizeStudentForStorage(s, photoStore)).filter(Boolean);
  const cleanMakeups = (makeupStudents || []).filter(Boolean).map(s => sanitizeStudentForStorage(s, photoStore)).filter(Boolean);

  if (storage) {
    try {
      const nextPhotoJson = JSON.stringify(photoStore);
      if (nextPhotoJson !== prevPhotoJson) {
        storage.setItem(PHOTOS_KEY, nextPhotoJson);
      }
    } catch {}
    storage.setItem(STUDENTS_KEY, JSON.stringify(cleanStudents));
    storage.setItem(MAKEUP_KEY, JSON.stringify(cleanMakeups));
  }
}


// ============================================================================
// GOOGLE DRIVE FULL-SIZE PORTRAIT INTEGRATION (v3.2)
// ============================================================================
const DRIVE_CONFIG_KEY = 'lopvui.google-drive-photo-config.v1';
const DRIVE_RENAME_QUEUE_KEY = 'lopvui.google-drive-rename-queue.v1';

export function loadGoogleDrivePhotoConfig(storage = getStorage()) {
  try {
    if (!storage) return { scriptUrl: '', folderId: '' };
    const saved = JSON.parse(storage.getItem(DRIVE_CONFIG_KEY) || 'null');
    if (saved && typeof saved === 'object') return { scriptUrl: saved.scriptUrl || '', folderId: saved.folderId || '' };
  } catch {}
  return { scriptUrl: '', folderId: '' };
}

export function saveGoogleDrivePhotoConfig(config, storage = getStorage()) {
  try {
    if (storage) {
      storage.setItem(DRIVE_CONFIG_KEY, JSON.stringify({
        scriptUrl: String(config?.scriptUrl || '').trim(),
        folderId: String(config?.folderId || '').trim(),
        updatedAt: Date.now()
      }));
    }
  } catch {}
}

export function toAsciiFileNamePart(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function extractGoogleDriveFileId(rawUrlOrId = '') {
  const s = String(rawUrlOrId || '').trim();
  if (!s || s.startsWith('data:image/') || s.startsWith('@photo:')) return null;
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(s)) return s;
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (m2) return m2[1];
  const m3 = s.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m3) return m3[1];
  return null;
}

export function buildDrivePhotoUrl(fileId, size = 'w600') {
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${encodeURIComponent(size)}`;
}

/**
 * Đặt tên file ảnh trên Google Drive chuẩn xác cho cả HS đã có mã, chưa có mã (CHUAMA) và học bù (HOCBU).
 * Kèm hậu tố 4 ký tự cuối của student.id để không bao giờ trùng tên file khi 2 HS trùng họ tên.
 */
export function buildStudentDrivePhotoFileName(student, classCatalog = []) {
  if (!student) return 'CHUAMA_HocSinh.jpg';
  const idRaw = String(student.id || '0000').replace(/[^a-zA-Z0-9]/g, '');
  const id4 = (idRaw.slice(-4) || '0000').toLowerCase();
  const cleanName = toAsciiFileNamePart(student.name || 'Hoc_Sinh') || 'Hoc_Sinh';

  const isMakeup = student.studentType === 'makeup';
  const rawCode = (student.studentCode && String(student.studentCode).trim())
    ? toAsciiFileNamePart(String(student.studentCode).trim().toUpperCase())
    : '';

  let classPart = '';
  if (isMakeup) {
    classPart = toAsciiFileNamePart(student.sourceClassName || student.school || 'LOP_GOC');
  } else {
    const firstClassId = Array.isArray(student.classIds) && student.classIds.length ? student.classIds[0] : '';
    const matchedCls = (classCatalog || []).find(c => c.id === firstClassId);
    classPart = toAsciiFileNamePart(matchedCls?.code || matchedCls?.name || firstClassId || 'CHUA_XEP_LOP');
  }

  const prefix = isMakeup
    ? 'HOCBU'
    : (rawCode ? rawCode : 'CHUAMA');

  return `${prefix}_${cleanName}_${classPart || 'LOP'}_${id4}.jpg`;
}

export function resolveStudentPhotoUrls(student) {
  if (!student) return { thumbUrl: null, fullUrl: null, driveFileId: null, driveFileName: null };
  const driveFileId = student.photoDriveFileId || extractGoogleDriveFileId(student.photoURL);
  if (driveFileId) {
    return {
      thumbUrl: buildDrivePhotoUrl(driveFileId, 'w600'),
      fullUrl: buildDrivePhotoUrl(driveFileId, 'w2400'),
      driveFileId,
      driveFileName: student.photoDriveFileName || buildStudentDrivePhotoFileName(student)
    };
  }
  const rawUrl = student.photoURL || null;
  return {
    thumbUrl: rawUrl,
    fullUrl: student.photoFullURL || rawUrl,
    driveFileId: null,
    driveFileName: student.photoDriveFileName || (rawUrl ? buildStudentDrivePhotoFileName(student) : null)
  };
}

/**
 * Tự động đổi tên file ảnh trên Google Drive khi học sinh được cập nhật Mã HS mới hoặc đổi Họ tên,
 * trong khi vẫn giữ nguyên 100% fileId và đường link hiển thị ảnh cũ.
 */
export async function syncStudentDrivePhotoRename(student, classCatalog = [], storage = getStorage()) {
  if (!student) return null;
  const newFileName = buildStudentDrivePhotoFileName(student, classCatalog);
  const oldFileName = student.photoDriveFileName || '';
  const hasPhoto = Boolean(student.photoURL || student.photoDriveFileId);
  if (!hasPhoto) return null;

  student.photoDriveFileName = newFileName;
  const driveFileId = student.photoDriveFileId || extractGoogleDriveFileId(student.photoURL);
  if (driveFileId) {
    student.photoDriveFileId = driveFileId;
    // Keep exact same Drive URL based on immutable fileId
    student.photoURL = buildDrivePhotoUrl(driveFileId, 'w600');
    student.photoFullURL = buildDrivePhotoUrl(driveFileId, 'w2400');
  }

  if (oldFileName && oldFileName === newFileName) {
    return { renamed: false, fileName: newFileName, fileId: driveFileId };
  }

  const cfg = loadGoogleDrivePhotoConfig(storage);
  if (driveFileId && cfg.scriptUrl) {
    try {
      await fetch(cfg.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'renameStudentPhoto',
          studentId: student.id,
          fileId: driveFileId,
          newFileName
        })
      });
      return { renamed: true, fileName: newFileName, fileId: driveFileId, remoteSynced: true };
    } catch {}
  }

  // Queue rename for next sync if offline or scriptUrl not yet connected
  if (driveFileId && storage) {
    try {
      const queue = JSON.parse(storage.getItem(DRIVE_RENAME_QUEUE_KEY) || '{}') || {};
      queue[student.id] = { fileId: driveFileId, newFileName, queuedAt: Date.now() };
      storage.setItem(DRIVE_RENAME_QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  }
  return { renamed: true, fileName: newFileName, fileId: driveFileId, remoteSynced: false };
}

/**
 * Upload ảnh Full-size gốc lên Google Drive thông qua Google Apps Script (nếu đã cấu hình),
 * đồng thời giữ bản xem nhanh để hiển thị tức thì.
 */
export async function uploadStudentPhotoToDrive(student, fullSizeDataUrl, previewDataUrl, classCatalog = [], storage = getStorage()) {
  if (!student) return null;
  const fileName = buildStudentDrivePhotoFileName(student, classCatalog);
  const oldFileId = student.photoDriveFileId || extractGoogleDriveFileId(student.photoURL) || null;
  student.photoDriveFileName = fileName;
  student.photoURL = previewDataUrl || fullSizeDataUrl;
  student.photoFullURL = previewDataUrl || fullSizeDataUrl;
  student.updatedAt = Date.now();

  const cfg = loadGoogleDrivePhotoConfig(storage);
  if (cfg.scriptUrl && fullSizeDataUrl) {
    try {
      const res = await fetch(cfg.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadStudentPhoto',
          studentId: student.id,
          fileName,
          oldFileId,
          folderId: cfg.folderId || '',
          dataUrl: fullSizeDataUrl
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.fileId) {
          student.photoDriveFileId = data.fileId;
          student.photoURL = buildDrivePhotoUrl(data.fileId, 'w600');
          student.photoFullURL = buildDrivePhotoUrl(data.fileId, 'w2400');
          return { uploadedToDrive: true, fileId: data.fileId, fileName };
        }
      }
    } catch {}
  }
  return { uploadedToDrive: false, fileId: oldFileId, fileName };
}
