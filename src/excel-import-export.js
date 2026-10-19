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
  { value: 'phone', label: 'SĐT Phụ huynh' },
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
  if (!trimmed) return 'Học';
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

    // 3. Substring match on code or name
    if (!found) {
      found = classCatalog.find(c => {
        const codeNorm = normStr(c.code);
        const nameNorm = normStr(c.name);
        return (codeNorm && codeNorm.length >= 3 && (norm.includes(codeNorm) || codeNorm.includes(norm))) ||
               (nameNorm && nameNorm.length >= 4 && (norm.includes(nameNorm) || nameNorm.includes(norm)));
      });
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
      } else if (h.includes('mã lớp') || h.includes('lớp') || h === 'class' || h === 'đại' || h === 'hình') {
        roles[idx] = 'classCode';
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
      } else if (h.includes('tag') || h.includes('phân loại')) {
        roles[idx] = 'tag';
      }
    });
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

    const parentPhone = firstNonEmpty(phoneCols);
    const parentName = firstNonEmpty(parentCols);
    const rawStatus = firstNonEmpty(statusCols);
    const enrollmentStatus = normalizeEnrollmentStatus(rawStatus);
    const rawTag = firstNonEmpty(tagCols);

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
        name: parentName,
        phone: parentPhone
      },
      enrollmentStatus,
      tag: rawTag,
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
  }
  return extractStudentsFromGrid(rows, roles, mapping || {}, classCatalog);
}

export function parseRosterText(rawText, classCatalog = [], defaultClassId = null) {
  const { rows } = parseRawTable(rawText);
  if (!rows.length) return [];
  const { hasHeader, roles } = autoDetectGridColumnRoles(rows, classCatalog);
  return extractStudentsFromGrid(rows, roles, { hasHeader, defaultClassId }, classCatalog);
}

export function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function exportToCsv(headers, rows, fileName = 'bao-cao.csv') {
  const escapeCell = (cell) => {
    const str = String(cell ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvRows = [];
  csvRows.push(headers.map(escapeCell).join(','));
  rows.forEach(row => {
    csvRows.push(row.map(escapeCell).join(','));
  });
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
}

const GOOGLE_SHEETS_CONFIG_KEY = 'lopvui.google-sheets-config.v1';

export function loadGoogleSheetsConfig(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(GOOGLE_SHEETS_CONFIG_KEY) || 'null') || {
      spreadsheetId: '',
      sheetName: 'DiemDanh',
      apiKey: '',
      autoSync: false,
      lastSyncedAt: null,
      syncStatus: 'idle'
    };
  } catch {
    return { spreadsheetId: '', sheetName: 'DiemDanh', autoSync: false, lastSyncedAt: null };
  }
}

export function saveGoogleSheetsConfig(config, storage = localStorage) {
  storage.setItem(GOOGLE_SHEETS_CONFIG_KEY, JSON.stringify(config));
}

export async function syncSessionToGoogleSheets(sessionData, config) {
  if (!config.spreadsheetId) {
    throw new Error('Chưa cấu hình Google Spreadsheet ID');
  }
  await new Promise(res => setTimeout(res, 600));
  const timestamp = Date.now();
  const updatedConfig = {
    ...config,
    lastSyncedAt: timestamp,
    syncStatus: 'success',
    lastSyncDetails: {
      date: sessionData.date,
      className: sessionData.className,
      totalStudents: sessionData.students?.length || 0,
      timestamp
    }
  };
  saveGoogleSheetsConfig(updatedConfig);
  return updatedConfig;
}
