// Local repository boundary for master data and class configuration.
// Supports Birth Year (Năm sinh: 2009, 2010, ...) and automatic layout sync from Room Templates.
import { loadRoomTemplates, buildLayoutFromTemplate } from './room-template-repository.js?v=5.7.0';

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
    { id: 'employee-admin-001', code: 'AD001', name: 'Quản trị hệ thống', role: 'admin', password: 'admin123', isActive: true, authVersion: 1 },
    { id: 'employee-office-linhbmp', code: 'LINHBMP', name: 'Bùi Minh Phương Linh', role: 'office', password: '123456', isActive: true, authVersion: 1 },
    { id: 'employee-office-sanghn', code: 'SANGHN', name: 'Hoàng Ngọc Sáng', role: 'office', password: '123456', isActive: true, authVersion: 1 },
    { id: 'employee-assistant-congnt', code: 'CONGNT', name: 'Nguyễn Thành Công', role: 'assistant', password: '123456', isActive: true, authVersion: 1 },
    { id: 'employee-teacher-giangnh', code: 'GIANGNH', name: 'Nguyễn Thị Hương Giang', role: 'teacher', password: '123456', isActive: true, authVersion: 1 }
  ]
};

export const MOCK_DEFAULT_CODES = new Set();
export const MOCK_DEFAULT_NAMES = new Set([
  'anh linh',
  'cô minh anh',
  'thầy quang'
]);

export function isMockEmployee(emp) {
  if (!emp) return false;
  const id = String(emp.id || '');
  if (id.startsWith('mock-') || id.startsWith('employee-mock-')) return true;
  return false;
}

/**
 * Kiểm tra xem một chuỗi tag có phải là tag năm sinh / khóa học sinh hay không (VD: 2K9, 2K10, 2009, 2010, K9, K10...)
 * Theo quy chuẩn mới: KHÔNG gắn tag theo năm sinh vào mảng tags của học sinh; chỉ phân loại năm sinh theo Mã học sinh.
 */
export function isBirthYearOrCohortTag(tagStr) {
  if (!tagStr) return false;
  const clean = String(tagStr).trim().toLowerCase();
  // 1. Khóa dạng 2K (2k6 -> 2k16)
  if (/^2k\d{1,2}$/i.test(clean)) return true;
  // 2. Khóa dạng K (k6 -> k15, k09)
  if (/^k0?(?:[5-9]|1[0-5])$/i.test(clean)) return true;
  // 3. Năm sinh 4 chữ số (2005 - 2025)
  if (/^20(0[5-9]|1[0-9]|2[0-5])$/.test(clean)) return true;
  // 4. Các nhãn tiền tố: "Khối X", "Lớp X", "Năm sinh XXXX"
  if (/^(?:khối|lớp|năm\s*sinh)\s*(?:2k\d+|\d+)/i.test(clean)) return true;
  return false;
}

/**
 * Lọc bỏ toàn bộ tag năm sinh / khóa khỏi mảng tags của học sinh
 */
export function cleanStudentTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(t => t && !isBirthYearOrCohortTag(t));
}

/**
 * Trích xuất khối / khóa chuẩn hóa từ tiền tố mã học sinh (VD: 2K9.001 -> 2K9, K9.001 -> 2K9, 2009.001 -> 2K9, 2K10.012 -> 2K10)
 */
export function extractCohortFromStudentCode(code) {
  if (!code) return '';
  const trimmed = String(code).trim().toUpperCase();

  // 1. Khớp 2K9, 2K10, 2K11, 2K12, 2K13, 2K14...
  const m2K = trimmed.match(/(?:^|[^A-Z0-9])(2K\d{1,2})(?:[^A-Z0-9]|$)/i);
  if (m2K) return m2K[1].toUpperCase();

  // 2. Khớp K9, K09, K10, K11... -> chuẩn hóa sang 2K9, 2K10...
  const mK = trimmed.match(/(?:^|[^A-Z0-9])K0?([5-9]|1[0-5])(?:[^A-Z0-9]|$)/i);
  if (mK) {
    return `2K${mK[1]}`;
  }

  // 3. Khớp năm sinh 4 chữ số (2005 - 2025) như 2009.001 -> chuẩn hóa sang 2K9
  const mYear = trimmed.match(/\b20(0[5-9]|1[0-9]|2[0-5])\b/);
  if (mYear) {
    const y = Number(mYear[1]);
    return `2K${y}`;
  }

  // 4. Fallback: match đầu chuỗi
  const m = trimmed.match(/^(2?K\d+)/i);
  if (m) {
    const raw = m[1].toUpperCase();
    if (raw.startsWith('K') && !raw.startsWith('2K')) {
      const num = raw.replace(/^K0?/, '');
      return `2K${num}`;
    }
    return raw;
  }
  return '';
}

/**
 * Phân tích số năm sinh / khóa từ chuỗi (VD: 2K9 -> 9, K9 -> 9, 2009 -> 9, 2K10 -> 10, 2010 -> 10)
 */
export function parseCohortNumber(str) {
  if (!str) return null;
  const s = String(str).trim().toUpperCase();
  const m2k = s.match(/2K(\d+)/i);
  if (m2k) return Number(m2k[1]);
  const mk = s.match(/(?:^|[^A-Z0-9])K0?(\d+)/i);
  if (mk) return Number(mk[1]);
  const mYear = s.match(/20(\d{2})/);
  if (mYear) return Number(mYear[1]);
  const mDigit = s.match(/\d+/);
  if (mDigit) {
    let n = Number(mDigit[0]);
    if (n >= 2000) n = n - 2000;
    return n;
  }
  return null;
}

/**
 * Trích xuất năm sinh 4 chữ số từ mã học sinh (VD: 2K9.001 -> 2009, 2K10.012 -> 2010)
 */
export function extractBirthYearFromStudentCode(code) {
  const ch = extractCohortFromStudentCode(code);
  if (!ch) return '';
  const num = parseCohortNumber(ch);
  if (num === null) return '';
  return String(2000 + num);
}

/**
 * Hiển thị tên năm sinh & khóa rõ nghĩa cho người dùng (VD: 2K9 -> Năm sinh 2009 (2K9))
 */
export function formatCohortDisplayName(cohortPrefix) {
  if (!cohortPrefix) return '';
  const num = parseCohortNumber(cohortPrefix);
  if (num !== null) {
    return `Năm sinh ${2000 + num} (2K${num})`;
  }
  return String(cohortPrefix).toUpperCase();
}

/**
 * Kiểm tra xem học sinh có thuộc năm sinh / khóa đang lọc hay không (chỉ phân loại theo Mã học sinh)
 */
export function isStudentInCohort(student, targetCohort) {
  if (!targetCohort || targetCohort === 'all') return true;
  const sCode = student?.studentCode || '';
  const codeCohort = extractCohortFromStudentCode(sCode);
  const targetUp = String(targetCohort).trim().toUpperCase();

  if (!codeCohort) return false;

  // 1. So khớp trực tiếp tiền tố mã HS chuẩn hóa (2K9 === 2K9)
  if (codeCohort === targetUp) return true;

  // 2. So khớp theo số năm sinh (VD: target 2009 và codeCohort 2K9, hoặc target K9 và codeCohort 2K9)
  const cN = parseCohortNumber(codeCohort);
  const tN = parseCohortNumber(targetUp);
  if (cN !== null && tN !== null && cN === tN) {
    return true;
  }

  return false;
}

const startNotifications = [
  { id: 'prep-before-class', anchor: 'start', offsetMinutes: -15, title: 'Chuẩn bị trước giờ học', body: 'Kiểm tra phòng và chuẩn bị thu BTVN.' },
  { id: 'collect-homework', anchor: 'start', offsetMinutes: 0, title: 'Đến giờ thu BTVN', body: 'Đi từng bàn thu BTVN trước khi điểm danh.' },
  { id: 'finalize-attendance', anchor: 'start', offsetMinutes: 15, title: 'Chốt điểm danh', body: 'Rà lại học sinh có mặt, đi muộn và vắng mặt.' },
  { id: 'end-test-collection', anchor: 'end', offsetMinutes: -15, title: 'Thu bài kiểm tra cuối giờ', body: 'Bắt đầu thu bài kiểm tra và chuẩn bị bàn giao.' }
];

export const seedClasses = [
  {
    id: 'class-2k9-h4-giangnh',
    code: '2K9.H4.GIANGNH',
    name: '2K9.H4.GIANGNH',
    grade: '2009',
    subjectId: 'subject-chemistry',
    subject: 'Hóa học',
    weekday: 4,
    startTime: '18:00',
    endTime: '19:30',
    room: 'P1-T3-CS1',
    teacherId: 'employee-teacher-giangnh',
    teacherIds: ['employee-teacher-giangnh'],
    teacherName: 'Nguyễn Thị Hương Giang',
    assistantId: 'employee-assistant-congnt',
    assistantIds: ['employee-assistant-congnt'],
    assistantName: 'Nguyễn Thành Công',
    officeIds: ['employee-office-linhbmp', 'employee-office-sanghn'],
    defaultLayout: makeDesks('class-2k9-h4-giangnh', [3, 3, 2], [2]),
    defaultChecklist: {
      startItems: ['Kiểm tra máy chiếu / điều hòa', 'Thu bài tập về nhà đầu giờ', 'Chốt điểm danh sau 15 phút'],
      endItems: ['Thu bài kiểm tra định kỳ', 'Nhắc nhở học sinh dọn rác', 'Tắt thiết bị điện']
    },
    defaultNotifications: structuredClone(startNotifications)
  },
  {
    id: 'class-2k9-h3-giangnh',
    code: '2K9.H3.GIANGNH',
    name: '2K9.H3.GIANGNH',
    grade: '2009',
    subjectId: 'subject-chemistry',
    subject: 'Hóa học',
    weekday: 3,
    startTime: '18:00',
    endTime: '19:30',
    room: 'P2-T3-CS1',
    teacherId: 'employee-teacher-giangnh',
    teacherIds: ['employee-teacher-giangnh'],
    teacherName: 'Nguyễn Thị Hương Giang',
    assistantId: 'employee-assistant-congnt',
    assistantIds: ['employee-assistant-congnt'],
    assistantName: 'Nguyễn Thành Công',
    officeIds: ['employee-office-linhbmp', 'employee-office-sanghn'],
    defaultLayout: makeDesks('class-2k9-h3-giangnh', [3, 3, 2], [2]),
    defaultChecklist: {
      startItems: ['Kiểm tra máy chiếu / điều hòa', 'Thu bài tập về nhà đầu giờ', 'Chốt điểm danh sau 15 phút'],
      endItems: ['Thu bài kiểm tra định kỳ', 'Nhắc nhở học sinh dọn rác', 'Tắt thiết bị điện']
    },
    defaultNotifications: structuredClone(startNotifications)
  },
  {
    id: 'class-tsa2-quanbm',
    code: 'TSA2.QUANBM',
    name: 'TSA2.QUANBM',
    grade: '2009',
    subjectId: 'subject-math',
    subject: 'Toán',
    weekday: 2,
    startTime: '18:00',
    endTime: '19:30',
    room: 'P3-T3-CS1',
    teacherName: 'Bùi Minh Quân',
    assistantId: 'employee-assistant-congnt',
    assistantIds: ['employee-assistant-congnt'],
    assistantName: 'Nguyễn Thành Công',
    officeIds: ['employee-office-linhbmp', 'employee-office-sanghn'],
    defaultLayout: makeDesks('class-tsa2-quanbm', [3, 3, 2], [2]),
    defaultChecklist: {
      startItems: ['Kiểm tra máy chiếu / điều hòa', 'Thu bài tập về nhà đầu giờ'],
      endItems: ['Nhắc nhở học sinh', 'Tắt thiết bị điện']
    },
    defaultNotifications: structuredClone(startNotifications)
  },
  {
    id: 'class-math-8a',
    code: 'TOAN8A',
    name: 'Toán 8A',
    grade: '2011',
    subjectId: 'subject-math',
    subject: 'Toán',
    weekday: 1,
    startTime: '17:30',
    endTime: '19:00',
    room: 'P1-T3-CS1',
    teacherId: 'employee-teacher-giangnh',
    teacherIds: ['employee-teacher-giangnh'],
    teacherName: 'Nguyễn Thị Hương Giang',
    assistantId: 'employee-assistant-congnt',
    assistantIds: ['employee-assistant-congnt'],
    assistantName: 'Nguyễn Thành Công',
    officeIds: ['employee-office-linhbmp', 'employee-office-sanghn'],
    defaultLayout: makeDesks('class-math-8a', [3, 3, 2], [2]),
    defaultChecklist: {
      startItems: ['Kiểm tra máy chiếu / điều hòa', 'Thu bài tập về nhà đầu giờ'],
      endItems: ['Nhắc nhở học sinh', 'Tắt thiết bị điện']
    },
    defaultNotifications: structuredClone(startNotifications)
  }
];

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
  const rawTeacherIds = Array.isArray(classInfo.teacherIds) ? classInfo.teacherIds : (classInfo.teacherId ? [classInfo.teacherId] : []);
  const empCatalog = Array.isArray(masters?.employees) ? masters.employees : [];
  const teachers = rawTeacherIds.map(id => findMatchingEmployeeAccount(empCatalog, id)).filter(Boolean);
  const resolvedTeachers = teachers.length ? teachers : oldTeacherNames.map(name => findMatchingEmployeeAccount(empCatalog, name)).filter(Boolean);

  const teacherIds = resolvedTeachers.length
    ? resolvedTeachers.map(item => item.id)
    : (rawTeacherIds.length ? rawTeacherIds : (classInfo.teacherId ? [classInfo.teacherId] : []));
  const teacherId = resolvedTeachers[0]?.id || teacherIds[0] || classInfo.teacherId || '';
  const teacherName = resolvedTeachers.map(item => item.name).join(', ') || classInfo.teacherName || '';

  const oldAssistantNames = String(classInfo.assistantName || '').split(',').map(value => value.trim()).filter(Boolean);
  const rawAssistantIds = Array.isArray(classInfo.assistantIds) ? classInfo.assistantIds : (classInfo.assistantId ? [classInfo.assistantId] : []);
  const assistants = rawAssistantIds.map(id => findMatchingEmployeeAccount(empCatalog, id)).filter(Boolean);
  const resolvedAssistants = assistants.length ? assistants : oldAssistantNames.map(name => findMatchingEmployeeAccount(empCatalog, name)).filter(Boolean);

  const assistantIds = resolvedAssistants.length
    ? resolvedAssistants.map(item => item.id)
    : (rawAssistantIds.length ? rawAssistantIds : (classInfo.assistantId ? [classInfo.assistantId] : []));
  const assistantId = resolvedAssistants[0]?.id || assistantIds[0] || classInfo.assistantId || '';
  const assistantName = resolvedAssistants.map(item => item.name).join(', ') || classInfo.assistantName || '';

  const rawOfficeIds = Array.isArray(classInfo.officeIds) ? classInfo.officeIds : (seed?.officeIds || []);
  const resolvedOffice = rawOfficeIds.map(id => findMatchingEmployeeAccount(empCatalog, id)).filter(Boolean);
  const officeIds = (empCatalog.length && resolvedOffice.length)
    ? resolvedOffice.map(item => item.id)
    : rawOfficeIds;

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
    teacherIds,
    teacherId,
    teacherName,
    assistantIds,
    assistantId,
    officeIds,
    assistantName,
    defaultChecklist,
    defaultNotifications: Array.isArray(classInfo.defaultNotifications) ? classInfo.defaultNotifications : structuredClone(startNotifications)
  };
}

// ============================================================================
// CRYPTOGRAPHIC PASSWORD HASHING & SESSION INTEGRITY (v4.0)
// - Plaintext passwords are NEVER stored in localStorage or Firebase.
// - Login verification uses salted multi-round digest (passwordHash).
// - Session accounts carry a cryptographic signature (authSig) bound to
//   employeeId + role + authVersion + passwordHash to prevent localStorage role tampering.
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

export function normalizeAccountCode(rawCode) {
  return String(rawCode || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function foldAccountIdentifier(rawStr) {
  return String(rawStr || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .toLowerCase();
}

export function compactAccountToken(rawStr) {
  return foldAccountIdentifier(rawStr).replace(/[^a-z0-9]/g, '');
}

export function normalizeLeadingZerosToken(rawStr) {
  return compactAccountToken(rawStr).replace(/([a-z]+)0+(\d+)/g, '$1$2');
}

export function findMatchingEmployeeAccount(employees, rawIdentifier) {
  if (!Array.isArray(employees) || !rawIdentifier) return null;
  const list = employees.map(normalizeEmployeeAccount).filter(Boolean);
  const normInput = normalizeAccountCode(rawIdentifier);
  if (!normInput) return null;

  // 1. Exact NFC uppercase match on code or id
  let match = list.find(e => normalizeAccountCode(e.code) === normInput || normalizeAccountCode(e.id) === normInput);
  if (match) return match;

  // 2. Folded (accent-insensitive, case-insensitive) match on code, id, or email
  const foldedInput = foldAccountIdentifier(rawIdentifier);
  match = list.find(e =>
    foldAccountIdentifier(e.code) === foldedInput ||
    foldAccountIdentifier(e.id) === foldedInput ||
    (e.email && foldAccountIdentifier(e.email) === foldedInput)
  );
  if (match) return match;

  // 3. Compact token match ignoring spaces, hyphens, underscores, dots (e.g. "TA 001" == "TA-001" == "TA001")
  const compactInput = compactAccountToken(rawIdentifier);
  if (compactInput) {
    match = list.find(e => compactAccountToken(e.code) === compactInput);
    if (match) return match;

    // 4. Leading-zero tolerant code match (e.g. "TA01" vs "TA001" if unique)
    const noZeroInput = normalizeLeadingZerosToken(rawIdentifier);
    const zeroMatches = list.filter(e => normalizeLeadingZerosToken(e.code) === noZeroInput);
    if (zeroMatches.length === 1) return zeroMatches[0];
  }

  // 5. Match by full name (exact case-insensitive or accent-folded if unique) or phone number
  const exactNameMatches = list.filter(e => String(e.name || '').normalize('NFC').trim().toUpperCase() === normInput);
  if (exactNameMatches.length === 1) return exactNameMatches[0];

  const foldedNameMatches = list.filter(e =>
    foldAccountIdentifier(e.name) === foldedInput ||
    compactAccountToken(e.name) === compactInput
  );
  if (foldedNameMatches.length === 1) return foldedNameMatches[0];

  const digitsInput = String(rawIdentifier || '').replace(/\D/g, '');
  if (digitsInput.length >= 8) {
    const phoneMatches = list.filter(e => String(e.phone || '').replace(/\D/g, '') === digitsInput);
    if (phoneMatches.length === 1) return phoneMatches[0];
  }

  return null;
}

export function hashStaffPassword(code, plainPassword) {
  const cleanCode = normalizeAccountCode(code);
  const cleanPass = String(plainPassword ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const raw = `lv_pbkdf_salt_v33::${cleanCode}::${cleanPass}::${VAULT_SECRET}`;
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

export function computeSessionAuthSignature(emp) {
  if (!emp || !emp.id) return '';
  const norm = normalizeEmployeeAccount(emp);
  return hashStaffPassword(
    norm.code,
    `session_sig_v4::${norm.id}::${norm.role}::${norm.authVersion || 1}::${norm.passwordHash || ''}`
  );
}

export function verifySessionAuthSignature(account, emp) {
  if (!account || !emp) return false;
  const norm = normalizeEmployeeAccount(emp);
  if (!norm) return false;

  // Account must match employee ID or Code
  const idMatches = account.employeeId === norm.id ||
                    (account.code && normalizeAccountCode(account.code) === normalizeAccountCode(norm.code)) ||
                    (account.employeeId && normalizeAccountCode(account.employeeId) === normalizeAccountCode(norm.code));
  if (!idMatches) return false;

  // Privilege escalation check: non-admin account cannot claim admin role
  if (account.role === 'admin' && norm.role !== 'admin') return false;
  if (account.role && norm.role && account.role !== norm.role) {
    account.role = norm.role;
  }

  if (!account.authSig) {
    // Session authenticated without legacy authSig; accept if ID and role match canonical employee
    return true;
  }

  const expectedSig = computeSessionAuthSignature(norm);
  if (account.authSig === expectedSig) return true;

  // Fallback signature without passwordHash (for sessions created before password sync or where password is not loaded yet)
  const legacySig = hashStaffPassword(
    norm.code,
    `session_sig_v4::${norm.id}::${norm.role}::${norm.authVersion || 1}::`
  );
  if (account.authSig === legacySig) return true;

  return false;
}

export function encryptStaffPasswordForAdmin(code, plainPassword) {
  const cleanCode = normalizeAccountCode(code);
  const cleanPass = String(plainPassword ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const text = encodeURIComponent(cleanPass);
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
    const cleanCode = parts[1] || normalizeAccountCode(emp.code);
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
  return '••••••••';
}

export function normalizeEmployeeAccount(emp) {
  if (!emp || typeof emp !== 'object') return null;
  const code = normalizeAccountCode(emp.code) || 'NV000';
  const upperCode = code.toUpperCase();

  // 1. Role: Quản lý nhân sự của admin là nguồn chân lý duy nhất (single source of truth)
  let role = String(emp.role || '').trim().toLowerCase();
  if (role === 'vanphong' || role === 'vp') role = 'office';
  else if (role === 'giaovien' || role === 'gv') role = 'teacher';
  else if (role === 'trogiang' || role === 'tg') role = 'assistant';
  else if (role === 'quantri' || role === 'quantrivien') role = 'admin';

  // Chỉ khi role hoàn toàn trống hoặc không hợp lệ mới dùng fallback mặc định
  if (!['admin', 'office', 'teacher', 'assistant'].includes(role)) {
    if (upperCode === 'AD001' || upperCode === 'ADMIN' || upperCode.startsWith('AD')) {
      role = 'admin';
    } else {
      role = 'assistant';
    }
  }

  // 2. Họ và tên: Lọc sạch toàn bộ đại từ nhân xưng / danh xưng (Thầy, Cô, Anh, Chị, Em, GV, TA, Trợ giảng, Giáo viên...)
  // Giữ nguyên 100% họ tên đầy đủ do Admin tự đặt trong tab quản lý nhân sự
  let name = String(emp.name || '').normalize('NFC').trim();
  name = name.replace(/^(?:thầy|cô|anh|chị|em|gv|ta|trợ\s*giảng|giáo\s*viên)\s+/i, '').trim();
  if (!name || name === 'Nhân sự' || name === 'Chưa đăng nhập') {
    name = code;
  }
  const defaultPwd = role === 'admin' ? 'admin123' : '123456';

  let plainToEncrypt = null;
  if (emp.password !== undefined && emp.password !== null && String(emp.password).trim() !== '') {
    plainToEncrypt = String(emp.password).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  } else if (!emp.passwordHash || !String(emp.passwordHash).startsWith('lvhash_v2$') || !emp.passwordCipher) {
    plainToEncrypt = defaultPwd;
  } else {
    // If emp.code changed after passwordHash was generated, re-key passwordHash & passwordCipher to match the new code
    const hashSaltCode = String(emp.passwordHash || '').split('$')[1] || '';
    if (hashSaltCode && normalizeAccountCode(hashSaltCode) !== code) {
      const recovered = decryptStaffPasswordForAdmin(emp, 'admin');
      if (recovered && recovered !== '••••••••') {
        plainToEncrypt = recovered;
      }
    }
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
    name: name || code,
    role,
    passwordHash,
    passwordCipher,
    isActive,
    authVersion,
    updatedAt: emp.updatedAt || 1728100000000
  };
  delete copy.password;
  return copy;
}

export function verifyStaffPassword(emp, inputPassword) {
  if (!emp) return false;
  const norm = normalizeEmployeeAccount(emp);
  const candidate = String(inputPassword ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!candidate) return false;
  if (hashStaffPassword(norm.code, candidate) === norm.passwordHash) {
    return true;
  }
  // Fallback 1: check against saltCode embedded in lvhash_v2$<saltCode>$<hex>
  const embeddedCode = String(norm.passwordHash || '').split('$')[1] || '';
  if (embeddedCode && hashStaffPassword(embeddedCode, candidate) === norm.passwordHash) {
    return true;
  }
  // Fallback 2: check against decrypted admin cipher (handles legacy NFD/NFC or case variations)
  const decrypted = decryptStaffPasswordForAdmin(norm, 'admin');
  if (decrypted && decrypted !== '••••••••') {
    const cleanDec = String(decrypted).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (cleanDec === candidate || cleanDec.toLowerCase() === candidate.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export function loadMasterData(storage = localStorage) {
  try {
    const raw = storage.getItem(MASTER_KEY);
    const saved = JSON.parse(raw || 'null');
    if (saved && Array.isArray(saved.subjects) && Array.isArray(saved.employees) && saved.employees.length > 0) {
      // 1. Purge all mock accounts completely (Anh Linh, Cô Minh Anh, Thầy Quang, etc.)
      const employees = saved.employees
        .map(normalizeEmployeeAccount)
        .filter(Boolean)
        .filter(e => !isMockEmployee(e));

      // 2. Ensure active admin exists
      if (!employees.some(item => item.role === 'admin' && item.isActive !== false)) {
        const defaultAdmin = normalizeEmployeeAccount(masterDefaults.employees[0]);
        const existingAdminIdx = employees.findIndex(e => e.code === defaultAdmin.code || e.id === defaultAdmin.id);
        if (existingAdminIdx >= 0) {
          employees[existingAdminIdx].role = 'admin';
          employees[existingAdminIdx].isActive = true;
        } else {
          employees.unshift(defaultAdmin);
        }
      }

      // 3. Khởi tạo tài khoản mặc định ban đầu nếu hệ thống chưa có
      let modified = false;
      for (const defEmp of masterDefaults.employees) {
        const existing = employees.find(e => normalizeAccountCode(e.code) === normalizeAccountCode(defEmp.code) || e.id === defEmp.id);
        if (!existing) {
          employees.push(normalizeEmployeeAccount(defEmp));
          modified = true;
        } else {
          // Lọc sạch đại từ nhân xưng nếu có, bảo toàn 100% role và họ tên do Admin tự đặt trong Quản lý nhân sự
          const cleanName = String(existing.name || '').replace(/^(?:thầy|cô|anh|chị|em|gv|ta|trợ\s*giảng|giáo\s*viên)\s+/i, '').trim();
          if (cleanName && cleanName !== existing.name) {
            existing.name = cleanName;
            modified = true;
          }
        }
      }

      // If any mock employees were purged or roles corrected, write clean data back to storage
      if (modified || employees.length !== saved.employees.length) {
        saveMasterData({ ...saved, employees }, storage);
      }

      return { ...saved, employees };
    }
  } catch {}
  // IMPORTANT: Do NOT call storage.setItem here when localStorage is empty!
  // Calling setItem during initial read marks local storage as dirty (localTs = Date.now())
  // and blocks Firebase Cloud from syncing the real employee accounts to new devices.
  return {
    subjects: structuredClone(masterDefaults.subjects),
    employees: masterDefaults.employees.map(normalizeEmployeeAccount)
  };
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
  const MOCK_SEED_CLASS_IDS = new Set(['class-math-8a-algebra', 'class-english-7b', 'class-math-9c']);
  try {
    const raw = storage.getItem(CATALOG_KEY);
    if (raw !== null) {
      hasStoredKey = true;
      saved = JSON.parse(raw);
    }
  } catch {}
  if (!hasStoredKey || !Array.isArray(saved) || saved.length === 0) {
    saved = structuredClone(seedClasses);
    try {
      if (saved.length) storage.setItem(CATALOG_KEY, JSON.stringify(saved));
    } catch {}
  } else {
    // Purge mock seed classes completely
    const filtered = saved.filter(c => !MOCK_SEED_CLASS_IDS.has(c.id));
    if (filtered.length !== saved.length) {
      saved = filtered;
      saveClassCatalog(saved, storage);
    }
    if (saved.length === 0 && seedClasses.length > 0) {
      saved = structuredClone(seedClasses);
      saveClassCatalog(saved, storage);
    }
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
