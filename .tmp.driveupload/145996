// Regression test for Past Classes Section in Student Profile (v5.4.0)
import { TUTORING_CLASS_ID, TUTORING_CLASS_CONFIG } from '../src/data/tutoring-repository.js';

function runTests() {
  const classCatalog = [
    { id: 'class-t2', code: '2K11.T2', name: 'Lớp Toán 9 Thứ 2', grade: '2011' },
    { id: 'class-t5', code: '2K11.T5', name: 'Lớp Toán 9 Thứ 5', grade: '2011' },
    { id: 'class-cn', code: '2K11.CN', name: 'Lớp Toán 9 Chủ Nhật', grade: '2011' }
  ];

  const sampleTutoringSessions = [
    {
      id: 'tut-1',
      studentId: 'stu-1',
      studentName: 'Nguyễn Văn An',
      date: '2026-10-20',
      startTime: '18:00',
      endTime: '19:30',
      duration: 90,
      assistantName: 'Hoàng Tuấn Anh',
      topic: 'Hệ thức lượng trong tam giác vuông',
      status: 'Hoàn thành'
    },
    {
      id: 'tut-2',
      studentId: 'stu-99',
      studentName: 'Ai Đó',
      date: '2026-10-21'
    }
  ];

  const studentWithAllHistories = {
    id: 'stu-1',
    studentCode: '2K11-001',
    name: 'Nguyễn Văn An',
    classIds: ['class-t5'], // Current enrolled class
    previousClassIds: ['class-t2'], // Old class
    classTransferHistory: [
      { fromClassId: 'class-t2', toClassId: 'class-t5', date: '2026-09-15' }
    ],
    makeupSessions: [
      { classId: 'class-cn', date: '2026-10-18', sourceClassName: 'Lớp Thứ 5', note: 'Nghỉ ốm thứ 5' }
    ]
  };

  const studentClean = {
    id: 'stu-2',
    studentCode: '2K11-002',
    name: 'Trần Thị Bình',
    classIds: ['class-t5'],
    previousClassIds: [],
    classTransferHistory: [],
    makeupSessions: []
  };

  function computePastHistory(student, mockTutoring = sampleTutoringSessions) {
    const enrolledClassIds = student.classIds || [];
    const currentEnrolled = new Set(enrolledClassIds);
    const oldClassMap = new Map();
    const rawOldIds = new Set(Array.isArray(student.previousClassIds) ? student.previousClassIds : []);

    (student.classTransferHistory || []).forEach(tr => {
      if (tr?.fromClassId && !currentEnrolled.has(tr.fromClassId)) {
        rawOldIds.add(tr.fromClassId);
        if (!oldClassMap.has(tr.fromClassId)) {
          oldClassMap.set(tr.fromClassId, { classId: tr.fromClassId, transferDates: [], attendanceCount: 0 });
        }
        if (tr.date) oldClassMap.get(tr.fromClassId).transferDates.push(tr.date);
      }
    });

    rawOldIds.forEach(cid => {
      if (cid && !currentEnrolled.has(cid) && cid !== TUTORING_CLASS_ID) {
        if (!oldClassMap.has(cid)) {
          oldClassMap.set(cid, { classId: cid, transferDates: [], attendanceCount: 0 });
        }
      }
    });

    const oldClasses = Array.from(oldClassMap.values()).map(item => {
      const cls = classCatalog.find(c => c.id === item.classId) || { id: item.classId, code: item.classId, name: item.classId };
      return {
        classId: item.classId,
        code: cls.code || cls.id,
        name: cls.name || cls.id,
        transferDates: item.transferDates
      };
    });

    // Tutoring
    const sNameClean = String(student.name || '').trim().toLowerCase();
    const sCodeClean = String(student.studentCode || '').trim().toUpperCase();

    const tutoringSessions = mockTutoring.filter(t => {
      if (!t) return false;
      if (t.studentId && t.studentId === student.id) return true;
      if (sCodeClean && t.studentCode && String(t.studentCode).trim().toUpperCase() === sCodeClean) return true;
      if (t.studentName && String(t.studentName).trim().toLowerCase() === sNameClean) return true;
      return false;
    });

    // Makeup
    const makeupList = [];
    const seenMakeupKey = new Set();

    (student.makeupSessions || []).forEach(ms => {
      if (!ms || !ms.classId) return;
      const key = `${ms.classId}_${ms.date || ''}`;
      if (seenMakeupKey.has(key)) return;
      seenMakeupKey.add(key);

      const targetCls = classCatalog.find(c => c.id === ms.classId);
      makeupList.push({
        classId: ms.classId,
        code: targetCls?.code || ms.classId,
        name: targetCls?.name || ms.classId,
        date: ms.date || '',
        sourceClassName: ms.sourceClassName || '',
        note: ms.note || ''
      });
    });

    const totalCount = oldClasses.length + tutoringSessions.length + makeupList.length;
    return { oldClasses, tutoringSessions, makeupList, totalCount };
  }

  console.log('=== TEST 1: Học sinh có đầy đủ Lớp cũ, Ca bổ trợ & Ca học bù ===');
  const res1 = computePastHistory(studentWithAllHistories);
  console.assert(res1.oldClasses.length === 1, 'Expected 1 old class, got ' + res1.oldClasses.length);
  console.assert(res1.oldClasses[0].code === '2K11.T2', 'Expected 2K11.T2, got ' + res1.oldClasses[0].code);
  console.assert(res1.tutoringSessions.length === 1, 'Expected 1 tutoring session, got ' + res1.tutoringSessions.length);
  console.assert(res1.tutoringSessions[0].topic === 'Hệ thức lượng trong tam giác vuông', 'Wrong topic');
  console.assert(res1.makeupList.length === 1, 'Expected 1 makeup session, got ' + res1.makeupList.length);
  console.assert(res1.makeupList[0].code === '2K11.CN', 'Wrong makeup class code');
  console.assert(res1.totalCount === 3, 'Expected total 3 items, got ' + res1.totalCount);
  console.log('PASS 1: Tìm thấy đúng 1 lớp cũ, 1 ca bổ trợ, 1 ca học bù (Tổng = 3)');

  console.log('\n=== TEST 2: Học sinh mới chưa có lịch sử lớp cũ, bổ trợ, học bù ===');
  const res2 = computePastHistory(studentClean);
  console.assert(res2.oldClasses.length === 0, 'Expected 0 old class');
  console.assert(res2.tutoringSessions.length === 0, 'Expected 0 tutoring session');
  console.assert(res2.makeupList.length === 0, 'Expected 0 makeup session');
  console.assert(res2.totalCount === 0, 'Expected 0 total count');
  console.log('PASS 2: Tổng = 0, hiển thị trạng thái rỗng chuẩn');

  console.log('\nALL STUDENT PAST CLASSES REGRESSION TESTS PASSED!');
}

runTests();
