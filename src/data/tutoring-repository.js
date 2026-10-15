// Repository for Tutoring and Makeup Sessions (Lớp bổ trợ & Học bù - 1 kèm 1 / nhóm nhỏ).
// Stored in localStorage, ready for Cloud Firestore collection 'tutoringSessions'.
const TUTORING_KEY = 'lopvui.tutoring-sessions.v1';

export const TUTORING_CLASS_ID = 'class-tutoring';
export const TUTORING_CLASS_CONFIG = {
  id: 'class-tutoring',
  code: 'BOTRO',
  name: 'Lớp Bổ trợ & Gia sư',
  subject: 'Bổ trợ & Gia sư 1-1',
  grade: 'Toàn khối',
  teacherName: 'Đội ngũ Trợ giảng & Gia sư',
  room: 'Phòng Bổ trợ'
};

export const sampleTutoringSessions = [
  {
    id: 'tutor-20261005-01',
    date: '2026-10-05',
    startTime: '14:00',
    endTime: '15:15',
    assistantId: 'employee-ta-001',
    assistantName: 'Anh Linh',
    studentId: 'stu-seed-01',
    studentName: 'Nguyễn Minh Quân',
    studentClass: 'Toán 8A',
    studentSchool: 'THCS Cầu Giấy',
    type: 'giasu', // 'giasu' (Gia sư 1-1) | 'tutoring' (Bổ trợ) | 'makeup' (Học bù) | 'new' (Học mới)
    previousHomeworkCheck: 'Đã hoàn thành 10/10 câu BTVN buổi trước; sai câu 4 về phân thức đã được chữa kỹ và hiểu bài.',
    lessonContent: 'Dạy kèm gia sư 1-1: Rút gọn phân thức đại số nâng cao và tìm điều kiện xác định',
    homeworkStatus: 'completed',
    evaluation: 'Nắm chắc phương pháp phân tích đa thức thành nhân tử để rút gọn. Bài test tại chỗ đạt 8.5/10.',
    score: 8.5,
    createdAt: 1728114000000
  },
  {
    id: 'tutor-20261004-02',
    date: '2026-10-04',
    startTime: '17:30',
    endTime: '18:45',
    assistantId: 'employee-ta-002',
    assistantName: 'Mai Anh',
    studentId: 'stu-seed-02',
    studentName: 'Trần Bảo Ngọc',
    studentClass: 'Toán 8A',
    studentSchool: 'THCS Yên Hòa',
    type: 'tutoring',
    previousHomeworkCheck: 'Quên vở bài tập buổi trước, đã kiểm tra bù trực tiếp trên lớp và làm đúng 4/5 bài.',
    lessonContent: 'Bổ trợ hình học: Tính chất đường trung bình và hình thang cân',
    homeworkStatus: 'assigned_more',
    evaluation: 'Hiểu tính chất nhưng vẽ hình còn chậm. Đã giao thêm 1 phiếu vẽ hình và chứng minh về nhà.',
    score: 7.5,
    createdAt: 1728027600000
  },
  {
    id: 'tutor-20261002-03',
    date: '2026-10-02',
    startTime: '09:00',
    endTime: '10:15',
    assistantId: 'employee-ta-001',
    assistantName: 'Anh Linh',
    studentId: 'stu-seed-03',
    studentName: 'Lê Hoàng Nam',
    studentClass: 'Toán 12A',
    studentSchool: 'THPT Chu Văn An',
    type: 'giasu',
    previousHomeworkCheck: 'Làm đầy đủ bài tập khảo sát hàm số, trình bày chuẩn xác.',
    lessonContent: 'Dạy kèm gia sư 1-1: Cực trị hàm hợp và hàm ẩn nâng cao ôn thi ĐH',
    homeworkStatus: 'completed',
    evaluation: 'Tư duy giải toán tốt, nắm vững phương pháp sơ đồ V và ghép trục. Bài test đạt 9.5.',
    score: 9.5,
    createdAt: 1727856000000
  },
  {
    id: 'tutor-20261001-04',
    date: '2026-10-01',
    startTime: '15:30',
    endTime: '16:45',
    assistantId: 'employee-ta-001',
    assistantName: 'Anh Linh',
    studentId: 'stu-seed-01',
    studentName: 'Nguyễn Minh Quân',
    studentClass: 'Toán 8A',
    studentSchool: 'THCS Cầu Giấy',
    type: 'tutoring',
    previousHomeworkCheck: 'Đã hoàn thành phiếu bài tập ôn tập chương I.',
    lessonContent: 'Bổ trợ đại số: Hằng đẳng thức đáng nhớ số 4 và số 5',
    homeworkStatus: 'completed',
    evaluation: 'Thuộc hằng đẳng thức, vận dụng tính nhanh tốt. Tiếp thu tích cực.',
    score: 9.0,
    createdAt: 1727769600000
  }
];

export function loadTutoringSessions(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    if (storage) {
      const saved = JSON.parse(storage.getItem(TUTORING_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) {
        return saved;
      }
    }
  } catch {}
  if (storage) {
    storage.setItem(TUTORING_KEY, JSON.stringify(sampleTutoringSessions));
  }
  return structuredClone(sampleTutoringSessions);
}

export function saveTutoringSessions(sessions, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (storage) {
    storage.setItem(TUTORING_KEY, JSON.stringify(sessions));
  }
}
