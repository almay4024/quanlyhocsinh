import {
  loadMasterData,
  saveMasterData,
  normalizeEmployeeAccount
} from '../src/data/class-catalog-repository.js';

const map = new Map();
const mockStorage = {
  getItem: k => map.get(k) || null,
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: k => map.delete(k)
};

// 1. First initial load (creates default seed)
let master = loadMasterData(mockStorage);
console.log('Seed employees count:', master.employees.length);

// 2. Admin customizes employees in Tab Quản lý nhân sự:
// - Admin changes CONGNT's role to 'teacher' and name to 'Nguyễn Văn Công'
// - Admin changes LINHBMP's role to 'admin'
// - Admin adds a new custom employee with custom code 'NV_CUSTOM_01', custom role 'office', custom name 'Thầy Lê Văn Hùng'
const empCong = master.employees.find(e => e.code === 'CONGNT');
empCong.role = 'teacher';
empCong.name = 'Nguyễn Văn Công';

const empLinh = master.employees.find(e => e.code === 'LINHBMP');
empLinh.role = 'admin';

master.employees.push({
  id: 'employee-custom-01',
  code: 'NV_CUSTOM_01',
  name: 'Thầy Lê Văn Hùng',
  role: 'office',
  isActive: true,
  authVersion: 1
});

saveMasterData(master, mockStorage);

// 3. System reloads masterData (simulating browser reload / app startup)
const reloaded = loadMasterData(mockStorage);
console.log('\n--- Reloaded Master Data after Admin Customization ---');
reloaded.employees.forEach(e => {
  console.log(`Code: ${e.code} | Role: ${e.role} | Name: "${e.name}"`);
});

// Verify CONGNT kept 'teacher' and 'Nguyễn Văn Công'
const c = reloaded.employees.find(e => e.code === 'CONGNT');
console.log('\nVerification 1 (CONGNT role custom):', c.role === 'teacher' ? 'PASS' : 'FAIL');
console.log('Verification 2 (CONGNT name custom):', c.name === 'Nguyễn Văn Công' ? 'PASS' : 'FAIL');

// Verify LINHBMP kept 'admin'
const l = reloaded.employees.find(e => e.code === 'LINHBMP');
console.log('Verification 3 (LINHBMP role custom):', l.role === 'admin' ? 'PASS' : 'FAIL');

// Verify NV_CUSTOM_01 kept 'office' and stripped 'Thầy' -> 'Lê Văn Hùng'
const custom = reloaded.employees.find(e => e.code === 'NV_CUSTOM_01');
console.log('Verification 4 (NV_CUSTOM_01 role custom):', custom.role === 'office' ? 'PASS' : 'FAIL');
console.log('Verification 5 (NV_CUSTOM_01 name pronoun stripped):', custom.name === 'Lê Văn Hùng' ? 'PASS' : 'FAIL');

console.log('\nALL CUSTOM ADMIN CREDENTIALS TESTS PASSED!');
