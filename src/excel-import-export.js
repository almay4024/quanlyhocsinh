// Utilities for importing/exporting roster data, CSV parsing, Excel export and Google Sheets sync architecture.

/**
 * Splits raw copied text into rows and cells without assuming fixed columns.
 */
export function parseRawTable(rawText) {
  if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
  const lines = rawText.trim().split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return { headers: [], rows: [] };

  // Detect delimiter based on first line
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(',')) delimiter = ',';
  else if (firstLine.includes(';')) delimiter = ';';

  const rows = lines.map(line => {
    if (delimiter === ',') {
      const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
      const cells = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match.index === regex.lastIndex) regex.lastIndex++;
        cells.push((match[1] ?? match[2] ?? '').trim());
      }
      return cells.filter((c, i, a) => !(i === a.length - 1 && c === ''));
    }
    return line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
  });

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
 * Supports single code ("TOAN12A") or multiple codes separated by commas/semicolons ("TOAN12A, LY11B").
 */
export function resolveClassIdsFromCell(val, defaultId, classCatalog = []) {
  if (!val || !String(val).trim()) return defaultId ? [defaultId] : [];

  // Split cell contents in case user lists multiple class codes in one cell
  const tokens = String(val).split(/[,;\/\n\r]+/).map(t => t.trim()).filter(Boolean);
  const resolved = [];

  for (const token of tokens) {
    const clean = token.toLowerCase();
    const norm = clean.replace(/[\s\-_]+/g, '');

    // 1. Exact match on class code (highest priority)
    let found = classCatalog.find(c => {
      const code = (c.code || '').toLowerCase();
      return code === clean || (code && code.replace(/[\s\-_]+/g, '') === norm);
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
        return (code && (clean.includes(code) || code.includes(clean))) ||
               clean.includes(name) || name.includes(clean);
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
      fullName = (mapping.fullNameCol >= 0 ? row[mapping.fullNameCol] : '') || row[0] || '';
      const split = splitVietnameseName(fullName);
      familyName = split.familyName;
      givenName = split.givenName;
    }

    if (!fullName || fullName.length < 2) continue;

    const studentCode = (mapping.codeCol >= 0 ? row[mapping.codeCol] : '') || '';
    const school = (mapping.schoolCol >= 0 ? row[mapping.schoolCol] : '') || '';
    const parentPhone = (mapping.phoneCol >= 0 ? row[mapping.phoneCol] : '') || '';
    const parentName = (mapping.parentNameCol >= 0 ? row[mapping.parentNameCol] : '') || '';
    const tag = (mapping.tagCol >= 0 ? row[mapping.tagCol] : '') || '';

    // Collect class IDs based on Class Code, Name, or defaultClassId
    const classIds = [];
    if (mapping.classCol1 >= 0 && row[mapping.classCol1]) {
      const ids = resolveClassIdsFromCell(row[mapping.classCol1], mapping.defaultClassId, classCatalog);
      ids.forEach(cid => { if (!classIds.includes(cid)) classIds.push(cid); });
    }
    if (mapping.classCol2 >= 0 && row[mapping.classCol2]) {
      const ids = resolveClassIdsFromCell(row[mapping.classCol2], null, classCatalog);
      ids.forEach(cid => { if (!classIds.includes(cid)) classIds.push(cid); });
    }
    if (mapping.classCol3 >= 0 && row[mapping.classCol3]) {
      const ids = resolveClassIdsFromCell(row[mapping.classCol3], null, classCatalog);
      ids.forEach(cid => { if (!classIds.includes(cid)) classIds.push(cid); });
    }

    if (!classIds.length && mapping.defaultClassId) {
      classIds.push(mapping.defaultClassId);
    }

    results.push({
      name: fullName,
      familyName,
      givenName,
      studentCode: studentCode || null,
      school,
      classIds,
      parentContact: {
        name: parentName,
        phone: parentPhone
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
export function parseRosterText(rawText) {
  const { rows } = parseRawTable(rawText);
  if (!rows.length) return [];

  let startIndex = 0;
  const header = rows[0].map(c => c.toLowerCase());
  const hasHeader = header.some(h => 
    h.includes('tên') || h.includes('họ') || h.includes('name') || 
    h.includes('mã') || h.includes('trường') || h.includes('sđt') || h.includes('phone') ||
    h.includes('lớp') || h.includes('class')
  );

  let colMap = { name: 0, school: 1, phone: 2, parent: 3, code: 4, classCode: -1 };

  if (hasHeader) {
    startIndex = 1;
    header.forEach((h, index) => {
      if (h.includes('mã lớp') || h.includes('class code')) colMap.classCode = index;
      else if (h.includes('tên') || h.includes('họ') || h.includes('name')) colMap.name = index;
      else if (h.includes('trường') || h.includes('school')) colMap.school = index;
      else if (h.includes('sđt') || h.includes('phone') || h.includes('điện thoại')) colMap.phone = index;
      else if (h.includes('phụ huynh') || h.includes('parent')) colMap.parent = index;
      else if (h.includes('mã hs') || h.includes('mã học sinh') || h.includes('code')) colMap.code = index;
    });
  }

  const results = [];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const name = row[colMap.name] || row[0] || '';
    if (!name || name.length < 2) continue;

    const { familyName, givenName } = splitVietnameseName(name);

    results.push({
      name,
      familyName,
      givenName,
      school: row[colMap.school] || '',
      parentPhone: row[colMap.phone] || '',
      parentName: row[colMap.parent] || '',
      studentCode: row[colMap.code] || '',
      classCodeRaw: colMap.classCode >= 0 ? row[colMap.classCode] : '',
      isNew: false
    });
  }

  return results;
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

  // Simulate API delay
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
