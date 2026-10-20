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

export const sampleTutoringSessions = [];

export function loadTutoringSessions(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    if (storage) {
      const saved = JSON.parse(storage.getItem(TUTORING_KEY) || 'null');
      if (Array.isArray(saved)) {
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
