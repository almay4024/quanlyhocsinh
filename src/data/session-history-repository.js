// Repository boundary for Class Session Histories, Open/Close session state,
// Real-time Active Session Sync, No-Homework detection, and Staff Shift tracking.

const SESSION_HISTORY_KEY = 'lopvui.session-history.v1';
const SESSION_OVERRIDES_KEY = 'lopvui.session-overrides.v1';

export const seedSessionHistory = [
  {
    id: 'session-class-math-8a-algebra-2026-09-26',
    classId: 'class-math-8a-algebra',
    classCode: 'TOAN8A',
    className: 'Toán 8A',
    subject: 'Toán',
    room: 'P1-T3-CS1',
    grade: '2013',
    teacherName: 'Cô Minh Anh',
    assistantName: 'Anh Linh',
    date: '2026-09-26',
    status: 'closed',
    lessonTitle: 'Tìm giao tuyến 2 mặt phẳng',
    finalNote: 'Cả lớp làm bài kiểm tra cuối giờ và thu chấm BTVN.',
    studentsSnapshot: [
      { studentId: 'stu-seed-01', studentName: 'Nguyễn Minh Quân', attendance: { status: 'present' }, homework: { status: 'graded', score: 8.5 }, testScore: 9, note: '' },
      { studentId: 'stu-seed-02', studentName: 'Trần Bảo Ngọc', attendance: { status: 'present' }, homework: { status: 'graded', score: 8 }, testScore: 9, note: 'Ghi chép cẩn thận' },
      { studentId: 'stu-seed-05', studentName: 'Đặng Tuấn Kiệt', attendance: { status: 'late', lateMinutes: 10 }, homework: { status: 'not_submitted', reason: 'Quên vở', score: null }, testScore: 7.5, note: 'Quên mang vở' }
    ]
  },
  {
    id: 'session-class-math-8a-algebra-2026-09-19',
    classId: 'class-math-8a-algebra',
    classCode: 'TOAN8A',
    className: 'Toán 8A',
    subject: 'Toán',
    room: 'P1-T3-CS1',
    grade: '2013',
    teacherName: 'Cô Minh Anh',
    assistantName: 'Anh Linh',
    date: '2026-09-19',
    status: 'closed',
    lessonTitle: 'Giới thiệu hình không gian (buổi 2)',
    finalNote: 'Thu và chấm BTVN buổi 1 giao về nhà.',
    studentsSnapshot: [
      { studentId: 'stu-seed-01', studentName: 'Nguyễn Minh Quân', attendance: { status: 'present' }, homework: { status: 'not_submitted', score: 7 }, note: 'Đã làm bù BTVN' },
      { studentId: 'stu-seed-02', studentName: 'Trần Bảo Ngọc', attendance: { status: 'absent_excused' }, homework: { status: 'uncollected', score: null }, note: 'Xin phép nghỉ ốm' },
      { studentId: 'stu-seed-05', studentName: 'Đặng Tuấn Kiệt', attendance: { status: 'present' }, homework: { status: 'graded', score: 8 }, note: 'Cần chú ý bài tính nhanh' }
    ]
  },
  {
    id: 'session-class-math-8a-algebra-2026-09-12',
    classId: 'class-math-8a-algebra',
    classCode: 'TOAN8A',
    className: 'Toán 8A',
    subject: 'Toán',
    room: 'P1-T3-CS1',
    grade: '2013',
    teacherName: 'Cô Minh Anh',
    assistantName: 'Anh Linh',
    date: '2026-09-12',
    status: 'closed',
    lessonTitle: 'Giới thiệu hình không gian (buổi 1)',
    finalNote: 'Buổi mở đầu chuyên đề hình không gian.',
    studentsSnapshot: [
      { studentId: 'stu-seed-01', studentName: 'Nguyễn Minh Quân', attendance: { status: 'absent_excused' }, homework: { status: 'uncollected', score: null }, note: '' },
      { studentId: 'stu-seed-02', studentName: 'Trần Bảo Ngọc', attendance: { status: 'present' }, homework: { status: 'graded', score: 7.5 }, note: 'Làm bài cẩn thận' },
      { studentId: 'stu-seed-05', studentName: 'Đặng Tuấn Kiệt', attendance: { status: 'present' }, homework: { status: 'graded', score: 6.5 }, note: 'Cần rèn thêm biến đổi' }
    ]
  },
  {
    id: 'session-class-math-8a-algebra-2026-10-01',
    classId: 'class-math-8a-algebra',
    classCode: 'TOAN8A',
    className: 'Toán 8A',
    subject: 'Toán',
    room: 'P1-T3-CS1',
    grade: '8',
    teacherName: 'Cô Minh Anh',
    assistantName: 'Anh Linh',
    date: '2026-10-01',
    status: 'closed',
    startedAt: '2026-10-01T15:28:00.000Z',
    startedBy: { id: 'employee-ta-001', name: 'Anh Linh', role: 'assistant' },
    closedAt: '2026-10-01T17:05:00.000Z',
    closedBy: { id: 'employee-ta-001', name: 'Anh Linh', role: 'assistant' },
    lessonTitle: 'Ôn tập chương I: Đa thức và phân thức',
    finalNote: 'Lớp học sôi nổi, các bạn làm bài tập tốt. Bạn Quân và Ngọc nắm bài nhanh.',
    layout: [
      {id:'aisle-1',desks:[{id:'d11',seats:2},{id:'d12',seats:2},{id:'d13',seats:2}]},
      {id:'aisle-2',desks:[{id:'d21',seats:2},{id:'d22',seats:2},{id:'d23',seats:2}]},
      {id:'aisle-3',desks:[{id:'d31',seats:2},{id:'d32',seats:2}]}
    ],
    deskItems: {
      'd11': [{ studentId: 'stu-seed-01', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.0 } }],
      'd12': [{ studentId: 'stu-seed-02', attendance: { status: 'present' }, homework: { status: 'submitted', score: 8.5 } }],
      'd22': [{ studentId: 'stu-seed-05', attendance: { status: 'present' }, homework: { status: 'submitted', score: 7.5 } }]
    },
    checklistSummary: [
      { label: 'Lau bảng', done: true, doneBy: 'Anh Linh' },
      { label: 'Bật đèn và kiểm tra quạt/điều hòa', done: true, doneBy: 'Anh Linh' },
      { label: 'Chuẩn bị tài liệu và bài tập', done: true, doneBy: 'Anh Linh' },
      { label: 'Kiểm tra bàn ghế, cửa sổ và phòng học', done: true, doneBy: 'Anh Linh' }
    ],
    stats: {
      total: 5,
      present: 5,
      late: 0,
      absent: 0,
      homeworkDone: 5,
      testsCollected: 5
    },
    studentsSnapshot: [
      { studentId: 'stu-seed-01', studentName: 'Nguyễn Minh Quân', studentCode: 'K09.3049', school: 'THCS Cầu Giấy', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.0 }, testScore: 9.5, note: 'Hăng hái phát biểu' },
      { studentId: 'stu-seed-02', studentName: 'Trần Bảo Ngọc', studentCode: '2K9.H4.GIANGNH', school: 'THCS Yên Hòa', attendance: { status: 'present' }, homework: { status: 'submitted', score: 8.5 }, testScore: 9.0, note: 'Làm bài cẩn thận' },
      { studentId: 'stu-seed-05', studentName: 'Đặng Tuấn Kiệt', studentCode: null, school: 'THCS Nghĩa Tân', attendance: { status: 'present' }, homework: { status: 'submitted', score: 7.5 }, testScore: 8.0, note: 'Cần chú ý bài tính nhanh' }
    ]
  },
  {
    id: 'session-class-math-8a-algebra-2026-10-05',
    classId: 'class-math-8a-algebra',
    classCode: 'TOAN8A',
    className: 'Toán 8A',
    subject: 'Toán',
    room: 'P1-T3-CS1',
    grade: '8',
    teacherName: 'Cô Minh Anh',
    assistantName: 'Anh Linh',
    date: '2026-10-05',
    status: 'closed',
    startedAt: '2026-10-05T15:30:00.000Z',
    startedBy: { id: 'employee-ta-001', name: 'Anh Linh', role: 'assistant' },
    closedAt: '2026-10-05T17:03:00.000Z',
    closedBy: { id: 'employee-ta-001', name: 'Anh Linh', role: 'assistant' },
    lessonTitle: 'Hình học: Hình thang cân và hình thoi',
    finalNote: 'Đã hoàn thành vẽ hình và chứng minh tính chất.',
    layout: [
      {id:'aisle-1',desks:[{id:'d11',seats:2},{id:'d12',seats:2},{id:'d13',seats:2}]},
      {id:'aisle-2',desks:[{id:'d21',seats:2},{id:'d22',seats:2},{id:'d23',seats:2}]},
      {id:'aisle-3',desks:[{id:'d31',seats:2},{id:'d32',seats:2}]}
    ],
    deskItems: {
      'd11': [{ studentId: 'stu-seed-01', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.0 } }],
      'd12': [{ studentId: 'stu-seed-02', attendance: { status: 'present' }, homework: { status: 'submitted', score: 8.5 } }],
      'd22': [{ studentId: 'stu-seed-05', attendance: { status: 'late', lateMinutes: 10, minutesLate: 10 }, homework: { status: 'not_submitted', reason: 'Quên vở' } }]
    },
    checklistSummary: [
      { label: 'Lau bảng', done: true, doneBy: 'Anh Linh' },
      { label: 'Bật đèn và kiểm tra quạt/điều hòa', done: true, doneBy: 'Anh Linh' },
      { label: 'Chuẩn bị tài liệu và bài tập', done: true, doneBy: 'Anh Linh' }
    ],
    stats: {
      total: 5,
      present: 4,
      late: 1,
      absent: 0,
      homeworkDone: 4,
      testsCollected: 5
    },
    studentsSnapshot: [
      { studentId: 'stu-seed-01', studentName: 'Nguyễn Minh Quân', studentCode: 'K09.3049', school: 'THCS Cầu Giấy', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.0 }, testScore: 9.0, note: '' },
      { studentId: 'stu-seed-02', studentName: 'Trần Bảo Ngọc', studentCode: '2K9.H4.GIANGNH', school: 'THCS Yên Hòa', attendance: { status: 'present' }, homework: { status: 'submitted', score: 8.5 }, testScore: 8.5, note: '' },
      { studentId: 'stu-seed-05', studentName: 'Đặng Tuấn Kiệt', studentCode: null, school: 'THCS Nghĩa Tân', attendance: { status: 'late', lateMinutes: 10, minutesLate: 10 }, homework: { status: 'not_submitted', reason: 'Quên vở' }, testScore: 7.5, note: 'Đi muộn 10p do kẹt xe' }
    ]
  },
  {
    id: 'session-class-physics-11b-2026-10-04',
    classId: 'class-physics-11b',
    classCode: 'LY11B',
    className: 'Vật lý 11B',
    subject: 'Vật lý',
    room: 'P2-T1-CS1',
    grade: '11',
    teacherName: 'Thầy Quang',
    assistantName: 'Anh Linh',
    date: '2026-10-04',
    status: 'closed',
    startedAt: '2026-10-04T17:58:00.000Z',
    startedBy: { id: 'employee-ta-001', name: 'Anh Linh', role: 'assistant' },
    closedAt: '2026-10-04T19:35:00.000Z',
    closedBy: { id: 'employee-ta-001', name: 'Anh Linh', role: 'assistant' },
    lessonTitle: 'Định luật Cu-lông và điện trường',
    finalNote: 'Các bạn làm bài tập lực tương tác tĩnh điện tốt.',
    layout: [
      {id:'aisle-1',desks:[{id:'d11',seats:2},{id:'d12',seats:2},{id:'d13',seats:2}]},
      {id:'aisle-2',desks:[{id:'d21',seats:2},{id:'d22',seats:2}]}
    ],
    deskItems: {
      'd11': [{ studentId: 'stu-seed-03', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.0 } }],
      'd12': [{ studentId: 'stu-seed-06', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.5 } }]
    },
    checklistSummary: [
      { label: 'Lau bảng', done: true, doneBy: 'Anh Linh' },
      { label: 'Chuẩn bị đề phát tay', done: true, doneBy: 'Anh Linh' }
    ],
    stats: {
      total: 4,
      present: 4,
      late: 0,
      absent: 0,
      homeworkDone: 4,
      testsCollected: 4
    },
    studentsSnapshot: [
      { studentId: 'stu-seed-03', studentName: 'Lê Hoàng Nam', studentCode: 'CONGNT', school: 'THPT Chu Văn An', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.0 }, testScore: 9.0, note: '' },
      { studentId: 'stu-seed-06', studentName: 'Vũ Hải Yến', studentCode: null, school: 'THPT Chuyên Hà Nội - Amsterdam', attendance: { status: 'present' }, homework: { status: 'submitted', score: 9.5 }, testScore: 10, note: 'Làm đúng 100%' }
    ]
  }
];

export function loadSessionHistory(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    if (storage) {
      const raw = storage.getItem(SESSION_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          seedSessionHistory.forEach(seedItem => {
            if (!parsed.some(p => p.id === seedItem.id || (p.classId === seedItem.classId && p.date === seedItem.date))) {
              parsed.push(structuredClone(seedItem));
            }
          });
          return parsed;
        }
      }
    }
  } catch {}
  if (storage) {
    storage.setItem(SESSION_HISTORY_KEY, JSON.stringify(seedSessionHistory));
  }
  return structuredClone(seedSessionHistory);
}

export function saveSessionHistory(history, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (storage) {
    storage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  }
}

export function loadSessionOverrides(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    if (storage) {
      const raw = storage.getItem(SESSION_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return {};
}

export function saveSessionOverrides(overrides, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (storage) {
    storage.setItem(SESSION_OVERRIDES_KEY, JSON.stringify(overrides));
  }
}

export function getSessionRecord(classId, date, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const history = loadSessionHistory(storage);
  return history.find(s => s.classId === classId && s.date === date) || null;
}

/**
 * Mở lớp: bắt đầu ca làm và ghi vào lịch sử thêm 1 ca mới (trạng thái 'active')
 */
export function openClassSession(classId, date, currentUser, classInfo, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const history = loadSessionHistory(storage);
  let record = history.find(s => s.classId === classId && s.date === date);

  const now = new Date().toISOString();
  const operator = currentUser ? {
    id: currentUser.id || currentUser.employeeId || 'anonymous',
    name: currentUser.name || 'Người dùng',
    role: currentUser.role || 'assistant'
  } : { id: 'sys', name: 'Hệ thống', role: 'assistant' };

  if (record) {
    record.status = 'active';
    record.lastReopenedAt = now;
    if (!record.startedAt) record.startedAt = now;
    if (!record.startedBy) record.startedBy = operator;
  } else {
    record = {
      id: `session-${classId}-${date}`,
      classId,
      classCode: classInfo?.code || classId,
      className: classInfo?.name || classId,
      subject: classInfo?.subject || '',
      room: classInfo?.room || '',
      grade: classInfo?.grade || '',
      teacherName: classInfo?.teacherName || '',
      assistantName: classInfo?.assistantName || '',
      date,
      status: 'active',
      startedAt: now,
      startedBy: operator,
      checklistDone: [],
      notes: '',
      studentsSnapshot: [],
      stats: {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        homeworkDone: 0
      }
    };
    history.push(record);
  }

  saveSessionHistory(history, storage);
  return record;
}

/**
 * Đồng bộ liên tục (Real-time Upsert) dữ liệu ca học đang mở vào lịch sử ca học
 * mà không cần đợi đến lúc bấm Kết ca.
 */
export function syncActiveClassSessionRecord(classId, date, currentUser, snapshotData, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const history = loadSessionHistory(storage);
  let record = history.find(s => s.classId === classId && s.date === date);

  const now = new Date().toISOString();
  const operator = currentUser ? {
    id: currentUser.id || currentUser.employeeId || 'anonymous',
    name: currentUser.name || 'Người dùng',
    role: currentUser.role || 'assistant'
  } : { id: 'sys', name: 'Hệ thống', role: 'assistant' };

  if (!record) {
    // Only auto-create session record if there is meaningful activity (students seated/late, checklist done, or lessonTitle/notes entered)
    const hasActivity = (snapshotData.students && snapshotData.students.some(s => s.attendance?.status === 'present' || s.attendance?.status === 'late' || (s.homework?.status && s.homework.status !== 'uncollected') || s.note))
      || snapshotData.lessonTitle
      || snapshotData.sessionNote
      || (snapshotData.checklistSummary && snapshotData.checklistSummary.some(i => i.done));
    if (!hasActivity) return null;

    record = {
      id: `session-${classId}-${date}`,
      classId,
      classCode: snapshotData.classCode || classId,
      className: snapshotData.className || classId,
      subject: snapshotData.subject || '',
      room: snapshotData.room || '',
      grade: snapshotData.grade || '',
      teacherName: snapshotData.teacherName || '',
      assistantName: snapshotData.assistantName || '',
      date,
      status: 'active',
      startedAt: now,
      startedBy: operator
    };
    history.push(record);
  }

  record.className = snapshotData.className || record.className || classId;
  record.classCode = snapshotData.classCode || record.classCode || classId;
  record.subject = snapshotData.subject || record.subject || '';
  record.room = snapshotData.room || record.room || '';
  record.grade = snapshotData.grade || record.grade || '';
  record.teacherName = snapshotData.teacherName || record.teacherName || '';
  record.assistantName = snapshotData.assistantName || record.assistantName || '';
  record.lessonTitle = snapshotData.lessonTitle ?? record.lessonTitle ?? '';
  record.finalNote = snapshotData.sessionNote ?? record.finalNote ?? '';
  record.sessionNote = snapshotData.sessionNote ?? record.sessionNote ?? '';
  record.homeworkAssignment = snapshotData.homeworkAssignment ?? record.homeworkAssignment ?? '';
  if (snapshotData.layout) record.layout = snapshotData.layout;
  if (snapshotData.deskItems) record.deskItems = snapshotData.deskItems;
  if (snapshotData.students) record.studentsSnapshot = snapshotData.students;
  if (snapshotData.testHandover !== undefined) record.testHandover = snapshotData.testHandover;
  if (snapshotData.checklistSummary) record.checklistSummary = snapshotData.checklistSummary;
  if (snapshotData.stats) {
    record.stats = {
      total: snapshotData.stats.total || 0,
      present: snapshotData.stats.present || 0,
      late: snapshotData.stats.late || 0,
      absent: snapshotData.stats.absent || 0,
      homeworkDone: snapshotData.stats.homeworkDone || 0,
      testsCollected: snapshotData.stats.testsCollected || 0
    };
  }
  record.updatedAt = now;

  saveSessionHistory(history, storage);
  return record;
}

/**
 * Đóng lớp: chốt các thông tin để lưu vào lịch sử thông tin về ca làm để quản lý trong tương lai
 */
export function closeClassSession(classId, date, currentUser, snapshotData, finalNote = '', storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const history = loadSessionHistory(storage);
  let record = history.find(s => s.classId === classId && s.date === date);

  const now = new Date().toISOString();
  const operator = currentUser ? {
    id: currentUser.id || currentUser.employeeId || 'anonymous',
    name: currentUser.name || 'Người dùng',
    role: currentUser.role || 'assistant'
  } : { id: 'sys', name: 'Hệ thống', role: 'assistant' };

  if (!record) {
    record = {
      id: `session-${classId}-${date}`,
      classId,
      classCode: snapshotData.classCode || classId,
      className: snapshotData.className || classId,
      subject: snapshotData.subject || '',
      room: snapshotData.room || '',
      grade: snapshotData.grade || '',
      teacherName: snapshotData.teacherName || '',
      assistantName: snapshotData.assistantName || '',
      date,
      startedAt: now,
      startedBy: operator
    };
    history.push(record);
  }

  record.status = 'closed';
  record.closedAt = now;
  record.closedBy = operator;
  record.finalNote = finalNote || snapshotData.sessionNote || record.finalNote || '';
  record.lessonTitle = snapshotData.lessonTitle || record.lessonTitle || '';
  record.homeworkAssignment = snapshotData.homeworkAssignment || record.homeworkAssignment || '';
  record.layout = snapshotData.layout || record.layout || null;
  record.deskItems = snapshotData.deskItems || record.deskItems || null;
  record.studentsSnapshot = snapshotData.students || record.studentsSnapshot || [];
  record.testHandover = snapshotData.testHandover || record.testHandover || null;
  record.checklistSummary = snapshotData.checklistSummary || snapshotData.checklist || record.checklistSummary || [];
  record.stats = {
    total: snapshotData.stats?.total || 0,
    present: snapshotData.stats?.present || 0,
    late: snapshotData.stats?.late || 0,
    absent: snapshotData.stats?.absent || 0,
    homeworkDone: snapshotData.stats?.homeworkDone || 0,
    testsCollected: snapshotData.stats?.testsCollected || 0
  };

  saveSessionHistory(history, storage);
  return record;
}

export function getNoHomeworkStatus(classId, date, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const overrides = loadSessionOverrides(storage);
  const key = `${classId}:${date}`;

  if (overrides[key] && typeof overrides[key].noHomework === 'boolean') {
    return {
      noHomework: overrides[key].noHomework,
      isAutoChecked: false,
      reason: 'manual'
    };
  }

  const history = loadSessionHistory(storage);
  const previousSessions = history
    .filter(s => s.classId === classId && s.date < date)
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (previousSessions.length > 0) {
    const prev = previousSessions[0];
    const prevNoHw = prev.noHomework === true || prev.stats?.homeworkDone === -1;
    if (prevNoHw) {
      return {
        noHomework: true,
        isAutoChecked: true,
        reason: `Tự động nhận diện từ buổi trước (${prev.date}): Không giao BTVN`
      };
    }
  }

  return {
    noHomework: false,
    isAutoChecked: false,
    reason: 'default'
  };
}

export function setNoHomeworkStatus(classId, date, noHomework, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const overrides = loadSessionOverrides(storage);
  const key = `${classId}:${date}`;
  overrides[key] = {
    ...(overrides[key] || {}),
    noHomework: Boolean(noHomework),
    updatedAt: new Date().toISOString()
  };
  saveSessionOverrides(overrides, storage);

  const history = loadSessionHistory(storage);
  const record = history.find(s => s.classId === classId && s.date === date);
  if (record) {
    record.noHomework = Boolean(noHomework);
    saveSessionHistory(history, storage);
  }
}

export function getStaffShiftData(employeeId, classCatalog = [], sessionChanges = {}, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const history = loadSessionHistory(storage);

  const assignedRegular = [];
  classCatalog.forEach(cls => {
    const isTeacher = (cls.teacherIds || []).includes(employeeId) || cls.teacherId === employeeId;
    const isAssistant = (cls.assistantIds || []).includes(employeeId);
    const isOffice = (cls.officeIds || []).includes(employeeId);

    if (isTeacher || isAssistant || isOffice) {
      assignedRegular.push({
        classId: cls.id,
        classCode: cls.code || cls.id,
        className: cls.name,
        subject: cls.subject,
        room: cls.room,
        weekday: cls.weekday,
        time: `${cls.startTime} - ${cls.endTime}`,
        roleInClass: isTeacher ? 'Giáo viên phụ trách' : isAssistant ? 'Trợ giảng' : 'Văn phòng theo dõi'
      });
    }
  });

  const assignedSpecial = [];
  Object.entries(sessionChanges).forEach(([key, change]) => {
    const parts = key.includes('::') ? key.split('::') : key.split(':');
    const [clsId, changeDate] = parts;
    const cls = classCatalog.find(c => c.id === clsId);
    const isTeacher = change.teacherId === employeeId || (change.teacherIds || []).includes(employeeId);
    const isAssistant = (change.assistantIds || []).includes(employeeId);

    if (isTeacher || isAssistant) {
      assignedSpecial.push({
        classId: clsId,
        classCode: cls ? (cls.code || cls.id) : clsId,
        className: cls ? cls.name : clsId,
        date: change.date || changeDate,
        time: change.startTime ? `${change.startTime} - ${change.endTime}` : (cls ? `${cls.startTime} - ${cls.endTime}` : ''),
        room: change.room || cls?.room || '',
        category: change.category || (change.status === 'makeup' ? 'Buổi học bù' : 'Điều chỉnh ca'),
        roleInClass: isTeacher ? 'Giáo viên' : 'Trợ giảng',
        note: change.note || ''
      });
    }
  });

  const workHistory = history.filter(session => {
    const inStarted = session.startedBy?.id === employeeId;
    const inClosed = session.closedBy?.id === employeeId;
    const inClassTeacher = session.teacherName?.toLowerCase().includes(employeeId.toLowerCase());
    const inClassTA = session.assistantName?.toLowerCase().includes(employeeId.toLowerCase());
    const inHandover = session.testHandover?.staffId === employeeId;
    const cls = classCatalog.find(c => c.id === session.classId);
    const assignedToClass = cls && ((cls.teacherIds || []).includes(employeeId) || (cls.assistantIds || []).includes(employeeId));
    return inStarted || inClosed || inClassTeacher || inClassTA || inHandover || assignedToClass;
  }).sort((a, b) => (b.date > a.date ? 1 : -1));

  return {
    assignedRegular,
    assignedSpecial,
    workHistory
  };
}

export function getStudentClassDeepDive(student, classId, currentRoster = [], storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const history = loadSessionHistory(storage);
  const classSessions = history.filter(s => s.classId === classId);

  const sessionDatesSet = new Set();
  (student.attendanceHistory || []).forEach(att => {
    if (att.classId === classId || !att.classId) sessionDatesSet.add(att.date);
  });
  (student.sessionNotes || []).forEach(n => {
    if (n.classId === classId || !n.classId) sessionDatesSet.add(n.date);
  });
  (student.scores || []).forEach(s => {
    if (s.classId === classId || !s.classId) sessionDatesSet.add(s.date);
  });
  (student.seatingHistory || []).forEach(sh => {
    if (sh.classId === classId || !sh.classId) sessionDatesSet.add(sh.date);
  });
  classSessions.forEach(cs => {
    if (cs.studentsSnapshot?.some(s => s.studentId === student.id)) {
      sessionDatesSet.add(cs.date);
    }
  });

  const sessionDates = Array.from(sessionDatesSet).filter(Boolean).sort((a, b) => b.localeCompare(a));

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let totalLateMinutes = 0;
  let hwSubmitted = 0;
  let hwMissing = 0;
  const scoresInClass = [];

  const detailedSessions = sessionDates.map(date => {
    const classSession = classSessions.find(s => s.date === date);
    const snap = classSession?.studentsSnapshot?.find(s => s.studentId === student.id);
    const att = (student.attendanceHistory || []).find(h => (h.classId === classId || !h.classId) && h.date === date);
    const sn = (student.sessionNotes || []).find(n => (n.classId === classId || !n.classId) && n.date === date);
    const sc = (student.scores || []).find(s => (s.classId === classId || !s.classId) && s.date === date);
    const seat = (student.seatingHistory || []).find(s => (s.classId === classId || !s.classId) && s.date === date);

    const attStatus = snap?.attendance?.status || att?.status || 'present';
    const minutesLate = snap?.attendance?.minutesLate || snap?.attendance?.lateMinutes || att?.minutesLate || att?.lateMinutes || 0;
    if (attStatus === 'present') presentCount++;
    else if (attStatus === 'late') {
      lateCount++;
      totalLateMinutes += Number(minutesLate) || 0;
    } else if (attStatus === 'absent' || attStatus === 'absent_excused' || attStatus === 'absent_unexcused') {
      absentCount++;
    }

    const hwStatus = snap?.homework?.status || sn?.homeworkStatus || 'uncollected';
    const hwReason = snap?.homework?.reason || sn?.homeworkReason || '';
    const hwScore = snap?.homework?.score ?? sn?.homeworkScore ?? null;
    if (hwStatus === 'submitted' || hwStatus === 'graded') hwSubmitted++;
    else if (hwStatus === 'not_submitted') hwMissing++;

    const testScore = snap?.testScore ?? sc?.score ?? null;
    if (testScore !== null && testScore !== undefined) {
      scoresInClass.push({ classId, date, type: sc?.type || 'Kiểm tra', score: Number(testScore) });
    }

    const aisle = seat?.aisle ?? null;
    const desk = seat?.desk ?? null;
    const position = seat?.position ?? 1;
    const deskId = seat?.deskId || null;

    const note = snap?.note || sn?.note || '';
    const classNote = classSession?.finalNote || classSession?.sessionNote || '';

    return {
      date,
      formattedDate: new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }),
      shortDate: new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      lessonTitle: classSession?.lessonTitle || `Buổi học ${date}`,
      teacherName: classSession?.teacherName || '',
      assistantName: classSession?.assistantName || '',
      closedBy: classSession?.closedBy?.name || '',
      closedAt: classSession?.closedAt || '',
      isClosed: classSession?.status === 'closed',
      attendance: {
        status: attStatus,
        minutesLate,
        time: att?.time || (attStatus === 'late' ? `Muộn ${minutesLate}p` : null)
      },
      homework: {
        status: hwStatus,
        score: hwScore,
        reason: hwReason,
        note: sn?.homeworkNote || ''
      },
      testScore,
      seat: {
        aisle,
        desk,
        position,
        deskId
      },
      note,
      classNote
    };
  });

  const avgScore = scoresInClass.length
    ? (scoresInClass.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / scoresInClass.length).toFixed(1)
    : '—';

  return {
    classId,
    totalSessionsRecorded: detailedSessions.length,
    presentCount,
    lateCount,
    absentCount,
    totalLateMinutes,
    hwSubmitted,
    hwMissing,
    scores: scoresInClass,
    avgScore,
    detailedSessions,
    notes: (student.notes || []).filter(n => n.classId === classId || !n.classId)
  };
}
