import { matchesAcronymOrText } from './student-search.js?v=3.9.2';
// Features module: Account Switcher, Tutoring Module, Room Templates, Roster & Import,
// Finalize Attendance, Visual Warnings, Late Calculation, TA Portal, and Report Center.

import { loadRoomTemplates, saveRoomTemplates, buildLayoutFromTemplate, getClassesInRoom } from './data/room-template-repository.js?v=3.9.2';
import { normalizeGradeToBirthYear, hashStaffPassword, verifyStaffPassword, normalizeEmployeeAccount, encryptStaffPasswordForAdmin, decryptStaffPasswordForAdmin } from './data/class-catalog-repository.js?v=3.9.2';
import { loadGoogleDrivePhotoConfig, saveGoogleDrivePhotoConfig, buildStudentDrivePhotoFileName, resolveStudentPhotoUrls } from './data/student-repository.js?v=3.9.2';

function formatBirthYearLabel(val) {
  const by = normalizeGradeToBirthYear(val);
  if (!by || by === '—') return '—';
  return String(by);
}
import { loadTutoringSessions, saveTutoringSessions, TUTORING_CLASS_ID, TUTORING_CLASS_CONFIG } from './data/tutoring-repository.js?v=3.9.2';
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
  exportToExcel,
  parseXlsxArrayBuffer,
  loadGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  syncSessionToGoogleSheets
} from './excel-import-export.js?v=3.9.2';
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
} from './data/session-history-repository.js?v=3.9.2';

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

  const formatScoreVN = (val, fallback = '') => {
    if (ctx.formatScoreVN) return ctx.formatScoreVN(val, fallback);
    if (val === null || val === undefined || val === '') return fallback;
    const clean = String(val).trim().replace(',', '.');
    if (!clean) return fallback;
    const num = Number(clean);
    if (Number.isNaN(num)) return String(val);
    return String(Math.round(num * 100) / 100).replace('.', ',');
  };
  const parseScoreVN = (raw) => {
    if (ctx.parseScoreVN) return ctx.parseScoreVN(raw);
    if (raw === null || raw === undefined) return null;
    const clean = String(raw).trim().replace(',', '.');
    if (clean === '') return null;
    const num = Number(clean);
    return Number.isNaN(num) ? NaN : num;
  };
  const getVisibleClasses = () => {
    if (ctx.getVisibleClassesForAccount) return ctx.getVisibleClassesForAccount();
    const acc = getSignedInAccount();
    const all = getClassCatalog();
    if (!acc || acc.role === 'admin' || !acc.employeeId) return all;
    return all.filter(c =>
      (c.teacherIds || []).includes(acc.employeeId) ||
      c.teacherId === acc.employeeId ||
      (c.assistantIds || []).includes(acc.employeeId) ||
      (c.officeIds || []).includes(acc.employeeId)
    );
  };

  function renderStudentTagsBadges(student) {
    const rawTags = (Array.isArray(student?.tags) ? [...student.tags].filter(Boolean) : []).filter(t => String(t || '').trim().toLowerCase() !== 'học bù');
    if (student?.isNew && student?.studentType !== 'makeup' && !rawTags.some(t => String(t).toLowerCase() === 'mới')) {
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
  // 0. HỆ THỐNG ĐĂNG NHẬP & ĐĂNG XUẤT BẰNG MÃ NHÂN VIÊN & MẬT KHẨU (QUẢN LÝ BỞI ADMIN)
  // ----------------------------------------------------
  const revealedStaffPasswords = new Set();
  let pendingSwitchTargetEmpId = null;

  function setLoginError(msg = '') {
    const errEl = $('#login-error-msg');
    if (!errEl) return;
    if (!msg) {
      errEl.hidden = true;
      errEl.textContent = '';
    } else {
      errEl.hidden = false;
      errEl.textContent = msg;
    }
  }

  function renderLoginScreen() {
    // Bảo mật: Không hiển thị danh sách tài khoản hay gợi ý mật khẩu trên màn hình đăng nhập
    const select = $('#login-employee-select');
    if (select) select.innerHTML = '';
    setLoginError('');
  }

  function completeLoginSession(emp, rememberMe = true) {
    const normEmp = normalizeEmployeeAccount(emp);
    const account = {
      employeeId: normEmp.id,
      code: normEmp.code,
      name: normEmp.name,
      role: normEmp.role,
      authVersion: Number(normEmp.authVersion) || 1,
      loginAt: Date.now()
    };

    setSignedInAccount(account);
    localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(account));
    localStorage.removeItem('lopvui.explicit-logout.v1');
    try {
      sessionStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(account));
    } catch {}

    // Record lastLoginAt in masterData
    const master = getMasterData();
    const targetInMaster = (master.employees || []).find(e => e.id === normEmp.id);
    if (targetInMaster) {
      targetInMaster.lastLoginAt = Date.now();
      if (ctx.setMasterData) ctx.setMasterData(master);
    }

    // Reset any active class path/query in URL to return to main menu
    try {
      history.pushState({}, '', '/');
    } catch {}

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

    setLoginError('');
    if ($('#login-password-input')) $('#login-password-input').value = '';
    updateCurrentUserDisplay();

    // Default view based on role
    if (normEmp.role === 'assistant' || normEmp.role === 'teacher') {
      setMainMenuPanel('work');
    } else {
      setMainMenuPanel('management');
    }

    const roleLabelText = normEmp.role === 'assistant' ? 'Trợ giảng' : normEmp.role === 'office' ? 'Văn phòng' : normEmp.role === 'teacher' ? 'Giáo viên' : 'Admin';
    toast(`Xin chào ${normEmp.name} (${normEmp.code})! Đã đăng nhập vai trò ${roleLabelText}.`);
    return true;
  }

  function handleLoginByCredentials(rawCode, rawPassword, rememberMe = true) {
    const cleanCode = String(rawCode || '').trim().toUpperCase();
    const cleanPass = String(rawPassword ?? '').trim();

    if (!cleanCode) {
      setLoginError('Vui lòng nhập Mã nhân viên (VD: AD001, TA001, GV001, VP001).');
      $('#login-staff-code-input')?.focus();
      return false;
    }
    if (!cleanPass) {
      setLoginError('Vui lòng nhập Mật khẩu đăng nhập.');
      $('#login-password-input')?.focus();
      return false;
    }

    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
    const emp = employees.find(e => e.code.toUpperCase() === cleanCode || e.id.toUpperCase() === cleanCode);

    if (!emp) {
      setLoginError(`Mã nhân viên "${cleanCode}" không tồn tại trong hệ thống. Vui lòng kiểm tra lại.`);
      $('#login-staff-code-input')?.focus();
      return false;
    }

    if (emp.isActive === false) {
      setLoginError(`Tài khoản ${emp.code} (${emp.name}) đã bị Admin tạm khóa. Vui lòng liên hệ Quản trị viên.`);
      return false;
    }

    if (!verifyStaffPassword(emp, cleanPass)) {
      setLoginError(`Mật khẩu không chính xác cho mã nhân viên ${emp.code}. Vui lòng thử lại hoặc liên hệ Admin.`);
      $('#login-password-input')?.focus();
      return false;
    }

    return completeLoginSession(emp, rememberMe);
  }

  function handleLogin(empIdOrCode, optionalPassword = null) {
    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
    const cleanTarget = String(empIdOrCode || '').trim().toUpperCase();
    const emp = employees.find(e => e.id === empIdOrCode || e.code.toUpperCase() === cleanTarget);
    if (!emp) {
      toast('Không tìm thấy tài khoản nhân viên.');
      return false;
    }
    if (emp.isActive === false) {
      setLoginError(`Tài khoản ${emp.code} (${emp.name}) đang bị Admin tạm khóa.`);
      toast(`Tài khoản ${emp.code} đang bị tạm khóa.`);
      return false;
    }
    if (optionalPassword !== null && !verifyStaffPassword(emp, optionalPassword)) {
      setLoginError('Mật khẩu không chính xác.');
      toast('Mật khẩu không chính xác.');
      return false;
    }
    return completeLoginSession(emp, true);
  }

  function handleLogout(reasonMsg = '') {
    localStorage.removeItem('lopvui.signed-in-account.v1');
    localStorage.setItem('lopvui.explicit-logout.v1', '1');
    try { sessionStorage.removeItem('lopvui.signed-in-account.v1'); } catch {}
    setSignedInAccount({ employeeId: null, role: null });

    // Close any open dialogs
    document.querySelectorAll('dialog[open]').forEach(d => {
      try { d.close(); } catch {}
    });

    // Reset URL to root so we exit any active class view
    try {
      history.pushState({}, '', '/');
    } catch {}

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
      if (reasonMsg) setLoginError(reasonMsg);
      setTimeout(() => $('#login-staff-code-input')?.focus(), 50);
    }

    toast(reasonMsg || 'Đã đăng xuất khỏi hệ thống.');
  }

  function verifyActiveSessionIntegrity() {
    const currentAcc = getSignedInAccount();
    if (!currentAcc || !currentAcc.employeeId) return false;
    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
    const emp = employees.find(e => e.id === currentAcc.employeeId);
    if (!emp) {
      handleLogout('Tài khoản của bạn không còn tồn tại trên hệ thống. Vui lòng đăng nhập lại.');
      return false;
    }
    if (emp.isActive === false) {
      handleLogout(`Tài khoản ${emp.code} (${emp.name}) vừa bị Admin tạm khóa.`);
      return false;
    }
    if (currentAcc.authVersion && Number(emp.authVersion) > Number(currentAcc.authVersion)) {
      handleLogout(`Mật khẩu hoặc quyền hạn của tài khoản ${emp.code} đã được Admin thay đổi. Vui lòng đăng nhập lại.`);
      return false;
    }
    // Keep role synced if Admin updated role
    if (currentAcc.role !== emp.role || currentAcc.code !== emp.code) {
      const updated = { ...currentAcc, role: emp.role, code: emp.code, name: emp.name, authVersion: emp.authVersion };
      setSignedInAccount(updated);
      localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(updated));
      updateCurrentUserDisplay();
    }
    return true;
  }

  function checkAuthStatus() {
    const explicitLogout = localStorage.getItem('lopvui.explicit-logout.v1') === '1';
    const saved = localStorage.getItem('lopvui.signed-in-account.v1');
    let account = null;
    try {
      account = saved ? JSON.parse(saved) : null;
    } catch {}

    const appShell = document.getElementById('app-shell') || $('#app-shell');
    const loginScreen = document.getElementById('login-screen') || $('#login-screen');
    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);

    // If explicitly logged out, require login on #login-screen
    if (explicitLogout || !account || !account.employeeId) {
      if (!explicitLogout && !account) {
        // First bootstrap fallback if session existed before v3.1
        const defaultEmp = employees.find(e => e.id === 'employee-ta-001' && e.isActive !== false) || employees.find(e => e.isActive !== false);
        if (defaultEmp) {
          account = {
            employeeId: defaultEmp.id,
            code: defaultEmp.code,
            name: defaultEmp.name,
            role: defaultEmp.role,
            authVersion: defaultEmp.authVersion || 1
          };
          localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(account));
          setSignedInAccount(account);
          updateCurrentUserDisplay();
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
    }

    const emp = employees.find(e => e.id === account.employeeId);
    if (!emp || emp.isActive === false || (account.authVersion && Number(emp.authVersion) > Number(account.authVersion))) {
      handleLogout(emp?.isActive === false ? 'Tài khoản đã bị Admin tạm khóa.' : 'Phiên đăng nhập đã hết hạn hoặc mật khẩu đã thay đổi.');
      return false;
    }

    // Valid session: ensure authVersion & code are hydrated
    account = {
      ...account,
      employeeId: emp.id,
      code: emp.code,
      name: emp.name,
      role: emp.role,
      authVersion: emp.authVersion || 1
    };
    localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(account));
    setSignedInAccount(account);
    updateCurrentUserDisplay();

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

  // ----------------------------------------------------
  // 1. TOPBAR ACCOUNT MENU & ACCOUNT SWITCHER (CÓ NÚT LOGOUT BÊN TRONG)
  // ----------------------------------------------------
  function updateCurrentUserDisplay() {
    const account = getSignedInAccount();
    const master = getMasterData();
    const employee = (master.employees || []).map(normalizeEmployeeAccount).find(e => e && e.id === account?.employeeId) || {
      name: 'Chưa đăng nhập',
      code: '—',
      role: 'assistant'
    };

    const isAdmin = employee.role === 'admin';
    const mgmtTabStaffEl = $('#mgmt-tab-staff');
    if (mgmtTabStaffEl) {
      mgmtTabStaffEl.hidden = !isAdmin;
      mgmtTabStaffEl.style.display = isAdmin ? '' : 'none';
    }
    if (!isAdmin && $('#mgmt-panel-staff') && !$('#mgmt-panel-staff').hidden) {
      $('#mgmt-panel-staff').hidden = true;
      if ($('#staff-table-tbody')) $('#staff-table-tbody').innerHTML = '';
      $('#mgmt-tab-classes')?.click();
    }

    const roleNames = {
      assistant: 'Trợ giảng',
      office: 'Văn phòng',
      teacher: 'Giáo viên',
      admin: 'Admin'
    };

    const nameParts = String(employee.name || '').split(' ').filter(Boolean);
    const initials = nameParts.length >= 2 
      ? (nameParts[0][0] + nameParts.at(-1)[0]).toUpperCase()
      : String(employee.name || 'NV').slice(0, 2).toUpperCase();

    const avatarEl = $('#current-user-avatar');
    if (avatarEl) {
      avatarEl.textContent = initials;
      avatarEl.className = `user-avatar-chip role-${employee.role || 'assistant'}`;
    }

    const nameEl = $('#current-user-name');
    if (nameEl) {
      const codeSuffix = employee.code && employee.code !== '—' ? ` · ${employee.code}` : '';
      nameEl.innerHTML = `${escapeHtml(employee.name)}<small id="current-user-role">${escapeHtml((roleNames[employee.role] || employee.role) + codeSuffix)}</small>`;
    }
    const roleBadge = $('#role-display-badge');
    if (roleBadge) {
      roleBadge.textContent = `Vai trò: ${roleNames[employee.role] || employee.role} · ${employee.name} (${employee.code || ''})`;
    }
  }

  function openAccountSwitchDialog() {
    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
    const currentAcc = getSignedInAccount();
    const currentEmp = employees.find(e => e.id === currentAcc?.employeeId);
    const isAdminUser = currentEmp?.role === 'admin';

    const roleNames = {
      assistant: 'Trợ giảng (TA)',
      office: 'Văn phòng (VP)',
      teacher: 'Giáo viên (GV)',
      admin: 'Quản trị viên (Admin)'
    };

    const activeCard = $('#active-account-profile-card');
    if (activeCard && currentEmp) {
      const nameParts = String(currentEmp.name || '').split(' ').filter(Boolean);
      const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts.at(-1)[0]).toUpperCase()
        : String(currentEmp.name || 'NV').slice(0, 2).toUpperCase();

      activeCard.innerHTML = `
        <div class="active-account-card-main">
          <div class="active-account-avatar role-${escapeHtml(currentEmp.role)}">${escapeHtml(initials)}</div>
          <div class="active-account-meta">
            <div class="active-account-title-row">
              <strong>${escapeHtml(currentEmp.name)}</strong>
              <span class="staff-role-badge ${escapeHtml(currentEmp.role)}">${escapeHtml(roleNames[currentEmp.role] || currentEmp.role)}</span>
            </div>
            <div class="active-account-sub">
              <span>Mã nhân viên: <strong>${escapeHtml(currentEmp.code)}</strong></span>
              ${currentEmp.phone ? `<span>· SĐT: ${escapeHtml(currentEmp.phone)}</span>` : ''}
              ${currentEmp.email ? `<span>· ${escapeHtml(currentEmp.email)}</span>` : ''}
            </div>
            <small style="color:#2e6f40; font-weight:600;">● Đang đăng nhập hợp lệ</small>
          </div>
          <div class="active-account-actions">
            <button type="button" class="logout-button-inside" id="active-card-logout-btn" title="Đăng xuất khỏi tài khoản ${escapeHtml(currentEmp.code)}">⎋ Đăng xuất</button>
          </div>
        </div>
      `;

      activeCard.querySelector('#active-card-logout-btn')?.addEventListener('click', () => {
        try { $('#account-switch-dialog')?.close(); } catch {}
        handleLogout();
      });
    }

    const adminOpenStaffBtn = $('#admin-open-staff-pw-btn');
    if (adminOpenStaffBtn) {
      adminOpenStaffBtn.hidden = !isAdminUser;
      adminOpenStaffBtn.onclick = () => {
        try { $('#account-switch-dialog')?.close(); } catch {}
        setMainMenuPanel('management');
        $('#mgmt-tab-staff')?.click();
        renderStaffManagement();
      };
    }

    const accDialog = $('#account-switch-dialog');
    if (accDialog && !accDialog.open) {
      try { accDialog.showModal(); } catch { accDialog.setAttribute('open', ''); }
    }
  }

  // 1.1 QUẢN LÝ NHÂN SỰ & MẬT KHẨU DÀNH RIÊNG CHO ADMIN
  // ----------------------------------------------------
  function openAdminPasswordDialog(empId) {
    const currentAcc = getSignedInAccount();
    if (currentAcc?.role !== 'admin') {
      toast('Chỉ tài khoản Quản trị viên (Admin) mới có quyền quản lý mật khẩu.');
      return;
    }
    const master = getMasterData();
    const emp = (master.employees || []).find(e => e.id === empId);
    if (!emp) return;
    const norm = normalizeEmployeeAccount(emp);

    const dlg = $('#admin-password-dialog');
    if (!dlg) return;

    $('#admin-pw-emp-id').value = norm.id;
    $('#admin-pw-emp-code').value = `${norm.code} — ${norm.name}`;
    $('#admin-pw-new-input').value = decryptStaffPasswordForAdmin(norm, 'admin') || '';
    $('#admin-pw-active-select').value = norm.isActive === false ? 'locked' : 'active';
    $('#admin-pw-dialog-title').textContent = `Quản lý mật khẩu: ${norm.name}`;
    $('#admin-pw-dialog-subtitle').textContent = `Mã nhân viên đăng nhập: ${norm.code}. Khi đổi mật khẩu hoặc khóa tài khoản, các thiết bị đang đăng nhập tài khoản này sẽ cần đăng nhập lại.`;

    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    setTimeout(() => {
      const inp = $('#admin-pw-new-input');
      if (inp) { inp.focus(); inp.select(); }
    }, 40);
  }

  function renderStaffManagement() {
    if (getSignedInAccount()?.role !== 'admin') {
      if ($('#staff-table-tbody')) $('#staff-table-tbody').innerHTML = '';
      if ($('#mgmt-panel-staff')) $('#mgmt-panel-staff').hidden = true;
      return;
    }
    const master = getMasterData();
    const catalog = getClassCatalog();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);

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
      const assigned = catalog.filter(c => 
        (c.teacherIds || []).includes(emp.id) || 
        (c.assistantIds || []).includes(emp.id) || 
        (c.officeIds || []).includes(emp.id)
      );

      const assignedBadges = assigned.length 
        ? `<span class="plain-class-list-text">${assigned.map(c => escapeHtml(c.code || c.name)).join(', ')}</span>` 
        : '<small style="color:#9ca89f;">Chưa phân công lớp</small>';

      const isRevealed = revealedStaffPasswords.has(emp.id);
      const decryptedPw = isRevealed ? (decryptStaffPasswordForAdmin(emp, 'admin') || '••••••••') : '••••••••';
      const pwText = isRevealed ? decryptedPw : '••••••••';
      const isActive = emp.isActive !== false;
      const statusBadge = isActive
        ? `<span class="staff-status-pill active">● Hoạt động</span>`
        : `<span class="staff-status-pill locked">🔒 Đã khóa</span>`;

      const contactHtml = (emp.phone || emp.email)
        ? `<div>${escapeHtml(emp.phone || '—')}</div><small style="color:#6d7d70;">${escapeHtml(emp.email || '')}</small>`
        : '—';

      return `
        <tr class="${!isActive ? 'staff-row-locked' : ''}">
          <td style="text-align:center;">${index + 1}</td>
          <td>
            <div style="cursor:pointer;" data-view-staff="${escapeHtml(emp.id)}" title="Bấm để xem phân công ca & lịch sử làm việc">
              <strong style="color:#2f5f3e; text-decoration:underline;">${escapeHtml(emp.name)}</strong>
              <small style="display:block; color:#7d8c80; font-size:12.5px;">Bấm xem ca & lịch sử</small>
            </div>
          </td>
          <td><strong class="staff-code-pill">${escapeHtml(emp.code)}</strong></td>
          <td><span class="staff-role-badge ${escapeHtml(emp.role)}">${escapeHtml(roleLabels[emp.role] || emp.role)}</span></td>
          <td>
            <div class="staff-pw-cell">
              ${statusBadge}
              <div class="staff-pw-reveal-row">
                <code class="staff-pw-code ${isRevealed ? 'revealed' : ''}">${escapeHtml(pwText)}</code>
                <button type="button" class="staff-pw-eye-btn" data-toggle-staff-pw="${escapeHtml(emp.id)}" title="${isRevealed ? 'Ẩn mật khẩu' : 'Xem mật khẩu hiện tại'}">${isRevealed ? 'Ẩn' : 'Xem'}</button>
              </div>
            </div>
          </td>
          <td>${contactHtml}</td>
          <td class="col-allow-wrap">${assignedBadges}</td>
          <td style="text-align:center; white-space:nowrap;">
            <button type="button" class="outline-button" data-reset-pw-staff="${escapeHtml(emp.id)}" style="padding:7px 10px; font-size:13px;" title="Cấp hoặc đổi mật khẩu đăng nhập">🔑 Đổi MK</button>
            <button type="button" class="outline-button" data-edit-staff="${escapeHtml(emp.id)}" style="padding:7px 10px; font-size:13px; margin-left:4px;">Sửa</button>
            <button type="button" class="text-danger" data-delete-staff="${escapeHtml(emp.id)}" style="padding:7px 10px; font-size:13px; margin-left:4px;">Xóa</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-view-staff]').forEach(btn => {
      btn.onclick = () => openStaffDetailDialog(btn.dataset.viewStaff);
    });

    tbody.querySelectorAll('[data-toggle-staff-pw]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.toggleStaffPw;
        if (revealedStaffPasswords.has(id)) revealedStaffPasswords.delete(id);
        else revealedStaffPasswords.add(id);
        renderStaffManagement();
      };
    });

    tbody.querySelectorAll('[data-reset-pw-staff]').forEach(btn => {
      btn.onclick = () => openAdminPasswordDialog(btn.dataset.resetPwStaff);
    });

    tbody.querySelectorAll('[data-edit-staff]').forEach(btn => {
      btn.onclick = () => openStaffDialog(btn.dataset.editStaff);
    });

    tbody.querySelectorAll('[data-delete-staff]').forEach(btn => {
      btn.onclick = () => {
        const staffId = btn.dataset.deleteStaff;
        const emp = master.employees.find(e => e.id === staffId);
        if (!emp) return;

        // Prevent deleting the last active admin
        const activeAdmins = (master.employees || []).filter(e => e.role === 'admin' && e.isActive !== false);
        if (emp.role === 'admin' && activeAdmins.length <= 1) {
          alert('Không thể xóa tài khoản Quản trị viên (Admin) duy nhất của hệ thống!');
          return;
        }

        const assigned = catalog.filter(c => 
          (c.teacherIds || []).includes(emp.id) || 
          (c.assistantIds || []).includes(emp.id) || 
          (c.officeIds || []).includes(emp.id)
        );

        if (assigned.length > 0) {
          alert(`Không thể xóa! Nhân viên ${emp.name} đang được phân công phụ trách ${assigned.length} lớp: ${assigned.map(c => c.name).join(', ')}. Vui lòng gỡ phân công trong cấu hình lớp (hoặc chuyển trạng thái sang Tạm khóa) trước khi xóa.`);
          return;
        }

        if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên ${emp.name} (${emp.code}) khỏi hệ thống?`)) return;

        master.employees = master.employees.filter(e => e.id !== staffId);
        if (ctx.setMasterData) ctx.setMasterData(master);
        else localStorage.setItem('lopvui.master-data.v1', JSON.stringify(master));
        renderStaffManagement();
        renderMainMenu();
        toast(`Đã xóa nhân viên ${emp.name} (${emp.code}).`);
      };
    });
  }

  function openStaffDialog(editId = null) {
    if (getSignedInAccount()?.role !== 'admin') {
      toast('Chỉ Quản trị viên (Admin) mới có quyền thêm hoặc chỉnh sửa nhân sự.');
      return;
    }
    const master = getMasterData();
    const dialog = $('#staff-form-dialog');
    if (!dialog) return;

    if (editId) {
      const rawEmp = master.employees.find(e => e.id === editId);
      if (!rawEmp) return;
      const emp = normalizeEmployeeAccount(rawEmp);
      $('#staff-form-title').textContent = 'Chỉnh sửa thông tin & Tài khoản nhân viên';
      $('#staff-form-id').value = emp.id;
      $('#staff-code').value = emp.code;
      $('#staff-name').value = emp.name;
      $('#staff-role').value = emp.role;
      $('#staff-phone').value = emp.phone || '';
      $('#staff-email').value = emp.email || '';
      $('#staff-note').value = emp.note || '';
      if ($('#staff-password')) $('#staff-password').value = decryptStaffPasswordForAdmin(emp, 'admin') || '';
      if ($('#staff-active-status')) $('#staff-active-status').value = emp.isActive === false ? 'locked' : 'active';
    } else {
      $('#staff-form-title').textContent = 'Thêm nhân viên & Cấp tài khoản mới';
      $('#staff-form-id').value = '';
      $('#staff-code').value = '';
      $('#staff-name').value = '';
      $('#staff-role').value = 'assistant';
      $('#staff-phone').value = '';
      $('#staff-email').value = '';
      $('#staff-note').value = '';
      if ($('#staff-password')) $('#staff-password').value = '123456';
      if ($('#staff-active-status')) $('#staff-active-status').value = 'active';
    }

    const addPastBtn = listContainer.querySelector('#history-dialog-add-past-btn');
    if (addPastBtn) {
      addPastBtn.onclick = () => {
        ctx.openManagePastSessionDialog?.(classId, null);
      };
    }
    dialog.showModal();
  }

  function exportStaffListAsCsv() {
    const master = getMasterData();
    const catalog = getClassCatalog();
    const roleLabels = { assistant: 'Trợ giảng', teacher: 'Giáo viên', office: 'Văn phòng', admin: 'Quản trị viên' };

    const headers = ['STT', 'Mã NV (Login)', 'Họ và tên', 'Vai trò', 'Trạng thái TK', 'Số điện thoại', 'Email', 'Các lớp phụ trách', 'Ghi chú'];
    const rows = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean).map((emp, index) => {
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
        emp.isActive === false ? 'Tạm khóa' : 'Đang hoạt động',
        emp.phone || '',
        emp.email || '',
        assigned || 'Chưa phân công',
        emp.note || ''
      ];
    });

    const outName = exportToExcel(headers, rows, 'DanhSachNhanSu_TrungTam.xlsx');
    toast(`Đã tải về file Excel: ${outName}`);
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
      if (templates.length) {
        configSelect.innerHTML = templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.roomCode ? `${t.roomCode} · ${t.name}` : t.name)} (${t.aisles} dãy · ${(t.desksPerAisle || []).join('-')} bàn)</option>`).join('');
      } else {
        configSelect.innerHTML = `<option value="default-standard-room">Phòng tiêu chuẩn (3 dãy · 3-3-2 bàn)</option>`;
      }
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
    const roster = [...classStudents(), ...(ctx.getMakeupStudents ? ctx.getMakeupStudents().filter(m => m.attendingClassId === currentClass.id && m.attendingSessionDate === date) : [])];
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
  function updateLateMinutesCalculation(source = 'auto') {
    const currentClass = getActiveClassConfig();
    let startTimeStr = currentClass?.startTime || '';
    if (!startTimeStr || !/^\d{1,2}:\d{2}$/.test(String(startTimeStr).trim())) {
      const m = String(currentClass?.scheduleText || '').match(/(\d{1,2}:\d{2})/);
      startTimeStr = m ? m[1] : '18:00';
    }
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const startTotal = (startH || 0) * 60 + (startM || 0);

    const arrInput = $('#arrival-time');
    const minsInput = $('#late-minutes-input');

    let arrivalTimeStr = arrInput?.value || new Date().toTimeString().slice(0, 5);
    let [arrH, arrM] = arrivalTimeStr.split(':').map(Number);
    let arrTotal = (arrH || 0) * 60 + (arrM || 0);
    let diff = arrTotal - startTotal;

    if (source === 'minutes' && minsInput) {
      const typedMins = Math.max(1, Math.min(300, Number(minsInput.value) || 10));
      diff = typedMins;
      const computedTotal = ((startTotal + typedMins) % 1440 + 1440) % 1440;
      const hh = String(Math.floor(computedTotal / 60)).padStart(2, '0');
      const mm = String(computedTotal % 60).padStart(2, '0');
      arrivalTimeStr = `${hh}:${mm}`;
      if (arrInput) arrInput.value = arrivalTimeStr;
    } else {
      if (diff <= 0 || diff > 360) {
        const fallbackMins = Math.max(1, Number(minsInput?.value) || 10);
        diff = fallbackMins;
        if (source === 'arrival' && arrInput?.value) {
          diff = Math.max(1, Number(minsInput?.value) || 5);
        } else {
          const computedTotal = ((startTotal + fallbackMins) % 1440 + 1440) % 1440;
          const hh = String(Math.floor(computedTotal / 60)).padStart(2, '0');
          const mm = String(computedTotal % 60).padStart(2, '0');
          arrivalTimeStr = `${hh}:${mm}`;
          if (arrInput) arrInput.value = arrivalTimeStr;
        }
      }
      if (minsInput && document.activeElement !== minsInput) {
        minsInput.value = String(diff);
      }
    }

    const startLabel = $('#late-class-start-label');
    const arrLabel = $('#late-arrival-display');
    const badge = $('#late-minutes-badge');

    if (startLabel) startLabel.textContent = startTimeStr;
    if (arrLabel) arrLabel.textContent = arrivalTimeStr;

    if (badge) {
      badge.textContent = `Đi muộn ${diff} phút (${arrivalTimeStr})`;
      badge.style.background = '#ffecd4';
      badge.style.color = '#ab5d18';
    }

    return Math.max(1, diff);
  }

  // ----------------------------------------------------
  // 7. TRUNG TÂM BÁO CÁO BUỔI HỌC & XUẤT FILE A4 / CSV (PRD §9)
  // ----------------------------------------------------
  const REPORT_DEFAULT_COLUMNS = [
    { key: 'family', label: 'Họ đệm' },
    { key: 'given', label: 'Tên' },
    { key: 'code', label: 'Mã HS' },
    { key: 'school', label: 'Trường / Phân loại' },
    { key: 'attendance', label: 'Điểm danh' },
    { key: 'homework', label: 'BTVN (Kèm lý do)' },
    { key: 'hwScore', label: 'Điểm BTVN' },
    { key: 'testScore', label: 'Điểm Test' },
    { key: 'note', label: 'Ghi chú trong buổi' }
  ];

  const LOW_SCORE_THRESHOLD_KEY = 'lopvui.low-score-threshold.v1';
  function getLowScoreThreshold() {
    try {
      const raw = localStorage.getItem(LOW_SCORE_THRESHOLD_KEY);
      if (raw !== null && raw !== '') {
        const parsed = parseScoreVN(raw);
        if (parsed !== null && !Number.isNaN(parsed) && parsed >= 0 && parsed <= 10) {
          return parsed;
        }
      }
    } catch {}
    return 6;
  }

  function setLowScoreThreshold(val) {
    const parsed = parseScoreVN(val);
    if (parsed !== null && !Number.isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      try { localStorage.setItem(LOW_SCORE_THRESHOLD_KEY, String(parsed)); } catch {}
      return parsed;
    }
    return getLowScoreThreshold();
  }

  function formatMergedAttendanceAndArrival(s, seated, isLate, isPresent, isMakeup, date, classId) {
    if (isLate) {
      if (ctx.resolveLateDetails) {
        const det = ctx.resolveLateDetails(s, seated?.entry || null, getActiveClassConfig(), date);
        return `muộn ${det.lateMinutes}’ - ${det.arrivalTime}`;
      }
      const arrTime = resolveStudentArrivalTime(s, seated, date, classId);
      const attHist = (s?.attendanceHistory || []).find(h => (h.classId === classId || !h.classId) && h.date === date);
      const mins = seated?.entry?.attendance?.lateMinutes ?? seated?.entry?.attendance?.minutesLate ?? s?.attendance?.lateMinutes ?? s?.lateMinutes ?? attHist?.lateMinutes ?? attHist?.minutesLate ?? 10;
      if (mins && arrTime) return `muộn ${mins}’ - ${arrTime}`;
      if (mins) return `muộn ${mins}’`;
      if (arrTime) return `muộn - ${arrTime}`;
      return 'muộn 10’';
    }
    if (isPresent) {
      return 'Có mặt';
    }
    if (s?.attendance?.status === 'absent_excused') {
      return 'Vắng có phép';
    }
    if (s?.attendance?.status === 'absent_unexcused' || s?.attendance?.status === 'absent') {
      return 'Vắng K.phép';
    }
    return 'Chưa điểm danh';
  }

  function getReportColumnOrder() {
    const defKeys = REPORT_DEFAULT_COLUMNS.map(c => c.key);
    try {
      const saved = JSON.parse(localStorage.getItem('lopvui.column-order.report.v1') || 'null');
      if (Array.isArray(saved) && saved.length) {
        const valid = saved.filter(k => defKeys.includes(k));
        defKeys.forEach(k => { if (!valid.includes(k)) valid.push(k); });
        return valid;
      }
    } catch {}
    return defKeys;
  }

  function resolveStudentArrivalTime(s, seated, date, classId) {
    if (seated?.entry?.attendance?.arrivalTime) return seated.entry.attendance.arrivalTime;
    if (s?.attendance?.arrivalTime) return s.attendance.arrivalTime;
    if (s?.arrivalTime) return s.arrivalTime;
    const attHist = (s?.attendanceHistory || []).find(h => (h.classId === classId || !h.classId) && h.date === date);
    if (attHist?.time) return attHist.time;
    if (attHist?.arrivalTime) return attHist.arrivalTime;
    return '';
  }

  function resolveHomeworkStatusWithReason(hwObj) {
    const st = hwObj?.status || 'uncollected';
    const reasonMap = { not_done: 'Chưa làm bài', forgot: 'Quên mang vở', missed_previous: 'Nghỉ buổi trước' };
    if (st === 'not_submitted') {
      const r = reasonMap[hwObj?.reason] || hwObj?.reason || '';
      return r ? `Chưa nộp (${r})` : 'Chưa nộp';
    }
    if (st === 'submitted' || st === 'graded') {
      return 'Đã nộp';
    }
    return 'Chưa thu';
  }

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
    // Học sinh học bù chỉ xuất hiện trong đúng lớp và đúng buổi hôm đó
    const sessionMakeups = allMakeups.filter(m =>
      (m.attendingClassId === currentClass.id && m.attendingSessionDate === date) ||
      entries.some(e => e.entry.studentId === m.id) ||
      lateQueueIds.includes(m.id)
    ).sort(byAlpha);

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

    const getStudentSessionNote = (s, seated) => {
      const fromCtx = ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : '';
      if (fromCtx) return fromCtx;
      if (seated?.entry?.homework?.note) return seated.entry.homework.note;
      const sn = (s.sessionNotes || []).find(n => n.classId === currentClass.id && n.date === date);
      return sn?.note || s.sessionNote || '';
    };

    if (tabName === 'teacher-summary') {
      const lowScoreThreshold = getLowScoreThreshold();
      const thresholdStr = formatScoreVN(lowScoreThreshold, '6');

      const presentCount = entries.filter(e => e.entry.studentId && e.entry.attendance?.status === 'present').length;
      const lateList = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        return lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late' || s.attendance?.status === 'late';
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
        const hwScore = parseScoreVN(seated?.entry.homework?.score ?? s.homework?.score);
        const testScore = parseScoreVN(s.testScore ?? seated?.entry.testScore);
        const validScores = [hwScore, testScore].filter(x => x !== null && !Number.isNaN(x));
        if (!validScores.length) return false;
        const lowest = Math.min(...validScores);
        return lowest < lowScoreThreshold && lowest >= 0;
      });

      let savedChk = {};
      try {
        savedChk = JSON.parse(localStorage.getItem(`lopvui.checklist.v1.${currentClass.id}.${date}`) || '{}') || {};
      } catch {}
      const histSession = getSessionRecord(currentClass.id, date) || {};
      const lessonTitle = $('#lesson-title')?.value?.trim() || savedChk.lessonTitle || histSession.lessonTitle || 'Bài học hôm nay';
      const sessionNote = $('#session-note')?.value?.trim() || savedChk.classNote || histSession.finalNote || '';
      const homeworkAssignment = $('#homework-assignment')?.value?.trim() || savedChk.homeworkAssignment || histSession.homeworkAssignment || '';
      const homeworkLink = $('#homework-link')?.value?.trim() || savedChk.homeworkLink || histSession.homeworkLink || '';
      const notebookLink = $('#notebook-link')?.value?.trim() || savedChk.notebookLink || histSession.notebookLink || '';
      const isNoHwSessionFlag = isNoHomeworkSession();
      const submittedHWCount = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        const st = seated?.entry.homework?.status || s.homework?.status;
        return st === 'submitted' || st === 'graded';
      }).length;

      container.innerHTML = `
        <div class="attendance-report-heading report-compact-heading">
          <div>
            <strong class="report-heading-eyebrow">BÁO CÁO TỔNG HỢP CA HỌC GỬI GIÁO VIÊN</strong>
            <div class="report-heading-main">Lớp: <strong>${escapeHtml(currentClass.name)} (${escapeHtml(currentClass.code || currentClass.id)})</strong> · ${escapeHtml(formatBirthYearLabel(currentClass.grade))} · Phòng: <strong>${escapeHtml(currentClass.room)}</strong></div>
            <div class="report-heading-sub">Bài dạy: <strong>${escapeHtml(lessonTitle)}</strong></div>
          </div>
          <div class="report-heading-right">
            <div>Ngày: <strong>${escapeHtml(date)}</strong> (${escapeHtml(currentClass.startTime)}–${escapeHtml(currentClass.endTime)})</div>
            <div>GV: <strong>${escapeHtml(currentClass.teacherName || '—')}</strong> · TA: <strong>${escapeHtml(currentClass.assistantName || '—')}</strong></div>
          </div>
        </div>

        <div class="report-btvn-summary-box">
          <div class="report-btvn-top">
            <strong>📚 Bài tập về nhà (BTVN) & Tài liệu:</strong>
            <span class="room-chip" style="background:#dcfce7; color:#166534; font-weight:700;">
              ${isNoHwSessionFlag ? 'Ca này không thu BTVN' : `Đã nộp: ${submittedHWCount} · Chưa nộp: ${missingHW.length}`}
            </span>
          </div>
          <div style="margin-top:4px; line-height:1.45;">
            <strong>BTVN giao về nhà:</strong> ${homeworkAssignment ? `<span style="white-space:pre-wrap;">${escapeHtml(homeworkAssignment)}</span>` : '<em style="color:#4b5563;">Chưa ghi nội dung BTVN</em>'}
          </div>
          ${(homeworkLink || notebookLink) ? `
            <div class="report-btvn-links">
              ${homeworkLink ? `<div><strong>🔗 Phiếu BTVN:</strong> <a href="${escapeHtml(homeworkLink)}" target="_blank" rel="noopener noreferrer" style="color:#15803d; font-weight:700; text-decoration:underline; word-break:break-all;">${escapeHtml(homeworkLink)} ↗</a></div>` : ''}
              ${notebookLink ? `<div><strong>📓 Vở ghi / Bài giảng:</strong> <a href="${escapeHtml(notebookLink)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8; font-weight:700; text-decoration:underline; word-break:break-all;">${escapeHtml(notebookLink)} ↗</a></div>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="class-metrics-summary report-metrics-4col">
          <div class="class-metric-box">
            <span>Sĩ số</span>
            <strong>${regularRoster.length}${sessionMakeups.length ? `+${sessionMakeups.length}` : ''}</strong>
            <small>trong ca</small>
          </div>
          <div class="class-metric-box">
            <span>Có mặt</span>
            <strong style="color:#2e6d42;">${presentCount}</strong>
            <small>đúng giờ</small>
          </div>
          <div class="class-metric-box">
            <span>Đi muộn</span>
            <strong style="color:#bc7b26;">${lateList.length}</strong>
            <small>học sinh</small>
          </div>
          <div class="class-metric-box">
            <span>Vắng mặt</span>
            <strong style="color:#c13b30;">${absentList.length}</strong>
            <small>học sinh</small>
          </div>
        </div>

        <div class="report-sections-stack">
          <div class="report-section-card border-danger">
            <strong class="report-section-title" style="color:#991b1b;">× 1. Học sinh CHƯA NỘP BTVN (${missingHW.length} bạn):</strong>
            ${missingHW.length ? `
              <div class="attendance-table-wrap">
                <table class="attendance-report-table">
                  <thead>
                    <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Lý do chưa nộp</th><th>Ghi chú trong buổi</th></tr>
                  </thead>
                  <tbody>
                    ${missingHW.map((s) => {
                      const { fam, giv, isMakeup } = getFamGiv(s);
                      const seated = entries.find(p => p.entry.studentId === s.id);
                      const reasonMap = { not_done: 'Chưa làm bài', forgot: 'Quên mang vở', missed_previous: 'Nghỉ buổi trước' };
                      const reason = reasonMap[seated?.entry.homework?.reason || s.homework?.reason] || seated?.entry.homework?.reason || s.homework?.reason || 'Chưa làm';
                      const noteInSession = getStudentSessionNote(s, seated);
                      return `<tr class="${isMakeup ? 'makeup-row-tr' : ''}"><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td><td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'—'))}</td><td style="color:#b91c1c; font-weight:700;">${escapeHtml(reason)}</td><td>${escapeHtml(noteInSession || '—')}</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="report-empty-ok">✓ 100% học sinh có mặt đã nộp bài tập về nhà đầy đủ!</div>'}
          </div>

          <div class="report-section-card border-warning">
            <strong class="report-section-title" style="color:#9a3412;">2. Học sinh ĐI MUỘN (${lateList.length} bạn):</strong>
            ${lateList.length ? `
              <div class="attendance-table-wrap">
                <table class="attendance-report-table">
                  <thead>
                    <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Giờ đến</th><th>Phút muộn</th><th>Ghi chú trong buổi</th></tr>
                  </thead>
                  <tbody>
                    ${lateList.map((s) => {
                      const { fam, giv, isMakeup } = getFamGiv(s);
                      const seated = entries.find(p => p.entry.studentId === s.id);
                      const lateDet = ctx.resolveLateDetails ? ctx.resolveLateDetails(s, seated?.entry || null, currentClass, date) : null;
                      const arrTime = lateDet?.arrivalTime || resolveStudentArrivalTime(s, seated, date, currentClass.id) || '—';
                      const mins = lateDet?.lateMinutes ?? seated?.entry.attendance?.lateMinutes ?? seated?.entry.attendance?.minutesLate ?? s.attendance?.lateMinutes ?? s.lateMinutes ?? 10;
                      const noteInSession = getStudentSessionNote(s, seated);
                      return `<tr class="${isMakeup ? 'makeup-row-tr' : ''}"><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td><td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'—'))}</td><td><strong>${escapeHtml(arrTime || '—')}</strong></td><td style="color:#c2410c; font-weight:700;">muộn ${mins}’</td><td>${escapeHtml(noteInSession || '—')}</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="report-empty-ok">✓ Không có học sinh nào đi muộn trong ca hôm nay!</div>'}
          </div>

          <div class="report-section-card border-yellow">
            <div class="low-score-header-bar">
              <strong class="report-section-title" style="color:#854d0e;">! 3. Học sinh CÓ ĐIỂM THẤP (&lt; ${escapeHtml(thresholdStr)} điểm) (${lowScores.length} bạn):</strong>
              <div class="low-score-threshold-controls">
                <span>Mốc điểm thấp:</span>
                <button type="button" class="low-score-preset-btn ${lowScoreThreshold === 5 ? 'active' : ''}" data-low-score-preset="5">&lt; 5</button>
                <button type="button" class="low-score-preset-btn ${lowScoreThreshold === 6 ? 'active' : ''}" data-low-score-preset="6">&lt; 6</button>
                <button type="button" class="low-score-preset-btn ${lowScoreThreshold === 7 ? 'active' : ''}" data-low-score-preset="7">&lt; 7</button>
                <label class="low-score-custom-box" title="Nhập mốc điểm thấp tùy ý (VD: 5, 5,5, 6, 6,5...)">
                  <span>&lt;</span>
                  <input type="text" inputmode="decimal" id="custom-low-score-input" value="${escapeHtml(thresholdStr)}" aria-label="Mốc điểm thấp" />
                </label>
              </div>
            </div>
            ${lowScores.length ? `
              <div class="attendance-table-wrap">
                <table class="attendance-report-table">
                  <thead>
                    <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Điểm BTVN</th><th>Điểm Test</th><th>Ghi chú trong buổi</th></tr>
                  </thead>
                  <tbody>
                    ${lowScores.map((s) => {
                      const { fam, giv, isMakeup } = getFamGiv(s);
                      const seated = entries.find(p => p.entry.studentId === s.id);
                      const hwScore = formatScoreVN(seated?.entry.homework?.score ?? s.homework?.score, '—');
                      const testScore = formatScoreVN(s.testScore ?? seated?.entry.testScore, '—');
                      const noteInSession = getStudentSessionNote(s, seated);
                      return `<tr class="${isMakeup ? 'makeup-row-tr' : ''}"><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td><td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'—'))}</td><td style="color:#b45309; font-weight:700;">${escapeHtml(hwScore)}</td><td style="color:#b45309; font-weight:700;">${escapeHtml(testScore)}</td><td>${escapeHtml(noteInSession || '—')}</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `<div class="report-empty-ok">✓ Không có học sinh nào có điểm dưới ${escapeHtml(thresholdStr)}!</div>`}
          </div>

          <div class="report-section-card border-purple">
            <strong class="report-section-title" style="color:#6b21a8;">4. Học sinh HỌC BÙ trong buổi (${sessionMakeups.length} bạn):</strong>
            ${sessionMakeups.length ? `
              <div class="attendance-table-wrap">
                <table class="attendance-report-table">
                  <thead>
                    <tr><th>Họ đệm</th><th>Tên</th><th>Học bù từ lớp</th><th>Trạng thái</th><th>Điểm BTVN / Test</th><th>Ghi chú trong buổi</th></tr>
                  </thead>
                  <tbody>
                    ${sessionMakeups.map((s) => {
                      const { fam, giv } = getFamGiv(s);
                      const seated = entries.find(p => p.entry.studentId === s.id);
                      const isLate = lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late';
                      const isPresent = Boolean(seated);
                      const attText = formatMergedAttendanceAndArrival(s, seated, isLate, isPresent, true, date, currentClass.id);
                      const hwScore = formatScoreVN(seated?.entry.homework?.score ?? s.homework?.score, '—');
                      const testScore = formatScoreVN(s.testScore ?? seated?.entry.testScore, '—');
                      const noteInSession = getStudentSessionNote(s, seated);
                      return `<tr class="makeup-row-tr"><td>${escapeHtml(fam)}</td><td><strong style="color:#581c87;">${escapeHtml(giv)}</strong> <span class="makeup-status-badge">Học bù</span></td><td>${escapeHtml(s.sourceClassName||'Lớp khác')}</td><td><strong>${escapeHtml(attText)}</strong></td><td>BTVN: ${escapeHtml(hwScore)} · Test: ${escapeHtml(testScore)}</td><td>${escapeHtml(noteInSession || '—')}</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div style="color:#6b21a8; font-size:13.5px; font-weight:600; margin-top:4px;">Không có học sinh học bù trong buổi này.</div>'}
          </div>

          <div class="report-section-card border-neutral">
            <strong class="report-section-title" style="color:#374151;">5. Học sinh VẮNG MẶT (${absentList.length} bạn):</strong>
            ${absentList.length ? `
              <div class="attendance-table-wrap">
                <table class="attendance-report-table">
                  <thead>
                    <tr><th>Họ đệm</th><th>Tên</th><th>Trường</th><th>Trạng thái vắng</th><th>Lý do</th><th>Ghi chú trong buổi</th></tr>
                  </thead>
                  <tbody>
                    ${absentList.map((s) => {
                      const { fam, giv } = getFamGiv(s);
                      const noteInSession = getStudentSessionNote(s, null);
                      return `<tr><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong></td><td>${escapeHtml(s.school||'—')}</td><td>${s.attendance?.status === 'absent_excused' ? 'Có phép' : 'Chưa phép'}</td><td>${escapeHtml(s.attendance?.reason||'Chưa có lý do')}</td><td>${escapeHtml(noteInSession || '—')}</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="report-empty-ok">✓ 100% học sinh đều có mặt!</div>'}
          </div>

          ${sessionNote ? `
            <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:10px 14px; border-radius:6px; font-size:13.5px; color:#166534;">
              <strong>Nhận xét & Lưu ý của Trợ giảng trong ca:</strong>
              <p style="margin:4px 0 0; white-space:pre-wrap;">${escapeHtml(sessionNote)}</p>
            </div>
          ` : ''}
        </div>
      `;

      // Wire customizable low-score threshold controls
      container.querySelectorAll('[data-low-score-preset]').forEach(btn => {
        btn.onclick = () => {
          setLowScoreThreshold(btn.dataset.lowScorePreset);
          renderReportCenter('teacher-summary');
        };
      });
      const customLowInput = container.querySelector('#custom-low-score-input');
      if (customLowInput) {
        const applyCustomLowScore = () => {
          const parsed = parseScoreVN(customLowInput.value);
          if (parsed !== null && !Number.isNaN(parsed) && parsed >= 0 && parsed <= 10) {
            setLowScoreThreshold(parsed);
            renderReportCenter('teacher-summary');
          }
        };
        customLowInput.addEventListener('change', applyCustomLowScore);
        customLowInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyCustomLowScore();
          }
        });
      }
    } else if (tabName === 'a4-roster') {
      const colOrder = getReportColumnOrder();
      const thMap = {
        family: '<th>Họ đệm</th>',
        given: '<th>Tên</th>',
        code: '<th>Mã HS</th>',
        school: '<th>Trường / Phân loại</th>',
        attendance: '<th>Điểm danh</th>',
        homework: '<th>BTVN</th>',
        hwScore: '<th style="text-align:center;">Điểm BTVN</th>',
        testScore: '<th style="text-align:center;">Điểm Test</th>',
        note: '<th>Ghi chú</th>'
      };

      container.innerHTML = `
        <div class="attendance-report-heading report-compact-heading">
          <div>
            <strong class="report-heading-eyebrow">TRUNG TÂM HỌC TẬP - BẢNG ĐIỂM DANH & THEO DÕI CA HỌC</strong>
            <div class="report-heading-main">Lớp: <strong>${escapeHtml(currentClass.name)}</strong> (${escapeHtml(formatBirthYearLabel(currentClass.grade))}) · Phòng: ${escapeHtml(currentClass.room)} · Môn: ${escapeHtml(currentClass.subject)}</div>
          </div>
          <div class="report-heading-right">
            <div>Ngày: <strong>${escapeHtml(date)}</strong> · Giờ: ${escapeHtml(currentClass.startTime)}–${escapeHtml(currentClass.endTime)}</div>
            <div>GV: <strong>${escapeHtml(currentClass.teacherName || '—')}</strong> · TA: <strong>${escapeHtml(currentClass.assistantName || '—')}</strong></div>
          </div>
        </div>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr>
                ${colOrder.map(k => thMap[k] || '').join('')}
              </tr>
            </thead>
            <tbody>
              ${roster.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                const isLate = lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late' || s.attendance?.status === 'late';
                const isPresent = Boolean(seated);
                const mergedAttStatus = formatMergedAttendanceAndArrival(s, seated, isLate, isPresent, isMakeup, date, currentClass.id);
                const hwObj = seated?.entry.homework || s.homework || { status: 'uncollected' };
                const hwStatusText = resolveHomeworkStatusWithReason(hwObj);
                const hwScore = formatScoreVN(hwObj.score ?? '', '');
                const testScore = formatScoreVN(seated?.entry.testScore ?? s.testScore ?? '', '');
                const schoolText = isMakeup ? `Học bù từ: ${s.sourceClassName || s.school || 'Lớp khác'}` : (s.school || '');
                const noteText = getStudentSessionNote(s, seated);

                const tdMap = {
                  family: `<td>${escapeHtml(fam)}</td>`,
                  given: `<td><strong style="color:${isMakeup ? '#581c87' : 'inherit'};">${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td>`,
                  code: `<td>${escapeHtml(s.studentCode || '—')}</td>`,
                  school: `<td>${escapeHtml(schoolText)}</td>`,
                  attendance: `<td><span class="student-state ${isPresent || isLate ? (isLate ? 'state-late' : 'state-present') : 'state-missing'}">${escapeHtml(mergedAttStatus)}</span></td>`,
                  homework: `<td>${escapeHtml(hwStatusText)}</td>`,
                  hwScore: `<td style="text-align:center; font-weight:700;">${escapeHtml(hwScore)}</td>`,
                  testScore: `<td style="text-align:center; font-weight:700;">${escapeHtml(testScore)}</td>`,
                  note: `<td>${escapeHtml(noteText)}</td>`
                };

                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    ${colOrder.map(k => tdMap[k] || '').join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="report-signature-row">
          <div style="text-align:center;">
            <strong>Chữ ký Trợ giảng</strong><br><br>
            <span>${escapeHtml(currentClass.assistantName || '—')}</span>
          </div>
          <div style="text-align:center;">
            <strong>Chữ ký Giáo viên phụ trách</strong><br><br>
            <span>${escapeHtml(currentClass.teacherName || '—')}</span>
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
        <h3>Danh sách học sinh CHƯA NỘP bài tập về nhà (${missingHW.length} bạn)</h3>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Lý do chưa nộp</th><th>Ghi chú trong buổi</th></tr>
            </thead>
            <tbody>
              ${missingHW.length ? missingHW.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                const reasonMap = { not_done: 'Chưa làm bài', forgot: 'Quên mang vở', missed_previous: 'Nghỉ buổi trước' };
                const reason = reasonMap[seated?.entry.homework?.reason || s.homework?.reason] || seated?.entry.homework?.reason || s.homework?.reason || 'Chưa làm';
                const noteText = getStudentSessionNote(s, seated);
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td>
                    <td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school || '—'))}</td>
                    <td><strong class="text-danger">${escapeHtml(reason)}</strong></td>
                    <td>${escapeHtml(noteText || '—')}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="5" style="text-align:center; padding:18px; color:#497955;">Tuyệt vời! Tất cả học sinh có mặt đều đã nộp BTVN.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (tabName === 'late-students') {
      const lateList = roster.filter(s => {
        const seated = entries.find(p => p.entry.studentId === s.id);
        return lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late' || s.attendance?.status === 'late';
      });

      container.innerHTML = `
        <h3>Danh sách học sinh ĐI MUỘN (${lateList.length} bạn)</h3>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Trạng thái & Giờ đến</th><th>Ghi chú trong buổi</th></tr>
            </thead>
            <tbody>
              ${lateList.length ? lateList.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                const lateLabel = formatMergedAttendanceAndArrival(s, seated, true, true, isMakeup, date, currentClass.id);
                const noteText = getStudentSessionNote(s, seated);
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td>
                    <td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school || '—'))}</td>
                    <td><strong style="color:#ab5d18;">${escapeHtml(lateLabel)}</strong></td>
                    <td>${escapeHtml(noteText || '—')}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="5" style="text-align:center; padding:18px; color:#497955;">Không có học sinh nào đi muộn trong ca học này.</td></tr>`}
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
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường</th><th>Trạng thái vắng</th><th>Lý do vắng</th><th>Ghi chú trong buổi</th></tr>
            </thead>
            <tbody>
              ${absentList.length ? absentList.map((s) => {
                const { fam, giv } = getFamGiv(s);
                const isExcused = s.attendance?.status === 'absent_excused';
                const noteText = getStudentSessionNote(s, null);
                return `
                  <tr>
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong></td>
                    <td>${escapeHtml(s.school || '—')}</td>
                    <td><span class="student-state ${isExcused ? 'state-late' : 'state-missing'}">${isExcused ? 'Có phép' : 'Không phép'}</span></td>
                    <td>${escapeHtml(s.attendance?.reason || 'Chưa ghi nhận')}</td>
                    <td>${escapeHtml(noteText || '—')}</td>
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
        <div class="attendance-report-heading report-compact-heading">
          <div>
            <strong>Xác nhận bàn giao bài chấm:</strong>
            <div>Người mang bài về chấm: <strong>${escapeHtml($('#handover-person')?.value || 'Chưa xác nhận')}</strong></div>
          </div>
          <div class="report-heading-right">
            <div>Ngày bàn giao: <strong>${escapeHtml(date)}</strong></div>
            <div>Trạng thái: <strong>${escapeHtml($('#handover-status')?.textContent || 'Chưa bàn giao')}</strong></div>
          </div>
        </div>
        <div class="attendance-table-wrap">
          <table class="attendance-report-table">
            <thead>
              <tr><th>Họ đệm</th><th>Tên</th><th>Trường / Phân loại</th><th>Trạng thái bài test</th><th>Điểm số</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${roster.map((s) => {
                const { fam, giv, isMakeup } = getFamGiv(s);
                const seated = entries.find(p => p.entry.studentId === s.id);
                const tScore = formatScoreVN(seated?.entry.testScore ?? s.testScore ?? '', '—');
                return `
                  <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
                    <td>${escapeHtml(fam)}</td>
                    <td><strong>${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">Học bù</span>' : ''}</td>
                    <td>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school || '—'))}</td>
                    <td><span class="student-state ${seated ? 'state-collected' : 'state-pending'}">${seated ? 'Đã thu bài test' : 'Vắng mặt'}</span></td>
                    <td style="text-align:center; font-weight:700;">${escapeHtml(tScore)}</td>
                    <td>${escapeHtml(getStudentSessionNote(s, seated) || '')}</td>
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
      (m.attendingClassId === currentClass.id && m.attendingSessionDate === date) ||
      entries.some(e => e.entry.studentId === m.id) ||
      lateQueueIds.includes(m.id)
    ).sort(byAlpha);
    const roster = [...regularRoster, ...sessionMakeups];

    const colOrder = getReportColumnOrder();
    const headerLabelMap = Object.fromEntries(REPORT_DEFAULT_COLUMNS.map(c => [c.key, c.label]));
    const headers = colOrder.map(k => headerLabelMap[k] || k);

    const rows = roster.map((s) => {
      const seated = entries.find(p => p.entry.studentId === s.id);
      const isLate = lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late' || s.attendance?.status === 'late';
      const isPresent = Boolean(seated);
      const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(currentClass.id);
      const mergedAtt = formatMergedAttendanceAndArrival(s, seated, isLate, isPresent, isMakeup, date, currentClass.id);
      const hwObj = seated?.entry.homework || s.homework || { status: 'uncollected' };
      const hwText = resolveHomeworkStatusWithReason(hwObj);
      const hwScore = formatScoreVN(hwObj.score ?? '', '');
      const testScore = formatScoreVN(seated?.entry.testScore ?? s.testScore ?? '', '');
      const fam = s.familyName || splitVietnameseName(s.name).familyName;
      const giv = s.givenName || splitVietnameseName(s.name).givenName;
      const noteText = (ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : s.sessionNote) || '';

      const valMap = {
        family: fam,
        given: giv,
        code: s.studentCode || '',
        school: isMakeup ? `Học bù (${s.sourceClassName || s.school || ''})` : (s.school || ''),
        attendance: mergedAtt,
        homework: hwText,
        hwScore,
        testScore,
        note: noteText
      };
      return colOrder.map(k => valMap[k] ?? '');
    });

    const fileName = `DiemDanh_${(currentClass.code || currentClass.name).replace(/\s+/g, '_')}_${date}.xlsx`;
    const outName = exportToExcel(headers, rows, fileName);
    toast(`Đã tải về file Excel (.xlsx) theo đúng thứ tự cột đã chọn: ${outName}`);
  }

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

    // Collect confirmed work shifts in this month (keyed by employeeId v2 with fallback to legacy v1 name key)
    const personalWorkKeyV2 = `lopvui.personal-work.v2.${emp.id}`;
    const personalWorkKeyV1 = `lopvui.personal-work.v1.${encodeURIComponent(emp.name.trim().toLocaleLowerCase('vi'))}`;
    let personalWorkDays = {};
    try {
      const v2 = JSON.parse(localStorage.getItem(personalWorkKeyV2) || 'null');
      const v1 = JSON.parse(localStorage.getItem(personalWorkKeyV1) || '{}');
      personalWorkDays = (v2 && typeof v2 === 'object' && Object.keys(v2).length) ? { ...v1, ...v2 } : (v1 || {});
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

          const histRec = getSessionRecord(cls.id, dateStr);
          const isWorked = Boolean(
            personalWorkDays[dateStr] ||
            chk?.workStart?.name ||
            chk?.workStart?.staff ||
            chk?.items?.[0]?.done ||
            (histRec && (histRec.startedBy?.id === emp.id || histRec.closedBy?.id === emp.id || histRec.status === 'closed'))
          );
          if (isWorked) {
            const [startH, startM] = (cls.startTime || '15:30').split(':').map(Number);
            const [endH, endM] = (cls.endTime || '17:00').split(':').map(Number);
            const durationHours = Math.max(0.5, ((endH * 60 + endM) - (startH * 60 + startM)) / 60);
            const workAt = chk?.workStart?.at || personalWorkDays[dateStr]?.at || (histRec?.startedAt ? Date.parse(histRec.startedAt) : null);
            const confirmedTimeStr = chk?.workStart?.time
              ? `Lúc ${chk.workStart.time}`
              : (workAt ? `Lúc ${new Date(workAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Xác nhận trong ca');

            confirmedShifts.push({
              date: dateStr,
              className: cls.name,
              classCode: cls.code || cls.id,
              room: cls.room,
              time: `${cls.startTime}–${cls.endTime}`,
              durationHours: durationHours.toFixed(1),
              confirmedAt: confirmedTimeStr,
              confirmedBy: chk?.workStart?.name || chk?.workStart?.staff || histRec?.startedBy?.name || emp.name,
              checklistComplete: Boolean(chk?.items?.length ? chk.items.every(i => i.done) : (histRec?.checklistSummary?.length ? histRec.checklistSummary.every(i => i.done) : true))
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
      if (getSignedInAccount()?.role !== 'admin') {
        toast('Chỉ Quản trị viên (Admin) mới có quyền truy cập Quản lý Nhân sự & Mật khẩu.');
        return;
      }
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
        tags: ['Mới'],
        isNew: true,
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
      ctx.refreshAllActiveViews?.();
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
      const isXlsx = /\.xlsx$/i.test(file.name || '');
      const reader = new FileReader();
      if (isXlsx) {
        reader.onload = async (event) => {
          try {
            const rows = await parseXlsxArrayBuffer(event.target.result);
            if (!rows.length) {
              toast('Không đọc được dữ liệu từ file .xlsx này. Bạn có thể copy-paste trực tiếp từ Excel.');
              return;
            }
            const tsvText = rows.map(r => r.map(c => String(c ?? '').replace(/\t/g, ' ')).join('\t')).join('\n');
            if (textarea) textarea.value = tsvText;
            parseAndRenderFromText(tsvText, true);
          } catch {
            toast('Không thể đọc file .xlsx. Vui lòng thử copy-paste bảng dữ liệu.');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (event) => {
          const content = event.target.result || '';
          if (textarea) textarea.value = content;
          parseAndRenderFromText(content, true);
        };
        reader.readAsText(file, 'utf-8');
      }
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
          const tagsArr = (item.tag && String(item.tag).trim().toLowerCase() !== 'mới') ? [String(item.tag).trim()] : [];
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
            isNew: false,
            kind: 'regular'
          });
          newStudent.isNew = false;
          newStudent.tags = tagsArr;
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
      ctx.closeDialogSafely ? ctx.closeDialogSafely('#import-roster-dialog') : $('#import-roster-dialog')?.close();
      if (activeRosterClassId) renderRosterAdminTable(activeRosterClassId);
      ctx.refreshAllActiveViews?.();
      toast(`✓ Đã nhập thành công: ${addedCount} học sinh mới, cập nhật ${updatedCount} học sinh.`);
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
      openBulkStudentActionDialog({
        mode: 'add-tag',
        studentIds: Array.from(selectedMasterStudentIds)
      });
    });

    $('#master-bulk-remove-tag-btn')?.addEventListener('click', () => {
      openBulkStudentActionDialog({
        mode: 'remove-tag',
        studentIds: Array.from(selectedMasterStudentIds)
      });
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

  const MASTER_DEFAULT_COLUMNS = [
    { key: 'code', label: 'Mã HS' },
    { key: 'family', label: 'Họ đệm' },
    { key: 'given', label: 'Tên' },
    { key: 'school', label: 'Trường học' },
    { key: 'parent', label: 'Phụ huynh' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'classes', label: 'Các lớp theo học' }
  ];

  function getMasterColumnOrder() {
    const defKeys = MASTER_DEFAULT_COLUMNS.map(c => c.key);
    try {
      const saved = JSON.parse(localStorage.getItem('lopvui.column-order.master.v1') || 'null');
      if (Array.isArray(saved) && saved.length) {
        const valid = saved.filter(k => defKeys.includes(k));
        defKeys.forEach(k => { if (!valid.includes(k)) valid.push(k); });
        return valid;
      }
    } catch {}
    return defKeys;
  }

  function getScopedMasterStudents() {
    const allStudents = getStudents();
    const acc = getSignedInAccount();
    if (!acc || acc.role === 'admin' || !acc.employeeId) return allStudents;
    const visibleClasses = getVisibleClasses();
    const visibleIds = new Set(visibleClasses.map(c => c.id));
    // Non-admin accounts only see students enrolled in classes they are assigned to!
    return allStudents.filter(s =>
      (s.classIds || []).some(cid => visibleIds.has(cid)) ||
      (s.attendingClassId && visibleIds.has(s.attendingClassId))
    );
  }

  function renderMasterStudentDirectory() {
    const students = getScopedMasterStudents();
    const visibleCatalog = getVisibleClasses();
    const fullCatalog = getClassCatalog();

    const classFilter = $('#master-class-filter');
    if (classFilter) {
      const prevVal = classFilter.value || 'all';
      classFilter.innerHTML = '<option value="all">Tất cả các lớp phụ trách</option>' + visibleCatalog.map(c =>
        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.code || c.id)} (${escapeHtml(formatBirthYearLabel(c.grade))})</option>`
      ).join('');
      if (prevVal === 'all' || visibleCatalog.some(c => c.id === prevVal)) {
        classFilter.value = prevVal;
      } else {
        classFilter.value = 'all';
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
          const c = fullCatalog.find(x => x.id === cid);
          return c && normalizeGradeToBirthYear(c.grade) === normTarget;
        });
        if (!hasMatchingGrade) return false;
      }
      const stVal = (s.enrollmentStatus && String(s.enrollmentStatus).trim()) ? String(s.enrollmentStatus).trim() : 'Học';
      if (selectedMasterStatuses && !selectedMasterStatuses.has(stVal)) {
        return false;
      }
      if (searchQuery) {
        const full = `${s.name} ${s.familyName || ''} ${s.givenName || ''} ${s.studentCode || ''} ${s.school || ''} ${s.parentContact?.name || ''} ${stVal}`;
        if (!matchesAcronymOrText(full, searchQuery)) return false;
      }
      return true;
    });

    const tbody = $('#master-student-tbody');
    const theadRow = document.querySelector('#master-student-table thead tr');
    if (!tbody) return;

    let masterSortKey = window._masterSortKey || 'index';
    let masterSortOrder = window._masterSortOrder || 'asc';
    const colOrder = getMasterColumnOrder();

    if (theadRow) {
      const sortIcon = (k) => masterSortKey === k ? (masterSortOrder === 'asc' ? '▲' : '▼') : '⇅';
      const sortCls = (k) => masterSortKey === k ? (masterSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';
      const thHtmlMap = {
        code: `<th class="sortable-th ${sortCls('code')}" data-master-sort="code">Mã HS <span class="sort-icon">${sortIcon('code')}</span></th>`,
        family: `<th class="sortable-th ${sortCls('family')}" data-master-sort="family">Họ đệm <span class="sort-icon">${sortIcon('family')}</span></th>`,
        given: `<th class="sortable-th ${sortCls('given')}" data-master-sort="given">Tên <span class="sort-icon">${sortIcon('given')}</span></th>`,
        school: `<th class="sortable-th ${sortCls('school')}" data-master-sort="school">Trường học <span class="sort-icon">${sortIcon('school')}</span></th>`,
        parent: `<th class="sortable-th ${sortCls('parent')}" data-master-sort="parent">Phụ huynh <span class="sort-icon">${sortIcon('parent')}</span></th>`,
        status: `<th class="sortable-th ${sortCls('status')}" data-master-sort="status">Trạng thái <span class="sort-icon">${sortIcon('status')}</span></th>`,
        classes: `<th class="sortable-th ${sortCls('classes')}" data-master-sort="classes">Các lớp theo học <span class="sort-icon">${sortIcon('classes')}</span></th>`
      };
      theadRow.innerHTML = `
        <th style="width:30px; text-align:center;"><input type="checkbox" id="master-bulk-select-all" title="Chọn tất cả" /></th>
        ${colOrder.map(k => thHtmlMap[k] || '').join('')}
        <th style="text-align:center;">Hành động</th>
      `;
    }

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
      th.onclick = () => {
        const key = th.dataset.masterSort;
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
      tbody.innerHTML = `<tr><td colspan="${colOrder.length + 2}" style="text-align:center; padding:18px; color:#879389;">Không tìm thấy học sinh nào trong các lớp bạn đang phụ trách.</td></tr>`;
      return;
    }

    const visibleClassIdsSet = new Set(visibleCatalog.map(c => c.id));
    const isAdmin = getSignedInAccount()?.role === 'admin';

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

      const displayClassIds = isAdmin
        ? (s.classIds || [])
        : (s.classIds || []).filter(cid => visibleClassIdsSet.has(cid));

      const classPlainLinks = displayClassIds.map(cid => {
        const c = fullCatalog.find(x => x.id === cid);
        const cCode = c ? (c.code || c.name) : cid;
        return `<span class="plain-class-link" data-open-student-class="${escapeHtml(s.id)}" data-class-id="${escapeHtml(cid)}" title="Bấm xem tình hình học lớp ${escapeHtml(cCode)}">${escapeHtml(cCode)}</span>`;
      }).join(', ') || '<small style="color:#a8b4aa;">Chưa gán lớp</small>';

      const cellMap = {
        code: `<td><strong>${escapeHtml(s.studentCode || '—')}</strong></td>`,
        family: `<td style="cursor:pointer;" data-view-student-detail="${escapeHtml(s.id)}" title="Bấm mở Hồ sơ thông tin chung">${escapeHtml(fam || '—')}</td>`,
        given: `<td style="cursor:pointer;" data-view-student-detail="${escapeHtml(s.id)}" title="Bấm mở Hồ sơ thông tin chung"><strong style="color:#1b522c; text-decoration:underline;">${escapeHtml(giv || s.name)}</strong>${renderStudentTagsBadges(s)}</td>`,
        school: `<td>${escapeHtml(s.school || '—')}</td>`,
        parent: `<td><div>${escapeHtml(s.parentContact?.name || '—')}</div></td>`,
        status: `<td style="white-space:nowrap;"><span class="enrollment-status-pill ${stClass}">${escapeHtml(stVal)}</span></td>`,
        classes: `<td class="col-allow-wrap plain-class-cell">${classPlainLinks}</td>`
      };

      return `
        <tr>
          <td style="text-align:center;"><input type="checkbox" class="master-student-cb" data-student-id="${escapeHtml(s.id)}" ${selectedMasterStudentIds.has(s.id) ? 'checked' : ''} /></td>
          ${colOrder.map(k => cellMap[k] || '').join('')}
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
    const students = getScopedMasterStudents();
    const visibleCatalog = getVisibleClasses();
    const visibleIds = new Set(visibleCatalog.map(c => c.id));
    const isAdmin = getSignedInAccount()?.role === 'admin';
    const fullCatalog = getClassCatalog();

    const sorted = [...students].sort((a, b) => {
      const aGiven = a.givenName || splitVietnameseName(a.name).givenName;
      const bGiven = b.givenName || splitVietnameseName(b.name).givenName;
      const aFamily = a.familyName || splitVietnameseName(a.name).familyName;
      const bFamily = b.familyName || splitVietnameseName(b.name).familyName;
      return aGiven.localeCompare(bGiven, 'vi') || aFamily.localeCompare(bFamily, 'vi');
    });

    const colOrder = getMasterColumnOrder();
    const labelMap = Object.fromEntries(MASTER_DEFAULT_COLUMNS.map(c => [c.key, c.label]));
    const headers = ['STT', ...colOrder.map(k => labelMap[k] || k), 'Học sinh mới'];

    const rows = sorted.map((s, idx) => {
      const scopedCids = isAdmin ? (s.classIds || []) : (s.classIds || []).filter(cid => visibleIds.has(cid));
      const classNames = scopedCids.map(cid => {
        const c = fullCatalog.find(x => x.id === cid);
        return c ? (c.code || c.name) : cid;
      }).join('; ');
      const fam = s.familyName || splitVietnameseName(s.name).familyName;
      const giv = s.givenName || splitVietnameseName(s.name).givenName;
      const valMap = {
        code: s.studentCode || '',
        family: fam,
        given: giv,
        school: s.school || '',
        parent: s.parentContact?.name || '',
        status: s.enrollmentStatus || 'Học',
        classes: classNames
      };
      return [
        idx + 1,
        ...colOrder.map(k => valMap[k] ?? ''),
        s.isNew || (s.tags && s.tags.includes('Mới')) ? 'Có' : 'Không'
      ];
    });
    const outName = exportToExcel(headers, rows, `DanhSachHocSinh_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(`Đã xuất file Excel (.xlsx) danh sách học sinh: ${outName}`);
  }

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

      const initialChar = escapeHtml((student.givenName || student.name || 'H').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'H');
      const resolvedClsPhoto = resolveStudentPhotoUrls(student);
      const clsThumbUrl = resolvedClsPhoto.thumbUrl || student.photoURL;
      const portraitHtml = clsThumbUrl ? `
        <div class="student-portrait-showcase">
          <button type="button" id="class-profile-photo-expand" class="student-portrait-frame-btn" title="Bấm để phóng to ảnh chân dung ${escapeHtml(student.name)}">
            <img src="${escapeHtml(clsThumbUrl)}" alt="Ảnh chân dung ${escapeHtml(student.name)}" class="profile-portrait profile-portrait-lg" id="class-profile-portrait-img" />
            <span class="portrait-zoom-hint">🔍 Phóng to</span>
          </button>
          <div class="student-portrait-actions has-photo">
            <label class="portrait-action-btn edit" title="Đổi ảnh chân dung khác">
              📷 Đổi ảnh
              <input type="file" accept="image/*" id="class-profile-upload-input" style="display:none;" />
            </label>
            <button type="button" id="class-profile-remove-photo-btn" class="portrait-action-btn remove" title="Xóa ảnh chân dung">Xóa</button>
          </div>
        </div>
      ` : `
        <div class="student-portrait-showcase">
          <div class="profile-portrait profile-portrait-lg profile-portrait-placeholder">
            <div class="portrait-placeholder-circle">${initialChar}</div>
            <small class="portrait-placeholder-caption">Chưa có ảnh</small>
          </div>
          <div class="student-portrait-actions no-photo">
            <label class="portrait-action-btn upload">
              📷 Tải ảnh lên
              <input type="file" accept="image/*" id="class-profile-upload-input" style="display:none;" />
            </label>
          </div>
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

      const enrolledNamesList = classIds
        .map(cid => {
          if (cid === TUTORING_CLASS_ID) return 'BOTRO';
          const c = catalog.find(x => x.id === cid);
          return c ? (c.code || c.name) : cid;
        })
        .filter(Boolean);

      const html = `
        <div class="student-profile-hero-card">
          ${portraitHtml}
          <div class="student-hero-info">
            <div class="student-hero-title-row">
              <div class="student-hero-name-wrap">
                <strong class="student-hero-name">${escapeHtml(student.name)}</strong>
                ${renderStudentTagsBadges(student)}
              </div>
              <span class="enrollment-status-pill status-text-hoc">● ${escapeHtml(student.enrollmentStatus || 'Học')}</span>
            </div>
            <div class="student-hero-meta-grid">
              <div class="hero-meta-item">
                <span class="hero-meta-label">Mã học sinh</span>
                <strong class="hero-meta-value code">${escapeHtml(student.studentCode || 'Chưa cấp mã')}</strong>
              </div>
              <div class="hero-meta-item">
                <span class="hero-meta-label">Trường học</span>
                <strong class="hero-meta-value">${escapeHtml(student.school || 'Chưa cập nhật')}</strong>
              </div>
              <div class="hero-meta-item">
                <span class="hero-meta-label">Phụ huynh</span>
                <strong class="hero-meta-value">${escapeHtml(student.parentContact?.name || 'Chưa cập nhật')}</strong>
              </div>
              <div class="hero-meta-item">
                <span class="hero-meta-label">Các lớp đang học</span>
                <strong class="hero-meta-value">${escapeHtml(enrolledNamesList.length ? enrolledNamesList.join(', ') : 'Chưa xếp lớp')}</strong>
              </div>
              ${student.officeNotes ? `
                <div class="hero-meta-item hero-meta-wide">
                  <span class="hero-meta-label">Ghi chú văn phòng</span>
                  <span class="hero-meta-note">${escapeHtml(student.officeNotes)}</span>
                </div>
              ` : ''}
            </div>
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

      // Wire click-to-expand portrait in class profile
      $('#class-profile-photo-expand')?.addEventListener('click', () => {
        if (!student.photoURL) return;
        $('#student-photo-full').src = student.photoURL;
        $('#student-photo-caption').textContent = student.name;
        $('#student-photo-dialog')?.showModal();
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


  // ----------------------------------------------------
  // KHÔI PHỤC CÁC HÀM QUẢN LÝ CA HỌC, LỊCH HỌC, CHI TIẾT NHÂN SỰ & BÁO CÁO (v3.1)
  // ----------------------------------------------------
  let schedMakeupAssistants = [];
  let schedNextAssistants = [];

  function renderSchedMakeupAssistants() {
    const host = $('#sched-makeup-assistants-selected');
    const choice = $('#sched-makeup-assistant-choice');
    const master = getMasterData();
    const assistants = (master.employees || []).filter(e => e.role === 'assistant');
    if (host) {
      host.innerHTML = schedMakeupAssistants.map(id => {
        const emp = assistants.find(a => a.id === id) || (master.employees || []).find(a => a.id === id);
        if (!emp) return '';
        return `<span class="staff-chip">${escapeHtml(emp.name)} <small>${escapeHtml(emp.code || '')}</small><button type="button" data-remove-sched-makeup-ta="${escapeHtml(emp.id)}" aria-label="Bỏ ${escapeHtml(emp.name)}">×</button></span>`;
      }).join('') || '<small class="staff-picker-empty">Chưa chọn trợ giảng</small>';
      host.querySelectorAll('[data-remove-sched-makeup-ta]').forEach(btn => {
        btn.onclick = () => {
          schedMakeupAssistants = schedMakeupAssistants.filter(id => id !== btn.dataset.removeSchedMakeupTa);
          renderSchedMakeupAssistants();
        };
      });
    }
    if (choice) {
      const avail = assistants.filter(a => !schedMakeupAssistants.includes(a.id));
      choice.innerHTML = '<option value="">Chọn trợ giảng...</option>' + avail.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)} (${escapeHtml(a.code)})</option>`).join('');
    }
  }

  function renderSchedNextAssistants() {
    const host = $('#sched-next-assistants-selected');
    const choice = $('#sched-next-assistant-choice');
    const master = getMasterData();
    const assistants = (master.employees || []).filter(e => e.role === 'assistant');
    if (host) {
      host.innerHTML = schedNextAssistants.map(id => {
        const emp = assistants.find(a => a.id === id) || (master.employees || []).find(a => a.id === id);
        if (!emp) return '';
        return `<span class="staff-chip">${escapeHtml(emp.name)} <small>${escapeHtml(emp.code || '')}</small><button type="button" data-remove-sched-next-ta="${escapeHtml(emp.id)}" aria-label="Bỏ ${escapeHtml(emp.name)}">×</button></span>`;
      }).join('') || '<small class="staff-picker-empty">Không phân công trợ giảng</small>';
      host.querySelectorAll('[data-remove-sched-next-ta]').forEach(btn => {
        btn.onclick = () => {
          schedNextAssistants = schedNextAssistants.filter(id => id !== btn.dataset.removeSchedNextTa);
          renderSchedNextAssistants();
        };
      });
    }
    if (choice) {
      const avail = assistants.filter(a => !schedNextAssistants.includes(a.id));
      choice.innerHTML = '<option value="">Chọn trợ giảng...</option>' + avail.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)} (${escapeHtml(a.code)})</option>`).join('');
    }
  }

  function switchScheduleDialogTab(tab = 'makeup') {
    const isMakeup = tab === 'makeup';
    $('#sched-tab-add-makeup')?.classList.toggle('active', isMakeup);
    $('#sched-tab-next-session')?.classList.toggle('active', !isMakeup);
    const formMakeup = $('#add-makeup-session-form');
    const formNext = $('#edit-next-session-form');
    if (formMakeup) formMakeup.hidden = !isMakeup;
    if (formNext) formNext.hidden = isMakeup;
  }

  $('#sched-tab-add-makeup')?.addEventListener('click', () => switchScheduleDialogTab('makeup'));
  $('#sched-tab-next-session')?.addEventListener('click', () => switchScheduleDialogTab('next'));

  function openSessionScheduleDialog(classId) {
    const catalog = getClassCatalog();
    const cls = catalog.find(c => c.id === classId) || getActiveClassConfig();
    const dlg = $('#session-schedule-dialog');
    if (!dlg || !cls) return;

    const master = getMasterData();
    const teachers = (master.employees || []).filter(e => e.role === 'teacher');

    if ($('#session-schedule-title')) {
      $('#session-schedule-title').textContent = `Lịch học & Điều chỉnh ca · ${cls.code || cls.name}`;
    }
    if ($('#sched-class-id')) $('#sched-class-id').value = cls.id;

    // Populate teacher selects
    const teacherOpts = teachers.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${escapeHtml(t.code)})</option>`).join('');
    if ($('#sched-makeup-teacher')) {
      $('#sched-makeup-teacher').innerHTML = teacherOpts;
      if (cls.teacherId) $('#sched-makeup-teacher').value = cls.teacherId;
    }
    if ($('#sched-next-teacher')) {
      $('#sched-next-teacher').innerHTML = teacherOpts;
      if (cls.teacherId) $('#sched-next-teacher').value = cls.teacherId;
    }

    // Tab 1 defaults (Makeup / Extra session)
    const todayIso = new Date().toLocaleDateString('sv-SE');
    if ($('#sched-makeup-date')) $('#sched-makeup-date').value = todayIso;
    if ($('#sched-makeup-room')) $('#sched-makeup-room').value = cls.room || 'P1-T3-CS1';
    if ($('#sched-makeup-category')) $('#sched-makeup-category').value = 'makeup';
    if ($('#sched-makeup-note')) $('#sched-makeup-note').value = '';
    if (window.__timeHelpers?.setDurationFieldsFromStartEnd) {
      window.__timeHelpers.setDurationFieldsFromStartEnd({
        startTime: cls.startTime || '15:30',
        endTime: cls.endTime || '17:00',
        startSel: '#sched-makeup-start',
        endSel: '#sched-makeup-end',
        durationSel: '#sched-makeup-duration',
        customWrapSel: '#sched-makeup-duration-custom-wrap',
        customInputSel: '#sched-makeup-duration-custom',
        previewSel: '#sched-makeup-time-preview'
      });
    } else {
      if ($('#sched-makeup-start')) $('#sched-makeup-start').value = cls.startTime || '15:30';
      if ($('#sched-makeup-end')) $('#sched-makeup-end').value = cls.endTime || '17:00';
    }
    schedMakeupAssistants = Array.isArray(cls.assistantIds) ? [...cls.assistantIds] : [];
    renderSchedMakeupAssistants();

    // Tab 2 defaults (Next scheduled session)
    const nextDateObj = ctx.occurrenceDate ? ctx.occurrenceDate(cls) : new Date();
    const nextDateIso = nextDateObj.toLocaleDateString('sv-SE');
    if ($('#sched-next-date')) $('#sched-next-date').value = nextDateIso;

    const allChanges = ctx.sessionChanges ? ctx.sessionChanges() : {};
    const changeKey = ctx.sessionChangeKey ? ctx.sessionChangeKey(cls.id, nextDateIso) : `${cls.id}::${nextDateIso}`;
    const existingChange = allChanges[changeKey] || null;

    if ($('#sched-next-status')) {
      $('#sched-next-status').value = existingChange?.status === 'cancelled'
        ? 'cancel'
        : existingChange?.status === 'scheduled'
          ? 'staff_change'
          : 'normal';
    }
    if ($('#sched-next-teacher') && existingChange?.teacherId) {
      $('#sched-next-teacher').value = existingChange.teacherId;
    }
    schedNextAssistants = Array.isArray(existingChange?.assistantIds)
      ? [...existingChange.assistantIds]
      : (Array.isArray(cls.assistantIds) ? [...cls.assistantIds] : []);
    renderSchedNextAssistants();
    if ($('#sched-next-note')) $('#sched-next-note').value = existingChange?.note || '';

    switchScheduleDialogTab('makeup');
    dlg.showModal();
  }

  function openStaffDetailDialog(staffId) {
    const master = getMasterData();
    const emp = (master.employees || []).find(e => e.id === staffId);
    const dlg = $('#staff-detail-dialog');
    const content = $('#staff-detail-content');
    if (!emp || !dlg || !content) return;

    const roleLabels = {
      assistant: 'Trợ giảng (TA)',
      teacher: 'Giáo viên (GV)',
      office: 'Văn phòng',
      admin: 'Quản trị viên (Admin)'
    };

    if ($('#staff-detail-title')) {
      $('#staff-detail-title').textContent = `Hồ sơ nhân sự · ${emp.name} (${emp.code})`;
    }

    const catalog = getClassCatalog();
    const changes = ctx.sessionChanges ? ctx.sessionChanges() : {};
    const shiftData = getStaffShiftData(emp.id, catalog, changes);
    const weekdays = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    content.innerHTML = `
      <div class="student-profile-header" style="margin-bottom:14px;">
        <div class="profile-portrait profile-portrait-placeholder" style="width:54px; height:54px; font-size:20px; flex-shrink:0;">
          ${escapeHtml((emp.name || 'N').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'N')}
        </div>
        <div>
          <strong style="font-size:17px; color:#1e3a29;">${escapeHtml(emp.name)}</strong>
          <div style="margin-top:4px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <span class="room-chip">Mã NV: <strong>${escapeHtml(emp.code)}</strong></span>
            <span class="staff-role-badge ${escapeHtml(emp.role)}">${escapeHtml(roleLabels[emp.role] || emp.role)}</span>
          </div>
          <small style="display:block; margin-top:6px; color:#526656;">
            SĐT: <strong>${escapeHtml(emp.phone || 'Chưa cập nhật')}</strong> · Email: <strong>${escapeHtml(emp.email || 'Chưa cập nhật')}</strong>
          </small>
          ${emp.note ? `<small style="display:block; margin-top:3px; color:#4b5563;">Chuyên môn / Ghi chú: <em>${escapeHtml(emp.note)}</em></small>` : ''}
        </div>
      </div>

      <div class="class-metrics-summary" style="margin-bottom:14px;">
        <div class="class-metric-box">
          <span>Lớp phụ trách</span>
          <strong>${shiftData.assignedRegular.length}</strong>
          <small>Lớp cố định hàng tuần</small>
        </div>
        <div class="class-metric-box">
          <span>Ca điều chỉnh / Bù</span>
          <strong style="color:#2563eb;">${shiftData.assignedSpecial.length}</strong>
          <small>Buổi phân công riêng</small>
        </div>
        <div class="class-metric-box">
          <span>Lịch sử trực ca</span>
          <strong style="color:#2e6d42;">${shiftData.workHistory.length}</strong>
          <small>Ca đã lưu trong hệ thống</small>
        </div>
      </div>

      <h4 style="margin:12px 0 6px; font-size:14.5px; color:#233d31;">1. Các lớp phụ trách cố định (${shiftData.assignedRegular.length} lớp)</h4>
      ${shiftData.assignedRegular.length ? `
        <div class="attendance-table-wrap" style="margin-bottom:14px;">
          <table class="attendance-report-table" style="font-size:13.5px;">
            <thead>
              <tr><th>Mã lớp</th><th>Tên lớp</th><th>Phòng</th><th>Lịch học</th><th>Vai trò trong lớp</th></tr>
            </thead>
            <tbody>
              ${shiftData.assignedRegular.map(c => `
                <tr>
                  <td><strong>${escapeHtml(c.classCode)}</strong></td>
                  <td>${escapeHtml(c.className)}</td>
                  <td>${escapeHtml(c.room || '—')}</td>
                  <td>${escapeHtml(weekdays[c.weekday] || '')} · ${escapeHtml(c.time)}</td>
                  <td>${escapeHtml(c.roleInClass)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-list" style="padding:10px; margin-bottom:12px;">Chưa được phân công lớp cố định nào.</div>'}

      <h4 style="margin:12px 0 6px; font-size:14.5px; color:#233d31;">2. Lịch sử các ca làm việc đã ghi nhận (${shiftData.workHistory.length} buổi)</h4>
      ${shiftData.workHistory.length ? `
        <div class="attendance-table-wrap">
          <table class="attendance-report-table" style="font-size:13.5px;">
            <thead>
              <tr><th>Ngày</th><th>Lớp</th><th>Bài học</th><th>Sĩ số</th><th>Trạng thái ca</th></tr>
            </thead>
            <tbody>
              ${shiftData.workHistory.map(s => `
                <tr>
                  <td><strong>${escapeHtml(s.date)}</strong></td>
                  <td>${escapeHtml(s.classCode || s.className)}</td>
                  <td>${escapeHtml(s.lessonTitle || 'Buổi học ' + s.date)}</td>
                  <td>${s.stats?.present || 0}/${s.stats?.total || s.studentsSnapshot?.length || 0}</td>
                  <td><span class="student-state ${s.status === 'closed' ? 'state-present' : 'state-late'}">${s.status === 'closed' ? '✓ Đã đóng ca' : '● Đang mở'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-list" style="padding:10px;">Chưa có lịch sử ca làm việc.</div>'}
    `;

    const editBtn = $('#edit-staff-from-detail-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        dlg.close();
        openStaffDialog(emp.id);
      };
    }

    dlg.showModal();
  }

  function initSessionNoHomework() {
    const classId = getCurrentClassId();
    const date = getChecklistDate();
    const statusObj = getNoHomeworkStatus(classId, date);
    const cb = $('#session-no-hw-checkbox');
    const hint = $('#no-hw-auto-hint');
    if (cb) {
      cb.checked = Boolean(statusObj.noHomework);
    }
    if (hint) {
      hint.textContent = statusObj.noHomework
        ? (statusObj.reason || 'Ca học không giao BTVN')
        : 'Tự động kiểm tra từ buổi trước';
    }
  }

  function isNoHomeworkSession() {
    const cb = $('#session-no-hw-checkbox');
    if (cb) return Boolean(cb.checked);
    return Boolean(getNoHomeworkStatus(getCurrentClassId(), getChecklistDate())?.noHomework);
  }

  function handleNoHomeworkToggle(e) {
    const checked = Boolean(e?.target?.checked);
    const classId = getCurrentClassId();
    const date = getChecklistDate();
    setNoHomeworkStatus(classId, date, checked);
    initSessionNoHomework();
    if (ctx.syncLiveSessionData) ctx.syncLiveSessionData();
    render();
    toast(checked ? 'Đã đánh dấu: Buổi học này không thu BTVN.' : 'Đã bật thu BTVN cho buổi học này.');
  }

  function updateSessionStateUI() {
    const classId = getCurrentClassId();
    const date = getChecklistDate();
    const rec = getSessionRecord(classId, date);
    const isClosed = Boolean(rec && rec.status === 'closed');

    const badge = $('#session-status-badge');
    if (badge) {
      if (isClosed) {
        badge.className = 'session-badge-state closed';
        badge.textContent = '✓ Đã đóng ca';
      } else {
        badge.className = 'session-badge-state live';
        badge.textContent = '● Đang diễn ra';
      }
    }

    const closeStatus = $('#checklist-close-session-status');
    if (closeStatus) {
      if (isClosed && rec.closedAt) {
        const timeStr = new Date(rec.closedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        closeStatus.textContent = `✓ Đã đóng ca lúc ${timeStr} bởi ${rec.closedBy?.name || 'Trợ giảng'}`;
      } else {
        closeStatus.textContent = 'Dữ liệu trong ca đang được tự động lưu liên tục.';
      }
    }

    const closeBtn = $('#checklist-close-session-btn');
    if (closeBtn) {
      closeBtn.textContent = isClosed ? 'Cập nhật & Lưu lại lịch sử ca học' : 'Kết ca học & Lưu lịch sử';
    }
  }

  function handleOpenSession() {
    const classId = getCurrentClassId();
    const date = getChecklistDate();
    const user = getSignedInAccount();
    const master = getMasterData();
    const emp = (master.employees || []).find(e => e.id === user?.employeeId);
    const cls = getActiveClassConfig();
    openClassSession(classId, date, { id: emp?.id || user?.employeeId, name: emp?.name || 'Trợ giảng', role: user?.role || 'assistant' }, cls);
    updateSessionStateUI();
    addClassActivity(`${emp?.name || 'Trợ giảng'} đã mở ca học ${cls?.name || classId}`, 'system');
    toast('Đã mở ca học.');
  }

  function handleCloseSessionPrompt() {
    const dlg = $('#close-session-dialog');
    if (!dlg) return;

    if (ctx.syncLiveSessionData) ctx.syncLiveSessionData();

    const currentClass = getActiveClassConfig();
    const date = getChecklistDate();
    const roster = classStudents();
    const entries = allEntries();
    const lateQueueIds = getLateQueue();
    const noHw = isNoHomeworkSession();

    const seatedNamed = entries.filter(e => e.entry.studentId && studentById(e.entry.studentId));
    const presentCount = seatedNamed.filter(e => e.entry.attendance?.status !== 'late').length;
    const lateCount = seatedNamed.filter(e => e.entry.attendance?.status === 'late').length +
                      lateQueueIds.filter(id => !seatedNamed.some(e => e.entry.studentId === id)).length;
    const attendedIds = new Set([...seatedNamed.map(e => e.entry.studentId), ...lateQueueIds]);
    const absentCount = roster.filter(s => !attendedIds.has(s.id)).length;
    const hwDoneCount = seatedNamed.filter(e => {
      const st = (e.entry.homework || studentById(e.entry.studentId)?.homework)?.status;
      return st === 'submitted' || st === 'graded';
    }).length;

    if ($('#close-session-title')) {
      $('#close-session-title').textContent = `Tổng kết & Đóng ca học · ${currentClass?.code || currentClass?.name || ''}`;
    }
    if ($('#close-stat-present')) $('#close-stat-present').textContent = `${presentCount + lateCount}/${roster.length}`;
    if ($('#close-stat-late')) $('#close-stat-late').textContent = String(lateCount);
    if ($('#close-stat-absent')) $('#close-stat-absent').textContent = String(absentCount);
    if ($('#close-stat-hw')) $('#close-stat-hw').textContent = noHw ? 'Không BTVN' : `${hwDoneCount}/${presentCount + lateCount}`;

    const lessonTitle = $('#lesson-title')?.value?.trim() || '';
    const hwAssign = $('#homework-assignment')?.value?.trim() || '';
    const handoverPerson = $('#handover-person')?.value?.trim() || '';
    const testRequired = Boolean($('#test-required-toggle')?.checked);

    const detailsBox = $('#close-session-details-box');
    if (detailsBox) {
      detailsBox.innerHTML = `
        <div><strong>Lớp học:</strong> ${escapeHtml(currentClass?.name || '')} (${escapeHtml(currentClass?.code || '')}) · <strong>Ngày:</strong> ${escapeHtml(date)}</div>
        <div><strong>Tên bài học:</strong> ${lessonTitle ? escapeHtml(lessonTitle) : '<span style="color:#b45309;">Chưa nhập tên bài học</span>'}</div>
        <div><strong>BTVN giao về nhà:</strong> ${hwAssign ? escapeHtml(hwAssign) : '<em>Không ghi nội dung BTVN</em>'}</div>
        ${testRequired ? `<div><strong>Bàn giao bài Test:</strong> ${handoverPerson ? escapeHtml(handoverPerson) : '<span style="color:#b91c1c;">Chưa xác nhận người cầm bài về chấm</span>'}</div>` : ''}
      `;
    }

    // Check uncompleted items
    const warnings = [];
    const anonymousTokens = entries.filter(e => !e.entry.studentId).length;
    if (anonymousTokens > 0) {
      warnings.push(`Còn <strong>${anonymousTokens} biểu tượng chỗ ngồi</strong> trên sơ đồ chưa chọn tên học sinh.`);
    }
    if (!noHw) {
      const uncollectedHw = seatedNamed.filter(e => {
        const st = (e.entry.homework || studentById(e.entry.studentId)?.homework)?.status || 'uncollected';
        return st === 'uncollected';
      }).length;
      if (uncollectedHw > 0) {
        warnings.push(`Còn <strong>${uncollectedHw} học sinh đang ngồi trong lớp</strong> chưa được tích thu BTVN (hoặc báo không nộp).`);
      }
    }
    const unmarkedAbsent = roster.filter(s => {
      if (attendedIds.has(s.id)) return false;
      const attHist = (s.attendanceHistory || []).find(h => h.classId === currentClass.id && h.date === date);
      return !attHist || (!attHist.status?.startsWith('absent'));
    }).length;
    if (unmarkedAbsent > 0) {
      warnings.push(`Còn <strong>${unmarkedAbsent} học sinh vắng mặt</strong> chưa được phân loại (Có phép / Không phép) trong mục Chốt sĩ số.`);
    }
    if (!lessonTitle) {
      warnings.push('Chưa nhập <strong>Tên bài học hôm nay</strong> ở đầu tab Checklist.');
    }
    if (testRequired && !handoverPerson) {
      warnings.push('Ca này có bài kiểm tra nhưng chưa xác nhận <strong>Tên trợ giảng cầm bài về chấm</strong>.');
    }

    const uncompletedSec = $('#close-session-uncompleted-section');
    const uncompletedList = $('#close-session-uncompleted-list');
    if (uncompletedSec && uncompletedList) {
      uncompletedSec.hidden = false;
      if (warnings.length > 0) {
        uncompletedSec.style.background = '#fffbf5';
        uncompletedSec.style.borderColor = '#f2dfc6';
        uncompletedList.innerHTML = warnings.map(w => `<div>• ${w}</div>`).join('');
      } else {
        uncompletedSec.style.background = '#f0fdf4';
        uncompletedSec.style.borderColor = '#bbf7d0';
        uncompletedList.innerHTML = '<div style="color:#166534; font-weight:700;">✓ Tất cả các mục điểm danh, BTVN và thông tin bài học đã hoàn tất đầy đủ!</div>';
      }
    }

    const rec = getSessionRecord(currentClass.id, date);
    const finalNoteInp = $('#close-session-final-note');
    if (finalNoteInp) {
      finalNoteInp.value = $('#session-note')?.value?.trim() || rec?.finalNote || '';
    }

    dlg.showModal();
  }

  function confirmCloseSession() {
    const currentClass = getActiveClassConfig();
    const date = getChecklistDate();
    const finalNote = $('#close-session-final-note')?.value?.trim() || $('#session-note')?.value?.trim() || '';

    if ($('#session-note') && finalNote) {
      $('#session-note').value = finalNote;
    }

    if (ctx.syncLiveSessionData) ctx.syncLiveSessionData();

    const user = getSignedInAccount();
    const master = getMasterData();
    const emp = (master.employees || []).find(e => e.id === user?.employeeId);
    const operator = {
      id: emp?.id || user?.employeeId || 'employee-ta-001',
      name: emp?.name || 'Trợ giảng',
      role: user?.role || 'assistant'
    };

    const existingRec = getSessionRecord(currentClass.id, date) || {};
    const closedRec = closeClassSession(currentClass.id, date, operator, {
      ...existingRec,
      classCode: currentClass.code || currentClass.id,
      className: currentClass.name || currentClass.id,
      subject: currentClass.subject || '',
      room: currentClass.room || '',
      grade: currentClass.grade || '',
      teacherName: currentClass.teacherName || '',
      assistantName: currentClass.assistantName || '',
      lessonTitle: $('#lesson-title')?.value?.trim() || existingRec.lessonTitle || '',
      homeworkAssignment: $('#homework-assignment')?.value?.trim() || existingRec.homeworkAssignment || '',
      sessionNote: finalNote,
      layout: ctx.getLayout ? ctx.getLayout() : existingRec.layout,
      deskItems: ctx.getDeskItems ? ctx.getDeskItems() : existingRec.deskItems,
      students: existingRec.studentsSnapshot || []
    }, finalNote);

    $('#close-session-dialog')?.close();
    updateSessionStateUI();
    addClassActivity(`${operator.name} đã kết thúc và đóng ca học ${currentClass.name} (Có mặt: ${closedRec.stats?.present || 0}/${closedRec.stats?.total || 0})`, 'attendance');
    toast(`✓ Đã đóng ca học ${currentClass.name} và lưu vào lịch sử quản lý.`);
    render();
  }

  // Hàm xuất danh sách lớp & lịch sử 4 buổi gần nhất ra CSV (cho nút #general-export-roster-btn)
  function exportRoster(className = 'LopHoc', records = []) {
    const cls = getActiveClassConfig();
    const allStudents = classStudents();
    const list = allStudents.length ? allStudents : records.map(r => r.student).filter(Boolean);
    const headers = ['STT', 'Mã HS', 'Họ đệm', 'Tên', 'Trường học', 'Phụ huynh', 'Ghi chú học lực'];
    const rows = list.map((s, idx) => {
      const parts = splitVietnameseName(s.name);
      return [
        idx + 1,
        s.studentCode || '',
        s.familyName ?? parts.familyName,
        s.givenName ?? parts.givenName,
        s.school || '',
        s.parentContact?.name || '',
        (s.classLearningNotes && cls && s.classLearningNotes[cls.id]) || s.learningNotes || ''
      ];
    });
    const safeCode = String(cls?.code || className || 'Lop').replace(/\s+/g, '_');
    const outName = exportToExcel(headers, rows, `DanhSachLop_${safeCode}_${getChecklistDate()}.xlsx`);
    toast(`Đã xuất file Excel (.xlsx) danh sách lớp ${cls?.code || className}: ${outName}`);
  }

  // Sao chép nhanh báo cáo tổng hợp gửi Giáo viên qua Zalo
  function copyTeacherSummaryReportToClipboard() {
    const currentClass = getActiveClassConfig();
    const date = getChecklistDate();
    const entries = allEntries();
    const lateQueueIds = getLateQueue();
    const regularRoster = classStudents();
    const allMakeups = ctx.getMakeupStudents ? ctx.getMakeupStudents() : [];
    const sessionMakeups = allMakeups.filter(m =>
      (m.attendingClassId === currentClass.id && m.attendingSessionDate === date) ||
      entries.some(e => e.entry.studentId === m.id) ||
      lateQueueIds.includes(m.id)
    );
    const roster = [...regularRoster, ...sessionMakeups];
    const lowScoreThreshold = getLowScoreThreshold();
    const thresholdStr = formatScoreVN(lowScoreThreshold, '6');

    const presentCount = entries.filter(e => e.entry.studentId && e.entry.attendance?.status === 'present').length;
    const lateList = roster.filter(s => {
      const seated = entries.find(p => p.entry.studentId === s.id);
      return lateQueueIds.includes(s.id) || seated?.entry.attendance?.status === 'late' || s.attendance?.status === 'late';
    });
    const absentList = regularRoster.filter(s => {
      const seated = entries.find(p => p.entry.studentId === s.id);
      return !seated && !lateQueueIds.includes(s.id);
    });
    const missingHW = roster.filter(s => {
      const seated = entries.find(p => p.entry.studentId === s.id);
      const st = seated?.entry.homework?.status || s.homework?.status;
      return st === 'not_submitted';
    });
    const lowScores = roster.filter(s => {
      const seated = entries.find(p => p.entry.studentId === s.id);
      const hwScore = parseScoreVN(seated?.entry.homework?.score ?? s.homework?.score);
      const testScore = parseScoreVN(s.testScore ?? seated?.entry.testScore);
      const validScores = [hwScore, testScore].filter(x => x !== null && !Number.isNaN(x));
      if (!validScores.length) return false;
      const lowest = Math.min(...validScores);
      return lowest < lowScoreThreshold && lowest >= 0;
    });

    let savedChk = {};
    try {
      savedChk = JSON.parse(localStorage.getItem(`lopvui.checklist.v1.${currentClass.id}.${date}`) || '{}') || {};
    } catch {}
    const histSession = getSessionRecord(currentClass.id, date) || {};
    const lessonTitle = $('#lesson-title')?.value?.trim() || savedChk.lessonTitle || histSession.lessonTitle || 'Chưa ghi tên bài học';
    const sessionNote = $('#session-note')?.value?.trim() || savedChk.classNote || histSession.finalNote || '';
    const homeworkAssignment = $('#homework-assignment')?.value?.trim() || savedChk.homeworkAssignment || histSession.homeworkAssignment || '';
    const homeworkLink = $('#homework-link')?.value?.trim() || savedChk.homeworkLink || histSession.homeworkLink || '';
    const notebookLink = $('#notebook-link')?.value?.trim() || savedChk.notebookLink || histSession.notebookLink || '';
    const reasonMap = { not_done: 'Chưa làm bài', forgot: 'Quên mang vở', missed_previous: 'Nghỉ buổi trước' };

    const getNote = (s, seated) => {
      const n = (ctx.sessionNoteFor ? ctx.sessionNoteFor(s.id) : '') || seated?.entry?.homework?.note || '';
      return n ? ` (Ghi chú: ${n})` : '';
    };

    const lines = [
      `📋 BÁO CÁO CA HỌC: ${currentClass.name} (${currentClass.code || currentClass.id})`,
      `• Ngày: ${date} (${currentClass.startTime}–${currentClass.endTime}) · Phòng: ${currentClass.room}`,
      `• Giáo viên: ${currentClass.teacherName} · Trợ giảng: ${currentClass.assistantName}`,
      `• Bài học: ${lessonTitle}`,
      `• BTVN giao về nhà: ${homeworkAssignment || 'Chưa ghi / Không có'}`,
      ...(homeworkLink ? [`• Link phiếu BTVN: ${homeworkLink}`] : []),
      ...(notebookLink ? [`• Link vở ghi / Bài giảng: ${notebookLink}`] : []),
      `• Sĩ số: Có mặt ${presentCount + lateList.length}/${regularRoster.length} (Đúng giờ: ${presentCount}, Đi muộn: ${lateList.length}, Vắng: ${absentList.length}${sessionMakeups.length ? `, Học bù: +${sessionMakeups.length}` : ''})`,
      ``,
      `1. Chưa nộp BTVN (${missingHW.length} HS):`,
      ...(missingHW.length
        ? missingHW.map(s => {
            const seated = entries.find(p => p.entry.studentId === s.id);
            const r = reasonMap[seated?.entry.homework?.reason || s.homework?.reason] || seated?.entry.homework?.reason || 'Chưa làm';
            return `   - ${s.name} (${s.school || '—'}): ${r}${getNote(s, seated)}`;
          })
        : ['   - 100% học sinh có mặt đã nộp đủ BTVN.']),
      `2. Đi muộn (${lateList.length} HS):`,
      ...(lateList.length
        ? lateList.map(s => {
            const seated = entries.find(p => p.entry.studentId === s.id);
            const lateStr = formatMergedAttendanceAndArrival(s, seated, true, true, false, date, currentClass.id);
            return `   - ${s.name}: ${lateStr}${getNote(s, seated)}`;
          })
        : ['   - Không có học sinh đi muộn.']),
      `3. Điểm thấp < ${thresholdStr} (${lowScores.length} HS):`,
      ...(lowScores.length
        ? lowScores.map(s => {
            const seated = entries.find(p => p.entry.studentId === s.id);
            const hwSc = formatScoreVN(seated?.entry.homework?.score ?? s.homework?.score, '—');
            const testSc = formatScoreVN(s.testScore ?? seated?.entry.testScore, '—');
            return `   - ${s.name}: BTVN ${hwSc} · Test ${testSc}${getNote(s, seated)}`;
          })
        : [`   - Không có học sinh điểm dưới ${thresholdStr}.`]),
      `4. Học sinh học bù (${sessionMakeups.length} HS):`,
      ...(sessionMakeups.length
        ? sessionMakeups.map(s => {
            const seated = entries.find(p => p.entry.studentId === s.id);
            const hwSc = formatScoreVN(seated?.entry.homework?.score ?? s.homework?.score, '');
            return `   - ${s.name} (Bù từ: ${s.sourceClassName || 'Lớp khác'})${hwSc ? ` · BTVN: ${hwSc}đ` : ''}${getNote(s, seated)}`;
          })
        : ['   - Không có học sinh học bù.']),
      `5. Vắng mặt (${absentList.length} HS):`,
      ...(absentList.length
        ? absentList.map(s => `   - ${s.name} (${s.attendance?.status === 'absent_excused' ? 'Có phép' : 'Chưa phép'}${s.attendance?.reason ? ': ' + s.attendance.reason : ''})${getNote(s, null)}`)
        : ['   - 100% học sinh có mặt đầy đủ.'])
    ];
    if (sessionNote) {
      lines.push(``, `📝 Ghi chú buổi học: ${sessionNote}`);
    }

    const text = lines.join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        toast('✓ Đã sao chép báo cáo gửi Giáo viên vào bộ nhớ tạm (dán ngay vào Zalo).');
      }).catch(() => {
        toast('Đã tạo nội dung báo cáo.');
      });
    } else {
      toast('Đã chuẩn bị báo cáo gửi Giáo viên.');
    }
  }

  // Hộp thoại thao tác hàng loạt trực quan (Thêm/Chuyển lớp, Thêm/Xóa Tag) không dùng window.prompt
  function openBulkStudentActionDialog({ mode = 'add-class', studentIds = [], currentClassId = null, onComplete = null }) {
    if (!studentIds.length) {
      toast('Vui lòng tích chọn ít nhất 1 học sinh trước khi thao tác.');
      return;
    }
    let dlg = document.getElementById('bulk-student-action-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'bulk-student-action-dialog';
      dlg.className = 'class-config-dialog';
      document.body.appendChild(dlg);
    }

    const catalog = getClassCatalog();
    const isClassMode = mode === 'add-class' || mode === 'move-class';
    const titleText = mode === 'add-class'
      ? `Thêm ${studentIds.length} học sinh vào lớp`
      : mode === 'move-class'
        ? `Chuyển ${studentIds.length} học sinh sang lớp khác`
        : mode === 'add-tag'
          ? `Gắn Tag phân loại cho ${studentIds.length} học sinh`
          : `Gỡ Tag khỏi ${studentIds.length} học sinh`;

    const presetTags = ['Mới', 'Cần chú ý', 'HS Giỏi', 'Mục tiêu 9+', 'Hay quên BTVN'];

    dlg.innerHTML = `
      <form id="bulk-student-action-form" class="dialog-form">
        <button type="button" class="close-button" id="close-bulk-action-dlg" aria-label="Đóng">×</button>
        <div class="eyebrow">THAO TÁC HÀNG LOẠT (${studentIds.length} HỌC SINH)</div>
        <h2>${escapeHtml(titleText)}</h2>
        ${isClassMode ? `
          <label class="field-label">Chọn lớp đích:
            <select id="bulk-action-target-class" required>
              ${catalog.filter(c => mode !== 'move-class' || c.id !== currentClassId).map(c => `
                <option value="${escapeHtml(c.id)}">[${escapeHtml(c.code || c.id)}] ${escapeHtml(c.name)} (${escapeHtml(formatBirthYearLabel(c.grade))})</option>
              `).join('')}
            </select>
          </label>
          ${mode === 'move-class' && !currentClassId ? `
            <label class="time-toggle" style="margin-top:10px;">
              <input type="checkbox" id="bulk-move-replace-all" checked /> Thay thế toàn bộ lớp cũ bằng lớp mới này
            </label>
          ` : ''}
        ` : `
          <div class="field-label">
            <span>Chọn nhanh Tag phổ biến:</span>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
              ${presetTags.map(t => `<button type="button" class="outline-button bulk-preset-tag-btn" data-preset-tag="${escapeHtml(t)}" style="padding:5px 10px; font-size:13px;">${escapeHtml(t)}</button>`).join('')}
            </div>
          </div>
          <label class="field-label" style="margin-top:10px;">
            ${mode === 'add-tag' ? 'Tên Tag muốn gắn:' : 'Tên Tag muốn gỡ (để trống nếu muốn xóa TẤT CẢ tag):'}
            <input type="text" id="bulk-action-tag-input" placeholder="${mode === 'add-tag' ? 'Ví dụ: Cần chú ý' : 'Để trống để xóa toàn bộ tag...'}" ${mode === 'add-tag' ? 'required' : ''} />
          </label>
        `}
        <div class="class-config-actions" style="margin-top:16px;">
          <button type="button" class="outline-button" id="cancel-bulk-action-btn">Hủy</button>
          <button type="submit" class="primary-button">✓ Áp dụng cho ${studentIds.length} học sinh</button>
        </div>
      </form>
    `;

    dlg.querySelector('#close-bulk-action-dlg').onclick = () => dlg.close();
    dlg.querySelector('#cancel-bulk-action-btn').onclick = () => dlg.close();
    dlg.querySelectorAll('.bulk-preset-tag-btn').forEach(btn => {
      btn.onclick = () => {
        const inp = dlg.querySelector('#bulk-action-tag-input');
        if (inp) inp.value = btn.dataset.presetTag;
      };
    });

    dlg.querySelector('#bulk-student-action-form').onsubmit = (ev) => {
      ev.preventDefault();
      const allStudents = getStudents();
      const makeups = ctx.getMakeupStudents ? ctx.getMakeupStudents() : [];
      const idSet = new Set(studentIds);

      if (isClassMode) {
        const targetClassId = dlg.querySelector('#bulk-action-target-class')?.value;
        if (!targetClassId) return;
        const targetCls = catalog.find(c => c.id === targetClassId);
        const replaceAll = Boolean(dlg.querySelector('#bulk-move-replace-all')?.checked);

        [...allStudents, ...makeups].forEach(s => {
          if (!idSet.has(s.id)) return;
          s.classIds = Array.isArray(s.classIds) ? s.classIds : [];
          if (mode === 'move-class') {
            if (currentClassId) {
              s.classIds = s.classIds.filter(cid => cid !== currentClassId);
            } else if (replaceAll) {
              s.classIds = [];
            }
          }
          if (!s.classIds.includes(targetClassId)) {
            s.classIds.push(targetClassId);
          }
        });

        saveStudentRecords(allStudents, makeups);
        dlg.close();
        toast(`${mode === 'move-class' ? 'Đã chuyển' : 'Đã thêm'} ${studentIds.length} học sinh vào lớp ${targetCls?.code || targetCls?.name || targetClassId}.`);
      } else {
        const rawTag = (dlg.querySelector('#bulk-action-tag-input')?.value || '').trim();
        if (mode === 'add-tag' && !rawTag) return;
        [...allStudents, ...makeups].forEach(s => {
          if (!idSet.has(s.id)) return;
          s.tags = Array.isArray(s.tags) ? s.tags : [];
          if (mode === 'add-tag') {
            if (!s.tags.some(t => t.toLowerCase() === rawTag.toLowerCase())) {
              s.tags.push(rawTag);
            }
          } else {
            if (!rawTag) s.tags = [];
            else s.tags = s.tags.filter(t => t.toLowerCase() !== rawTag.toLowerCase());
          }
        });
        saveStudentRecords(allStudents, makeups);
        dlg.close();
        toast(mode === 'add-tag'
          ? `Đã gắn tag "${rawTag}" cho ${studentIds.length} học sinh.`
          : (rawTag ? `Đã gỡ tag "${rawTag}" khỏi ${studentIds.length} học sinh.` : `Đã xóa toàn bộ tag của ${studentIds.length} học sinh.`));
      }

      if (typeof onComplete === 'function') onComplete();
      ctx.refreshAllActiveViews?.();
    };

    dlg.showModal();
  }

  // Khởi tạo tính năng Import bảng Excel/CSV và Dropdown mẫu phòng học ngay khi nạp module
  initFlexibleColumnMappingImport();
  populateRoomTemplateDropdowns();
  updateCurrentUserDisplay();

  // Gắn sự kiện cho Quản lý Nhân sự (Admin)
  $('#add-staff-member-btn')?.addEventListener('click', () => openStaffDialog(null));
  $('#export-staff-csv-btn')?.addEventListener('click', exportStaffListAsCsv);
  $('#staff-search-input')?.addEventListener('input', renderStaffManagement);
  $('#staff-role-filter')?.addEventListener('change', renderStaffManagement);
  $('#close-staff-form')?.addEventListener('click', () => $('#staff-form-dialog')?.close());
  $('#cancel-staff-form-btn')?.addEventListener('click', () => $('#staff-form-dialog')?.close());

  $('#staff-pw-default-btn')?.addEventListener('click', () => {
    const role = $('#staff-role')?.value || 'assistant';
    if ($('#staff-password')) $('#staff-password').value = role === 'admin' ? 'admin123' : '123456';
  });
  $('#staff-pw-random-btn')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    if ($('#staff-password')) $('#staff-password').value = pw;
  });

  $('#staff-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const master = getMasterData();
    const catalog = getClassCatalog();
    const editId = $('#staff-form-id')?.value?.trim() || '';
    const code = ($('#staff-code')?.value || '').trim().toUpperCase();
    const name = ($('#staff-name')?.value || '').trim();
    const role = $('#staff-role')?.value || 'assistant';
    const phone = ($('#staff-phone')?.value || '').trim();
    const email = ($('#staff-email')?.value || '').trim();
    const note = ($('#staff-note')?.value || '').trim();
    const password = ($('#staff-password')?.value || '').trim() || (role === 'admin' ? 'admin123' : '123456');
    const isActive = ($('#staff-active-status')?.value || 'active') !== 'locked';

    if (!code || !name) {
      toast('Vui lòng nhập đầy đủ Mã nhân viên và Họ tên.');
      return;
    }
    const duplicate = (master.employees || []).find(emp => emp.id !== editId && String(emp.code || '').toUpperCase() === code);
    if (duplicate) {
      toast(`Mã nhân viên "${code}" đã được sử dụng cho ${duplicate.name}.`);
      return;
    }

    if (editId) {
      const emp = (master.employees || []).find(x => x.id === editId);
      if (emp) {
        const activeAdmins = (master.employees || []).filter(x => x.id !== editId && x.role === 'admin' && x.isActive !== false);
        if (emp.role === 'admin' && (role !== 'admin' || !isActive) && activeAdmins.length === 0) {
          toast('Hệ thống bắt buộc phải có ít nhất 1 tài khoản Admin đang hoạt động.');
          return;
        }
        const prevPlain = decryptStaffPasswordForAdmin(emp, 'admin') || '';
        const pwChanged = prevPlain !== password || emp.role !== role || (emp.isActive !== false) !== isActive;
        emp.code = code;
        emp.name = name;
        emp.role = role;
        emp.phone = phone;
        emp.email = email;
        emp.note = note;
        emp.passwordHash = hashStaffPassword(code, password);
        emp.passwordCipher = encryptStaffPasswordForAdmin(code, password);
        delete emp.password;
        emp.isActive = isActive;
        if (pwChanged) {
          emp.authVersion = (Number(emp.authVersion) || 1) + 1;
        }
        emp.updatedAt = Date.now();
      }
      catalog.forEach(cls => {
        if ((cls.teacherIds || []).includes(editId)) {
          cls.teacherName = (cls.teacherIds || []).map(id => master.employees.find(x => x.id === id)?.name).filter(Boolean).join(', ');
        }
        if ((cls.assistantIds || []).includes(editId)) {
          cls.assistantName = (cls.assistantIds || []).map(id => master.employees.find(x => x.id === id)?.name).filter(Boolean).join(', ');
        }
      });
      saveClassCatalog(catalog);
    } else {
      master.employees.push(normalizeEmployeeAccount({
        id: `employee-${role}-${Date.now().toString(36)}`,
        code,
        name,
        role,
        phone,
        email,
        note,
        password,
        isActive,
        authVersion: 1,
        updatedAt: Date.now()
      }));
    }

    if (ctx.setMasterData) ctx.setMasterData(master);
    else localStorage.setItem('lopvui.master-data.v1', JSON.stringify(master));

    $('#staff-form-dialog')?.close();
    renderStaffManagement();
    renderMainMenu();
    updateCurrentUserDisplay();
    toast(editId ? `Đã cập nhật tài khoản nhân viên ${name} (${code}).` : `Đã tạo tài khoản nhân viên mới: ${name} (Mã: ${code}, MK: ${password}).`);
  });

  // Gắn sự kiện cho Hộp thoại Cấp/Đổi mật khẩu nhanh của Admin (#admin-password-dialog)
  $('#close-admin-password-dialog')?.addEventListener('click', () => $('#admin-password-dialog')?.close());
  $('#cancel-admin-password-btn')?.addEventListener('click', () => $('#admin-password-dialog')?.close());
  $('#admin-pw-set-default-btn')?.addEventListener('click', () => {
    if ($('#admin-pw-new-input')) $('#admin-pw-new-input').value = '123456';
  });
  $('#admin-pw-set-random-btn')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    if ($('#admin-pw-new-input')) $('#admin-pw-new-input').value = pw;
  });
  $('#admin-password-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const empId = $('#admin-pw-emp-id')?.value;
    const newPw = ($('#admin-pw-new-input')?.value || '').trim();
    const isActive = ($('#admin-pw-active-select')?.value || 'active') !== 'locked';
    if (!empId || !newPw) {
      toast('Vui lòng nhập mật khẩu mới.');
      return;
    }
    const master = getMasterData();
    const emp = (master.employees || []).find(x => x.id === empId);
    if (!emp) return;

    const activeAdmins = (master.employees || []).filter(x => x.id !== empId && x.role === 'admin' && x.isActive !== false);
    if (emp.role === 'admin' && !isActive && activeAdmins.length === 0) {
      toast('Không thể khóa tài khoản Admin duy nhất của hệ thống.');
      return;
    }

    emp.passwordHash = hashStaffPassword(emp.code, newPw);
    emp.passwordCipher = encryptStaffPasswordForAdmin(emp.code, newPw);
    delete emp.password;
    emp.isActive = isActive;
    emp.authVersion = (Number(emp.authVersion) || 1) + 1;
    emp.updatedAt = Date.now();
    revealedStaffPasswords.add(emp.id);

    if (ctx.setMasterData) ctx.setMasterData(master);
    else localStorage.setItem('lopvui.master-data.v1', JSON.stringify(master));

    // If Admin changed their own password, keep their active session authVersion updated
    const currentAcc = getSignedInAccount();
    if (currentAcc && currentAcc.employeeId === emp.id) {
      const updatedAcc = { ...currentAcc, authVersion: emp.authVersion };
      setSignedInAccount(updatedAcc);
      localStorage.setItem('lopvui.signed-in-account.v1', JSON.stringify(updatedAcc));
    }

    $('#admin-password-dialog')?.close();
    renderStaffManagement();
    toast(`Đã cập nhật mật khẩu mới cho ${emp.name} (${emp.code}).`);
  });

  // Gắn sự kiện cho Chốt sĩ số & Rà soát vắng mặt (#finalize-dialog)
  $('#finalize-button')?.addEventListener('click', handleFinalizeAttendance);
  $('#toolbar-finalize-btn')?.addEventListener('click', handleFinalizeAttendance);
  $('#close-finalize-dialog')?.addEventListener('click', () => $('#finalize-dialog')?.close());
  $('#cancel-finalize-btn')?.addEventListener('click', () => $('#finalize-dialog')?.close());
  $('#confirm-finalize-btn')?.addEventListener('click', confirmFinalizeAttendance);

  // Gắn sự kiện cho Trung tâm Báo cáo Buổi học 6 tab (#attendance-export-dialog)
  document.querySelectorAll('.report-tab[data-report-tab]').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      renderReportCenter(tabBtn.dataset.reportTab);
    });
  });
  $('#export-csv-button')?.addEventListener('click', exportReportAsCsv);
  $('#copy-teacher-report-btn')?.addEventListener('click', copyTeacherSummaryReportToClipboard);

  // Gắn sự kiện cho Chấm công TA (In A4 & Xuất CSV)
  $('#export-timesheet-btn')?.addEventListener('click', () => {
    window.print();
  });
  $('#export-timesheet-csv-btn')?.addEventListener('click', () => {
    const account = getSignedInAccount();
    const master = getMasterData();
    const emp = (master.employees || []).find(e => e.id === account?.employeeId) || { name: 'Anh Linh', code: 'TA001' };
    const selectedMonth = $('#portal-month-vn-select')?.value || $('#portal-month-input')?.value || new Date().toISOString().slice(0, 7);
    const rows = [...document.querySelectorAll('#portal-shift-tbody tr:not(.table-empty-row)')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => td.textContent.trim())
    );
    const headers = ['STT', 'Ngày làm việc', 'Ca học & Lớp', 'Thời gian ca', 'Thời lượng', 'Thời điểm xác nhận', 'Trạng thái đối chiếu'];
    const outName = exportToExcel(headers, rows, `BangChamCong_${emp.code}_${selectedMonth}.xlsx`);
    toast(`Đã xuất bảng chấm công Excel (.xlsx) tháng ${selectedMonth} của ${emp.name}: ${outName}`);
  });

  // Gắn sự kiện cho Thao tác hàng loạt trên Danh bạ Học sinh toàn trung tâm (#master-bulk-bar)
  setTimeout(() => {
    $('#master-bulk-add-class-btn')?.addEventListener('click', () => {
      openBulkStudentActionDialog({
        mode: 'add-class',
        studentIds: Array.from(selectedMasterStudentIds),
        onComplete: () => {
          selectedMasterStudentIds.clear();
          updateMasterBulkBar();
        }
      });
    });
    $('#master-bulk-move-class-btn')?.addEventListener('click', () => {
      openBulkStudentActionDialog({
        mode: 'move-class',
        studentIds: Array.from(selectedMasterStudentIds),
        onComplete: () => {
          selectedMasterStudentIds.clear();
          updateMasterBulkBar();
        }
      });
    });
  }, 100);

  // Gắn sự kiện cho Form Đăng nhập Mã nhân viên & Mật khẩu (#auth-login-form) và Nút Đăng xuất trong Tài khoản
  $('#logout-button')?.addEventListener('click', () => handleLogout());
  $('#sidebar-logout-btn')?.addEventListener('click', () => handleLogout());
  $('#dialog-logout-btn')?.addEventListener('click', () => {
    $('#account-switch-dialog')?.close();
    handleLogout();
  });

  $('#toggle-login-pw-btn')?.addEventListener('click', () => {
    const pwInput = $('#login-password-input');
    const btn = $('#toggle-login-pw-btn');
    if (!pwInput || !btn) return;
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? 'Ẩn' : 'Hiện';
  });

  $('#auth-login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#login-staff-code-input')?.value || '';
    const password = $('#login-password-input')?.value || '';
    const remember = $('#login-remember-checkbox') ? $('#login-remember-checkbox').checked : true;
    handleLoginByCredentials(code, password, remember);
  });

  $('#login-staff-code-input')?.addEventListener('input', () => setLoginError(''));
  $('#login-password-input')?.addEventListener('input', () => setLoginError(''));

  // Khi bấm vào thẻ tài khoản gợi ý hoặc nút "Điền Mã NV này": điền sẵn Mã NV + Mật khẩu mẫu để tiện test nhanh
  document.querySelectorAll('.login-role-card[data-direct-role]').forEach(card => {
    card.addEventListener('click', () => {
      const targetRole = card.dataset.directRole;
      const master = getMasterData();
      const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
      const emp = employees.find(e => e.role === targetRole && e.isActive !== false) || employees[0];
      if (!emp) return;
      if ($('#login-staff-code-input')) $('#login-staff-code-input').value = emp.code;
      
      setLoginError('');
      $('#login-password-input')?.focus();
    });
  });

  $('#confirm-select-login-btn')?.addEventListener('click', () => {
    const empId = $('#login-employee-select')?.value;
    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      if ($('#login-staff-code-input')) $('#login-staff-code-input').value = emp.code;
      
      setLoginError('');
      $('#login-submit-btn')?.focus();
    }
  });

  // Xác thực mật khẩu khi chuyển nhanh tài khoản trong #account-switch-dialog (dành cho user không phải Admin)
  $('#cancel-switch-auth-btn')?.addEventListener('click', () => {
    pendingSwitchTargetEmpId = null;
    if ($('#account-switch-auth-box')) $('#account-switch-auth-box').hidden = true;
  });
  const confirmSwitchWithPassword = () => {
    const rawCode = ($('#account-switch-code-input')?.value || '').trim().toUpperCase();
    const inputPw = ($('#account-switch-password-input')?.value || '').trim();
    const errEl = $('#account-switch-auth-error');
    if (!rawCode || !inputPw) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Vui lòng nhập đầy đủ Tên đăng nhập (Mã NV) và Mật khẩu.';
      }
      return;
    }
    const master = getMasterData();
    const employees = (master.employees || []).map(normalizeEmployeeAccount).filter(Boolean);
    const targetEmp = employees.find(e => e.code.toUpperCase() === rawCode || e.id.toUpperCase() === rawCode);
    if (!targetEmp || targetEmp.isActive === false || !verifyStaffPassword(targetEmp, inputPw)) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Tên đăng nhập hoặc mật khẩu không chính xác.';
      }
      $('#account-switch-password-input')?.focus();
      return;
    }
    completeLoginSession(targetEmp, true);
    try { $('#account-switch-dialog')?.close(); } catch {}
  };
  $('#confirm-switch-auth-btn')?.addEventListener('click', confirmSwitchWithPassword);
  $('#account-switch-password-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmSwitchWithPassword();
    }
  });

  // ====================================================
  // TÙY CHỈNH & ĐỔI THỨ TỰ CỘT HIỂN THỊ / XUẤT FILE (v3.2)
  // ====================================================
  const COLUMN_SCHEMAS = {
    live: {
      storageKey: 'lopvui.column-order.live.v1',
      title: 'Đổi thứ tự cột: Danh sách học sinh của lớp',
      defaults: ['family', 'name', 'school', 'seat', 'attendance', 'homework', 'score', 'note'],
      scoreNextToName: ['family', 'name', 'score', 'homework', 'note', 'attendance', 'seat', 'school'],
      labels: {
        family: 'Họ đệm',
        name: 'Tên học sinh',
        school: 'Trường học',
        seat: 'Vị trí ngồi',
        attendance: 'Trạng thái điểm danh',
        homework: 'Trạng thái BTVN',
        score: 'Điểm BTVN / Test (Nhập trực tiếp)',
        note: 'Ghi chú buổi học'
      }
    },
    scores: {
      storageKey: 'lopvui.column-order.scores.v1',
      title: 'Đổi thứ tự cột: Bảng Nhập điểm trong ca',
      defaults: ['family', 'name', 'school', 'status', 'recentScores', 'hwScore', 'testScore', 'note', 'learningNote'],
      scoreNextToName: ['family', 'name', 'hwScore', 'testScore', 'recentScores', 'status', 'note', 'learningNote', 'school'],
      labels: {
        family: 'Họ đệm',
        name: 'Tên học sinh',
        school: 'Trường / Phân loại',
        status: 'Trạng thái (Điểm danh & BTVN)',
        recentScores: 'Điểm 4 bài gần nhất',
        hwScore: 'Điểm BTVN (Nhập điểm)',
        testScore: 'Điểm Test (Hiện khi ca có test)',
        note: 'Ghi chú buổi học',
        learningNote: 'Ghi chú chung của học sinh (Học lực)'
      }
    },
    report: {
      storageKey: 'lopvui.column-order.report.v1',
      title: 'Đổi thứ tự cột: Bảng điểm danh & Xuất file Excel (.xlsx)',
      defaults: ['family', 'given', 'code', 'school', 'attendance', 'homework', 'hwScore', 'testScore', 'note'],
      scoreNextToName: ['family', 'given', 'hwScore', 'testScore', 'homework', 'note', 'attendance', 'code', 'school'],
      labels: {
        family: 'Họ đệm',
        given: 'Tên học sinh',
        code: 'Mã học sinh',
        school: 'Trường / Phân loại',
        attendance: 'Điểm danh',
        homework: 'Trạng thái BTVN (Kèm lý do)',
        hwScore: 'Điểm BTVN',
        testScore: 'Điểm Test',
        note: 'Ghi chú trong buổi'
      }
    },
    master: {
      storageKey: 'lopvui.column-order.master.v1',
      title: 'Đổi thứ tự cột: Danh bạ học sinh & Xuất Excel (.xlsx) tổng',
      defaults: ['code', 'family', 'given', 'school', 'parent', 'status', 'classes'],
      scoreNextToName: ['family', 'given', 'code', 'classes', 'status', 'school', 'parent'],
      labels: {
        code: 'Mã học sinh',
        family: 'Họ đệm',
        given: 'Tên học sinh',
        school: 'Trường học',
        parent: 'Phụ huynh',
        status: 'Trạng thái theo học',
        classes: 'Các lớp theo học'
      }
    }
  };

  let activeColumnOrderScope = 'live';
  let draftColumnOrder = [];

  function openColumnOrderDialog(scope = 'live') {
    const schema = COLUMN_SCHEMAS[scope] || COLUMN_SCHEMAS.live;
    activeColumnOrderScope = scope;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(schema.storageKey) || 'null');
    } catch {}
    if (Array.isArray(saved) && saved.length) {
      draftColumnOrder = saved.filter(k => schema.defaults.includes(k));
      schema.defaults.forEach(k => { if (!draftColumnOrder.includes(k)) draftColumnOrder.push(k); });
    } else {
      draftColumnOrder = [...schema.defaults];
    }

    const dlg = $('#column-order-dialog');
    if (!dlg) return;
    if ($('#column-order-dialog-title')) $('#column-order-dialog-title').textContent = schema.title;

    const renderList = () => {
      const listEl = $('#column-order-list');
      if (!listEl) return;
      listEl.innerHTML = draftColumnOrder.map((key, idx) => `
        <div class="column-order-item" data-col-key="${escapeHtml(key)}">
          <span class="column-order-index">${idx + 1}</span>
          <strong class="column-order-name">${escapeHtml(schema.labels[key] || key)}</strong>
          <div class="column-order-btns">
            <button type="button" class="outline-button" data-move-col-up="${idx}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px; font-size:12.5px;" title="Đẩy cột sang trái / lên trên">⬅ Lên</button>
            <button type="button" class="outline-button" data-move-col-down="${idx}" ${idx === draftColumnOrder.length - 1 ? 'disabled' : ''} style="padding:4px 10px; font-size:12.5px;" title="Đẩy cột sang phải / xuống dưới">➡ Xuống</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-move-col-up]').forEach(btn => {
        btn.onclick = () => {
          const i = Number(btn.dataset.moveColUp);
          if (i > 0) {
            const tmp = draftColumnOrder[i - 1];
            draftColumnOrder[i - 1] = draftColumnOrder[i];
            draftColumnOrder[i] = tmp;
            renderList();
          }
        };
      });
      listEl.querySelectorAll('[data-move-col-down]').forEach(btn => {
        btn.onclick = () => {
          const i = Number(btn.dataset.moveColDown);
          if (i < draftColumnOrder.length - 1) {
            const tmp = draftColumnOrder[i + 1];
            draftColumnOrder[i + 1] = draftColumnOrder[i];
            draftColumnOrder[i] = tmp;
            renderList();
          }
        };
      });
    };

    renderList();

    if ($('#col-preset-score-next-name')) {
      $('#col-preset-score-next-name').onclick = () => {
        draftColumnOrder = [...schema.scoreNextToName];
        renderList();
      };
    }
    if ($('#col-preset-reset-default')) {
      $('#col-preset-reset-default').onclick = () => {
        draftColumnOrder = [...schema.defaults];
        renderList();
      };
    }

    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
  }

  $('#customize-live-columns-btn')?.addEventListener('click', () => openColumnOrderDialog('live'));
  $('#customize-scores-columns-btn')?.addEventListener('click', () => openColumnOrderDialog('scores'));
  $('#customize-master-columns-btn')?.addEventListener('click', () => openColumnOrderDialog('master'));
  $('#customize-report-columns-btn')?.addEventListener('click', () => openColumnOrderDialog('report'));
  $('#close-column-order-dialog')?.addEventListener('click', () => $('#column-order-dialog')?.close());
  $('#cancel-column-order-btn')?.addEventListener('click', () => $('#column-order-dialog')?.close());
  $('#save-column-order-btn')?.addEventListener('click', () => {
    const schema = COLUMN_SCHEMAS[activeColumnOrderScope] || COLUMN_SCHEMAS.live;
    localStorage.setItem(schema.storageKey, JSON.stringify(draftColumnOrder));
    $('#column-order-dialog')?.close();
    if (activeColumnOrderScope === 'live' || activeColumnOrderScope === 'scores') {
      ctx.renderStudentList?.();
      ctx.renderScoresView?.();
    } else if (activeColumnOrderScope === 'master') {
      renderMasterStudentDirectory();
    } else if (activeColumnOrderScope === 'report') {
      renderReportCenter(currentReportTab || 'a4-roster');
    }
    toast('✓ Đã áp dụng thứ tự cột mới cho bảng hiển thị và xuất file.');
  });

  $('#google-sheets-sync-btn')?.addEventListener('click', () => {
    const driveCfg = loadGoogleDrivePhotoConfig();
    if ($('#drive-script-url-input')) $('#drive-script-url-input').value = driveCfg.scriptUrl || '';
    if ($('#drive-folder-id-input')) $('#drive-folder-id-input').value = driveCfg.folderId || '';
    const cfg = loadGoogleSheetsConfig();
    if ($('#sheets-spreadsheet-id')) $('#sheets-spreadsheet-id').value = cfg.spreadsheetId || '';
    if ($('#sheets-tab-name')) $('#sheets-tab-name').value = cfg.sheetName || 'DiemDanh';
    if ($('#sheets-autosync-toggle')) $('#sheets-autosync-toggle').checked = Boolean(cfg.autoSync);
    $('#google-sheets-sync-dialog')?.showModal();
  });
  $('#close-sheets-sync-dialog')?.addEventListener('click', () => $('#google-sheets-sync-dialog')?.close());
  $('#close-sheets-sync-btn')?.addEventListener('click', () => $('#google-sheets-sync-dialog')?.close());
  $('#save-drive-photo-config-btn')?.addEventListener('click', () => {
    const scriptUrl = ($('#drive-script-url-input')?.value || '').trim();
    const folderId = ($('#drive-folder-id-input')?.value || '').trim();
    saveGoogleDrivePhotoConfig({ scriptUrl, folderId });
    toast('✓ Đã lưu cấu hình kết nối kho ảnh chân dung Google Drive.');
  });
  $('#system-help-btn')?.addEventListener('click', () => {
    toast('Quản lý học sinh v3.1: Chọn lớp tại Menu Đi làm → Sơ đồ lớp (Thu BTVN & Điểm danh) → Nhập điểm → Checklist & Kết ca.');
  });

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
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
              <div>${statusBadge}</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                <button type="button" class="primary-button" data-reopen-class-date="${escapeHtml(session.date)}" style="padding:7px 12px; font-size:13.5px; font-weight:700; background:#2e6d42;">
                  ▶ Mở ca học này
                </button>
                <button type="button" class="outline-button" data-edit-history-session="${escapeHtml(session.date)}" style="padding:7px 11px; font-size:13.5px; font-weight:700; color:#1e40af; border-color:#bfdbfe; background:#eff6ff;">
                  ✎ Sửa ca
                </button>
                <button type="button" class="outline-button text-danger" data-delete-history-session="${escapeHtml(session.date)}" style="padding:7px 11px; font-size:13.5px; font-weight:700; color:#b91c1c; border-color:#fca5a5; background:#fef2f2;">
                  🗑 Xoá ca
                </button>
              </div>
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

      // Handle "Mở ca học này", "Sửa ca", "Xoá ca"
      const reopenBtn = detailContainer.querySelector('[data-reopen-class-date]');
      if (reopenBtn) {
        reopenBtn.onclick = () => {
          dialog.close();
          if (ctx.enterClass) {
            ctx.enterClass(classId, session.date);
          }
        };
      }
      const editSessBtn = detailContainer.querySelector('[data-edit-history-session]');
      if (editSessBtn) {
        editSessBtn.onclick = () => {
          ctx.openManagePastSessionDialog?.(classId, session.date);
        };
      }
      const delSessBtn = detailContainer.querySelector('[data-delete-history-session]');
      if (delSessBtn) {
        delSessBtn.onclick = () => {
          ctx.deleteClassSessionAndStudentData?.(classId, session.date);
        };
      }
    }

    const addPastBtnHtml = `<button type="button" class="primary-button" id="history-dialog-add-past-btn" style="width:100%; margin-bottom:8px; padding:8px 12px; font-size:13.5px; font-weight:700; background:#2e6d42;">+ Thêm ca học trong quá khứ</button>`;
    // Render sidebar session cards
    if (!classSessions.length) {
      listContainer.innerHTML = addPastBtnHtml + '<div style="padding:20px 10px; color:#8a998c; font-size:14px; text-align:center;">Lớp chưa có buổi học nào được ghi nhận trong lịch sử.</div>';
      renderSelectedSessionDetail(null);
    } else {
      listContainer.innerHTML = addPastBtnHtml + classSessions.map((s, idx) => {
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
    verifyActiveSessionIntegrity,
    openAdminPasswordDialog,
    updateCurrentUserDisplay,
    renderTutoringModule,
    renderRoomTemplatesList,
    openRosterAdmin,
    renderTAPortal,
    populateRoomTemplateDropdowns,
    updateLateMinutesCalculation,
    openClassHistoryDialog,
    renderReportCenter,
    exportReportAsCsv,
    exportRoster,
    handleFinalizeAttendance,
    confirmFinalizeAttendance,
    openBulkStudentActionDialog,
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

// Backdrop click-to-close is safely managed via pointerdown/click in src/app.js
