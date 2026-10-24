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

export function loadGoogleSheetsConfig(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(GOOGLE_SHEETS_CONFIG_KEY) || 'null') || {
      spreadsheetId: '',
      sheetName: 'DiemDanh',
      scriptUrl: '',
      apiKey: '',
      autoSync: false,
      lastSyncedAt: null,
      syncStatus: 'idle'
    };
  } catch {
    return { spreadsheetId: '', sheetName: 'DiemDanh', scriptUrl: '', autoSync: false, lastSyncedAt: null };
  }
}

export function saveGoogleSheetsConfig(config, storage = localStorage) {
  storage.setItem(GOOGLE_SHEETS_CONFIG_KEY, JSON.stringify(config));
}

export async function syncSessionToGoogleSheets(sessionData, config) {
  const spreadsheetId = extractSpreadsheetId(config?.spreadsheetId);
  if (!spreadsheetId) {
    throw new Error('Vui lòng nhập Google Spreadsheet ID hoặc dán đường link Google Sheets');
  }
  let scriptUrl = String(config?.scriptUrl || '').trim();
  if (!scriptUrl) {
    try {
      const driveCfg = JSON.parse(localStorage.getItem('lopvui.google-drive-photo-config.v1') || '{}') || {};
      scriptUrl = String(driveCfg.scriptUrl || '').trim();
    } catch {}
  }

  const timestamp = Date.now();
  let remoteResult = null;

  if (scriptUrl) {
    const payload = {
      action: 'syncStudentsByCode',
      spreadsheetId,
      sheetName: config?.sheetName || 'DiemDanh',
      date: sessionData.date || '',
      classId: sessionData.classId || '',
      classCode: sessionData.classCode || '',
      className: sessionData.className || '',
      headers: sessionData.headers || [],
      rows: sessionData.rows || [],
      students: sessionData.students || []
    };
    const resp = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      throw new Error(`Google Apps Script trả về HTTP ${resp.status}`);
    }
    remoteResult = await resp.json().catch(() => ({ ok: true }));
    if (remoteResult && remoteResult.ok === false) {
      throw new Error(remoteResult.error || 'Apps Script báo lỗi khi ghi vào Google Sheets');
    }
  } else {
    throw new Error('Chưa nhập Google Apps Script Web App URL để ghi trực tiếp lên Google Sheets (hoặc dùng nút Copy / Xuất file bên dưới).');
  }

  const updatedConfig = {
    ...config,
    spreadsheetId,
    scriptUrl,
    lastSyncedAt: timestamp,
    syncStatus: 'success',
    lastSyncDetails: {
      date: sessionData.date,
      className: sessionData.className,
      totalStudents: sessionData.rows?.length || sessionData.students?.length || 0,
      updatedCount: remoteResult?.updatedCount ?? null,
      insertedCount: remoteResult?.insertedCount ?? null,
      timestamp
    }
  };
  saveGoogleSheetsConfig(updatedConfig);
  return updatedConfig;
}

export async function pullStudentsFromGoogleSheets(config) {
  const spreadsheetId = extractSpreadsheetId(config?.spreadsheetId);
  if (!spreadsheetId) {
    throw new Error('Vui lòng nhập Google Spreadsheet ID hoặc đường link Google Sheets');
  }
  const sheetName = String(config?.sheetName || 'DiemDanh').trim() || 'DiemDanh';
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
      const resp = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'readSheetByCode',
          spreadsheetId,
          sheetName
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.ok && Array.isArray(data.rows)) {
          return { rows: data.rows, source: 'apps-script' };
        }
      }
    } catch {}
  }

  // 2. Fallback: Đọc trực tiếp từ link Google Sheets (nếu file được mở quyền Xem cho bất kỳ ai có link)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const csvResp = await fetch(csvUrl, { cache: 'no-store' });
  if (!csvResp.ok) {
    throw new Error('Không thể đọc Google Sheet. Hãy đảm bảo Sheet được mở quyền "Bất kỳ ai có đường liên kết đều có thể xem" hoặc đã cấu hình Google Apps Script URL.');
  }
  const csvText = await csvResp.text();
  if (!csvText || csvText.trim().startsWith('<!DOCTYPE html')) {
    throw new Error('Google Sheet đang ở chế độ Riêng tư. Vui lòng cấp quyền "Anyone with the link can view" hoặc cấu hình Google Apps Script Web App URL.');
  }
  const rows = parseRawTable(csvText);
  return { rows, source: 'gviz-csv' };
}
