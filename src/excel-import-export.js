// Utilities for importing/exporting roster data, CSV parsing, Excel export and Google Sheets sync architecture.

/**
 * Splits raw copied text into rows and cells without shifting or dropping columns.
 */
export function parseRawTable(rawText) {
  if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
  const cleanText = String(rawText).replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return { headers: [], rows: [] };

  // Detect delimiter based on first line
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

  const rows = lines.map(line => parseCsvLine(line, delimiter));
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
 * Supports single code ("TOAN12A"), bracketed ("[TOAN8A] Toán 8A"), or multiple codes separated by commas/semicolons ("TOAN12A, LY11B").
 */
export function resolveClassIdsFromCell(val, defaultId, classCatalog = []) {
  if (!val || !String(val).trim()) return defaultId ? [defaultId] : [];

  const tokens = String(val).split(/[,;\/\n\r]+/).map(t => t.trim()).filter(Boolean);
  const resolved = [];

  for (const rawToken of tokens) {
    // Extract bracketed code if present e.g. "[TOAN8A] Toán 8A" -> "toan8a"
    const bracketMatch = rawToken.match(/\[([^\]]+)\]/);
    const token = (bracketMatch ? bracketMatch[1] : rawToken).trim();
    const clean = token.toLowerCase();
    const norm = clean.replace(/[\s\-_]+/g, '');
    if (!norm) continue;

    // 1. Exact match on class code (highest priority)
    let found = classCatalog.find(c => {
      const code = (c.code || '').toLowerCase();
      return code && (code === clean || code.replace(/[\s\-_]+/g, '') === norm);
    });

    // 2. Exact match on ID or Name
    if (!found) {
      found = classCatalog.find(c => {
        const id = (c.id || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        return id === clean || id.replace(/[\s\-_]+/g, '') === norm ||
               name === clean || name.replace(/[\s\-_]+/g, '') === norm;
      });
    }

    // 3. Substring match on code or name
    if (!found) {
      found = classCatalog.find(c => {
        const code = (c.code || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        return (code && code.length >= 3 && (clean.includes(code) || code.includes(clean))) ||
               (name && name.length >= 3 && (clean.includes(name) || name.includes(clean)));
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
 * Auto-detects column indices from header row (and sample data row),
 * carefully ignoring STT (Số thứ tự) columns and distinguishing "Mã lớp" from "Mã HS".
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
    parentNameCol: -1
  };
  if (!rows || !rows.length) return result;

  const headerRow = rows[0].map(c => String(c || '').trim());
  const lowerHeaders = headerRow.map(c => c.toLowerCase());

  const looksLikeHeader = lowerHeaders.some(h =>
    h === 'stt' || h.includes('số thứ tự') || h.includes('tên') || h.includes('họ') ||
    h.includes('name') || h.includes('mã') || h.includes('trường') ||
    h.includes('sđt') || h.includes('phone') || h.includes('lớp') || h.includes('class')
  );
  result.hasHeader = looksLikeHeader;

  if (looksLikeHeader) {
    lowerHeaders.forEach((h, idx) => {
      if (!h) return;
      // 1. Check STT column first so it is NEVER mapped to student code or name
      if (h === 'stt' || h === 'tt' || h === 'no' || h === 'no.' || h === '#' || h.includes('số thứ tự')) {
        result.sttCol = idx;
        return;
      }
      // 2. Check Class columns BEFORE generic "mã" so "Mã lớp" maps to classCol, NOT codeCol!
      if (h.includes('mã lớp 2') || h.includes('lớp 2') || h === 'class 2') {
        if (result.classCol2 === -1) result.classCol2 = idx;
        return;
      }
      if (h.includes('mã lớp 3') || h.includes('lớp 3') || h === 'class 3') {
        if (result.classCol3 === -1) result.classCol3 = idx;
        return;
      }
      if (h.includes('mã lớp') || h.includes('lớp 1') || h.includes('các lớp') || h.includes('lớp theo học') || h === 'lớp' || h === 'class' || h.includes('class code')) {
        if (result.classCol1 === -1) result.classCol1 = idx;
        return;
      }
      // 3. Check Student Code
      if (h.includes('mã hs') || h.includes('mã học sinh') || h.includes('student code') || h === 'mã' || h === 'code') {
        if (result.codeCol === -1) result.codeCol = idx;
        return;
      }
      // 4. Check Parent & Phone BEFORE generic "tên"
      if (h.includes('sđt') || h.includes('điện thoại') || h.includes('phone') || h.includes('tel')) {
        if (result.phoneCol === -1) result.phoneCol = idx;
        return;
      }
      if (h.includes('phụ huynh') || h.includes('tên ph') || h.includes('họ tên ph') || h.includes('parent') || h.includes('bố') || h.includes('mẹ')) {
        if (result.parentNameCol === -1) result.parentNameCol = idx;
        return;
      }
      // 5. Check School BEFORE generic "tên" ("Tên trường")
      if (h.includes('trường') || h.includes('school')) {
        if (result.schoolCol === -1) result.schoolCol = idx;
        return;
      }
      // 6. Check Name columns (Full name vs Family name + Given name)
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

    // If only "Tên" was found and no "Họ đệm" and no "Họ và tên", treat "Tên" as fullNameCol
    if (result.fullNameCol === -1 && result.familyNameCol === -1 && result.givenNameCol >= 0) {
      result.fullNameCol = result.givenNameCol;
    }
    // If "Họ đệm" and "Tên" are present without "Họ và tên", switch to split mode
    if (result.fullNameCol === -1 && result.familyNameCol >= 0 && result.givenNameCol >= 0) {
      result.nameMode = 'split';
    }
  } else {
    // No header row: check if column 0 is sequential numbers (STT: 1, 2, 3...)
    const firstColNumeric = rows.slice(0, Math.min(5, rows.length)).every(r => /^\d+$/.test(String(r[0] || '').trim()));
    const offset = firstColNumeric && rows[0].length > 1 ? 1 : 0;
    if (firstColNumeric) result.sttCol = 0;
    result.fullNameCol = offset;
    if (rows[0].length > offset + 1) result.schoolCol = offset + 1;
    if (rows[0].length > offset + 2) result.phoneCol = offset + 2;
  }

  // Fallback for fullNameCol: pick first non-STT, non-mapped column
  if (result.fullNameCol === -1) {
    const used = new Set([result.sttCol, result.codeCol, result.schoolCol, result.classCol1, result.phoneCol, result.parentNameCol]);
    for (let idx = 0; idx < headerRow.length; idx++) {
      if (!used.has(idx)) {
        result.fullNameCol = idx;
        break;
      }
    }
    if (result.fullNameCol === -1) result.fullNameCol = result.sttCol === 0 && headerRow.length > 1 ? 1 : 0;
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
      familyName = (mapping.familyNameCol >= 0 ? row[mapping.familyNameCol] : '') || '';
      givenName = (mapping.givenNameCol >= 0 ? row[mapping.givenNameCol] : '') || '';
      fullName = `${familyName} ${givenName}`.trim();
    } else {
      fullName = (mapping.fullNameCol >= 0 ? row[mapping.fullNameCol] : '') || '';
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

    // Collect class IDs: prioritize explicit class columns in Excel, fallback to selected defaultClassId
    const classIds = [];
    for (const colIdx of [mapping.classCol1, mapping.classCol2, mapping.classCol3]) {
      if (colIdx >= 0 && row[colIdx] && String(row[colIdx]).trim()) {
        const ids = resolveClassIdsFromCell(row[colIdx], null, classCatalog);
        ids.forEach(cid => { if (!classIds.includes(cid)) classIds.push(cid); });
      }
    }

    if (!classIds.length && mapping.defaultClassId) {
      classIds.push(mapping.defaultClassId);
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

  // \uFEFF is UTF-8 Byte Order Mark for Excel
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

/**
 * Simulates syncing class attendance & homework data directly to Google Sheets API cells.
 */
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
