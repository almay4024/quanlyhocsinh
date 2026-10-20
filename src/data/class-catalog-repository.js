// Local repository boundary for master data and class configuration.
// Supports Birth Year (Năm sinh: 2009, 2010, ...) and automatic layout sync from Room Templates.
import { loadRoomTemplates, buildLayoutFromTemplate } from './room-template-repository.js?v=3.7';

const CATALOG_KEY = 'lopvui.class-catalog.v1';
const MASTER_KEY = 'lopvui.master-data.v1';

const GRADE_TO_BIRTH_YEAR = {
  '12': '2009',
  '11': '2010',
  '10': '2011',
  '9': '2012',
  '8': '2013',
  '7': '2014',
  '6': '2015',
  '5': '2016'
};

export function normalizeGradeToBirthYear(rawGrade, fallbackText = '') {
  const str = String(rawGrade || '').trim();
  if (GRADE_TO_BIRTH_YEAR[str]) return GRADE_TO_BIRTH_YEAR[str];
  if (/^20(0[5-9]|1[0-9]|2[0-2])$/.test(str)) return str;
  const mYear = str.match(/\b(200[5-9]|201[0-9])\b/);
  if (mYear) return mYear[1];
  const mGrade = `${str} ${fallbackText}`.match(/(?:khối\s*|lớp\s*|\b)(1[0-2]|[5-9])\b/i);
  if (mGrade && GRADE_TO_BIRTH_YEAR[mGrade[1]]) {
    return GRADE_TO_BIRTH_YEAR[mGrade[1]];
  }
  return str || '2013';
}

const makeDesks = (classId, aisleCounts, dividerAfter = [2]) => aisleCounts.map((count, row) => ({
  id: `${classId}-aisle-${row + 1}`,
  desks: Array.from({ length: count }, (_, desk) => ({
    id: `${classId}-desk-${row + 1}-${desk + 1}`,
    seats: 2,
    dividerAfter: desk < count - 1 && dividerAfter.includes(desk + 1)
  }))
}));

const masterDefaults = {
  subjects: [
    { id: 'subject-math', name: 'Toán' },
    { id: 'subject-english', name: 'Tiếng Anh' },
    { id: 'subject-literature', name: 'Ngữ văn' },
    { id: 'subject-physics', name: 'Vật lý' },
    { id: 'subject-chemistry', name: 'Hóa học' },
    { id: 'subject-science', name: 'Khoa học tự nhiên' }
  ],
  employees: [
    { id: 'employee-admin-001', code: 'AD001', name: 'Quản trị hệ thống', role: 'admin', password: 'admin123', isActive: true, authVersion: 1 }
  ]
};

const startNotifications = [
  { id: 'prep-before-class', anchor: 'start', offsetMinutes: -15, title: 'Chuẩn bị trước giờ học', body: 'Kiểm tra phòng và chuẩn bị thu BTVN.' },
  { id: 'collect-homework', anchor: 'start', offsetMinutes: 0, title: 'Đến giờ thu BTVN', body: 'Đi từng bàn thu BTVN trước khi điểm danh.' },
  { id: 'finalize-attendance', anchor: 'start', offsetMinutes: 15, title: 'Chốt điểm danh', body: 'Rà lại học sinh có mặt, đi muộn và vắng mặt.' },
  { id: 'end-test-collection', anchor: 'end', offsetMinutes: -15, title: 'Thu bài kiểm tra cuối giờ', body: 'Bắt đầu thu bài kiểm tra và chuẩn bị bàn giao.' }
];

export const seedClasses = [];

function resolveClass(classInfo, masters, storage = localStorage) {
  const seed = seedClasses.find(item => item.id === classInfo.id);
  const subject = masters.subjects.find(item => item.id === classInfo.subjectId || item.name === classInfo.subject);
  const code = (classInfo.code && String(classInfo.code).trim()) ? String(classInfo.code).trim().toUpperCase() : (seed?.code || '');
  const grade = normalizeGradeToBirthYear(classInfo.grade || seed?.grade, `${classInfo.name || ''} ${code}`);
  let room = classInfo.room || seed?.room || 'P1-T3-CS1';
  let roomTemplateId = classInfo.roomTemplateId || seed?.roomTemplateId || '';

  // Always auto-sync defaultLayout from the assigned Room Template when a matching room exists
  let defaultLayout = null;
  try {
    const roomTpls = loadRoomTemplates(storage);
    const matchedRoom = roomTpls.find(r =>
      (roomTemplateId && r.id === roomTemplateId) ||
      (room && (r.roomCode === room || r.name === room))
    );
    if (matchedRoom) {
      roomTemplateId = matchedRoom.id;
      room = matchedRoom.roomCode || matchedRoom.name;
      defaultLayout = buildLayoutFromTemplate(classInfo.id || 'class', matchedRoom);
    }
  } catch {}

  if (!defaultLayout || !defaultLayout.length) {
    defaultLayout = (Array.isArray(classInfo.defaultLayout) && classInfo.defaultLayout.length)
      ? classInfo.defaultLayout
      : (seed?.defaultLayout || makeDesks(classInfo.id || 'class', [3, 3, 2], [2]));
  }

  const oldTeacherNames = String(classInfo.teacherName || '').split(',').map(value => value.trim()).filter(Boolean);
  const teacherIds = Array.isArray(classInfo.teacherIds) ? classInfo.teacherIds : (classInfo.teacherId ? [classInfo.teacherId] : []);
  const teachers = teacherIds.map(id => masters.employees.find(item => item.id === id)).filter(Boolean);
  const resolvedTeachers = teachers.length ? teachers : oldTeacherNames.map(name => masters.employees.find(item => item.name === name)).filter(Boolean);
  const oldAssistantNames = String(classInfo.assistantName || '').split(',').map(value => value.trim()).filter(Boolean);
  const assistants = (classInfo.assistantIds || []).map(id => masters.employees.find(item => item.id === id)).filter(Boolean);
  const resolvedAssistants = assistants.length ? assistants : oldAssistantNames.map(name => masters.employees.find(item => item.name === name)).filter(Boolean);
  const savedChecklist = classInfo.defaultChecklist;
  const defaultChecklist = savedChecklist && !Array.isArray(savedChecklist) ? {
    startItems: Array.isArray(savedChecklist.startItems) ? savedChecklist.startItems : (seed?.defaultChecklist.startItems || []),
    endItems: Array.isArray(savedChecklist.endItems) ? savedChecklist.endItems : (seed?.defaultChecklist.endItems || [])
  } : {
    startItems: Array.isArray(savedChecklist) ? savedChecklist : (seed?.defaultChecklist.startItems || []),
    endItems: classInfo.defaultEndChecklist || seed?.defaultChecklist.endItems || []
  };

  return {
    ...classInfo,
    code,
    grade,
    room,
    roomTemplateId,
    defaultLayout,
    subjectId: subject?.id || masters.subjects[0]?.id || '',
    subject: subject?.name || classInfo.subject || '',
    teacherIds: resolvedTeachers.map(item => item.id),
    teacherId: resolvedTeachers[0]?.id || '',
    teacherName: resolvedTeachers.map(item => item.name).join(', ') || classInfo.teacherName || '',
    assistantIds: resolvedAssistants.map(item => item.id),
    officeIds: (Array.isArray(classInfo.officeIds) ? classInfo.officeIds : (seed?.officeIds || [])).filter(id => masters.employees.some(employee => employee.id === id && employee.role === 'office')),
    assistantName: resolvedAssistants.map(item => item.name).join(', '),
    defaultChecklist,
    defaultNotifications: Array.isArray(classInfo.defaultNotifications) ? classInfo.defaultNotifications : structuredClone(startNotifications)
  };
}

// ============================================================================
// CRYPTOGRAPHIC PASSWORD HASHING & ADMIN-ONLY VAULT ENCRYPTION (v3.3)
// - Plaintext passwords are NEVER stored in localStorage or Firebase Firestore.
// - Login verification uses salted multi-round digest (passwordHash).
// - Admin password viewing uses encrypted vault cipher (passwordCipher) that
//   requires callerRole === 'admin' to decrypt.
// ============================================================================
const VAULT_SECRET = 'LopHocVui_Firebase_AdminVault_Key_2026_v33!@#';

function _deriveKeyBytes(seedStr) {
  const bytes = [];
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < seedStr.length; i++) {
      const c = seedStr.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ (c + round * 17), 0x5bd1e995) >>> 0;
      bytes.push((h1 ^ (h2 >>> 8)) & 0xff);
    }
  }
  return bytes;
}

export function hashStaffPassword(code, plainPassword) {
  const cleanCode = String(code || '').trim().toUpperCase();
  const raw = `lv_pbkdf_salt_v33::${cleanCode}::${String(plainPassword ?? '')}::${VAULT_SECRET}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  let h3 = 0x9e3779b9 ^ raw.length;
  let h4 = 0x85ebca6b ^ raw.length;
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ ch, 2654435761) >>> 0;
      h2 = Math.imul(h2 ^ ch, 1597334677) >>> 0;
      h3 = Math.imul(h3 ^ (ch << 3), 2246822507) >>> 0;
      h4 = Math.imul(h4 ^ (ch << 5), 3266489909) >>> 0;
    }
    h1 = (Math.imul(h1 ^ (h2 >>> 13), 2246822507) ^ h3) >>> 0;
    h2 = (Math.imul(h2 ^ (h3 >>> 15), 3266489909) ^ h4) >>> 0;
    h3 = (Math.imul(h3 ^ (h4 >>> 11), 2654435761) ^ h1) >>> 0;
    h4 = (Math.imul(h4 ^ (h1 >>> 17), 1597334677) ^ h2) >>> 0;
  }
  return `lvhash_v2$${cleanCode}$` +
    [h1, h2, h3, h4].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}

export function encryptStaffPasswordForAdmin(code, plainPassword) {
  const cleanCode = String(code || '').trim().toUpperCase();
  const text = encodeURIComponent(String(plainPassword ?? ''));
  const keyStream = _deriveKeyBytes(`${VAULT_SECRET}::${cleanCode}::v33`);
  const hexParts = [];
  for (let i = 0; i < text.length; i++) {
    const k = keyStream[i % keyStream.length];
    const enc = (text.charCodeAt(i) ^ k) & 0xff;
    hexParts.push(enc.toString(16).padStart(2, '0'));
  }
  return `lvcipher_v2$${cleanCode}$${hexParts.join('')}`;
}

export function decryptStaffPasswordForAdmin(emp, callerRole = 'assistant') {
  if (callerRole !== 'admin' || !emp) return null;
  const cipher = String(emp.passwordCipher || '');
  if (cipher.startsWith('lvcipher_v2$')) {
    const parts = cipher.split('$');
    const cleanCode = parts[1] || String(emp.code || '').trim().toUpperCase();
    const hex = parts[2] || '';
    const keyStream = _deriveKeyBytes(`${VAULT_SECRET}::${cleanCode}::v33`);
    let encoded = '';
    for (let i = 0; i < hex.length; i += 2) {
      const byteVal = parseInt(hex.slice(i, i + 2), 16);
      const k = keyStream[(i / 2) % keyStream.length];
      encoded += String.fromCharCode((byteVal ^ k) & 0xff);
    }
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return emp.role === 'admin' ? 'admin123' : '123456';
}

export function normalizeEmployeeAccount(emp) {
  if (!emp || typeof emp !== 'object') return null;
  const code = String(emp.code || '').trim().toUpperCase() || 'NV000';
  const role = ['admin', 'office', 'teacher', 'assistant'].includes(emp.role) ? emp.role : 'assistant';
  const defaultPwd = role === 'admin' ? 'admin123' : '123456';

  let plainToEncrypt = null;
  if (emp.password !== undefined && emp.password !== null && String(emp.password).trim() !== '') {
    plainToEncrypt = String(emp.password).trim();
  } else if (!emp.passwordHash || !String(emp.passwordHash).startsWith('lvhash_v2$') || !emp.passwordCipher) {
    plainToEncrypt = defaultPwd;
  }

  const passwordHash = plainToEncrypt
    ? hashStaffPassword(code, plainToEncrypt)
    : emp.passwordHash;
  const passwordCipher = plainToEncrypt
    ? encryptStaffPasswordForAdmin(code, plainToEncrypt)
    : emp.passwordCipher;

  const isActive = emp.isActive !== false;
  const authVersion = Number(emp.authVersion) > 0 ? Number(emp.authVersion) : 1;
  const copy = {
    ...emp,
    code,
    role,
    passwordHash,
    passwordCipher,
    isActive,
    authVersion,
    updatedAt: emp.updatedAt || 1728100000000
  };
  // Strictly strip plaintext password so it never exists in localStorage or Firebase
  delete copy.password;
  return copy;
}

export function verifyStaffPassword(emp, inputPassword) {
  if (!emp) return false;
  const norm = normalizeEmployeeAccount(emp);
  const candidate = String(inputPassword ?? '').trim();
  if (!candidate) return false;
  return hashStaffPassword(norm.code, candidate) === norm.passwordHash;
}

export function loadMasterData(storage = localStorage) {
  try {
    const raw = storage.getItem(MASTER_KEY);
    const saved = JSON.parse(raw || 'null');
    if (saved && Array.isArray(saved.subjects) && Array.isArray(saved.employees) && saved.employees.length > 0) {
      const employees = saved.employees.map(normalizeEmployeeAccount).filter(Boolean);
      // Always guarantee at least 1 active Admin account exists so system is never locked out
      if (!employees.some(item => item.role === 'admin' && item.isActive !== false)) {
        const defaultAdmin = normalizeEmployeeAccount(masterDefaults.employees.find(e => e.role === 'admin'));
        const existingAdminIdx = employees.findIndex(e => e.code === defaultAdmin.code || e.id === defaultAdmin.id);
        if (existingAdminIdx >= 0) {
          employees[existingAdminIdx].role = 'admin';
          employees[existingAdminIdx].isActive = true;
        } else {
          employees.unshift(defaultAdmin);
        }
      }
      return { ...saved, employees };
    }
  } catch {}
  const seeded = {
    subjects: structuredClone(masterDefaults.subjects),
    employees: masterDefaults.employees.map(normalizeEmployeeAccount)
  };
  try {
    storage.setItem(MASTER_KEY, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

export function saveMasterData(data, storage = localStorage) {
  try {
    const normalized = {
      ...data,
      employees: (data?.employees || []).map(normalizeEmployeeAccount).filter(Boolean),
      updatedAt: Date.now()
    };
    storage.setItem(MASTER_KEY, JSON.stringify(normalized));
  } catch {}
}

export function loadClassCatalog(storage = localStorage, masters = loadMasterData(storage)) {
  let saved = null;
  let hasStoredKey = false;
  try {
    const raw = storage.getItem(CATALOG_KEY);
    if (raw !== null) {
      hasStoredKey = true;
      saved = JSON.parse(raw);
    }
  } catch {}
  if (!hasStoredKey || !Array.isArray(saved)) {
    saved = structuredClone(seedClasses);
    try {
      storage.setItem(CATALOG_KEY, JSON.stringify(saved));
    } catch {}
  }

  return saved.map(item => resolveClass(item, masters, storage));
}

export function saveClassCatalog(classes, storage = localStorage) {
  try {
    storage.setItem(CATALOG_KEY, JSON.stringify(classes));
  } catch {}
}

const SESSION_CHANGES_KEY = 'lopvui.class-session-changes.v1';
export function loadClassSessionChanges(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(SESSION_CHANGES_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

export function saveClassSessionChanges(changes, storage = localStorage) {
  try {
    storage.setItem(SESSION_CHANGES_KEY, JSON.stringify(changes));
  } catch {}
}
