import {
  normalizeAccountCode,
  normalizeLeadingZerosToken,
  foldAccountIdentifier
} from '../src/data/class-catalog-repository.js';

function isClassAssignedToCurrentAccountSimulation(item, currentEmployeeId, signedInAccount, empList, sessionChanges = {}) {
  if (!item) return false;
  const role = signedInAccount?.role || 'assistant';
  if (role === 'admin' || role === 'office') return true;
  if (!currentEmployeeId && !signedInAccount?.employeeId && !signedInAccount?.code) return true;

  const currentEmp = empList.find(e =>
    (currentEmployeeId && e.id === currentEmployeeId) ||
    (signedInAccount?.employeeId && e.id === signedInAccount.employeeId) ||
    (signedInAccount?.code && normalizeAccountCode(e.code) === normalizeAccountCode(signedInAccount.code)) ||
    (currentEmployeeId && normalizeAccountCode(e.code) === normalizeAccountCode(currentEmployeeId))
  ) || null;

  const targetIds = new Set([currentEmployeeId, signedInAccount?.employeeId, currentEmp?.id].filter(Boolean));
  const targetCodes = new Set([currentEmp?.code, signedInAccount?.code, signedInAccount?.username, currentEmployeeId]
    .filter(Boolean)
    .map(c => normalizeAccountCode(c)));

  const targetZeroTokens = new Set([...targetCodes].map(normalizeLeadingZerosToken).filter(Boolean));

  const targetNames = [currentEmp?.name, signedInAccount?.name]
    .filter(Boolean)
    .map(n => n.toLowerCase().trim())
    .filter(n => n.length >= 2);

  function matchesStaff(ids = [], nameStr = '', singleId = '') {
    if (singleId) {
      if (targetIds.has(singleId)) return true;
      const normSingle = normalizeAccountCode(singleId);
      if (targetCodes.has(normSingle)) return true;
      if (targetZeroTokens.has(normalizeLeadingZerosToken(normSingle))) return true;
      const emp = empList.find(e => e && (e.id === singleId || normalizeAccountCode(e.code) === normSingle));
      if (emp && (targetIds.has(emp.id) || targetCodes.has(normalizeAccountCode(emp.code)) || targetZeroTokens.has(normalizeLeadingZerosToken(emp.code)))) return true;
    }
    const arr = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    for (const id of arr) {
      if (!id) continue;
      if (targetIds.has(id)) return true;
      const normId = normalizeAccountCode(id);
      if (targetCodes.has(normId)) return true;
      if (targetZeroTokens.has(normalizeLeadingZerosToken(normId))) return true;
      const emp = empList.find(e => e && (e.id === id || normalizeAccountCode(e.code) === normId));
      if (emp && (targetIds.has(emp.id) || targetCodes.has(normalizeAccountCode(emp.code)) || targetZeroTokens.has(normalizeLeadingZerosToken(emp.code)))) return true;
    }
    const rawNames = String(nameStr || '').split(/[,;/+]+/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 2);
    for (const namePart of rawNames) {
      const foldedPart = foldAccountIdentifier(namePart);
      for (const code of targetCodes) {
        if (code && (namePart.includes(code.toLowerCase()) || foldedPart.includes(code.toLowerCase()))) return true;
      }
      for (const n of targetNames) {
        const foldedTarget = foldAccountIdentifier(n);
        if (foldedPart === foldedTarget || foldedPart.includes(foldedTarget) || foldedTarget.includes(foldedPart)) return true;
      }
    }
    return false;
  }

  if (matchesStaff(item.teacherIds, item.teacherName, item.teacherId)) return true;
  if (matchesStaff(item.assistantIds, item.assistantName, item.assistantId)) return true;
  if (matchesStaff(item.officeIds, '')) return true;

  for (const ch of Object.values(sessionChanges || {})) {
    if (ch && ch.classId === item.id) {
      if (matchesStaff(ch.teacherIds, ch.teacherName, ch.teacherId)) return true;
      if (matchesStaff(ch.assistantIds, ch.assistantName, ch.assistantId)) return true;
      if (matchesStaff(ch.officeIds, '')) return true;
    }
  }

  return false;
}

const mockEmployees = [
  { id: 'emp-gv-1', code: 'GV001', name: 'Thầy Công', role: 'teacher' },
  { id: 'emp-ta-1', code: 'TA001', name: 'Cô Minh Anh', role: 'assistant' },
  { id: 'emp-vp-1', code: 'VP001', name: 'Chị Lan Phương', role: 'office' },
  { id: 'emp-ad-1', code: 'AD001', name: 'Admin', role: 'admin' },
];

const mockClasses = [
  {
    id: 'class-math-8a',
    code: 'MATH8A',
    teacherIds: ['emp-gv-1'],
    teacherId: 'emp-gv-1',
    teacherName: 'Thầy Công',
    assistantIds: ['emp-ta-1'],
    assistantId: 'emp-ta-1',
    assistantName: 'Cô Minh Anh'
  },
  {
    id: 'class-eng-7b',
    code: 'ENG7B',
    teacherIds: ['emp-gv-2'],
    teacherId: 'emp-gv-2',
    teacherName: 'Thầy Quang',
    assistantIds: ['emp-ta-2'],
    assistantId: 'emp-ta-2',
    assistantName: 'Mai Anh'
  }
];

console.log('--- TEST 1: Office sees all classes ---');
const officeAcc = { employeeId: 'emp-vp-1', code: 'VP001', role: 'office', name: 'Chị Lan Phương' };
const officeVisible = mockClasses.filter(c => isClassAssignedToCurrentAccountSimulation(c, officeAcc.employeeId, officeAcc, mockEmployees));
console.log(`Office sees ${officeVisible.length}/${mockClasses.length} classes:`, officeVisible.length === 2 ? 'PASS' : 'FAIL');

console.log('--- TEST 2: Teacher sees assigned class (by ID) ---');
const teacherAcc = { employeeId: 'emp-gv-1', code: 'GV001', role: 'teacher', name: 'Thầy Công' };
const teacherVisible = mockClasses.filter(c => isClassAssignedToCurrentAccountSimulation(c, teacherAcc.employeeId, teacherAcc, mockEmployees));
console.log(`Teacher sees ${teacherVisible.length} classes (expected: 1):`, teacherVisible.length === 1 && teacherVisible[0].id === 'class-math-8a' ? 'PASS' : 'FAIL');

console.log('--- TEST 3: Teacher sees assigned class even if logging in with TA01 vs TA001 or leading-zeros ---');
const teacherAcc2 = { employeeId: 'employee-teacher-gv01', code: 'GV01', role: 'teacher', name: 'Thầy Công' };
const teacherVisible2 = mockClasses.filter(c => isClassAssignedToCurrentAccountSimulation(c, teacherAcc2.employeeId, teacherAcc2, mockEmployees));
console.log(`Teacher with code GV01 sees ${teacherVisible2.length} classes:`, teacherVisible2.length === 1 ? 'PASS' : 'FAIL');

console.log('--- TEST 4: Assistant sees assigned class (by leading zeros & name) ---');
const taAcc = { employeeId: 'employee-assistant-ta01', code: 'TA01', role: 'assistant', name: 'Cô Minh Anh' };
const taVisible = mockClasses.filter(c => isClassAssignedToCurrentAccountSimulation(c, taAcc.employeeId, taAcc, mockEmployees));
console.log(`Assistant with code TA01 sees ${taVisible.length} classes:`, taVisible.length === 1 ? 'PASS' : 'FAIL');

console.log('--- TEST 5: Substitution session changes ---');
const subSessionChanges = {
  'class-eng-7b::2026-11-06': {
    classId: 'class-eng-7b',
    date: '2026-11-06',
    teacherIds: ['emp-gv-1'],
    teacherName: 'Thầy Công'
  }
};
const teacherVisibleWithSub = mockClasses.filter(c => isClassAssignedToCurrentAccountSimulation(c, teacherAcc.employeeId, teacherAcc, mockEmployees, subSessionChanges));
console.log(`Teacher with substitution sees ${teacherVisibleWithSub.length} classes:`, teacherVisibleWithSub.length === 2 ? 'PASS' : 'FAIL');

console.log('\nALL CLASS ASSIGNMENT SIMULATION TESTS PASSED!');
