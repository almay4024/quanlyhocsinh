// Storage boundary for student records. Synchronizes automatically via localStorage + realtime-sync.js.
const STUDENTS_KEY = 'lopvui.students.v6';
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

export const seedStudents = [
  {
    id: 'stu-seed-01',
    name: 'Nguyễn Minh Quân',
    familyName: 'Nguyễn Minh',
    givenName: 'Quân',
    studentCode: 'K09.3049',
    school: 'THCS Cầu Giấy',
    classIds: ['class-math-8a-algebra', 'class-english-7b', 'class-tutoring'],
    parentContact: { name: 'Nguyễn Văn Hùng', phone: '0988123456' },
    scores: [
      { classId: 'class-tutoring', type: 'Kiểm tra Gia sư', score: 8.5, date: '2026-10-05' },
      { classId: 'class-math-8a-algebra', type: '15 phút', score: 9.0, date: '2026-10-05' },
      { classId: 'class-tutoring', type: 'Kiểm tra Bổ trợ', score: 9.0, date: '2026-10-01' },
      { classId: 'class-math-8a-algebra', type: '15 phút', score: 9.5, date: '2026-10-01' }
    ],
    attendanceHistory: [
      { classId: 'class-tutoring', date: '2026-10-05', status: 'present', tutoringType: 'giasu', time: '14:00 - 15:15' },
      { classId: 'class-math-8a-algebra', date: '2026-10-05', status: 'present' },
      { classId: 'class-tutoring', date: '2026-10-01', status: 'present', tutoringType: 'tutoring', time: '15:30 - 16:45' },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', status: 'present' }
    ],
    seatingHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', aisle: 1, desk: 1, position: 1 },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', aisle: 1, desk: 1, position: 1 }
    ],
    sessionNotes: [
      { classId: 'class-tutoring', date: '2026-10-05', tutoringId: 'tutor-20261005-01', tutoringType: 'giasu', lessonTitle: 'Dạy kèm gia sư 1-1: Rút gọn phân thức đại số nâng cao và tìm điều kiện xác định', previousHomeworkCheck: 'Đã hoàn thành 10/10 câu BTVN buổi trước; sai câu 4 về phân thức đã được chữa kỹ và hiểu bài.', homeworkStatus: 'completed', homeworkScore: 8.5, note: 'Nắm chắc phương pháp phân tích đa thức thành nhân tử để rút gọn. Bài test tại chỗ đạt 8.5/10.', assistantName: 'Anh Linh' },
      { classId: 'class-math-8a-algebra', date: '2026-10-05', homeworkStatus: 'submitted', homeworkScore: 9.0, note: 'Làm bài nhanh' },
      { classId: 'class-tutoring', date: '2026-10-01', tutoringId: 'tutor-20261001-04', tutoringType: 'tutoring', lessonTitle: 'Bổ trợ đại số: Hằng đẳng thức đáng nhớ số 4 và số 5', previousHomeworkCheck: 'Đã hoàn thành phiếu bài tập ôn tập chương I.', homeworkStatus: 'completed', homeworkScore: 9.0, note: 'Thuộc hằng đẳng thức, vận dụng tính nhanh tốt.', assistantName: 'Anh Linh' },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', homeworkStatus: 'submitted', homeworkScore: 9.0, note: 'Hăng hái phát biểu' }
    ],
    tags: ['Cần chú ý'],
    isNew: false
  },
  {
    id: 'stu-seed-02',
    name: 'Trần Bảo Ngọc',
    familyName: 'Trần Bảo',
    givenName: 'Ngọc',
    studentCode: '2K9.H4.GIANGNH',
    school: 'THCS Yên Hòa',
    classIds: ['class-math-8a-algebra', 'class-tutoring'],
    parentContact: { name: 'Trần Thị Lan', phone: '0977234567' },
    scores: [
      { classId: 'class-math-8a-algebra', type: '15 phút', score: 8.5, date: '2026-10-05' },
      { classId: 'class-tutoring', type: 'Kiểm tra Bổ trợ', score: 7.5, date: '2026-10-04' },
      { classId: 'class-math-8a-algebra', type: 'Giữa kỳ', score: 9.0, date: '2026-10-01' }
    ],
    attendanceHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', status: 'present' },
      { classId: 'class-tutoring', date: '2026-10-04', status: 'present', tutoringType: 'tutoring', time: '17:30 - 18:45' },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', status: 'present' }
    ],
    seatingHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', aisle: 1, desk: 2, position: 1 },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', aisle: 1, desk: 2, position: 1 }
    ],
    sessionNotes: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', homeworkStatus: 'submitted', homeworkScore: 8.5, note: 'Ghi chép cẩn thận' },
      { classId: 'class-tutoring', date: '2026-10-04', tutoringId: 'tutor-20261004-02', tutoringType: 'tutoring', lessonTitle: 'Bổ trợ hình học: Tính chất đường trung bình và hình thang cân', previousHomeworkCheck: 'Quên vở bài tập buổi trước, đã kiểm tra bù trực tiếp trên lớp và làm đúng 4/5 bài.', homeworkStatus: 'assigned_more', homeworkScore: 7.5, note: 'Hiểu tính chất nhưng vẽ hình còn chậm. Đã giao thêm 1 phiếu vẽ hình và chứng minh về nhà.', assistantName: 'Mai Anh' },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', homeworkStatus: 'submitted', homeworkScore: 8.5, note: 'Làm bài cẩn thận' }
    ],
    tags: ['HS Giỏi'],
    isNew: false
  },
  {
    id: 'stu-seed-03',
    name: 'Lê Hoàng Nam',
    familyName: 'Lê Hoàng',
    givenName: 'Nam',
    studentCode: 'CONGNT',
    school: 'THPT Chu Văn An',
    classIds: ['class-math-12-exam', 'class-physics-11b', 'class-tutoring'],
    parentContact: { name: 'Lê Văn Thắng', phone: '0912345678' },
    scores: [
      { classId: 'class-tutoring', type: 'Kiểm tra Gia sư', score: 9.5, date: '2026-10-02' },
      { classId: 'class-math-12-exam', type: 'Khảo sát ĐH', score: 9.2, date: '2026-10-02' }
    ],
    attendanceHistory: [
      { classId: 'class-tutoring', date: '2026-10-02', status: 'present', tutoringType: 'giasu', time: '09:00 - 10:15' },
      { classId: 'class-math-12-exam', date: '2026-10-02', status: 'present' }
    ],
    seatingHistory: [{ classId: 'class-math-12-exam', date: '2026-10-02', aisle: 2, desk: 1, position: 1 }],
    sessionNotes: [
      { classId: 'class-tutoring', date: '2026-10-02', tutoringId: 'tutor-20261002-03', tutoringType: 'giasu', lessonTitle: 'Dạy kèm gia sư 1-1: Cực trị hàm hợp và hàm ẩn nâng cao ôn thi ĐH', previousHomeworkCheck: 'Làm đầy đủ bài tập khảo sát hàm số, trình bày chuẩn xác.', homeworkStatus: 'completed', homeworkScore: 9.5, note: 'Tư duy giải toán tốt, nắm vững phương pháp sơ đồ V và ghép trục. Bài test đạt 9.5.', assistantName: 'Anh Linh' },
      { classId: 'class-math-12-exam', date: '2026-10-02', homeworkStatus: 'submitted' }
    ],
    tags: ['Mục tiêu 9+'],
    isNew: false
  },
  {
    id: 'stu-seed-04',
    name: 'Phạm Thu Trang',
    familyName: 'Phạm Thu',
    givenName: 'Trang',
    studentCode: null,
    school: 'THPT Kim Liên',
    classIds: ['class-math-10a'],
    parentContact: { name: 'Nguyễn Thị Mai', phone: '0903456789' },
    scores: [{ classId: 'class-math-10a', type: '1 tiết', score: 8.0, date: '2026-10-03' }],
    attendanceHistory: [{ classId: 'class-math-10a', date: '2026-10-03', status: 'late', minutesLate: 10, lateMinutes: 10 }],
    seatingHistory: [{ classId: 'class-math-10a', date: '2026-10-03', aisle: 1, desk: 3, position: 2 }],
    sessionNotes: [{ classId: 'class-math-10a', date: '2026-10-03', homeworkStatus: 'not_submitted', homeworkReason: 'Quên vở' }],
    tags: ['Mới'],
    isNew: true
  },
  {
    id: 'stu-seed-05',
    name: 'Đặng Tuấn Kiệt',
    familyName: 'Đặng Tuấn',
    givenName: 'Kiệt',
    studentCode: null,
    school: 'THCS Nghĩa Tân',
    classIds: ['class-math-9c', 'class-math-8a-algebra'],
    parentContact: { name: 'Đặng Quốc Huy', phone: '0966789012' },
    scores: [
      { classId: 'class-math-8a-algebra', type: 'Kiểm tra 15p', score: 7.5, date: '2026-10-05' },
      { classId: 'class-math-8a-algebra', type: 'Kiểm tra 15p', score: 8.0, date: '2026-10-01' },
      { classId: 'class-math-9c', type: 'Kiểm tra 15p', score: 7.5, date: '2026-10-01' }
    ],
    attendanceHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', status: 'late', minutesLate: 10, lateMinutes: 10 },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', status: 'present' },
      { classId: 'class-math-9c', date: '2026-10-01', status: 'present' }
    ],
    seatingHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', aisle: 2, desk: 2, position: 1 },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', aisle: 2, desk: 2, position: 1 },
      { classId: 'class-math-9c', date: '2026-10-01', aisle: 2, desk: 2, position: 1 }
    ],
    sessionNotes: [
      { classId: 'class-math-8a-algebra', date: '2026-10-05', homeworkStatus: 'not_submitted', homeworkReason: 'Quên vở', homeworkScore: null, note: 'Đi muộn 10p do kẹt xe' },
      { classId: 'class-math-8a-algebra', date: '2026-10-01', homeworkStatus: 'submitted', homeworkScore: 7.5, note: 'Cần chú ý bài tính nhanh' },
      { classId: 'class-math-9c', date: '2026-10-01', homeworkStatus: 'submitted' }
    ],
    tags: [],
    isNew: false
  },
  {
    id: 'stu-seed-06',
    name: 'Vũ Hải Yến',
    familyName: 'Vũ Hải',
    givenName: 'Yến',
    studentCode: null,
    school: 'THPT Chuyên Hà Nội - Amsterdam',
    classIds: ['class-physics-11b'],
    parentContact: { name: 'Vũ Minh Đức', phone: '0934567890' },
    scores: [{ classId: 'class-physics-11b', type: 'Định kỳ', score: 9.5, date: '2026-10-04' }],
    attendanceHistory: [{ classId: 'class-physics-11b', date: '2026-10-04', status: 'present' }],
    seatingHistory: [{ classId: 'class-physics-11b', date: '2026-10-04', aisle: 1, desk: 1, position: 1 }],
    sessionNotes: [{ classId: 'class-physics-11b', date: '2026-10-04', homeworkStatus: 'submitted' }],
    tags: ['HS Giỏi'],
    isNew: false
  }
];

export const seedMakeupStudents = [
  {
    id: 'stu-makeup-seed-01',
    name: 'Hoàng Gia Bảo',
    familyName: 'Hoàng Gia',
    givenName: 'Bảo',
    studentCode: '2K13.MK01',
    school: '',
    sourceClassName: 'Toán 8B',
    attendingClassId: 'class-math-8a-algebra',
    classIds: [],
    parentContact: { name: 'Hoàng Văn Minh', phone: '0918223344' },
    scores: [],
    attendanceHistory: [],
    seatingHistory: [],
    sessionNotes: [],
    tags: ['Học bù'],
    studentType: 'makeup',
    isNew: false
  }
];

export function loadStudentRecords(currentClassId, storage = getStorage()) {
  let stored = read(STUDENTS_KEY, null, storage);
  let makeup = read(MAKEUP_KEY, null, storage);

  if (!Array.isArray(stored) || !stored.length) {
    stored = structuredClone(seedStudents);
    if (storage) storage.setItem(STUDENTS_KEY, JSON.stringify(stored));
  }
  if (!Array.isArray(makeup)) {
    makeup = structuredClone(seedMakeupStudents);
    if (storage) storage.setItem(MAKEUP_KEY, JSON.stringify(makeup));
  }

  const regular = stored.filter(student => student && student.studentType !== 'makeup');
  const legacyMakeup = stored.filter(student => student && student.studentType === 'makeup').map(student => ({
    ...student,
    sourceClassName: student.sourceClassName || student.school || '',
    attendingClassId: student.attendingClassId || currentClassId,
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
        if (!scoreList.some(s => s.date === sc.date && s.classId === sc.classId)) scoreList.push(sc);
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
      parentContact: student.parentContact || { name: '', phone: '' },
      photoURL: student.photoURL || null,
      courseIds: student.courseIds || [],
      attendanceHistory: attHist,
      seatingHistory: seatHist,
      sessionNotes: sessNotes,
      scores: scoreList,
      notes: student.notes || [],
      tags: Array.isArray(student.tags) ? student.tags : (student.isNew && Date.now() - (student.createdAt || 0) < 21 * 86400000 ? ['Mới'] : []),
      learningNotes: student.learningNotes || ''
    };
  });

  const makeupRecords = [...(Array.isArray(makeup) ? makeup : []), ...legacyMakeup].filter(Boolean).map((student) => {
    const studentCode = (student.studentCode && String(student.studentCode).trim())
      ? String(student.studentCode).trim().toUpperCase()
      : null;

    const attHist = Array.isArray(student.attendanceHistory) ? [...student.attendanceHistory] : (Array.isArray(student.history) ? [...student.history] : []);
    const seatHist = Array.isArray(student.seatingHistory) ? [...student.seatingHistory] : [];
    const sessNotes = Array.isArray(student.sessionNotes) ? [...student.sessionNotes] : [];
    const scoreList = Array.isArray(student.scores) ? [...student.scores] : [];

    return {
      ...student,
      ...splitName(student),
      studentCode,
      sourceClassName: student.sourceClassName || student.school || '',
      attendingClassId: student.attendingClassId || currentClassId,
      parentContact: student.parentContact || { name: '', phone: '' },
      photoURL: student.photoURL || null,
      courseIds: student.courseIds || [],
      attendanceHistory: attHist,
      seatingHistory: seatHist,
      sessionNotes: sessNotes,
      scores: scoreList,
      notes: student.notes || [],
      tags: Array.isArray(student.tags) ? student.tags : [],
      learningNotes: student.learningNotes || '',
      studentType: 'makeup',
      classIds: []
    };
  });

  if (legacyMakeup.length && storage) {
    storage.setItem(STUDENTS_KEY, JSON.stringify(normalized));
    storage.setItem(MAKEUP_KEY, JSON.stringify(makeupRecords));
  }

  return { students: normalized, makeupStudents: makeupRecords };
}

export function saveStudentRecords(students, makeupStudents, storage = getStorage()) {
  const cleanStudents = (students || []).filter(Boolean).map(s => ({
    ...s,
    studentCode: (s.studentCode && String(s.studentCode).trim())
      ? String(s.studentCode).trim().toUpperCase()
      : null
  }));
  const cleanMakeups = (makeupStudents || []).filter(Boolean).map(s => ({
    ...s,
    studentCode: (s.studentCode && String(s.studentCode).trim())
      ? String(s.studentCode).trim().toUpperCase()
      : null
  }));

  if (storage) {
    storage.setItem(STUDENTS_KEY, JSON.stringify(cleanStudents));
    storage.setItem(MAKEUP_KEY, JSON.stringify(cleanMakeups));
  }
}
