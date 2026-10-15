// Repository for Center Rooms and Layouts (Quản lý Phòng học & Sơ đồ tại Trung tâm).
// Stored in localStorage, easily pluggable to Firebase Firestore collection 'roomTemplates'.
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
    createdAt: 1728100000000
  }
];

export function loadRoomTemplates(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(ROOM_TEMPLATES_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) {
      // Ensure all center rooms exist
      const existingCodes = new Set(saved.map(r => r.roomCode));
      for (const d of defaultRoomTemplates) {
        if (!existingCodes.has(d.roomCode)) {
          saved.push(d);
        }
      }
      return saved;
    }
  } catch {}
  storage.setItem(ROOM_TEMPLATES_KEY, JSON.stringify(defaultRoomTemplates));
  return structuredClone(defaultRoomTemplates);
}

export function saveRoomTemplates(templates, storage = localStorage) {
  storage.setItem(ROOM_TEMPLATES_KEY, JSON.stringify(templates));
}

export function buildLayoutFromTemplate(classId, template) {
  const counts = Array.isArray(template.desksPerAisle)
    ? template.desksPerAisle
    : Array.from({ length: Number(template.aisles) || 3 }, () => 3);
  return counts.map((count, row) => ({
    id: `${classId}-aisle-${row + 1}`,
    desks: Array.from({ length: Number(count) || 1 }, (_, desk) => ({
      id: `${classId}-desk-${row + 1}-${desk + 1}`,
      seats: Number(template.seatsPerDesk) || 2
    }))
  }));
}

/**
 * Returns all classes that use this room in the center according to schedule.
 */
export function getClassesInRoom(roomCode, classCatalog = []) {
  if (!roomCode) return [];
  const clean = String(roomCode).trim().toLowerCase();
  return classCatalog.filter(c => {
    const cRoom = String(c.room || '').trim().toLowerCase();
    return cRoom === clean || cRoom.includes(clean) || clean.includes(cRoom);
  }).sort((a, b) => (Number(a.weekday) - Number(b.weekday)) || String(a.startTime).localeCompare(String(b.startTime)));
}
