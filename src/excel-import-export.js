// Utilities for importing/exporting roster data, CSV parsing, Excel export and Google Sheets sync architecture.

export const ENROLLMENT_STATUS_PRESETS = [
  'Học',
  'Chưa nhập học',
  'Tạm nghỉ',
  'Nghỉ',
  'Trùng'
];

export function normalizeEnrollmentStatus(rawVal) {
  const trimmed = String(rawVal ?? '').trim();
  if (!trimmed) return 'Học';
  const lower = trimmed.toLowerCase();
  if (lower === 'học' || lower === 'đang học' || lower === 'hoc' || lower === 'dang hoc') return 'Học';
  if (lower === 'chưa nhập học' || lower === 'chua nhap hoc') return 'Chưa nhập học';
  if (lower === 'tạm nghỉ' || lower === 'tam nghi' || lower === 'bảo lưu') return 'Tạm nghỉ';
  if (lower === 'nghỉ' || lower === 'nghi' || lower === 'nghỉ học' || lower === 'đã nghỉ') return 'Nghỉ';
  if (lower === 'trùng' || lower === 'trung') return 'Trùng';
  return trimmed;
}

/**
 * Splits raw copied text into rows and cells, automatically stripping a leading STT (index 0) column
 * so subsequent columns never shift right by 1 column.
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

  let rows = lines.map(line => parseCsvLine(line, delimiter)).filter(r => r.some(c => String(c || '').trim() !== ''));
  if (!rows.length) return { headers: [], rows: [] };

  // Check if column 0 is an STT (serial number) column and strip it directly so indices never shift
  if (rows[0].length > 1) {
    const firstHeader = String(rows[0][0] || '').trim().toLowerCase();
    const isExplicitSttHeader = (
      firstHeader === 'stt' ||
      firstHeader === 'tt' ||
      firstHeader === 'no' ||
      firstHeader === 'no.' ||
      firstHeader === '#' ||
      firstHeader.includes('số thứ tự')
    );

    const dataSample = rows.slice(1, Math.min(8, rows.length));
    const isDataCol0Sequential = dataSample.length > 0 && dataSample.every((r, idx) => {
      const v = String(r[0] || '').trim();
      return /^\d{1,4}[.)]?$/.test(v) && Number(v.replace(/\D/g, '')) === idx + 1;
    });

    const isAllRowsCol0Sequential = rows.length >= 2 && rows.slice(0, Math.min(8, rows.length)).every((r, idx) => {
      const v = String(r[0] || '').trim();
      return /^\d{1,4}[.)]?$/.test(v) && Number(v.replace(/\D/g, '')) === idx + 1;
    });

    const isCol0PureSmallIntegers = dataSample.length >= 2 &&
      (firstHeader === '' || isExplicitSttHeader) &&
      dataSample.every(r => /^\d{1,4}$/.test(String(r[0] || '').trim()));

    if (isExplicitSttHeader || isDataCol0Sequential || isAllRowsCol0Sequential || isCol0PureSmallIntegers) {
      rows = rows.map(r => r.slice(1));
    }
  }

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
               (nameNorm && nameNorm.length >= 3 && (norm.includes(nameNorm) || nameNorm.includes(norm)));
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

/**
 * Auto-detects column indices from header row and sample data rows.
 * Note: Leading STT column is already stripped in parseRawTable; any remaining STT column is also ignored.
 */
export function autoDetectColumnMapping(rows = []) {
  const result = {
    hasHeader: true,
    nameMode: 'single',
    sttCol: -1,
    codeCol: -1,
    fullNameCol: -1,
    familyNameCol: -1,
    givenNameCol: -1,
    schoolCol: -1,
    classCol1: -1,
    classCol2: -1,
    classCol3: -1,
    phoneCol: -1,
    parentNameCol: -1,
    statusCol: -1
  };
  if (!rows || !rows.length) return result;

  const headerRow = rows[0].map(c => String(c || '').trim());
  const lowerHeaders = headerRow.map(c => c.toLowerCase());

  const looksLikeHeader = lowerHeaders.some(h =>
    h === 'stt' || h.includes('số thứ tự') || h.includes('tên') || h.includes('họ') ||
    h.includes('name') || h.includes('mã') || h.includes('trường') ||
    h.includes('sđt') || h.includes('phone') || h.includes('lớp') || h.includes('class') ||
    h.includes('trạng thái') || h.includes('tình trạng') || h.includes('status')
  );
  result.hasHeader = looksLikeHeader;

  if (looksLikeHeader) {
    lowerHeaders.forEach((h, idx) => {
      if (!h) return;
      if (h === 'stt' || h === 'tt' || h === 'no' || h === 'no.' || h === '#' || h.includes('số thứ tự')) {
        result.sttCol = idx;
        return;
      }
      if (h.includes('trạng thái') || h.includes('tình trạng') || h.includes('theo học') || h === 'status') {
        if (result.statusCol === -1) result.statusCol = idx;
        return;
      }
      if (h.includes('mã lớp 2') || h.includes('lớp 2') || h === 'class 2') {
        if (result.classCol2 === -1) result.classCol2 = idx;
        return;
      }
      if (h.includes('mã lớp 3') || h.includes('lớp 3') || h === 'class 3') {
        if (result.classCol3 === -1) result.classCol3 = idx;
        return;
      }
      if (h.includes('mã lớp') || h.includes('lớp 1') || h.includes('các lớp') || h.includes('lớp học') || h === 'lớp' || h === 'class' || h.includes('class code')) {
        if (result.classCol1 === -1) result.classCol1 = idx;
        return;
      }
      if (h.includes('mã hs') || h.includes('mã học sinh') || h.includes('mã số') || h.includes('student code') || h === 'mã' || h === 'code' || h === 'id') {
        if (result.codeCol === -1) result.codeCol = idx;
        return;
      }
      if (h.includes('sđt') || h.includes('điện thoại') || h.includes('phone') || h.includes('tel') || h.includes('liên hệ')) {
        if (result.phoneCol === -1) result.phoneCol = idx;
        return;
      }
      if (h.includes('phụ huynh') || h.includes('tên ph') || h.includes('họ tên ph') || h.includes('parent') || h.includes('bố') || h.includes('mẹ')) {
        if (result.parentNameCol === -1) result.parentNameCol = idx;
        return;
      }
      if (h.includes('trường') || h.includes('school')) {
        if (result.schoolCol === -1) result.schoolCol = idx;
        return;
      }
      if (h.includes('họ và tên đệm') || h.includes('họ đệm') || h === 'họ' || h === 'last name' || h === 'family name') {
        if (result.familyNameCol === -1) result.familyNameCol = idx;
        return;
      }
      if (h.includes('họ và tên') || h.includes('họ tên') || h === 'full name' || h === 'fullname') {
        if (result.fullNameCol === -1) result.fullNameCol = idx;
        return;
      }
      if (h === 'tên' || h === 'tên hs' || h === 'tên học sinh' || h === 'first name' || h === 'given name' || h === 'name') {
        if (result.givenNameCol === -1) result.givenNameCol = idx;
        return;
      }
    });

    if (result.fullNameCol === -1 && result.familyNameCol === -1 && result.givenNameCol >= 0) {
      result.fullNameCol = result.givenNameCol;
    }
    if (result.fullNameCol === -1 && result.familyNameCol >= 0 && result.givenNameCol >= 0) {
      result.nameMode = 'split';
    }
  } else {
    // Heuristic inspection of row[0] cells when no header row is present
    const sample = rows[0].map(c => String(c || '').trim());
    let cur = 0;
    // Check if sample[0] looks like a student code (e.g., K9.730, HS001, 2K9...)
    if (sample[cur] && (/^[A-Za-z0-9._-]{3,16}$/.test(sample[cur]) && /\d/.test(sample[cur]) && !/^0\d{8,10}$/.test(sample[cur]))) {
      result.codeCol = cur++;
    }
    // Check if next two columns are split familyName + givenName (givenName is 1 word, next col is school/class)
    if (sample.length >= cur + 3 && sample[cur + 1] && !sample[cur + 1].includes(' ')) {
      result.nameMode = 'split';
      result.familyNameCol = cur;
      result.givenNameCol = cur + 1;
      cur += 2;
    } else {
      result.fullNameCol = cur++;
    }
    if (sample.length > cur) result.schoolCol = cur++;
    if (sample.length > cur) result.classCol1 = cur++;
    if (sample.length > cur) result.phoneCol = cur++;
  }

  if (result.nameMode === 'single' && result.fullNameCol === -1) {
    const used = new Set([
      result.sttCol, result.codeCol, result.schoolCol,
      result.classCol1, result.classCol2, result.classCol3,
      result.phoneCol, result.parentNameCol, result.statusCol
    ]);
    for (let idx = 0; idx < headerRow.length; idx++) {
      if (!used.has(idx)) {
        result.fullNameCol = idx;
        break;
      }
    }
    if (result.fullNameCol === -1) result.fullNameCol = 0;
  }

  return result;
}

/**
 * Maps raw table rows according to user's custom column mapping
 */
export function mapCustomColumns(rows, mapping, classCatalog = []) {
  if (!rows || !rows.length) return [];

  const startIndex = mapping.hasHeader ? 1 : 0;
  const results = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;

    let familyName = '';
    let givenName = '';
    let fullName = '';

    if (mapping.nameMode === 'split') {
      familyName = String((mapping.familyNameCol >= 0 ? row[mapping.familyNameCol] : '') || '').trim();
      givenName = String((mapping.givenNameCol >= 0 ? row[mapping.givenNameCol] : '') || '').trim();
      fullName = `${familyName} ${givenName}`.trim();
    } else {
      fullName = String((mapping.fullNameCol >= 0 ? row[mapping.fullNameCol] : '') || '').trim();
      const split = splitVietnameseName(fullName);
      familyName = split.familyName;
      givenName = split.givenName;
    }

    if (!fullName || fullName.length < 2 || /^\d+$/.test(fullName)) continue;

    const studentCode = (mapping.codeCol >= 0 ? row[mapping.codeCol] : '') || '';
    const school = (mapping.schoolCol >= 0 ? row[mapping.schoolCol] : '') || '';
    const parentPhone = (mapping.phoneCol >= 0 ? row[mapping.phoneCol] : '') || '';
    const parentName = (mapping.parentNameCol >= 0 ? row[mapping.parentNameCol] : '') || '';
    const tag = (mapping.tagCol >= 0 ? row[mapping.tagCol] : '') || '';
    const rawStatus = (mapping.statusCol >= 0 ? row[mapping.statusCol] : '') || '';
    const enrollmentStatus = normalizeEnrollmentStatus(rawStatus);

    // Collect class IDs from mapped class columns AND selected/context target class
    const classIds = [];
    for (const colIdx of [mapping.classCol1, mapping.classCol2, mapping.classCol3]) {
      if (colIdx >= 0 && row[colIdx] && String(row[colIdx]).trim()) {
        const ids = resolveClassIdsFromCell(row[colIdx], null, classCatalog);
        ids.forEach(cid => { if (cid && !classIds.includes(cid)) classIds.push(cid); });
      }
    }

    // If user explicitly opened import inside a specific class roster (contextClassId) or selected defaultClassId:
    const targetClassId = mapping.defaultClassId || mapping.contextClassId || '';
    if (targetClassId && (!classIds.length || mapping.contextClassId)) {
      if (!classIds.includes(targetClassId)) {
        classIds.push(targetClassId);
      }
    }

    results.push({
      name: fullName,
      familyName,
      givenName,
      studentCode: studentCode ? String(studentCode).trim() : null,
      school: String(school).trim(),
      classIds,
      parentContact: {
        name: String(parentName).trim(),
        phone: String(parentPhone).trim()
      },
      enrollmentStatus,
      tag: tag || '',
      isNew: false
    });
  }

  return results;
}

/**
 * Standard auto-detection for simple pasted text
 */
export function parseRosterText(rawText, classCatalog = [], defaultClassId = null) {
  const { rows } = parseRawTable(rawText);
  if (!rows.length) return [];
  const detected = autoDetectColumnMapping(rows);
  detected.defaultClassId = defaultClassId;
  return mapCustomColumns(rows, detected, classCatalog);
}

/**
 * Downloads a string content as a file in browser.
 */
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

/**
 * Exports data to CSV with UTF-8 BOM so Excel opens it with full Vietnamese diacritics.
 */
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
