// Shared, configurable search engine for student pickers and future app modules.
// Supports full text, fuzzy matching, and Vietnamese acronym / initials shorthand (e.g. "Mạc Duy Phú" -> mdp, dp, mdphu, dphu).

export function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Generates shorthand / acronym combinations for a normalized multi-word string.
 * Example for "mac duy phu" (words = ["mac", "duy", "phu"]):
 * - Initials from any starting word: "mdp", "dp"
 * - Contiguous initials: "md"
 * - Initials of leading words + last word (or prefix of last word): "mdphu", "dphu", "mdph", "dph"
 * - Initials of leading words + any subsequent word: "mduy"
 */
export function buildAcronymTokens(normalizedText = '') {
  const words = String(normalizedText || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const tokens = new Set();
  const n = words.length;

  for (let start = 0; start < n; start++) {
    let initials = '';
    for (let end = start; end < n; end++) {
      const prevInitials = initials;
      initials += words[end][0] || '';
      if (end > start && initials.length >= 2) {
        tokens.add(initials);
      }
      // Combine initials from start..end-1 with full word[end] (e.g., "md" + "phu" -> "mdphu", "d" + "phu" -> "dphu")
      if (prevInitials.length >= 1 && words[end].length >= 2) {
        tokens.add(prevInitials + words[end]);
      }
    }
  }
  return [...tokens];
}

/**
 * Checks whether a single normalized term matches a normalized field value (including acronyms).
 */
export function scoreFieldMatch(fieldValue, term) {
  if (!fieldValue || !term) return 0;
  const fieldWords = fieldValue.split(/\s+/).filter(Boolean);
  if (fieldValue === term || fieldWords.includes(term)) return 100;
  if (fieldValue.startsWith(term) || fieldWords.some(word => word.startsWith(term))) return 80;

  // Check acronym / shorthand tokens (e.g., mdp, dp, mdphu, dphu for "Mạc Duy Phú")
  const acronyms = buildAcronymTokens(fieldValue);
  if (acronyms.includes(term)) return 90;
  if (term.length >= 2 && acronyms.some(ac => ac.startsWith(term))) return 75;

  if (fieldValue.includes(term) || fieldWords.some(word => word.includes(term))) return 55;
  if (term.length >= 4 && fieldWords.some(word => distanceAtMostOne(word, term))) return 20;
  return 0;
}

/**
 * Convenience helper for table/list search filters to test if rawText matches rawQuery (including Vietnamese acronyms).
 */
export function matchesAcronymOrText(rawText = '', rawQuery = '') {
  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery) return true;
  const normText = normalizeSearchText(rawText);
  if (!normText) return false;
  if (normText.includes(normQuery)) return true;

  const queryTerms = normQuery.split(/\s+/).filter(Boolean);
  return queryTerms.every(term => scoreFieldMatch(normText, term) > 0);
}

function distanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}

function valuesFrom(record, fieldConfig) {
  const configured = typeof fieldConfig === 'function' ? fieldConfig(record) : fieldConfig;
  return (Array.isArray(configured) ? configured : [])
    .map(field => typeof field === 'string' ? { value: record?.[field] } : field)
    .map(field => ({ value: normalizeSearchText(field?.value), weight: Number(field?.weight) || 1 }))
    .filter(field => field.value);
}

/**
 * Search any record type by supplying field values (and optional weights).
 */
export function searchRecords(records, query, { fields = () => [], excludeIds = [], getId = record => record?.id } = {}) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const terms = normalized.split(/\s+/), excluded = new Set(excludeIds);
  return records.map((record, index) => {
    if (excluded.has(getId(record))) return null;
    const recordFields = valuesFrom(record, fields), allText = recordFields.map(field => field.value).join(' ');
    let score = 0;
    for (const term of terms) {
      let best = 0;
      for (const field of recordFields) {
        const quality = scoreFieldMatch(field.value, term);
        best = Math.max(best, quality * field.weight);
      }
      if (!best) return null;
      score += best;
    }
    if (allText.startsWith(normalized)) score += 25;
    return { record, index, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || String(a.record.name || '').localeCompare(String(b.record.name || ''), 'vi') || a.index - b.index).map(result => result.record);
}

export const studentSearchFields = student => [
  { value: student?.name, weight: 1.25 },
  { value: student?.studentCode, weight: 1.15 },
  { value: student?.school, weight: 0.9 }
];

export function createSearchProvider(defaultFields) {
  return (records, query, options = {}) => searchRecords(records, query, { fields: defaultFields, ...options });
}

const studentTagSearchFields = student => (student?.tags || []).map(value => ({ value, weight: 1 }));
const searchNames = createSearchProvider(studentSearchFields);
const searchTags = createSearchProvider(studentTagSearchFields);

// Reused by the class roster, attendance, and late-arrival pickers.
// Plain text searches names (including acronyms like mdp, dp, mdphu, dphu); a leading # switches the same engine to tags only.
export function searchStudents(profiles, query, options = {}) {
  const text = String(query || '').trim();
  if (text.startsWith('#')) return searchTags(profiles, text.replace(/^#+/, '').trim(), options);
  return searchNames(profiles, text, options);
}
