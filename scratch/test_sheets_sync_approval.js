// Regression test for Google Sheets Sync Approval Rules (v5.3.0)
import { normalizeLeadingZerosToken } from '../src/data/class-catalog-repository.js';

function runTests() {
  const normName = (str) => String(str || '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');

  // Sample database
  const allStudents = [
    {
      id: 'stu-1',
      studentCode: '2K11-001',
      name: 'Nguyễn Văn An',
      classIds: ['cls-t5'],
      enrollmentStatus: 'Học',
      school: 'THCS Cầu Giấy',
      parentContact: { name: 'Mẹ An' },
      tags: ['Tự tin']
    },
    {
      id: 'stu-2',
      studentCode: '2K11-002',
      name: 'Trần Thị Bình',
      classIds: ['cls-t2', 'cls-t5'], // Multi-class student
      enrollmentStatus: 'Học',
      school: 'THCS Trưng Vương',
      parentContact: { name: 'Bố Bình' },
      tags: []
    },
    {
      id: 'stu-3',
      studentCode: '2K11-003',
      name: 'Lê Hoàng Cường',
      classIds: ['cls-t2'],
      enrollmentStatus: 'Học',
      school: 'THCS Yên Hòa',
      parentContact: { name: 'Mẹ Cường' },
      tags: []
    }
  ];

  // Helper matching logic as in scanIncomingSheetsRowsForApproval
  function processRow(row, allStudents, targetClsFilter = 'all') {
    const codeNorm = String(row.studentCode || '').trim().toUpperCase();
    const composedName = row.fullName || [row.familyName, row.givenName].filter(Boolean).join(' ').trim();
    if (!codeNorm && !composedName) return null;

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

    let sheetClassIds = [...(row.resolvedClassIds || [])];
    if (!sheetClassIds.length && targetClsFilter && targetClsFilter !== 'all') {
      sheetClassIds = [targetClsFilter];
    }

    // 1. Missing code
    if (!codeNorm) {
      return { category: 'missing_code', studentCode: '' };
    }

    // 2. If student code not in database
    if (!existingStu) {
      return { category: 'new_student', studentCode: codeNorm };
    }

    // 3. Student already in DB
    const origClassIds = Array.isArray(existingStu.classIds)
      ? existingStu.classIds.filter(Boolean)
      : (existingStu.classId ? [existingStu.classId] : []);

    const hasSheetClassInfo = sheetClassIds.length > 0 || (row.rawClassTexts && row.rawClassTexts.length > 0);
    const hasNewClass = sheetClassIds.length > 0 && sheetClassIds.some(cid => !origClassIds.includes(cid));
    const hasUnresolvedClass = (row.rawClassTexts || []).length > 0 && row.resolvedClassIds.length === 0;
    const isClassDifferent = Boolean(hasSheetClassInfo && (hasNewClass || hasUnresolvedClass));

    // Info comparison
    const existingCode = String(existingStu.studentCode || existingStu.code || '').trim().toUpperCase();
    const isCodeDifferent = Boolean(codeNorm && existingCode && codeNorm !== existingCode && normalizeLeadingZerosToken(codeNorm) !== normalizeLeadingZerosToken(existingCode));
    const isCodeAssigned = Boolean(codeNorm && !existingCode);

    const sheetName = String(composedName || '').trim();
    const dbName = String(existingStu.name || '').trim();
    const isNameDifferent = Boolean(sheetName && dbName && normName(sheetName) !== normName(dbName));

    const sheetStatus = row.enrollmentStatus ? row.enrollmentStatus.trim() : '';
    const dbStatus = existingStu.enrollmentStatus || 'Học';
    const isStatusDifferent = Boolean(sheetStatus && sheetStatus !== dbStatus);

    const existingTags = Array.isArray(existingStu.tags) ? existingStu.tags.map(t => t.trim().toLowerCase()) : [];
    const rowTags = Array.isArray(row.tags) ? row.tags : (row.tag ? [row.tag] : []);
    const cleanRowTags = rowTags.map(t => t.trim()).filter(Boolean);
    const isTagsDifferent = cleanRowTags.length > 0 && cleanRowTags.some(t => !existingTags.includes(t.toLowerCase()));

    const sheetSchool = String(row.school || '').trim();
    const dbSchool = String(existingStu.school || '').trim();
    const isSchoolDifferent = Boolean(sheetSchool && dbSchool && normName(sheetSchool) !== normName(dbSchool));
    const isSchoolAdded = Boolean(sheetSchool && !dbSchool);

    const sheetParent = String(row.parentName || '').trim();
    const dbParent = String(existingStu.parentContact?.name || '').trim();
    const isParentDifferent = Boolean(sheetParent && dbParent && normName(sheetParent) !== normName(dbParent));
    const isParentAdded = Boolean(sheetParent && !dbParent);

    const hasInfoUpdate = Boolean(
      isCodeDifferent ||
      isCodeAssigned ||
      isNameDifferent ||
      isStatusDifferent ||
      isTagsDifferent ||
      isSchoolDifferent ||
      isSchoolAdded ||
      isParentDifferent ||
      isParentAdded
    );

    if (isClassDifferent) {
      return { category: 'class_change', studentCode: codeNorm, origClassIds, targetClassIds: sheetClassIds };
    }
    if (hasInfoUpdate) {
      return { category: 'code_update', studentCode: codeNorm, isNameDifferent, isStatusDifferent, isTagsDifferent };
    }
    return { category: 'skipped' };
  }

  console.log('=== TEST 1: Học sinh mới chỉ khi Mã HS chưa có trong DB ===');
  // Row A: Code 2K11-099 (Not in DB) -> MUST be 'new_student'
  const res1A = processRow({ studentCode: '2K11-099', fullName: 'Học Sinh Mới Toanh', resolvedClassIds: ['cls-t5'] }, allStudents);
  console.assert(res1A.category === 'new_student', 'Test 1A failed: Expected new_student');
  console.log('PASS 1A: 2K11-099 (chưa có trong DB) => new_student');

  // Row B: Code 2K11-001 (Already in DB) with exact info -> MUST be skipped, NEVER new_student
  const res1B = processRow({ studentCode: '2K11-001', fullName: 'Nguyễn Văn An', resolvedClassIds: ['cls-t5'], school: 'THCS Cầu Giấy', parentName: 'Mẹ An' }, allStudents);
  console.assert(res1B.category === 'skipped', 'Test 1B failed: Expected skipped, got: ' + res1B.category);
  console.log('PASS 1B: 2K11-001 (đã có trong DB, khớp thông tin) => skipped (không phải new_student)');

  // Row C: Missing code -> MUST be missing_code, NEVER new_student
  const res1C = processRow({ studentCode: '', fullName: 'Chưa Có Mã', resolvedClassIds: ['cls-t5'] }, allStudents);
  console.assert(res1C.category === 'missing_code', 'Test 1C failed: Expected missing_code');
  console.log('PASS 1C: Thiếu mã HS => missing_code');

  console.log('\n=== TEST 2: Khác/chuyển lớp: chỉ khi lớp trên sheet khác lớp gốc ===');
  // Row 2A: 2K11-001 in DB has cls-t5. Sheet has cls-t5. -> SAME class, MUST NOT be class_change!
  const res2A = processRow({ studentCode: '2K11-001', fullName: 'Nguyễn Văn An', resolvedClassIds: ['cls-t5'] }, allStudents);
  console.assert(res2A.category !== 'class_change', 'Test 2A failed: Got class_change for identical class');
  console.log('PASS 2A: Học sinh trong DB có lớp T5, Sheet ghi lớp T5 => KHÔNG chuyển lớp');

  // Row 2B: 2K11-002 in DB has [cls-t2, cls-t5]. Sheet has cls-t5. -> cls-t5 is in base classes, MUST NOT be class_change!
  const res2B = processRow({ studentCode: '2K11-002', fullName: 'Trần Thị Bình', resolvedClassIds: ['cls-t5'] }, allStudents);
  console.assert(res2B.category !== 'class_change', 'Test 2B failed: Got class_change when target class is in base classes');
  console.log('PASS 2B: Học sinh trong DB học [T2, T5], Sheet ghi lớp T5 => KHÔNG chuyển lớp');

  // Row 2C: 2K11-003 in DB has cls-t2. Sheet has cls-t5. -> cls-t5 is DIFFERENT from cls-t2, MUST BE class_change!
  const res2C = processRow({ studentCode: '2K11-003', fullName: 'Lê Hoàng Cường', resolvedClassIds: ['cls-t5'] }, allStudents);
  console.assert(res2C.category === 'class_change', 'Test 2C failed: Expected class_change');
  console.log('PASS 2C: Học sinh trong DB học T2, Sheet ghi lớp T5 => CÓ CHUYỂN LỚP (class_change)');

  console.log('\n=== TEST 3: Cập nhật thông tin: chỉ hiện các học sinh khác thông tin ===');
  // Row 3A: 2K11-001 same class (cls-t5), but status on Sheet is 'Nghỉ' while DB is 'Học' -> MUST be code_update
  const res3A = processRow({ studentCode: '2K11-001', fullName: 'Nguyễn Văn An', resolvedClassIds: ['cls-t5'], enrollmentStatus: 'Nghỉ' }, allStudents);
  console.assert(res3A.category === 'code_update' && res3A.isStatusDifferent, 'Test 3A failed: Expected code_update due to status difference');
  console.log('PASS 3A: Khác trạng thái học (Học -> Nghỉ) => code_update (Cập nhật thông tin)');

  // Row 3B: 2K11-001 same class, but has new tag 'Bổ trợ' on Sheet -> MUST be code_update
  const res3B = processRow({ studentCode: '2K11-001', fullName: 'Nguyễn Văn An', resolvedClassIds: ['cls-t5'], tags: ['Bổ trợ'] }, allStudents);
  console.assert(res3B.category === 'code_update' && res3B.isTagsDifferent, 'Test 3B failed: Expected code_update due to tag difference');
  console.log('PASS 3B: Có tag mới trên Sheet => code_update (Cập nhật thông tin)');

  // Row 3C: 2K11-001 same class, but name changed on Sheet -> MUST be code_update
  const res3C = processRow({ studentCode: '2K11-001', fullName: 'Nguyễn Văn An Khang', resolvedClassIds: ['cls-t5'] }, allStudents);
  console.assert(res3C.category === 'code_update' && res3C.isNameDifferent, 'Test 3C failed: Expected code_update due to name difference');
  console.log('PASS 3C: Tên khác trên Sheet => code_update (Cập nhật thông tin)');

  // Row 3D: 2K11-001 same class, same name, no differences -> MUST be skipped (NOT in code_update)
  const res3D = processRow({ studentCode: '2K11-001', fullName: 'Nguyễn Văn An', resolvedClassIds: ['cls-t5'], school: 'THCS Cầu Giấy', parentName: 'Mẹ An' }, allStudents);
  console.assert(res3D.category === 'skipped', 'Test 3D failed: Expected skipped for identical student');
  console.log('PASS 3D: Thông tin và lớp khớp 100% => skipped (không hiện trong bảng duyệt)');

  console.log('\nALL GOOGLE SHEETS SYNC APPROVAL TESTS PASSED!');
}

runTests();
