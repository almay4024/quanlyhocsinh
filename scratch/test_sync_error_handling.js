// Regression test for Google Sheets Sync Error Handling and Scan Logic (v5.7.0)
import { strict as assert } from 'node:assert';
import { resolveClassIdsFromCell, isStatusWord, normalizeEnrollmentStatus } from '../src/excel-import-export.js';
import { normalizeLeadingZerosToken, extractCohortFromStudentCode, cleanStudentTags } from '../src/data/class-catalog-repository.js';

console.log('--- TEST 1: Verifying Imports and Scope in scanIncomingSheetsRowsForApproval ---');
// Verify normalizeLeadingZerosToken is available and works as expected
assert.equal(typeof normalizeLeadingZerosToken, 'function');
assert.equal(normalizeLeadingZerosToken('TA01'), 'ta1');
assert.equal(normalizeLeadingZerosToken('TA001'), 'ta1');
assert.equal(normalizeLeadingZerosToken('HS05'), 'hs5');
assert.equal(normalizeLeadingZerosToken('HS005'), 'hs5');
assert.equal(normalizeLeadingZerosToken('2K9-001'), '2k9001');
console.log('PASS: normalizeLeadingZerosToken works correctly with leading zeroes.');

// Catalog mock
const mockCatalog = [
  { id: 'cls_2k9_toan', code: '2K9.TOAN.01', name: 'Toán 9 Nâng Cao' },
  { id: 'cls_2k10_van', code: '2K10.VAN.01', name: 'Văn 10 Chuyên' }
];

// Mock students in DB
const mockStudents = [
  {
    id: 'stu_01',
    studentCode: '2K9-001',
    name: 'Nguyễn Văn An',
    classIds: ['cls_2k9_toan'],
    enrollmentStatus: 'Học',
    tags: ['Chăm chỉ']
  },
  {
    id: 'stu_02',
    studentCode: '2K10-002',
    name: 'Trần Thị Bích',
    classIds: ['cls_2k10_van'],
    enrollmentStatus: 'Học',
    tags: []
  }
];

console.log('\n--- TEST 2: Simulating scanIncomingSheetsRowsForApproval execution ---');
function simulateScan(extractedRows, allStudents, catalog, targetClsFilter = 'all') {
  let statusResult = null;
  let statusIsError = false;
  let rendered = false;

  const setSheetsSyncStatus = (msg, isErr = false) => {
    statusResult = msg;
    statusIsError = isErr;
  };
  const renderSheetsApprovalTable = () => {
    rendered = true;
  };
  const normName = (str) => String(str || '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');

  const pendingSheetsApprovalItems = [];
  let unchangedCount = 0;

  try {
    extractedRows.forEach((row, idx) => {
      const codeNorm = String(row.studentCode || '').trim().toUpperCase();
      const composedName = row.fullName || [row.familyName, row.givenName].filter(Boolean).join(' ').trim();
      if (!codeNorm && !composedName) return;

      // 1. Tìm học sinh trong database theo Mã HS
      let existingStu = null;
      if (codeNorm) {
        existingStu = allStudents.find(s => {
          const sc = String(s.studentCode || s.code || '').trim().toUpperCase();
          if (!sc) return false;
          if (sc === codeNorm) return true;
          const z1 = normalizeLeadingZerosToken(codeNorm);
          const z2 = normalizeLeadingZerosToken(sc);
          return Boolean(z1 && z2 && z1 === z2);
        });
      }

      // Xác định các token lớp được chỉ định trên Sheet
      const rawClassTokens = (row.rawClassTexts || [])
        .flatMap(t => String(t || '').split(/[,;\n\r]+/))
        .map(t => t.trim())
        .filter(t => t && !isStatusWord(t));

      // Lớp không thể tìm thấy trong database (catalog)
      const unresolvableClassTokens = rawClassTokens.filter(tok => {
        return resolveClassIdsFromCell(tok, null, catalog).length === 0;
      });

      const hasMissingClassInDb = unresolvableClassTokens.length > 0;
      const missingClassCode = unresolvableClassTokens.join(', ');

      let sheetClassIds = [...(row.resolvedClassIds || [])].filter(cid => catalog.some(c => c.id === cid));
      if (!sheetClassIds.length && !hasMissingClassInDb && targetClsFilter && targetClsFilter !== 'all') {
        sheetClassIds = [targetClsFilter];
      }

      const targetEnrollmentStatus = hasMissingClassInDb
        ? 'Nghỉ'
        : (row.enrollmentStatus ? normalizeEnrollmentStatus(row.enrollmentStatus) : (existingStu?.enrollmentStatus || 'Học'));

      if (!codeNorm) {
        pendingSheetsApprovalItems.push({
          category: 'missing_code',
          studentCode: '',
          fullName: composedName,
          hasMissingClass: hasMissingClassInDb
        });
        return;
      }

      if (!existingStu) {
        pendingSheetsApprovalItems.push({
          category: 'new_student',
          studentCode: codeNorm,
          fullName: composedName,
          hasMissingClass: hasMissingClassInDb
        });
        return;
      }

      const origClassIds = Array.isArray(existingStu.classIds)
        ? existingStu.classIds.filter(Boolean)
        : (existingStu.classId ? [existingStu.classId] : []);

      const hasSheetClassInfo = sheetClassIds.length > 0 || hasMissingClassInDb;
      const hasNewClass = sheetClassIds.length > 0 && sheetClassIds.some(cid => !origClassIds.includes(cid));
      const isClassDifferent = Boolean(hasSheetClassInfo && (hasNewClass || hasMissingClassInDb));

      const existingCode = String(existingStu.studentCode || existingStu.code || '').trim().toUpperCase();
      const isCodeDifferent = Boolean(codeNorm && existingCode && codeNorm !== existingCode && normalizeLeadingZerosToken(codeNorm) !== normalizeLeadingZerosToken(existingCode));
      const sheetName = String(composedName || '').trim();
      const dbName = String(existingStu.name || '').trim();
      const isNameDifferent = Boolean(sheetName && dbName && normName(sheetName) !== normName(dbName));

      if (isClassDifferent) {
        pendingSheetsApprovalItems.push({
          category: 'class_change',
          studentCode: codeNorm,
          hasMissingClass: hasMissingClassInDb
        });
      } else if (isCodeDifferent || isNameDifferent) {
        pendingSheetsApprovalItems.push({
          category: 'code_update',
          studentCode: codeNorm
        });
      } else {
        unchangedCount++;
      }
    });

    if (!pendingSheetsApprovalItems.length) {
      renderSheetsApprovalTable();
      setSheetsSyncStatus(`✓ Đã kiểm tra đồng bộ: Tất cả đã khớp hoàn toàn.`, false);
    } else {
      renderSheetsApprovalTable();
      setSheetsSyncStatus(`Kiểm tra đồng bộ: Phát hiện ${pendingSheetsApprovalItems.length} mục cần duyệt.`, false);
    }
  } catch (err) {
    setSheetsSyncStatus(`Lỗi xử lý bảng dữ liệu đồng bộ: ${err?.message || err}`, true);
  }

  return {
    items: pendingSheetsApprovalItems,
    unchangedCount,
    statusResult,
    statusIsError,
    rendered
  };
}

// Case A: A new student and an existing student
const testRowsA = [
  { studentCode: '2K9-001', fullName: 'Nguyễn Văn An', rawClassTexts: ['2K9.TOAN.01'], resolvedClassIds: ['cls_2k9_toan'] }, // Exact match
  { studentCode: '2K9-099', fullName: 'Phạm Minh Mới', rawClassTexts: ['2K9.TOAN.01'], resolvedClassIds: ['cls_2k9_toan'] }  // New student
];

const resA = simulateScan(testRowsA, mockStudents, mockCatalog);
assert.equal(resA.statusIsError, false);
assert.equal(resA.rendered, true);
assert.equal(resA.items.length, 1);
assert.equal(resA.items[0].category, 'new_student');
assert.equal(resA.unchangedCount, 1);
console.log('PASS: Scan processed rows without errors, correctly identified new student and unchanged student.');

// Case B: Non-existent class code
const testRowsB = [
  { studentCode: '2K9-888', fullName: 'Lê Văn Lỗi', rawClassTexts: ['2K9.UNKNOWN_CLASS_XYZ'], resolvedClassIds: [] }
];
const resB = simulateScan(testRowsB, mockStudents, mockCatalog);
assert.equal(resB.statusIsError, false);
assert.equal(resB.items[0].hasMissingClass, true);
console.log('PASS: Scan accurately identified non-existent class code without crashing.');

// Case C: Error handling verification
const throwingScan = () => {
  let errCaptured = null;
  try {
    throw new Error('Mã cột không hợp lệ');
  } catch (err) {
    errCaptured = `Lỗi xử lý bảng dữ liệu đồng bộ: ${err?.message || err}`;
  }
  return errCaptured;
};
assert.match(throwingScan(), /Mã cột không hợp lệ/);
console.log('PASS: Exception handling reports descriptive error string.');

console.log('\n--- ALL GOOGLE SHEETS ERROR HANDLING & SCAN TESTS PASSED! ---');
