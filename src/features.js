import { matchesAcronymOrText } from './student-search.js?v=3.0';
// Features module: Account Switcher, Tutoring Module, Room Templates, Roster & Import,
// Finalize Attendance, Visual Warnings, Late Calculation, TA Portal, and Report Center.

import { loadRoomTemplates, saveRoomTemplates, buildLayoutFromTemplate, getClassesInRoom } from './data/room-template-repository.js?v=3.0';
import { normalizeGradeToBirthYear } from './data/class-catalog-repository.js?v=3.0';

function formatBirthYearLabel(val) {
  const by = normalizeGradeToBirthYear(val);
  if (!by || by === '—') return '—';
  return String(by);
}
import { loadTutoringSessions, saveTutoringSessions, TUTORING_CLASS_ID, TUTORING_CLASS_CONFIG } from './data/tutoring-repository.js?v=3.0';
import {
  ENROLLMENT_STATUS_PRESETS,
  GRID_COLUMN_ROLE_OPTIONS,
  isStatusWord,
  normalizeEnrollmentStatus,
  parseRawTable,
  splitVietnameseName,
  autoDetectGridColumnRoles,
  extractStudentsFromGrid,
  autoDetectColumnMapping,
  mapCustomColumns,
  parseRosterText,
  exportToCsv,
  loadGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  syncSessionToGoogleSheets
} from './excel-import-export.js?v=3.0';
import {
  loadSessionHistory,
  saveSessionHistory,
  getSessionRecord,
  openClassSession,
  closeClassSession,
  getNoHomeworkStatus,
  setNoHomeworkStatus,
  getStaffShiftData,
  getStudentClassDeepDive
} from './data/session-history-repository.js?v=3.0';

export function setupFeatures(ctx) {
  const {
    $,
    escapeHtml,
    toast,
    addClassActivity,
    createClassNotification,
    getMasterData,
    getClassCatalog,
    saveClassCatalog,
    getSignedInAccount,
    setSignedInAccount,
    getCurrentClassId,
    getActiveClassConfig,
    getChecklistDate,
    classStudents,
    studentById,
    allEntries,
    getLateQueue,
    getStudents,
    saveStudentRecords,
    createStudentProfile,
    render,
    renderMainMenu,
    setMainMenuPanel,
    attendanceLabel,
    homeworkLabel,
    homeworkSymbol
  } = ctx;

  let activeRosterClassId = null;

  function renderStudentTagsBadges(student) {
    const rawTags = Array.isArray(student?.tags) ? [...student.tags].filter(Boolean) : [];
    if (student?.isNew && !rawTags.some(t => String(t).toLowerCase() === 'mới')) {
      rawTags.unshift('Mới');
    }
    if (!rawTags.length) return '';
    return rawTags.map(tag => {
      const isNewTag = String(tag).toLowerCase() === 'mới';
      return `<span class="student-tag-inline ${isNewTag ? 'new-tag' : ''}">${escapeHtml(tag)}</span>`;
    }).join(' ');
  }

  let parsedImportData = [];
  let currentReportTab = 'a4-roster';

  // ----------------------------------------------------
  
  // ----------------------------------------------------
  // 0. HỆ THỐNG ĐĂNG NHẬP & ĐĂNG XUẤT (LOGIN & LOGOUT)
  // ----------------------------------------------------
  function renderLoginScreen() {
    const master = getMasterData();
    const select = $('#login-employee-select');
    if (!select) return;

    const roleNames = {
      assistant: 'Trợ giảng',
      teacher: 'Giáo viên',
      office: 'Văn phòng',
      admin: 'Quản trị viên'
    };

    // Populate select
    select.innerHTML = master.employees.map(emp => `
      <option value="${escapeHtml(emp.id)}">${escapeHtml(emp.name)} (${escapeHtml(roleNames[emp.role] || emp.role)} - ${escapeHtml(emp.code)})</option>
    `).join('');
  }

  function handleLogin(empId) {
    const master = getMasterData();
    const emp = master.employees.find(e => e.id === empId);
    if (!emp) {
      toast('Không tìm thấy tài khoản nhân viên.');
      return;
    }

    const account = { employeeId: emp.id, role: emp.role };
    setSignedInAccount(account);
    localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(account));

    // Reset any active class path/query in URL to return to main menu
    try {
      history.pushState({}, '', '/');
    } catch {}

    // Hide login screen, show app shell (both hidden property and inline display)
    const loginScreen = document.getElementById('login-screen') || $('#login-screen');
    const appShell = document.getElementById('app-shell') || $('#app-shell');
    const classWorkspace = document.getElementById('class-workspace') || $('#class-workspace');
    const classGeneralView = document.getElementById('class-general-view') || $('#class-general-view');
    const mainMenuView = document.getElementById('main-menu-view') || $('#main-menu-view');

    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.style.display = 'none';
    }
    if (appShell) {
      appShell.hidden = false;
      appShell.style.display = '';
    }
    if (classWorkspace) {
      classWorkspace.hidden = true;
      classWorkspace.style.display = '';
    }
    if (classGeneralView) {
      classGeneralView.hidden = true;
      classGeneralView.style.display = '';
    }
    if (mainMenuView) {
      mainMenuView.hidden = false;
      mainMenuView.style.display = '';
    }

    updateCurrentUserDisplay();

    // Default view based on role
    if (emp.role === 'assistant' || emp.role === 'teacher') {
      setMainMenuPanel('work');
    } else {
      setMainMenuPanel('management');
    }

    const roleLabelText = emp.role === 'assistant' ? 'Trợ giảng' : emp.role === 'office' ? 'Văn phòng' : emp.role === 'teacher' ? 'Giáo viên' : 'Admin';
    toast(`Xin chào ${emp.name}! Đã đăng nhập vai trò ${roleLabelText}.`);
  }

  function handleLogout() {
    // Logout immediately without blocking dialog
    localStorage.removeItem('lopvui.signed-in-account.v1');
    setSignedInAccount({ employeeId: null, role: null });

    // Close any open dialogs
    document.querySelectorAll('dialog[open]').forEach(d => {
      try { d.close(); } catch {}
    });

    // Reset URL to root so we exit any active class view
    try {
      history.pushState({}, '', '/');
    } catch {}

    // Hide main app views, show login screen
    const appShell = document.getElementById('app-shell') || $('#app-shell');
    const classWorkspace = document.getElementById('class-workspace') || $('#class-workspace');
    const classGeneralView = document.getElementById('class-general-view') || $('#class-general-view');
    const loginScreen = document.getElementById('login-screen') || $('#login-screen');

    if (appShell) {
      appShell.hidden = true;
      appShell.style.display = 'none';
    }
    if (classWorkspace) {
      classWorkspace.hidden = true;
      classWorkspace.style.display = '';
    }
    if (classGeneralView) {
      classGeneralView.hidden = true;
      classGeneralView.style.display = '';
    }
    if (loginScreen) {
      loginScreen.hidden = false;
      loginScreen.style.display = 'grid';
      renderLoginScreen();
    }

    toast('Đã đăng xuất khỏi hệ thống.');
  }

  function checkAuthStatus() {
    const saved = localStorage.getItem('lopvui.signed-in-account.v1');
    let account = null;
    try {
      account = JSON.parse(saved);
    } catch {}

    const appShell = document.getElementById('app-shell') || $('#app-shell');
    const loginScreen = document.getElementById('login-screen') || $('#login-screen');

    if (!account || !account.employeeId) {
      // Not logged in -> Show login screen
      if (appShell) {
        appShell.hidden = true;
        appShell.style.display = 'none';
      }
      if (loginScreen) {
        loginScreen.hidden = false;
        loginScreen.style.display = 'grid';
        renderLoginScreen();
      }
      return false;
    } else {
      // Logged in
      if (loginScreen) {
        loginScreen.hidden = true;
        loginScreen.style.display = 'none';
      }
      if (appShell) {
        appShell.hidden = false;
        appShell.style.display = '';
      }
      return true;
    }
  }

  // ----------------------------------------------------
  // 1. ACCOUNT SWITCHER (PHÂN QUYỀN TRỢ GIẢNG / VĂN PHÒNG / GV / ADMIN)
  // ----------------------------------------------------
  function updateCurrentUserDisplay() {
    const account = getSignedInAccount();
    const master = getMasterData();
    const employee = master.employees.find(e => e.id === account?.employeeId) || {
      name: 'Chưa đăng nhập',
      code: '—',
      role: 'assistant'
    };

    const roleNames = {
      assistant: 'Trợ giảng',
      office: 'Văn phòng',
      teacher: 'Giáo viên',
      admin: 'Quản trị viên'
    };

    const nameParts = employee.name.split(' ').filter(Boolean);
    const initials = nameParts.length >= 2 
      ? (nameParts[0][0] + nameParts.at(-1)[0]).toUpperCase()
      : employee.name.slice(0, 2).toUpperCase();

    const nameEl = $('#current-user-name');
    if (nameEl) {
      nameEl.innerHTML = `${escapeHtml(employee.name)}<small id="current-user-role">${escapeHtml(roleNames[employee.role] || employee.role)}</small>`;
    }
    const roleBadge = $('#role-display-badge');
    if (roleBadge) {
      roleBadge.textContent = `Vai trò: ${roleNames[employee.role] || employee.role} · ${employee.name}`;
    }
  }

  function openAccountSwitchDialog() {
    const master = getMasterData();
    const currentAcc = getSignedInAccount();
    const list = $('#account-switch-list');
    if (!list) return;

    const roleGroups = [
      { role: 'assistant', title: 'Trợ giảng (Thao tác trực tiếp tại lớp)' },
      { role: 'office', title: 'Văn phòng (Quản lý tổng quan & Templates)' },
      { role: 'teacher', title: 'Giáo viên (Theo dõi tiến độ & Báo cáo)' },
      { role: 'admin', title: 'Quản trị viên (Toàn quyền hệ thống)' }
    ];

    list.innerHTML = roleGroups.map(group => {
      const emps = master.employees.filter(e => e.role === group.role);
      if (!emps.length) return '';
      return `
        <div class="account-role-group">
          <div class="account-role-title">${escapeHtml(group.title)}</div>
          <div class="account-cards-grid">
            ${emps.map(emp => {
              const isActive = emp.id === currentAcc?.employeeId;
              const initials = emp.name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
              return `
                <button type="button" class="account-user-card ${isActive ? 'active' : ''}" data-emp-id="${escapeHtml(emp.id)}">
                  <div>
                    <strong>${escapeHtml(emp.name)} ${isActive ? '✓' : ''}</strong>
                    <small>Mã: ${escapeHtml(emp.code)} · ${escapeHtml(group.role.toUpperCase())}</small>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-emp-id]').forEach(btn => {
      btn.onclick = () => {
        const empId = btn.dataset.empId;
        const emp = master.employees.find(e => e.id === empId);
        if (!emp) return;
        setSignedInAccount({ employeeId: emp.id, role: emp.role });
        localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify({ employeeId: emp.id, role: emp.role }));
        updateCurrentUserDisplay();

        // Close any active class view and return to main menu
        try {
          history.pushState({}, '', '/');
        } catch {}

        if ($('#class-workspace')) {
          $('#class-workspace').hidden = true;
          $('#class-workspace').style.display = '';
        }
        if ($('#class-general-view')) {
          $('#class-general-view').hidden = true;
          $('#class-general-view').style.display = '';
        }
        if ($('#main-menu-view')) {
          $('#main-menu-view').hidden = false;
          $('#main-menu-view').style.display = '';
        }

        // Switch to the appropriate panel based on new role
        if (emp.role === 'assistant' || emp.role === 'teacher') {
          setMainMenuPanel('work');
        } else {
          setMainMenuPanel('management');
        }

        try { $('#account-switch-dialog')?.close(); } catch {}
        const roleNames = { assistant: 'Trợ giảng', office: 'Văn phòng', teacher: 'Giáo viên', admin: 'Admin' };
        toast(`Đã chuyển sang tài khoản ${emp.name} (${roleNames[emp.role] || emp.role})`);
      };
    });

    const accDialog = $('#account-switch-dialog');
    if (accDialog && !accDialog.open) {
      try { accDialog.showModal(); } catch { accDialog.setAttribute('open', ''); }
    }
  }

  
  // ----------------------------------------------------
  // 1.1 QUẢN LÝ NHÂN SỰ DÀNH RIÊNG CHO ADMIN (PERSONNEL MANAGEMENT)
  // ----------------------------------------------------
  function renderStaffManagement() {
    const master = getMasterData();
    const catalog = getClassCatalog();
    const employees = master.employees || [];

    const search = ($('#staff-search-input')?.value || '').trim().toLowerCase();
    const roleFilter = $('#staff-role-filter')?.value || 'all';

    // KPIs
    const total = employees.length;
    const assistants = employees.filter(e => e.role === 'assistant').length;
    const teachers = employees.filter(e => e.role === 'teacher').length;
    const office = employees.filter(e => e.role === 'office' || e.role === 'admin').length;

    if ($('#management-staff-count')) $('#management-staff-count').textContent = `${total} nhân sự`;
    if ($('#staff-kpi-total')) $('#staff-kpi-total').textContent = total;
    if ($('#staff-kpi-assistants')) $('#staff-kpi-assistants').textContent = assistants;
    if ($('#staff-kpi-teachers')) $('#staff-kpi-teachers').textContent = teachers;
    if ($('#staff-kpi-office')) $('#staff-kpi-office').textContent = office;

    // Filter employees
    const filtered = employees.filter(e => {
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      if (search) {
        const text = `${e.name} ${e.code} ${e.phone || ''} ${e.email || ''}`.toLowerCase();
        if (!matchesAcronymOrText(text, search)) return false;
      }
      return true;
    });

    const tbody = $('#staff-table-tbody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:18px; color:#879389;">Không tìm thấy nhân viên nào phù hợp với điều kiện tìm kiếm.</td></tr>`;
      return;
    }

    const roleLabels = {
      assistant: 'Trợ giảng (TA)',
      teacher: 'Giáo viên (GV)',
      office: 'Văn phòng',
      admin: 'Quản trị viên'
    };

    tbody.innerHTML = filtered.map((emp, index) => {
      const nameParts = emp.name.split(' ').filter(Boolean);
      const initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts.at(-1)[0]).toUpperCase() : emp.name.slice(0, 2).toUpperCase();

      // Find assigned classes
      const assigned = catalog.filter(c => 
        (c.teacherIds || []).includes(emp.id) || 
        (c.assistantIds || []).includes(emp.id) || 
        (c.officeIds || []).includes(emp.id)
      );

      const assignedBadges = assigned.length 
        ? `<span class="plain-class-list-text">${assigned.map(c => escapeHtml(c.code || c.name)).join(', ')}</span>` 
        : '<small style="color:#9ca89f;">Chưa phân công lớp</small>';

      return `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td>
            <div style="cursor:pointer;" data-view-staff="${escapeHtml(emp.id)}" title="Bấm để xem phân công ca & lịch sử làm việc">
              <strong style="color:#2f5f3e; text-decoration:underline;">${escapeHtml(emp.name)}</strong>
              <small style="display:block; color:#7d8c80; font-size:12.5px;">Bấm xem ca & lịch sử</small>
            </div>
          </td>
          <td><strong>${escapeHtml(emp.code)}</strong></td>
          <td><span class="staff-role-badge ${escapeHtml(emp.role)}">${escapeHtml(roleLabels[emp.role] || emp.role)}</span></td>
          <td>${escapeHtml(emp.phone || '—')}</td>
          <td>${escapeHtml(emp.email || '—')}</td>
          <td class="col-allow-wrap">${assignedBadges}</td>
          <td style="text-align:center; white-space:nowrap;">
            
            <button type="button" class="outline-button" data-edit-staff="${escapeHtml(emp.id)}" style="padding:7px 12px; font-size:13.5px; margin-left:4px;">Sửa</button>
            <button type="button" class="text-danger" data-delete-staff="${escapeHtml(emp.id)}" style="padding:7px 12px; font-size:13.5px; margin-left:4px;">Xóa</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach view, edit & delete events
    tbody.querySelectorAll('[data-view-staff]').forEach(btn => {
      btn.onclick = () => openStaffDetailDialog(btn.dataset.viewStaff);
    });

    tbody.querySelectorAll('[data-edit-staff]').forEach(btn => {
      btn.onclick = () => openStaffDialog(btn.dataset.editStaff);
    });

    tbody.querySelectorAll('[data-delete-staff]').forEach(btn => {
      btn.onclick = () => {
        const staffId = btn.dataset.deleteStaff;
        const emp = master.employees.find(e => e.id === staffId);
        if (!emp) return;

        // Check if assigned to any class
        const assigned = catalog.filter(c => 
          (c.teacherIds || []).includes(emp.id) || 
          (c.assistantIds || []).includes(emp.id) || 
          (c.officeIds || []).includes(emp.id)
        );

        if (assigned.length > 0) {
          alert(`Không thể xóa! Nhân viên ${emp.name} đang được phân công phụ trách ${assigned.length} lớp: ${assigned.map(c => c.name).join(', ')}. Vui lòng gỡ phân công trong cấu hình lớp trước khi xóa.`);
          return;
        }

        if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên ${emp.name} (${emp.code}) khỏi hệ thống?`)) return;

        master.employees = master.employees.filter(e => e.id !== staffId);
        // Persist
        if (ctx.setMasterData) ctx.setMasterData(master); else localStorage.setItem('lopvui.master-data.v1', JSON.stringify(master));
        renderStaffManagement();
        renderMainMenu();
        toast(`Đã xóa nhân viên ${emp.name}.`);
      };
    });
  }

  function openStaffDialog(editId = null) {
    const master = getMasterData();
    const dialog = $('#staff-form-dialog');
    if (!dialog) return;

    if (editId) {
      const emp = master.employees.find(e => e.id === editId);
      if (!emp) return;
      $('#staff-form-title').textContent = 'Chỉnh sửa thông tin nhân viên';
      $('#staff-form-id').value = emp.id;
      $('#staff-code').value = emp.code;
      $('#staff-name').value = emp.name;
      $('#staff-role').value = emp.role;
      $('#staff-phone').value = emp.phone || '';
      $('#staff-email').value = emp.email || '';
      $('#staff-note').value = emp.note || '';
    } else {
      $('#staff-form-title').textContent = 'Thêm nhân viên mới';
      $('#staff-form-id').value = '';
      
      // Do not auto-generate dummy codes
      $('#staff-code').value = '';
      $('#staff-name').value = '';
      $('#staff-role').value = 'assistant';
      $('#staff-phone').value = '';
      $('#staff-email').value = '';
      $('#staff-note').value = '';
    }

    dialog.showModal();
  }

  function exportStaffListAsCsv() {
    const master = getMasterData();
    const catalog = getClassCatalog();
    const roleLabels = { assistant: 'Trợ giảng', teacher: 'Giáo viên', office: 'Văn phòng', admin: 'Quản trị viên' };

    const headers = ['STT', 'Mã NV', 'Họ và tên', 'Vai trò', 'Số điện thoại', 'Email', 'Các lớp phụ trách', 'Ghi chú'];
    const rows = (master.employees || []).map((emp, index) => {
      const assigned = catalog.filter(c => 
        (c.teacherIds || []).includes(emp.id) || 
        (c.assistantIds || []).includes(emp.id) || 
        (c.officeIds || []).includes(emp.id)
      ).map(c => c.name).join('; ');

      return [
        index + 1,
        emp.code,
        emp.name,
        roleLabels[emp.role] || emp.role,
        emp.phone || '',
        emp.email || '',
        assigned || 'Chưa phân công',
        emp.note || ''
      ];
    });

    exportToCsv(headers, rows, 'DanhSachNhanSu_TrungTam.csv');
    toast('Đã tải về danh sách nhân sự CSV.');
  }

  // 2. LỚP BỔ TRỢ & HỌC BÙ (PRD §7: TUTORING MODULE)
  // ----------------------------------------------------
  function renderTutoringModule() {
    const sessions = loadTutoringSessions();
    const query = ($('#tutoring-search')?.value || '').trim().toLowerCase();
    const typeFilter = $('#tutoring-type-filter')?.value || 'all';

    // Metrics
    const total = sessions.length;
    const giasuCount = sessions.filter(s => s.type === 'giasu').length;
    const makeups = sessions.filter(s => s.type === 'makeup').length;
    const completedHW = sessions.filter(s => s.homeworkStatus === 'completed').length;

    if ($('#tutoring-total-count')) $('#tutoring-total-count').textContent = total;
    if ($('#tutoring-giasu-count')) $('#tutoring-giasu-count').textContent = giasuCount;
    if ($('#tutoring-makeup-count')) $('#tutoring-makeup-count').textContent = makeups;
    if ($('#tutoring-completed-hw-count')) $('#tutoring-completed-hw-count').textContent = completedHW;

    // Filter
    const filtered = sessions.filter(s => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (query) {
        const matchText = `${s.studentName} ${s.assistantName} ${s.lessonContent} ${s.studentClass || ''}`;
        if (!matchesAcronymOrText(matchText, query)) return false;
      }
      return true;
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.startTime).localeCompare(String(a.startTime)));

    const list = $('#tutoring-session-list');
    if (!list) return;

    if (!filtered.length) {
      list.innerHTML = `<div class="menu-empty"><span></span><strong>Chưa có ca bổ trợ hoặc học bù nào phù hợp</strong><small>Bấm "+ Ghi nhận ca bổ trợ" để tạo hồ sơ buổi học 1-kèm-1 mới.</small></div>`;
      return;
    }

    const typeLabels = { giasu: 'Gia sư', makeup: 'Học bù', tutoring: 'Bổ trợ', new: 'Học mới' };
    const hwLabels = {
      completed: '✓ Đã hoàn thành phiếu',
      assigned_more: ' Giao thêm phiếu về nhà',
      pending: ' Chưa hoàn thành',
      none: 'Không giao bài tập'
    };

    list.innerHTML = filtered.map(item => `
      <article class="tutoring-card tutoring-card-clean">
        <div class="tutoring-card-main">
          <div class="tutoring-card-header-line">
            <strong class="tutoring-student-title">${escapeHtml(item.studentName)}</strong>
            <div class="tutoring-card-badges">
              <span class="tutoring-badge ${escapeHtml(item.type)}">${item.type === 'giasu' ? 'Gia sư 1-kèm-1' : escapeHtml(typeLabels[item.type] || item.type)}</span>
              ${item.studentClass ? `<span class="room-chip">${escapeHtml(item.studentClass)}</span>` : ''}
            </div>
          </div>
          ${item.previousHomeworkCheck ? `<p class="tutoring-detail-line"><strong>Kiểm tra BTVN buổi trước:</strong> ${escapeHtml(item.previousHomeworkCheck)}</p>` : ''}
          <p class="tutoring-detail-line"><strong>Nội dung kèm:</strong> ${escapeHtml(item.lessonContent)}</p>
          ${item.evaluation ? `<p class="tutoring-detail-line"><strong>Đánh giá:</strong> ${escapeHtml(item.evaluation)} ${item.score ? `· Điểm: <strong style="color:#2f7045;">${item.score}/10</strong>` : ''}</p>` : ''}
        </div>
        <div class="tutoring-card-meta">
          <span>${escapeHtml(item.date)} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</span>
          <span>Trợ giảng: <strong>${escapeHtml(item.assistantName)}</strong></span>
          <span>BTVN: <em>${escapeHtml(hwLabels[item.homeworkStatus] || item.homeworkStatus)}</em></span>
        </div>
        <div class="tutoring-actions tutoring-actions-divided">
          <button type="button" class="outline-button" data-edit-tutoring="${escapeHtml(item.id)}">Sửa</button>
          <button type="button" class="text-danger" data-delete-tutoring="${escapeHtml(item.id)}">Xóa</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-edit-tutoring]').forEach(btn => {
      btn.onclick = () => openTutoringDialog(btn.dataset.editTutoring);
    });
    list.querySelectorAll('[data-delete-tutoring]').forEach(btn => {
      btn.onclick = () => {
        if (!confirm('Bạn có chắc chắn muốn xóa ghi nhận ca bổ trợ này?')) return;
        const current = loadTutoringSessions().filter(s => s.id !== btn.dataset.deleteTutoring);
        saveTutoringSessions(current);
        toast('Đã xóa ca bổ trợ.');
        renderTutoringModule();
      };
    });
  }

  function openTutoringDialog(editId = null) {
    const dialog = $('#tutoring-form-dialog');
    const master = getMasterData();
    const account = getSignedInAccount();
    const assistantSelect = $('#tutoring-assistant-select');
    const catalog = getClassCatalog();

    // Populate assistants
    const assistants = master.employees.filter(e => e.role === 'assistant' || e.role === 'teacher');
    assistantSelect.innerHTML = assistants.map(a => `
      <option value="${escapeHtml(a.id)}" data-name="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${a.code})</option>
    `).join('');

    // Pre-select current employee if assistant
    if (account.employeeId && assistants.some(a => a.id === account.employeeId)) {
      assistantSelect.value = account.employeeId;
    }

    // Setup interactive student search menu
    const searchInput = $('#tutoring-student-search-input');
    const dropdown = $('#tutoring-student-search-dropdown');
    const pill = $('#tutoring-selected-student-pill');
    const pillText = $('#tutoring-selected-student-text');
    const removePillBtn = $('#tutoring-remove-selected-student');
    const hiddenId = $('#tutoring-student-id');
    const nameInput = $('#tutoring-student-name');
    const classInput = $('#tutoring-student-class');
    const allStudents = getStudents();

    function selectStudent(stu) {
      hiddenId.value = stu.id;
      nameInput.value = stu.name;
      const enrolledClasses = (stu.classIds || []).map(cid => {
        const c = catalog.find(x => x.id === cid);
        return c?.code || cid;
      }).filter(c => c !== 'class-tutoring' && c !== 'BOTRO');
      const primaryClass = enrolledClasses[0] || '';
      classInput.value = primaryClass;

      pillText.innerHTML = `✓ <strong>${escapeHtml(stu.name)}</strong> · Mã: <strong>${escapeHtml(stu.studentCode || '—')}</strong> · Trường: ${escapeHtml(stu.school || '—')} ${primaryClass ? `· Lớp: <span class="room-chip">${escapeHtml(primaryClass)}</span>` : ''}`;
      pill.hidden = false;
      dropdown.hidden = true;
      searchInput.value = '';
    }

    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
          dropdown.hidden = true;
          dropdown.innerHTML = '';
          return;
        }

        const matches = allStudents.filter(s => {
          const classText = (s.classIds || []).map(cid => {
            const c = catalog.find(x => x.id === cid);
            return `${c?.code || ''} ${c?.name || ''}`;
          }).join(' ');
          return matchesAcronymOrText(`${s.name} ${s.studentCode || ''} ${s.school || ''} ${classText}`, q);
        }).slice(0, 8);

        if (!matches.length) {
          dropdown.innerHTML = '<div style="padding:10px 12px; font-size:14.5px; color:#88988b; font-style:italic;">Không tìm thấy học sinh phù hợp. Bạn vẫn có thể tự nhập họ tên bên dưới.</div>';
          dropdown.hidden = false;
          return;
        }

        dropdown.innerHTML = matches.map(s => {
          const enrolled = (s.classIds || []).map(cid => {
            const c = catalog.find(x => x.id === cid);
            return c?.code || cid;
          }).filter(c => c !== 'class-tutoring' && c !== 'BOTRO').join(', ');

          return `
            <div class="tutoring-search-item" data-choose-student="${escapeHtml(s.id)}">
              <div style="display:flex; align-items:center; gap:8px;">
                
                <div>
                  <strong style="color:#233d31; font-size:14.5px;">${escapeHtml(s.name)}</strong>
                  <small style="display:block; color:#78887b; font-size:13.5px;">Mã: <strong style="color:#215f33;">${escapeHtml(s.studentCode || '—')}</strong> · ${escapeHtml(s.school || 'Chưa có trường')}</small>
                </div>
              </div>
              <div>
                ${enrolled ? `<span class="room-chip" style="font-weight:700;">${escapeHtml(enrolled)}</span>` : '<small style="color:#9ba89e;">Chưa gán lớp</small>'}
              </div>
            </div>
          `;
        }).join('');

        dropdown.hidden = false;

        dropdown.querySelectorAll('[data-choose-student]').forEach(item => {
          item.onclick = () => {
            const s = allStudents.find(x => x.id === item.dataset.chooseStudent);
            if (s) selectStudent(s);
          };
        });
      };
    }

    if (removePillBtn) {
      removePillBtn.onclick = () => {
        hiddenId.value = '';
        nameInput.value = '';
        classInput.value = '';
        pill.hidden = true;
        searchInput.value = '';
        searchInput.focus();
      };
    }

    if (editId) {
      const item = loadTutoringSessions().find(s => s.id === editId);
      if (!item) return;
      $('#tutoring-dialog-title').textContent = 'Chỉnh sửa ca bổ trợ / Học bù / Gia sư';
      $('#tutoring-id').value = item.id;
      $('#tutoring-date').value = item.date;
      if (window.__timeHelpers?.setDurationFieldsFromStartEnd) {
        window.__timeHelpers.setDurationFieldsFromStartEnd({
          startTime: item.startTime || '15:30',
          endTime: item.endTime || '16:45',
          startSel: '#tutoring-start-time',
          endSel: '#tutoring-end-time',
          durationSel: '#tutoring-duration-select',
          customWrapSel: '#tutoring-duration-custom-wrap',
          customInputSel: '#tutoring-duration-custom'
        });
      } else {
        $('#tutoring-start-time').value = item.startTime;
        $('#tutoring-end-time').value = item.endTime;
      }
      assistantSelect.value = item.assistantId || assistantSelect.value;
      $('#tutoring-type-select').value = item.type;
      hiddenId.value = item.studentId || '';
      nameInput.value = item.studentName || '';
      classInput.value = item.studentClass || '';
      $('#tutoring-prev-hw-check').value = item.previousHomeworkCheck || '';
      $('#tutoring-hw-status').value = item.homeworkStatus || 'completed';
      $('#tutoring-lesson-content').value = item.lessonContent || '';
      $('#tutoring-evaluation').value = item.evaluation || '';
      $('#tutoring-score').value = item.score ?? '';

      if (item.studentName) {
        const found = allStudents.find(s => s.id === item.studentId || s.name === item.studentName);
        pillText.innerHTML = `✓ <strong>${escapeHtml(item.studentName)}</strong> ${found?.studentCode ? `· Mã: <strong>${escapeHtml(found.studentCode)}</strong>` : ''} ${item.studentClass ? `· Lớp: <span class="room-chip">${escapeHtml(item.studentClass)}</span>` : ''}`;
        pill.hidden = false;
      } else {
        pill.hidden = true;
      }
    } else {
      $('#tutoring-dialog-title').textContent = 'Ghi nhận ca bổ trợ / Học bù / Gia sư';
      $('#tutoring-id').value = '';
      $('#tutoring-date').value = new Date().toLocaleDateString('sv-SE');
      const now5 = window.__timeHelpers?.roundTimeTo5Minutes ? window.__timeHelpers.roundTimeTo5Minutes(new Date().toTimeString().slice(0, 5)) : new Date().toTimeString().slice(0, 5);
      const end5 = window.__timeHelpers?.addMinutesToTimeStr ? window.__timeHelpers.addMinutesToTimeStr(now5, 75) : new Date(Date.now() + 75 * 60000).toTimeString().slice(0, 5);
      if (window.__timeHelpers?.setDurationFieldsFromStartEnd) {
        window.__timeHelpers.setDurationFieldsFromStartEnd({
          startTime: now5,
          endTime: end5,
          startSel: '#tutoring-start-time',
          endSel: '#tutoring-end-time',
          durationSel: '#tutoring-duration-select',
          customWrapSel: '#tutoring-duration-custom-wrap',
          customInputSel: '#tutoring-duration-custom'
        });
      } else {
        $('#tutoring-start-time').value = now5;
        $('#tutoring-end-time').value = end5;
      }
      $('#tutoring-type-select').value = 'tutoring';
      hiddenId.value = '';
      nameInput.value = '';
      classInput.value = getActiveClassConfig()?.name || '';
      $('#tutoring-prev-hw-check').value = '';
      $('#tutoring-hw-status').value = 'completed';
      $('#tutoring-lesson-content').value = '';
      $('#tutoring-evaluation').value = '';
      $('#tutoring-score').value = '';
      pill.hidden = true;
    }

    dialog.showModal();
  }

  // ----------------------------------------------------
  // 3. MẪU SƠ ĐỒ PHÒNG HỌC (PRD §4: ROOM LAYOUT TEMPLATES)
  // ----------------------------------------------------
  function openRoomClassesDialog(templateId) {
    const templates = loadRoomTemplates();
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const catalog = getClassCatalog();
    const classesInRoom = getClassesInRoom(tpl.roomCode, catalog);
    const dlg = $('#room-classes-dialog');
    const titleEl = $('#room-classes-dialog-title');
    const subEl = $('#room-classes-dialog-sub');
    const listEl = $('#room-classes-dialog-list');
    if (!dlg || !listEl) return;

    if (titleEl) titleEl.textContent = `Lớp sử dụng: ${tpl.name} (${tpl.roomCode || 'Mẫu'})`;
    if (subEl) subEl.textContent = `Hiện có ${classesInRoom.length} lớp được xếp lịch học tại phòng này.`;

    if (!classesInRoom.length) {
      listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#6b7d6e; background:#f8fbf8; border:1px dashed #cbd8cd; border-radius:10px; font-size:14px;">Chưa có lớp nào xếp lịch học tại phòng này.</div>`;
    } else {
      const weekdays = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
      listEl.innerHTML = `
        <div class="room-classes-modal-items">
          ${classesInRoom.map(c => `
            <div class="room-schedule-row-item room-schedule-row-fixed">
              <div class="room-schedule-col-left">
                <div class="room-schedule-title-line">
                  <strong class="room-schedule-cls-name">${escapeHtml(c.name || c.code || c.id)}</strong>
                  <span class="room-chip" style="background:#eaf4ed; color:#1f5f33; font-weight:700;">Mã: ${escapeHtml(c.code || c.id)}</span>
                  <span class="room-chip">${escapeHtml(formatBirthYearLabel(c.grade))}</span>
                </div>
                <small class="room-schedule-staff-line">GV: <strong>${escapeHtml(c.teacherName || '—')}</strong> · TA: <strong>${escapeHtml(c.assistantName || '—')}</strong></small>
              </div>
              <div class="room-schedule-col-right">
                <span class="room-chip room-schedule-time-badge">${weekdays[c.weekday] || 'Lịch học'} · ${escapeHtml(c.startTime || '')}–${escapeHtml(c.endTime || '')}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    listEl.querySelectorAll('[data-enter-room-class]').forEach(btn => {
      btn.onclick = () => {
        const clsId = btn.dataset.enterRoomClass;
        dlg.close();
        if (ctx.enterClass) {
          ctx.enterClass(clsId, new Date().toLocaleDateString('sv-SE'));
        }
      };
    });

    dlg.showModal();
  }

  $('#close-room-classes-dialog')?.addEventListener('click', () => $('#room-classes-dialog')?.close());
  $('#close-room-classes-bottom-btn')?.addEventListener('click', () => $('#room-classes-dialog')?.close());

  function renderRoomTemplatesList() {
    const templates = loadRoomTemplates();
    const catalog = getClassCatalog();
    const countEl = $('#management-template-count');
    if (countEl) countEl.textContent = `${templates.length} mẫu phòng`;

    const list = $('#room-template-list');
    if (!list) return;

    list.innerHTML = templates.map(tpl => {
      const aisles = Number(tpl.aisles) || 3;
      const desks = Array.isArray(tpl.desksPerAisle) ? tpl.desksPerAisle : [3, 3, 2];
      const seatsPerDesk = Number(tpl.seatsPerDesk) || 2;
      const totalDesks = desks.reduce((a, b) => a + b, 0);
      const estCapacity = totalDesks * seatsPerDesk;
      const classesInRoom = getClassesInRoom(tpl.roomCode, catalog);
      const equipDesc = (tpl.description || '').trim();

      return `
        <article class="room-template-card room-template-card-compact">
          <!-- 1. Tên phòng + Badge Mã phòng (ở góc trên) -->
          <div class="room-template-card-top">
            <strong class="room-template-title">${escapeHtml(tpl.name)}</strong>
            <span class="room-chip room-code-badge">${escapeHtml(tpl.roomCode || 'Mẫu')}</span>
          </div>

          <!-- 2. 1 câu mô tả/giới thiệu ngắn gọn về phòng (số dãy, số bàn, sức chứa, thiết bị) -->
          <p class="room-template-card-desc">
            <strong>${aisles} dãy · ${totalDesks} bàn (${seatsPerDesk} chỗ/bàn) · Sức chứa ~${estCapacity} HS</strong>${equipDesc ? ` · ${escapeHtml(equipDesc)}` : ''}
          </p>

          <!-- 3. Hình ảnh sơ đồ bàn ghế mini (preview layout của phòng) -->
          <div class="template-layout-preview-wrap" aria-label="Sơ đồ bàn ghế mini của phòng">
            <div class="template-mini-board">BẢNG LỚP</div>
            <div class="template-layout-preview">
              ${desks.map((deskCount, aisleIdx) => {
                const divs = Array.isArray(tpl.aisleDividers?.[aisleIdx])
                  ? tpl.aisleDividers[aisleIdx].map(Number)
                  : (Array.isArray(tpl.dividerAfterDesks) ? tpl.dividerAfterDesks.map(Number) : [2]);
                return `
                  <div class="template-aisle-preview">
                    <span class="template-aisle-mini-label">Dãy ${aisleIdx + 1}</span>
                    ${Array.from({ length: deskCount }, (_, di) => `
                      <div class="template-desk-box" style="${divs.includes(di + 1) && di < deskCount - 1 ? 'border-bottom: 3px solid #1e3a29; margin-bottom: 3px;' : ''}">
                        ${Array.from({ length: Math.min(4, seatsPerDesk) }, () => `<span class="template-seat-dot"></span>`).join('')}
                      </div>
                    `).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 4. Nút thu gọn Xem danh sách lớp sử dụng phòng -->
          <button type="button" class="outline-button room-classes-trigger-btn" data-open-room-classes="${escapeHtml(tpl.id)}">
            <span>Xem các lớp đang sử dụng phòng (<strong>${classesInRoom.length} lớp</strong>)</span>
            <span class="room-classes-arrow">▸</span>
          </button>

          <!-- 5. Nút "Sửa phòng" và "Xóa" đặt gọn ở cuối Card -->
          <div class="room-template-actions room-template-footer-bar">
            <button type="button" class="outline-button" data-edit-template="${escapeHtml(tpl.id)}">Sửa phòng</button>
            <button type="button" class="outline-button text-danger" data-delete-template="${escapeHtml(tpl.id)}">Xóa</button>
          </div>
        </article>
      `;
    }).join('');

    list.querySelectorAll('[data-open-room-classes]').forEach(btn => {
      btn.onclick = () => openRoomClassesDialog(btn.dataset.openRoomClasses);
    });

    list.querySelectorAll('[data-edit-template]').forEach(btn => {
      btn.onclick = () => openRoomTemplateDialog(btn.dataset.editTemplate);
    });

    list.querySelectorAll('[data-delete-template]').forEach(btn => {
      btn.onclick = () => {
        if (!confirm('Bạn có chắc chắn muốn xóa mẫu phòng học này?')) return;
        const updated = loadRoomTemplates().filter(t => t.id !== btn.dataset.deleteTemplate);
        saveRoomTemplates(updated);
        renderRoomTemplatesList();
        toast('Đã xóa mẫu phòng học.');
      };
    });
  }

  let draftRoomTplDesks = [3, 3, 2];
  let draftRoomTplDividers = {};

  function renderRoomTemplateAisleConfig() {
    const host = $('#room-template-aisle-config');
    if (!host) return;
    const count = Math.max(1, Math.min(8, Number($('#room-template-aisles')?.value) || 3));
    while (draftRoomTplDesks.length < count) draftRoomTplDesks.push(3);

    host.innerHTML = Array.from({ length: count }, (_, i) => {
      const deskCount = Math.max(1, Math.min(30, Number(draftRoomTplDesks[i]) || 3));
      draftRoomTplDesks[i] = deskCount;
      draftRoomTplDividers[i] = draftRoomTplDividers[i] || new Set([2].filter(d => d < deskCount));

      const chipsHtml = deskCount > 1
        ? Array.from({ length: deskCount - 1 }, (_, di) => {
            const deskPos = di + 1;
            const isAct = draftRoomTplDividers[i].has(deskPos);
            return `<button type="button" class="aisle-divider-chip ${isAct ? 'active' : ''}" data-tpl-aisle-chip="${i}" data-tpl-div-pos="${deskPos}">━ Giữa bàn ${deskPos} & ${deskPos + 1}</button>`;
          }).join('')
        : '<small style="color:#87968a; font-size:13.5px;">Cần từ 2 bàn trở lên để đặt vạch ngăn cách</small>';

      return `<div class="aisle-config-card">
        <div class="field-label aisle-field" style="margin:0;">
          <span>Số bàn ở dãy ${i + 1}</span>
          <div class="mobile-number-stepper">
            <button type="button" class="stepper-btn" data-tpl-aisle-dec="${i}" aria-label="Giảm số bàn dãy ${i + 1}">-</button>
            <input type="text" inputmode="numeric" pattern="[0-9]*" value="${deskCount}" data-tpl-desk-count="${i}" required />
            <button type="button" class="stepper-btn" data-tpl-aisle-inc="${i}" aria-label="Tăng số bàn dãy ${i + 1}">+</button>
          </div>
        </div>
        <div style="margin-top:6px;">
          <small style="color:#4b6352; font-size:13.5px; font-weight:700;">Vạch ngăn cách bàn (Dãy ${i + 1}):</small>
          <div class="aisle-divider-chips">${chipsHtml}</div>
        </div>
      </div>`;
    }).join('');

    // Sync hidden legacy fields
    if ($('#room-template-desks')) $('#room-template-desks').value = draftRoomTplDesks.slice(0, count).join(', ');

    host.querySelectorAll('[data-tpl-aisle-dec]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.tplAisleDec);
        draftRoomTplDesks[idx] = Math.max(1, (draftRoomTplDesks[idx] || 1) - 1);
        renderRoomTemplateAisleConfig();
      };
    });
    host.querySelectorAll('[data-tpl-aisle-inc]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.tplAisleInc);
        draftRoomTplDesks[idx] = Math.min(30, (draftRoomTplDesks[idx] || 1) + 1);
        renderRoomTemplateAisleConfig();
      };
    });
    host.querySelectorAll('[data-tpl-desk-count]').forEach(inp => {
      inp.onchange = () => {
        const idx = Number(inp.dataset.tplDeskCount);
        const val = Number(String(inp.value || '').replace(/[^0-9]/g, '')) || 3;
        draftRoomTplDesks[idx] = Math.max(1, Math.min(30, val));
        renderRoomTemplateAisleConfig();
      };
    });
    host.querySelectorAll('[data-tpl-aisle-chip]').forEach(chip => {
      chip.onclick = () => {
        const aIdx = Number(chip.dataset.tplAisleChip);
        const pos = Number(chip.dataset.tplDivPos);
        draftRoomTplDividers[aIdx] = draftRoomTplDividers[aIdx] || new Set();
        if (draftRoomTplDividers[aIdx].has(pos)) draftRoomTplDividers[aIdx].delete(pos);
        else draftRoomTplDividers[aIdx].add(pos);
        chip.classList.toggle('active', draftRoomTplDividers[aIdx].has(pos));
      };
    });
  }

  $('#room-template-aisles')?.addEventListener('input', renderRoomTemplateAisleConfig);
  $('#room-template-aisles')?.addEventListener('change', renderRoomTemplateAisleConfig);

  function openRoomTemplateDialog(editId = null) {
    const dialog = $('#room-template-dialog');
    if (!dialog) return;

    draftRoomTplDividers = {};
    if (editId) {
      const tpl = loadRoomTemplates().find(t => t.id === editId);
      if (!tpl) return;
      $('#room-template-dialog-title').textContent = 'Chỉnh sửa phòng học & sơ đồ';
      $('#room-template-id').value = tpl.id;
      $('#room-template-name').value = tpl.name;
      $('#room-template-code').value = tpl.roomCode || '';
      $('#room-template-seats').value = tpl.seatsPerDesk || 2;
      const aislesCount = Number(tpl.aisles) || (Array.isArray(tpl.desksPerAisle) ? tpl.desksPerAisle.length : 3);
      $('#room-template-aisles').value = aislesCount;
      draftRoomTplDesks = Array.isArray(tpl.desksPerAisle) ? [...tpl.desksPerAisle] : Array.from({ length: aislesCount }, () => 3);
      for (let i = 0; i < aislesCount; i++) {
        const rowDivs = Array.isArray(tpl.aisleDividers?.[i])
          ? tpl.aisleDividers[i]
          : (Array.isArray(tpl.dividerAfterDesks) ? tpl.dividerAfterDesks : [2]);
        draftRoomTplDividers[i] = new Set(rowDivs.map(Number).filter(n => n > 0));
      }
      $('#room-template-desc').value = tpl.description || '';
    } else {
      $('#room-template-dialog-title').textContent = 'Thêm phòng học mới';
      $('#room-template-id').value = '';
      $('#room-template-name').value = '';
      $('#room-template-code').value = '';
      $('#room-template-seats').value = '2';
      $('#room-template-aisles').value = '3';
      draftRoomTplDesks = [3, 3, 2];
      draftRoomTplDividers = { 0: new Set([2]), 1: new Set([2]), 2: new Set([1]) };
      $('#room-template-desc').value = '';
    }

    renderRoomTemplateAisleConfig();
    dialog.showModal();
  }

  function populateRoomTemplateDropdowns() {
    const templates = loadRoomTemplates();
    const configSelect = $('#config-room-template-select');
    if (configSelect) {
      configSelect.innerHTML = templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.roomCode ? `${t.roomCode} · ${t.name}` : t.name)} (${t.aisles} dãy · ${(t.desksPerAisle || []).join('-')} bàn)</option>`).join('');
    }

    const applySelect = $('#apply-room-template-select');
    if (applySelect) {
      applySelect.innerHTML = `<option value="">-- Chọn phòng học để áp dụng nhanh --</option>` +
        templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.roomCode ? `${t.roomCode} · ${t.name}` : t.name)}</option>`).join('');
    }
  }

  // ----------------------------------------------------
  // 4. QUẢN LÝ DANH SÁCH LỚP GỐC (ROSTERS) & IMPORT EXCEL (PRD §4 & §9)
  // ----------------------------------------------------
  function openRosterAdmin(classId) {
    activeRosterClassId = classId;
    const catalog = getClassCatalog();
    const classInfo = catalog.find(c => c.id === classId) || catalog[0];
    const dialog = $('#roster-admin-dialog');
    if (!dialog || !classInfo) return;

    $('#roster-admin-class-name').textContent = (classInfo.code || classInfo.name);
    $('#roster-add-form').hidden = true;

    renderRosterAdminTable(classId);
    dialog.showModal();
  }

  function renderRosterAdminTable(classId) {
    const allStudents = getStudents();
    const roster = allStudents.filter(s => Array.isArray(s.classIds) && s.classIds.includes(classId));
    $('#roster-admin-count').textContent = `${roster.length} học sinh cố định`;

    const tbody = $('#roster-table-tbody');
    if (!tbody) return;

    if (!roster.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:18px; color:#8d9b90;">Lớp chưa có học sinh trong danh sách gốc. Bấm "Thêm học sinh" hoặc "Nhập từ Excel / Google Sheets".</td></tr>`;
      return;
    }

    tbody.innerHTML = roster.map((s) => {
      const parts = splitVietnameseName(s.name);
      const fam = s.familyName ?? parts.familyName;
      const giv = s.givenName ?? parts.givenName;
      return `
        <tr>
          <td>${escapeHtml(fam || '—')}</td>
          <td><strong>${escapeHtml(giv || s.name)}</strong> ${renderStudentTagsBadges(s)}</td>
          <td>${escapeHtml(s.studentCode || '—')}</td>
          <td>${escapeHtml(s.school || '—')}</td>
          <td>${escapeHtml(s.parentContact?.name || '—')}</td>
          <td>${escapeHtml(s.parentContact?.phone || '—')}</td>
          <td>
            <button type="button" class="text-danger" data-remove-from-roster="${escapeHtml(s.id)}" style="font-size:13.5px; padding:7px 12px;">Bỏ khỏi lớp</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-remove-from-roster]').forEach(btn => {
      btn.onclick = () => {
        const studentId = btn.dataset.removeFromRoster;
        const student = studentById(studentId);
        if (!student) return;
        if (!confirm(`Xác nhận bỏ ${student.name} khỏi danh sách lớp gốc này?`)) return;
        student.classIds = (student.classIds || []).filter(id => id !== classId);
        saveStudentRecords(getStudents(), ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
        renderRosterAdminTable(classId);
        renderMainMenu();
        render();
        toast(`Đã bỏ ${student.name} khỏi danh sách lớp.`);
      };
    });
  }

  // ----------------------------------------------------
  // 5. CHỐT SĨ SỐ CA HỌC & RÀ SOÁT VẮNG MẶT (PRD §5 TAB 3)
  // ----------------------------------------------------
  function handleFinalizeAttendance() {
    const occupants = allEntries();
    const pending = occupants.filter(x => !x.entry.studentId || !(x.entry.attendance || studentById(x.entry.studentId)?.attendance));
    if (pending.length) {
      toast(`${pending.length} chỗ ngồi chưa ghi tên hoặc chưa điểm danh.`);
      return;
    }

    const currentClass = getActiveClassConfig();
    const roster = [...classStudents(), ...(ctx.getMakeupStudents ? ctx.getMakeupStudents().filter(m => m.attendingClassId === currentClass.id) : [])];
    const assignedIdsSet = new Set(occupants.map(x => x.entry.studentId).filter(Boolean));
    const lateQueueList = getLateQueue();

    // Identify absent students: in roster but neither in seat nor in lateQueue
    const absentStudents = roster.filter(s => !assignedIdsSet.has(s.id) && !lateQueueList.includes(s.id));

    const dialog = $('#finalize-dialog');
    if (!dialog) return;

    $('#fin-stat-total').textContent = roster.length;
    $('#fin-stat-present').textContent = assignedIdsSet.size;
    $('#fin-stat-late').textContent = lateQueueList.length;
    $('#fin-stat-absent').textContent = absentStudents.length;

    const listContainer = $('#finalize-absent-list');
    if (absentStudents.length > 0) {
      $('#finalize-absent-section').hidden = false;
      listContainer.innerHTML = absentStudents.map(s => `
        <div class="absent-student-row" data-absent-id="${escapeHtml(s.id)}">
          <div>
            <strong>${escapeHtml(s.name)}</strong>
            <small>${escapeHtml(s.school || 'Học sinh chính khóa')}</small>
          </div>
          <select class="absent-type-select">
            <option value="absent_excused">Vắng có phép</option>
            <option value="absent_unexcused">Vắng không phép</option>
          </select>
          <input class="absent-reason-input" placeholder="Lý do vắng (ốm, bận việc...)" />
        </div>
      `).join('');
    } else {
      $('#finalize-absent-section').hidden = true;
      listContainer.innerHTML = '';
    }

    dialog.showModal();
  }

  function confirmFinalizeAttendance() {
    const currentClass = getActiveClassConfig();
    const date = getChecklistDate();
    const occupants = allEntries();
    const lateQueueList = getLateQueue();
    const rows = document.querySelectorAll('.absent-student-row');

    let excusedCount = 0;
    let unexcusedCount = 0;

    rows.forEach(row => {
      const studentId = row.dataset.absentId;
      const type = row.querySelector('.absent-type-select').value;
      const reason = row.querySelector('.absent-reason-input').value.trim() || (type === 'absent_excused' ? 'Có phép' : 'Không phép');
      const student = studentById(studentId);
      if (!student) return;

      if (type === 'absent_excused') excusedCount++;
      else unexcusedCount++;

      const attRecord = {
        classId: currentClass.id,
        date,
        timestamp: Date.now(),
        status: type,
        reason,
        homework: { status: 'uncollected' }
      };

      student.attendance = { status: type, reason };
      student.attendanceHistory = student.attendanceHistory || [];
      const existingAttIdx = student.attendanceHistory.findIndex(h => h.classId === currentClass.id && h.date === date);
      if (existingAttIdx >= 0) student.attendanceHistory[existingAttIdx] = attRecord;
      else student.attendanceHistory.unshift(attRecord);
      student.attendanceHistory = student.attendanceHistory.slice(0, 60);
      student.history = student.attendanceHistory;
    });

    const finalizedData = {
      finalizedAt: Date.now(),
      presentCount: occupants.length,
      lateCount: lateQueueList.length,
      absentCount: rows.length,
      excusedCount,
      unexcusedCount
    };

    localStorage.setItem(`lopvui.finalized-session.v1.${currentClass.id}.${date}`, JSON.stringify(finalizedData));
    if (ctx.syncLiveSessionData) ctx.syncLiveSessionData();
    saveStudentRecords(getStudents(), ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);

    const activityMsg = `Chốt sĩ số ${currentClass.name}: ${occupants.length} có mặt, ${lateQueueList.length} đi muộn, ${rows.length} vắng mặt (${excusedCount} có phép, ${unexcusedCount} không phép)`;
    addClassActivity(activityMsg, 'attendance');
    createClassNotification(
      'Chốt sĩ số thành công',
      activityMsg,
      'attendance'
    );

    const badge = $('#finalized-indicator-badge');
    if (badge) badge.hidden = false;

    $('#finalize-dialog').close();
    toast(`✓ Đã chốt sĩ số: ${occupants.length} có mặt, ${rows.length} vắng mặt.`);
    render();
  }

  // ----------------------------------------------------
  // 6. TỰ ĐỘNG TÍNH SỐ PHÚT ĐI MUỘN (PRD §5 TAB 3)
  // ----------------------------------------------------
  function updateLateMinutesCalculation() {
    const currentClass = getActiveClassConfig();
    const startTimeStr = currentClass?.startTime || '15:30';
    const arrivalTimeStr = $('#arrival-time')?.value || new Date().toTimeString().slice(0, 5);

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [arrH, arrM] = arrivalTimeStr.split(':').map(Number);

    const startTotal = startH * 60 + startM;
    const arrTotal = arrH * 60 + arrM;
    const diff = arrTotal - startTotal;

    const startLabel = $('#late-class-start-label');
    const arrLabel = $('#late-arrival-display');
    const badge = $('#late-minutes-badge');

    if (startLabel) startLabel.textContent = startTimeStr;
    if (arrLabel) arrLabel.textContent = arrivalTimeStr;

    if (badge) {
      if (diff > 0) {
        badge.textContent = `Đi muộn ${diff} phút`;
        badge.style.background = '#ffecd4';
        badge.style.color = '#ab5d18';
      } else {
        badge.textContent = `Đến đúng giờ (0 phút)`;
        badge.style.background = '#eaf5ec';
        badge.style.color = '#386f4a';
      }
    }

    return Math.max(0, diff);
  }

  // ----------------------------------------------------
  // 7. TRUNG TÂM BÁO CÁO BUỔI HỌC & XUẤT FILE A4 / CSV (PRD §9)
  // ----------------------------------------------------
  function renderReportCenter(tabName = 'a4-roster') {
    currentReportTab = tabName;
    document.querySelectorAll('.report-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.reportTab === tabName);
    });

    const currentClass = getActiveClassConfig();
    const date = getChecklistDate();
    const byAlpha = (a, b) => {
      const aGiven = a.givenName || splitVietnameseName(a.name).givenName;
      const bGiven = b.givenName || splitVietnameseName(b.name).givenName;
      const aFamily = a.familyName || splitVietnameseName(a.name).familyName;
      const bFamily = b.familyName || splitVietnameseName(b.name).familyName;
      return aGiven.localeCompare(bGiven, 'vi') || aFamily.localeCompare(bFamily, 'vi');
    };
    const entries = allEntries();
    const lateQueueIds = getLateQueue();
    const regularRoster = [...classStudents()].sort(byAlpha);
    const allMakeups = ctx.getMakeupStudents ? ctx.getMakeupStudents() : [];
    const sessionMakeups = allMakeups.filter(m =>
      m.attendingClassId === currentClass.id ||
      entries.some(e => e.entry.studentId === m.id) ||
      lateQueueIds.includes(m.id)
    ).sort(byAlpha);

    // Combined list with makeup students placed at the bottom
    const roster = [...regularRoster, ...sessionMakeups];
    const container = $('#attendance-export-content');
    if (!container) return;

    const getFamGiv = (s) => {
      const parts = splitVietnameseName(s.name);
      return {
        fam: s.familyName ?? parts.familyName,
        giv: s.givenName ?? parts.givenName,
        isMakeup: s.studentType === 'makeup' || !(s.classIds || []).includes(currentClass.id)
      };
    };

    if (tabName === 'teacher-summary') {
      const presentCount = entries.filter(e => e.entry.studentId && e.entry.attendance?.status === 'present').length;
      const lateList = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        return lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late';
      });
      const absentList = regularRoster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        const inLate = lateQueueIds.includes(s.id);
        return !seated && !inLate;
      });
      const missingHW = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        const status = seated?.entry.homework?.status || s.homework?.status;
        return status === 'not_submitted';
      });
      const lowScores = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        const hwScore = seated?.entry.homework?.score ?? s.homework?.score;
        const testScore = s.testScore ?? seated?.entry.testScore;
        const lowest = Math.min(...[hwScore, testScore].filter(x => x !== null && x !== undefined));
        return lowest < 7.0 && lowest >= 0;
      });
      const lessonTitle = $('#lesson-title')?.value.trim() || 'Bài học hôm nay';
      const sessionNote = $('#session-note')?.value.trim() || '';

      container.innerHTML = `
        <div class="attendance-report-heading" style="background:#f8faf8; border:1px solid #dce5dd; border-radius:8px; padding:12px 14px; margin-bottom:12px;">
          <div>
            <strong style="font-size:13px; color:#21442a;">BÁO CÁO TỔNG HỢP CA HỌC GỬI GIÁO VIÊN</strong>
            <div style="font-size:14.5px; margin-top:3px;">Lớp: <strong>${escapeHtml(currentClass.name)} (${currentClass.code || currentClass.id})</strong> · ${escapeHtml(formatBirthYearLabel(currentClass.grade))} · Phòng: <strong>${escapeHtml(currentClass.room)}</strong></div>
            <div style="font-size:14px; color:#526456;">Bài dạy: <strong>${escapeHtml(lessonTitle)}</strong></div>
          </div>
          <div style="text-align:right; font-size:14px;">
            <div>Ngày: <strong>${escapeHtml(date)}</strong> (${escapeHtml(currentClass.startTime)}–${escapeHtml(currentClass.endTime)})</div>
            <div>GV: <strong>${escapeHtml(currentClass.teacherName)}</strong> · TA: <strong>${escapeHtml(currentClass.assistantName)}</strong></div>
          </div>
        </div>

        <div class="class-metrics-summary" style="margin-bottom:14px;">
          <div class="class-metric-box">
            <span>Tổng sĩ số</span>
            <strong>${regularRoster.length}${sessionMakeups.length ? ` (+${sessionMakeups.length} bù)` : ''}</strong>
            <small style="color:#667;">học sinh trong ca</small>
          </div>
          <div class="class-metric-box">
            <span>Có mặt</span>
            <strong style="color:#2e6d42;">${presentCount}</strong>
            <small style="color:#667;">đúng giờ</small>
          </div>
          <div class="class-metric-box">
            <span>Đi muộn</span>
            <strong style="color:#bc7b26;">${lateList.length}</strong>
            <small style="color:#667;">học sinh</small>
          </div>
          <div class="class-metric-box">
            <span>Vắng mặt</span>
            <strong style="color:#c13b30;">${absentList.length}</strong>
            <small style="color:#667;">học sinh</small>
          </div>
        </div>

        <div style="display:grid; gap:12px;">
          <div style="background:#fff; border:1px solid #fecaca; border-radius:8px; padding:12px;">
            <strong style="color:#991b1b; font-size:14.5px;">× 1. Học sinh KHÔNG nộp bài tập về nhà (${missingHW.length} bạn):</strong>
            ${missingHW.length ? `
              <table class="attendance-report-table" style="font-size:14px; margin-top:8px;">
                <thead>
                  <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Lý do không nộp</th><th>SĐT Phụ huynh</th></tr>
                </thead>
                <tbody>
                  ${missingHW.map((s) => {
                    const { fam, giv, isMakeup } = getFamGiv(s);
                    const seated = entries.find(p => p.entry.studentId === s.id);
                    const reasonMap = { not_done: 'Chưa làm bài', forgot: 'Quên mang vở', missed_previous: 'Nghỉ buổi trước' };
                    const reason = reasonMap[seated?.entry.homework?.reason] || seated?.entry.homework?.reason || 'Chưa làm';
                    return `<tr class="${isMakeup ? 'makeup-row-tr' : ''}"><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td><td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'—'))}</td><td style="color:#b91c1c; font-weight:700;">${escapeHtml(reason)}</td><td>${escapeHtml(s.parentContact?.phone||'—')}</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            ` : '<div style="color:#15803d; font-size:14px; font-weight:600; margin-top:6px;">✓ 100% học sinh có mặt đã nộp bài tập về nhà đầy đủ!</div>'}
          </div>

          <div style="background:#fff; border:1px solid #fed7aa; border-radius:8px; padding:12px;">
            <strong style="color:#9a3412; font-size:14.5px;"> 2. Học sinh ĐI MUỘN (${lateList.length} bạn):</strong>
            ${lateList.length ? `
              <table class="attendance-report-table" style="font-size:14px; margin-top:8px;">
                <thead>
                  <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Giờ đến lớp</th><th>Số phút muộn</th><th>SĐT Phụ huynh</th></tr>
                </thead>
                <tbody>
                  ${lateList.map((s) => {
                    const { fam, giv, isMakeup } = getFamGiv(s);
                    return `<tr class="${isMakeup ? 'makeup-row-tr' : ''}"><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td><td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'—'))}</td><td>${escapeHtml(s.arrivalTime||'—')}</td><td style="color:#c2410c; font-weight:700;">${entries.find(p => p.entry.studentId === s.id)?.entry.attendance?.lateMinutes || entries.find(p => p.entry.studentId === s.id)?.entry.attendance?.minutesLate || s.attendance?.lateMinutes || s.lateMinutes || 10} phút</td><td>${escapeHtml(s.parentContact?.phone||'—')}</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            ` : '<div style="color:#15803d; font-size:14px; font-weight:600; margin-top:6px;">✓ Không có học sinh nào đi muộn trong ca hôm nay!</div>'}
          </div>

          <div style="background:#fff; border:1px solid #fde047; border-radius:8px; padding:12px;">
            <strong style="color:#854d0e; font-size:14.5px;">!️ 3. Học sinh CÓ ĐIỂM THẤP (< 7.0 điểm) (${lowScores.length} bạn):</strong>
            ${lowScores.length ? `
              <table class="attendance-report-table" style="font-size:14px; margin-top:8px;">
                <thead>
                  <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Điểm BTVN</th><th>Điểm Test</th><th>Ghi chú</th></tr>
                </thead>
                <tbody>
                  ${lowScores.map((s) => {
                    const { fam, giv, isMakeup } = getFamGiv(s);
                    const seated = entries.find(p => p.entry.studentId === s.id);
                    const hwScore = seated?.entry.homework?.score ?? s.homework?.score ?? '—';
                    const testScore = s.testScore ?? seated?.entry.testScore ?? '—';
                    return `<tr class="${isMakeup ? 'makeup-row-tr' : ''}"><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td><td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'—'))}</td><td style="color:#b45309; font-weight:700;">${hwScore}</td><td style="color:#b45309; font-weight:700;">${testScore}</td><td>${escapeHtml((ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : s.sessionNote) || 'Cần bám sát')}</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            ` : '<div style="color:#15803d; font-size:14px; font-weight:600; margin-top:6px;">✓ Không có học sinh nào có điểm dưới 7.0!</div>'}
          </div>

          <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
            <strong style="color:#374151; font-size:14.5px;"> 4. Học sinh VẮNG MẶT (${absentList.length} bạn):</strong>
            ${absentList.length ? `
              <table class="attendance-report-table" style="font-size:14px; margin-top:8px;">
                <thead>
                  <tr><th>Họ đệm</th><th>Tên</th><th>Trường</th><th>Trạng thái vắng</th><th>Lý do</th><th>SĐT Phụ huynh</th></tr>
                </thead>
                <tbody>
                  ${absentList.map((s) => {
                    const { fam, giv } = getFamGiv(s);
                    return `<tr><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong></td><td>${escapeHtml(s.school||'—')}</td><td>${s.attendance?.status === 'absent_excused' ? 'Có phép' : 'Chưa phép'}</td><td>${escapeHtml(s.attendance?.reason||'Chưa có lý do')}</td><td>${escapeHtml(s.parentContact?.phone||'—')}</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            ` : '<div style="color:#15803d; font-size:14px; font-weight:600; margin-top:6px;">✓ 100% học sinh đều có mặt!</div>'}
          </div>

          ${sessionMakeups.length ? `
            <div style="background:#fcfaff; border:1px solid #d8b4fe; border-radius:8px; padding:12px;">
              <strong style="color:#6b21a8; font-size:14.5px;"> 5. Học sinh HỌC BÙ trong buổi (${sessionMakeups.length} bạn):</strong>
              <table class="attendance-report-table" style="font-size:14px; margin-top:8px;">
                <thead>
                  <tr><th>Họ đệm</th><th>Tên</th><th>Mã HS</th><th>Học bù từ lớp</th><th>Trạng thái</th><th>Điểm BTVN / Test</th><th>Ghi chú</th></tr>
                </thead>
                <tbody>
                  ${sessionMakeups.map((s) => {
                    const { fam, giv } = getFamGiv(s);
                    const seated = entries.find(p => p.entry.studentId === s.id);
                    const isLate = lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late';
                    const isPresent = Boolean(seated);
                    const stLabel = isLate ? 'Học bù (Đi muộn)' : isPresent ? 'Học bù (Có mặt)' : 'Học bù (Chưa vào bàn)';
                    const hwScore = seated?.entry.homework?.score ?? s.homework?.score ?? '—';
                    const testScore = s.testScore ?? seated?.entry.testScore ?? '—';
                    return `<tr class="makeup-row-tr"><td>${escapeHtml(fam)}</td><td><strong style="color:#581c87;">${escapeHtml(giv)}</strong> <span class="makeup-status-badge"> Học bù</span></td><td>${escapeHtml(s.studentCode||'—')}</td><td>${escapeHtml(s.sourceClassName||'Lớp khác')}</td><td><strong>${stLabel}</strong></td><td>BTVN: ${hwScore} · Test: ${testScore}</td><td>${escapeHtml((ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : s.sessionNote) || '')}</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${sessionNote ? `
            <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:10px 14px; border-radius:6px; font-size:14px; color:#166534;">
              <strong> Nhận xét & Lưu ý của Trợ giảng trong ca:</strong>
              <p style="margin:4px 0 0; white-space:pre-wrap;">${escapeHtml(sessionNote)}</p>
            </div>
          ` : ''}
        </div>
      `;
    } else if (tabName === 'a4-roster') {
      // Standard printable A4 attendance sheet (No STT, Split Họ đệm & Tên, Makeup students at the bottom)
      container.innerHTML = `
        <div class="attendance-report-heading">
          <div>
            <strong>TRUNG TÂM HỌC TẬP - BẢNG ĐIỂM DANH & THEO DÕI CA HỌC</strong>
            <div>Lớp: <strong>${escapeHtml(currentClass.name)}</strong> (${escapeHtml(formatBirthYearLabel(currentClass.grade))}) · Phòng: ${escapeHtml(currentClass.room)} · Môn: ${escapeHtml(currentClass.subject)}</div>
          </div>
          <div style="text-align:right;">
            <div>Ngày: <strong>${escapeHtml(date)}</strong> · Giờ: ${escapeHtml(currentClass.startTime)}–${escapeHtml(currentClass.endTime)}</div>
            <div>Giáo viên: <strong>${escapeHtml(currentClass.teacherName)}</strong> · TA: <strong>${escapeHtml(currentClass.assistantName)}</strong></div>
          </div>
        </div>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr>
                <th>Họ đệm</th>
                <th>Tên</th>
                <th>Mã HS</th>
                <th>Trường / Phân loại</th>
                <th>Điểm danh</th>
                <th>Giờ đến</th>
                <th>BTVN</th>
                <th>Điểm BTVN</th>
                <th>Điểm Test</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${roster.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                const isLate = lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late';
                const isPresent = Boolean(seated);
                const baseAttStatus = isLate ? 'Đi muộn' : isPresent ? 'Có mặt' : (s.attendance?.status === 'absent_excused' ? 'Vắng có phép' : s.attendance?.status === 'absent_unexcused' ? 'Vắng K.phép' : 'Chưa điểm danh');
                const attStatus = isMakeup ? `Học bù (${baseAttStatus})` : baseAttStatus;
                const hwStatus = homeworkLabel(seated?.entry.homework?.status || s.homework?.status);
                const hwScore = seated?.entry.homework?.score ?? s.homework?.score ?? '';
                const testScore = seated?.entry.testScore ?? s.testScore ?? '';
                const schoolText = isMakeup ? `Học bù từ: ${s.sourceClassName || s.school || 'Lớp khác'}` : (s.school || '');
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong style="color:${isMakeup ? '#581c87' : 'inherit'};">${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td>
                    <td>${escapeHtml(s.studentCode || '—')}</td>
                    <td>${escapeHtml(schoolText)}</td>
                    <td><span class="student-state ${isPresent ? (isLate ? 'state-late' : 'state-present') : 'state-missing'}">${escapeHtml(attStatus)}</span></td>
                    <td>${escapeHtml(s.arrivalTime || (isLate ? 'Đi muộn' : isPresent ? 'Đúng giờ' : '—'))}</td>
                    <td>${escapeHtml(hwStatus)}</td>
                    <td style="text-align:center;">${escapeHtml(hwScore)}</td>
                    <td style="text-align:center;">${escapeHtml(testScore)}</td>
                    <td>${escapeHtml((ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : s.sessionNote) || '')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:24px; padding:0 30px; font-size:14px; color:#506256;">
          <div style="text-align:center;">
            <strong>Chữ ký Trợ giảng</strong><br><br><br>
            <span>${escapeHtml(currentClass.assistantName)}</span>
          </div>
          <div style="text-align:center;">
            <strong>Chữ ký Giáo viên phụ trách</strong><br><br><br>
            <span>${escapeHtml(currentClass.teacherName)}</span>
          </div>
        </div>
      `;
    } else if (tabName === 'missing-hw') {
      const missingHW = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        const status = seated?.entry.homework?.status || s.homework?.status;
        return status === 'not_submitted';
      });

      container.innerHTML = `
        <h3>Danh sách học sinh KHÔNG nộp bài tập về nhà (${missingHW.length} bạn)</h3>
        <p class="dialog-hint">Danh sách tự động lọc các học sinh chưa hoàn thành BTVN kèm lý do và ghi chú để gửi phụ huynh hoặc nhắc nhở buổi sau.</p>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Lý do không nộp</th><th>SĐT Phụ huynh</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${missingHW.length ? missingHW.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                const reasonMap = { not_done: 'Chưa làm bài', forgot: 'Quên mang vở', missed_previous: 'Nghỉ buổi trước' };
                const reason = reasonMap[seated?.entry.homework?.reason] || seated?.entry.homework?.reason || 'Chưa làm';
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td>
                    <td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school || '—'))}</td>
                    <td><strong class="text-danger">${escapeHtml(reason)}</strong></td>
                    <td>${escapeHtml(s.parentContact?.phone || '—')}</td>
                    <td>${escapeHtml(seated?.entry.homework?.note || '—')}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#497955;">Tuyệt vời! Tất cả học sinh có mặt đều đã nộp BTVN.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'late-students') {
      const lateList = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        return lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late';
      });

      container.innerHTML = `
        <h3>Danh sách học sinh ĐI MUỘN (${lateList.length} bạn)</h3>
        <p class="dialog-hint">Thời gian đến lớp và số phút muộn so với giờ bắt đầu ca học (${currentClass.startTime}).</p>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Giờ đến lớp</th><th>Số phút đi muộn</th><th>SĐT Phụ huynh</th></tr>
            </thead>
            <tbody>
              ${lateList.length ? lateList.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td>
                    <td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school || '—'))}</td>
                    <td>${escapeHtml(s.arrivalTime || '—')}</td>
                    <td><strong style="color:#ab5d18;">${s.attendance?.lateMinutes ? `Muộn ${s.attendance.lateMinutes} phút` : 'Đến muộn'}</strong></td>
                    <td>${escapeHtml(s.parentContact?.phone || '—')}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#497955;">Không có học sinh nào đi muộn trong ca học này.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'absent-students') {
      const absentList = regularRoster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        const inLate = lateQueueIds.includes(s.id);
        return !seated && !inLate;
      });

      container.innerHTML = `
        <h3>Danh sách học sinh VẮNG MẶT (${absentList.length} bạn)</h3>
        <p class="dialog-hint">Đối chiếu sĩ số lớp gốc để liên hệ phụ huynh và sắp xếp ca học bù kịp thời.</p>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường</th><th>Trạng thái vắng</th><th>Lý do vắng</th><th>SĐT Phụ huynh</th></tr>
            </thead>
            <tbody>
              ${absentList.length ? absentList.map((s) => {
                const { fam, giv } = getFamGiv(s);
                const isExcused = s.attendance?.status === 'absent_excused';
                return `
                  <tr>
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong></td>
                    <td>${escapeHtml(s.school || '—')}</td>
                    <td><span class="student-state ${isExcused ? 'state-late' : 'state-missing'}">${isExcused ? 'Có phép' : 'Không phép'}</span></td>
                    <td>${escapeHtml(s.attendance?.reason || 'Chưa ghi nhận')}</td>
                    <td>${escapeHtml(s.parentContact?.phone || '—')}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#497955;">100% học sinh đã có mặt tại lớp!</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'tests-handover') {
      container.innerHTML = `
        <h3>Biên bản thu bài kiểm tra cuối giờ & Bàn giao bài chấm</h3>
        <div class="attendance-report-heading">
          <div>
            <strong>Xác nhận bàn giao bài chấm:</strong>
            <div>Người mang bài về chấm: <strong>${escapeHtml($('#handover-person')?.value || 'Chưa xác nhận')}</strong></div>
          </div>
          <div style="text-align:right;">
            <div>Ngày bàn giao: <strong>${escapeHtml(date)}</strong></div>
            <div>Trạng thái: <strong>${escapeHtml($('#handover-status')?.textContent || 'Chưa bàn giao')}</strong></div>
          </div>
        </div>
        <p class="dialog-hint">Danh sách học sinh nộp bài test cuối giờ của buổi học (Học bù xếp ở cuối):</p>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Trạng thái bài test</th><th>Điểm số</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${roster.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge"> Học bù</span>' : ''}</td>
                    <td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school || '—'))}</td>
                    <td><span class="student-state ${seated ? 'state-collected' : 'state-pending'}">${seated ? 'Đã thu bài test' : 'Vắng mặt'}</span></td>
                    <td style="text-align:center;">${escapeHtml(seated?.entry.testScore ?? s.testScore ?? '—')}</td>
                    <td>${escapeHtml(s.testNote || '')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  function exportReportAsCsv() {
    const currentClass = getActiveClassConfig();
    const date = getChecklistDate();
    const byAlpha = (a, b) => {
      const aGiven = a.givenName || splitVietnameseName(a.name).givenName;
      const bGiven = b.givenName || splitVietnameseName(b.name).givenName;
      const aFamily = a.familyName || splitVietnameseName(a.name).familyName;
      const bFamily = b.familyName || splitVietnameseName(b.name).familyName;
      return aGiven.localeCompare(bGiven, 'vi') || aFamily.localeCompare(bFamily, 'vi');
    };
    const entries = allEntries();
    const lateQueueIds = getLateQueue();
    const regularRoster = [...classStudents()].sort(byAlpha);
    const allMakeups = ctx.getMakeupStudents ? ctx.getMakeupStudents() : [];
    const sessionMakeups = allMakeups.filter(m =>
      m.attendingClassId === currentClass.id ||
      entries.some(e => e.entry.studentId === m.id) ||
      lateQueueIds.includes(m.id)
    ).sort(byAlpha);
    const roster = [...regularRoster, ...sessionMakeups];

    const headers = ['Họ đệm', 'Tên', 'Mã HS', 'Trường / Lớp gốc', 'Phân loại', 'Điểm danh', 'Giờ đến', 'Trạng thái BTVN', 'Điểm BTVN', 'Điểm Test', 'SĐT Phụ huynh', 'Ghi chú'];
    const rows = roster.map((s) => {
      const seated = entries.find(p => p.entry.studentId === s.id);
      const isLate = lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late';
      const isPresent = Boolean(seated);
      const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(currentClass.id);
      const baseAtt = isLate ? 'Đi muộn' : isPresent ? 'Có mặt' : (s.attendance?.status === 'absent_excused' ? 'Vắng có phép' : s.attendance?.status === 'absent_unexcused' ? 'Vắng không phép' : 'Chưa điểm danh');
      const att = isMakeup ? `Học bù (${baseAtt})` : baseAtt;
      const hw = homeworkLabel(seated?.entry.homework?.status || s.homework?.status);
      const hwScore = seated?.entry.homework?.score ?? s.homework?.score ?? '';
      const testScore = seated?.entry.testScore ?? s.testScore ?? '';
      const fam = s.familyName || splitVietnameseName(s.name).familyName;
      const giv = s.givenName || splitVietnameseName(s.name).givenName;
      return [
        fam,
        giv,
        s.studentCode || '',
        isMakeup ? (s.sourceClassName || s.school || '') : (s.school || ''),
        isMakeup ? 'Học bù' : 'Chính thức',
        att,
        s.arrivalTime || (isLate ? 'Đi muộn' : isPresent ? 'Đúng giờ' : ''),
        hw,
        hwScore,
        testScore,
        s.parentContact?.phone || '',
        (ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : s.sessionNote) || ''
      ];
    });

    const fileName = `DiemDanh_${(currentClass.code || currentClass.name).replace(/\s+/g, '_')}_${date}.csv`;
    exportToCsv(headers, rows, fileName);
    toast(`Đã tải về file Excel (gồm cả Học bù ở cuối danh sách): ${fileName}`);
  }

  // ----------------------------------------------------
  // 8. TRANG CÁ NHÂN TRỢ GIẢNG & CHẤM CÔNG (PRD §10: TA PORTAL)
  // ----------------------------------------------------
  function renderTAPortal() {
    const account = getSignedInAccount();
    const master = getMasterData();
    const emp = master.employees.find(e => e.id === account.employeeId) || {
      name: 'Anh Linh',
      code: 'TA001',
      role: 'assistant'
    };

    const monthInput = $('#portal-month-input');
    const monthVnSelect = $('#portal-month-vn-select');
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (monthInput && !monthInput.value) {
      monthInput.value = currentMonthStr;
    }
    if (monthVnSelect && !monthVnSelect.options.length) {
      const monthOpts = [];
      for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
        for (let m = 1; m <= 12; m++) {
          const val = `${y}-${String(m).padStart(2, '0')}`;
          const label = `Tháng ${String(m).padStart(2, '0')}/${y}`;
          monthOpts.push(`<option value="${val}">${label}</option>`);
        }
      }
      monthVnSelect.innerHTML = monthOpts.join('');
      monthVnSelect.value = monthInput?.value || currentMonthStr;
      monthVnSelect.addEventListener('change', () => {
        if (monthInput) monthInput.value = monthVnSelect.value;
        renderTAPortal();
      });
    }
    if (monthVnSelect && monthInput && monthVnSelect.value !== monthInput.value && monthInput.value) {
      monthVnSelect.value = monthInput.value;
    }
    const selectedMonth = monthVnSelect?.value || monthInput?.value || currentMonthStr;
    if (monthInput) monthInput.value = selectedMonth;

    // Profile card
    const nameParts = emp.name.split(' ').filter(Boolean);
    const initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts.at(-1)[0]).toUpperCase() : emp.name.slice(0, 2).toUpperCase();
        if ($('#portal-name')) $('#portal-name').textContent = emp.name;
    if ($('#portal-code-role')) $('#portal-code-role').textContent = `Mã NV: ${emp.code} · Chức vụ: ${emp.role === 'assistant' ? 'Trợ giảng' : emp.role === 'office' ? 'Văn phòng' : emp.role === 'teacher' ? 'Giáo viên' : 'Admin'}`;

    const catalog = getClassCatalog();
    const assignedClasses = catalog.filter(c => (c.assistantIds || []).includes(emp.id) || (c.teacherIds || []).includes(emp.id));
    if ($('#portal-assigned-classes')) {
      $('#portal-assigned-classes').textContent = `Phụ trách: ${assignedClasses.map(c => c.name).join(', ') || 'Chưa phân công lớp'}`;
    }

    // Collect confirmed work shifts in this month
    const personalWorkKey = `lopvui.personal-work.v1.${encodeURIComponent(emp.name.trim().toLocaleLowerCase('vi'))}`;
    let personalWorkDays = {};
    try {
      personalWorkDays = JSON.parse(localStorage.getItem(personalWorkKey) || '{}');
    } catch {}

    // Also check session checklist confirmations
    const confirmedShifts = [];
    const [year, month] = selectedMonth.split('-').map(Number);

    // Days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();

      assignedClasses.forEach(cls => {
        if (Number(cls.weekday) === dayOfWeek) {
          const checklistKey = `lopvui.checklist.v1.${cls.id}.${dateStr}`;
          let chk = null;
          try {
            chk = JSON.parse(localStorage.getItem(checklistKey) || 'null');
          } catch {}

          const isWorked = Boolean(personalWorkDays[dateStr] || chk?.workStart?.staff || chk?.items?.[0]?.done);
          if (isWorked) {
            const [startH, startM] = cls.startTime.split(':').map(Number);
            const [endH, endM] = cls.endTime.split(':').map(Number);
            const durationHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

            confirmedShifts.push({
              date: dateStr,
              className: cls.name,
              room: cls.room,
              time: `${cls.startTime}–${cls.endTime}`,
              durationHours: durationHours.toFixed(1),
              confirmedAt: chk?.workStart?.time ? `Lúc ${chk.workStart.time}` : (personalWorkDays[dateStr]?.at ? new Date(personalWorkDays[dateStr].at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Xác nhận tự động'),
              confirmedBy: chk?.workStart?.staff || emp.name,
              checklistComplete: Boolean(chk?.items?.every(i => i.done))
            });
          }
        }
      });
    }

    // Calculate KPIs
    const totalHours = confirmedShifts.reduce((sum, s) => sum + Number(s.durationHours), 0);
    if ($('#portal-kpi-shifts')) $('#portal-kpi-shifts').textContent = confirmedShifts.length;
    if ($('#portal-kpi-hours')) $('#portal-kpi-hours').textContent = `${totalHours.toFixed(1)}h`;
    if ($('#portal-kpi-verified')) $('#portal-kpi-verified').textContent = confirmedShifts.length > 0 ? '100%' : '0%';

    // Render table
    const tbody = $('#portal-shift-tbody');
    if (!tbody) return;

    if (!confirmedShifts.length) {
      const [ymYear, ymMonth] = String(selectedMonth).split('-');
      const vnMonthLabel = ymMonth && ymYear ? `Tháng ${ymMonth}/${ymYear}` : selectedMonth;
      tbody.innerHTML = `<tr class="table-empty-row"><td colspan="7" class="table-empty-cell"><div class="table-empty-sticky-msg">Chưa có dữ liệu chấm công cho ${escapeHtml(vnMonthLabel)}.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = confirmedShifts.map((s, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${escapeHtml(s.date)}</strong></td>
        <td><strong>${escapeHtml(s.className)}</strong> (${escapeHtml(s.room)})</td>
        <td>${escapeHtml(s.time)}</td>
        <td>${escapeHtml(s.durationHours)} giờ</td>
        <td>${escapeHtml(s.confirmedAt)} (Bởi ${escapeHtml(s.confirmedBy)})</td>
        <td><span class="student-state state-present">✓ Hợp lệ / Đã đối chiếu</span></td>
      </tr>
    `).join('');
  }

  // ----------------------------------------------------
  // EVENT LISTENERS AND BINDINGS
  // ----------------------------------------------------

  // Account Switcher
  const userProfileBtn = $('#user-profile-button');
  if (userProfileBtn) userProfileBtn.onclick = openAccountSwitchDialog;
  const switchAccQuick = $('#switch-account-quick-btn');
  if (switchAccQuick) switchAccQuick.onclick = openAccountSwitchDialog;
  const closeAccSwitch = $('#close-account-switch');
  if (closeAccSwitch) closeAccSwitch.onclick = () => $('#account-switch-dialog').close();

  // Navigation tabs
  const tutoringNav = $('#tutoring-menu-nav');
  if (tutoringNav) tutoringNav.onclick = () => setMainMenuPanel('tutoring');
  const tutoringTabBtn = $('#tutoring-menu-tab-btn');
  if (tutoringTabBtn) tutoringTabBtn.onclick = () => setMainMenuPanel('tutoring');

  const portalNav = $('#portal-menu-nav');
  if (portalNav) portalNav.onclick = () => setMainMenuPanel('portal');
  const portalTabBtn = $('#portal-menu-tab-btn');
  if (portalTabBtn) portalTabBtn.onclick = () => setMainMenuPanel('portal');

  // Tutoring actions
  const addTutoringBtn = $('#add-tutoring-btn');
  if (addTutoringBtn) addTutoringBtn.onclick = () => openTutoringDialog();
  const closeTutoringBtn = $('#close-tutoring-dialog');
  if (closeTutoringBtn) closeTutoringBtn.onclick = () => $('#tutoring-form-dialog').close();
  const cancelTutoringBtn = $('#cancel-tutoring-btn');
  if (cancelTutoringBtn) cancelTutoringBtn.onclick = () => $('#tutoring-form-dialog').close();

  const tutoringSearch = $('#tutoring-search');
  if (tutoringSearch) tutoringSearch.oninput = renderTutoringModule;
  const tutoringTypeFilter = $('#tutoring-type-filter');
  if (tutoringTypeFilter) tutoringTypeFilter.onchange = renderTutoringModule;

  const tutoringForm = $('#tutoring-form');
  if (tutoringForm) {
    tutoringForm.onsubmit = (e) => {
      e.preventDefault();
      const id = $('#tutoring-id').value || `tutor-${Date.now()}`;
      const assistantSelect = $('#tutoring-assistant-select');
      const selectedOption = assistantSelect.options[assistantSelect.selectedIndex];
      const studentId = $('#tutoring-student-id').value.trim() || null;
      const studentName = $('#tutoring-student-name').value.trim();
      const studentClass = $('#tutoring-student-class').value.trim();
      const type = $('#tutoring-type-select').value;
      const previousHomeworkCheck = $('#tutoring-prev-hw-check').value.trim();
      const homeworkStatus = $('#tutoring-hw-status').value;
      const lessonContent = $('#tutoring-lesson-content').value.trim();
      const evaluation = $('#tutoring-evaluation').value.trim();
      const score = $('#tutoring-score').value.trim() ? Number($('#tutoring-score').value) : null;

      if (!studentName) {
        toast('Vui lòng chọn hoặc nhập họ tên học sinh.');
        $('#tutoring-student-search-input')?.focus();
        return;
      }

      const newSession = {
        id,
        date: $('#tutoring-date').value,
        startTime: $('#tutoring-start-time').value,
        endTime: $('#tutoring-end-time').value,
        assistantId: assistantSelect.value,
        assistantName: selectedOption?.dataset.name || selectedOption?.textContent || 'Trợ giảng',
        studentId,
        studentName,
        studentClass,
        type,
        previousHomeworkCheck,
        homeworkStatus,
        lessonContent,
        evaluation,
        score,
        createdAt: Date.now()
      };

      const current = loadTutoringSessions();
      const idx = current.findIndex(s => s.id === id);
      if (idx >= 0) current[idx] = newSession;
      else current.unshift(newSession);

      saveTutoringSessions(current);

      // Đồng bộ lịch sử ca bổ trợ/gia sư vào hồ sơ học sinh (chung 1 lớp bổ trợ TUTORING_CLASS_ID)
      const allStudents = getStudents();
      let matchedStudent = null;
      if (studentId) {
        matchedStudent = allStudents.find(s => s.id === studentId);
      }
      if (!matchedStudent && studentName) {
        matchedStudent = allStudents.find(s => s.name.trim().toLowerCase() === studentName.toLowerCase());
      }

      if (matchedStudent) {
        matchedStudent.classIds = matchedStudent.classIds || [];
        if (!matchedStudent.classIds.includes(TUTORING_CLASS_ID)) {
          matchedStudent.classIds.push(TUTORING_CLASS_ID);
        }

        matchedStudent.attendanceHistory = matchedStudent.attendanceHistory || [];
        const attIdx = matchedStudent.attendanceHistory.findIndex(h => h.tutoringId === id || (h.classId === TUTORING_CLASS_ID && h.date === newSession.date));
        const attEntry = {
          classId: TUTORING_CLASS_ID,
          date: newSession.date,
          status: 'present',
          tutoringType: newSession.type,
          time: `${newSession.startTime} - ${newSession.endTime}`,
          tutoringId: id
        };
        if (attIdx >= 0) matchedStudent.attendanceHistory[attIdx] = attEntry;
        else matchedStudent.attendanceHistory.unshift(attEntry);

        matchedStudent.sessionNotes = matchedStudent.sessionNotes || [];
        const noteIdx = matchedStudent.sessionNotes.findIndex(n => n.tutoringId === id || (n.classId === TUTORING_CLASS_ID && n.date === newSession.date));
        const noteEntry = {
          classId: TUTORING_CLASS_ID,
          date: newSession.date,
          tutoringId: id,
          tutoringType: newSession.type,
          lessonTitle: newSession.lessonContent,
          previousHomeworkCheck: newSession.previousHomeworkCheck,
          homeworkStatus: newSession.homeworkStatus,
          homeworkScore: newSession.score,
          note: newSession.evaluation,
          assistantName: newSession.assistantName
        };
        if (noteIdx >= 0) matchedStudent.sessionNotes[noteIdx] = noteEntry;
        else matchedStudent.sessionNotes.unshift(noteEntry);

        if (newSession.score !== null) {
          matchedStudent.scores = matchedStudent.scores || [];
          const scIdx = matchedStudent.scores.findIndex(sc => sc.tutoringId === id || (sc.classId === TUTORING_CLASS_ID && sc.date === newSession.date));
          const scEntry = {
            classId: TUTORING_CLASS_ID,
            type: newSession.type === 'giasu' ? 'Kiểm tra Gia sư' : 'Kiểm tra Bổ trợ',
            score: newSession.score,
            date: newSession.date,
            tutoringId: id
          };
          if (scIdx >= 0) matchedStudent.scores[scIdx] = scEntry;
          else matchedStudent.scores.unshift(scEntry);
        }

        saveStudentRecords(allStudents, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
      }

      $('#tutoring-form-dialog').close();
      toast(type === 'giasu' ? 'Đã lưu ca gia sư 1-kèm-1 và cập nhật hồ sơ học sinh.' : 'Đã lưu ca bổ trợ và cập nhật hồ sơ học sinh.');
      renderTutoringModule();
      render();
    };
  }

  // Management Subtabs (Classes vs Templates vs Staff vs Students)
  const mgmtTabClasses = $('#mgmt-tab-classes');
  const mgmtTabTemplates = $('#mgmt-tab-templates');
  const mgmtTabStaff = $('#mgmt-tab-staff');
  const mgmtTabStudents = $('#mgmt-tab-students');

  const mgmtPanelClasses = $('#mgmt-panel-classes');
  const mgmtPanelTemplates = $('#mgmt-panel-templates');
  const mgmtPanelStaff = $('#mgmt-panel-staff');
  const mgmtPanelStudents = $('#mgmt-panel-students');

  function switchMgmtTab(activeTab, activePanel) {
    [mgmtTabClasses, mgmtTabTemplates, mgmtTabStaff, mgmtTabStudents].forEach(t => t?.classList.remove('active'));
    [mgmtPanelClasses, mgmtPanelTemplates, mgmtPanelStaff, mgmtPanelStudents].forEach(p => { if (p) p.hidden = true; });
    activeTab?.classList.add('active');
    if (activePanel) activePanel.hidden = false;
  }

  if (mgmtTabClasses) {
    mgmtTabClasses.onclick = () => {
      switchMgmtTab(mgmtTabClasses, mgmtPanelClasses);
    };
  }
  if (mgmtTabTemplates) {
    mgmtTabTemplates.onclick = () => {
      switchMgmtTab(mgmtTabTemplates, mgmtPanelTemplates);
      renderRoomTemplatesList();
    };
  }
  if (mgmtTabStaff) {
    mgmtTabStaff.onclick = () => {
      switchMgmtTab(mgmtTabStaff, mgmtPanelStaff);
      renderStaffManagement();
    };
  }
  if (mgmtTabStudents) {
    mgmtTabStudents.onclick = () => {
      switchMgmtTab(mgmtTabStudents, mgmtPanelStudents);
      renderMasterStudentDirectory();
    };
  }

  const manageTemplatesBtn = $('#manage-templates-button');
  if (manageTemplatesBtn) {
    manageTemplatesBtn.onclick = () => {
      setMainMenuPanel('management');
      if (mgmtTabTemplates) mgmtTabTemplates.click();
    };
  }

  // Room Template Form & Dialog
  const addRoomTemplateBtn = $('#add-room-template-btn');
  if (addRoomTemplateBtn) addRoomTemplateBtn.onclick = () => openRoomTemplateDialog();
  const closeRoomTemplateBtn = $('#close-room-template-dialog');
  if (closeRoomTemplateBtn) closeRoomTemplateBtn.onclick = () => $('#room-template-dialog').close();
  const cancelRoomTemplateBtn = $('#cancel-room-template-btn');
  if (cancelRoomTemplateBtn) cancelRoomTemplateBtn.onclick = () => $('#room-template-dialog').close();

  const roomTemplateForm = $('#room-template-form');
  if (roomTemplateForm) {
    roomTemplateForm.onsubmit = (e) => {
      e.preventDefault();
      const id = $('#room-template-id').value || `tpl-${Date.now()}`;
      const name = $('#room-template-name').value.trim();
      const roomCode = $('#room-template-code').value.trim();
      const aisles = Math.max(1, Math.min(8, Number($('#room-template-aisles').value) || 3));
      const seatsPerDesk = Number($('#room-template-seats').value) || 2;
      const description = $('#room-template-desc').value.trim();

      const desksPerAisle = Array.from({ length: aisles }, (_, i) => Math.max(1, Math.min(30, Number(draftRoomTplDesks[i]) || 3)));
      const aisleDividers = Array.from({ length: aisles }, (_, i) => {
        const set = draftRoomTplDividers[i] || new Set();
        return [...set].map(Number).filter(d => d >= 1 && d < desksPerAisle[i]).sort((a, b) => a - b);
      });

      const templates = loadRoomTemplates();
      const idx = templates.findIndex(t => t.id === id);
      const oldTpl = idx >= 0 ? templates[idx] : null;

      const newTpl = {
        id,
        name,
        roomCode,
        aisles,
        desksPerAisle,
        dividerAfterDesks: aisleDividers[0] || [],
        aisleDividers,
        seatsPerDesk,
        description,
        createdAt: oldTpl?.createdAt || Date.now()
      };

      if (idx >= 0) templates[idx] = newTpl;
      else templates.unshift(newTpl);

      saveRoomTemplates(templates);

      // Auto-update all classes assigned to this room so class layouts automatically follow room changes!
      const catalog = getClassCatalog();
      let updatedClassesCount = 0;
      catalog.forEach(cls => {
        const matchesRoom =
          cls.roomTemplateId === id ||
          (roomCode && cls.room === roomCode) ||
          (oldTpl?.roomCode && cls.room === oldTpl.roomCode) ||
          (oldTpl?.name && cls.room === oldTpl.name) ||
          cls.room === name;
        if (matchesRoom) {
          cls.roomTemplateId = id;
          cls.room = roomCode || name;
          cls.defaultLayout = buildLayoutFromTemplate(cls.id, newTpl);
          localStorage.setItem(`lopvui.layout.v5.${cls.id}.${getChecklistDate()}`, JSON.stringify(cls.defaultLayout));
          if (cls.id === getCurrentClassId() && ctx.setLayout) {
            ctx.setLayout(structuredClone(cls.defaultLayout));
          }
          updatedClassesCount++;
        }
      });
      if (updatedClassesCount > 0) {
        saveClassCatalog(catalog);
        render();
        renderMainMenu();
      }

      populateRoomTemplateDropdowns();
      $('#room-template-dialog').close();
      toast(updatedClassesCount > 0
        ? `Đã lưu phòng ${roomCode || name} và tự động cập nhật sơ đồ cho ${updatedClassesCount} lớp.`
        : `Đã lưu phòng học: ${name}`);
      renderRoomTemplatesList();
    };
  }

  // Template dropdown listeners
  const configRoomTplSelect = $('#config-room-template-select');
  if (configRoomTplSelect) {
    configRoomTplSelect.onchange = (e) => {
      const tplId = e.target.value;
      if (!tplId) return;
      const tpl = loadRoomTemplates().find(t => t.id === tplId);
      if (!tpl) return;
      if ($('#config-class-room')) $('#config-class-room').value = tpl.roomCode || '';
      if ($('#config-layout-aisles')) $('#config-layout-aisles').value = tpl.aisles;
      if ($('#config-layout-desks')) $('#config-layout-desks').value = tpl.desksPerAisle.join(', ');
    };
  }

  const applyRoomTplSelect = $('#apply-room-template-select');
  if (applyRoomTplSelect) {
    applyRoomTplSelect.onchange = (e) => {
      const tplId = e.target.value;
      if (!tplId) return;
      const tpl = loadRoomTemplates().find(t => t.id === tplId);
      if (!tpl) return;
      if (confirm(`Áp dụng mẫu "${tpl.name}" cho sơ đồ lớp học?`)) {
        const currentClass = getActiveClassConfig();
        const newLayout = buildLayoutFromTemplate(currentClass.id, tpl);
        if (ctx.setLayout) ctx.setLayout(newLayout);
        else localStorage.setItem(`lopvui.layout.v5.${currentClass.id}.${getChecklistDate()}`, JSON.stringify(newLayout));
        render();
        $('#layout-dialog').close();
        toast(`Đã áp dụng sơ đồ theo mẫu "${tpl.name}".`);
      }
    };
  }

  const saveAsNewTplBtn = $('#save-as-new-template-btn');
  if (saveAsNewTplBtn) {
    saveAsNewTplBtn.onclick = () => {
      $('#layout-dialog').close();
      openRoomTemplateDialog();
      const aisles = document.querySelectorAll('#column-count')[0]?.value || '3';
      const desks = [...document.querySelectorAll('[data-desk-count]')].map(x => x.value).join(', ');
      $('#room-template-aisles').value = aisles;
      $('#room-template-desks').value = desks;
    };
  }

  // Roster Management Dialog
  const closeRosterAdmin = $('#close-roster-admin-dialog');
  if (closeRosterAdmin) closeRosterAdmin.onclick = () => $('#roster-admin-dialog').close();
  const rosterAddManualBtn = $('#roster-add-manual-btn');
  if (rosterAddManualBtn) {
    rosterAddManualBtn.onclick = () => {
      $('#roster-add-form').hidden = !$('#roster-add-form').hidden;
    };
  }
  const cancelAddRosterBtn = $('#cancel-add-roster-btn');
  if (cancelAddRosterBtn) cancelAddRosterBtn.onclick = () => $('#roster-add-form').hidden = true;

  const confirmAddRosterBtn = $('#confirm-add-roster-btn');
  if (confirmAddRosterBtn) {
    confirmAddRosterBtn.onclick = () => {
      const name = $('#new-roster-student-name').value.trim();
      const school = $('#new-roster-student-school').value.trim();
      const phone = $('#new-roster-parent-phone').value.trim();
      const code = $('#new-roster-student-code').value.trim();
      const targetClassId = activeRosterClassId || getCurrentClassId();
      if (!name) {
        toast('Vui lòng nhập họ và tên học sinh.');
        return;
      }
      const newStudent = createStudentProfile({
        name,
        school,
        studentCode: code || null,
        parentContact: { name: '', phone },
        classIds: [targetClassId],
        enrollmentStatus: 'Học',
        kind: 'regular'
      });
      newStudent.studentCode = code ? code.toUpperCase() : null;
      newStudent.classIds = [targetClassId];
      newStudent.enrollmentStatus = 'Học';

      getStudents().push(newStudent);
      saveStudentRecords(getStudents(), ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);

      $('#new-roster-student-name').value = '';
      $('#new-roster-student-school').value = '';
      $('#new-roster-parent-phone').value = '';
      $('#new-roster-student-code').value = '';
      $('#roster-add-form').hidden = true;

      renderRosterAdminTable(targetClassId);
      renderMasterStudentDirectory();
      renderMainMenu();
      render();
      toast(`Đã thêm ${name} vào danh sách lớp gốc.`);
    };
  }

  let isRosterImportContext = false;

  function populateImportDefaultClassSelect(preferredClassId = '') {
    const defaultClassSelect = $('#import-default-class-select');
    if (!defaultClassSelect) return;
    const catalog = getClassCatalog();
    defaultClassSelect.innerHTML =
      `<option value="">-- Không gán lớp mặc định (Chỉ lấy theo cột Mã lớp trong file) --</option>` +
      catalog.map(c => `<option value="${escapeHtml(c.id)}">[${escapeHtml(c.code || c.id)}] ${escapeHtml(c.name)} (${escapeHtml(formatBirthYearLabel(c.grade))})</option>`).join('');
    if (preferredClassId && catalog.some(c => c.id === preferredClassId)) {
      defaultClassSelect.value = preferredClassId;
    } else {
      defaultClassSelect.value = '';
    }
  }

  function syncImportTargetBanner() {
    const banner = $('#import-target-class-banner');
    const select = $('#import-default-class-select');
    if (!banner) return;
    const catalog = getClassCatalog();
    const targetId = (isRosterImportContext && activeRosterClassId) ? activeRosterClassId : (select?.value || '');
    const cls = catalog.find(c => c.id === targetId);
    if (cls) {
      banner.hidden = false;
      banner.innerHTML = isRosterImportContext
        ? `<strong>Lớp đích cố định: [${escapeHtml(cls.code || cls.id)}] ${escapeHtml(cls.name)}</strong> — Mọi học sinh hợp lệ trong bảng bên dưới sẽ được gán thẳng vào lớp này.`
        : `<strong>Lớp gán mặc định: [${escapeHtml(cls.code || cls.id)}] ${escapeHtml(cls.name)}</strong> — Học sinh sẽ được gán vào lớp này (kèm theo các cột Mã lớp trong bảng nếu có).`;
    } else {
      banner.hidden = true;
      banner.innerHTML = '';
    }
  }

  // Import from Excel / Google Sheets inside Roster Admin Dialog (Class-specific context)
  const rosterImportBtn = $('#roster-import-btn');
  if (rosterImportBtn) {
    rosterImportBtn.onclick = () => {
      isRosterImportContext = true;
      parsedImportData = [];
      parsedRawRows = [];
      gridColumnRoles = [];
      $('#import-paste-textarea').value = '';
      if ($('#import-file-input')) $('#import-file-input').value = '';
      if ($('#import-preview-wrap')) $('#import-preview-wrap').hidden = true;
      if ($('#confirm-import-btn')) $('#confirm-import-btn').disabled = true;
      populateImportDefaultClassSelect(activeRosterClassId || getCurrentClassId());
      syncImportTargetBanner();
      $('#import-roster-dialog').showModal();
    };
  }

  // Import from Excel / Google Sheets inside Master Student Directory (Center-wide context)
  const masterImportBtn = $('#master-import-excel-btn');
  if (masterImportBtn) {
    masterImportBtn.onclick = () => {
      isRosterImportContext = false;
      parsedImportData = [];
      parsedRawRows = [];
      gridColumnRoles = [];
      $('#import-paste-textarea').value = '';
      if ($('#import-file-input')) $('#import-file-input').value = '';
      if ($('#import-preview-wrap')) $('#import-preview-wrap').hidden = true;
      if ($('#confirm-import-btn')) $('#confirm-import-btn').disabled = true;
      const filterClassVal = $('#master-class-filter')?.value;
      const preselectClass = (filterClassVal && filterClassVal !== 'all') ? filterClassVal : '';
      populateImportDefaultClassSelect(preselectClass);
      syncImportTargetBanner();
      $('#import-roster-dialog').showModal();
    };
  }

  const closeImportDialog = $('#close-import-dialog');
  if (closeImportDialog) closeImportDialog.onclick = () => $('#import-roster-dialog').close();
  const cancelImportBtn = $('#cancel-import-btn');
  if (cancelImportBtn) cancelImportBtn.onclick = () => $('#import-roster-dialog').close();

  let parsedRawRows = [];
  let gridColumnRoles = [];

  function initFlexibleColumnMappingImport() {
    const fileInput = $('#import-file-input');
    const textarea = $('#import-paste-textarea');
    const detectBtn = $('#detect-columns-btn');
    const confirmBtn = $('#confirm-import-btn');
    const previewWrap = $('#import-preview-wrap');
    const hasHeaderCheckbox = $('#import-has-header');
    const defaultClassSelect = $('#import-default-class-select');

    populateImportDefaultClassSelect(activeRosterClassId || '');

    const getImportOptions = () => {
      const selectedDefault = defaultClassSelect ? defaultClassSelect.value : '';
      const contextClass = (isRosterImportContext && activeRosterClassId) ? activeRosterClassId : '';
      return {
        hasHeader: Boolean(hasHeaderCheckbox?.checked),
        defaultClassId: selectedDefault || contextClass,
        contextClassId: contextClass || selectedDefault
      };
    };

    const refreshExtractedStudentsAndGrid = (rebuildHeader = true) => {
      if (!parsedRawRows.length) {
        if (previewWrap) previewWrap.hidden = true;
        if (confirmBtn) confirmBtn.disabled = true;
        return;
      }

      const catalog = getClassCatalog();
      const opts = getImportOptions();
      parsedImportData = extractStudentsFromGrid(parsedRawRows, gridColumnRoles, opts, catalog);

      if (previewWrap) previewWrap.hidden = false;
      const countEl = $('#import-preview-count');
      if (countEl) countEl.textContent = parsedImportData.length;
      if (confirmBtn) {
        confirmBtn.disabled = parsedImportData.length === 0;
        confirmBtn.textContent = parsedImportData.length > 0
          ? `✓ Xác nhận nhập ${parsedImportData.length} học sinh vào hệ thống`
          : '✓ Xác nhận nhập vào hệ thống';
      }

      const thead = $('#import-preview-thead');
      const tbody = $('#import-preview-tbody');
      if (!thead || !tbody) return;

      const maxCols = Math.max(1, ...parsedRawRows.slice(0, 15).map(r => r.length));
      while (gridColumnRoles.length < maxCols) gridColumnRoles.push('ignore');

      const headerRow = opts.hasHeader ? parsedRawRows[0] : null;
      const dataRows = opts.hasHeader ? parsedRawRows.slice(1) : parsedRawRows;

      if (rebuildHeader) {
        thead.innerHTML = `
          <tr class="grid-role-selector-row">
            ${Array.from({ length: maxCols }, (_, colIdx) => {
              const currentRole = gridColumnRoles[colIdx] || 'ignore';
              const isIgnored = currentRole === 'ignore';
              const sampleVal = String((dataRows[0]?.[colIdx] ?? parsedRawRows[0]?.[colIdx] ?? '') || '').trim();
              return `
                <th class="grid-col-header-th ${isIgnored ? 'grid-col-ignored' : 'grid-col-active'}">
                  <div class="grid-col-index-badge">Cột ${colIdx + 1}${headerRow ? `: ${escapeHtml(String(headerRow[colIdx] || '').slice(0, 20))}` : ''}</div>
                  <select class="grid-col-role-select" data-grid-col-idx="${colIdx}" aria-label="Chọn trường cho cột ${colIdx + 1}">
                    ${GRID_COLUMN_ROLE_OPTIONS.map(opt => `
                      <option value="${escapeHtml(opt.value)}" ${currentRole === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>
                    `).join('')}
                  </select>
                  ${sampleVal ? `<small class="grid-col-sample-hint" title="Mẫu dòng 1: ${escapeHtml(sampleVal)}">Mẫu: ${escapeHtml(sampleVal.slice(0, 22))}</small>` : ''}
                </th>
              `;
            }).join('')}
          </tr>
        `;

        thead.querySelectorAll('.grid-col-role-select').forEach(sel => {
          sel.onchange = () => {
            const cIdx = Number(sel.dataset.gridColIdx);
            const newRole = sel.value;
            // For single-instance roles (code, familyName, givenName, fullName, school, phone, parentName, status),
            // if user picks a role that was already on another column, keep it clean so user doesn't have to manually unset the old column
            const singleRoles = new Set(['code', 'familyName', 'givenName', 'fullName', 'school', 'phone', 'parentName', 'status']);
            if (singleRoles.has(newRole)) {
              gridColumnRoles = gridColumnRoles.map((r, idx) => (idx !== cIdx && r === newRole) ? 'ignore' : r);
            }
            gridColumnRoles[cIdx] = newRole;
            refreshExtractedStudentsAndGrid(true);
          };
        });
      }

      const previewSlice = dataRows.slice(0, 25);
      tbody.innerHTML = previewSlice.map(row => `
        <tr>
          ${Array.from({ length: maxCols }, (_, colIdx) => {
            const role = gridColumnRoles[colIdx] || 'ignore';
            const cellVal = String(row[colIdx] ?? '').trim();
            return `<td class="${role === 'ignore' ? 'grid-cell-ignored' : 'grid-cell-active'}">${escapeHtml(cellVal || '—')}</td>`;
          }).join('')}
        </tr>
      `).join('') + (dataRows.length > 25 ? `<tr><td colspan="${maxCols}" style="text-align:center; color:#647768; font-weight:600; padding:10px;">...và ${dataRows.length - 25} dòng học sinh khác (Tổng cộng ${parsedImportData.length} học sinh hợp lệ)</td></tr>` : '');
    };

    const parseAndRenderFromText = (rawText, showToast = false) => {
      if (!rawText || !rawText.trim()) {
        parsedRawRows = [];
        gridColumnRoles = [];
        refreshExtractedStudentsAndGrid(true);
        return;
      }
      const { rows } = parseRawTable(rawText);
      if (!rows.length) {
        if (showToast) toast('Không tìm thấy dòng dữ liệu nào trong bảng.');
        return;
      }
      parsedRawRows = rows;
      const catalog = getClassCatalog();
      const detected = autoDetectGridColumnRoles(rows, catalog);
      if (hasHeaderCheckbox) hasHeaderCheckbox.checked = Boolean(detected.hasHeader);
      gridColumnRoles = detected.roles;
      syncImportTargetBanner();
      refreshExtractedStudentsAndGrid(true);
      if (showToast) {
        toast(`Đã dựng bảng dữ liệu: nhận diện ${parsedImportData.length} học sinh.`);
      }
    };

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result || '';
        if (textarea) textarea.value = content;
        parseAndRenderFromText(content, true);
      };
      reader.readAsText(file, 'utf-8');
    });

    textarea?.addEventListener('input', () => {
      parseAndRenderFromText(textarea.value, false);
    });

    detectBtn?.addEventListener('click', () => {
      const text = textarea?.value || '';
      if (!text.trim()) {
        toast('Vui lòng dán bảng dữ liệu hoặc tải file lên trước.');
        return;
      }
      parseAndRenderFromText(text, true);
    });

    hasHeaderCheckbox?.addEventListener('change', () => {
      if (parsedRawRows.length) {
        refreshExtractedStudentsAndGrid(true);
      }
    });

    defaultClassSelect?.addEventListener('change', () => {
      syncImportTargetBanner();
      if (parsedRawRows.length) {
        refreshExtractedStudentsAndGrid(false);
      }
    });

    confirmBtn?.addEventListener('click', () => {
      const catalog = getClassCatalog();
      const opts = getImportOptions();
      if (parsedRawRows.length) {
        parsedImportData = extractStudentsFromGrid(parsedRawRows, gridColumnRoles, opts, catalog);
      }
      if (!parsedImportData.length) {
        toast('Chưa có học sinh hợp lệ để nhập. Hãy chọn cột Tên / Họ và tên trên đầu bảng.');
        return;
      }

      const currentStudents = getStudents();
      const currentMakeups = ctx.getMakeupStudents ? ctx.getMakeupStudents() : [];

      // Remove any old corrupted record (e.g. studentCode === "HỌC") before importing
      for (let i = currentStudents.length - 1; i >= 0; i--) {
        const st = currentStudents[i];
        const sc = String(st?.studentCode || '').trim();
        if (sc && isStatusWord(sc)) {
          currentStudents.splice(i, 1);
        }
      }

      // Direct target class when importing inside a class or when selected in the dropdown
      const forcedClassId = (isRosterImportContext && activeRosterClassId)
        ? activeRosterClassId
        : (defaultClassSelect?.value || '');

      let addedCount = 0;
      let updatedCount = 0;

      parsedImportData.forEach(item => {
        const finalClassIds = [...(item.classIds || [])];
        if (forcedClassId && !finalClassIds.includes(forcedClassId)) {
          finalClassIds.push(forcedClassId);
        }

        const validCode = (item.studentCode && !isStatusWord(item.studentCode) && !/^\d{1,3}$/.test(item.studentCode))
          ? String(item.studentCode).trim().toUpperCase()
          : null;

        const existing = currentStudents.find(s => {
          if (validCode && s.studentCode && s.studentCode.toUpperCase() === validCode) {
            return true;
          }
          if (!validCode && !s.studentCode) {
            return s.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
                   (s.school || '').trim().toLowerCase() === (item.school || '').trim().toLowerCase();
          }
          return false;
        });

        if (existing) {
          existing.familyName = item.familyName || existing.familyName;
          existing.givenName = item.givenName || existing.givenName;
          existing.name = item.name || existing.name;
          if (item.school) existing.school = item.school;
          if (validCode) existing.studentCode = validCode;
          if (item.parentContact?.phone || item.parentContact?.name) {
            existing.parentContact = {
              name: item.parentContact?.name || existing.parentContact?.name || '',
              phone: item.parentContact?.phone || existing.parentContact?.phone || ''
            };
          }
          if (finalClassIds.length) {
            const merged = new Set([...(existing.classIds || []), ...finalClassIds]);
            existing.classIds = [...merged];
          }
          if (item.tag) {
            existing.tags = Array.isArray(existing.tags) ? existing.tags : [];
            if (!existing.tags.includes(item.tag)) existing.tags.push(item.tag);
          }
          existing.enrollmentStatus = item.enrollmentStatus || existing.enrollmentStatus || 'Học';
          updatedCount++;
        } else {
          const tagsArr = item.tag ? [item.tag] : [];
          const newStudent = createStudentProfile({
            name: item.name,
            familyName: item.familyName,
            givenName: item.givenName,
            studentCode: validCode,
            school: item.school,
            parentContact: item.parentContact,
            classIds: finalClassIds,
            enrollmentStatus: item.enrollmentStatus || 'Học',
            tags: tagsArr,
            kind: 'regular'
          });
          newStudent.studentCode = validCode;
          newStudent.classIds = finalClassIds;
          newStudent.familyName = item.familyName;
          newStudent.givenName = item.givenName;
          newStudent.enrollmentStatus = item.enrollmentStatus || 'Học';
          currentStudents.push(newStudent);
          addedCount++;
        }
      });

      saveStudentRecords(currentStudents, currentMakeups);
      $('#import-roster-dialog')?.close();
      toast(`Đã nhập thành công: ${addedCount} học sinh mới, cập nhật ${updatedCount} học sinh.`);
      render();
      if (activeRosterClassId) renderRosterAdminTable(activeRosterClassId);
      renderMasterStudentDirectory();
      renderMainMenu();
    });
  }

  // ----------------------------------------------------
  // TÍNH NĂNG MỚI: DANH BẠ HỌC SINH TOÀN TRUNG TÂM (REQ 7)
  // ----------------------------------------------------
  let selectedMasterStudentIds = new Set();
  let selectedMasterStatuses = null; // null means ALL statuses are selected

  function getAvailableEnrollmentStatuses(students = []) {
    const statusSet = new Set(ENROLLMENT_STATUS_PRESETS);
    students.forEach(s => {
      const st = (s.enrollmentStatus && String(s.enrollmentStatus).trim()) ? String(s.enrollmentStatus).trim() : 'Học';
      statusSet.add(st);
    });
    return Array.from(statusSet);
  }

  function renderMasterStatusFilterDropdown(students = []) {
    const dropdown = $('#master-status-filter-dropdown');
    const labelEl = $('#master-status-filter-label');
    if (!dropdown) return;

    const allStatuses = getAvailableEnrollmentStatuses(students);
    const isAllSelected = !selectedMasterStatuses || allStatuses.every(st => selectedMasterStatuses.has(st));

    if (labelEl) {
      if (isAllSelected) {
        labelEl.textContent = 'Trạng thái: Tất cả';
      } else if (selectedMasterStatuses.size === 0) {
        labelEl.textContent = 'Trạng thái: (0 chọn)';
      } else if (selectedMasterStatuses.size === 1) {
        labelEl.textContent = `Trạng thái: ${Array.from(selectedMasterStatuses)[0]}`;
      } else {
        labelEl.textContent = `Trạng thái: (${selectedMasterStatuses.size} chọn)`;
      }
    }

    dropdown.innerHTML = `
      <label class="excel-filter-option excel-filter-all">
        <input type="checkbox" data-status-filter-all="1" ${isAllSelected ? 'checked' : ''} />
        <strong>(Chọn tất cả)</strong>
      </label>
      <div class="excel-filter-divider"></div>
      <div class="excel-filter-options-list">
        ${allStatuses.map(st => {
          const count = students.filter(s => ((s.enrollmentStatus && String(s.enrollmentStatus).trim()) || 'Học') === st).length;
          const checked = isAllSelected || (selectedMasterStatuses && selectedMasterStatuses.has(st));
          return `
            <label class="excel-filter-option">
              <input type="checkbox" data-status-filter-item="${escapeHtml(st)}" ${checked ? 'checked' : ''} />
              <span>${escapeHtml(st)}</span>
              <small>(${count})</small>
            </label>
          `;
        }).join('')}
      </div>
    `;

    const allCb = dropdown.querySelector('[data-status-filter-all]');
    if (allCb) {
      allCb.onchange = (e) => {
        e.stopPropagation();
        if (allCb.checked) {
          selectedMasterStatuses = null;
        } else {
          selectedMasterStatuses = new Set();
        }
        renderMasterStudentDirectory();
      };
    }

    dropdown.querySelectorAll('[data-status-filter-item]').forEach(cb => {
      cb.onchange = (e) => {
        e.stopPropagation();
        const stVal = cb.dataset.statusFilterItem;
        if (!selectedMasterStatuses) {
          selectedMasterStatuses = new Set(allStatuses);
        }
        if (cb.checked) selectedMasterStatuses.add(stVal);
        else selectedMasterStatuses.delete(stVal);

        if (allStatuses.every(s => selectedMasterStatuses.has(s))) {
          selectedMasterStatuses = null;
        }
        renderMasterStudentDirectory();
      };
    });
  }

  const statusFilterBtn = $('#master-status-filter-btn');
  if (statusFilterBtn) {
    statusFilterBtn.onclick = (e) => {
      e.stopPropagation();
      const dropdown = $('#master-status-filter-dropdown');
      if (!dropdown) return;
      const willOpen = dropdown.hidden;
      dropdown.hidden = !willOpen;
      statusFilterBtn.setAttribute('aria-expanded', String(willOpen));
    };
  }
  document.addEventListener('click', (e) => {
    const wrap = $('#master-status-filter-wrap');
    const dropdown = $('#master-status-filter-dropdown');
    if (dropdown && !dropdown.hidden && wrap && !wrap.contains(e.target)) {
      dropdown.hidden = true;
      $('#master-status-filter-btn')?.setAttribute('aria-expanded', 'false');
    }
  });

  function updateMasterBulkBar() {
    const bar = $('#master-bulk-bar');
    const countEl = $('#master-bulk-count');
    if (!bar || !countEl) return;
    const count = selectedMasterStudentIds.size;
    if (count > 0) {
      bar.hidden = false;
      countEl.textContent = count;
    } else {
      bar.hidden = true;
    }
  }

  setTimeout(() => {
    $('#master-bulk-clear-btn')?.addEventListener('click', () => {
      selectedMasterStudentIds.clear();
      updateMasterBulkBar();
      renderMasterStudentDirectory();
    });

    $('#master-bulk-add-tag-btn')?.addEventListener('click', () => {
      if (!selectedMasterStudentIds.size) return;
      const tag = prompt('Nhập tên Tag muốn gắn cho các học sinh đã chọn (ví dụ: Mới, Cần chú ý, Mục tiêu 9+):');
      if (!tag || !tag.trim()) return;
      const cleanTag = tag.trim();
      const students = getStudents();
      students.forEach(s => {
        if (selectedMasterStudentIds.has(s.id)) {
          s.tags = Array.isArray(s.tags) ? s.tags : [];
          if (!s.tags.includes(cleanTag)) s.tags.push(cleanTag);
        }
      });
      saveStudentRecords(students, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
      renderMasterStudentDirectory();
      render();
      toast(`Đã gắn tag "${cleanTag}" cho ${selectedMasterStudentIds.size} học sinh.`);
    });

    $('#master-bulk-remove-tag-btn')?.addEventListener('click', () => {
      if (!selectedMasterStudentIds.size) return;
      const tag = prompt('Nhập tên Tag muốn gỡ bỏ (để trống nếu muốn xóa TẤT CẢ tag của các học sinh đã chọn):');
      if (tag === null) return;
      const cleanTag = tag.trim().toLowerCase();
      const students = getStudents();
      students.forEach(s => {
        if (selectedMasterStudentIds.has(s.id)) {
          if (!cleanTag) {
            s.tags = [];
          } else {
            s.tags = (s.tags || []).filter(t => t.toLowerCase() !== cleanTag);
          }
        }
      });
      saveStudentRecords(students, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
      renderMasterStudentDirectory();
      render();
      toast('Đã gỡ tag khỏi các học sinh đã chọn.');
    });

    $('#master-bulk-delete-btn')?.addEventListener('click', () => {
      const count = selectedMasterStudentIds.size;
      if (!count) return;
      if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} học sinh đã chọn khỏi toàn hệ thống?`)) return;
      const students = getStudents();
      for (let i = students.length - 1; i >= 0; i--) {
        if (selectedMasterStudentIds.has(students[i].id)) {
          students.splice(i, 1);
        }
      }
      selectedMasterStudentIds.clear();
      saveStudentRecords(students, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
      renderMasterStudentDirectory();
      render();
      updateMasterBulkBar();
      toast('Đã xóa các học sinh đã chọn.');
    });
  }, 100);

  function renderMasterStudentDirectory() {
    const students = getStudents();
    const catalog = getClassCatalog();

    const classFilter = $('#master-class-filter');
    if (classFilter) {
      const prevVal = classFilter.value || 'all';
      classFilter.innerHTML = '<option value="all">Tất cả các lớp</option>' + catalog.map(c =>
        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.code || c.id)} (${escapeHtml(formatBirthYearLabel(c.grade))})</option>`
      ).join('');
      if (prevVal === 'all' || catalog.some(c => c.id === prevVal)) {
        classFilter.value = prevVal;
      }
    }

    renderMasterStatusFilterDropdown(students);

    const searchQuery = ($('#master-student-search')?.value || '').trim().toLowerCase();
    const selectedClass = classFilter?.value || 'all';

    const total = students.length;
    const singleClass = students.filter(s => (s.classIds || []).length <= 1).length;
    const multiClass = students.filter(s => (s.classIds || []).length > 1).length;
    const newStudents = students.filter(s => s.isNew || (Array.isArray(s.tags) && s.tags.includes('Mới'))).length;

    if ($('#master-student-count')) $('#master-student-count').textContent = `${total} học sinh`;
    if ($('#master-kpi-total')) $('#master-kpi-total').textContent = total;
    if ($('#master-kpi-single')) $('#master-kpi-single').textContent = singleClass;
    if ($('#master-kpi-multi')) $('#master-kpi-multi').textContent = multiClass;
    if ($('#master-kpi-new')) $('#master-kpi-new').textContent = newStudents;

    const selectedGrade = $('#master-grade-filter')?.value || 'all';
    const filtered = students.filter(s => {
      if (selectedClass !== 'all') {
        if (!(s.classIds || []).includes(selectedClass)) return false;
      }
      if (selectedGrade !== 'all') {
        const normTarget = normalizeGradeToBirthYear(selectedGrade);
        const hasMatchingGrade = (s.classIds || []).some(cid => {
          const c = catalog.find(x => x.id === cid);
          return c && normalizeGradeToBirthYear(c.grade) === normTarget;
        });
        if (!hasMatchingGrade) return false;
      }
      const stVal = (s.enrollmentStatus && String(s.enrollmentStatus).trim()) ? String(s.enrollmentStatus).trim() : 'Học';
      if (selectedMasterStatuses && !selectedMasterStatuses.has(stVal)) {
        return false;
      }
      if (searchQuery) {
        const full = `${s.name} ${s.familyName || ''} ${s.givenName || ''} ${s.studentCode || ''} ${s.school || ''} ${s.parentContact?.phone || ''} ${s.parentContact?.name || ''} ${stVal}`;
        if (!matchesAcronymOrText(full, searchQuery)) return false;
      }
      return true;
    });

    const tbody = $('#master-student-tbody');
    if (!tbody) return;

    let masterSortKey = window._masterSortKey || 'index';
    let masterSortOrder = window._masterSortOrder || 'asc';

    filtered.sort((a, b) => {
      let cmp = 0;
      if (masterSortKey === 'name' || masterSortKey === 'given') {
        const aGiven = a.givenName || splitVietnameseName(a.name).givenName;
        const bGiven = b.givenName || splitVietnameseName(b.name).givenName;
        cmp = aGiven.localeCompare(bGiven, 'vi') || (a.familyName || '').localeCompare(b.familyName || '', 'vi');
      } else if (masterSortKey === 'code') {
        cmp = (a.studentCode || '').localeCompare(b.studentCode || '');
      } else if (masterSortKey === 'family') {
        cmp = (a.familyName || '').localeCompare(b.familyName || '', 'vi');
      } else if (masterSortKey === 'school') {
        cmp = (a.school || '').localeCompare(b.school || '', 'vi');
      } else if (masterSortKey === 'parent') {
        cmp = (a.parentContact?.name || '').localeCompare(b.parentContact?.name || '', 'vi');
      } else if (masterSortKey === 'status') {
        const aSt = a.enrollmentStatus || 'Học';
        const bSt = b.enrollmentStatus || 'Học';
        cmp = aSt.localeCompare(bSt, 'vi');
      } else if (masterSortKey === 'classes') {
        cmp = (a.classIds || []).length - (b.classIds || []).length;
      } else {
        cmp = 0;
      }
      return masterSortOrder === 'desc' ? -cmp : cmp;
    });

    document.querySelectorAll('#master-student-table th[data-master-sort]').forEach(th => {
      const key = th.dataset.masterSort;
      th.classList.remove('sorted-asc', 'sorted-desc');
      const icon = th.querySelector('.sort-icon');
      if (key === masterSortKey) {
        th.classList.add(masterSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc');
        if (icon) icon.textContent = masterSortOrder === 'asc' ? '▲' : '▼';
      } else {
        if (icon) icon.textContent = '⇅';
      }
      th.onclick = () => {
        if (window._masterSortKey === key) {
          window._masterSortOrder = window._masterSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          window._masterSortKey = key;
          window._masterSortOrder = 'asc';
        }
        renderMasterStudentDirectory();
      };
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:18px; color:#879389;">Không tìm thấy học sinh nào phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((s) => {
      const parts = splitVietnameseName(s.name);
      const fam = s.familyName ?? parts.familyName;
      const giv = s.givenName ?? parts.givenName;
      const stVal = (s.enrollmentStatus && String(s.enrollmentStatus).trim()) ? String(s.enrollmentStatus).trim() : 'Học';

      let stClass = 'status-text-hoc';
      if (stVal === 'Chưa nhập học') stClass = 'status-text-pending';
      else if (stVal === 'Tạm nghỉ') stClass = 'status-text-paused';
      else if (stVal === 'Nghỉ') stClass = 'status-text-stopped';
      else if (stVal === 'Trùng') stClass = 'status-text-duplicate';

      const classPlainLinks = (s.classIds || []).map(cid => {
        const c = catalog.find(x => x.id === cid);
        const cCode = c ? (c.code || c.name) : cid;
        return `<span class="plain-class-link" data-open-student-class="${escapeHtml(s.id)}" data-class-id="${escapeHtml(cid)}" title="Bấm xem tình hình học lớp ${escapeHtml(cCode)}">${escapeHtml(cCode)}</span>`;
      }).join(', ') || '<small style="color:#a8b4aa;">Chưa gán lớp</small>';

      return `
        <tr>
          <td style="text-align:center;"><input type="checkbox" class="master-student-cb" data-student-id="${escapeHtml(s.id)}" ${selectedMasterStudentIds.has(s.id) ? 'checked' : ''} /></td>
          <td><strong>${escapeHtml(s.studentCode || '—')}</strong></td>
          <td style="cursor:pointer;" data-view-student-detail="${escapeHtml(s.id)}" title="Bấm mở Hồ sơ thông tin chung">${escapeHtml(fam || '—')}</td>
          <td style="cursor:pointer;" data-view-student-detail="${escapeHtml(s.id)}" title="Bấm mở Hồ sơ thông tin chung">
            <strong style="color:#1b522c; text-decoration:underline;">${escapeHtml(giv || s.name)}</strong>
            ${renderStudentTagsBadges(s)}
          </td>
          <td>${escapeHtml(s.school || '—')}</td>
          <td>
            <div>${escapeHtml(s.parentContact?.name || 'Phụ huynh')}</div>
            <small style="color:#56785f; font-weight:600;">${escapeHtml(s.parentContact?.phone || '—')}</small>
          </td>
          <td style="white-space:nowrap;"><span class="enrollment-status-pill ${stClass}">${escapeHtml(stVal)}</span></td>
          <td class="col-allow-wrap plain-class-cell">${classPlainLinks}</td>
          <td style="text-align:center; white-space:nowrap;">
            <button type="button" class="primary-button" data-view-student-detail="${escapeHtml(s.id)}" style="padding:7px 12px; font-size:13px; font-weight:700;">Chi tiết</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.master-student-cb').forEach(cb => {
      cb.onchange = () => {
        if (cb.checked) selectedMasterStudentIds.add(cb.dataset.studentId);
        else selectedMasterStudentIds.delete(cb.dataset.studentId);
        updateMasterBulkBar();
      };
    });

    const selectAllMaster = $('#master-bulk-select-all');
    if (selectAllMaster) {
      selectAllMaster.checked = filtered.length > 0 && selectedMasterStudentIds.size === filtered.length;
      selectAllMaster.onchange = () => {
        if (selectAllMaster.checked) filtered.forEach(s => selectedMasterStudentIds.add(s.id));
        else selectedMasterStudentIds.clear();
        tbody.querySelectorAll('.master-student-cb').forEach(cb => cb.checked = selectAllMaster.checked);
        updateMasterBulkBar();
      };
    }

    updateMasterBulkBar();

    tbody.querySelectorAll('[data-open-student-class]').forEach(chip => {
      chip.onclick = () => {
        openStudentClassProfile(chip.dataset.openStudentClass, chip.dataset.classId);
      };
    });

    tbody.querySelectorAll('[data-view-student-detail]').forEach(btn => {
      btn.onclick = () => {
        if (ctx.openStudentProfile) {
          ctx.openStudentProfile(btn.dataset.viewStudentDetail, { from: 'directory' });
        } else {
          openStudentClassProfile(btn.dataset.viewStudentDetail);
        }
      };
    });
  }

  function exportAllStudentsCsv() {
    const students = getStudents();
    const catalog = getClassCatalog();
    const sorted = [...students].sort((a, b) => {
      const aGiven = a.givenName || splitVietnameseName(a.name).givenName;
      const bGiven = b.givenName || splitVietnameseName(b.name).givenName;
      const aFamily = a.familyName || splitVietnameseName(a.name).familyName;
      const bFamily = b.familyName || splitVietnameseName(b.name).familyName;
      return aGiven.localeCompare(bGiven, 'vi') || aFamily.localeCompare(bFamily, 'vi');
    });
    const headers = ['STT', 'Mã học sinh', 'Họ đệm', 'Tên', 'Họ và tên', 'Trường học', 'Tên phụ huynh', 'SĐT phụ huynh', 'Các lớp theo học', 'Học sinh mới'];
    const rows = sorted.map((s, idx) => {
      const classNames = (s.classIds || []).map(cid => {
        const c = catalog.find(x => x.id === cid);
        return c ? (c.code || c.name) : cid;
      }).join('; ');
      const fam = s.familyName || splitVietnameseName(s.name).familyName;
      const giv = s.givenName || splitVietnameseName(s.name).givenName;
      return [
        idx + 1,
        s.studentCode || '',
        fam,
        giv,
        s.name,
        s.school || '',
        s.parentContact?.name || '',
        s.parentContact?.phone || '',
        classNames,
        s.isNew || (s.tags && s.tags.includes('Mới')) ? 'Có' : 'Không'
      ];
    });
    exportToCsv(headers, rows, `danh-sach-hoc-sinh-toan-trung-tam-${new Date().toISOString().slice(0, 10)}.csv`);
    toast('Đã xuất danh sách toàn bộ học sinh theo alphabet (chuẩn UTF-8 mở trên Excel).');
  }

  // ----------------------------------------------------
  // TÍNH NĂNG MỚI: HỒ SƠ HỌC SINH THEO TỪNG LỚP (REQ 7)
  // ----------------------------------------------------
  function openStudentClassProfile(studentId, preferredClassId = null) {
    const student = studentById(studentId) || getStudents().find(s => s.id === studentId);
    if (!student) return;

    const catalog = getClassCatalog();
    const dialog = $('#student-class-profile-dialog');
    if (!dialog) return;

    // Check tutoring sessions for student
    const allTutoring = loadTutoringSessions();
    const studentTutoringSessions = allTutoring.filter(t => t.studentId === student.id || (t.studentName && t.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()));

    const classIds = student.classIds && student.classIds.length ? [...student.classIds] : [catalog[0]?.id || ''];
    if ((studentTutoringSessions.length > 0 || (student.classIds || []).includes(TUTORING_CLASS_ID)) && !classIds.includes(TUTORING_CLASS_ID)) {
      classIds.push(TUTORING_CLASS_ID);
    }

    let currentClassId = preferredClassId && classIds.includes(preferredClassId) ? preferredClassId : classIds[0];

    function renderContent(clsId) {
      currentClassId = clsId;
      const isTutoringClass = clsId === TUTORING_CLASS_ID;
      const targetClass = isTutoringClass ? TUTORING_CLASS_CONFIG : catalog.find(c => c.id === clsId);
      const metrics = isTutoringClass ? null : getStudentClassDeepDive(student, clsId);

      const classTabsHtml = classIds.length ? `
        <div style="margin-top:10px;">
          <small style="color:#556658; font-weight:600;"> Bấm vào từng lớp để xem chi tiết tình hình học tập:</small>
          <div class="student-class-tabs" style="margin-top:4px;">
            ${classIds.map(cid => {
              if (cid === TUTORING_CLASS_ID) {
                return `<button type="button" class="student-class-tab ${cid === currentClassId ? 'active' : ''}" data-switch-class-tab="${cid}" style="font-weight:700; ${cid === currentClassId ? 'background:#f3e8ff; color:#7e22ce; border-color:#c084fc;' : ''}">BOTRO (Bổ trợ & Gia sư)</button>`;
              }
              const c = catalog.find(x => x.id === cid);
              return `<button type="button" class="student-class-tab ${cid === currentClassId ? 'active' : ''}" data-switch-class-tab="${cid}" style="font-weight:700;">${escapeHtml(c?.code || cid)}</button>`;
            }).join('')}
          </div>
        </div>
      ` : '<div class="menu-empty" style="margin:12px 0; padding:12px;">Học sinh chưa được xếp vào lớp nào.</div>';

      const portraitHtml = student.photoURL ? `
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0;">
          <img src="${escapeHtml(student.photoURL)}" alt="Ảnh chân dung ${escapeHtml(student.name)}" class="profile-portrait" id="class-profile-portrait-img" />
          <div style="display:flex; gap:3px;">
            <label class="outline-button" style="padding:3px 7px; font-size:13.5px; cursor:pointer; font-weight:700; color:#215f33; background:#eaf5ec; border-color:#9dc7a5;">
               Đổi ảnh
              <input type="file" accept="image/*" id="class-profile-upload-input" style="display:none;" />
            </label>
            <button type="button" id="class-profile-remove-photo-btn" class="text-danger" style="padding:6px 10px; font-size:13.5px; background:none; border:none; cursor:pointer;">Xóa</button>
          </div>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0;">
          <div class="profile-portrait profile-portrait-placeholder"></div>
          <label class="primary-button" style="padding:4px 8px; font-size:13.5px; cursor:pointer; font-weight:600;">
             Tải ảnh chân dung
            <input type="file" accept="image/*" id="class-profile-upload-input" style="display:none;" />
          </label>
        </div>
      `;

      let bodyHtml = '';

      if (isTutoringClass) {
        // RENDER TUTORING AND 1-ON-1 SESSIONS VIEW
        const sessionsForStudent = studentTutoringSessions.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.startTime).localeCompare(String(a.startTime)));
        const giasuCount = sessionsForStudent.filter(s => s.type === 'giasu').length;
        const tutoringCount = sessionsForStudent.filter(s => s.type === 'tutoring').length;
        const makeupCount = sessionsForStudent.filter(s => s.type === 'makeup').length;
        const scoredSessions = sessionsForStudent.filter(s => s.score !== null && s.score !== undefined);
        const avgScore = scoredSessions.length ? (scoredSessions.reduce((sum, s) => sum + Number(s.score), 0) / scoredSessions.length).toFixed(1) : '—';
        const completedHW = sessionsForStudent.filter(s => s.homeworkStatus === 'completed').length;

        bodyHtml = `
          <div style="margin: 12px 0 6px;">
            <h4 style="margin:0; color:#233d31; font:700 13px Manrope,sans-serif;"> Hồ sơ học tập: <span style="color:#7e22ce; font-weight:800;">Lớp Bổ trợ & Gia sư (BOTRO)</span></h4>
            <small style="color:#728375;">Dạy kèm 1-kèm-1, bổ trợ hổng kiến thức & học bù · Đội ngũ Trợ giảng & Gia sư</small>
          </div>

          <div class="class-metrics-summary">
            <div class="class-metric-box">
              <span>Tổng số ca học</span>
              <strong>${sessionsForStudent.length}</strong>
              <small style="color:#667;">Tất cả ca đã học</small>
            </div>
            <div class="class-metric-box">
              <span>Gia sư 1-kèm-1</span>
              <strong style="color:#7e22ce;">${giasuCount}</strong>
              <small style="color:#667;">Buổi gia sư riêng</small>
            </div>
            <div class="class-metric-box">
              <span>Bổ trợ & Học bù</span>
              <strong style="color:#2563eb;">${tutoringCount + makeupCount}</strong>
              <small style="color:#667;">${tutoringCount} bổ trợ · ${makeupCount} bù</small>
            </div>
            <div class="class-metric-box">
              <span>Điểm TB kiểm tra</span>
              <strong style="color:#059669;">${avgScore}</strong>
              <small style="color:#667;">${scoredSessions.length} bài test nhanh</small>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; background:#fcf9ff; border:1px solid #e9d5ff; border-radius:8px; padding:8px 12px; margin:10px 0;">
            <div style="font-size:14px; color:#581c87;">
               Phiếu BTVN bổ trợ: <strong style="color:#7e22ce;">Đã hoàn thành ${completedHW}/${sessionsForStudent.length} phiếu</strong>
            </div>
            <div style="font-size:14px; color:#581c87;">
               Ghi nhận: <strong>Các ca bổ trợ & gia sư được lưu chung 1 lớp quản lý</strong>
            </div>
          </div>

          <div style="margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h5 style="margin:0; font:700 12px Manrope,sans-serif; color:#233d31;"> Lịch sử các ca bổ trợ & gia sư (${sessionsForStudent.length} buổi)</h5>
              <small style="color:#6a7b6f; font-size:13.5px;"> Bấm vào từng buổi để xem chi tiết kiểm tra BTVN và đánh giá</small>
            </div>
            ${sessionsForStudent.length ? `
              <div class="student-session-accordion">
                ${sessionsForStudent.map((s, idx) => {
                  const isOpen = idx === 0;
                  const typeLabel = s.type === 'giasu' ? 'Gia sư 1-kèm-1' : s.type === 'tutoring' ? 'Bổ trợ' : s.type === 'makeup' ? 'Học bù' : 'Học mới';
                  const typeClass = s.type === 'giasu' ? 'giasu' : s.type === 'tutoring' ? 'tutoring' : s.type === 'makeup' ? 'makeup' : 'new';
                  const hwStatusText = s.homeworkStatus === 'completed' ? '✓ Đã xong phiếu' : s.homeworkStatus === 'assigned_more' ? ' Giao thêm phiếu' : 'Chưa xong';

                  return `
                    <div class="student-session-item ${isOpen ? 'open' : ''}" data-session-date="${escapeHtml(s.id)}">
                      <div class="student-session-header" data-toggle-session="${escapeHtml(s.id)}">
                        <div class="student-session-title-wrap">
                          <span class="student-session-date"> ${escapeHtml(s.date)} (${escapeHtml(s.startTime)} - ${escapeHtml(s.endTime)})</span>
                          <span class="student-session-lesson">${escapeHtml(s.lessonContent)}</span>
                        </div>
                        <div class="student-session-badges">
                          <span class="tutoring-badge ${typeClass}">${escapeHtml(typeLabel)}</span>
                          <span class="status-pill done" style="background:#eaf5ec; color:#2e6d42;">${escapeHtml(hwStatusText)}</span>
                          ${s.score !== null && s.score !== undefined ? `<span class="room-chip" style="background:#ede9fe; color:#5b21b6; font-weight:700;">Test: ${s.score}đ</span>` : ''}
                          <span class="student-session-arrow">▼</span>
                        </div>
                      </div>
                      <div class="student-session-details">
                        <div class="session-detail-group">
                          <h6> Chi tiết ca học & Phụ trách</h6>
                          <div class="session-detail-row">
                            <span>Phân loại:</span>
                            <strong style="color:#7e22ce;">${escapeHtml(typeLabel)}</strong>
                          </div>
                          <div class="session-detail-row">
                            <span>Người kèm / Phụ trách:</span>
                            <strong>${escapeHtml(s.assistantName)}</strong>
                          </div>
                          <div class="session-detail-row">
                            <span>Thời gian:</span>
                            <span>${escapeHtml(s.date)} · ${escapeHtml(s.startTime)}–${escapeHtml(s.endTime)}</span>
                          </div>
                          <div class="session-detail-row">
                            <span>Lớp chính của HS:</span>
                            <span>${escapeHtml(s.studentClass || '—')}</span>
                          </div>
                        </div>

                        <div class="session-detail-group">
                          <h6> Kiểm tra BTVN buổi trước & Bài dạy</h6>
                          <div class="session-detail-row" style="background:#fffbeb; padding:6px 8px; border-radius:6px; border:1px solid #fef3c7;">
                            <span style="color:#b45309; font-weight:700;">Kiểm tra BTVN trước:</span>
                            <strong style="color:#1f2937;">${escapeHtml(s.previousHomeworkCheck || 'Đã kiểm tra')}</strong>
                          </div>
                          <div class="session-detail-row" style="margin-top:6px;">
                            <span>Nội dung bài dạy:</span>
                            <span>${escapeHtml(s.lessonContent)}</span>
                          </div>
                          <div class="session-detail-row">
                            <span>Phiếu bài tập buổi này:</span>
                            <strong>${escapeHtml(hwStatusText)}</strong>
                          </div>
                          ${s.score !== null && s.score !== undefined ? `
                            <div class="session-detail-row">
                              <span>Điểm bài test nhanh:</span>
                              <strong style="color:#5b21b6;">${s.score} / 10 điểm</strong>
                            </div>
                          ` : ''}
                          ${s.evaluation ? `
                            <div class="session-note-bubble" style="margin-top:8px;">
                              <strong>Nhận xét & Tiến bộ:</strong> "${escapeHtml(s.evaluation)}"
                            </div>
                          ` : '<small style="color:#94a397; font-style:italic;">Không có nhận xét thêm.</small>'}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<div class="menu-empty" style="margin:16px 0; padding:16px;">Học sinh chưa có buổi học bổ trợ hoặc gia sư nào được ghi nhận.</div>'}
          </div>
        `;
      } else {
        // REGULAR CLASS VIEW
        bodyHtml = `
          <div style="margin: 12px 0 6px;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div>
                <h4 style="margin:0; color:#233d31; font:700 13px Manrope,sans-serif;"> Tình hình học tại lớp: <span style="color:#215f33; font-weight:800;">${escapeHtml(targetClass?.code || clsId)}</span></h4>
                <small style="color:#728375;">${escapeHtml(formatBirthYearLabel(targetClass?.grade))} · GV: ${escapeHtml(targetClass?.teacherName || '—')} · TA: ${escapeHtml(targetClass?.assistantName || '—')}</small>
              </div>
            </div>
          </div>

          <div class="class-metrics-summary">
            <div class="class-metric-box">
              <span>Tỉ lệ có mặt</span>
              <strong>${metrics.totalSessionsRecorded ? Math.round((metrics.presentCount / metrics.totalSessionsRecorded) * 100) : 100}%</strong>
              <small style="color:#667;">${metrics.presentCount}/${metrics.totalSessionsRecorded} ca</small>
            </div>
            <div class="class-metric-box">
              <span>Đi muộn</span>
              <strong style="color:#bc7b26;">${metrics.lateCount}</strong>
              <small style="color:#667;">Tổng ${metrics.totalLateMinutes} phút</small>
            </div>
            <div class="class-metric-box">
              <span>Vắng mặt</span>
              <strong style="color:#c13b30;">${metrics.absentCount}</strong>
              <small style="color:#667;">Buổi nghỉ</small>
            </div>
            <div class="class-metric-box">
              <span>Điểm TB kiểm tra</span>
              <strong>${metrics.avgScore}</strong>
              <small style="color:#667;">${metrics.scores.length} bài đã chấm</small>
            </div>
          </div>

          <!-- Overview bar for BTVN and Tests -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; background:#fbfdfb; border:1px solid #dce5dd; border-radius:8px; padding:8px 12px; margin:10px 0;">
            <div style="font-size:14px; color:#3b4e40;">
               BTVN: <strong style="color:#215f33;">Đã nộp ${metrics.hwSubmitted} bài</strong> · <strong style="color:${metrics.hwMissing ? '#c13b30' : '#495f50'};">Chưa nộp ${metrics.hwMissing} bài</strong>
            </div>
            <div style="font-size:14px; color:#3b4e40;">
               Bài kiểm tra: <strong>${metrics.scores.length} bài</strong> · Điểm TB: <strong style="color:#2563eb;">${metrics.avgScore}</strong>
            </div>
          </div>

          <!-- Interactive Session Deep Dive -->
          <div style="margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h5 style="margin:0; font:700 12px Manrope,sans-serif; color:#233d31;"> Lịch sử chi tiết từng buổi học (${(metrics.detailedSessions || []).length} buổi)</h5>
              <small style="color:#6a7b6f; font-size:13.5px;"> Bấm vào từng buổi để xem chi tiết học tập & vị trí ngồi</small>
            </div>
            ${(metrics.detailedSessions && metrics.detailedSessions.length) ? `
              <div class="student-session-accordion">
                ${metrics.detailedSessions.map((s, idx) => {
                  const isOpen = idx === 0;
                  const attBadge = s.attendance.status === 'present'
                    ? '<span class="status-pill done" style="background:#eaf5ec; color:#2e6d42; font-weight:700;">✓ Có mặt</span>'
                    : s.attendance.status === 'late'
                      ? `<span class="status-pill" style="background:#fef3c7; color:#92400e; font-weight:700;"> Muộn ${s.attendance.minutesLate || 10}p</span>`
                      : '<span class="status-pill" style="background:#fee2e2; color:#991b1b; font-weight:700;">× Vắng mặt</span>';

                  const hwBadge = s.homework.status === 'submitted' || s.homework.status === 'graded'
                    ? `<span class="status-pill done" style="background:#eaf5ec; color:#2e6d42;">BTVN: Đã nộp ${s.homework.score !== null ? `(${s.homework.score}đ)` : ''}</span>`
                    : s.homework.status === 'not_submitted'
                      ? `<span class="status-pill" style="background:#fee2e2; color:#991b1b;">BTVN: Chưa nộp ${s.homework.reason ? `(${escapeHtml(s.homework.reason)})` : ''}</span>`
                      : '<span class="status-pill" style="background:#f3f4f6; color:#6b7280;">BTVN: Chưa thu</span>';

                  const testBadge = s.testScore !== null && s.testScore !== undefined
                    ? `<span class="room-chip" style="background:#ede9fe; color:#5b21b6; font-weight:700;">Test: ${s.testScore}đ</span>`
                    : '';

                  return `
                    <div class="student-session-item ${isOpen ? 'open' : ''}" data-session-date="${escapeHtml(s.date)}">
                      <div class="student-session-header" data-toggle-session="${escapeHtml(s.date)}">
                        <div class="student-session-title-wrap">
                          <span class="student-session-date"> ${escapeHtml(s.shortDate)}</span>
                          <span class="student-session-lesson">${escapeHtml(s.lessonTitle)}</span>
                        </div>
                        <div class="student-session-badges">
                          ${attBadge}
                          ${hwBadge}
                          ${testBadge}
                          <span class="student-session-arrow">▼</span>
                        </div>
                      </div>
                      <div class="student-session-details">
                        <div class="session-detail-group">
                          <h6> Tình hình học tập trong ca</h6>
                          <div class="session-detail-row">
                            <span>Điểm danh:</span>
                            <strong>${s.attendance.status === 'present' ? 'Có mặt đúng giờ' : s.attendance.status === 'late' ? `Đi muộn ${s.attendance.minutesLate || 10} phút${s.attendance.time ? ` (${s.attendance.time})` : ''}` : 'Vắng mặt'}</strong>
                          </div>
                          <div class="session-detail-row">
                            <span>Bài tập về nhà:</span>
                            <strong>${s.homework.status === 'submitted' || s.homework.status === 'graded' ? `Đã nộp ${s.homework.score !== null ? `· Chấm: ${s.homework.score}đ` : ''}` : s.homework.status === 'not_submitted' ? `Chưa nộp (${escapeHtml(s.homework.reason || 'Quên mang')})` : 'Chưa ghi nhận'}</strong>
                          </div>
                          ${s.testScore !== null && s.testScore !== undefined ? `
                            <div class="session-detail-row">
                              <span>Bài kiểm tra:</span>
                              <strong style="color:#5b21b6;">${s.testScore} / 10 điểm</strong>
                            </div>
                          ` : ''}
                          <div class="session-detail-row">
                            <span>Giáo viên / TA:</span>
                            <span>${escapeHtml(s.teacherName || targetClass?.teacherName || '—')} · ${escapeHtml(s.assistantName || targetClass?.assistantName || '—')}</span>
                          </div>
                        </div>

                        <div class="session-detail-group">
                          <h6> Vị trí ngồi & Nhận xét buổi học</h6>
                          <div class="session-detail-row">
                            <span>Vị trí chỗ ngồi:</span>
                            <strong>${s.seat.aisle ? `Dãy ${s.seat.aisle} · Bàn ${s.seat.desk} (Ghế ${s.seat.position})` : 'Chưa có vị trí'}</strong>
                          </div>
                          <div style="display:flex; flex-wrap:wrap; gap:8px; margin: 6px 0;">
                            <button type="button" class="primary-button btn-open-session-profile" data-session-prof-class="${escapeHtml(clsId)}" data-session-prof-date="${escapeHtml(s.date)}" data-session-prof-student="${escapeHtml(student.id)}" style="flex:1 1 180px; padding:8px 12px; font-size:13.5px; font-weight:700;">
                              Chỉnh sửa dữ liệu buổi học này
                            </button>
                            <button type="button" class="outline-button btn-view-seat-map" data-view-seat-class="${escapeHtml(clsId)}" data-view-seat-date="${escapeHtml(s.date)}" data-view-seat-student="${escapeHtml(student.id)}" style="flex:1 1 180px; padding:8px 12px; font-size:13.5px; font-weight:700; color:#215f33; background:#eaf5ec; border-color:#9dc7a5;">
                              Xem vị trí trên sơ đồ lớp ↗
                            </button>
                          </div>
                          ${s.note ? `
                            <div class="session-note-bubble">
                              <strong>Nhận xét học sinh:</strong> "${escapeHtml(s.note)}"
                            </div>
                          ` : '<small style="color:#94a397; font-style:italic;">Không có nhận xét riêng buổi này.</small>'}
                          ${s.classNote ? `
                            <div style="font-size:13.5px; color:#6b7c70; margin-top:4px;">
                              <span style="font-weight:600;">Ghi chú chung ca:</span> ${escapeHtml(s.classNote)}
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<div class="menu-empty" style="margin:16px 0; padding:16px;">Chưa có dữ liệu buổi học nào cho học sinh trong lớp này.</div>'}
          </div>
        `;
      }

      const html = `
        <div class="student-profile-header" style="align-items:flex-start; gap:16px;">
          ${portraitHtml}
          <div style="flex:1; min-width:0;">
            <h3 style="margin:0 0 4px; font:800 16.5px Manrope,sans-serif; color:#233d31;">${escapeHtml(student.name)} ${student.isNew ? '<span class="student-tag new-tag">MỚI</span>' : ''}</h3>
            <p style="margin:2px 0; font-size:14px; color:#5c6b60;">Mã HS: <strong>${escapeHtml(student.studentCode || '—')}</strong> · Trường: <strong>${escapeHtml(student.school || '—')}</strong></p>
            <p style="margin:2px 0; font-size:14px; color:#5c6b60;">Phụ huynh: <strong>${escapeHtml(student.parentContact?.name || '—')}</strong> · SĐT: <strong>${escapeHtml(student.parentContact?.phone || '—')}</strong></p>
            ${student.officeNotes ? `<p style="margin:2px 0; font-size:13.5px; color:#4b5563;">Ghi chú văn phòng: <em>${escapeHtml(student.officeNotes)}</em></p>` : ''}
          </div>
        </div>

        ${classTabsHtml}

        <div class="class-learning-note-box" style="margin:12px 0; padding:12px 14px; background:#f8fbf8; border:1px solid #d5e2d7; border-radius:10px;">
          <label class="field-label" style="margin:0;">
            <strong>Ghi chú học tập (Ghi chú học lực) riêng tại lớp ${escapeHtml(targetClass?.code || targetClass?.name || currentClassId)}</strong>
            <textarea id="class-profile-learning-note-input" rows="2" placeholder="Nhập ghi chú học lực, thái độ học tập riêng của học sinh tại lớp này..." style="margin-top:6px; width:100%;">${escapeHtml((student.classLearningNotes && student.classLearningNotes[currentClassId]) ?? student.learningNotes ?? '')}</textarea>
          </label>
          <small style="color:#2e6d42; font-weight:700; display:block; margin-top:4px;">Tự động lưu khi nhập</small>
        </div>

        ${bodyHtml}
      `;

      $('#student-class-profile-content').innerHTML = html;

      // Wire tabs
      $('#student-class-profile-content').querySelectorAll('[data-switch-class-tab]').forEach(btn => {
        btn.onclick = () => renderContent(btn.dataset.switchClassTab);
      });

      // Wire class-specific learning note auto-save
      const classLearnNoteInp = $('#class-profile-learning-note-input');
      if (classLearnNoteInp) {
        classLearnNoteInp.addEventListener('input', () => {
          student.classLearningNotes = student.classLearningNotes || {};
          student.classLearningNotes[currentClassId] = classLearnNoteInp.value;
          student.learningNotes = classLearnNoteInp.value;
          const allStu = getStudents();
          const sIdx = allStu.findIndex(s => s.id === student.id);
          if (sIdx >= 0) {
            allStu[sIdx].classLearningNotes = student.classLearningNotes;
            allStu[sIdx].learningNotes = student.learningNotes;
          }
          saveStudentRecords(allStu, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
        });
      }

      // Wire button to open Kiểu 3 (Session-level Student Profile with Inline Edit)
      $('#student-class-profile-content').querySelectorAll('.btn-open-session-profile').forEach(btn => {
        btn.onclick = (ev) => {
          ev.stopPropagation();
          dialog.close();
          if (window.openStudentSessionProfile) {
            window.openStudentSessionProfile(btn.dataset.sessionProfStudent, btn.dataset.sessionProfClass, btn.dataset.sessionProfDate);
          }
        };
      });

      // Wire accordion toggle
      $('#student-class-profile-content').querySelectorAll('[data-toggle-session]').forEach(header => {
        header.onclick = () => {
          const item = header.closest('.student-session-item');
          if (item) item.classList.toggle('open');
        };
      });

      // Wire seat map viewer button
      $('#student-class-profile-content').querySelectorAll('.btn-view-seat-map').forEach(btn => {
        btn.onclick = () => {
          const viewClassId = btn.dataset.viewSeatClass;
          const viewDate = btn.dataset.viewSeatDate;
          const viewStudentId = btn.dataset.viewSeatStudent;
          const viewCls = catalog.find(c => c.id === viewClassId);

          dialog.close();
          if (ctx.enterClass) {
            ctx.enterClass(viewClassId, viewDate, true, 'seating');
            if (ctx.navigateTo) {
              ctx.navigateTo(`students/${student.studentCode || viewStudentId}/class/${viewCls?.code || viewClassId}/history/${viewDate}/map`);
            }
          }
        };
      });

      // Wire photo upload in class profile
      const classUploadInput = $('#class-profile-upload-input');
      if (classUploadInput) {
        classUploadInput.onchange = (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            toast('Vui lòng chọn file hình ảnh (PNG, JPG, WebP...).');
            return;
          }
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            const dataUrl = loadEvt.target.result;
            student.photoURL = dataUrl;
            const allStu = getStudents();
            const sIdx = allStu.findIndex(s => s.id === student.id);
            if (sIdx >= 0) allStu[sIdx].photoURL = dataUrl;
            saveStudentRecords(allStu, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
            render();
            toast('Đã cập nhật ảnh chân dung học sinh thành công.');
            renderContent(currentClassId);
          };
          reader.readAsDataURL(file);
        };
      }

      // Wire remove photo button in class profile
      const classRemovePhotoBtn = $('#class-profile-remove-photo-btn');
      if (classRemovePhotoBtn) {
        classRemovePhotoBtn.onclick = () => {
          if (!confirm('Bạn có chắc muốn xóa ảnh chân dung này?')) return;
          student.photoURL = null;
          const allStu = getStudents();
          const sIdx = allStu.findIndex(s => s.id === student.id);
          if (sIdx >= 0) allStu[sIdx].photoURL = null;
          saveStudentRecords(allStu, ctx.getMakeupStudents ? ctx.getMakeupStudents() : []);
          render();
          toast('Đã xóa ảnh chân dung.');
          renderContent(currentClassId);
        };
      }
    }

    renderContent(currentClassId);

    const editBtn = $('#edit-student-master-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        dialog.close();
        if (ctx.openStudentProfile) {
          ctx.openStudentProfile(student.id, { from: 'class-profile', classId: currentClassId });
        } else {
          toast(`Đang mở hồ sơ học sinh ${student.name}`);
        }
      };
    }

    dialog.showModal();
  }

  // Hook open & close session buttons
  $('#open-session-btn')?.addEventListener('click', handleOpenSession);
  $('#close-session-btn')?.addEventListener('click', handleCloseSessionPrompt);
  $('#close-close-session-dialog')?.addEventListener('click', () => $('#close-session-dialog')?.close());
  $('#cancel-close-session-btn')?.addEventListener('click', () => $('#close-session-dialog')?.close());
  $('#confirm-close-session-btn')?.addEventListener('click', confirmCloseSession);
  $('#checklist-close-session-btn')?.addEventListener('click', handleCloseSessionPrompt);
  $('#close-class-history-dialog')?.addEventListener('click', () => $('#class-history-dialog')?.close());
  $('#close-class-history-btn')?.addEventListener('click', () => $('#class-history-dialog')?.close());

  // Hook no-homework checkbox
  $('#session-no-hw-checkbox')?.addEventListener('change', handleNoHomeworkToggle);

  // Hook staff detail dialog buttons
  $('#close-staff-detail')?.addEventListener('click', () => $('#staff-detail-dialog')?.close());
  $('#close-staff-detail-btn')?.addEventListener('click', () => $('#staff-detail-dialog')?.close());


  // v1.9: Bind Duration & 5-Minute Time Rounding for Tutoring and Schedule Makeup dialogs + Staff Search in Schedule Dialog
  const bindTimeSync = (params) => {
    $(params.startSel)?.addEventListener('change', () => window.__timeHelpers?.syncDurationUI?.(params));
    $(params.startSel)?.addEventListener('blur', () => window.__timeHelpers?.syncDurationUI?.(params));
    $(params.durationSel)?.addEventListener('change', () => window.__timeHelpers?.syncDurationUI?.(params));
    $(params.customInputSel)?.addEventListener('input', () => window.__timeHelpers?.syncDurationUI?.(params));
    $(params.customInputSel)?.addEventListener('change', () => window.__timeHelpers?.syncDurationUI?.(params));
  };
  bindTimeSync({
    startSel: '#tutoring-start-time',
    endSel: '#tutoring-end-time',
    durationSel: '#tutoring-duration-select',
    customWrapSel: '#tutoring-duration-custom-wrap',
    customInputSel: '#tutoring-duration-custom'
  });
  bindTimeSync({
    startSel: '#sched-makeup-start',
    endSel: '#sched-makeup-end',
    durationSel: '#sched-makeup-duration',
    customWrapSel: '#sched-makeup-duration-custom-wrap',
    customInputSel: '#sched-makeup-duration-custom',
    previewSel: '#sched-makeup-time-preview'
  });

  function renderScheduleStaffOptions(kind, query = '') {
    const isMakeup = kind === 'makeup';
    const selectedArr = isMakeup ? schedMakeupAssistants : schedNextAssistants;
    const optionsHost = $(isMakeup ? '#sched-makeup-assistant-options' : '#sched-next-assistant-options');
    const searchInp = $(isMakeup ? '#sched-makeup-assistant-search' : '#sched-next-assistant-search');
    if (!optionsHost) return;
    const master = getMasterData();
    const pool = (master.employees || []).filter(e => e.role === 'assistant' && !selectedArr.includes(e.id));
    const q = String(query || '').trim().toLowerCase();
    const matches = q
      ? pool.filter(e => `${e.name || ''} ${e.code || ''}`.toLowerCase().includes(q))
      : pool;

    if (!matches.length) {
      optionsHost.innerHTML = `<div class="empty-list">${q ? 'Không tìm thấy trợ giảng phù hợp.' : 'Đã chọn hết trợ giảng.'}</div>`;
      return;
    }
    optionsHost.innerHTML = matches.map(emp => `
      <button type="button" class="student-option staff-search-option" data-sched-ta-id="${escapeHtml(emp.id)}">
        <span class="student-option-name"><strong>${escapeHtml(emp.name)}</strong> <small>· Mã: ${escapeHtml(emp.code || '—')}</small></span>
        <span class="student-check">Chọn</span>
      </button>
    `).join('');
    optionsHost.querySelectorAll('[data-sched-ta-id]').forEach(btn => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = btn.dataset.schedTaId;
        if (id && !selectedArr.includes(id)) {
          selectedArr.push(id);
          if (isMakeup) renderSchedMakeupAssistants();
          else renderSchedNextAssistants();
        }
        if (searchInp) {
          searchInp.value = '';
          searchInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
        optionsHost.hidden = true;
      };
    });
  }

  for (const [kind, inpSel, optSel] of [
    ['makeup', '#sched-makeup-assistant-search', '#sched-makeup-assistant-options'],
    ['next', '#sched-next-assistant-search', '#sched-next-assistant-options']
  ]) {
    const inp = $(inpSel);
    const opt = $(optSel);
    if (!inp || !opt) continue;
    inp.addEventListener('focus', () => {
      renderScheduleStaffOptions(kind, inp.value);
      opt.hidden = false;
    });
    inp.addEventListener('input', () => {
      renderScheduleStaffOptions(kind, inp.value);
      opt.hidden = false;
    });
  }

  // Hook session schedule dialog buttons
  $('#close-session-schedule')?.addEventListener('click', () => $('#session-schedule-dialog')?.close());
  $('#cancel-sched-makeup-btn')?.addEventListener('click', () => $('#session-schedule-dialog')?.close());
  $('#cancel-sched-next-btn')?.addEventListener('click', () => $('#session-schedule-dialog')?.close());
  $('#add-sched-makeup-assistant')?.addEventListener('click', () => {
    const choice = $('#sched-makeup-assistant-choice');
    if (choice?.value && !schedMakeupAssistants.includes(choice.value)) {
      schedMakeupAssistants.push(choice.value);
      renderSchedMakeupAssistants();
    }
  });
  $('#add-sched-next-assistant')?.addEventListener('click', () => {
    const choice = $('#sched-next-assistant-choice');
    if (choice?.value && !schedNextAssistants.includes(choice.value)) {
      schedNextAssistants.push(choice.value);
      renderSchedNextAssistants();
    }
  });

  $('#add-makeup-session-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const classId = $('#sched-class-id').value;
    const date = $('#sched-makeup-date').value;
    const startTime = $('#sched-makeup-start').value;
    const endTime = $('#sched-makeup-end').value;
    const room = $('#sched-makeup-room').value.trim();
    const category = $('#sched-makeup-category').value;
    const teacherId = $('#sched-makeup-teacher').value;
    const note = $('#sched-makeup-note').value.trim();

    if (!classId || !date) return;

    const sessionChanges = ctx.sessionChanges ? ctx.sessionChanges() : {};
    const key = ctx.sessionChangeKey ? ctx.sessionChangeKey(classId, date) : `${classId}:${date}`;

    sessionChanges[key] = {
      classId,
      date,
      startTime,
      endTime,
      room,
      category,
      teacherId,
      teacherIds: teacherId ? [teacherId] : [],
      assistantIds: [...schedMakeupAssistants],
      note: note || (category === 'extra' ? 'Buổi học tăng cường' : 'Buổi học bù'),
      status: 'makeup',
      updatedAt: Date.now(),
      updatedBy: ctx.getSignedInAccount()?.employeeId || ''
    };

    if (ctx.saveClassSessionChanges) ctx.saveClassSessionChanges(sessionChanges);
    $('#session-schedule-dialog')?.close();
    toast(`Đã thêm buổi học bù/tăng cường ngày ${date} cho lớp!`);
    renderMainMenu();
  });

  $('#edit-next-session-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const classId = $('#sched-class-id').value;
    const date = $('#sched-next-date').value;
    const status = $('#sched-next-status').value;
    const teacherId = $('#sched-next-teacher').value;
    const note = $('#sched-next-note').value.trim();

    if (!classId || !date) return;

    const sessionChanges = ctx.sessionChanges ? ctx.sessionChanges() : {};
    const key = ctx.sessionChangeKey ? ctx.sessionChangeKey(classId, date) : `${classId}:${date}`;

    sessionChanges[key] = {
      classId,
      date,
      status: status === 'cancel' ? 'cancelled' : status === 'holiday_makeup' ? 'cancelled' : 'scheduled',
      teacherId,
      teacherIds: teacherId ? [teacherId] : [],
      assistantIds: [...schedNextAssistants],
      note: note || (status === 'staff_change' ? 'Điều chỉnh nhân sự' : status === 'cancel' ? 'Nghỉ học' : ''),
      updatedAt: Date.now(),
      updatedBy: ctx.getSignedInAccount()?.employeeId || ''
    };

    if (ctx.saveClassSessionChanges) ctx.saveClassSessionChanges(sessionChanges);
    $('#session-schedule-dialog')?.close();
    toast(`Đã lưu điều chỉnh nhân sự & trợ giảng cho buổi học tiếp theo (${date})!`);
    renderMainMenu();
  });

  // Hook student class profile dialog buttons
  $('#close-student-class-profile')?.addEventListener('click', () => $('#student-class-profile-dialog')?.close());
  $('#close-student-class-profile-btn')?.addEventListener('click', () => $('#student-class-profile-dialog')?.close());

  // Hook master student directory filters
  $('#master-student-search')?.addEventListener('input', renderMasterStudentDirectory);
  $('#master-grade-filter')?.addEventListener('change', renderMasterStudentDirectory);
  $('#master-class-filter')?.addEventListener('change', renderMasterStudentDirectory);
  $('#export-all-students-csv-btn')?.addEventListener('click', exportAllStudentsCsv);


  // ----------------------------------------------------
  // TÍNH NĂNG: XEM LỊCH SỬ CÁC BUỔI TRƯỚC CỦA LỚP HỌC
  // ----------------------------------------------------
  function openClassHistoryDialog(classId) {
    const catalog = getClassCatalog();
    const cls = catalog.find(c => c.id === classId) || { id: classId, name: classId, code: classId };

    const dialog = $('#class-history-dialog');
    if (!dialog) return;

    $('#class-history-title').textContent = `Lịch sử các buổi học · ${cls.code || cls.id} (${cls.name})`;
    $('#class-history-sub').textContent = `${formatBirthYearLabel(cls.grade)} · Phòng: ${cls.room || '—'} · GV: ${cls.teacherName || '—'} · TA: ${cls.assistantName || '—'}`;

    const allHistory = loadSessionHistory();
    const classSessions = allHistory.filter(s => s.classId === classId).sort((a, b) => b.date.localeCompare(a.date));

    const listContainer = $('#class-history-sessions-list');
    const detailContainer = $('#class-history-detail-content');

    function renderSelectedSessionDetail(session) {
      if (!session) {
        detailContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#87968a;">Chọn một buổi học bên trái để xem lại thông tin chi tiết.</div>';
        return;
      }

      const dateFormatted = new Date(`${session.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
      const isClosed = session.status === 'closed';
      const statusBadge = isClosed 
        ? '<span class="status-pill done" style="background:#eaf5ec; color:#2e6d42; font-weight:700;">✓ Đã đóng ca</span>'
        : '<span class="status-pill" style="background:#fef3c7; color:#92400e; font-weight:700;">● Đang hoạt động</span>';

      const stats = session.stats || {};
      const students = session.studentsSnapshot || [];
      const checklist = session.checklistSummary || [];

      detailContainer.innerHTML = `
        <div style="background:#fff; border:1px solid #e1e8e2; border-radius:10px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; border-bottom:1px solid #eef2ee; padding-bottom:12px;">
            <div>
              <div style="font-size:14px; color:#5c6e60; text-transform:uppercase; font-weight:700;">${escapeHtml(dateFormatted)}</div>
              <h3 style="margin:4px 0; color:#223d2b; font-size:16px;">${escapeHtml(session.lessonTitle || 'Buổi học ' + session.date)}</h3>
              <p style="margin:2px 0; font-size:14px; color:#78867c;">Phòng: <strong>${escapeHtml(session.room || cls.room || '—')}</strong> · GV: <strong>${escapeHtml(session.teacherName || cls.teacherName || '—')}</strong> · TA: <strong>${escapeHtml(session.assistantName || cls.assistantName || '—')}</strong></p>
            </div>
            <div style="text-align:right;">
              <div>${statusBadge}</div>
              <button type="button" class="primary-button" data-reopen-class-date="${escapeHtml(session.date)}" style="margin-top:8px; padding:7px 12px; font-size:14px; font-weight:700; background:#2e6d42;">
                ▶ Mở ca học này trên sơ đồ
              </button>
            </div>
          </div>

          <!-- KPI Tóm tắt -->
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin:14px 0;">
            <div style="background:#f7faf8; border:1px solid #e4ece5; border-radius:8px; padding:10px; text-align:center;">
              <span style="font-size:13.5px; color:#687c6e; display:block;">Có mặt / Sĩ số</span>
              <strong style="font-size:16px; color:#2e6d42;">${stats.present || 0}/${stats.total || students.length || 0}</strong>
            </div>
            <div style="background:#fffbf5; border:1px solid #f4e8d8; border-radius:8px; padding:10px; text-align:center;">
              <span style="font-size:13.5px; color:#92400e; display:block;">Đi muộn</span>
              <strong style="font-size:16px; color:#b45309;">${stats.late || 0}</strong>
            </div>
            <div style="background:#fef2f2; border:1px solid #fee2e2; border-radius:8px; padding:10px; text-align:center;">
              <span style="font-size:13.5px; color:#b91c1c; display:block;">Vắng mặt</span>
              <strong style="font-size:16px; color:#dc2626;">${stats.absent || 0}</strong>
            </div>
            <div style="background:#f0fdf4; border:1px solid #dcfce7; border-radius:8px; padding:10px; text-align:center;">
              <span style="font-size:13.5px; color:#15803d; display:block;">BTVN đã thu</span>
              <strong style="font-size:16px; color:#16a34a;">${stats.homeworkDone || 0}</strong>
            </div>
          </div>

          <!-- Ghi chú chung của ca -->
          ${session.finalNote || session.notes || session.sessionNote ? `
            <div style="background:#f9fbf9; border-left:3px solid #4a885e; padding:10px 12px; border-radius:4px; margin-bottom:14px; font-size:14px; color:#445749; line-height:1.5;">
              <strong>Ghi chú buổi học:</strong> ${escapeHtml(session.finalNote || session.notes || session.sessionNote)}
            </div>
          ` : ''}

          <!-- Danh sách học sinh trong buổi -->
          <h4 style="margin:14px 0 8px; font-size:15px; color:#324436;">Tình hình học sinh trong buổi (${students.length} học sinh)</h4>
          <div class="attendance-table-wrap">
            <table class="attendance-report-table" style="font-size:14px;">
              <thead>
                <tr>
                  <th>Họ đệm</th>
                  <th>Tên</th>
                  <th>Mã HS</th>
                  <th>Điểm danh</th>
                  <th>BTVN</th>
                  <th>Điểm BTVN</th>
                  <th>Điểm Test</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${students.length ? students.map((s) => {
                  const parts = splitVietnameseName(s.studentName || s.name || '');
                  const att = s.attendance?.status === 'present' ? '<span class="student-state state-present">Có mặt</span>' : s.attendance?.status === 'late' ? '<span class="student-state state-late">Đi muộn</span>' : '<span class="student-state state-missing">Vắng</span>';
                  const hw = s.homework?.status === 'submitted' ? '<span class="student-state state-collected">Đã nộp</span>' : s.homework?.status === 'not_submitted' ? `<span class="student-state state-missing">Chưa nộp (${escapeHtml(s.homework?.reason || 'Quên')})</span>` : 'Chưa thu';
                  return `
                    <tr>
                      <td>${escapeHtml(s.familyName || parts.familyName || '—')}</td>
                      <td><strong>${escapeHtml(s.givenName || parts.givenName || s.studentName || s.name || '—')}</strong></td>
                      <td>${escapeHtml(s.studentCode || '—')}</td>
                      <td>${att}</td>
                      <td>${hw}</td>
                      <td style="text-align:center;">${escapeHtml(s.homework?.score ?? '—')}</td>
                      <td style="text-align:center;">${escapeHtml(s.testScore ?? '—')}</td>
                      <td>${escapeHtml(s.note || s.sessionNote || '—')}</td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="8" style="text-align:center; padding:12px; color:#8d9b90;">Chưa lưu danh sách chi tiết học sinh cho buổi này.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- Checklist đã thực hiện -->
          ${checklist.length ? `
            <h4 style="margin:16px 0 8px; font-size:15px; color:#324436;">Các mục checklist đã hoàn tất trong ca</h4>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${checklist.map(item => `
                <span class="status-pill done" style="background:#eaf5ec; color:#2e6d42; font-size:13.5px;">
                  ✓ ${escapeHtml(item.label || item)} ${item.doneBy ? `(${escapeHtml(item.doneBy)})` : ''}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;

      // Handle "Mở ca học này trên sơ đồ"
      const reopenBtn = detailContainer.querySelector('[data-reopen-class-date]');
      if (reopenBtn) {
        reopenBtn.onclick = () => {
          dialog.close();
          if (ctx.enterClass) {
            ctx.enterClass(classId, session.date);
          }
        };
      }
    }

    // Render sidebar session cards
    if (!classSessions.length) {
      listContainer.innerHTML = '<div style="padding:20px 10px; color:#8a998c; font-size:14px; text-align:center;">Lớp chưa có buổi học nào được ghi nhận trong lịch sử.</div>';
      renderSelectedSessionDetail(null);
    } else {
      listContainer.innerHTML = classSessions.map((s, idx) => {
        const isClosed = s.status === 'closed';
        const dateDisplay = new Date(`${s.date}T00:00:00`).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit', year: 'numeric' });
        return `
          <div class="class-history-session-item ${idx === 0 ? 'active' : ''}" data-history-session-id="${escapeHtml(s.id)}" style="cursor:pointer; padding:10px 12px; border:1px solid #dce5dd; border-radius:8px; background:${idx === 0 ? '#edf6ee' : '#fff'}; transition:0.15s;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong style="color:#21432c; font-size:14.5px;">${escapeHtml(dateDisplay)}</strong>
              <span style="font-size:12.5px; padding:6px 10px; border-radius:8px; font-weight:700; ${isClosed ? 'background:#eaf5ec; color:#2e6d42;' : 'background:#fef3c7; color:#92400e;'}">
                ${isClosed ? 'Đã đóng' : 'Đang mở'}
              </span>
            </div>
            <p style="margin:0 0 4px; font-size:14px; color:#495f50; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(s.lessonTitle || 'Buổi học ' + s.date)}
            </p>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; color:#788b7d;">
              <span>Sĩ số: ${s.stats?.present || 0}/${s.stats?.total || s.studentsSnapshot?.length || 0}</span>
              <span>BTVN: ${s.stats?.homeworkDone || 0}</span>
            </div>
          </div>
        `;
      }).join('');

      // Attach click events on sidebar session cards
      listContainer.querySelectorAll('[data-history-session-id]').forEach(item => {
        item.onclick = () => {
          listContainer.querySelectorAll('.class-history-session-item').forEach(el => {
            el.style.background = '#fff';
            el.classList.remove('active');
          });
          item.style.background = '#edf6ee';
          item.classList.add('active');
          const sess = classSessions.find(s => s.id === item.dataset.historySessionId);
          renderSelectedSessionDetail(sess);
        };
      });

      // Default select first session
      renderSelectedSessionDetail(classSessions[0]);
    }

    dialog.showModal();
  }

  return {
    renderStaffManagement,
    openStaffDialog,
    openStaffDetailDialog,
    openSessionScheduleDialog,
    updateSessionStateUI,
    handleOpenSession,
    handleCloseSessionPrompt,
    confirmCloseSession,
    initSessionNoHomework,
    isNoHomeworkSession,
    renderMasterStudentDirectory,
    openStudentClassProfile,
    onClassWorkspaceOpened: () => {
      updateSessionStateUI();
      initSessionNoHomework();
    },
    renderLoginScreen,
    handleLogin,
    handleLogout,
    checkAuthStatus,
    updateCurrentUserDisplay,
    renderTutoringModule,
    renderRoomTemplatesList,
    openRosterAdmin,
    renderTAPortal,
    populateRoomTemplateDropdowns,
    updateLateMinutesCalculation,
    openClassHistoryDialog,
    handleCloseSessionPrompt,
    getSessionRecord,
    loadSessionHistory,
    loadRoomTemplates,
    buildLayoutFromTemplate,
    openNewShiftSession: (classId, date) => {
      const user = getSignedInAccount();
      const cls = getClassCatalog().find(c => c.id === classId) || getActiveClassConfig();
      openClassSession(classId, date, user, cls);
      updateSessionStateUI();
    }
  };
}

// v1.8: Universal backdrop click-to-close for all <dialog> elements (mobile bottom-sheet & desktop modal)
document.addEventListener("click", (e) => {
  if (e.target && e.target.tagName === "DIALOG" && e.target.open) {
    const rect = e.target.getBoundingClientRect();
    const clickedInDialog = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
    if (!clickedInDialog) {
      e.target.close();
    }
  }
});
