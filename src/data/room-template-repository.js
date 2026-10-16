// Repository for Center Rooms and Layouts (Quản lý Phòng học & Sơ đồ tại Trung tâm).
// Supports per-aisle desk counts and per-aisle desk dividers (ngăn cách của mỗi dãy có thể khác nhau).
const ROOM_TEMPLATES_KEY = 'lopvui.room-templates.v1';

export const defaultRoomTemplates = [
  {
    id: 'room-p1-t3-cs1',
    name: 'Phòng 1 - Tầng 3 (Cơ sở 1)',
    roomCode: 'P1-T3-CS1',
    description: 'Phòng học chuẩn tầng 3 CS1, máy chiếu, điều hòa 2 chiều, bảng từ lớn',
    aisles: 3,
    desksPerAisle: [3, 3, 2],
    seatsPerDesk: 2,
    dividerAfterDesks: [2],
    aisleDividers: [[2], [2], [1]],
    createdAt: 1728100000000
  },
  {
    id: 'room-p2-t2-cs1',
    name: 'Phòng 2 - Tầng 2 (Cơ sở 1)',
    roomCode: 'P2-T2-CS1',
    description: 'Phòng học ngoại ngữ tầng 2 CS1, hệ thống loa âm trần, TV thông minh',
    aisles: 2,
    desksPerAisle: [3, 3],
    seatsPerDesk: 2,
    dividerAfterDesks: [2],
    aisleDividers: [[2], [2]],
    createdAt: 1728100000000
  },
  {
    id: 'room-p1-t1-cs2',
    name: 'Phòng 1 - Tầng 1 (Cơ sở 2)',
    roomCode: 'P1-T1-CS2',
    description: 'Phòng học lớn cơ sở 2, bảng từ chống lóa, thoáng mát, 18 bàn học',
    aisles: 3,
    desksPerAisle: [3, 3, 3],
    seatsPerDesk: 2,
    dividerAfterDesks: [2],
    aisleDividers: [[2], [2], [2]],
    createdAt: 1728100000000
  },
  {
    id: 'room-p3-t2-cs1',
    name: 'Phòng 3 - Tầng 2 (Cơ sở 1)',
    roomCode: 'P3-T2-CS1',
    description: 'Phòng học toán nâng cao, bảng phụ 2 bên, điều hòa âm trần',
    aisles: 3,
    desksPerAisle: [3, 3, 3],
    seatsPerDesk: 2,
    dividerAfterDesks: [2],
    aisleDividers: [[2], [2], [2]],
    createdAt: 1728100000000
  },
  {
    id: 'room-p2-t1-cs1',
    name: 'Phòng 2 - Tầng 1 (Cơ sở 1)',
    roomCode: 'P2-T1-CS1',
    description: 'Phòng học vật lý & khoa học, trang bị ổ cắm từng bàn, máy chiếu siêu gần',
    aisles: 2,
    desksPerAisle: [3, 3],
    seatsPerDesk: 2,
    dividerAfterDesks: [2],
    aisleDividers: [[2], [2]],
    createdAt: 1728100000000
  },
  {
    id: 'room-p1-t4-cs1',
    name: 'Phòng 1 - Tầng 4 (Hội trường CS1)',
    roomCode: 'P1-T4-CS1',
    description: 'Hội trường luyện thi & kiểm tra định kỳ, sức chứa lớn 22-30 HS',
    aisles: 3,
    desksPerAisle: [4, 4, 3],
    seatsPerDesk: 2,
    dividerAfterDesks: [2],
    aisleDividers: [[2], [2], [2]],
    createdAt: 1728100000000
  },
  {
    id: 'room-vip-01',
    name: 'Phòng VIP 1 (Cơ sở 1)',
    roomCode: 'VIP-01',
    description: 'Phòng gia sư 1-1 và bổ trợ nhóm nhỏ chất lượng cao',
    aisles: 2,
    desksPerAisle: [2, 2],
    seatsPerDesk: 2,
    dividerAfterDesks: [1],
    aisleDividers: [[1], [1]],
    createdAt: 1728100000000
  }
];

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
    const saved = JSON.parse(storage.getItem(ROOM_TEMPLATES_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) {
      const existingCodes = new Set(saved.map(r => r.roomCode));
      for (const d of defaultRoomTemplates) {
        if (!existingCodes.has(d.roomCode)) {
          saved.push(d);
        }
      }
      return saved.map(normalizeTemplateDividers);
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
