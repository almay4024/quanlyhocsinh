import { isBirthYearOrCohortTag } from './data/class-catalog-repository.js?v=4.5.0';
// Utilities for importing/exporting roster data, Interactive Data Grid column mapping, CSV/Excel export & Google Sheets sync.

export const ENROLLMENT_STATUS_PRESETS = [
  'Học',
  'Chưa nhập học',
  'Tạm nghỉ',
  'Nghỉ',
  'Trùng'
];

export const GRID_COLUMN_ROLE_OPTIONS = [
  { value: 'ignore', label: '-- Bỏ qua cột này --' },
  { value: 'code', label: 'Mã HS' },
  { value: 'familyName', label: 'Họ đệm' },
  { value: 'givenName', label: 'Tên' },
  { value: 'fullName', label: 'Họ và tên đầy đủ' },
  { value: 'school', label: 'Trường học' },
  { value: 'classCode', label: 'Mã lớp' },
  { value: 'parentName', label: 'Tên Phụ huynh' },
  { value: 'status', label: 'Trạng thái' },
  { value: 'tag', label: 'Tag phân loại' }
];

const KNOWN_STATUS_WORDS = new Set([
  'học', 'đang học', 'hoc', 'dang hoc',
  'chưa nhập học', 'chua nhap hoc',
  'tạm nghỉ', 'tam nghi', 'bảo lưu', 'bao luu',
  'nghỉ', 'nghi', 'nghỉ học', 'đã nghỉ',
  'trùng', 'trung'
]);

export function isStatusWord(rawVal) {
  const s = String(rawVal ?? '').trim().toLowerCase();
  return KNOWN_STATUS_WORDS.has(s);
}

export function normalizeEnrollmentStatus(rawVal) {
  const trimmed = String(rawVal ?? '').trim();
  // Nếu trong sheet chưa có trạng thái thì vẫn đặt trong web là 'Nghỉ'
  if (!trimmed) return 'Nghỉ';
  const lower = trimmed.toLowerCase();
  if (lower === 'học' || lower === 'đang học' || lower === 'hoc' || lower === 'dang hoc') return 'Học';
  if (lower === 'chưa nhập học' || lower === 'chua nhap hoc') return 'Chưa nhập học';
  if (lower === 'tạm nghỉ' || lower === 'tam nghi' || lower === 'bảo lưu' || lower === 'bao luu') return 'Tạm nghỉ';
  if (lower === 'nghỉ' || lower === 'nghi' || lower === 'nghỉ học' || lower === 'đã nghỉ') return 'Nghỉ';
  if (lower === 'trùng' || lower === 'trung') return 'Trùng';
  return trimmed;
}

/**
 * Splits raw copied text into rows and cells without shifting columns.
 */
export function parseRawTable(rawText) {
  if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
  const cleanText = String(rawText).replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';')) delimiter = ';';
  else if (firstLine.includes(',')) delimiter = ',';

  const parseCsvLine = (line, delim) => {
    if (delim === '\t') {
      return line.split('\t').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    }
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const rows = lines.map(line => parseCsvLine(line, delimiter)).filter(r => r.some(c => String(c || '').trim() !== ''));
  return { rows };
}

/**
 * Splits full Vietnamese name into familyName (họ đệm) and givenName (tên)
 */
export function splitVietnameseName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { familyName: '', givenName: '' };
  if (parts.length === 1) return { familyName: '', givenName: parts[0] };
  return {
    familyName: parts.slice(0, -1).join(' '),
    givenName: parts.at(-1) || ''
  };
}

/**
 * Helper to resolve class code, name or ID from cell text to valid class IDs.
 * Normalizes dots, spaces, dashes, and underscores so "2K9.H4.GIANGNH" matches both code and id reliably.
 */
export function resolveClassIdsFromCell(val, defaultId, classCatalog = []) {
  if (!val || !String(val).trim()) return defaultId ? [defaultId] : [];

  const normStr = (s) => String(s || '').toLowerCase().trim().replace(/[\s\-_.]+/g, '');
  const tokens = String(val).split(/[,;\/\n\r]+/).map(t => t.trim()).filter(Boolean);
  const resolved = [];

  for (const rawToken of tokens) {
    const bracketMatch = rawToken.match(/\[([^\]]+)\]/);
    const token = (bracketMatch ? bracketMatch[1] : rawToken).trim();
    const clean = token.toLowerCase();
    const norm = normStr(token);
    if (!norm) continue;

    // 1. Exact match on class code or normalized code
    let found = classCatalog.find(c => {
      const code = String(c.code || '').toLowerCase().trim();
      return code && (code === clean || normStr(code) === norm);
    });

    // 2. Exact match on ID or Name
    if (!found) {
      found = classCatalog.find(c => {
        const id = String(c.id || '').toLowerCase().trim();
        const name = String(c.name || '').toLowerCase().trim();
        return id === clean || normStr(id) === norm || name === clean || normStr(name) === norm;
      });
    }

    // 3. Substring match
    if (!found) {
      // 3A. The token contains the class code (e.g. cell has "2K9.T5 - Toán 9" containing "2K9.T5")
      found = classCatalog.find(c => {
        const codeNorm = normStr(c.code);
        return codeNorm && codeNorm.length >= 3 && norm.includes(codeNorm);
      });
    }

    if (!found) {
      // 3B. The token contains the full class name (e.g. "Lớp Toán 9 Thứ 5" contains "Toán 9 Thứ 5")
      found = classCatalog.find(c => {
        const nameNorm = normStr(c.name);
        return nameNorm && nameNorm.length >= 4 && norm.includes(nameNorm);
      });
    }

    // 3C. Class name or code contains the token ONLY IF exactly ONE class in the catalog matches
    // (Prevents generic "Toán 9" from falsely matching the first class "Toán 9 Thứ 2" when both T2 and T5 exist)
    if (!found) {
      const candidates = classCatalog.filter(c => {
        const nameNorm = normStr(c.name);
        const codeNorm = normStr(c.code);
        return (nameNorm && nameNorm.length >= 4 && nameNorm.includes(norm)) ||
               (codeNorm && codeNorm.length >= 3 && codeNorm.includes(norm));
      });
      if (candidates.length === 1) {
        found = candidates[0];
      }
    }

    if (found && !resolved.includes(found.id)) {
      resolved.push(found.id);
    }
  }

  if (!resolved.length && defaultId) {
    resolved.push(defaultId);
  }
  return resolved;
}

function isDateString(val) {
  const s = String(val || '').trim();
  if (!s) return false;
  return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(s) || /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(s);
}

function isPhoneNumberString(val) {
  const s = String(val || '').trim().replace(/[\s.\-()]/g, '');
  return /^(?:0|\+?84)\d{8,10}$/.test(s);
}

function isStudentCodeLike(val, classCatalog = []) {
  const s = String(val || '').trim();
  if (!s || s.includes(' ') || isDateString(s) || isPhoneNumberString(s) || isStatusWord(s)) return false;
  if (/^\d+$/.test(s)) return false;
  // If it matches a known class in classCatalog, it is a classCode, NOT a studentCode
  if (resolveClassIdsFromCell(s, null, classCatalog).length > 0) return false;
  // Typical student code patterns: K9.1832, K09.3049, HS001, 2K9.0123 (letters/digits with short number suffix)
  if (/^(?:2?K\d{1,2}|HS|SV|MA|ST)[._\-]?\d{2,6}$/i.test(s)) return true;
  if (/^[A-Za-z]{1,4}\d{1,2}\.\d{2,6}$/.test(s)) return true;
  return false;
}

function isClassCodeLike(val, classCatalog = []) {
  const s = String(val || '').trim();
  if (!s || isDateString(s) || isPhoneNumberString(s) || isStatusWord(s) || /^\d+$/.test(s)) return false;
  if (resolveClassIdsFromCell(s, null, classCatalog).length > 0) return true;
  // Multi-part class codes like TSA2.QUANBM, 2K9.H4.GIANGNH, T3.QUANGDM (contains letters after dot)
  if (/^[A-Za-z0-9]{2,8}\.[A-Za-z0-9._\-]{2,20}$/.test(s) && /[A-Za-z]{2,}$/.test(s)) return true;
  return false;
}

/**
 * Smart content + header inspection that returns { hasHeader, roles: ['status', 'code', 'familyName', 'givenName', 'ignore', 'school', 'classCode', ...] }
 * for the Interactive Data Grid.
 */
export function autoDetectGridColumnRoles(rows = [], classCatalog = []) {
  if (!rows || !rows.length) return { hasHeader: false, roles: [] };
  const maxCols = Math.max(...rows.slice(0, 15).map(r => r.length));
  const firstRow = rows[0].map(c => String(c || '').trim());
  const lowerFirst = firstRow.map(c => c.toLowerCase());

  // Determine whether row 0 is a header row or already a data row!
  // If row 0 contains a date ("02/10/2026"), a student code ("K9.1832"), a phone number, or a status value ("HỌC") alongside codes:
  const row0HasDataSignals = firstRow.some(cell =>
    isDateString(cell) ||
    isPhoneNumberString(cell) ||
    isStudentCodeLike(cell, classCatalog) ||
    isStatusWord(cell)
  );

  const HEADER_KEYWORDS = [
    'stt', 'số thứ tự', 'mã hs', 'mã học sinh', 'student code',
    'họ và tên', 'họ tên', 'họ đệm', 'họ và tên đệm', 'tên hs', 'tên học sinh',
    'trường', 'trường học', 'sđt', 'điện thoại', 'phụ huynh', 'mã lớp', 'lớp học',
    'trạng thái', 'tình trạng', 'ngày sinh', 'ngày vào'
  ];
  const row0HeaderMatches = lowerFirst.filter(h =>
    HEADER_KEYWORDS.some(kw => h === kw || (kw.length >= 4 && h.includes(kw))) ||
    h === 'tên' || h === 'họ' || h === 'lớp' || h === 'mã' || h === 'đại' || h === 'hình'
  ).length;

  const hasHeader = !row0HasDataSignals && row0HeaderMatches >= 2 && rows.length > 1;
  const dataRows = (hasHeader ? rows.slice(1) : rows).slice(0, 20);
  const roles = new Array(maxCols).fill('ignore');

  // 1. If hasHeader is true, use header names first, then verify/fill with data samples
  if (hasHeader) {
    lowerFirst.forEach((h, idx) => {
      if (!h) return;
      if (h === 'stt' || h === 'tt' || h === 'no' || h === 'no.' || h === '#' || h.includes('số thứ tự') || h.includes('ngày')) {
        roles[idx] = 'ignore';
      } else if (h.includes('trạng thái') || h.includes('tình trạng') || h.includes('tt học') || h === 'status') {
        roles[idx] = 'status';
      } else if (h.includes('mã hs') || h.includes('mã học sinh') || h.includes('student code') || h === 'mã' || h === 'code') {
        roles[idx] = 'code';
      } else if (h.includes('sđt') || h.includes('điện thoại') || h.includes('phone') || h.includes('tel')) {
        roles[idx] = 'phone';
      } else if (h.includes('phụ huynh') || h.includes('tên ph') || h.includes('parent')) {
        roles[idx] = 'parentName';
      } else if (h.includes('trường') || h.includes('school')) {
        roles[idx] = 'school';
      } else if (h.includes('họ và tên đệm') || h.includes('họ đệm') || h === 'họ' || h === 'last name') {
        roles[idx] = 'familyName';
      } else if (h.includes('họ và tên') || h.includes('họ tên') || h === 'full name' || h === 'fullname') {
        roles[idx] = 'fullName';
      } else if (h === 'tên' || h === 'tên hs' || h === 'tên học sinh' || h === 'first name' || h === 'name') {
        roles[idx] = 'givenName';
      } else if (h.includes('tag') || h.includes('phân loại') || h.includes('nhãn') || h.includes('thẻ')) {
        roles[idx] = 'tag';
      }
    });

    // Detect classCode with priority: 'mã lớp' > 'lớp'
    // This prevents generic "Lớp" (e.g. "Toán 9") from co-existing with explicit "Mã lớp" (e.g. "2K9.T5")
    const maLopIdxs = lowerFirst.map((h, i) => (h.includes('mã lớp') || h === 'class code' || h.includes('mã lớp học') || h.includes('classcode')) ? i : -1).filter(i => i >= 0);
    if (maLopIdxs.length > 0) {
      maLopIdxs.forEach(i => { roles[i] = 'classCode'; });
    } else {
      const lopIdxs = lowerFirst.map((h, i) => ((h.includes('lớp') || h === 'class' || h === 'đại' || h === 'hình') && roles[i] === 'ignore') ? i : -1).filter(i => i >= 0);
      if (lopIdxs.length > 0) {
        roles[lopIdxs[0]] = 'classCode';
      }
    }
  }

  // 2. Content-based inspection for any column still marked 'ignore' (or all columns when hasHeader is false)
  const colSamples = Array.from({ length: maxCols }, (_, colIdx) =>
    dataRows.map(r => String(r[colIdx] ?? '').trim()).filter(Boolean)
  );

  // Pass A: Identify unambiguous pattern columns (STT, Date, Status, Phone, StudentCode, ClassCode)
  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    if (hasHeader && roles[colIdx] !== 'ignore') continue;
    const vals = colSamples[colIdx];
    if (!vals.length) continue;

    const ratio = (pred) => vals.filter(pred).length / vals.length;

    // Check sequential STT / pure small integers
    if (ratio(v => /^\d{1,4}[.)]?$/.test(v)) >= 0.8) {
      roles[colIdx] = 'ignore';
      continue;
    }
    // Check Date (e.g. 02/10/2026) -> ignore!
    if (ratio(isDateString) >= 0.6) {
      roles[colIdx] = 'ignore';
      continue;
    }
    // Check Status ("HỌC", "Nghỉ", "Tạm nghỉ"...)
    if (ratio(isStatusWord) >= 0.5) {
      if (!roles.includes('status')) {
        roles[colIdx] = 'status';
        continue;
      }
    }
    // Check Phone
    if (ratio(isPhoneNumberString) >= 0.5) {
      if (!roles.includes('phone')) {
        roles[colIdx] = 'phone';
        continue;
      }
    }
    // Check Student Code (e.g. K9.1832)
    if (ratio(v => isStudentCodeLike(v, classCatalog)) >= 0.5) {
      if (!roles.includes('code')) {
        roles[colIdx] = 'code';
        continue;
      }
    }
    // Check Class Code (e.g. 2K9.H4.GIANGNH, TSA2.QUANBM)
    if (ratio(v => isClassCodeLike(v, classCatalog)) >= 0.4) {
      roles[colIdx] = 'classCode';
      continue;
    }
  }

  // Pass B: Identify Name columns (familyName + givenName OR fullName) and School column among remaining text columns
  const hasAnyNameRole = roles.includes('fullName') || roles.includes('givenName') || roles.includes('familyName');
  if (!hasAnyNameRole) {
    const candidateCols = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      if (roles[colIdx] !== 'ignore') continue;
      const vals = colSamples[colIdx];
      if (!vals.length) continue;
      // Ignore pure numbers or dates
      if (vals.every(v => /^\d+$/.test(v) || isDateString(v))) continue;
      candidateCols.push(colIdx);
    }

    // Check if there is a pair of adjacent columns (colA, colB) where colA is familyName (1-4 words) and colB is givenName (single word, no spaces, Vietnamese letters)
    let foundSplitPair = false;
    for (let i = 0; i < candidateCols.length - 1; i++) {
      const cA = candidateCols[i];
      const cB = candidateCols[i + 1];
      if (cB === cA + 1) {
        const valsA = colSamples[cA];
        const valsB = colSamples[cB];
        const aLooksLikeFamily = valsA.filter(v => !/\d/.test(v) && v.length >= 2).length / Math.max(1, valsA.length) >= 0.6;
        const bLooksLikeSingleGiven = valsB.filter(v => !v.includes(' ') && !/\d/.test(v) && v.length >= 1 && v.length <= 12).length / Math.max(1, valsB.length) >= 0.7;
        if (aLooksLikeFamily && bLooksLikeSingleGiven) {
          roles[cA] = 'familyName';
          roles[cB] = 'givenName';
          foundSplitPair = true;
          break;
        }
      }
    }

    if (!foundSplitPair && candidateCols.length > 0) {
      // Find first column that looks like full Vietnamese name
      const fullCol = candidateCols.find(c => {
        const vals = colSamples[c];
        return vals.filter(v => v.includes(' ') && !/\d/.test(v)).length / Math.max(1, vals.length) >= 0.5;
      }) ?? candidateCols[0];
      roles[fullCol] = 'fullName';
    }
  } else if (roles.includes('givenName') && !roles.includes('familyName') && !roles.includes('fullName')) {
    // If only "Tên" was matched by header and no "Họ đệm", check if previous column is familyName, otherwise make it fullName
    const gIdx = roles.indexOf('givenName');
    const valsG = colSamples[gIdx] || [];
    const mostlyMultiWord = valsG.filter(v => v.includes(' ')).length / Math.max(1, valsG.length) >= 0.5;
    if (mostlyMultiWord) {
      roles[gIdx] = 'fullName';
    }
  }

  // Pass C: Find School column among remaining unassigned text columns after the name columns
  if (!roles.includes('school')) {
    const lastNameIdx = Math.max(roles.indexOf('givenName'), roles.indexOf('fullName'), roles.indexOf('familyName'));
    for (let colIdx = Math.max(0, lastNameIdx + 1); colIdx < maxCols; colIdx++) {
      if (roles[colIdx] !== 'ignore') continue;
      const vals = colSamples[colIdx];
      if (!vals.length) continue;
      if (vals.filter(v => isDateString(v) || /^\d+$/.test(v)).length / vals.length >= 0.5) continue;
      roles[colIdx] = 'school';
      break;
    }
  }

  return { hasHeader, roles };
}

/**
 * Extracts student objects directly from the Interactive Data Grid using the column role array.
 */
export function extractStudentsFromGrid(rows = [], roles = [], options = {}, classCatalog = []) {
  if (!rows || !rows.length) return [];
  const {
    hasHeader = false,
    defaultClassId = '',
    contextClassId = ''
  } = options;

  const startIndex = hasHeader ? 1 : 0;
  const results = [];

  const codeCols = [];
  const familyCols = [];
  const givenCols = [];
  const fullCols = [];
  const schoolCols = [];
  const classCols = [];
  const phoneCols = [];
  const parentCols = [];
  const statusCols = [];
  const tagCols = [];

  roles.forEach((role, idx) => {
    if (role === 'code') codeCols.push(idx);
    else if (role === 'familyName') familyCols.push(idx);
    else if (role === 'givenName') givenCols.push(idx);
    else if (role === 'fullName') fullCols.push(idx);
    else if (role === 'school') schoolCols.push(idx);
    else if (role === 'classCode') classCols.push(idx);
    else if (role === 'phone') phoneCols.push(idx);
    else if (role === 'parentName') parentCols.push(idx);
    else if (role === 'status') statusCols.push(idx);
    else if (role === 'tag') tagCols.push(idx);
  });

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;

    const firstNonEmpty = (cols) => {
      for (const c of cols) {
        const v = String(row[c] ?? '').trim();
        if (v) return v;
      }
      return '';
    };

    let familyName = '';
    let givenName = '';
    let fullName = '';

    if (familyCols.length || givenCols.length) {
      familyName = firstNonEmpty(familyCols);
      givenName = firstNonEmpty(givenCols);
      fullName = `${familyName} ${givenName}`.trim();
      if (!familyName && fullName.includes(' ')) {
        const sp = splitVietnameseName(fullName);
        familyName = sp.familyName;
        givenName = sp.givenName;
      }
    } else if (fullCols.length) {
      fullName = firstNonEmpty(fullCols);
      const sp = splitVietnameseName(fullName);
      familyName = sp.familyName;
      givenName = sp.givenName;
    }

    if (!fullName || fullName.length < 2 || /^\d+$/.test(fullName)) continue;

    let rawCode = firstNonEmpty(codeCols);
    // Guard: never allow a status word ("HỌC") or pure serial integer ("1", "2") or date to be saved as studentCode!
    if (rawCode && (isStatusWord(rawCode) || /^\d{1,3}$/.test(rawCode) || isDateString(rawCode))) {
      rawCode = '';
    }

    let rawSchool = firstNonEmpty(schoolCols);
    if (rawSchool && isDateString(rawSchool)) {
      rawSchool = '';
    }

    const parentName = firstNonEmpty(parentCols);
    const rawStatus = firstNonEmpty(statusCols);
    const enrollmentStatus = normalizeEnrollmentStatus(rawStatus);
    const rawTag = firstNonEmpty(tagCols);
    const cleanTag = isBirthYearOrCohortTag(rawTag) ? '' : rawTag;

    // Resolve class IDs from all columns marked as 'classCode'
    const classIds = [];
    for (const cIdx of classCols) {
      const cellVal = String(row[cIdx] ?? '').trim();
      if (cellVal) {
        const ids = resolveClassIdsFromCell(cellVal, null, classCatalog);
        ids.forEach(cid => {
          if (cid && !classIds.includes(cid)) classIds.push(cid);
        });
      }
    }

    // CRITICAL RULE:
    // 1. If opened inside a specific class context (contextClassId, e.g., 2K9.H4.GIANGNH), ALWAYS attach contextClassId!
    if (contextClassId && !classIds.includes(contextClassId)) {
      classIds.push(contextClassId);
    }
    // 2. If user selected a defaultClassId in the dropdown and no class matched (or defaultClassId is explicitly set), attach defaultClassId!
    if (defaultClassId && !classIds.includes(defaultClassId)) {
      if (!classIds.length || defaultClassId === contextClassId) {
        classIds.push(defaultClassId);
      }
    }

    results.push({
      name: fullName,
      familyName,
      givenName,
      studentCode: rawCode ? rawCode.toUpperCase() : null,
      school: rawSchool,
      classIds,
      parentContact: {
        name: parentName
      },
      enrollmentStatus,
      tag: cleanTag,
      isNew: false
    });
  }

  return results;
}

/**
 * Legacy-compatible wrappers so any external call to autoDetectColumnMapping / mapCustomColumns also uses the smart engine.
 */
export function autoDetectColumnMapping(rows = [], classCatalog = []) {
  const { hasHeader, roles } = autoDetectGridColumnRoles(rows, classCatalog);
  const classCols = roles.map((r, i) => r === 'classCode' ? i : -1).filter(i => i >= 0);
  const hasSplit = roles.includes('familyName') || roles.includes('givenName');
  return {
    hasHeader,
    nameMode: hasSplit && !roles.includes('fullName') ? 'split' : 'single',
    sttCol: -1,
    codeCol: roles.indexOf('code'),
    fullNameCol: roles.indexOf('fullName'),
    familyNameCol: roles.indexOf('familyName'),
    givenNameCol: roles.indexOf('givenName'),
    schoolCol: roles.indexOf('school'),
    classCol1: classCols[0] ?? -1,
    classCol2: classCols[1] ?? -1,
    classCol3: classCols[2] ?? -1,
    phoneCol: roles.indexOf('phone'),
    parentNameCol: roles.indexOf('parentName'),
    statusCol: roles.indexOf('status'),
    tagCol: roles.indexOf('tag'),
    roles
  };
}

export function mapCustomColumns(rows, mapping, classCatalog = []) {
  if (mapping && Array.isArray(mapping.roles)) {
    return extractStudentsFromGrid(rows, mapping.roles, mapping, classCatalog);
  }
  const maxCols = Math.max(12, ...(rows || []).slice(0, 5).map(r => r.length));
  const roles = new Array(maxCols).fill('ignore');
  if (mapping) {
    if (mapping.codeCol >= 0) roles[mapping.codeCol] = 'code';
    if (mapping.nameMode === 'split') {
      if (mapping.familyNameCol >= 0) roles[mapping.familyNameCol] = 'familyName';
      if (mapping.givenNameCol >= 0) roles[mapping.givenNameCol] = 'givenName';
    } else if (mapping.fullNameCol >= 0) {
      roles[mapping.fullNameCol] = 'fullName';
    }
    if (mapping.schoolCol >= 0) roles[mapping.schoolCol] = 'school';
    if (mapping.classCol1 >= 0) roles[mapping.classCol1] = 'classCode';
    if (mapping.classCol2 >= 0) roles[mapping.classCol2] = 'classCode';
    if (mapping.classCol3 >= 0) roles[mapping.classCol3] = 'classCode';
    if (mapping.phoneCol >= 0) roles[mapping.phoneCol] = 'phone';
    if (mapping.parentNameCol >= 0) roles[mapping.parentNameCol] = 'parentName';
    if (mapping.statusCol >= 0) roles[mapping.statusCol] = 'status';
    if (mapping.tagCol >= 0) roles[mapping.tagCol] = 'tag';
  }
  return extractStudentsFromGrid(rows, roles, mapping || {}, classCatalog);
}

export function parseRosterText(rawText, classCatalog = [], defaultClassId = null) {
  const { rows } = parseRawTable(rawText);
  if (!rows.length) return [];
  const { hasHeader, roles } = autoDetectGridColumnRoles(rows, classCatalog);
  return extractStudentsFromGrid(rows, roles, { hasHeader, defaultClassId }, classCatalog);
}

export function downloadFile(content, fileName, mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

// ============================================================================
// NATIVE MICROSOFT EXCEL (.XLSX) OPENXML GENERATOR & READER (v3.6)
// ============================================================================
const _CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function _crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = _CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _buildZipArchiveBytes(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = _crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true);      // STORE (method 0)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of localParts) { out.set(p, pos); pos += p.length; }
  for (const p of centralParts) { out.set(p, pos); pos += p.length; }
  out.set(eocd, pos);
  return out;
}

function _colIndexToExcelLetter(colIdx) {
  let s = '';
  let n = colIdx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function _escapeXmlText(val) {
  return String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildXlsxWorkbookBytes(headers = [], rows = [], sheetName = 'DuLieu') {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const allRows = [safeHeaders, ...safeRows];
  const colCount = Math.max(1, safeHeaders.length, ...safeRows.map(r => (Array.isArray(r) ? r.length : 0)));
  const colWidths = new Array(colCount).fill(12);

  allRows.forEach((r, rIdx) => {
    if (!Array.isArray(r)) return;
    r.forEach((cell, cIdx) => {
      const len = String(cell ?? '').length;
      const estimated = Math.min(56, Math.max(10, Math.ceil(len * (rIdx === 0 ? 1.35 : 1.18)) + 4));
      if (estimated > colWidths[cIdx]) colWidths[cIdx] = estimated;
    });
  });

  const colsXml = '<cols>' + colWidths.map((w, idx) =>
    `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
  ).join('') + '</cols>';

  const rowsXml = allRows.map((r, rIdx) => {
    const rowNum = rIdx + 1;
    const styleIdx = rIdx === 0 ? 1 : 2;
    const ht = rIdx === 0 ? ' ht="26" customHeight="1"' : ' ht="21" customHeight="1"';
    const cellsXml = (Array.isArray(r) ? r : []).map((cellVal, cIdx) => {
      const ref = `${_colIndexToExcelLetter(cIdx)}${rowNum}`;
      const text = _escapeXmlText(cellVal ?? '');
      return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${rowNum}"${ht}>${cellsXml}</row>`;
  }).join('');

  const cleanSheetName = _escapeXmlText(
    String(sheetName || 'DuLieu').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'DuLieu'
  );

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${cleanSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF1C3124"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FF164E28"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF5EC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD0DDD2"/></left>
      <right style="thin"><color rgb="FFD0DDD2"/></right>
      <top style="thin"><color rgb="FFD0DDD2"/></top>
      <bottom style="thin"><color rgb="FFD0DDD2"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="0"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="0"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;

  return _buildZipArchiveBytes([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml }
  ]);
}

export function exportToExcel(headers, rows, fileName = 'bao-cao.xlsx') {
  const baseName = String(fileName || 'bao-cao').replace(/\.(csv|xlsx|xls)$/i, '');
  const finalName = `${baseName}.xlsx`;
  const sheetTitle = baseName.slice(0, 31) || 'DuLieu';
  const xlsxBytes = buildXlsxWorkbookBytes(headers, rows, sheetTitle);
  downloadFile(
    xlsxBytes,
    finalName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  return finalName;
}

// Giữ tên hàm exportToCsv để tương thích mọi nơi gọi nhưng tự động xuất ra chuẩn .xlsx
export function exportToCsv(headers, rows, fileName = 'bao-cao.xlsx') {
  return exportToExcel(headers, rows, fileName);
}

/**
 * Đọc file .xlsx trực tiếp trên trình duyệt (hỗ trợ cả nén Deflate và Store)
 * khi người dùng chọn file .xlsx trong hộp thoại Nhập danh sách học sinh.
 */
export async function parseXlsxArrayBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8');

  // Locate End of Central Directory (EOCD)
  let eocdPos = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) return [];

  const totalEntries = view.getUint16(eocdPos + 10, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);
  const entries = new Map();

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries && ptr < eocdPos; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const rawSlice = bytes.subarray(dataStart, dataStart + compSize);
    entries.set(name, { method, rawSlice });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  const readEntryText = async (entryName) => {
    const entry = entries.get(entryName);
    if (!entry) return '';
    if (entry.method === 0) {
      return decoder.decode(entry.rawSlice);
    }
    if (entry.method === 8 && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(entry.rawSlice);
      writer.close();
      const resp = new Response(ds.readable);
      const ab = await resp.arrayBuffer();
      return decoder.decode(new Uint8Array(ab));
    }
    return '';
  };

  const decodeXmlEntities = (str) => String(str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

  // Read sharedStrings.xml if present
  const sharedStrings = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const sstXml = await readEntryText('xl/sharedStrings.xml');
    const siMatches = sstXml.match(/<si[\s>][\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)];
      sharedStrings.push(decodeXmlEntities(tMatches.map(m => m[1]).join('')));
    }
  }

  // Find first worksheet
  const sheetKey = entries.has('xl/worksheets/sheet1.xml')
    ? 'xl/worksheets/sheet1.xml'
    : [...entries.keys()].find(k => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'));
  if (!sheetKey) return [];

  const sheetXml = await readEntryText(sheetKey);
  if (!sheetXml) return [];

  const colLetterToIdx = (letters) => {
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
      idx = idx * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
    }
    return Math.max(0, idx - 1);
  };

  const rows = [];
  const rowMatches = sheetXml.match(/<row[\s>][\s\S]*?<\/row>/g) || [];
  for (const rXml of rowMatches) {
    const rowCells = [];
    const cMatches = rXml.match(/<c[\s>][\s\S]*?(?:<\/c>|\/>)/g) || [];
    let nextFallbackCol = 0;
    for (const cXml of cMatches) {
      const refMatch = cXml.match(/\br="([A-Za-z]+)\d+"/);
      const colIdx = refMatch ? colLetterToIdx(refMatch[1]) : nextFallbackCol;
      nextFallbackCol = colIdx + 1;

      const typeMatch = cXml.match(/\bt="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : '';
      let val = '';
      if (cellType === 'inlineStr') {
        const tMatches = [...cXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)];
        val = decodeXmlEntities(tMatches.map(m => m[1]).join(''));
      } else {
        const vMatch = cXml.match(/<v>([\s\S]*?)<\/v>/);
        const rawV = vMatch ? decodeXmlEntities(vMatch[1]) : '';
        if (cellType === 's') {
          const sIdx = Number(rawV);
          val = sharedStrings[sIdx] ?? rawV;
        } else {
          val = rawV;
        }
      }
      while (rowCells.length <= colIdx) rowCells.push('');
      rowCells[colIdx] = String(val ?? '').trim();
    }
    if (rowCells.some(c => c !== '')) {
      rows.push(rowCells);
    }
  }
  return rows;
}

// ============================================================================
// NHẬP ĐIỂM NHANH TỪ FILE EXCEL / DÁN BẢNG TÍNH THEO MÃ HỌC SINH (BTVN & TEST)
// ============================================================================
export const SCORE_IMPORT_COLUMN_ROLE_OPTIONS = [
  { value: 'ignore', label: '— Bỏ qua cột này —' },
  { value: 'studentCode', label: 'Mã học sinh (Bắt buộc / Ưu tiên)' },
  { value: 'hwScore', label: 'Điểm BTVN (0 - 10)' },
  { value: 'testScore', label: 'Điểm Test / Kiểm tra (0 - 10)' },
  { value: 'note', label: 'Ghi chú buổi học' },
  { value: 'fullName', label: 'Họ và tên (Phụ trợ đối chiếu)' }
];

function _isLikelyScoreVal(val) {
  const s = String(val || '').trim().replace(',', '.');
  if (!s) return false;
  if (s === '/') return true;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return false;
  const n = Number(s);
  return !Number.isNaN(n) && n >= 0 && n <= 10;
}

function _isLikelyStudentCodeVal(val) {
  const s = String(val || '').trim();
  if (!s || s.length < 2 || s.length > 24) return false;
  if (_isLikelyScoreVal(s) && s.length <= 3) return false;
  return /^(?:2?K\d{1,2}[._-]?\d+|HS[._-]?\d+|[A-Z]{1,5}[._-]?\d{2,6}|\d{3,8})$/i.test(s);
}

export function autoDetectScoreColumnRoles(rows, hasHeader = false) {
  if (!rows || !rows.length) return [];
  const maxCols = Math.max(...rows.map(r => r.length));
  const roles = new Array(maxCols).fill('ignore');
  const headerRow = hasHeader ? rows[0].map(c => String(c || '').toLowerCase().trim()) : [];
  const sampleRows = (hasHeader ? rows.slice(1) : rows).slice(0, 30);

  let foundCode = false;
  let foundHw = false;
  let foundTest = false;
  let foundName = false;
  let foundNote = false;

  if (hasHeader && headerRow.length) {
    headerRow.forEach((h, idx) => {
      if (!h) return;
      if (!foundCode && (h.includes('mã hs') || h.includes('ma hs') || h.includes('mã học sinh') || h.includes('student code') || h === 'mã' || h === 'id')) {
        roles[idx] = 'studentCode';
        foundCode = true;
      } else if (!foundHw && (h.includes('btvn') || h.includes('bài tập') || h.includes('diem btvn') || h.includes('điểm btvn') || h === 'điểm' || h === 'diem')) {
        roles[idx] = 'hwScore';
        foundHw = true;
      } else if (!foundTest && (h.includes('test') || h.includes('kiểm tra') || h.includes('kiem tra') || h.includes('điểm ktra') || h.includes('diem test'))) {
        roles[idx] = 'testScore';
        foundTest = true;
      } else if (!foundNote && (h.includes('ghi chú') || h.includes('ghi chu') || h.includes('nhận xét') || h.includes('note'))) {
        roles[idx] = 'note';
        foundNote = true;
      } else if (!foundName && (h.includes('họ tên') || h.includes('họ và tên') || h.includes('tên') || h.includes('name'))) {
        roles[idx] = 'fullName';
        foundName = true;
      }
    });
  }

  if (!sampleRows.length) return roles;

  for (let col = 0; col < maxCols; col++) {
    if (roles[col] !== 'ignore') continue;
    const vals = sampleRows.map(r => String(r[col] || '').trim()).filter(Boolean);
    if (!vals.length) continue;

    const codeRatio = vals.filter(_isLikelyStudentCodeVal).length / vals.length;
    const scoreRatio = vals.filter(_isLikelyScoreVal).length / vals.length;

    if (!foundCode && codeRatio >= 0.45) {
      roles[col] = 'studentCode';
      foundCode = true;
      continue;
    }
    if (scoreRatio >= 0.5) {
      if (!foundHw) {
        roles[col] = 'hwScore';
        foundHw = true;
        continue;
      }
      if (!foundTest) {
        roles[col] = 'testScore';
        foundTest = true;
        continue;
      }
    }
    const nameRatio = vals.filter(v => /[a-zA-ZÀ-ỹ]/.test(v) && !_isLikelyStudentCodeVal(v) && !_isLikelyScoreVal(v)).length / vals.length;
    if (!foundName && nameRatio >= 0.6) {
      roles[col] = 'fullName';
      foundName = true;
      continue;
    }
    if (!foundNote && nameRatio >= 0.3) {
      roles[col] = 'note';
      foundNote = true;
    }
  }

  // Fallback for simple 2-column paste: [Mã HS, Điểm BTVN]
  if (!foundCode && maxCols >= 2) {
    roles[0] = 'studentCode';
    if (!foundHw && roles[1] === 'ignore') roles[1] = 'hwScore';
  }

  return roles;
}

export function extractScoresFromGrid(rows, colRoles, hasHeader = false) {
  if (!rows || !rows.length) return [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const results = [];

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const row = dataRows[rIdx];
    if (!row || !row.length) continue;

    let studentCode = '';
    let fullName = '';
    let rawHwScore = '';
    let rawTestScore = '';
    let note = '';

    for (let c = 0; c < row.length; c++) {
      const role = colRoles[c] || 'ignore';
      const val = String(row[c] ?? '').trim();
      if (!val || role === 'ignore') continue;
      if (role === 'studentCode' && !studentCode) studentCode = val.toUpperCase();
      else if (role === 'fullName') fullName = fullName ? `${fullName} ${val}` : val;
      else if (role === 'hwScore' && rawHwScore === '') rawHwScore = val;
      else if (role === 'testScore' && rawTestScore === '') rawTestScore = val;
      else if (role === 'note') note = note ? `${note}; ${val}` : val;
    }

    // Skip accidental header rows when hasHeader wasn't checked
    if (rIdx === 0 && !hasHeader) {
      const lowCode = studentCode.toLowerCase();
      const lowHw = rawHwScore.toLowerCase();
      if (lowCode.includes('mã') || lowCode === 'id' || lowHw.includes('điểm') || lowHw.includes('btvn')) {
        continue;
      }
    }

    if (!studentCode && !fullName) continue;

    const parseScoreCell = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return { hasValue: false, score: null, raw: '' };
      const clean = String(raw).trim().replace(',', '.');
      if (!clean) return { hasValue: false, score: null, raw: '' };
      const num = Number(clean);
      if (Number.isNaN(num) || num < 0 || num > 10) {
        return { hasValue: true, score: null, invalid: true, raw: String(raw) };
      }
      return { hasValue: true, score: Math.round(num * 100) / 100, invalid: false, raw: String(raw) };
    };

    const hwParsed = parseScoreCell(rawHwScore);
    const testParsed = parseScoreCell(rawTestScore);

    results.push({
      rowIndex: hasHeader ? rIdx + 2 : rIdx + 1,
      studentCode,
      fullName,
      hwParsed,
      testParsed,
      note
    });
  }

  return results;
}

const GOOGLE_SHEETS_CONFIG_KEY = 'lopvui.google-sheets-config.v1';

export function extractSpreadsheetId(rawInput = '') {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function extractSheetGid(rawInput = '') {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return '';
  const gidMatch = trimmed.match(/[?#&]gid=(\d+)/i);
  if (gidMatch && gidMatch[1]) return gidMatch[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return '';
}

export const DEFAULT_COHORTS = [
  { cohortName: '2K9', birthYear: 2009, sheetUrl: '', spreadsheetId: '', sheetName: '2K9', gid: '0' },
  { cohortName: '2K10', birthYear: 2010, sheetUrl: '', spreadsheetId: '', sheetName: '2K10', gid: '0' },
  { cohortName: '2K11', birthYear: 2011, sheetUrl: '', spreadsheetId: '', sheetName: '2K11', gid: '0' },
  { cohortName: '2K12', birthYear: 2012, sheetUrl: '', spreadsheetId: '', sheetName: '2K12', gid: '0' },
  { cohortName: '2K13', birthYear: 2013, sheetUrl: '', spreadsheetId: '', sheetName: '2K13', gid: '0' }
];

export const GOOGLE_APPS_SCRIPT_BRIDGE_CODE = `/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ HỌC SINH
 * Hỗ trợ Đọc/Ghi dữ liệu 2 chiều theo Mã HS qua nhiều Sheet/Trang tính
 * Vượt qua rào cản tài khoản bị giới hạn quyền truy cập hoặc hạn chế miền tổ chức
 *
 * HƯỚNG DẪN TRIỂN KHAI (5 BƯỚC):
 * 1. Trên Google Sheet, vào: Tiện ích mở rộng (Extensions) > Apps Script
 * 2. Xóa code cũ và dán toàn bộ đoạn mã này vào.
 * 3. Bấm "Triển khai" (Deploy) > "Tùy chọn triển khai mới" (New deployment).
 * 4. Chọn loại: "Ứng dụng web" (Web app).
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me / email của bạn)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 5. Bấm "Triển khai" > Cấp quyền (Authorize) > Copy "URL ứng dụng web" dán vào phần mềm.
 */

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    var params = raw ? JSON.parse(raw) : (e && e.parameter ? e.parameter : {});
    var action = params.action || 'readSheetByCode';
    var spreadsheetId = params.spreadsheetId;
    var ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();

    // 1. Kiểm tra kết nối nhanh (Ping)
    if (action === 'ping') {
      return respondJson({ ok: true, success: true, message: 'Kết nối Google Apps Script thành công!' });
    }

    // 2. Đọc tất cả các sheet / trang tính (Multi-sheet)
    if (action === 'readAllSheets') {
      var allSheets = ss.getSheets();
      var sheetsData = [];
      for (var s = 0; s < allSheets.length; s++) {
        var sh = allSheets[s];
        var data = sh.getDataRange().getValues();
        sheetsData.push({
          sheetName: sh.getName(),
          gid: String(sh.getSheetId()),
          rowCount: data.length,
          rows: data
        });
      }
      return respondJson({ ok: true, success: true, totalSheets: sheetsData.length, sheets: sheetsData });
    }

    // 3. Đọc dữ liệu theo tên Sheet hoặc GID
    if (action === 'readSheetByCode' || action === 'readSheet') {
      var targetSheet = null;
      if (params.sheetName) {
        targetSheet = ss.getSheetByName(params.sheetName);
      }
      if (!targetSheet && params.gid !== undefined && params.gid !== '') {
        var sheets = ss.getSheets();
        for (var i = 0; i < sheets.length; i++) {
          if (String(sheets[i].getSheetId()) === String(params.gid)) {
            targetSheet = sheets[i];
            break;
          }
        }
      }
      if (!targetSheet) targetSheet = ss.getSheets()[0];
      var rows = targetSheet.getDataRange().getValues();
      return respondJson({
        ok: true,
        success: true,
        sheetName: targetSheet.getName(),
        gid: String(targetSheet.getSheetId()),
        rowCount: rows.length,
        rows: rows
      });
    }

    // 4. Đồng bộ 2 chiều / Cập nhật ngược lại Google Sheet theo Mã HS (In-place cell update & Append)
    if (action === 'syncStudentsByCode' || action === 'updateStudentsTwoWay') {
      var syncSheet = null;
      if (params.sheetName) {
        syncSheet = ss.getSheetByName(params.sheetName);
      }
      if (!syncSheet && params.gid !== undefined && params.gid !== '') {
        var allSh = ss.getSheets();
        for (var si = 0; si < allSh.length; si++) {
          if (String(allSh[si].getSheetId()) === String(params.gid)) {
            syncSheet = allSh[si];
            break;
          }
        }
      }
      if (!syncSheet) syncSheet = ss.getSheets()[0];
      if (!syncSheet) syncSheet = ss.insertSheet(params.sheetName || 'DiemDanh');

      var studentsList = params.students || [];
      var newRows = params.rows || [];
      var mode = params.mode || (action === 'updateStudentsTwoWay' ? 'inplace' : 'inplace');

      // Chế độ Cập nhật 2 chiều (In-place edit): Giữ nguyên công thức, định dạng, chỉ sửa đúng ô cần thiết
      if (mode === 'inplace' && studentsList.length > 0) {
        var dataRange = syncSheet.getDataRange();
        var sheetValues = dataRange.getValues();
        if (sheetValues.length > 0) {
          var headerRow = sheetValues[0].map(function(h) { return String(h || '').trim().toLowerCase(); });

          function findColIdx(candidates) {
            for (var c = 0; c < candidates.length; c++) {
              var idx = headerRow.indexOf(candidates[c].toLowerCase());
              if (idx >= 0) return idx;
            }
            return -1;
          }

          var codeCol = findColIdx(['mã hs', 'mã học sinh', 'ma hs', 'student code', 'code', 'id']);
          var nameCol = findColIdx(['họ và tên', 'họ tên', 'tên học sinh', 'tên', 'name', 'full name']);
          var statusCol = findColIdx(['trạng thái', 'tình trạng', 'status']);
          var classCol = findColIdx(['lớp', 'mã lớp', 'lop', 'class', 'class code']);
          var schoolCol = findColIdx(['trường', 'truong', 'school']);
          var parentCol = findColIdx(['phụ huynh', 'tên phụ huynh', 'ph', 'parent', 'parent name']);
          var tagCol = findColIdx(['tag', 'tags', 'thẻ', 'phân loại', 'nhãn']);
          var attCol = findColIdx(['điểm danh', 'diem danh', 'attendance', 'chuyên cần']);
          var hwCol = findColIdx(['btvn', 'bài tập về nhà', 'bai tap ve nha', 'homework', 'tình trạng btvn']);
          var btvnScoreCol = findColIdx(['điểm btvn', 'diem btvn', 'btvn score', 'điểm bài tập']);
          var testScoreCol = findColIdx(['điểm test', 'diem test', 'test score', 'điểm kiểm tra']);
          var noteCol = findColIdx(['ghi chú buổi học', 'ghi chú', 'ghi chu', 'nhận xét buổi học', 'session note', 'note']);
          var learningNotesCol = findColIdx(['ghi chú học lực', 'học lực', 'learning note', 'learning notes']);

          var codeRowMap = {};
          var nameRowMap = {};
          for (var r = 1; r < sheetValues.length; r++) {
            if (codeCol >= 0) {
              var cVal = String(sheetValues[r][codeCol] || '').trim().toUpperCase();
              if (cVal) codeRowMap[cVal] = r + 1; // 1-based row index for SpreadsheetApp
            }
            if (nameCol >= 0) {
              var nVal = String(sheetValues[r][nameCol] || '').trim().toLowerCase();
              if (nVal) nameRowMap[nVal] = r + 1;
            }
          }

          var updatedCount = 0;
          var insertedCount = 0;
          var unmappedStudents = [];

          for (var sIdx = 0; sIdx < studentsList.length; sIdx++) {
            var st = studentsList[sIdx];
            var targetRow = null;
            var stCode = String(st.studentCode || '').trim().toUpperCase();
            var stName = String(st.fullName || st.name || '').trim().toLowerCase();

            if (stCode && codeRowMap[stCode]) {
              targetRow = codeRowMap[stCode];
            } else if (stName && nameRowMap[stName]) {
              targetRow = nameRowMap[stName];
            }

            if (targetRow) {
              // QUY TẮC BẤT BIẾN: Đồng bộ 2 chiều CHỈ diễn ra ở cột Tag và các cột thông tin buổi học
              // (Tuyệt đối không đồng bộ / không ghi đè các cột thông tin chung học sinh: Tên, Mã HS, Trường, Lớp, Phụ huynh, Trạng thái)
              if (tagCol >= 0 && (st.tags !== undefined || st.tag !== undefined)) {
                var tagStr = Array.isArray(st.tags) ? st.tags.join(', ') : String(st.tags || st.tag || '');
                syncSheet.getRange(targetRow, tagCol + 1).setValue(tagStr);
              }
              if (attCol >= 0 && st.attendance !== undefined && st.attendance !== '') {
                syncSheet.getRange(targetRow, attCol + 1).setValue(st.attendance);
              }
              if (hwCol >= 0 && (st.homeworkStatus !== undefined || st.homework !== undefined)) {
                var hwVal = st.homeworkStatus !== undefined ? st.homeworkStatus : st.homework;
                if (hwVal !== '') syncSheet.getRange(targetRow, hwCol + 1).setValue(hwVal);
              }
              if (btvnScoreCol >= 0 && st.btvnScore !== undefined && st.btvnScore !== '') {
                syncSheet.getRange(targetRow, btvnScoreCol + 1).setValue(st.btvnScore);
              }
              if (testScoreCol >= 0 && st.testScore !== undefined && st.testScore !== '') {
                syncSheet.getRange(targetRow, testScoreCol + 1).setValue(st.testScore);
              }
              if (noteCol >= 0 && st.sessionNote !== undefined && st.sessionNote !== '') {
                syncSheet.getRange(targetRow, noteCol + 1).setValue(st.sessionNote);
              }
              if (learningNotesCol >= 0 && st.learningNotes !== undefined && st.learningNotes !== '') {
                syncSheet.getRange(targetRow, learningNotesCol + 1).setValue(st.learningNotes);
              }
              updatedCount++;
            } else {
              unmappedStudents.push(st);
            }
          }

          // Nếu có học sinh mới trên web chưa có trên Sheet và cho phép thêm dòng mới
          if (params.appendNew && unmappedStudents.length > 0) {
            for (var u = 0; u < unmappedStudents.length; u++) {
              var ust = unmappedStudents[u];
              var rowData = new Array(headerRow.length);
              for (var f = 0; f < rowData.length; f++) rowData[f] = '';
              if (codeCol >= 0) rowData[codeCol] = ust.studentCode || '';
              if (nameCol >= 0) rowData[nameCol] = ust.fullName || ust.name || '';
              if (statusCol >= 0) rowData[statusCol] = ust.enrollmentStatus || 'Học';
              if (tagCol >= 0) rowData[tagCol] = Array.isArray(ust.tags) ? ust.tags.join(', ') : (ust.tags || '');
              if (classCol >= 0) rowData[classCol] = ust.classCodes || '';
              if (schoolCol >= 0) rowData[schoolCol] = ust.school || '';
              if (parentCol >= 0) rowData[parentCol] = ust.parentName || (ust.parentContact && ust.parentContact.name) || '';
              syncSheet.appendRow(rowData);
              insertedCount++;
            }
          }

          return respondJson({
            ok: true,
            success: true,
            mode: 'inplace',
            updatedCount: updatedCount,
            insertedCount: insertedCount,
            totalStudents: studentsList.length,
            message: 'Đã cập nhật 2 chiều thành công: ' + updatedCount + ' dòng được cập nhật trực tiếp trên Sheet' + (insertedCount > 0 ? ', ' + insertedCount + ' dòng được thêm mới.' : '.')
          });
        }
      }

      // Fallback: Chế độ ghi đè (Overwrite mode khi được yêu cầu tường minh)
      if (newRows.length > 0) {
        syncSheet.clearContents();
        if (params.headers && params.headers.length) {
          syncSheet.appendRow(params.headers);
        }
        syncSheet.getRange(syncSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
      }
      return respondJson({ ok: true, success: true, mode: 'overwrite', updatedCount: newRows.length });
    }

    // 5. Đẩy dữ liệu buổi học (Điểm danh kèm link web, BTVN, Test, Ghi chú) lên Google Sheet
    if (action === 'uploadSessionData') {
      var sSheet = null;
      if (params.sheetName) {
        sSheet = ss.getSheetByName(params.sheetName);
      }
      if (!sSheet && params.gid !== undefined && params.gid !== '') {
        var shList = ss.getSheets();
        for (var i = 0; i < shList.length; i++) {
          if (String(shList[i].getSheetId()) === String(params.gid)) {
            sSheet = shList[i];
            break;
          }
        }
      }
      if (!sSheet) sSheet = ss.getSheets()[0];
      if (!sSheet) return respondJson({ ok: false, message: 'Không tìm thấy trang tính nào trong Google Sheet.' });

      var records = params.records || [];
      var dateStr = params.dateStr || params.date || '';
      var sessionUrl = params.sessionUrl || '';
      var hasHomework = params.hasHomework !== false;
      var hasTest = params.hasTest !== false;

      var dataRange = sSheet.getDataRange();
      var sheetValues = dataRange.getValues();
      if (sheetValues.length === 0) {
        return respondJson({ ok: false, message: 'Trang tính rỗng, vui lòng nhập danh sách học sinh trước khi đẩy dữ liệu buổi học.' });
      }

      var headerRow = sheetValues[0].map(function(h) { return String(h || '').trim(); });
      var headerRowLower = headerRow.map(function(h) { return h.toLowerCase(); });

      function findColIdx(candidates) {
        for (var c = 0; c < candidates.length; c++) {
          var idx = headerRowLower.indexOf(candidates[c].toLowerCase());
          if (idx >= 0) return idx;
        }
        return -1;
      }

      var codeCol = findColIdx(['mã hs', 'mã học sinh', 'ma hs', 'student code', 'code', 'id']);
      var nameCol = findColIdx(['họ và tên', 'họ tên', 'tên học sinh', 'tên', 'name', 'full name']);

      // Chuẩn bị tiêu đề các cột buổi học
      var attHeaderTitle = 'Điểm danh ' + dateStr + (sessionUrl ? ' (' + sessionUrl + ')' : '');
      var hwHeaderTitle = 'BTVN ' + dateStr;
      var testHeaderTitle = 'Test ' + dateStr;
      var noteHeaderTitle = 'Ghi chú ' + dateStr;

      function findColStartingWith(prefix) {
        var pLower = prefix.toLowerCase();
        for (var c = 0; c < headerRowLower.length; c++) {
          if (headerRowLower[c].indexOf(pLower) === 0) return c;
        }
        return -1;
      }

      var attCol = findColStartingWith('điểm danh ' + dateStr);
      var hwCol = findColStartingWith('btvn ' + dateStr);
      var testCol = findColStartingWith('test ' + dateStr);
      var noteCol = findColStartingWith('ghi chú ' + dateStr);

      var nextCol = headerRow.length + 1; // 1-based
      if (attCol < 0) {
        attCol = nextCol - 1;
        sSheet.getRange(1, nextCol).setValue(attHeaderTitle);
        nextCol++;
      } else {
        sSheet.getRange(1, attCol + 1).setValue(attHeaderTitle);
      }

      if (hwCol < 0) {
        hwCol = nextCol - 1;
        sSheet.getRange(1, nextCol).setValue(hwHeaderTitle);
        nextCol++;
      } else {
        sSheet.getRange(1, hwCol + 1).setValue(hwHeaderTitle);
      }

      if (testCol < 0) {
        testCol = nextCol - 1;
        sSheet.getRange(1, nextCol).setValue(testHeaderTitle);
        nextCol++;
      } else {
        sSheet.getRange(1, testCol + 1).setValue(testHeaderTitle);
      }

      if (noteCol < 0) {
        noteCol = nextCol - 1;
        sSheet.getRange(1, nextCol).setValue(noteHeaderTitle);
        nextCol++;
      } else {
        sSheet.getRange(1, noteCol + 1).setValue(noteHeaderTitle);
      }

      // Lập bản đồ dòng theo Mã HS và Họ tên
      var codeRowMap = {};
      var nameRowMap = {};
      for (var r = 1; r < sheetValues.length; r++) {
        if (codeCol >= 0) {
          var cVal = String(sheetValues[r][codeCol] || '').trim().toUpperCase();
          if (cVal) codeRowMap[cVal] = r + 1;
        }
        if (nameCol >= 0) {
          var nVal = String(sheetValues[r][nameCol] || '').trim().toLowerCase();
          if (nVal) nameRowMap[nVal] = r + 1;
        }
      }

      var updatedCount = 0;
      for (var k = 0; k < records.length; k++) {
        var rec = records[k];
        var sCode = String(rec.studentCode || '').trim().toUpperCase();
        var sName = String(rec.name || rec.fullName || '').trim().toLowerCase();
        var targetRow = (sCode && codeRowMap[sCode]) ? codeRowMap[sCode] : (sName && nameRowMap[sName] ? nameRowMap[sName] : null);

        if (targetRow) {
          // Điểm danh
          if (attCol >= 0 && rec.attendance) {
            sSheet.getRange(targetRow, attCol + 1).setValue(rec.attendance);
          }
          // BTVN (nếu không có BTVN ghi 'Không BTVN', nếu không nộp ghi 'Không nộp')
          if (hwCol >= 0) {
            var hwVal = !hasHomework ? 'Không BTVN' : (rec.homework !== undefined && rec.homework !== null && rec.homework !== '' ? String(rec.homework) : 'Không nộp');
            sSheet.getRange(targetRow, hwCol + 1).setValue(hwVal);
          }
          // Test (nếu không có test ghi 'Không Test')
          if (testCol >= 0) {
            var testVal = !hasTest ? 'Không Test' : (rec.testScore !== undefined && rec.testScore !== null && rec.testScore !== '' ? String(rec.testScore) : '—');
            sSheet.getRange(targetRow, testCol + 1).setValue(testVal);
          }
          // Ghi chú buổi học
          if (noteCol >= 0 && rec.note) {
            sSheet.getRange(targetRow, noteCol + 1).setValue(rec.note);
          }
          updatedCount++;
        }
      }

      return respondJson({
        ok: true,
        success: true,
        updatedCount: updatedCount,
        totalRecords: records.length,
        sheetName: sSheet.getName(),
        dateStr: dateStr,
        message: 'Đã đẩy dữ liệu buổi học ngày ' + dateStr + ' lên Google Sheet (' + sSheet.getName() + ') thành công: ' + updatedCount + '/' + records.length + ' học sinh đã được cập nhật.'
      });
    }

    return respondJson({ ok: false, error: 'Hành động không hợp lệ: ' + action });
  } catch (err) {
    return respondJson({ ok: false, error: err.toString() });
  }
}

function respondJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export function getGoogleAppsScriptTemplate() {
  return GOOGLE_APPS_SCRIPT_BRIDGE_CODE;
}

export async function testGoogleAppsScriptConnection(scriptUrl, spreadsheetId = '') {
  if (!scriptUrl) return { ok: false, message: 'Chưa nhập URL Google Apps Script.' };
  try {
    const resp = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping', spreadsheetId })
    });
    if (!resp.ok) return { ok: false, message: `Lỗi máy chủ Google Apps Script: HTTP ${resp.status}` };
    const data = await resp.json();
    return { ok: Boolean(data?.ok || data?.success), message: data?.message || 'Kết nối thành công!' };
  } catch (err) {
    return { ok: false, message: `Không thể kết nối đến Apps Script: ${err?.message || err}` };
  }
}

export function loadGoogleSheetsConfig(storage = localStorage) {
  const defaults = {
    spreadsheetId: '',
    rawSheetUrl: '',
    sheetName: '',
    gid: '',
    scriptUrl: '',
    apiKey: '',
    autoSync: false,
    defaultNewTag: true,
    classDiffMode: 'transfer',
    hasHeader: true,
    colCode: '',
    colFamilyName: '',
    colGivenName: '',
    colName: '',
    colClass: '',
    colSchool: '',
    colParent: '',
    colStatus: '',
    colTag: '',
    twoWayMode: true,
    appendNew: false,
    lastSyncedAt: null,
    syncStatus: 'idle',
    cohortSheets: DEFAULT_COHORTS
  };
  try {
    const parsed = JSON.parse(storage.getItem(GOOGLE_SHEETS_CONFIG_KEY) || 'null');
    if (!parsed) return defaults;
    const res = { ...defaults, ...parsed };
    if (!Array.isArray(res.cohortSheets) || !res.cohortSheets.length) {
      res.cohortSheets = DEFAULT_COHORTS;
    }
    return res;
  } catch {
    return defaults;
  }
}

export function saveGoogleSheetsConfig(config, storage = localStorage) {
  const current = loadGoogleSheetsConfig(storage);
  const merged = { ...current, ...(config || {}) };
  storage.setItem(GOOGLE_SHEETS_CONFIG_KEY, JSON.stringify(merged));
  return merged;
}

export async function syncSessionToGoogleSheets(sessionData, config) {
  try {
    const spreadsheetId = extractSpreadsheetId(config?.spreadsheetId || config?.rawSheetUrl);
    if (!spreadsheetId) {
      return {
        success: false,
        ok: false,
        message: 'Vui lòng nhập Google Spreadsheet ID hoặc dán đường link Google Sheets vào phần Cấu hình.'
      };
    }
    let scriptUrl = String(config?.scriptUrl || '').trim();
    if (!scriptUrl) {
      try {
        const driveCfg = JSON.parse(localStorage.getItem('lopvui.google-drive-photo-config.v1') || '{}') || {};
        scriptUrl = String(driveCfg.scriptUrl || '').trim();
      } catch {}
    }

    if (!scriptUrl) {
      return {
        success: false,
        ok: false,
        message: 'Để đẩy dữ liệu tự động lên Google Sheets, vui lòng nhập Google Apps Script Web App URL (hoặc dùng nút "Copy bảng dán vào Sheet" / "Xuất file .xlsx").'
      };
    }

    const timestamp = Date.now();
    const sheetName = String(config?.sheetName || '').trim() || 'DiemDanh';
    const headers = sessionData.headers || [
      'Mã HS', 'Họ đệm', 'Tên', 'Họ và tên', 'Trường', 'Phụ huynh',
      'Trạng thái', 'Tag', 'Mã lớp', 'Lớp cũ', 'Điểm danh', 'BTVN', 'Điểm BTVN', 'Điểm Test',
      'Ghi chú buổi học', 'Ghi chú học lực'
    ];
    const rows = Array.isArray(sessionData.rows) && sessionData.rows.length
      ? sessionData.rows
      : (sessionData.students || []).map(r => [
          r.studentCode || '', r.familyName || '', r.givenName || '', r.fullName || '',
          r.school || '', r.parentName || '', r.enrollmentStatus || 'Học',
          r.tags || (Array.isArray(r.tag) ? r.tag.join(', ') : (r.tag || '')),
          r.classCodes || '', r.oldClassCodes || '', r.attendance || '', r.homeworkStatus || '',
          r.btvnScore ?? '', r.testScore ?? '', r.sessionNote || '', r.learningNotes || ''
        ]);

    const isTwoWay = config?.twoWayMode !== false;
    const payload = {
      action: isTwoWay ? 'updateStudentsTwoWay' : 'syncStudentsByCode',
      mode: isTwoWay ? 'inplace' : 'overwrite',
      appendNew: false,
      spreadsheetId,
      sheetName,
      gid: config?.gid || '',
      date: sessionData.date || '',
      classId: sessionData.classId || '',
      classCode: sessionData.classCode || '',
      className: sessionData.className || '',
      headers,
      rows,
      // Quy tắc: 2 chiều chỉ gửi Tag và thông tin buổi học (không gửi thông tin chung học sinh)
      students: (sessionData.students || []).map(s => ({
        studentCode: s.studentCode || '',
        fullName: s.fullName || s.name || '',
        tags: s.tags || s.tag || '',
        tag: s.tag || (Array.isArray(s.tags) ? s.tags.join(', ') : ''),
        attendance: s.attendance || '',
        homeworkStatus: s.homeworkStatus || '',
        btvnScore: s.btvnScore ?? '',
        testScore: s.testScore ?? '',
        sessionNote: s.sessionNote || '',
        learningNotes: s.learningNotes || ''
      }))
    };

    const resp = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      return {
        success: false,
        ok: false,
        message: `Google Apps Script trả về lỗi HTTP ${resp.status}. Vui lòng kiểm tra lại Web App URL.`
      };
    }
    const remoteResult = await resp.json().catch(() => ({ ok: true }));
    if (remoteResult && remoteResult.ok === false) {
      return {
        success: false,
        ok: false,
        message: remoteResult.error || 'Apps Script báo lỗi khi ghi vào Google Sheets.'
      };
    }

    const updatedConfig = saveGoogleSheetsConfig({
      ...config,
      spreadsheetId,
      scriptUrl,
      lastSyncedAt: timestamp,
      syncStatus: 'success',
      lastSyncDetails: {
        date: sessionData.date,
        className: sessionData.className,
        totalStudents: rows.length,
        updatedCount: remoteResult?.updatedCount ?? null,
        insertedCount: remoteResult?.insertedCount ?? null,
        timestamp
      }
    });

    return {
      ...updatedConfig,
      success: true,
      ok: true,
      message: `✓ Đã đẩy thành công ${rows.length} học sinh lên Google Sheets${remoteResult?.updatedCount !== undefined ? ` (Cập nhật: ${remoteResult.updatedCount}, Thêm mới: ${remoteResult.insertedCount || 0})` : ''}!`
    };
  } catch (err) {
    return {
      success: false,
      ok: false,
      message: `Lỗi kết nối khi đẩy lên Google Sheets: ${err?.message || err}`
    };
  }
}

/**
 * Đẩy dữ liệu buổi học (Điểm danh, BTVN, Test, Ghi chú) lên Google Sheet qua Apps Script
 */
export async function uploadSessionDataToGoogleSheets({
  scriptUrl,
  spreadsheetId,
  sheetName,
  gid,
  classId,
  classCode,
  date,
  dateStr,
  sessionUrl,
  records = [],
  hasHomework = true,
  hasTest = true
}) {
  const cfg = loadGoogleSheetsConfig();
  let targetScriptUrl = scriptUrl || cfg.scriptUrl;
  if (!targetScriptUrl) {
    try {
      const driveCfg = JSON.parse(localStorage.getItem('lopvui.google-drive-photo-config.v1') || '{}') || {};
      targetScriptUrl = driveCfg.scriptUrl || '';
    } catch {}
  }
  if (!targetScriptUrl) {
    throw new Error('Chưa cấu hình Google Apps Script Web App URL. Vui lòng vào màn hình Đồng bộ Google Sheets để nhập URL.');
  }

  const targetSpreadsheetId = extractSpreadsheetId(spreadsheetId || cfg.spreadsheetId || cfg.rawSheetUrl);
  const targetSheetName = sheetName || cfg.sheetName || '';
  const targetGid = gid !== undefined && gid !== '' ? String(gid) : (cfg.gid || '');
  const formattedDate = dateStr || (date ? date.split('-').reverse().join('/') : '');

  const payload = {
    action: 'uploadSessionData',
    spreadsheetId: targetSpreadsheetId,
    sheetName: targetSheetName,
    gid: targetGid,
    classId,
    classCode,
    date,
    dateStr: formattedDate,
    sessionUrl: sessionUrl || '',
    records,
    hasHomework,
    hasTest
  };

  const resp = await fetch(targetScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`Google Apps Script trả về lỗi HTTP ${resp.status}`);
  }

  const result = await resp.json().catch(() => ({ ok: true, message: 'Đã hoàn tất.' }));
  if (result && result.ok === false) {
    throw new Error(result.error || result.message || 'Lỗi không xác định từ Apps Script');
  }
  return result;
}

/**
 * Đồng bộ ngược dữ liệu của 1 học sinh vừa được chỉnh sửa trên Web lên Google Sheet
 */
export async function syncSingleStudentToGoogleSheets(student) {
  if (!student) return { ok: false, message: 'Không có dữ liệu học sinh.' };
  const cfg = loadGoogleSheetsConfig();
  let scriptUrl = cfg.scriptUrl;
  if (!scriptUrl) {
    try {
      const driveCfg = JSON.parse(localStorage.getItem('lopvui.google-drive-photo-config.v1') || '{}') || {};
      scriptUrl = driveCfg.scriptUrl || '';
    } catch {}
  }
  if (!scriptUrl) {
    throw new Error('Chưa cấu hình Google Apps Script Web App URL.');
  }

  const spreadsheetId = extractSpreadsheetId(cfg.spreadsheetId || cfg.rawSheetUrl);
  const filteredTags = (Array.isArray(student.tags) ? student.tags : (student.tags ? [student.tags] : [])).filter(t => !isBirthYearOrCohortTag(t));
  // Quy tắc bất biến: Đồng bộ 2 chiều chỉ gửi Tag (không ghi đè thông tin chung học sinh lên Sheet)
  const payload = {
    action: 'updateStudentsTwoWay',
    mode: 'inplace',
    appendNew: false,
    spreadsheetId,
    sheetName: cfg.sheetName || '',
    gid: cfg.gid || '',
    students: [{
      studentCode: student.studentCode || '',
      fullName: student.name || '',
      tags: filteredTags,
      tag: filteredTags.join(', ')
    }]
  };

  const resp = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`Google Apps Script trả về lỗi HTTP ${resp.status}`);
  }

  return await resp.json();
}

function createFetchTimeoutSignal(ms = 8000) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    setTimeout(() => {
      try { controller.abort(); } catch {}
    }, ms);
    return controller.signal;
  }
  return undefined;
}

export async function pullStudentsFromGoogleSheets(config) {
  try {
    const rawUrlOrId = String(config?.rawSheetUrl || config?.spreadsheetId || '').trim();
    const spreadsheetId = extractSpreadsheetId(rawUrlOrId);
    const gid = String(config?.gid || extractSheetGid(rawUrlOrId) || '').trim();
    if (!spreadsheetId) {
      return {
        success: false,
        ok: false,
        rows: [],
        message: 'Vui lòng nhập Link Google Sheets hoặc Spreadsheet ID ở mục Cấu hình.'
      };
    }
    const sheetName = String(config?.sheetName || '').trim();
    let scriptUrl = String(config?.scriptUrl || '').trim();
    if (!scriptUrl) {
      try {
        const driveCfg = JSON.parse(localStorage.getItem('lopvui.google-drive-photo-config.v1') || '{}') || {};
        scriptUrl = String(driveCfg.scriptUrl || '').trim();
      } catch {}
    }

    // 1. Ưu tiên đọc qua Google Apps Script Web App nếu đã cấu hình
    if (scriptUrl) {
      try {
        const sig = createFetchTimeoutSignal(9000);
        const resp = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'readSheetByCode',
            spreadsheetId,
            sheetName,
            gid
          }),
          signal: sig
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok && Array.isArray(data.rows) && data.rows.length) {
            return {
              success: true,
              ok: true,
              rows: data.rows,
              source: 'apps-script',
              message: `Đã đọc ${data.rows.length} dòng từ Google Sheets qua Apps Script.`
            };
          }
        }
      } catch (err) {
        console.warn('Apps Script fetch failed:', err?.message || err);
      }
    }

    // 2. Fallback: Đọc trực tiếp từ link Google Sheets (gviz CSV hoặc export CSV)
    const candidateUrls = [];
    if (sheetName) {
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
    }
    if (gid) {
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`);
      candidateUrls.push(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`);
    }
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv`);

    let htmlLoginDetected = false;
    let lastHttpStatus = null;
    let lastNetworkError = null;

    for (const csvUrl of candidateUrls) {
      try {
        const sig = createFetchTimeoutSignal(7000);
        const csvResp = await fetch(csvUrl, { cache: 'no-store', signal: sig });
        lastHttpStatus = csvResp.status;
        if (!csvResp.ok) continue;
        const csvText = await csvResp.text();
        if (!csvText) continue;
        if (csvText.trim().startsWith('<!DOCTYPE html') || csvText.trim().startsWith('<html') || csvText.includes('ServiceLogin') || csvText.includes('accounts.google.com')) {
          htmlLoginDetected = true;
          continue;
        }
        const parsed = parseRawTable(csvText);
        const rows = Array.isArray(parsed) ? parsed : (parsed?.rows || []);
        if (rows.length) {
          return {
            success: true,
            ok: true,
            rows,
            source: 'gviz-csv',
            message: `Đã đọc ${rows.length} dòng trực tiếp từ Google Sheets.`
          };
        }
      } catch (err) {
        lastNetworkError = err?.message || String(err);
      }
    }

    if (htmlLoginDetected) {
      return {
        success: false,
        ok: false,
        rows: [],
        message: 'Google Sheet đang ở chế độ RIÊNG TƯ (cần đăng nhập Google). Vui lòng mở Google Sheet -> Bấm nút "Chia sẻ" -> Chuyển quyền thành "Bất kỳ ai có đường liên kết đều có thể xem (Người xem)", hoặc dán trực tiếp vùng dữ liệu (Ctrl+V) vào ô bên dưới.'
      };
    }

    const detailErr = lastNetworkError ? ` (Lỗi mạng: ${lastNetworkError})` : (lastHttpStatus ? ` (Mã HTTP: ${lastHttpStatus})` : '');
    return {
      success: false,
      ok: false,
      rows: [],
      message: `Không thể đọc trực tiếp từ link Google Sheet${detailErr}. Hãy đảm bảo: (1) Sheet được chia sẻ quyền xem công khai, (2) Tên trang tính (tab) đúng, hoặc (3) Dán trực tiếp vùng dữ liệu từ Google Sheets (Ctrl+V) vào ô bên dưới.`
    };
  } catch (err) {
    return {
      success: false,
      ok: false,
      rows: [],
      message: `Lỗi khi tải dữ liệu từ Google Sheets: ${err?.message || err}`
    };
  }
}

export async function pullStudentsFromGoogleSheetsMultiCohort(config, specificCohort = null) {
  try {
    const cohorts = Array.isArray(config?.cohortSheets) ? config.cohortSheets : DEFAULT_COHORTS;
    const targetCohorts = specificCohort
      ? cohorts.filter(c => c.cohortName === specificCohort)
      : cohorts.filter(c => c.spreadsheetId || c.sheetUrl || c.sheetName || c.gid);

    if (!targetCohorts.length) {
      const singleRes = await pullStudentsFromGoogleSheets(config);
      return {
        ...singleRes,
        totalRows: singleRes.rows ? singleRes.rows.length : 0,
        cohortResults: [config.sheetName || 'Chính']
      };
    }

    // Nếu có Apps Script URL và đang quét tất cả các sheet, thử gọi action: 'readAllSheets'
    const scriptUrl = String(config?.scriptUrl || '').trim();
    const spreadsheetId = extractSpreadsheetId(config?.spreadsheetId || config?.rawSheetUrl);
    if (scriptUrl && !specificCohort && spreadsheetId) {
      try {
        const sig = createFetchTimeoutSignal(12000);
        const resp = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'readAllSheets',
            spreadsheetId
          }),
          signal: sig
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok && Array.isArray(data.sheets) && data.sheets.length) {
            const allRows = [];
            const cohortNames = [];
            for (const sh of data.sheets) {
              if (Array.isArray(sh.rows) && sh.rows.length) {
                cohortNames.push(sh.sheetName);
                const tagged = sh.rows.map(r => Array.isArray(r) ? [...r, sh.sheetName] : { ...r, cohort: sh.sheetName });
                allRows.push(...tagged);
              }
            }
            if (allRows.length) {
              return {
                success: true,
                ok: true,
                rows: allRows,
                totalRows: allRows.length,
                cohortResults: cohortNames,
                source: 'apps-script-all-sheets',
                message: `Đã đọc thành công ${allRows.length} học sinh từ ${cohortNames.length} trang tính qua Google Apps Script.`
              };
            }
          }
        }
      } catch (err) {
        console.warn('Multi-cohort Apps Script failed:', err?.message || err);
      }
    }

    const allRows = [];
    const errors = [];
    const successfulCohorts = [];

    for (const cohort of targetCohorts) {
      const subCfg = {
        ...config,
        spreadsheetId: cohort.spreadsheetId || config.spreadsheetId,
        rawSheetUrl: cohort.sheetUrl || config.rawSheetUrl,
        sheetName: cohort.sheetName || cohort.cohortName,
        gid: cohort.gid || '0'
      };
      const res = await pullStudentsFromGoogleSheets(subCfg);
      if (res.success && Array.isArray(res.rows) && res.rows.length) {
        successfulCohorts.push(cohort.cohortName);
        const rowsWithCohort = res.rows.map(r => {
          if (Array.isArray(r)) {
            return [...r, cohort.cohortName];
          }
          return { ...r, cohort: cohort.cohortName };
        });
        allRows.push(...rowsWithCohort);
      } else {
        errors.push(`${cohort.cohortName}: ${res.message || 'Không có dữ liệu'}`);
      }
    }

    if (allRows.length) {
      return {
        success: true,
        ok: true,
        rows: allRows,
        totalRows: allRows.length,
        cohortResults: successfulCohorts,
        source: 'multi-cohort',
        message: `Đã đọc thành công ${allRows.length} học sinh từ ${successfulCohorts.length}/${targetCohorts.length} trang tính Google Sheets.`
      };
    }

    return {
      success: false,
      ok: false,
      rows: [],
      totalRows: 0,
      cohortResults: [],
      message: errors.length ? errors.join('; ') : 'Không tìm thấy dữ liệu từ các trang tính Google Sheets.'
    };
  } catch (err) {
    return {
      success: false,
      ok: false,
      rows: [],
      totalRows: 0,
      cohortResults: [],
      message: `Lỗi quét đa khóa Google Sheets: ${err?.message || err}`
    };
  }
}

export function exportSessionReportToGoogleDocs(reportData = {}, fileName = 'BaoCaoBuoiHoc.doc') {
  const {
    currentClass = {},
    date = '',
    lessonTitle = '',
    homeworkAssignment = '',
    homeworkLink = '',
    notebookLink = '',
    sessionNote = '',
    stats = {},
    missingHW = [],
    lateList = [],
    lowScores = [],
    sessionMakeups = [],
    absentList = [],
    roster = [],
    thresholdStr = '6'
  } = reportData;

  const escapeXml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const docHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${escapeXml(currentClass.name || 'Lớp')} - Báo cáo ca học ${escapeXml(date)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 841.9pt 595.3pt; /* A4 Landscape */
      mso-page-orientation: landscape;
      margin: 1.0in 0.8in 1.0in 0.8in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Times New Roman', 'Segoe UI', Tahoma, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #111827;
    }
    h1 {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a29;
      margin: 0 0 4pt;
      text-transform: uppercase;
    }
    .center-sub {
      text-align: center;
      font-size: 11pt;
      color: #4b5563;
      margin-bottom: 12pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
    }
    th, td {
      border: 1pt solid #9ca3af;
      padding: 5pt 7pt;
      font-size: 10pt;
      vertical-align: middle;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      color: #1f2937;
      text-align: left;
    }
    .th-center, .td-center {
      text-align: center;
    }
    .info-table td {
      border: none;
      padding: 3pt 4pt;
      font-size: 10.5pt;
    }
    .kpi-table th {
      background-color: #e5e7eb;
      text-align: center;
      font-size: 10.5pt;
    }
    .kpi-table td {
      text-align: center;
      font-size: 12pt;
      font-weight: bold;
      padding: 6pt;
    }
    .sec-title {
      font-size: 11.5pt;
      font-weight: bold;
      margin: 12pt 0 4pt;
      color: #111827;
    }
    .tag-danger { color: #b91c1c; font-weight: bold; }
    .tag-warning { color: #c2410c; font-weight: bold; }
    .tag-purple { color: #6b21a8; font-weight: bold; }
    .sig-table {
      margin-top: 24pt;
      border: none;
    }
    .sig-table td {
      border: none;
      text-align: center;
      width: 50%;
      padding-top: 10pt;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <h1>BÁO CÁO TỔNG HỢP CA HỌC</h1>
    <div class="center-sub">HỆ THỐNG QUẢN LÝ TRUNG TÂM HỌC TẬP</div>

    <table class="info-table" style="margin-bottom:8pt;">
      <tr>
        <td style="width:55%;">Lớp học: <strong>${escapeXml(currentClass.name || '—')} (${escapeXml(currentClass.code || currentClass.id || '—')})</strong></td>
        <td style="width:45%;">Ngày học: <strong>${escapeXml(date)}</strong> (${escapeXml(currentClass.startTime || '')} - ${escapeXml(currentClass.endTime || '')})</td>
      </tr>
      <tr>
        <td>Phòng học: <strong>${escapeXml(currentClass.room || '—')}</strong> · Môn học: <strong>${escapeXml(currentClass.subject || '—')}</strong></td>
        <td>Giáo viên: <strong>${escapeXml(currentClass.teacherName || '—')}</strong> · Trợ giảng: <strong>${escapeXml(currentClass.assistantName || '—')}</strong></td>
      </tr>
      <tr>
        <td colspan="2">Bài dạy hôm nay: <strong>${escapeXml(lessonTitle || 'Chưa ghi tên bài')}</strong></td>
      </tr>
      ${homeworkAssignment ? `<tr><td colspan="2">BTVN giao về nhà: <strong>${escapeXml(homeworkAssignment)}</strong></td></tr>` : ''}
      ${homeworkLink ? `<tr><td colspan="2">Link phiếu BTVN: <a href="${escapeXml(homeworkLink)}">${escapeXml(homeworkLink)}</a></td></tr>` : ''}
      ${notebookLink ? `<tr><td colspan="2">Link vở ghi / Bài giảng: <a href="${escapeXml(notebookLink)}">${escapeXml(notebookLink)}</a></td></tr>` : ''}
      ${sessionNote ? `<tr><td colspan="2">Ghi chú chung của ca học: <em>${escapeXml(sessionNote)}</em></td></tr>` : ''}
    </table>

    <table class="kpi-table">
      <thead>
        <tr>
          <th>Sĩ số lớp</th>
          <th>Có mặt đúng giờ</th>
          <th>Đi muộn</th>
          <th>Vắng mặt</th>
          <th>Đã nộp BTVN</th>
          <th>Chưa nộp BTVN</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${stats.total || (roster.length)}</td>
          <td style="color:#15803d;">${stats.present ?? (stats.onTime ?? 0)}</td>
          <td style="color:#b45309;">${stats.late || lateList.length}</td>
          <td style="color:#b91c1c;">${stats.absent || absentList.length}</td>
          <td style="color:#15803d;">${stats.homeworkDone || 0}</td>
          <td style="color:#b91c1c;">${missingHW.length}</td>
        </tr>
      </tbody>
    </table>

    <!-- 1. CHƯA NỘP BTVN -->
    <div class="sec-title" style="color:#991b1b;">1. Học sinh CHƯA NỘP BTVN (${missingHW.length} học sinh)</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;" class="th-center">STT</th>
          <th style="width:130px;">Họ và tên</th>
          <th style="width:140px;">Trường / Phân loại</th>
          <th style="width:110px;">Lý do chưa nộp</th>
          <th>Ghi chú trong ca</th>
        </tr>
      </thead>
      <tbody>
        ${missingHW.length ? missingHW.map((s, idx) => `
          <tr>
            <td class="td-center">${idx + 1}</td>
            <td><strong>${escapeXml(s.name)}</strong></td>
            <td>${escapeXml(s.school || '—')}</td>
            <td class="tag-danger">${escapeXml(s.reason || 'Chưa làm')}</td>
            <td>${escapeXml(s.note || '—')}</td>
          </tr>
        `).join('') : '<tr><td colspan="5" class="td-center" style="color:#15803d; font-style:italic;">100% học sinh có mặt đã nộp bài tập về nhà đầy đủ.</td></tr>'}
      </tbody>
    </table>

    <!-- 2. ĐI MUỘN -->
    <div class="sec-title" style="color:#9a3412;">2. Học sinh ĐI MUỘN (${lateList.length} học sinh)</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;" class="th-center">STT</th>
          <th style="width:130px;">Họ và tên</th>
          <th style="width:140px;">Trường / Phân loại</th>
          <th style="width:90px;" class="th-center">Giờ đến</th>
          <th style="width:90px;" class="th-center">Phút muộn</th>
          <th>Ghi chú trong ca</th>
        </tr>
      </thead>
      <tbody>
        ${lateList.length ? lateList.map((s, idx) => `
          <tr>
            <td class="td-center">${idx + 1}</td>
            <td><strong>${escapeXml(s.name)}</strong></td>
            <td>${escapeXml(s.school || '—')}</td>
            <td class="td-center">${escapeXml(s.arrivalTime || '—')}</td>
            <td class="td-center tag-warning">muộn ${s.lateMinutes || 0}p</td>
            <td>${escapeXml(s.note || '—')}</td>
          </tr>
        `).join('') : '<tr><td colspan="6" class="td-center" style="color:#15803d; font-style:italic;">Không có học sinh nào đi muộn trong ca hôm nay.</td></tr>'}
      </tbody>
    </table>

    <!-- 3. ĐIỂM THẤP DƯỚI MỐC -->
    <div class="sec-title" style="color:#854d0e;">3. Học sinh CÓ ĐIỂM THẤP DƯỚI ${escapeXml(thresholdStr)} ĐIỂM (${lowScores.length} học sinh)</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;" class="th-center">STT</th>
          <th style="width:130px;">Họ và tên</th>
          <th style="width:140px;">Trường / Phân loại</th>
          <th style="width:80px;" class="th-center">Điểm BTVN</th>
          <th style="width:80px;" class="th-center">Điểm Test</th>
          <th>Ghi chú trong ca</th>
        </tr>
      </thead>
      <tbody>
        ${lowScores.length ? lowScores.map((s, idx) => `
          <tr>
            <td class="td-center">${idx + 1}</td>
            <td><strong>${escapeXml(s.name)}</strong></td>
            <td>${escapeXml(s.school || '—')}</td>
            <td class="td-center" style="font-weight:bold; color:#b45309;">${escapeXml(s.hwScore || '—')}</td>
            <td class="td-center" style="font-weight:bold; color:#b45309;">${escapeXml(s.testScore || '—')}</td>
            <td>${escapeXml(s.note || '—')}</td>
          </tr>
        `).join('') : `<tr><td colspan="6" class="td-center" style="color:#15803d; font-style:italic;">Không có học sinh nào điểm dưới ${escapeXml(thresholdStr)}.</td></tr>`}
      </tbody>
    </table>

    <!-- 4. HỌC BÙ & HỌC SINH MỚI -->
    <div class="sec-title" style="color:#6b21a8;">4. Học sinh HỌC BÙ & HỌC SINH MỚI (${sessionMakeups.length} học sinh)</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;" class="th-center">STT</th>
          <th style="width:130px;">Họ và tên</th>
          <th style="width:140px;">Phân loại / Lớp gốc</th>
          <th style="width:110px;">Trạng thái</th>
          <th style="width:110px;" class="th-center">Điểm BTVN / Test</th>
          <th>Ghi chú trong ca</th>
        </tr>
      </thead>
      <tbody>
        ${sessionMakeups.length ? sessionMakeups.map((s, idx) => `
          <tr>
            <td class="td-center">${idx + 1}</td>
            <td><strong class="tag-purple">${escapeXml(s.name)}</strong></td>
            <td>${escapeXml(s.sourceClass || s.school || 'Học bù')}</td>
            <td>${escapeXml(s.attendanceStatus || 'Có mặt')}</td>
            <td class="td-center">${escapeXml(s.scores || '—')}</td>
            <td>${escapeXml(s.note || '—')}</td>
          </tr>
        `).join('') : '<tr><td colspan="6" class="td-center" style="font-style:italic; color:#6b21a8;">Không có học sinh học bù trong buổi này.</td></tr>'}
      </tbody>
    </table>

    <!-- 5. VẮNG MẶT -->
    <div class="sec-title" style="color:#374151;">5. Học sinh VẮNG MẶT (${absentList.length} học sinh)</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;" class="th-center">STT</th>
          <th style="width:130px;">Họ và tên</th>
          <th style="width:140px;">Trường</th>
          <th style="width:110px;">Trạng thái</th>
          <th style="width:130px;">Lý do</th>
          <th>Ghi chú trong ca</th>
        </tr>
      </thead>
      <tbody>
        ${absentList.length ? absentList.map((s, idx) => `
          <tr>
            <td class="td-center">${idx + 1}</td>
            <td><strong>${escapeXml(s.name)}</strong></td>
            <td>${escapeXml(s.school || '—')}</td>
            <td>${escapeXml(s.excused ? 'Có phép' : 'Chưa phép')}</td>
            <td>${escapeXml(s.reason || 'Chưa rõ lý do')}</td>
            <td>${escapeXml(s.note || '—')}</td>
          </tr>
        `).join('') : '<tr><td colspan="6" class="td-center" style="color:#15803d; font-style:italic;">100% học sinh đều có mặt.</td></tr>'}
      </tbody>
    </table>

    <!-- 6. TOÀN BỘ DANH SÁCH LỚP -->
    ${roster.length ? `
      <div class="sec-title" style="page-break-before:always;">6. BẢNG ĐIỂM DANH &amp; THEO DÕI TOÀN BỘ HỌC SINH TRONG CA</div>
      <table>
        <thead>
          <tr>
            <th style="width:28px;" class="th-center">STT</th>
            <th style="width:120px;">Họ và tên</th>
            <th style="width:80px;" class="th-center">Mã HS</th>
            <th style="width:130px;">Trường</th>
            <th style="width:90px;" class="th-center">Điểm danh</th>
            <th style="width:90px;">BTVN</th>
            <th style="width:65px;" class="th-center">Điểm BT</th>
            <th style="width:65px;" class="th-center">Điểm Test</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${roster.map((s, idx) => `
            <tr>
              <td class="td-center">${idx + 1}</td>
              <td><strong>${escapeXml(s.name)}</strong></td>
              <td class="td-center">${escapeXml(s.studentCode || '—')}</td>
              <td>${escapeXml(s.school || '—')}</td>
              <td class="td-center">${escapeXml(s.attendance || '—')}</td>
              <td>${escapeXml(s.homework || '—')}</td>
              <td class="td-center" style="font-weight:bold;">${escapeXml(s.hwScore || '—')}</td>
              <td class="td-center" style="font-weight:bold;">${escapeXml(s.testScore || '—')}</td>
              <td>${escapeXml(s.note || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <table class="sig-table">
      <tr>
        <td>
          <strong>Chữ ký Trợ giảng</strong><br><br><br><br>
          <span>${escapeXml(currentClass.assistantName || '—')}</span>
        </td>
        <td>
          <strong>Chữ ký Giáo viên phụ trách</strong><br><br><br><br>
          <span>${escapeXml(currentClass.teacherName || '—')}</span>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const blob = new Blob(['\ufeff' + docHtml], { type: 'application/msword;charset=utf-8' });
  downloadFile(blob, fileName, 'application/msword;charset=utf-8');
  return fileName;
}
