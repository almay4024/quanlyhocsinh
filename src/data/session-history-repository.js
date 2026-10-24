// Repository boundary for Class Session Histories, Open/Close session state,
// Real-time Active Session Sync, No-Homework detection, and Staff Shift tracking.

const SESSION_HISTORY_KEY = 'lopvui.session-history.v2';
const SESSION_OVERRIDES_KEY = 'lopvui.session-overrides.v1';

export const seedSessionHistory = [];

export function getIndividualSessionKey(classId, date) {
  return `lopvui.session-record.v1.${classId}.${date}`;
}

export function loadSessionHistory(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    if (storage) {
      const raw = storage.getItem(SESSION_HISTORY_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
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
  if (storage && Array.isArray(history)) {
    const slim = history.map(rec => {
      if (!rec || typeof rec !== 'object') return rec;
      const needCleanAudit = 'adminAuditLogs' in rec;
      const needCleanTomb = rec.status === 'closed' && rec.deskItems && typeof rec.deskItems === 'object' && ('__tombstones' in rec.deskItems);
      if (!needCleanAudit && !needCleanTomb) return rec;
      const copy = { ...rec };
      delete copy.adminAuditLogs;
      if (needCleanTomb) {
        const cleanDesks = { ...copy.deskItems };
        delete cleanDesks.__tombstones;
        copy.deskItems = cleanDesks;
      }
      return copy;
    });
    storage.setItem(SESSION_HISTORY_KEY, JSON.stringify(slim));
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
  record.homeworkLink = snapshotData.homeworkLink ?? record.homeworkLink ?? '';
  record.notebookLink = snapshotData.notebookLink ?? record.notebookLink ?? '';
  record.updatedBy = operator;
  record.revision = (Number(record.revision) || 0) + 1;
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
  record.homeworkLink = snapshotData.homeworkLink || record.homeworkLink || '';
  record.notebookLink = snapshotData.notebookLink || record.notebookLink || '';
  record.updatedBy = operator;
  record.revision = (Number(record.revision) || 0) + 1;
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
      reason: 'Đã chọn thủ công'
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
  (student.makeupSessions || []).forEach(ms => {
    if (ms && ms.classId === classId && ms.date) sessionDatesSet.add(ms.date);
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
    const scTest = (student.scores || []).find(s => (s.classId === classId || !s.classId) && s.date === date && s.type && s.type !== 'BTVN');
    const scBtvn = (student.scores || []).find(s => (s.classId === classId || !s.classId) && s.date === date && (!s.type || s.type === 'BTVN'));
    const seat = (student.seatingHistory || []).find(s => (s.classId === classId || !s.classId) && s.date === date);
    const makeupRec = (student.makeupSessions || []).find(ms => ms && ms.classId === classId && ms.date === date);
    const isMakeupSession = Boolean(makeupRec || att?.isMakeup || sn?.isMakeup || !(student.classIds || []).includes(classId));

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
    const hwScore = snap?.homework?.score ?? sn?.homeworkScore ?? scBtvn?.score ?? null;
    if (hwStatus === 'submitted' || hwStatus === 'graded') hwSubmitted++;
    else if (hwStatus === 'not_submitted') hwMissing++;

    const testScore = snap?.testScore ?? sn?.testScore ?? scTest?.score ?? null;
    if (testScore !== null && testScore !== undefined) {
      scoresInClass.push({ classId, date, type: scTest?.type || 'Kiểm tra', score: Number(testScore) });
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
      isMakeupSession,
      makeupSourceClassName: makeupRec?.sourceClassName || att?.sourceClassName || '',
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
    ? (scoresInClass.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / scoresInClass.length).toFixed(1).replace('.', ',').replace('.', ',')
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

export function getPreviousSessionSeatingRecord(classId, currentDate, historyArg = null) {
  if (!classId) return null;
  const history = Array.isArray(historyArg) ? historyArg : loadSessionHistory();
  const candidates = history
    .filter(s => s && s.classId === classId && s.date && s.date !== currentDate)
    .sort((a, b) => {
      const aBefore = a.date < currentDate ? 1 : 0;
      const bBefore = b.date < currentDate ? 1 : 0;
      if (aBefore !== bBefore) return bBefore - aBefore;
      return String(b.date).localeCompare(String(a.date));
    });

  for (const sess of candidates) {
    if (sess.deskItems && typeof sess.deskItems === 'object') {
      const hasSeated = Object.values(sess.deskItems).some(arr => Array.isArray(arr) && arr.some(e => e && e.studentId));
      if (hasSeated) return sess;
    }
  }
  return null;
}

export function evaluateStudentEarlyWarning(student, classId = null, historyArg = null) {
  if (!student) {
    return {
      hasWarning: false,
      level: 0,
      autoLevel: 0,
      violationCount: 0,
      isManual: false,
      customNoteTag: '',
      reasons: [],
      badgeText: '',
      shortTag: '',
      tooltip: '',
      attendedCount: 0,
      totalRecordedCount: 0
    };
  }
  const attList = (student.attendanceHistory || []).filter(h => !classId || !h.classId || h.classId === classId);
  const noteList = (student.sessionNotes || []).filter(n => !classId || !n.classId || n.classId === classId);
  const scoreList = (student.scores || []).filter(sc => !classId || !sc.classId || sc.classId === classId);

  const dateSet = new Set();
  attList.forEach(h => { if (h?.date) dateSet.add(h.date); });
  noteList.forEach(n => { if (n?.date) dateSet.add(n.date); });
  scoreList.forEach(sc => { if (sc?.date) dateSet.add(sc.date); });

  const sortedDates = Array.from(dateSet).sort((a, b) => String(b).localeCompare(String(a)));
  let attendedCount = 0;

  sortedDates.forEach(d => {
    const att = attList.find(h => h.date === d);
    const st = att?.status || 'present';
    if (st === 'present' || st === 'late') attendedCount++;
  });

  const formatShortD = (dStr) => {
    const m = String(dStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}` : String(dStr || '');
  };

  // Chỉ tính lỗi trong 4 buổi gần nhất (1 lỗi = Mức 1, 2 lỗi = Mức 2, 3 lỗi = Mức 3, >= 4 lỗi = Mức 4)
  const recent4 = sortedDates.slice(0, 4);
  const violations = [];

  recent4.forEach(d => {
    const att = attList.find(h => h.date === d);
    const sn = noteList.find(n => n.date === d);
    const st = att?.status;
    const shortD = formatShortD(d);

    if (st === 'absent' || st === 'absent_excused' || st === 'absent_unexcused') {
      violations.push(`Vắng (${shortD})`);
    } else if (st === 'late') {
      const mins = Number(att?.lateMinutes ?? att?.minutesLate ?? 0);
      violations.push(mins > 0 ? `Muộn ${mins}p (${shortD})` : `Đi muộn (${shortD})`);
    }

    const hwSt = sn?.homeworkStatus || att?.homework?.status;
    if (hwSt === 'not_submitted') {
      violations.push(`Nợ BTVN (${shortD})`);
    }

    const dayScores = scoreList.filter(sc => sc.date === d).map(sc => Number(sc.score)).filter(n => !Number.isNaN(n));
    if (sn?.homeworkScore !== null && sn?.homeworkScore !== undefined && sn?.homeworkScore !== '') {
      const n = Number(String(sn.homeworkScore).replace(',', '.'));
      if (!Number.isNaN(n)) dayScores.push(n);
    }
    if (dayScores.length && Math.min(...dayScores) < 5) {
      violations.push(`Điểm < 5 (${shortD})`);
    }
  });

  const autoViolationCount = violations.length;
  const autoLevel = autoViolationCount >= 4 ? 4 : autoViolationCount;

  // Hỗ trợ ghi đè (chỉnh sửa) mức cảnh báo & tag lưu ý ngắn gọn theo lớp hoặc toàn cục
  const clsCfg = (classId && student.classWarningConfig && student.classWarningConfig[classId])
    ? student.classWarningConfig[classId]
    : null;
  const globalCfg = student.warningConfig || null;
  const activeCfg = clsCfg || globalCfg || null;

  const isManual = Boolean(activeCfg && activeCfg.mode === 'manual' && activeCfg.manualLevel !== undefined && activeCfg.manualLevel !== null);
  const effectiveLevel = isManual
    ? Math.max(0, Math.min(4, Number(activeCfg.manualLevel) || 0))
    : autoLevel;
  const customNoteTag = String(activeCfg?.customNoteTag ?? student.warningNoteTag ?? '').trim();

  const hasWarning = effectiveLevel > 0 || Boolean(customNoteTag);
  const levelLabel = effectiveLevel > 0 ? `Mức ${effectiveLevel}` : '';
  const shortTag = levelLabel && customNoteTag
    ? `${levelLabel} · ${customNoteTag}`
    : (levelLabel || customNoteTag);

  const reasons = [...violations];
  if (customNoteTag && !reasons.includes(customNoteTag)) {
    reasons.unshift(`Lưu ý: ${customNoteTag}`);
  }

  const tooltipParts = [];
  if (effectiveLevel > 0) {
    tooltipParts.push(`Cảnh báo ${levelLabel}${isManual ? ' (Gán thủ công)' : ` (${autoViolationCount} lỗi / 4 buổi gần nhất)`}`);
  }
  if (violations.length) {
    tooltipParts.push(`Chi tiết lỗi 4 buổi gần nhất: ${violations.join(', ')}`);
  }
  if (customNoteTag) {
    tooltipParts.push(`Lưu ý: ${customNoteTag}`);
  }

  return {
    hasWarning,
    level: effectiveLevel,
    autoLevel,
    violationCount: autoViolationCount,
    isManual,
    customNoteTag,
    reasons,
    badgeText: shortTag,
    shortTag,
    tooltip: tooltipParts.join(' — ') || 'Bấm để chỉnh sửa mức cảnh báo & lưu ý học sinh',
    attendedCount,
    totalRecordedCount: sortedDates.length
  };
}

// ============================================================================
// ADMIN SESSION DATA AUDIT LOG REPOSITORY (v4.1 - ADMIN ONLY)
// Records every data-mutating action per (classId, date) with exact account info
// ============================================================================
export function getAdminAuditLogKey(classId, date) {
  return `lopvui.admin-audit-log.v1.${classId}.${date}`;
}

export function loadSessionAdminAuditLogs(classId, date, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!classId || !date) return [];
  const key = getAdminAuditLogKey(classId, date);
  let directLogs = [];
  try {
    if (storage) {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) directLogs = parsed;
      }
    }
  } catch {}

  let histLogs = [];
  try {
    const rec = getSessionRecord(classId, date, storage);
    if (rec && Array.isArray(rec.adminAuditLogs)) {
      histLogs = rec.adminAuditLogs;
    }
  } catch {}

  if (!directLogs.length && !histLogs.length) return [];
  const mergedMap = new Map();
  [...histLogs, ...directLogs].forEach(item => {
    if (item && item.id) mergedMap.set(item.id, item);
  });
  return Array.from(mergedMap.values()).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

export function appendSessionAdminAuditLog({
  classId,
  date,
  actor = {},
  category = 'session',
  action = '',
  detail = '',
  dedupeKey = ''
}, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!classId || !date || !action) return null;
  const now = Date.now();
  const key = getAdminAuditLogKey(classId, date);
  const existing = loadSessionAdminAuditLogs(classId, date, storage);

  const actorId = String(actor?.id || actor?.employeeId || 'unknown');
  const actorCode = String(actor?.code || 'NV').trim().toUpperCase();
  const actorName = String(actor?.name || 'Nhân sự').trim();
  const actorRole = String(actor?.role || 'assistant').trim();

  // If dedupeKey is provided (e.g. typing a score or note), update the most recent matching log from the same actor within 6 seconds
  if (dedupeKey && existing.length > 0) {
    const recentIdx = existing.findIndex(e =>
      e && e.actorId === actorId && e.dedupeKey === dedupeKey && (now - (Number(e.timestamp) || 0) < 6000)
    );
    if (recentIdx >= 0) {
      existing[recentIdx] = {
        ...existing[recentIdx],
        timestamp: now,
        actorCode,
        actorName,
        actorRole,
        category,
        action: String(action).trim(),
        detail: String(detail || '').trim()
      };
      const trimmed = existing.slice(0, 500);
      if (storage) {
        try { storage.setItem(key, JSON.stringify(trimmed)); } catch {}
      }
      return existing[recentIdx];
    }
  }

  // Prevent exact duplicate log spam within 1200ms
  const latest = existing[0];
  if (
    latest &&
    latest.actorId === actorId &&
    latest.action === String(action).trim() &&
    latest.detail === String(detail || '').trim() &&
    (now - (Number(latest.timestamp) || 0) < 1200)
  ) {
    return latest;
  }

  const entry = {
    id: `alog-${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    classId,
    date,
    actorId,
    actorCode,
    actorName,
    actorRole,
    category,
    action: String(action).trim(),
    detail: String(detail || '').trim(),
    ...(dedupeKey ? { dedupeKey } : {})
  };

  const nextLogs = [entry, ...existing].slice(0, 500);
  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(nextLogs));
    } catch {}
  }

  // Không nhân bản 250 log vào lopvui.session-history.v2 để tránh làm phình dung lượng session-history.v2 và tránh đẩy lại cả cục lịch sử mỗi lần ghi log!

  return entry;
}
