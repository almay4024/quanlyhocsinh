// Local repository boundary for master data and class configuration.
// Supports Birth Year (Năm sinh: 2009, 2010, ...) and automatic layout sync from Room Templates.
import { loadRoomTemplates, buildLayoutFromTemplate } from './room-template-repository.js?v=2.4';

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
    { id: 'employee-teacher-001', code: 'GV001', name: 'Cô Minh Anh', role: 'teacher' },
    { id: 'employee-teacher-002', code: 'GV002', name: 'Thầy Quang', role: 'teacher' },
    { id: 'employee-teacher-003', code: 'GV003', name: 'Cô Hương', role: 'teacher' },
    { id: 'employee-ta-001', code: 'TA001', name: 'Anh Linh', role: 'assistant' },
    { id: 'employee-ta-002', code: 'TA002', name: 'Mai Anh', role: 'assistant' },
    { id: 'employee-ta-003', code: 'TA003', name: 'Minh Khoa', role: 'assistant' },
    { id: 'employee-office-001', code: 'VP001', name: 'Lan Phương', role: 'office' },
    { id: 'employee-office-002', code: 'VP002', name: 'Hoàng Nam', role: 'office' },
    { id: 'employee-admin-001', code: 'AD001', name: 'Quản trị hệ thống', role: 'admin' }
  ]
};

const startNotifications = [
  { id: 'prep-before-class', anchor: 'start', offsetMinutes: -15, title: 'Chuẩn bị trước giờ học', body: 'Kiểm tra phòng và chuẩn bị thu BTVN.' },
  { id: 'collect-homework', anchor: 'start', offsetMinutes: 0, title: 'Đến giờ thu BTVN', body: 'Đi từng bàn thu BTVN trước khi điểm danh.' },
  { id: 'finalize-attendance', anchor: 'start', offsetMinutes: 15, title: 'Chốt điểm danh', body: 'Rà lại học sinh có mặt, đi muộn và vắng mặt.' },
  { id: 'end-test-collection', anchor: 'end', offsetMinutes: -15, title: 'Thu bài kiểm tra cuối giờ', body: 'Bắt đầu thu bài kiểm tra và chuẩn bị bàn giao.' }
];

export const seedClasses = [
  {
    id: 'class-math-8a-algebra',
    code: 'TOAN8A',
    grade: '2013',
    name: 'Toán 8A',
    subjectId: 'subject-math',
    subject: 'Toán',
    teacherIds: ['employee-teacher-001'],
    teacherId: 'employee-teacher-001',
    teacherName: 'Cô Minh Anh',
    assistantIds: ['employee-ta-001'],
    assistantName: 'Anh Linh',
    officeIds: ['employee-office-001'],
    weekday: 1,
    startTime: '15:30',
    endTime: '17:00',
    room: 'P1-T3-CS1',
    roomTemplateId: 'room-p1-t3-cs1',
    defaultLayout: makeDesks('class-math-8a-algebra', [3, 3, 2], [2]),
    defaultChecklist: {
      startItems: ['Lau bảng', 'Bật đèn và kiểm tra quạt/điều hòa', 'Chuẩn bị tài liệu và bài tập', 'Kiểm tra bàn ghế, cửa sổ và phòng học'],
      endItems: ['Thu bài kiểm tra cuối giờ', 'Đếm và bàn giao bài kiểm tra', 'Tắt thiết bị và kiểm tra phòng học']
    },
    defaultNotifications: startNotifications
  },
  {
    id: 'class-english-7b',
    code: 'ANH7B',
    grade: '2014',
    name: 'Tiếng Anh 7B',
    subjectId: 'subject-english',
    subject: 'Tiếng Anh',
    teacherIds: ['employee-teacher-002'],
    teacherId: 'employee-teacher-002',
    teacherName: 'Thầy Quang',
    assistantIds: ['employee-ta-001', 'employee-ta-003'],
    assistantName: 'Anh Linh, Minh Khoa',
    officeIds: ['employee-office-001'],
    weekday: 1,
    startTime: '18:00',
    endTime: '19:30',
    room: 'P2-T2-CS1',
    roomTemplateId: 'room-p2-t2-cs1',
    defaultLayout: makeDesks('class-english-7b', [3, 3], [2]),
    defaultChecklist: {
      startItems: ['Bật máy chiếu', 'Phát phiếu bài tập', 'Kiểm tra loa và bảng'],
      endItems: ['Thu bài kiểm tra cuối giờ', 'Thu lại tài liệu được phát']
    },
    defaultNotifications: startNotifications
  },
  {
    id: 'class-math-9c',
    code: 'TOAN9C',
    grade: '2012',
    name: 'Toán 9C',
    subjectId: 'subject-math',
    subject: 'Toán',
    teacherIds: ['employee-teacher-003'],
    teacherId: 'employee-teacher-003',
    teacherName: 'Cô Hương',
    assistantIds: ['employee-ta-002'],
    assistantName: 'Mai Anh',
    officeIds: ['employee-office-002'],
    weekday: 2,
    startTime: '16:00',
    endTime: '17:30',
    room: 'P1-T1-CS2',
    roomTemplateId: 'room-p1-t1-cs2',
    defaultLayout: makeDesks('class-math-9c', [3, 3, 3], [2]),
    defaultChecklist: {
      startItems: ['Lau bảng', 'Chuẩn bị compa và thước', 'Kiểm tra phòng học'],
      endItems: ['Thu dụng cụ học tập', 'Kiểm tra phòng học trước khi khóa']
    },
    defaultNotifications: startNotifications
  },
  {
    id: 'class-math-10a',
    code: 'TOAN10A',
    grade: '2011',
    name: 'Toán 10A',
    subjectId: 'subject-math',
    subject: 'Toán',
    teacherIds: ['employee-teacher-001'],
    teacherId: 'employee-teacher-001',
    teacherName: 'Cô Minh Anh',
    assistantIds: ['employee-ta-003'],
    assistantName: 'Minh Khoa',
    officeIds: ['employee-office-001'],
    weekday: 3,
    startTime: '17:30',
    endTime: '19:00',
    room: 'P3-T2-CS1',
    roomTemplateId: 'room-p3-t2-cs1',
    defaultLayout: makeDesks('class-math-10a', [3, 3, 3], [2]),
    defaultChecklist: {
      startItems: ['Lau bảng', 'Bật máy chiếu và quạt', 'Phát tài liệu hình học'],
      endItems: ['Thu bài kiểm tra cuối giờ', 'Bàn giao bài']
    },
    defaultNotifications: startNotifications
  },
  {
    id: 'class-physics-11b',
    code: 'LY11B',
    grade: '2010',
    name: 'Vật lý 11B',
    subjectId: 'subject-physics',
    subject: 'Vật lý',
    teacherIds: ['employee-teacher-002'],
    teacherId: 'employee-teacher-002',
    teacherName: 'Thầy Quang',
    assistantIds: ['employee-ta-001'],
    assistantName: 'Anh Linh',
    officeIds: ['employee-office-002'],
    weekday: 4,
    startTime: '18:00',
    endTime: '19:30',
    room: 'P2-T1-CS1',
    roomTemplateId: 'room-p2-t1-cs1',
    defaultLayout: makeDesks('class-physics-11b', [3, 3], [2]),
    defaultChecklist: {
      startItems: ['Chuẩn bị thiết bị thí nghiệm', 'Kiểm tra máy chiếu'],
      endItems: ['Thu phiếu bài tập', 'Tắt điện phòng học']
    },
    defaultNotifications: startNotifications
  },
  {
    id: 'class-math-12-exam',
    code: 'TOAN12A',
    grade: '2009',
    name: 'Toán 12 Luyện thi',
    subjectId: 'subject-math',
    subject: 'Toán',
    teacherIds: ['employee-teacher-003'],
    teacherId: 'employee-teacher-003',
    teacherName: 'Cô Hương',
    assistantIds: ['employee-ta-002'],
    assistantName: 'Mai Anh',
    officeIds: ['employee-office-001'],
    weekday: 5,
    startTime: '19:00',
    endTime: '21:00',
    room: 'P1-T4-CS1',
    roomTemplateId: 'room-p1-t4-cs1',
    defaultLayout: makeDesks('class-math-12-exam', [4, 4, 3], [2]),
    defaultChecklist: {
      startItems: ['Phát đề thi thử khảo sát', 'Bật máy chiếu và bấm giờ'],
      endItems: ['Thu phiếu trả lời trắc nghiệm', 'Kiểm đếm và niêm phong bài thi']
    },
    defaultNotifications: startNotifications
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

export function loadMasterData(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(MASTER_KEY) || 'null');
    if (saved && Array.isArray(saved.subjects) && Array.isArray(saved.employees)) {
      const employees = [...saved.employees];
      for (const employee of masterDefaults.employees) {
        if (!employees.some(item => item.id === employee.id)) employees.push(employee);
      }
      return { ...saved, employees };
    }
  } catch {}
  try {
    storage.setItem(MASTER_KEY, JSON.stringify(masterDefaults));
  } catch {}
  return structuredClone(masterDefaults);
}

export function saveMasterData(data, storage = localStorage) {
  try {
    storage.setItem(MASTER_KEY, JSON.stringify(data));
  } catch {}
}

export function loadClassCatalog(storage = localStorage, masters = loadMasterData(storage)) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(CATALOG_KEY) || 'null');
  } catch {}
  if (!Array.isArray(saved) || !saved.length) {
    saved = structuredClone(seedClasses);
    try {
      storage.setItem(CATALOG_KEY, JSON.stringify(saved));
    } catch {}
  }

  const resolved = saved.map(item => resolveClass(item, masters, storage));
  for (const s of seedClasses) {
    if (!resolved.some(r => r.id === s.id)) {
      resolved.push(resolveClass(s, masters, storage));
    }
  }

  return resolved;
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
