import {
  normalizeEmployeeAccount,
  normalizeAccountCode,
  normalizeLeadingZerosToken,
  foldAccountIdentifier,
  compactAccountToken
} from '../src/data/class-catalog-repository.js';

console.log('--- TEST 1: Role Normalization Integrity ---');
const testCases = [
  { input: { code: 'VP01', role: 'office', name: 'Nguyễn Văn Phòng' }, expectedRole: 'office' },
  { input: { code: 'VP001', role: 'office', name: 'Nguyễn Văn Phòng' }, expectedRole: 'office' },
  { input: { code: 'GV01', role: 'teacher', name: 'Thầy Công' }, expectedRole: 'teacher' },
  { input: { code: 'GV001', role: 'teacher', name: 'Thầy Công' }, expectedRole: 'teacher' },
  { input: { code: 'CONGNT', role: 'teacher', name: 'Thầy Công' }, expectedRole: 'teacher' },
  { input: { code: 'TA01', role: 'assistant', name: 'Trợ giảng Linh' }, expectedRole: 'assistant' },
  { input: { code: 'TA001', role: 'assistant', name: 'Trợ giảng Linh' }, expectedRole: 'assistant' },
  { input: { code: 'TG01', role: 'assistant', name: 'Trợ giảng Mai' }, expectedRole: 'assistant' },
  { input: { code: 'AD001', role: 'admin', name: 'Quản trị' }, expectedRole: 'admin' },
  // Deductions when role is missing/blank
  { input: { code: 'VP02', name: 'VP Mới' }, expectedRole: 'office' },
  { input: { code: 'GIAOVIEN01', name: 'GV Mới' }, expectedRole: 'teacher' },
  { input: { code: 'GV02', name: 'GV Mới 2' }, expectedRole: 'teacher' },
  { input: { code: 'TROGIANG01', name: 'TA Mới' }, expectedRole: 'assistant' },
  { input: { code: 'TA02', name: 'TA Mới 2' }, expectedRole: 'assistant' },
];

let allPassed = true;
testCases.forEach((tc, idx) => {
  const norm = normalizeEmployeeAccount(tc.input);
  if (norm.role !== tc.expectedRole) {
    console.error(`FAIL [${idx}]: Code=${tc.input.code}, InputRole=${tc.input.role} => Got ${norm.role}, Expected ${tc.expectedRole}`);
    allPassed = false;
  } else {
    console.log(`PASS [${idx}]: Code=${tc.input.code} => Role=${norm.role}`);
  }
});

console.log('\n--- TEST 2: Leading-Zero & Code Matching ---');
const codes = [
  ['TA01', 'TA001'],
  ['GV01', 'GV001'],
  ['VP01', 'VP001']
];
codes.forEach(([c1, c2]) => {
  const t1 = normalizeLeadingZerosToken(c1);
  const t2 = normalizeLeadingZerosToken(c2);
  if (t1 === t2) {
    console.log(`PASS: ${c1} matches ${c2} (token: ${t1})`);
  } else {
    console.error(`FAIL: ${c1} does not match ${c2} (${t1} vs ${t2})`);
    allPassed = false;
  }
});

console.log('\n--- TEST 3: Name Folding & Matching ---');
const names = [
  ['Thay Cong', 'Thầy Công'],
  ['Thay Cong', 'Cô Minh Anh, Thầy Công'],
  ['Hoang Tuan Anh', 'Hoàng Tuấn Anh (TA001)']
];
names.forEach(([n1, n2]) => {
  const f1 = foldAccountIdentifier(n1);
  const f2 = foldAccountIdentifier(n2);
  const match = f2.includes(f1);
  if (match) {
    console.log(`PASS: "${n1}" matched within "${n2}"`);
  } else {
    console.error(`FAIL: "${n1}" not matched within "${n2}" (${f1} vs ${f2})`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log('\nALL ROLE & REPOSITORIES UNIT TESTS PASSED!');
} else {
  process.exit(1);
}
