// Storage boundary for student records. Synchronizes automatically via localStorage + realtime-sync.js.
const STUDENTS_KEY = 'lopvui.students.v7';
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
    school: 'THPT Việt Đức',
    classIds: ['class-math-8a-algebra', 'class-english-7b', 'class-tutoring'],
    parentContact: { name: 'Nguyễn Văn Hùng', phone: '0988123456' },
    learningNotes: 'Tư duy hình học tốt, cần rèn trình bày tự luận cẩn thận hơn.',
    scores: [
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 9, date: '2026-10-14', lessonTitle: 'Hình học: Đường thẳng song song với mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'Test', score: 9, date: '2026-10-07', lessonTitle: 'Kiểm tra chuyên đề: Giao tuyến và thiết diện' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 7, date: '2026-09-30', lessonTitle: 'Giới thiệu hình không gian (buổi 2)' },
      { classId: 'class-math-8a-algebra', type: 'Test', score: 9, date: '2026-09-23', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 8.5, date: '2026-09-23', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'Test', score: 9, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 8.5, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 7, date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: null, date: '2026-09-12', lessonTitle: 'Giới thiệu hình không gian (buổi 1)' },
      { classId: 'class-tutoring', type: 'Kiểm tra Gia sư', score: 8.5, date: '2026-10-05' },
      { classId: 'class-tutoring', type: 'Kiểm tra Bổ trợ', score: 9.0, date: '2026-10-01' }
    ],
    attendanceHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', status: 'present' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', status: 'present' },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', status: 'absent_excused', reason: 'Vắng' },
      { classId: 'class-tutoring', date: '2026-10-05', status: 'present', tutoringType: 'giasu', time: '14:00 - 15:15' },
      { classId: 'class-tutoring', date: '2026-10-01', status: 'present', tutoringType: 'tutoring', time: '15:30 - 16:45' }
    ],
    seatingHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', aisle: 1, desk: 1, position: 1 },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', aisle: 1, desk: 1, position: 1 }
    ],
    sessionNotes: [
      { classId: 'class-math-8a-algebra', date: '2026-10-14', lessonTitle: 'Hình học: Đường thẳng song song với mặt phẳng', homeworkStatus: 'graded', homeworkScore: 9, note: 'Hăng hái phát biểu' },
      { classId: 'class-math-8a-algebra', date: '2026-10-07', lessonTitle: 'Kiểm tra chuyên đề: Giao tuyến và thiết diện', homeworkStatus: 'uncollected', testScore: 9, note: '' },
      { classId: 'class-math-8a-algebra', date: '2026-09-30', lessonTitle: 'Giới thiệu hình không gian (buổi 2)', homeworkStatus: 'not_submitted', homeworkScore: 7, homeworkStatusNote: 'Có đi học (Không làm BTVN) - Đã làm bù BTVN', note: 'Đã làm bù BTVN' },
      { classId: 'class-math-8a-algebra', date: '2026-09-23', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng', homeworkStatus: 'graded', homeworkScore: 8.5, testScore: 9, attendanceStatusOverride: 'Có đi học', homeworkStatusNote: 'Vắng - Đã học bù T5', note: '' },
      { classId: 'class-math-8a-algebra', date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng', homeworkStatus: 'graded', homeworkScore: 8.5, testScore: 9, attendanceStatusOverride: 'Có đi học', homeworkStatusNote: 'Vắng - Đã học bù T5', note: '' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)', homeworkStatus: 'not_submitted', homeworkScore: 7, homeworkStatusNote: 'Có đi học (Không làm BTVN) - Đã làm bù BTVN', note: 'Đã làm bù BTVN' },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', lessonTitle: 'Giới thiệu hình không gian (buổi 1)', homeworkStatus: 'uncollected', homeworkScore: null, homeworkStatusNote: 'Vắng', note: '' },
      { classId: 'class-tutoring', date: '2026-10-05', tutoringId: 'tutor-20261005-01', tutoringType: 'giasu', lessonTitle: 'Dạy kèm gia sư 1-1: Rút gọn phân thức đại số nâng cao và tìm điều kiện xác định', previousHomeworkCheck: 'Đã hoàn thành 10/10 câu BTVN buổi trước; sai câu 4 về phân thức đã được chữa kỹ và hiểu bài.', homeworkStatus: 'completed', homeworkScore: 8.5, note: 'Nắm chắc phương pháp phân tích đa thức thành nhân tử để rút gọn. Bài test tại chỗ đạt 8.5/10.', assistantName: 'Anh Linh' },
      { classId: 'class-tutoring', date: '2026-10-01', tutoringId: 'tutor-20261001-04', tutoringType: 'tutoring', lessonTitle: 'Bổ trợ đại số: Hằng đẳng thức đáng nhớ số 4 và số 5', previousHomeworkCheck: 'Đã hoàn thành phiếu bài tập ôn tập chương I.', homeworkStatus: 'completed', homeworkScore: 9.0, note: 'Thuộc hằng đẳng thức, vận dụng tính nhanh tốt.', assistantName: 'Anh Linh' }
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
    learningNotes: 'Học đều, ghi chép vở sạch đẹp, luôn nộp BTVN đúng hạn.',
    scores: [
      { classId: 'class-math-8a-algebra', type: 'Test', score: 9, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 8, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: null, date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 7.5, date: '2026-09-12', lessonTitle: 'Giới thiệu hình không gian (buổi 1)' },
      { classId: 'class-tutoring', type: 'Kiểm tra Bổ trợ', score: 7.5, date: '2026-10-04' }
    ],
    attendanceHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', status: 'present' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', status: 'absent_excused' },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', status: 'present' },
      { classId: 'class-tutoring', date: '2026-10-04', status: 'present', tutoringType: 'tutoring', time: '17:30 - 18:45' }
    ],
    seatingHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', aisle: 1, desk: 2, position: 1 },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', aisle: 1, desk: 2, position: 1 }
    ],
    sessionNotes: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng', homeworkStatus: 'graded', homeworkScore: 8, testScore: 9, note: 'Ghi chép cẩn thận' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)', homeworkStatus: 'uncollected', homeworkScore: null, homeworkStatusNote: 'Vắng - Xin phép nghỉ ốm', note: 'Xin phép nghỉ ốm' },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', lessonTitle: 'Giới thiệu hình không gian (buổi 1)', homeworkStatus: 'graded', homeworkScore: 7.5, note: 'Làm bài cẩn thận' },
      { classId: 'class-tutoring', date: '2026-10-04', tutoringId: 'tutor-20261004-02', tutoringType: 'tutoring', lessonTitle: 'Bổ trợ hình học: Tính chất đường trung bình và hình thang cân', previousHomeworkCheck: 'Quên vở bài tập buổi trước, đã kiểm tra bù trực tiếp trên lớp và làm đúng 4/5 bài.', homeworkStatus: 'assigned_more', homeworkScore: 7.5, note: 'Hiểu tính chất nhưng vẽ hình còn chậm.', assistantName: 'Mai Anh' }
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
    learningNotes: 'Nền tảng vững, mục tiêu 9+ đại học.',
    scores: [
      { classId: 'class-math-12-exam', type: 'Test', score: 9.5, date: '2026-09-26', lessonTitle: 'Cực trị hàm số bậc ba' },
      { classId: 'class-math-12-exam', type: 'BTVN', score: 9, date: '2026-09-26', lessonTitle: 'Cực trị hàm số bậc ba' },
      { classId: 'class-math-12-exam', type: 'BTVN', score: 8.5, date: '2026-09-19', lessonTitle: 'Tính đơn điệu của hàm số' },
      { classId: 'class-math-12-exam', type: 'BTVN', score: 10, date: '2026-09-12', lessonTitle: 'Khảo sát sự biến thiên hàm số' },
      { classId: 'class-tutoring', type: 'Kiểm tra Gia sư', score: 9.5, date: '2026-10-02' }
    ],
    attendanceHistory: [
      { classId: 'class-tutoring', date: '2026-10-02', status: 'present', tutoringType: 'giasu', time: '09:00 - 10:15' },
      { classId: 'class-math-12-exam', date: '2026-09-26', status: 'present' }
    ],
    seatingHistory: [{ classId: 'class-math-12-exam', date: '2026-09-26', aisle: 2, desk: 1, position: 1 }],
    sessionNotes: [
      { classId: 'class-tutoring', date: '2026-10-02', tutoringId: 'tutor-20261002-03', tutoringType: 'giasu', lessonTitle: 'Dạy kèm gia sư 1-1: Cực trị hàm hợp và hàm ẩn nâng cao ôn thi ĐH', previousHomeworkCheck: 'Làm đầy đủ bài tập khảo sát hàm số, trình bày chuẩn xác.', homeworkStatus: 'completed', homeworkScore: 9.5, note: 'Tư duy giải toán tốt.', assistantName: 'Anh Linh' },
      { classId: 'class-math-12-exam', date: '2026-09-26', lessonTitle: 'Cực trị hàm số bậc ba', homeworkStatus: 'graded', homeworkScore: 9, testScore: 9.5 }
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
    learningNotes: 'Học sinh mới vào lớp, cần kèm thêm phần mệnh đề tập hợp.',
    scores: [
      { classId: 'class-math-10a', type: 'Test', score: 8, date: '2026-09-26', lessonTitle: 'Các phép toán tập hợp' },
      { classId: 'class-math-10a', type: 'BTVN', score: 7.5, date: '2026-09-19', lessonTitle: 'Tập hợp và biểu diễn tập hợp' }
    ],
    attendanceHistory: [{ classId: 'class-math-10a', date: '2026-09-26', status: 'late', minutesLate: 10, lateMinutes: 10 }],
    seatingHistory: [{ classId: 'class-math-10a', date: '2026-09-26', aisle: 1, desk: 3, position: 2 }],
    sessionNotes: [{ classId: 'class-math-10a', date: '2026-09-26', lessonTitle: 'Các phép toán tập hợp', homeworkStatus: 'not_submitted', homeworkReason: 'Quên vở' }],
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
    learningNotes: 'Hay quên vở BTVN, cần kiểm tra sát sao đầu giờ.',
    scores: [
      { classId: 'class-math-8a-algebra', type: 'Test', score: 7.5, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: null, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 8, date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 6.5, date: '2026-09-12', lessonTitle: 'Giới thiệu hình không gian (buổi 1)' }
    ],
    attendanceHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', status: 'late', minutesLate: 10, lateMinutes: 10 },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', status: 'present' },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', status: 'present' }
    ],
    seatingHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', aisle: 2, desk: 2, position: 1 },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', aisle: 2, desk: 2, position: 1 }
    ],
    sessionNotes: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng', homeworkStatus: 'not_submitted', homeworkReason: 'Quên vở', homeworkScore: null, testScore: 7.5, homeworkStatusNote: 'Có đi học (Không làm BTVN) - Quên mang vở', note: 'Đi muộn 10p do kẹt xe' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)', homeworkStatus: 'graded', homeworkScore: 8, note: 'Cần chú ý bài tính nhanh' },
      { classId: 'class-math-8a-algebra', date: '2026-09-12', lessonTitle: 'Giới thiệu hình không gian (buổi 1)', homeworkStatus: 'graded', homeworkScore: 6.5, note: 'Cần rèn thêm biến đổi' }
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
    learningNotes: 'Tiếp thu nhanh, luôn đạt điểm tối đa bài kiểm tra.',
    scores: [
      { classId: 'class-physics-11b', type: 'Test', score: 10, date: '2026-10-04', lessonTitle: 'Định luật Cu-lông và điện trường' },
      { classId: 'class-physics-11b', type: 'BTVN', score: 9.5, date: '2026-10-04', lessonTitle: 'Định luật Cu-lông và điện trường' }
    ],
    attendanceHistory: [{ classId: 'class-physics-11b', date: '2026-10-04', status: 'present' }],
    seatingHistory: [{ classId: 'class-physics-11b', date: '2026-10-04', aisle: 1, desk: 1, position: 1 }],
    sessionNotes: [{ classId: 'class-physics-11b', date: '2026-10-04', lessonTitle: 'Định luật Cu-lông và điện trường', homeworkStatus: 'graded', homeworkScore: 9.5, testScore: 10 }],
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
    sourceClassName: 'T2',
    attendingClassId: 'class-math-8a-algebra',
    classIds: [],
    parentContact: { name: 'Hoàng Văn Minh', phone: '0918223344' },
    learningNotes: 'Học sinh ca Thứ 2 sang học bù, nắm bài khá.',
    scores: [
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 8, date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng' },
      { classId: 'class-math-8a-algebra', type: 'BTVN', score: 7.5, date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)' }
    ],
    attendanceHistory: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', status: 'present' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', status: 'present' }
    ],
    seatingHistory: [],
    sessionNotes: [
      { classId: 'class-math-8a-algebra', date: '2026-09-26', lessonTitle: 'Tìm giao tuyến 2 mặt phẳng', homeworkStatus: 'graded', homeworkScore: 8, note: 'Đi học bù đúng giờ' },
      { classId: 'class-math-8a-algebra', date: '2026-09-19', lessonTitle: 'Giới thiệu hình không gian (buổi 2)', homeworkStatus: 'graded', homeworkScore: 7.5, note: '' }
    ],
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
    sourceClassName: student.sourceClassName || student.school || 'T2',
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
      parentContact: student.parentContact || { name: '', phone: '' },
      photoURL: student.photoURL || null,
      courseIds: student.courseIds || [],
      attendanceHistory: attHist,
      seatingHistory: seatHist,
      sessionNotes: sessNotes,
      scores: scoreList,
      notes: student.notes || [],
      tags: Array.isArray(student.tags) ? student.tags : (student.isNew && Date.now() - (student.createdAt || 0) < 21 * 86400000 ? ['Mới'] : []),
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
      parentContact: student.parentContact || { name: '', phone: '' },
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
