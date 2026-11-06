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
  { input: { code: 'GV01', role: 'teacher', name: 'Nguyễn Thành Công' }, expectedRole: 'teacher' },
  { input: { code: 'GV001', role: 'teacher', name: 'Nguyễn Thành Công' }, expectedRole: 'teacher' },
  { input: { code: 'CONGNT', role: 'assistant', name: 'Nguyễn Thành Công' }, expectedRole: 'assistant' },
  { input: { code: 'GIANGNH', role: 'teacher', name: 'Nguyễn Thị Hương Giang' }, expectedRole: 'teacher' },
  { input: { code: 'LINHBMP', role: 'office', name: 'Bùi Minh Phương Linh' }, expectedRole: 'office' },
  { input: { code: 'SANGHN', role: 'office', name: 'Hoàng Ngọc Sáng' }, expectedRole: 'office' },
  { input: { code: 'TA01', role: 'assistant', name: 'Trần Phương Linh' }, expectedRole: 'assistant' },
  { input: { code: 'TA001', role: 'assistant', name: 'Trần Phương Linh' }, expectedRole: 'assistant' },
  { input: { code: 'TG01', role: 'assistant', name: 'Vũ Hoàng Mai' }, expectedRole: 'assistant' },
  { input: { code: 'AD001', role: 'admin', name: 'Quản trị hệ thống' }, expectedRole: 'admin' },
  // Custom codes and roles defined by admin
  { input: { code: 'KETOAN_01', role: 'office', name: 'Lê Thị Thu' }, expectedRole: 'office' },
  { input: { code: 'GV_TOAN_9', role: 'teacher', name: 'Phạm Nhật Quang' }, expectedRole: 'teacher' },
  { input: { code: 'TROGIANG_VIP', role: 'assistant', name: 'Đỗ Minh Khoa' }, expectedRole: 'assistant' },
  { input: { code: 'ADMIN_TONG', role: 'admin', name: 'Nguyễn Quản Trị' }, expectedRole: 'admin' },
  // Accidental pronouns entered by user are cleanly stripped
  { input: { code: 'NV99', role: 'teacher', name: 'Thầy Trần Văn Bảo' }, expectedRole: 'teacher', expectedName: 'Trần Văn Bảo' },
  { input: { code: 'NV98', role: 'assistant', name: 'Trợ giảng Lê Quỳnh' }, expectedRole: 'assistant', expectedName: 'Lê Quỳnh' },
  { input: { code: 'NV97', role: 'teacher', name: 'Cô Hương Giang' }, expectedRole: 'teacher', expectedName: 'Hương Giang' },
];

let allPassed = true;
testCases.forEach((tc, idx) => {
  const norm = normalizeEmployeeAccount(tc.input);
  if (norm.role !== tc.expectedRole) {
    console.error(`FAIL [${idx}]: Code=${tc.input.code}, InputRole=${tc.input.role} => Got ${norm.role}, Expected ${tc.expectedRole}`);
    allPassed = false;
  } else if (tc.expectedName && norm.name !== tc.expectedName) {
    console.error(`FAIL [${idx}]: Code=${tc.input.code}, InputName="${tc.input.name}" => Got "${norm.name}", Expected "${tc.expectedName}"`);
    allPassed = false;
  } else {
    console.log(`PASS [${idx}]: Code=${tc.input.code} => Role=${norm.role}, Name="${norm.name}"`);
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
  ['Nguyen Thanh Cong', 'Nguyễn Thành Công'],
  ['Nguyen Thi Huong Giang', 'Nguyễn Thị Hương Giang'],
  ['Hoang Tuan Anh', 'Hoàng Tuấn Anh (NV001)']
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
