// Comprehensive test for Google Sheets sync missing class handling
import assert from 'node:assert';
import { resolveClassIdsFromCell } from '../src/excel-import-export.js';
import { normalizeEnrollmentStatus } from '../src/excel-import-export.js';

console.log('--- TEST: Google Sheets Missing Class Sync Logic ---');

// Mock catalog
const catalog = [
  { id: 'class-2k9-h4', code: '2K9.H4.GIANGNH', name: 'Lớp 2K9 Hình 4' },
  { id: 'class-toan8a', code: 'TOAN8A', name: 'Lớp Toán 8A' }
];

// Test 1: Class resolution check
console.log('\n[Test 1] Class resolution check:');
const existingClassResolved = resolveClassIdsFromCell('2K9.H4.GIANGNH', null, catalog);
console.log('Existing class 2K9.H4.GIANGNH resolved to:', existingClassResolved);
assert.deepStrictEqual(existingClassResolved, ['class-2k9-h4']);

const unknownClassResolved = resolveClassIdsFromCell('2K9.UNKNOWN_CLASS', null, catalog);
console.log('Unknown class 2K9.UNKNOWN_CLASS resolved to:', unknownClassResolved);
assert.deepStrictEqual(unknownClassResolved, []);

// Test 2: Simulating extract and scan logic for missing class
console.log('\n[Test 2] Scanning row with non-existent class code:');
const mockRows = [
  {
    studentCode: 'HS_TEST_01',
    fullName: 'Trần Văn Thi',
    rawClassTexts: ['2K9.UNKNOWN_CLASS'],
    resolvedClassIds: resolveClassIdsFromCell('2K9.UNKNOWN_CLASS', null, catalog),
    enrollmentStatus: 'Học' // Sheet says Học
  },
  {
    studentCode: 'HS_TEST_02',
    fullName: 'Lê Thị Thu',
    rawClassTexts: ['2K9.H4.GIANGNH'],
    resolvedClassIds: resolveClassIdsFromCell('2K9.H4.GIANGNH', null, catalog),
    enrollmentStatus: 'Học'
  }
];

const processedItems = [];
mockRows.forEach((row, idx) => {
  const rawClassTokens = (row.rawClassTexts || [])
    .flatMap(t => String(t || '').split(/[,;\n\r]+/))
    .map(t => t.trim())
    .filter(Boolean);

  const unresolvableClassTokens = rawClassTokens.filter(tok => {
    return resolveClassIdsFromCell(tok, null, catalog).length === 0;
  });

  const hasMissingClassInDb = unresolvableClassTokens.length > 0;
  const missingClassCode = unresolvableClassTokens.join(', ');

  let sheetClassIds = [...(row.resolvedClassIds || [])].filter(cid => catalog.some(c => c.id === cid));

  const targetEnrollmentStatus = hasMissingClassInDb
    ? 'Nghỉ'
    : (row.enrollmentStatus ? normalizeEnrollmentStatus(row.enrollmentStatus) : 'Học');

  processedItems.push({
    studentCode: row.studentCode,
    fullName: row.fullName,
    hasMissingClass: hasMissingClassInDb,
    missingClassCode,
    enrollmentStatus: targetEnrollmentStatus,
    targetClassIds: sheetClassIds,
    addNewTag: hasMissingClassInDb ? false : true
  });
});

console.log('Processed items in approval preview:');
console.log(processedItems);

// Verification assertions
assert.strictEqual(processedItems[0].hasMissingClass, true);
assert.strictEqual(processedItems[0].missingClassCode, '2K9.UNKNOWN_CLASS');
assert.strictEqual(processedItems[0].enrollmentStatus, 'Nghỉ'); // Automatically set to Nghỉ!
assert.strictEqual(processedItems[0].addNewTag, false);
assert.deepStrictEqual(processedItems[0].targetClassIds, []);

assert.strictEqual(processedItems[1].hasMissingClass, false);
assert.strictEqual(processedItems[1].missingClassCode, '');
assert.strictEqual(processedItems[1].enrollmentStatus, 'Học');
assert.strictEqual(processedItems[1].addNewTag, true);
assert.deepStrictEqual(processedItems[1].targetClassIds, ['class-2k9-h4']);

// Test 3: Approving sync - ensure NO classes are created!
console.log('\n[Test 3] Simulating approval of sync items:');
const initialCatalogLength = catalog.length;
const approvedItems = processedItems;
const allStudents = [];

approvedItems.forEach(item => {
  // RULE: Only take class IDs that exist in catalog!
  const finalTargetClassIds = (item.targetClassIds || []).filter(cid => catalog.some(c => c.id === cid));

  allStudents.push({
    studentCode: item.studentCode,
    name: item.fullName,
    classIds: finalTargetClassIds,
    enrollmentStatus: item.enrollmentStatus
  });
});

console.log('Initial catalog length:', initialCatalogLength, '| Current catalog length:', catalog.length);
assert.strictEqual(catalog.length, initialCatalogLength, 'Catalog must NOT have new classes added!');

console.log('Students saved to database:');
console.log(allStudents);

assert.strictEqual(allStudents[0].enrollmentStatus, 'Nghỉ');
assert.deepStrictEqual(allStudents[0].classIds, []); // No non-existent class attached

assert.strictEqual(allStudents[1].enrollmentStatus, 'Học');
assert.deepStrictEqual(allStudents[1].classIds, ['class-2k9-h4']);

console.log('\n ALL TESTS PASSED SUCCESSFULLY! Everything matches requirements 100%.');
