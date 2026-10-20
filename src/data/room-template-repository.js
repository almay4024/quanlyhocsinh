// Repository for Center Rooms and Layouts (Quản lý Phòng học & Sơ đồ tại Trung tâm).
// Supports per-aisle desk counts and per-aisle desk dividers (ngăn cách của mỗi dãy có thể khác nhau).
const ROOM_TEMPLATES_KEY = 'lopvui.room-templates.v1';

export const defaultRoomTemplates = [];

export function normalizeTemplateDividers(tpl) {
  const aislesCount = Number(tpl.aisles) || (Array.isArray(tpl.desksPerAisle) ? tpl.desksPerAisle.length : 3);
  const desksPerAisle = Array.isArray(tpl.desksPerAisle) && tpl.desksPerAisle.length
    ? tpl.desksPerAisle.map(n => Math.max(1, Number(n) || 1))
    : Array.from({ length: aislesCount }, () => 3);
  const fallbackDivs = Array.isArray(tpl.dividerAfterDesks)
    ? tpl.dividerAfterDesks.map(Number).filter(n => n > 0)
    : [2];

  const aisleDividers = Array.from({ length: desksPerAisle.length }, (_, rowIdx) => {
    const deskCount = desksPerAisle[rowIdx];
    const rawRow = Array.isArray(tpl.aisleDividers?.[rowIdx])
      ? tpl.aisleDividers[rowIdx]
      : fallbackDivs;
    return rawRow
      .map(Number)
      .filter(d => d >= 1 && d < deskCount);
  });

  return {
    ...tpl,
    aisles: desksPerAisle.length,
    desksPerAisle,
    dividerAfterDesks: aisleDividers[0] || fallbackDivs,
    aisleDividers
  };
}

export function loadRoomTemplates(storage = localStorage) {
  try {
    const raw = storage.getItem(ROOM_TEMPLATES_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        return saved.map(normalizeTemplateDividers);
      }
    }
  } catch {}
  const seeded = defaultRoomTemplates.map(normalizeTemplateDividers);
  try {
    storage.setItem(ROOM_TEMPLATES_KEY, JSON.stringify(seeded));
  } catch {}
  return structuredClone(seeded);
}

export function saveRoomTemplates(templates, storage = localStorage) {
  try {
    const normalized = (templates || []).map(normalizeTemplateDividers);
    storage.setItem(ROOM_TEMPLATES_KEY, JSON.stringify(normalized));
  } catch {}
}

export function buildLayoutFromTemplate(classId, template) {
  const norm = normalizeTemplateDividers(template || {});
  const counts = norm.desksPerAisle;
  return counts.map((count, row) => {
    const numDesks = Number(count) || 1;
    const rowDividers = Array.isArray(norm.aisleDividers?.[row])
      ? norm.aisleDividers[row].map(Number)
      : (Array.isArray(norm.dividerAfterDesks) ? norm.dividerAfterDesks.map(Number) : []);
    return {
      id: `${classId}-aisle-${row + 1}`,
      desks: Array.from({ length: numDesks }, (_, desk) => ({
        id: `${classId}-desk-${row + 1}-${desk + 1}`,
        seats: Number(norm.seatsPerDesk) || 2,
        dividerAfter: desk < numDesks - 1 && rowDividers.includes(desk + 1)
      }))
    };
  });
}

export function getClassesInRoom(roomCode, classCatalog = []) {
  if (!roomCode) return [];
  const clean = String(roomCode).trim().toLowerCase();
  return classCatalog.filter(c => {
    const cRoom = String(c.room || '').trim().toLowerCase();
    return cRoom === clean || cRoom.includes(clean) || clean.includes(cRoom);
  }).sort((a, b) => (Number(a.weekday) - Number(b.weekday)) || String(a.startTime).localeCompare(String(b.startTime)));
}
