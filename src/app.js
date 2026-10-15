import { TUTORING_CLASS_CONFIG } from './data/tutoring-repository.js?v=1.3';
import * as sessionHistoryRepo from './data/session-history-repository.js?v=1.3';
let previousStudentProfileOrigin = null;
import { setupFeatures } from './features.js?v=1.3';
import { normalizeSearchText, searchStudents } from './student-search.js?v=1.3';
import { loadStudentRecords, saveStudentRecords } from './data/student-repository.js?v=1.3';
import { loadClassCommunication, saveClassCommunication } from './data/class-communication-repository.js?v=1.3';
import { loadClassCatalog, loadMasterData, saveClassCatalog, saveMasterData, loadClassSessionChanges, saveClassSessionChanges, normalizeGradeToBirthYear } from './data/class-catalog-repository.js?v=1.3';

function formatBirthYearBadge(gradeVal) {
  const by = normalizeGradeToBirthYear(gradeVal);
  if (!by || by === '—') return 'NĂM SINH —';
  return /^\d{4}$/.test(String(by)) ? `NĂM SINH ${by}` : String(by).toUpperCase();
}
function formatBirthYearInline(gradeVal) {
  const by = normalizeGradeToBirthYear(gradeVal);
  if (!by || by === '—') return 'Năm sinh —';
  return /^\d{4}$/.test(String(by)) ? `Năm sinh ${by}` : String(by);
}

// Built-in fallback for syncActiveClassSessionRecord so cached modules never break app startup
function syncActiveClassSessionRecord(classId, date, currentUser, snapshotData) {
  if (typeof sessionHistoryRepo.syncActiveClassSessionRecord === 'function') {
    return sessionHistoryRepo.syncActiveClassSessionRecord(classId, date, currentUser, snapshotData);
  }
  try {
    const history = typeof sessionHistoryRepo.loadSessionHistory === 'function'
      ? sessionHistoryRepo.loadSessionHistory()
      : JSON.parse(localStorage.getItem('lopvui.session-history.v1') || '[]');
    let record = history.find(s => s.classId === classId && s.date === date);
    const now = new Date().toISOString();
    if (!record) {
      const hasActivity = (snapshotData.students && snapshotData.students.some(s => s.attendance?.status === 'present' || s.attendance?.status === 'late' || (s.homework?.status && s.homework.status !== 'uncollected') || s.note))
        || snapshotData.lessonTitle || snapshotData.sessionNote;
      if (!hasActivity) return null;
      record = {
        id: `session-${classId}-${date}`,
        classId,
        classCode: snapshotData.classCode || classId,
        className: snapshotData.className || classId,
        date,
        status: 'active',
        startedAt: now,
        startedBy: currentUser || { id: 'sys', name: 'Hệ thống', role: 'assistant' }
      };
      history.push(record);
    }
    Object.assign(record, {
      className: snapshotData.className || record.className || classId,
      classCode: snapshotData.classCode || record.classCode || classId,
      subject: snapshotData.subject || record.subject || '',
      room: snapshotData.room || record.room || '',
      grade: snapshotData.grade || record.grade || '',
      teacherName: snapshotData.teacherName || record.teacherName || '',
      assistantName: snapshotData.assistantName || record.assistantName || '',
      lessonTitle: snapshotData.lessonTitle ?? record.lessonTitle ?? '',
      finalNote: snapshotData.sessionNote ?? record.finalNote ?? '',
      layout: snapshotData.layout || record.layout || null,
      deskItems: snapshotData.deskItems || record.deskItems || null,
      studentsSnapshot: snapshotData.students || record.studentsSnapshot || [],
      checklistSummary: snapshotData.checklistSummary || record.checklistSummary || [],
      stats: snapshotData.stats || record.stats || {},
      updatedAt: now
    });
    localStorage.setItem('lopvui.session-history.v1', JSON.stringify(history));
    return record;
  } catch {
    return null;
  }
}

// Built-in self-contained Real-time Sync Engine (zero external file dependency)
const RT_CHANNEL_NAME = 'lopvui_realtime_sync_v11';
const RT_PREFIX = 'lopvui.';
const RT_EXCLUDED = new Set(['lopvui.signed-in-account.v1']);
const RT_CLIENT_ID = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
let _rtChannel = null;
let _rtApplyingRemote = false;
let _rtSyncListeners = new Set();
let _rtStatusListeners = new Set();
let _rtDebounceTimer = null;
let _rtPendingKeys = new Set();
let _rtLastSyncTime = Date.now();
let _rtState = 'local';

const _nativeGetItem = Storage.prototype.getItem;
const _nativeSetItem = Storage.prototype.setItem;
const _nativeRemoveItem = Storage.prototype.removeItem;

function _shouldSyncKey(key) {
  return typeof key === 'string' && key.startsWith(RT_PREFIX) && !RT_EXCLUDED.has(key);
}

function _notifyRtStatus(state = _rtState, ts = Date.now(), detail = '') {
  _rtState = state;
  _rtLastSyncTime = ts;
  _rtStatusListeners.forEach(fn => {
    try { fn({ state: _rtState, lastSyncTime: _rtLastSyncTime, detail, clientId: RT_CLIENT_ID }); } catch {}
  });
}

function _scheduleRtUIRefresh(changedKeys, source = 'remote') {
  changedKeys.forEach(k => _rtPendingKeys.add(k));
  _rtLastSyncTime = Date.now();
  _notifyRtStatus(_rtState, _rtLastSyncTime, source);
  if (_rtDebounceTimer) clearTimeout(_rtDebounceTimer);
  _rtDebounceTimer = setTimeout(() => {
    const keys = Array.from(_rtPendingKeys);
    _rtPendingKeys.clear();
    if (!keys.length) return;
    _rtSyncListeners.forEach(fn => {
      try { fn(keys, source); } catch (err) { console.warn('RT listener warning:', err); }
    });
  }, 80);
}

function _applyRtRemoteEntries(entries, source = 'remote') {
  if (!entries || typeof entries !== 'object') return false;
  const changed = [];
  _rtApplyingRemote = true;
  try {
    for (const [k, v] of Object.entries(entries)) {
      if (!_shouldSyncKey(k)) continue;
      const cur = _nativeGetItem.call(window.localStorage, k);
      if (v === null || v === undefined) {
        if (cur !== null) {
          _nativeRemoveItem.call(window.localStorage, k);
          changed.push(k);
        }
      } else {
        const strVal = String(v);
        if (cur !== strVal) {
          _nativeSetItem.call(window.localStorage, k, strVal);
          changed.push(k);
        }
      }
    }
  } catch {} finally {
    _rtApplyingRemote = false;
  }
  if (changed.length > 0) {
    _scheduleRtUIRefresh(changed, source);
    return true;
  }
  return false;
}

function initRealtimeSync(onSyncCallback) {
  if (typeof onSyncCallback === 'function') _rtSyncListeners.add(onSyncCallback);
  if (!window.__lopvuiRtInitV11) {
    window.__lopvuiRtInitV11 = true;
    try {
      Storage.prototype.setItem = function(key, value) {
        let prev = null;
        try { prev = _nativeGetItem.call(this, key); } catch {}
        try { _nativeSetItem.call(this, key, value); } catch { return; }
        if (this === window.localStorage && _shouldSyncKey(String(key)) && !_rtApplyingRemote) {
          const strVal = String(value);
          if (prev !== strVal) {
            if (_rtChannel) {
              try { _rtChannel.postMessage({ type: 'sync-entries', clientId: RT_CLIENT_ID, timestamp: Date.now(), entries: { [String(key)]: strVal } }); } catch {}
            }
            _notifyRtStatus(_rtState, Date.now(), 'local-save');
          }
        }
      };
      Storage.prototype.removeItem = function(key) {
        let had = false;
        try { had = _nativeGetItem.call(this, key) !== null; } catch {}
        try { _nativeRemoveItem.call(this, key); } catch { return; }
        if (this === window.localStorage && _shouldSyncKey(String(key)) && !_rtApplyingRemote && had) {
          if (_rtChannel) {
            try { _rtChannel.postMessage({ type: 'sync-entries', clientId: RT_CLIENT_ID, timestamp: Date.now(), entries: { [String(key)]: null } }); } catch {}
          }
          _notifyRtStatus(_rtState, Date.now(), 'local-save');
        }
      };
    } catch {}

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        _rtChannel = new BroadcastChannel(RT_CHANNEL_NAME);
        _rtChannel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.clientId === RT_CLIENT_ID) return;
          if (data.type === 'sync-entries' && data.entries) {
            _applyRtRemoteEntries(data.entries, 'broadcast-tab');
          }
        };
      } catch {}
    }

    window.addEventListener('storage', (event) => {
      if (!event.key || !_shouldSyncKey(event.key) || _rtApplyingRemote) return;
      _scheduleRtUIRefresh([event.key], 'storage-event');
    });
  }
  return {
    clientId: RT_CLIENT_ID,
    forceSyncNow,
    onStatusChange: (cb) => {
      _rtStatusListeners.add(cb);
      cb({ state: _rtState, lastSyncTime: _rtLastSyncTime, clientId: RT_CLIENT_ID });
    }
  };
}

function forceSyncNow(reason = 'manual-click') {
  _scheduleRtUIRefresh(['*'], reason);
}
// Mỗi bàn chứa danh sách học sinh riêng; kéo thả chỉ sắp xếp trong bàn đích.
const baseLayout=[
  {id:'aisle-1',desks:[{id:'d11',seats:2,dividerAfter:false},{id:'d12',seats:2,dividerAfter:true},{id:'d13',seats:2,dividerAfter:false}]},
  {id:'aisle-2',desks:[{id:'d21',seats:2,dividerAfter:false},{id:'d22',seats:2,dividerAfter:true},{id:'d23',seats:2,dividerAfter:false}]},
  {id:'aisle-3',desks:[{id:'d31',seats:2,dividerAfter:false},{id:'d32',seats:2,dividerAfter:false}]}
];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let masterData=loadMasterData();
let sessionChanges=loadClassSessionChanges();
let signedInAccount=read('lopvui.signed-in-account.v1',{employeeId:'employee-ta-001',role:'assistant'});
let classCatalog=loadClassCatalog(localStorage,masterData);
const defaultClassId='class-math-8a-algebra';
// Undo history & Teacher view state
let isTeacherView = false;
let isSeatingEditMode = true;
function updateSeatingEditBtn() {
  const btn = $('#toggle-seating-edit-btn');
  if (!btn) return;
  btn.classList.toggle('active', isSeatingEditMode);
  if (isSeatingEditMode) {
    btn.textContent = '✏️ Sửa sơ đồ: ĐANG BẬT';
    btn.style.background = '#eaf5ec';
    btn.style.color = '#1f5f33';
    btn.style.borderColor = '#86c292';
  } else {
    btn.textContent = '🔒 Sửa sơ đồ: ĐÃ KHÓA';
    btn.style.background = '#f9fafb';
    btn.style.color = '#6b7280';
    btn.style.borderColor = '#d1d5db';
  }
}
const seatingUndoStack = [];
function pushSeatingUndo() {
  if (seatingUndoStack.length > 25) seatingUndoStack.shift();
  seatingUndoStack.push({
    deskItems: JSON.parse(JSON.stringify(deskItems)),
    lateQueue: [...lateQueue],
    studentsHomework: students.map(s => ({ id: s.id, homework: s.homework ? { ...s.homework } : null }))
  });
  updateUndoButton();
}
function updateUndoButton() {
  const btn = $('#undo-layout-button');
  if (btn) btn.disabled = seatingUndoStack.length === 0;
}
function undoSeating() {
  if (!seatingUndoStack.length) {
    toast('Không có thao tác nào để hoàn tác.');
    return;
  }
  const prev = seatingUndoStack.pop();
  deskItems = prev.deskItems;
  lateQueue = prev.lateQueue;
  if (Array.isArray(prev.studentsHomework)) {
    prev.studentsHomework.forEach(sh => {
      const s = studentById(sh.id);
      if (s) s.homework = sh.homework;
    });
  }
  save();
  render();
  updateUndoButton();
  toast('Đã hoàn tác thao tác trên sơ đồ lớp.');
}

let currentEmployeeId=signedInAccount?.employeeId||'employee-ta-001';
const requestedClassId=new URLSearchParams(location.search).get('class');
let CURRENT_CLASS_ID=classCatalog.some(item=>item.id===requestedClassId)?requestedClassId:defaultClassId;
const activeClassConfig=()=>classCatalog.find(item=>item.id===CURRENT_CLASS_ID)||classCatalog[0];
let configClass=activeClassConfig();
const loadedStudentRecords=loadStudentRecords(CURRENT_CLASS_ID);
let students=loadedStudentRecords.students;
let makeupStudents=loadedStudentRecords.makeupStudents;
let lateQueue=[];
const requestedSessionDate=new URLSearchParams(location.search).get('date');
let checklistDate=/^\d{4}-\d{2}-\d{2}$/.test(requestedSessionDate||'')?requestedSessionDate:new Date().toLocaleDateString('sv-SE');
const legacySessionFallback=CURRENT_CLASS_ID===defaultClassId&&checklistDate===new Date().toLocaleDateString('sv-SE');
let layout=read(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`,legacySessionFallback?read('lopvui.layout.v5',configClass?.defaultLayout||baseLayout):(configClass?.defaultLayout||baseLayout));
lateQueue=read(`lopvui.late-queue.v6.${CURRENT_CLASS_ID}.${checklistDate}`,legacySessionFallback?read('lopvui.late-queue.v6',[]):[]);
const getChecklistKey=()=>`lopvui.checklist.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
const getAttendanceNotesKey=()=>`lopvui.attendance-notes.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
let attendanceNotes=read(getAttendanceNotesKey(),{});
let classCommunication=loadClassCommunication(CURRENT_CLASS_ID,checklistDate);
const defaultChecklistItems=(configClass?.defaultChecklist?.startItems||['Lau bảng','Bật đèn và kiểm tra quạt/điều hòa','Chuẩn bị tài liệu và bài tập','Kiểm tra bàn ghế, cửa sổ và phòng học']).map((label,index)=>({id:`default-${index+1}`,label,done:false}));
const defaultEndChecklistItems=(configClass?.defaultChecklist?.endItems||[]).map((label,index)=>({id:`end-default-${index+1}`,label,done:false}));
const legacyChecklist= CURRENT_CLASS_ID===defaultClassId?read(`lopvui.checklist.v1.${checklistDate}`,null):null;
let checklist=read(getChecklistKey(),legacyChecklist||{items:defaultChecklistItems.map(item=>({...item,done:false})),classNote:'',tests:{},testScores:{},testCollectionMode:false,handover:null,workStart:null});
checklist.testScores = checklist.testScores || {};
checklist.items=Array.isArray(checklist.items)?checklist.items:defaultChecklistItems.map(item=>({...item,done:false}));checklist.tests=checklist.tests||{};
checklist.endItems=Array.isArray(checklist.endItems)?checklist.endItems:defaultEndChecklistItems.map(item=>({...item}));
function reminderScheduleText(rule){const anchor=rule.anchor==='end'?'Giờ kết thúc':'Giờ bắt đầu',offset=Number(rule.offsetMinutes)||0;return anchor+(offset?` ${offset>0?'+':''}${offset} phút`:'');}
function mergeReminderItems(items,anchor){for(const rule of configClass?.defaultNotifications||[]){if((rule.anchor==='end'?'end':'start')!==anchor)continue;const id='reminder-'+rule.id,label='Reminder: '+(rule.title||'Nhắc việc')+' · '+reminderScheduleText(rule);let item=items.find(entry=>entry.id===id);if(!item){item={id,label,done:false,kind:'reminder',reminderRuleId:rule.id};items.push(item);}item.label=label;item.kind='reminder';item.reminderRuleId=rule.id;}}
mergeReminderItems(checklist.items,'start');mergeReminderItems(checklist.endItems,'end');
checklist.testRequired=Boolean(checklist.testRequired);
const legacy=legacySessionFallback?read('lopvui.session-seats.v6',null):null;
function migrateSeats(){const grouped={};for(const aisle of layout)for(const desk of aisle.desks)grouped[desk.id]=[];if(Array.isArray(legacy)){const keys=layout.flatMap(a=>a.desks.flatMap(d=>Array.from({length:d.seats||2},()=>d.id)));legacy.forEach((entry,i)=>{if(entry&&keys[i])grouped[keys[i]].push(entry);});}return grouped;}
let deskItems=read(`lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}`,legacySessionFallback?read('lopvui.desk-items.v7',null):null)||migrateSeats();
let activeSpot=null,selectedStudentId=null,selectedLateId=null,activeProfileId=null,lateHomeworkSelected=false,dragState=null,suppressClick=false;
const classroom=document.querySelector('#classroom');const $=selector=>document.querySelector(selector);
const studentIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.5"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg>';
const toast=message=>{const el=$('#toast'),host=document.querySelector('dialog[open]')||document.querySelector('.app-shell');if(host&&!host.contains(el))host.append(el);el.textContent=message;el.classList.add('show');clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>{el.classList.remove('show');const shell=document.querySelector('.app-shell');if(shell&&!shell.contains(el))shell.append(el);},2500);};
const save=()=>{
  localStorage.setItem(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`,JSON.stringify(layout));
  localStorage.setItem(`lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}`,JSON.stringify(deskItems));
  if(legacySessionFallback){
    localStorage.setItem('lopvui.layout.v5',JSON.stringify(layout));
    localStorage.setItem('lopvui.desk-items.v7',JSON.stringify(deskItems));
    localStorage.setItem('lopvui.late-queue.v6',JSON.stringify(lateQueue));
  }
  localStorage.setItem(`lopvui.late-queue.v6.${CURRENT_CLASS_ID}.${checklistDate}`,JSON.stringify(lateQueue));
  syncLiveSessionData();
  saveStudentRecords(students,makeupStudents);
};
const saveChecklist=()=>{
  localStorage.setItem(getChecklistKey(),JSON.stringify(checklist));
  syncLiveSessionData();
};
const desks=()=>layout.flatMap((aisle,ci)=>aisle.desks.map((desk,di)=>({aisle,desk,ci,di})));
const allEntries=()=>desks().flatMap(({desk})=>(deskItems[desk.id]||[]).map((entry,index)=>({entry,deskId:desk.id,index})));
const homeworkLabel=status=>({uncollected:'Chưa thu',not_submitted:'Không nộp',submitted:'Đã thu',graded:'Đã chấm điểm'})[status]||'Chưa thu';
const homeworkSymbol=record=>record?.status==='graded'?String(record.score??'•'):({not_submitted:'×',submitted:'✓',uncollected:'·'})[record?.status]||'·';
const homeworkClass=status=>({not_submitted:'hw-missing',submitted:'hw-collected',graded:'hw-graded',uncollected:'hw-uncollected'})[status]||'hw-uncollected';
const attendanceLabel=status=>({present:'Có mặt',late:'Đi muộn',absent_excused:'Vắng có phép',absent_unexcused:'Vắng không phép'})[status]||'Chưa điểm danh';
const studentById=id=>students.find(s=>s.id===id)||makeupStudents.find(s=>s.id===id);
const sessionNoteFor=id=>attendanceNotes[id]??studentById(id)?.sessionNotes?.find(note=>note.classId===CURRENT_CLASS_ID&&note.date===checklistDate)?.note??'';
function saveSessionNote(id,value){
  attendanceNotes[id]=value;
  localStorage.setItem(getAttendanceNotesKey(),JSON.stringify(attendanceNotes));
  const student=studentById(id);
  if(student){
    student.sessionNotes=student.sessionNotes||[];
    let note=student.sessionNotes.find(item=>item.classId===CURRENT_CLASS_ID&&item.date===checklistDate);
    if(!note&&!value){
      save();
      return;
    }
    if(!note){
      note={classId:CURRENT_CLASS_ID,date:checklistDate,note:'',updatedAt:Date.now()};
      student.sessionNotes.push(note);
    }
    note.note=value;
    note.updatedAt=Date.now();
    save();
  }
}
for(const student of [...students,...makeupStudents])if(!(student.id in attendanceNotes)){const saved=student.sessionNotes?.find(note=>note.classId===CURRENT_CLASS_ID&&note.date===checklistDate);if(saved)attendanceNotes[student.id]=saved.note;}
const classStudents=()=>students.filter(student=>(student.classIds||[]).includes(CURRENT_CLASS_ID));
const splitStudentName=name=>{const parts=String(name||'').trim().split(/\s+/).filter(Boolean);return {familyName:parts.slice(0,-1).join(' '),givenName:parts.at(-1)||''};};
function createStudentProfile({name,school='',kind='regular',parentContact={name:'',phone:''},studentCode=null,tags=[]}){const makeup=kind==='makeup';const cleanCode=(studentCode&&String(studentCode).trim())?String(studentCode).trim().toUpperCase():null;return {id:`stu-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,...splitStudentName(name),studentCode:cleanCode,name,school:makeup?'':school,sourceClassName:makeup?school:'',attendingClassId:makeup?CURRENT_CLASS_ID:null,classIds:makeup?[]:[CURRENT_CLASS_ID],courseIds:[],parentContact:{name:parentContact.name||'',phone:parentContact.phone||''},photoURL:null,scores:[],attendanceHistory:[],seatingHistory:[],notes:[],learningNotes:'',tags:Array.isArray(tags)?tags:[],isNew:false,studentType:makeup?'makeup':'regular',createdAt:Date.now()};}
const currentStaffName=()=>masterData?.employees?.find(e=>e.id===currentEmployeeId)?.name||document.querySelector('.user-name')?.childNodes[0]?.textContent.trim()||'Trợ giảng';
const personalWorkKey=()=>`lopvui.personal-work.v1.${encodeURIComponent(currentStaffName().trim().toLocaleLowerCase('vi'))}`;
let personalWorkDays=read(personalWorkKey(),{});
const renderPersonalWork=()=>{const didWork=Boolean(personalWorkDays[checklistDate]),button=$('#personal-work-toggle'),status=$('#personal-work-status');if(!button||!status)return;button.setAttribute('aria-pressed',String(didWork));button.classList.toggle('checked',didWork);button.textContent=didWork?'✓ Đã xác nhận đi làm hôm nay':'✓ Tôi có đi làm hôm nay';status.textContent=didWork?`Bạn đã tự xác nhận đi làm hôm nay (${checklistDate}).`:`Chưa xác nhận hôm nay · ${checklistDate}`;};
$('#personal-work-toggle').onclick=()=>{if(personalWorkDays[checklistDate])delete personalWorkDays[checklistDate];else personalWorkDays[checklistDate]={staff:currentStaffName(),at:Date.now()};localStorage.setItem(personalWorkKey(),JSON.stringify(personalWorkDays));renderPersonalWork();};
renderPersonalWork();
const assignedIds=()=>new Set(allEntries().map(x=>x.entry.studentId).filter(Boolean));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const communicationTime=timestamp=>new Date(timestamp).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
function persistClassCommunication(){saveClassCommunication(CURRENT_CLASS_ID,checklistDate,classCommunication);}
function renderClassCommunication(){const messages=$('#chat-message-list'),activity=$('#activity-log-list');if(!messages||!activity)return;$('#chat-message-count').textContent=`${classCommunication.messages.filter(item=>item.kind==='user').length} tin`;messages.innerHTML=classCommunication.messages.map(item=>item.kind==='system'?`<article class="chat-system-message"><span>✦</span><div><p>${escapeHtml(item.text)}</p><time>${communicationTime(item.createdAt)}</time></div></article>`:`<article class="chat-message"><div class="chat-message-meta"><strong>${escapeHtml(item.author||'Trợ giảng')}</strong><time>${communicationTime(item.createdAt)}</time></div><p>${escapeHtml(item.text).replace(/\n/g,'<br>')}</p></article>`).join('')||'<div class="chat-empty-state"><span>✉</span><strong>Chưa có tin nhắn</strong><small>Gửi trao đổi đầu tiên cho nhân sự trong lớp.</small></div>';activity.innerHTML=classCommunication.activity.map(item=>`<article class="activity-log-item"><span class="activity-log-dot ${escapeHtml(item.type||'system')}"></span><div><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.actor||'Hệ thống')} · ${communicationTime(item.createdAt)}</small></div></article>`).join('')||'<div class="chat-empty-state activity-empty"><span>◷</span><strong>Chưa có hoạt động</strong><small>Hệ thống sẽ ghi lại các mốc chính trong ca.</small></div>';messages.scrollTop=messages.scrollHeight;}
function renderNotifications(){const list=$('#notification-list');if(!list)return;const unread=classCommunication.notifications.filter(item=>!item.read).length;$('#notification-badge').textContent=unread>9?'9+':String(unread);$('#notification-badge').hidden=!unread;$('#notification-unread-label').textContent=unread?`${unread} thông báo chưa đọc`:'Đã xem hết thông báo';$('#notification-permission-status').textContent=('Notification'in window)?(Notification.permission==='granted'?'Thông báo trên thiết bị đã bật.':Notification.permission==='denied'?'Trình duyệt đang chặn thông báo trên thiết bị.':'Thông báo trên thiết bị đang tắt.'):'Trình duyệt này chưa hỗ trợ thông báo.';list.innerHTML=classCommunication.notifications.length?classCommunication.notifications.slice().reverse().map(item=>`<article class="notification-item ${item.read?'':'unread'}"><span class="notification-item-icon ${escapeHtml(item.type)}">${item.type==='chat'?'✉':item.type==='homework'?'✓':item.type==='attendance'?'☑':item.type==='reminder'?'◷':'✦'}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${communicationTime(item.createdAt)}</small></div></article>`).join(''):'<div class="notification-empty">Chưa có thông báo trong ca học này.</div>';}
function createClassNotification(title,body,type='system',key=''){if(key&&classCommunication.notifications.some(item=>item.key===key))return;const createdAt=Date.now(),notification={id:`notice-${createdAt}-${Math.random().toString(36).slice(2,6)}`,key,title,body,type,createdAt,read:false};classCommunication.notifications.push(notification);classCommunication.notifications=classCommunication.notifications.slice(-100);persistClassCommunication();renderNotifications();if('Notification'in window&&Notification.permission==='granted'){try{new Notification(title,{body,tag:key||notification.id});}catch{}}if($('#notification-panel')&&!$('#notification-panel').hidden)$('#notification-panel').classList.add('has-new');}
function addClassActivity(text,type='system'){const createdAt=Date.now();classCommunication.activity.push({id:`log-${createdAt}-${Math.random().toString(36).slice(2,6)}`,type,text,actor:currentStaffName(),createdAt});classCommunication.messages.push({id:`bot-${createdAt}-${Math.random().toString(36).slice(2,6)}`,kind:'system',text,createdAt});classCommunication.activity=classCommunication.activity.slice(-250);classCommunication.messages=classCommunication.messages.slice(-250);if(type==='homework')createClassNotification('Đã cập nhật BTVN',text,'homework');else if(type==='attendance'&&text.startsWith('Hoàn tất ghi nhận'))createClassNotification('Đã chốt điểm danh',text,'attendance');persistClassCommunication();if(!$('#chat-view').hidden)renderClassCommunication();}
$('#notification-toggle').onclick=()=>{const panel=$('#notification-panel'),opening=panel.hidden;panel.hidden=!opening;$('#notification-toggle').setAttribute('aria-expanded',String(opening));if(opening){classCommunication.notifications.forEach(item=>item.read=true);persistClassCommunication();renderNotifications();}};
$('#notification-read-all').onclick=()=>{classCommunication.notifications.forEach(item=>item.read=true);persistClassCommunication();renderNotifications();};
$('#enable-browser-notifications').onclick=async()=>{if(!('Notification'in window)){toast('Trình duyệt này chưa hỗ trợ thông báo trên thiết bị.');return;}try{const permission=await Notification.requestPermission();renderNotifications();if(permission==='granted')toast('Đã bật thông báo trên thiết bị khi trang web đang mở.');else toast('Chưa cấp quyền thông báo trên thiết bị.');}catch{toast('Không thể bật thông báo trên thiết bị trong trình duyệt này.');}};
document.addEventListener('click',event=>{const anchor=$('.notification-anchor');if(anchor&&!anchor.contains(event.target)&&!$('#notification-panel').hidden){$('#notification-panel').hidden=true;$('#notification-toggle').setAttribute('aria-expanded','false');}});
$('#chat-compose-form').addEventListener('submit',event=>{event.preventDefault();const field=$('#chat-message-input'),text=field.value.trim();if(!text)return;const createdAt=Date.now(),author=currentStaffName();classCommunication.messages.push({id:`msg-${createdAt}-${Math.random().toString(36).slice(2,6)}`,kind:'user',author,text,createdAt});createClassNotification('Tin nhắn mới',`${author}: ${text}`,'chat');persistClassCommunication();field.value='';renderClassCommunication();field.focus();});
$('#chat-message-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('#chat-compose-form').requestSubmit();}});
renderNotifications();
window.addEventListener('storage',event=>{if(event.key!==`lopvui.class-communication.v1.${CURRENT_CLASS_ID}.${checklistDate}`||!event.newValue)return;const previousIds=new Set(classCommunication.notifications.map(item=>item.id));classCommunication=loadClassCommunication(CURRENT_CLASS_ID,checklistDate);renderNotifications();if(!$('#chat-view').hidden)renderClassCommunication();const incoming=classCommunication.notifications.filter(item=>!previousIds.has(item.id)&&!item.read);if(incoming.length&&'Notification'in window&&Notification.permission==='granted')incoming.forEach(item=>{try{new Notification(item.title,{body:item.body,tag:item.key||item.id});}catch{}});});
function scheduleDefaultNotifications(){const sessionDate=new Date(`${checklistDate}T00:00:00`),start=classScheduleStamp(configClass,sessionDate),end=new Date(`${checklistDate}T${configClass.endTime}:00`),now=new Date();for(const rule of configClass.defaultNotifications||[]){const anchor=rule.anchor==='end'?end:start,due=new Date(anchor.getTime()+Number(rule.offsetMinutes||0)*60000),key=`class-rule-${CURRENT_CLASS_ID}-${checklistDate}-${rule.id}`;if(classCommunication.notifications.some(item=>item.key===key))continue;const notify=()=>{createClassNotification(rule.title||'Nhắc việc theo ca',rule.body||rule.title||'Đến mốc công việc của lớp.','reminder',key);addClassActivity(`Thông báo theo lịch lớp: ${rule.title||rule.body||'Nhắc việc'}`,'system');};if(now>=due&&now<new Date(due.getTime()+15*60*1000))notify();else if(now<due)setTimeout(()=>{if(new Date().toLocaleDateString('sv-SE')===checklistDate)notify();},due-now);}}
scheduleDefaultNotifications();
function studentTagList(student){return [...(student?.tags||[])];}
function studentSearchMeta(student){const tags=studentTagList(student);return `<small>${escapeHtml(student.studentType==='makeup'?`Học bù · ${student.sourceClassName||'chưa rõ lớp'}`:student.school||'Hồ sơ đã lưu')}</small>${tags.length?`<span class="student-tag-row">${tags.map(tag=>`<span class="student-tag ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}</span>`).join('')}</span>`:''}`;}
function renderInlineTags(student){return studentTagList(student).map(tag=>`<span class="student-tag-inline ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}</span>`).join('');}
function renderStudentInfo(selector,student){const host=$(selector);if(!host)return;if(!student){host.hidden=true;host.innerHTML='';return;}const storedTags=student.tags||[],allTags=studentTagList(student);host.hidden=false;host.innerHTML=`<div class="selected-student-summary"><button type="button" class="student-profile-name" data-profile-name="${escapeHtml(student.id)}">${escapeHtml(student.name)}</button><small>${escapeHtml(student.studentType==='makeup'?`Học bù · ${student.sourceClassName||'chưa rõ lớp'}`:student.school||'Chưa cập nhật trường/lớp')}</small></div><div class="student-tag-row">${allTags.map(tag=>{const storedIndex=storedTags.indexOf(tag),removable=storedIndex>=0;return `<span class="student-tag ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}${removable?`<button type="button" aria-label="Xóa tag ${escapeHtml(tag)}" data-remove-tag="${storedIndex}" data-student-id="${escapeHtml(student.id)}">×</button>`:''}</span>`;}).join('')}</div><div class="student-tag-editor"><input type="text" data-tag-input="${escapeHtml(student.id)}" placeholder="Thêm tag, ví dụ: Cần chú ý" /><button type="button" data-add-tag="${escapeHtml(student.id)}">Thêm tag</button></div>`;host.querySelector('[data-profile-name]')?.addEventListener('click',()=>openStudentProfile(student.id));}
function refreshStudentInfo(){renderStudentInfo('#selected-student-info',selectedStudentId?studentById(selectedStudentId):null);renderStudentInfo('#late-selected-student-info',selectedLateId?studentById(selectedLateId):null);}
function addStudentTag(id,input){const student=studentById(id),tag=input.value.trim();if(!student||!tag)return;student.tags=student.tags||[];if(student.tags.some(item=>normalizeSearchText(item)===normalizeSearchText(tag))){toast('Tag này đã có trong hồ sơ.');return;}student.tags.push(tag);save();render();refreshStudentInfo();}
document.addEventListener('click',e=>{const add=e.target.closest('[data-add-tag]');if(add){const host=add.closest('.selected-student-info'),input=host?.querySelector('[data-tag-input]');addStudentTag(add.dataset.addTag,input);return;}const remove=e.target.closest('[data-remove-tag]');if(remove){const student=studentById(remove.dataset.studentId);if(!student)return;student.tags.splice(Number(remove.dataset.removeTag),1);save();render();refreshStudentInfo();}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-tag-input]')){e.preventDefault();addStudentTag(e.target.dataset.tagInput,e.target);}});
function sessionStudentIds(){return [...new Set([...allEntries().map(({entry})=>entry.studentId).filter(Boolean),...lateQueue])].filter(id=>studentById(id));}
function renderChecklistCore(){const itemsHost=$('#checklist-items');if(!itemsHost)return;const completed=checklist.items.filter(item=>item.done).length;$('#checklist-progress-count').textContent=`${completed}/${checklist.items.length}`;itemsHost.innerHTML=checklist.items.map(item=>`<div class="checklist-item ${item.done?'complete':''} ${item.kind==='reminder'?'reminder-checklist-item':''}"><input type="checkbox" data-checklist-item="${escapeHtml(item.id)}" aria-label="Đánh dấu ${escapeHtml(item.label)}" ${item.done?'checked':''}><span class="checklist-checkmark"></span>${item.kind==='reminder'?'<span class="reminder-type-pill">Reminder</span>':''}<span class="checklist-item-copy"><input class="checklist-label-input" data-checklist-label="${escapeHtml(item.id)}" value="${escapeHtml(item.label)}" ${item.kind==='reminder'?'readonly':''} aria-label="Tên công việc"><small>${item.done?`Đã hoàn thành bởi ${escapeHtml(item.doneBy||'Trợ giảng')}${item.doneAt?` · ${new Date(item.doneAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`:''}`:'Chưa hoàn thành'}</small></span><button type="button" class="checklist-remove" data-remove-checklist-item="${escapeHtml(item.id)}" aria-label="Xóa mục ${escapeHtml(item.label)}">×</button></div>`).join('')||'<div class="empty-list">Chưa có công việc. Thêm các yêu cầu của ca học này.</div>';const endHost=$('#end-checklist-items');if(endHost)endHost.innerHTML=checklist.endItems.map(item=>`<div class="checklist-item ${item.done?'complete':''} ${item.kind==='reminder'?'reminder-checklist-item':''}"><input type="checkbox" data-end-checklist-item="${escapeHtml(item.id)}" ${item.done?'checked':''}><span class="checklist-checkmark"></span>${item.kind==='reminder'?'<span class="reminder-type-pill">Reminder</span>':''}<span class="checklist-item-copy"><input class="checklist-label-input" data-end-checklist-label="${escapeHtml(item.id)}" value="${escapeHtml(item.label)}" ${item.kind==='reminder'?'readonly':''}><small>${item.done?`Đã hoàn thành bởi ${escapeHtml(item.doneBy||'Trợ giảng')}`:'Chưa hoàn thành'}</small></span><button type="button" class="checklist-remove" data-end-checklist-remove="${escapeHtml(item.id)}">×</button></div>`).join('')||'<div class="empty-list">Chưa có công việc cuối giờ.</div>';const totalItems=checklist.items.length+checklist.endItems.length,doneItems=[...checklist.items,...checklist.endItems].filter(item=>item.done).length;$('#checklist-progress-count').textContent=`${doneItems}/${totalItems}`;const started=Boolean(checklist.workStart);$('#shift-start-status').textContent=started?'Đã xác nhận ca':'Chưa bắt đầu';$('#shift-start-status').classList.toggle('done',started);$('#shift-start-log').textContent=started?`Ca làm được xác nhận bởi ${checklist.workStart.name} lúc ${new Date(checklist.workStart.at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`:'Ca làm sẽ được ghi nhận khi hoàn tất mục đầu tiên.';const note=$('#session-note');if(document.activeElement!==note)note.value=checklist.classNote||'';$('#session-note-status').textContent=checklist.noteSavedAt?`Đã lưu lúc ${new Date(checklist.noteSavedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`:'';if($('#test-required-toggle'))$('#test-required-toggle').checked=Boolean(checklist.testRequired);if($('#scores-tab-test-toggle'))$('#scores-tab-test-toggle').checked=Boolean(checklist.testRequired);if($('#test-collection-tools'))$('#test-collection-tools').hidden=!checklist.testRequired;const handover=checklist.handover;if($('#handover-status'))$('#handover-status').textContent=handover?`Đã xác nhận trợ giảng cầm bài về: ${handover.person} lúc ${new Date(handover.at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`:'Chưa xác nhận trợ giảng cầm bài về.';if($('#handover-person')&&document.activeElement!==$('#handover-person'))$('#handover-person').value=handover?.person||'';if($('#confirm-handover'))$('#confirm-handover').textContent=handover?'Cập nhật người cầm bài':'Xác nhận cầm bài về';}
function safeHttpUrl(value){try{const url=new URL(String(value||'').trim());return url.protocol==='http:'||url.protocol==='https:'?url.href:'';}catch{return '';}}
function renderChecklistDetails(){for(const field of document.querySelectorAll('[data-checklist-field]'))if(document.activeElement!==field)field.value=checklist[field.dataset.checklistField]||'';for(const [key,linkId] of [['notebookLink','notebook-link-open'],['homeworkLink','homework-link-open']]){const link=document.getElementById(linkId),safeUrl=safeHttpUrl(checklist[key]);if(link){link.hidden=!safeUrl;if(safeUrl)link.href=safeUrl;}}}
function renderChecklist(){renderChecklistCore();renderChecklistDetails();}
document.querySelectorAll('[data-checklist-field]').forEach(field=>field.addEventListener('input',()=>{const key=field.dataset.checklistField;checklist[key]=field.value;saveChecklist();const status=key==='lessonTitle'?$('#lesson-title-status'):$('#homework-details-status');if(status)status.textContent='Đã lưu';if(key==='notebookLink'||key==='homeworkLink')renderChecklistDetails();}));$('#checklist-items').addEventListener('change',e=>{const input=e.target.closest('[data-checklist-item]');if(!input)return;const item=checklist.items.find(entry=>entry.id===input.dataset.checklistItem);if(!item)return;item.done=input.checked;item.doneBy=input.checked?currentStaffName():null;item.doneAt=input.checked?Date.now():null;if(checklist.items[0]?.id===item.id&&input.checked&&!checklist.workStart)checklist.workStart={name:currentStaffName(),at:Date.now()};addClassActivity(`${currentStaffName()} đã ${input.checked?'hoàn thành':'bỏ đánh dấu'}: ${item.label}`,'checklist');if(checklist.items.length&&checklist.items.every(entry=>entry.done)){createClassNotification('Checklist setup đã xong','Tất cả công việc chuẩn bị đầu giờ đã được hoàn thành.','checklist',`setup-done-${checklistDate}`);addClassActivity(`${currentStaffName()} đã hoàn thành toàn bộ checklist setup đầu giờ`,'checklist');}saveChecklist();renderChecklist();});
$('#checklist-items').addEventListener('change',e=>{const input=e.target.closest('[data-checklist-label]');if(!input)return;const item=checklist.items.find(entry=>entry.id===input.dataset.checklistLabel);if(!item)return;const label=input.value.trim();if(!label){input.value=item.label;toast('Tên công việc không được để trống.');return;}item.label=label;saveChecklist();});
$('#checklist-items').addEventListener('click',e=>{const button=e.target.closest('[data-remove-checklist-item]');if(!button)return;checklist.items=checklist.items.filter(item=>item.id!==button.dataset.removeChecklistItem);saveChecklist();renderChecklist();});
$('#add-checklist-item').onclick=()=>{const item={id:`task-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,label:'Việc mới',done:false};checklist.items.push(item);saveChecklist();renderChecklist();const input=$(`[data-checklist-label="${item.id}"]`);input?.focus();input?.select();};
$('#end-checklist-items').addEventListener('change',e=>{const input=e.target.closest('[data-end-checklist-item]');if(input){const item=checklist.endItems.find(row=>row.id===input.dataset.endChecklistItem);if(!item)return;item.done=input.checked;item.doneBy=input.checked?currentStaffName():null;item.doneAt=input.checked?Date.now():null;addClassActivity(`${currentStaffName()} đã ${input.checked?'hoàn thành':'bỏ đánh dấu'}: ${item.label}`,'checklist');saveChecklist();renderChecklist();return;}const label=e.target.closest('[data-end-checklist-label]');if(!label)return;const item=checklist.endItems.find(row=>row.id===label.dataset.endChecklistLabel);if(item&&label.value.trim()){item.label=label.value.trim();saveChecklist();}else if(item)label.value=item.label;});$('#end-checklist-items').addEventListener('click',e=>{const button=e.target.closest('[data-end-checklist-remove]');if(!button)return;const item=checklist.endItems.find(row=>row.id===button.dataset.endChecklistRemove);if(item&&confirm(`Xóa mục “${item.label}” khỏi checklist?`)){checklist.endItems=checklist.endItems.filter(row=>row.id!==item.id);saveChecklist();renderChecklist();}});$('#add-end-checklist-item').onclick=()=>{const item={id:`end-task-${Date.now()}`,label:'Việc mới',done:false};checklist.endItems.push(item);saveChecklist();renderChecklist();const input=$(`[data-end-checklist-label="${item.id}"]`);input?.focus();input?.select();};$('#save-session-note').onclick=()=>{checklist.classNote=$('#session-note').value.trim();checklist.noteSavedAt=Date.now();saveChecklist();addClassActivity(`${currentStaffName()} đã lưu ghi chú chung của buổi học`,'checklist');renderChecklist();toast('Đã lưu ghi chú buổi học.');};
$('#session-note')?.addEventListener('input',()=>{checklist.classNote=$('#session-note').value;checklist.noteSavedAt=Date.now();saveChecklist();const st=$('#session-note-status');if(st)st.textContent=`Đã tự động lưu lúc ${new Date(checklist.noteSavedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}.`;});
$('#handover-person')?.addEventListener('input',()=>{const person=$('#handover-person').value.trim();checklist.handover=person?{person,at:checklist.handover?.at||Date.now()}:null;saveChecklist();});
function handleToggleTestRequired(checked) {
  checklist.testRequired = Boolean(checked);
  if ($('#test-required-toggle')) $('#test-required-toggle').checked = checklist.testRequired;
  if ($('#scores-tab-test-toggle')) $('#scores-tab-test-toggle').checked = checklist.testRequired;
  addClassActivity(checklist.testRequired ? 'Đã bật: Ca này có test' : 'Đã tắt: Ca này có test', 'checklist');
  saveChecklist();
  renderChecklist();
  if (typeof renderScoresView === 'function') renderScoresView();
}
$('#test-required-toggle')?.addEventListener('change', e => handleToggleTestRequired(e.target.checked));
$('#scores-tab-test-toggle')?.addEventListener('change', e => handleToggleTestRequired(e.target.checked));
$('#confirm-handover').onclick=()=>{const person=$('#handover-person').value.trim();if(!person){toast('Nhập tên trợ giảng cầm bài về chấm.');$('#handover-person').focus();return;}checklist.handover={person,at:Date.now()};addClassActivity(`Trợ giảng cầm bài test về chấm: ${person}`,'handover');saveChecklist();renderChecklist();toast(`Đã ghi nhận trợ giảng cầm bài về: ${person}.`);};
function setClassView(view){
  const chatVisible=view==='chat',scoresVisible=view==='scores',checklistVisible=view==='checklist',studentsVisible=view==='students';
  const seatingVisible=!chatVisible&&!scoresVisible&&!checklistVisible&&!studentsVisible;
  $('#chat-view').hidden=!chatVisible;
  $('#seating-view').hidden=!seatingVisible;
  if($('#scores-view'))$('#scores-view').hidden=!scoresVisible;
  $('#checklist-view').hidden=!checklistVisible;
  $('#students-view').hidden=!studentsVisible;
  $('#chat-view-tab')?.classList.toggle('active',chatVisible);
  $('#seating-view-tab')?.classList.toggle('active',seatingVisible);
  $('#scores-view-tab')?.classList.toggle('active',scoresVisible);
  $('#checklist-view-tab')?.classList.toggle('active',checklistVisible);
  $('#students-view-tab')?.classList.toggle('active',studentsVisible);
  $('#class-chat-nav')?.classList.toggle('active',chatVisible);
  $('#class-room-nav')?.classList.toggle('active',seatingVisible);
  $('#scores-sidebar-tab')?.classList.toggle('active',scoresVisible);
  $('#checklist-sidebar-tab')?.classList.toggle('active',checklistVisible);
  $('#students-tab')?.classList.toggle('active',studentsVisible);
  if(chatVisible)renderClassCommunication();
  if(scoresVisible&&typeof renderScoresView==='function')renderScoresView();
  if(checklistVisible)renderChecklist();
  if(studentsVisible)renderStudentList();
}
function updateSubtabUrl(subtab) {
  const c = activeClassConfig();
  const sub = isClassHistoryViewMode ? `history/${checklistDate}/${subtab}` : `live/${subtab}`;
  try { history.replaceState({}, '', `/class/${c?.code || CURRENT_CLASS_ID}/${sub}`); } catch {}
}
$('#chat-view-tab').onclick=()=>{ setClassView('chat'); updateSubtabUrl('chatlog'); };
$('#class-chat-nav').onclick=()=>{ setClassView('chat'); updateSubtabUrl('chatlog'); };
$('#seating-view-tab').onclick=()=>{ setClassView('seating'); updateSubtabUrl('map'); };
$('#scores-view-tab')?.addEventListener('click', ()=>{ setClassView('scores'); updateSubtabUrl('scores'); });
$('#scores-sidebar-tab')?.addEventListener('click', ()=>{ setClassView('scores'); updateSubtabUrl('scores'); });
$('#class-room-nav').onclick=()=>{ setClassView('seating'); updateSubtabUrl('map'); };
$('#checklist-view-tab').onclick=()=>{ setClassView('checklist'); updateSubtabUrl('checklist'); };
$('#checklist-sidebar-tab').onclick=()=>{ setClassView('checklist'); updateSubtabUrl('checklist'); };
$('#students-view-tab').onclick=()=>{ setClassView('students'); updateSubtabUrl('students'); };
$('#students-tab').onclick=()=>{ setClassView('students'); updateSubtabUrl('students'); };
const weekdayNames=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const selectedRole=()=>['assistant','office','teacher','admin'].includes(signedInAccount?.role)?signedInAccount.role:'assistant';
function occurrenceDate(classInfo,from=new Date()){const date=new Date(from);date.setHours(0,0,0,0);let days=(Number(classInfo.weekday)-date.getDay()+7)%7;const startToday=new Date(date),endToday=new Date(date);const [hour,minute]=String(classInfo.startTime||'15:30').split(':').map(Number),[endHour,endMinute]=String(classInfo.endTime||'17:00').split(':').map(Number);startToday.setHours(hour,minute,0,0);endToday.setHours(endHour,endMinute,0,0);if(days===0&&startToday<from&&from>=endToday)days=7;date.setDate(date.getDate()+days);return date;}
function formatSessionDate(date){const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);const dateOnly=new Date(date);dateOnly.setHours(0,0,0,0);if(dateOnly.getTime()===today.getTime())return 'Hôm nay';if(dateOnly.getTime()===tomorrow.getTime())return 'Ngày mai';return `${weekdayNames[date.getDay()]}, ${date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})}`;}
function classScheduleStamp(classInfo,date){const [hour,minute]=String(classInfo.startTime||'15:30').split(':').map(Number),stamp=new Date(date);stamp.setHours(hour,minute,0,0);return stamp;}
function sessionChangeKey(classId,date){return classId+'::'+new Date(date).toLocaleDateString('sv-SE');}
function getSessionChange(classId,date){return sessionChanges[sessionChangeKey(classId,date)]||null;}
function assignedIdsFor(item,change,role){const field={teacher:'teacherIds',assistant:'assistantIds',office:'officeIds'}[role];if(role==='office')return item.officeIds||[];const override=change&&Object.prototype.hasOwnProperty.call(change,field)?change[field]:undefined;return override===undefined?(item[field]||[]):override;}
function employeeNames(ids){return ids.map(id=>masterData.employees.find(employee=>employee.id===id)?.name).filter(Boolean).join(', ')||'Chưa phân công';}
function assignedShiftInstances(role){
  const today=new Date();
  today.setHours(0,0,0,0);
  const results=[];
  for(const item of classCatalog){
    for(let offset=0;offset<35;offset++){
      const date=new Date(today);
      date.setDate(date.getDate()+offset);
      if(date.getDay()!==item.weekday)continue;
      const change=getSessionChange(item.id,date);
      if(change?.status==='cancelled')continue;
      if(role!=='admin'&&role!=='office'&&currentEmployeeId&&!assignedIdsFor(item,change,role).includes(currentEmployeeId))continue;
      results.push({item,date,change});
    }
  }
  for(const change of Object.values(sessionChanges)){
    if(change.status!=='makeup'||!change.classId||!change.date)continue;
    const date=new Date(change.date+'T00:00:00');
    if(date<today)continue;
    const item=classCatalog.find(row=>row.id===change.classId);
    if(item&&(role==='admin'||role==='office'||!currentEmployeeId||assignedIdsFor(item,change,role).includes(currentEmployeeId))&&!results.some(row=>row.item.id===item.id&&row.date.toLocaleDateString('sv-SE')===change.date))results.push({item,date,change});
  }
  if(!results.length){
    for(const item of classCatalog){
      for(let offset=0;offset<14;offset++){
        const date=new Date(today);
        date.setDate(date.getDate()+offset);
        if(date.getDay()!==item.weekday)continue;
        results.push({item,date,change:getSessionChange(item.id,date)});
      }
    }
  }
  return results;
}
function scheduleCard(classInfo,dateArg,changeArg){const date=dateArg||occurrenceDate(classInfo),change=changeArg===undefined?getSessionChange(classInfo.id,date):changeArg,start=classScheduleStamp(classInfo,date),end=new Date(date);const [endHour,endMinute]=String(classInfo.endTime||'17:00').split(':').map(Number);end.setHours(endHour,endMinute,0,0);const ongoing=new Date()>=start&&new Date()<end,status=ongoing?'Đang diễn ra':change?.status==='makeup'?'Học bù':'Sắp tới',dateText=formatSessionDate(date),teacherNames=employeeNames(assignedIdsFor(classInfo,change,'teacher')),assistantNames=employeeNames(assignedIdsFor(classInfo,change,'assistant')),chip=change?.status==='makeup'?'<span class="shift-state live">Học bù</span>':change?.note?'<span class="shift-state">Đã điều chỉnh</span>':'';return '<article class="shift-card '+(ongoing?'ongoing':'')+'" style="cursor:pointer;" data-enter-class="'+escapeHtml(classInfo.id)+'" data-session-date="'+date.toLocaleDateString('sv-SE')+'"><div class="shift-card-icon">'+(ongoing?'◉':'◷')+'</div><div class="shift-card-main"><div class="shift-card-title"><strong style="font-size:13px; color:#214e2d;">'+escapeHtml(classInfo.code||classInfo.name)+'</strong><span class="room-chip" style="background:#eaf5ec; color:#27673b; font-weight:700;">Khối '+escapeHtml(classInfo.grade||'—')+'</span><span class="shift-state '+(ongoing?'live':'')+'">'+status+'</span>'+chip+'</div><p>'+escapeHtml(classInfo.subject||'Lớp học')+' · '+escapeHtml(classInfo.room||'Chưa xếp phòng')+'</p><div class="shift-card-details"><span>◷ '+escapeHtml(dateText)+' · '+escapeHtml(classInfo.startTime)+'–'+escapeHtml(classInfo.endTime)+'</span><span>Giáo viên: '+escapeHtml(teacherNames)+' · Trợ giảng: '+escapeHtml(assistantNames)+'</span></div></div><button type="button" class="primary-button" data-enter-class="'+escapeHtml(classInfo.id)+'" data-session-date="'+date.toLocaleDateString('sv-SE')+'">'+(ongoing?'Vào lớp':'Vào làm')+'</button></article>';}
function renderMainMenu(){const role=selectedRole(),workPanel=$('#work-menu-panel'),managed=$('#managed-class-list');document.querySelector('.user-name small').textContent=({assistant:'Trợ giảng',office:'Văn phòng',teacher:'Giáo viên',admin:'Admin'})[role];$('#main-menu-title').textContent=$('#management-menu-panel').hidden?'Ca làm của tôi':'Quản lý lớp học';$('#main-menu-description').textContent=$('#management-menu-panel').hidden?'Chọn một ca để vào làm hoặc xem lịch dạy sắp tới.':'Cập nhật người phụ trách, lịch học, phòng và thiết lập mặc định cho từng lớp.';$('#work-menu-tab').classList.toggle('active',workPanel&&!workPanel.hidden);$('#management-menu-tab').classList.toggle('active',!$('#management-menu-panel').hidden);$('#work-menu-nav').classList.toggle('active',workPanel&&!workPanel.hidden);$('#management-menu-nav').classList.toggle('active',!$('#management-menu-panel').hidden);const roleField={assistant:'assistantIds',office:'officeIds',teacher:'teacherIds'}[role],sorted=assignedShiftInstances(role).sort((a,b)=>a.date-b.date);const now=new Date(),ongoing=sorted.filter(({item,date})=>{const start=classScheduleStamp(item,date),end=new Date(date);const [h,m]=item.endTime.split(':').map(Number);end.setHours(h,m,0,0);return now>=start&&now<end;});const upcoming=sorted.filter(({item,date})=>!ongoing.some(row=>row.item.id===item.id));const noShiftText=role==='admin'?'Tài khoản admin quản lý trung tâm, không có ca trực.':'Các ca sắp tới sẽ hiện bên dưới.';$('#ongoing-shift-list').innerHTML=ongoing.map(({item,date,change})=>scheduleCard(item,date,change)).join('')||`<div class="menu-empty"><span>◷</span><strong>Hiện chưa có ca nào đang diễn ra</strong><small>${noShiftText}</small></div>`;$('#upcoming-shift-list').innerHTML=upcoming.map(({item,date,change})=>scheduleCard(item,date,change)).join('')||`<div class="menu-empty compact-empty">${role==='admin'?'Admin không có ca trực được phân công.':'Chưa có ca sắp tới được phân công.'}</div>`;$('#management-scope-note').textContent=role==='admin'?'Admin có thể quản lý tất cả lớp và nhân viên.':`Bạn đang xem các lớp được phân công cho tài khoản ${({assistant:'trợ giảng',office:'văn phòng',teacher:'giáo viên'})[role]}.`;const editable=classCatalog.filter(item=>role==='admin'||(item[roleField]||[]).includes(currentEmployeeId));$('#management-class-count').textContent=`${editable.length} lớp`;
  const allQuick = $('#all-classes-quick-list');
  if (allQuick) {
    allQuick.innerHTML = classCatalog.map(item => {
      const date = occurrenceDate(item);
      return `<article class="shift-card" style="cursor:pointer;" data-enter-class="${escapeHtml(item.id)}" data-session-date="${date.toLocaleDateString('sv-SE')}">
        <div class="shift-card-icon">▦</div>
        <div class="shift-card-main">
          <div class="shift-card-title">
            <strong style="font-size:13px; color:#214e2d;">${escapeHtml(item.code || item.name)}</strong>
            <span class="room-chip" style="background:#eaf5ec; color:#27673b; font-weight:700;">${escapeHtml(formatBirthYearInline(item.grade))}</span>
            <span class="room-chip" style="background:#f2f5f2; color:#556858;">${escapeHtml(item.room || 'Phòng học')}</span>
          </div>
          <p>${escapeHtml(item.subject || 'Lớp học')} · ${escapeHtml(item.name)}</p>
          <div class="shift-card-details">
            <span>◷ ${weekdayNames[item.weekday]} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</span>
            <span>GV: ${escapeHtml(item.teacherName || '—')} · TA: ${escapeHtml(item.assistantName || '—')}</span>
          </div>
        </div>
        <button type="button" class="primary-button" data-enter-class="${escapeHtml(item.id)}" data-session-date="${date.toLocaleDateString('sv-SE')}">Vào lớp</button>
      </article>`;
    }).join('') || '<div class="menu-empty">Chưa có lớp học nào trong hệ thống.</div>';
  }managed.innerHTML=editable.map(item=>`<article class="managed-class-card"><div class="managed-class-heading"><div><div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong>${escapeHtml(item.name)}</strong><span class="room-chip" style="background:#eaf5ec; color:#27673b; font-weight:700;">MÃ: ${escapeHtml(item.code||item.id)}</span><span class="room-chip" style="background:#f0f4f8; color:#3d4d5c; font-weight:600;">${escapeHtml(formatBirthYearInline(item.grade))}</span></div><span>${escapeHtml(item.subject||'Chưa có môn học')}</span></div><span class="room-chip">${escapeHtml(item.room||'Chưa xếp phòng')}</span></div><div class="managed-class-details"><span><small>Mã lớp & Năm sinh</small><strong>${escapeHtml(item.code||item.id)}</strong> (${escapeHtml(formatBirthYearInline(item.grade))})</span><span><small>Giáo viên · ${escapeHtml((item.teacherIds||[item.teacherId]).map(id=>masterData.employees.find(employee=>employee.id===id)?.code||'').filter(Boolean).join(', '))}</small>${escapeHtml(item.teacherName)}</span><span><small>Trợ giảng · ${escapeHtml((item.assistantIds||[]).map(id=>masterData.employees.find(employee=>employee.id===id)?.code||'').filter(Boolean).join(', '))}</small>${escapeHtml(item.assistantName)}</span><span><small>Văn phòng · ${escapeHtml((item.officeIds||[]).map(id=>masterData.employees.find(employee=>employee.id===id)?.code||'').filter(Boolean).join(', '))}</small>${escapeHtml(employeeNames(item.officeIds||[]))}</span><span><small>Lịch học</small>${weekdayNames[item.weekday]} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</span><span><small>Sơ đồ mặc định</small>${item.defaultLayout.length} dãy · ${item.defaultLayout.map(row=>row.desks.length).join(' / ')} bàn</span><span><small>Checklist mặc định</small>${item.defaultChecklist.startItems.length} đầu giờ · ${item.defaultChecklist.endItems.length} cuối giờ</span><span><small>Nhắc theo lịch</small>${item.defaultNotifications.length} mốc</span></div><div class="managed-class-actions"><button type="button" class="outline-button btn-view-class-history" data-class-history="${escapeHtml(item.id)}" style="font-weight:700; color:#215732; background:#f2f8f3; border-color:#9dc7a5;">📋 Chi tiết & Lịch sử</button><button type="button" class="outline-button" data-roster-class="${escapeHtml(item.id)}">Danh sách lớp gốc</button><button type="button" class="outline-button" data-edit-class="${escapeHtml(item.id)}">Chỉnh sửa</button><button type="button" class="outline-button" data-edit-session="${escapeHtml(item.id)}">Điều chỉnh buổi</button><button type="button" class="primary-button" data-enter-class="${escapeHtml(item.id)}" data-session-date="${occurrenceDate(item).toLocaleDateString('sv-SE')}" style="padding:7px 12px; font-weight:700;">Vào lớp</button><button type="button" class="outline-button" data-enter-class="${escapeHtml(item.id)}" data-session-date="${occurrenceDate(item).toLocaleDateString('sv-SE')}">Mở ca</button><button type="button" class="text-danger" data-delete-class="${escapeHtml(item.id)}">Xóa lớp</button></div></article>`).join('')||'<div class="menu-empty">Chưa có lớp nào trong danh sách.</div>';$('#add-class-button').hidden=!(role==='office'||role==='admin');$('#manage-employees-button').hidden=role!=='admin';}
function setMainMenuPanel(panel){
  try {
    if (location.pathname !== '/' && location.pathname !== '/class') {
      history.pushState({}, '', '/');
    } else {
      const url = new URL(location.href);
      if (url.searchParams.has('view') || url.searchParams.has('class') || url.searchParams.has('date')) {
        url.search = '';
        url.hash = '';
        history.pushState({}, '', '/');
      }
    }
  } catch {}
  if ($('#main-menu-view')) {
    $('#main-menu-view').hidden = false;
    $('#main-menu-view').style.display = '';
  }
  if ($('#class-workspace')) {
    $('#class-workspace').hidden = true;
    $('#class-workspace').style.display = '';
  }
  if ($('#class-general-view')) {
    $('#class-general-view').hidden = true;
    $('#class-general-view').style.display = '';
  }
  if ($('#class-nav-group')) $('#class-nav-group').hidden = true;
  if ($('#class-nav-label')) $('#class-nav-label').hidden = true;
  if ($('#main-menu-shortcut')) $('#main-menu-shortcut').hidden = true;
  $('#topbar-crumb-label').textContent='Menu chính';
  const crumbSub = document.querySelector('.crumb strong') || $('#topbar-crumb-sub');
  const panelTitles = { work: 'Đi làm', tutoring: 'Lớp bổ trợ', management: 'Quản lý', portal: 'Chấm công của tôi' };
  if (crumbSub) crumbSub.textContent = panelTitles[panel] || 'Đi làm';

  $('#work-menu-panel').hidden = panel !== 'work';
  const tutoringPanel = $('#tutoring-menu-panel');
  if (tutoringPanel) tutoringPanel.hidden = panel !== 'tutoring';
  $('#management-menu-panel').hidden = panel !== 'management';
  const portalPanel = $('#portal-menu-panel');
  if (portalPanel) portalPanel.hidden = panel !== 'portal';

  $('#work-menu-tab')?.classList.toggle('active', panel === 'work');
  $('#tutoring-menu-tab-btn')?.classList.toggle('active', panel === 'tutoring');
  $('#management-menu-tab')?.classList.toggle('active', panel === 'management');
  $('#portal-menu-tab-btn')?.classList.toggle('active', panel === 'portal');

  $('#work-menu-nav')?.classList.toggle('active', panel === 'work');
  $('#tutoring-menu-nav')?.classList.toggle('active', panel === 'tutoring');
  $('#management-menu-nav')?.classList.toggle('active', panel === 'management');
  $('#portal-menu-nav')?.classList.toggle('active', panel === 'portal');

  if (panel === 'work' || panel === 'management') {
    renderMainMenu();
  } else if (panel === 'tutoring' && window.__featuresApp?.renderTutoringModule) {
    window.__featuresApp.renderTutoringModule();
  } else if (panel === 'portal' && window.__featuresApp?.renderTAPortal) {
    window.__featuresApp.renderTAPortal();
  }
}
function showClassWorkspace(){
  const item = activeClassConfig();
  if (!item) return;
  if ($('#main-menu-view')) {
    $('#main-menu-view').hidden = true;
    $('#main-menu-view').style.display = '';
  }
  if ($('#class-general-view')) {
    $('#class-general-view').hidden = true;
    $('#class-general-view').style.display = '';
  }
  if ($('#class-workspace')) {
    $('#class-workspace').hidden = false;
    $('#class-workspace').style.display = '';
  }
  if ($('#class-nav-group')) $('#class-nav-group').hidden = false;
  if ($('#class-nav-label')) $('#class-nav-label').hidden = false;
  if ($('#main-menu-shortcut')) $('#main-menu-shortcut').hidden = false;
  if ($('#topbar-crumb-label')) $('#topbar-crumb-label').textContent = 'Lớp của tôi';
  
  if ($('#active-class-name')) $('#active-class-name').textContent = item.code || item.name;
  if ($('#active-class-subject')) $('#active-class-subject').textContent = (item.subject || 'LỚP HỌC').toLocaleUpperCase('vi');
  if ($('#active-class-code-badge')) $('#active-class-code-badge').textContent = `MÃ: ${item.code || item.id}`;
  if ($('#active-class-grade-badge')) $('#active-class-grade-badge').textContent = formatBirthYearBadge(item.grade);
  if ($('#active-class-room')) $('#active-class-room').textContent = item.room || 'Phòng học';
  
  const activeChange = getSessionChange(item.id, checklistDate);
  if ($('#active-class-teacher')) $('#active-class-teacher').textContent = employeeNames(assignedIdsFor(item, activeChange, 'teacher'));
  const assistantNode = $('#class-session-assistants');
  if (assistantNode) assistantNode.textContent = 'Trợ giảng: ' + employeeNames(assignedIdsFor(item, activeChange, 'assistant'));
  
  const eyebrow = $('#class-session-eyebrow');
  if (eyebrow) {
    const isMakeup = activeChange?.status === 'makeup';
    eyebrow.textContent = `${isMakeup ? 'HỌC BÙ · ' : ''}${weekdayNames[item.weekday]?.toLocaleUpperCase('vi') || ''} · ${formatSessionDate(new Date(`${checklistDate}T00:00:00`))} · CA ${item.startTime}–${item.endTime}`;
  }
  
  const crumbStrong = document.querySelector('.crumb strong');
  if (crumbStrong) crumbStrong.textContent = `${item.code || item.name} · ${item.subject || 'Lớp học'}`;
  
  const sessionStart = classScheduleStamp(item, new Date(`${checklistDate}T00:00:00`));
  const [endH, endM] = String(item.endTime || '17:00').split(':').map(Number);
  const sessionEnd = new Date(`${checklistDate}T00:00:00`);
  sessionEnd.setHours(endH || 17, endM || 0, 0, 0);
  const activeNow = new Date() >= sessionStart && new Date() < sessionEnd;
  const legacyBadge = document.querySelector('.class-page-heading .session-badge');
  if (legacyBadge) legacyBadge.innerHTML = `<span></span> ${activeNow ? 'Đang diễn ra' : 'Ca sắp tới'}`;
  
  if ($('#chat-class-label')) $('#chat-class-label').textContent = `TRAO ĐỔI TRONG CA · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;
  if ($('#checklist-class-label')) $('#checklist-class-label').textContent = `CA ${item.startTime}–${item.endTime} · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;
  if ($('#student-list-class-label')) $('#student-list-class-label').textContent = `DANH SÁCH LỚP · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;
  if ($('#scores-class-label')) $('#scores-class-label').textContent = `NHẬP ĐIỂM TRONG CA · ${(item.code || item.name).toLocaleUpperCase('vi')} (${item.name})`;

  setClassView('seating');
  render();
  window.__featuresApp?.onClassWorkspaceOpened?.();
}
function reloadClassSessionData(classId, date) {
  CURRENT_CLASS_ID = classId;
  checklistDate = date;
  configClass = activeClassConfig();

  const loaded = loadStudentRecords(CURRENT_CLASS_ID);
  students = loaded.students;
  makeupStudents = loaded.makeupStudents;

  const cfg = activeClassConfig();
  layout = read(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`, null);
  if (!Array.isArray(layout) || !layout.length) {
    layout = structuredClone(cfg?.defaultLayout || baseLayout);
    localStorage.setItem(`lopvui.layout.v5.${CURRENT_CLASS_ID}.${checklistDate}`, JSON.stringify(layout));
  }

  lateQueue = read(`lopvui.late-queue.v6.${CURRENT_CLASS_ID}.${checklistDate}`, []);
  attendanceNotes = read(`lopvui.attendance-notes.v1.${CURRENT_CLASS_ID}.${checklistDate}`, {});
  classCommunication = loadClassCommunication(CURRENT_CLASS_ID, checklistDate);

  const defaultChecklistItems = (cfg?.defaultChecklist?.startItems || ['Lau bảng','Bật đèn và kiểm tra quạt/điều hòa','Chuẩn bị tài liệu và bài tập','Kiểm tra bàn ghế, cửa sổ và phòng học']).map((label, index) => ({ id: `default-${index+1}`, label, done: false }));
  const defaultEndChecklistItems = (cfg?.defaultChecklist?.endItems || []).map((label, index) => ({ id: `end-default-${index+1}`, label, done: false }));
  const chkKey = `lopvui.checklist.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
  checklist = read(chkKey, { items: defaultChecklistItems.map(item => ({ ...item, done: false })), classNote: '', tests: {}, testCollectionMode: false, handover: null, workStart: null });
  checklist.items = Array.isArray(checklist.items) ? checklist.items : defaultChecklistItems.map(item => ({ ...item, done: false }));
  checklist.endItems = Array.isArray(checklist.endItems) ? checklist.endItems : defaultEndChecklistItems.map(item => ({ ...item }));
  mergeReminderItems(checklist.items, 'start');
  mergeReminderItems(checklist.endItems, 'end');

  deskItems = read(`lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}`, null);
  if (!deskItems || typeof deskItems !== 'object') {
    deskItems = {};
  }
  const histRecord = window.__featuresApp?.getSessionRecord ? window.__featuresApp.getSessionRecord(CURRENT_CLASS_ID, checklistDate) : null;
  if ((!deskItems || !Object.keys(deskItems).length) && histRecord?.deskItems) {
    deskItems = structuredClone(histRecord.deskItems);
  }
  if ((!layout || !layout.length) && histRecord?.layout) {
    layout = structuredClone(histRecord.layout);
  }
  if (histRecord?.lessonTitle) {
    checklist.lessonTitle = histRecord.lessonTitle;
    const titleInput = $('#lesson-title');
    if (titleInput && document.activeElement !== titleInput) titleInput.value = histRecord.lessonTitle;
  }
  if (histRecord?.finalNote) {
    checklist.classNote = histRecord.finalNote;
    const noteInput = $('#session-note');
    if (noteInput && document.activeElement !== noteInput) noteInput.value = histRecord.finalNote;
  }
  for (const { desk } of desks()) {
    deskItems[desk.id] = deskItems[desk.id] || [];
  }

  // Hydrate attendanceNotes & scope student transient fields (.attendance, .homework) strictly to (CURRENT_CLASS_ID, checklistDate)
  const seatedEntries = allEntries().filter(e => e.entry.studentId);
  const seatedMap = new Map(seatedEntries.map(e => [e.entry.studentId, e.entry]));
  const lateSet = new Set(lateQueue);

  for (const student of [...students, ...makeupStudents]) {
    const savedNote = student.sessionNotes?.find(note => note.classId === CURRENT_CLASS_ID && note.date === checklistDate);
    if (!(student.id in attendanceNotes) && savedNote?.note) {
      attendanceNotes[student.id] = savedNote.note;
    }

    const seatedEntry = seatedMap.get(student.id);
    const snapEntry = histRecord?.studentsSnapshot?.find(s => s.studentId === student.id);
    const attHistEntry = (student.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
    const scoreEntry = (student.scores || []).find(sc => sc.classId === CURRENT_CLASS_ID && sc.date === checklistDate && sc.type !== 'BTVN');

    if (seatedEntry) {
      student.attendance = seatedEntry.attendance || attHistEntry || { status: lateSet.has(student.id) ? 'late' : 'present' };
      student.homework = seatedEntry.homework || (savedNote?.homeworkStatus ? { status: savedNote.homeworkStatus, score: savedNote.homeworkScore ?? null, reason: savedNote.homeworkReason || '' } : { status: 'uncollected' });
    } else if (lateSet.has(student.id)) {
      student.attendance = attHistEntry || { status: 'late', lateMinutes: 10, minutesLate: 10 };
      student.homework = savedNote?.homeworkStatus ? { status: savedNote.homeworkStatus, score: savedNote.homeworkScore ?? null, reason: savedNote.homeworkReason || '' } : { status: 'uncollected' };
    } else if (attHistEntry) {
      student.attendance = { status: attHistEntry.status, reason: attHistEntry.reason || '', lateMinutes: attHistEntry.lateMinutes || attHistEntry.minutesLate || 0, minutesLate: attHistEntry.minutesLate || attHistEntry.lateMinutes || 0 };
      student.homework = savedNote?.homeworkStatus ? { status: savedNote.homeworkStatus, score: savedNote.homeworkScore ?? null, reason: savedNote.homeworkReason || '' } : (attHistEntry.homework || { status: 'uncollected' });
    } else if (snapEntry) {
      student.attendance = snapEntry.attendance || null;
      student.homework = snapEntry.homework || { status: 'uncollected' };
    } else {
      student.attendance = null;
      student.homework = { status: 'uncollected' };
      student.arrivalTime = null;
      student.lateMinutes = 0;
    }

    student.testScore = seatedEntry?.testScore ?? checklist.testScores?.[student.id] ?? snapEntry?.testScore ?? scoreEntry?.score ?? null;
  }
}


let isClassHistoryViewMode = false;

function resolveClass(ref) {
  if (!ref) return null;
  const catalog = classCatalog || [];
  const clean = String(ref).trim().toLowerCase();
  if (clean === 'class-tutoring' || clean === 'botro' || clean === 'lop-bo-tro') {
    return TUTORING_CLASS_CONFIG;
  }
  return catalog.find(c => (c.code && c.code.toLowerCase() === clean) || c.id.toLowerCase() === clean) || null;
}

function resolveStudent(ref) {
  if (!ref) return null;
  const all = [...(students || []), ...(makeupStudents || [])];
  const clean = String(ref).trim().toLowerCase();
  return all.find(s => (s.studentCode && s.studentCode.toLowerCase() === clean) || s.id.toLowerCase() === clean) || null;
}

function highlightStudentSeat(studentId) {
  const person = studentById(studentId);
  const targetBtn = Array.from(document.querySelectorAll('.seat.occupied')).find(el => {
    const deskId = el.dataset.deskId;
    const idx = Number(el.dataset.entryIndex);
    const entry = deskItems[deskId]?.[idx];
    return entry && entry.studentId === studentId;
  });
  if (targetBtn) {
    document.querySelectorAll('.seat-target-highlighted').forEach(b => b.classList.remove('seat-target-highlighted'));
    targetBtn.classList.add('seat-target-highlighted');
    targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Đang làm nổi bật vị trí ngồi của ${person?.name || 'học sinh'} trong buổi học.`);
  } else {
    toast(`Học sinh ${person?.name || ''} chưa ngồi vào bàn hoặc vắng mặt trong buổi học này.`);
  }
}

function resetSessionForNewShift(classId, date, staffName) {
  const cfg = classCatalog.find(c => c.id === classId);
  const defaultLayout = cfg?.defaultLayout || baseLayout;
  layout = structuredClone(defaultLayout);
  deskItems = {};
  lateQueue = [];
  localStorage.setItem(`lopvui.layout.v5.${classId}.${date}`, JSON.stringify(layout));
  localStorage.setItem(`lopvui.desk-items.v7.${classId}.${date}`, JSON.stringify({}));
  localStorage.setItem(`lopvui.late-queue.v6.${classId}.${date}`, JSON.stringify([]));
  localStorage.setItem(`lopvui.finalized-session.v1.${classId}.${date}`, JSON.stringify({ closed: true, date: Date.now(), staff: staffName }));
  for (const { desk } of desks()) {
    deskItems[desk.id] = [];
  }
  render();
}

function renderClassGeneralView(classId) {
  const cls = resolveClass(classId) || activeClassConfig();
  if (!cls) return;

  $('#topbar-crumb-label').textContent = 'Quản lý chung lớp học';
  const crumbSub = document.querySelector('.crumb strong') || $('#topbar-crumb-sub');
  if (crumbSub) crumbSub.textContent = `${cls.code || cls.id} · ${cls.name}`;

  if ($('#general-class-name')) $('#general-class-name').textContent = cls.name || cls.code;
  if ($('#general-class-subject')) $('#general-class-subject').textContent = (cls.subject || 'LỚP HỌC').toLocaleUpperCase('vi');
  if ($('#general-class-code-badge')) $('#general-class-code-badge').textContent = `MÃ: ${cls.code || cls.id}`;
  if ($('#general-class-grade-badge')) $('#general-class-grade-badge').textContent = formatBirthYearBadge(cls.grade);
  if ($('#general-class-room')) $('#general-class-room').textContent = cls.room || 'Phòng học';
  if ($('#general-class-teacher')) $('#general-class-teacher').textContent = cls.teacherName || 'Chưa xếp GV';
  if ($('#general-class-assistants')) $('#general-class-assistants').textContent = 'Trợ giảng: ' + (cls.assistantName || 'Chưa xếp TA');
  if ($('#general-class-schedule')) $('#general-class-schedule').textContent = `${weekdayNames[cls.weekday] || 'Lịch'} · ${cls.startTime}–${cls.endTime}`;

  const roster = students.filter(s => (s.classIds || []).includes(cls.id));
  if ($('#general-roster-count')) $('#general-roster-count').textContent = `${roster.length} học sinh`;
  if ($('#general-stat-total')) $('#general-stat-total').textContent = roster.length;

  const allHist = window.__featuresApp?.loadSessionHistory ? window.__featuresApp.loadSessionHistory() : [];
  const classSessions = allHist.filter(s => s.classId === cls.id).sort((a, b) => b.date.localeCompare(a.date));

  if ($('#general-stat-sessions')) $('#general-stat-sessions').textContent = classSessions.length;
  if ($('#general-history-count')) $('#general-history-count').textContent = `${classSessions.length} buổi học`;

  let totalRecorded = 0;
  let totalPresent = 0;
  let totalHwDone = 0;
  let totalHwPossible = 0;

  classSessions.forEach(s => {
    if (s.stats) {
      totalRecorded += (s.stats.total || s.studentsSnapshot?.length || 0);
      totalPresent += (s.stats.present || 0);
      totalHwDone += (s.stats.homeworkDone || 0);
      totalHwPossible += (s.stats.present || s.stats.total || 0);
    }
  });

  const attRate = totalRecorded ? Math.round((totalPresent / totalRecorded) * 100) : 100;
  const hwRate = totalHwPossible ? Math.round((totalHwDone / totalHwPossible) * 100) : 100;

  if ($('#general-stat-attendance')) $('#general-stat-attendance').textContent = `${attRate}%`;
  if ($('#general-stat-homework')) $('#general-stat-homework').textContent = `${hwRate}%`;

  // Render past sessions list
  const listEl = $('#general-history-sessions-list');
  if (listEl) {
    if (!classSessions.length) {
      listEl.innerHTML = '<div class="menu-empty" style="padding:20px; text-align:center;">Lớp chưa có buổi học nào được ghi nhận trong lịch sử.</div>';
    } else {
      listEl.innerHTML = classSessions.map(s => {
        const isClosed = s.status === 'closed';
        const dFormatted = new Date(`${s.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        const staff = s.closedBy?.name || s.startedBy?.name || s.assistantName || 'Trợ giảng';
        return `
          <div class="portal-stat-card" style="padding:12px 14px; background:#fff; border:1px solid #dce5dd; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
              <div>
                <strong style="color:#21442a; font-size:12px;">📅 ${escapeHtml(dFormatted)}</strong>
                <span class="room-chip" style="margin-left:6px; font-size:8.5px; background:${isClosed ? '#eaf5ec' : '#fef3c7'}; color:${isClosed ? '#2e6d42' : '#92400e'}; font-weight:700;">
                  ${isClosed ? '✓ Đã đóng ca' : '● Đang mở'}
                </span>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="primary-button" data-view-history-date="${escapeHtml(s.date)}" style="padding:4px 8px; font-size:9px; background:#2e6d42; font-weight:700;">
                  👁 Xem lại buổi này (Sơ đồ, Checklist, Log)
                </button>
                <button type="button" class="outline-button" data-reopen-history-date="${escapeHtml(s.date)}" style="padding:4px 8px; font-size:9px;">
                  ▶ Vào lại ca này
                </button>
              </div>
            </div>
            <p style="margin:2px 0 6px; font-size:10.5px; color:#405345; font-weight:600;">
              Bài học: ${escapeHtml(s.lessonTitle || 'Buổi học ' + s.date)}
            </p>
            <div style="display:flex; gap:12px; font-size:9px; color:#687b6e; flex-wrap:wrap;">
              <span>Trực ca: <strong>${escapeHtml(staff)}</strong></span>
              <span>Có mặt: <strong style="color:#2e6d42;">${s.stats?.present || 0}/${s.stats?.total || s.studentsSnapshot?.length || 0}</strong></span>
              <span>Đi muộn: <strong style="color:#bc7b26;">${s.stats?.late || 0}</strong></span>
              <span>Vắng: <strong style="color:#c13b30;">${s.stats?.absent || 0}</strong></span>
              <span>BTVN: <strong>${s.stats?.homeworkDone || 0}</strong></span>
            </div>
            ${s.finalNote ? `<p style="margin:6px 0 0; font-size:9.5px; color:#556658; font-style:italic; border-top:1px dashed #e2e8e3; padding-top:4px;">"${escapeHtml(s.finalNote)}"` : ''}
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-view-history-date]').forEach(btn => {
        btn.onclick = () => {
          navigateTo(`class/${cls.code || cls.id}/history/${btn.dataset.viewHistoryDate}/map`);
        };
      });
      listEl.querySelectorAll('[data-reopen-history-date]').forEach(btn => {
        btn.onclick = () => {
          enterClass(cls.id, btn.dataset.reopenHistoryDate, false, 'seating');
        };
      });
    }
  }

  // Render class roster table (including makeup students at the bottom, no STT, no avatar, split Họ đệm & Tên)
  const rosterTbody = $('#general-roster-table-body');
  if (rosterTbody) {
    const classMakeupsForGeneral = makeupStudents.filter(m => m.attendingClassId === cls.id);
    const combinedGeneralStudents = [...roster, ...classMakeupsForGeneral];
    if (!combinedGeneralStudents.length) {
      rosterTbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:16px; color:#87968a;">Lớp chưa có học sinh nào.</td></tr>';
    } else {
      let rosterSortKey = 'name';
      let rosterSortOrder = 'asc';
      let selectedRosterIds = new Set();

      function updateRosterBulkBar() {
        const bar = $('#roster-bulk-bar');
        const countEl = $('#roster-bulk-count');
        if (!bar || !countEl) return;
        if (selectedRosterIds.size > 0) {
          countEl.textContent = selectedRosterIds.size;
          bar.hidden = false;
        } else {
          bar.hidden = true;
        }
        const selectAll = $('#roster-bulk-select-all');
        if (selectAll) selectAll.checked = roster.length > 0 && selectedRosterIds.size === roster.length;
      }

      function renderRosterTableRows() {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const targetDate = (cls.id === CURRENT_CLASS_ID && checklistDate) ? checklistDate : (classSessions[0]?.date || todayStr);
        const clsDeskItems = (cls.id === CURRENT_CLASS_ID && targetDate === checklistDate)
          ? deskItems
          : (read(`lopvui.desk-items.v7.${cls.id}.${targetDate}`, null) || classSessions.find(cs => cs.date === targetDate)?.deskItems || {});
        const clsLateQueue = (cls.id === CURRENT_CLASS_ID && targetDate === checklistDate)
          ? lateQueue
          : read(`lopvui.late-queue.v6.${cls.id}.${targetDate}`, []);
        const clsAttNotes = (cls.id === CURRENT_CLASS_ID && targetDate === checklistDate)
          ? attendanceNotes
          : read(`lopvui.attendance-notes.v1.${cls.id}.${targetDate}`, {});
        const clsEntries = Object.entries(clsDeskItems || {}).flatMap(([dId, list]) =>
          (Array.isArray(list) ? list : []).map((entry, index) => ({ entry, deskId: dId, index }))
        );

        const buildGeneralRow = (s, idx, isMakeupRow = false) => {
          const seated = clsEntries.find(e => e.entry?.studentId === s.id);
          const attHist = (s.attendanceHistory || []).find(h => h.classId === cls.id && h.date === targetDate);
          const sessNoteObj = (s.sessionNotes || []).find(n => n.classId === cls.id && n.date === targetDate);
          const isLate = clsLateQueue.includes(s.id) || seated?.entry?.attendance?.status === 'late' || attHist?.status === 'late';
          const isPresent = Boolean(seated) || attHist?.status === 'present';
          const attStatus = isLate ? 'late' : isPresent ? 'present' : (attHist?.status || 'unrecorded');
          const attMinutes = seated?.entry?.attendance?.lateMinutes || seated?.entry?.attendance?.minutesLate || attHist?.lateMinutes || attHist?.minutesLate || 10;

          const hw = seated?.entry?.homework || (sessNoteObj?.homeworkStatus ? { status: sessNoteObj.homeworkStatus, score: sessNoteObj.homeworkScore ?? null, reason: sessNoteObj.homeworkReason || '' } : { status: 'uncollected' });
          const hwStatus = hw.status || 'uncollected';
          const hwScore = hw.score ?? null;
          const hwReason = hw.reason || '';

          const scoreObj = (s.scores || []).find(sc => sc.classId === cls.id && sc.date === targetDate && sc.type !== 'BTVN');
          const testScore = seated?.entry?.testScore ?? scoreObj?.score ?? null;
          const note = clsAttNotes[s.id] ?? sessNoteObj?.note ?? seated?.entry?.note ?? '';
          const parts = splitStudentName(s.name);
          const familyName = s.familyName ?? parts.familyName;
          const givenName = s.givenName ?? parts.givenName;

          return {
            student: s,
            familyName,
            givenName,
            isMakeupRow,
            originalIndex: idx + 1,
            attStatus,
            attMinutes,
            hwStatus,
            hwScore,
            hwReason,
            testScore,
            note
          };
        };

        const sortItems = (arr) => {
          arr.sort((a, b) => {
            let cmp = 0;
            if (rosterSortKey === 'family') {
              cmp = (a.familyName || '').localeCompare(b.familyName || '', 'vi') || (a.givenName || '').localeCompare(b.givenName || '', 'vi');
            } else if (rosterSortKey === 'name') {
              cmp = (a.givenName || '').localeCompare(b.givenName || '', 'vi') || (a.familyName || '').localeCompare(b.familyName || '', 'vi');
            } else if (rosterSortKey === 'school') {
              cmp = (a.student.school || a.student.sourceClassName || '').localeCompare(b.student.school || b.student.sourceClassName || '', 'vi');
            } else if (rosterSortKey === 'attendance') {
              const attOrder = { present: 1, late: 2, absent_excused: 3, absent_unexcused: 4, absent: 5, unrecorded: 6 };
              cmp = (attOrder[a.attStatus] || 99) - (attOrder[b.attStatus] || 99);
            } else if (rosterSortKey === 'homework') {
              const hwOrder = { graded: 1, submitted: 2, uncollected: 3, not_submitted: 4 };
              cmp = (hwOrder[a.hwStatus] || 99) - (hwOrder[b.hwStatus] || 99);
            } else if (rosterSortKey === 'score') {
              const aScore = a.hwScore ?? a.testScore ?? -1;
              const bScore = b.hwScore ?? b.testScore ?? -1;
              cmp = aScore - bScore;
            } else if (rosterSortKey === 'note') {
              cmp = (a.note || '').localeCompare(b.note || '', 'vi');
            } else {
              cmp = a.originalIndex - b.originalIndex;
            }
            return rosterSortOrder === 'desc' ? -cmp : cmp;
          });
          return arr;
        };

        const enrichedRegular = sortItems(roster.map((s, idx) => buildGeneralRow(s, idx, false)));
        const enrichedMakeups = sortItems(classMakeupsForGeneral.map((s, idx) => buildGeneralRow(s, idx, true)));
        const enrichedRoster = [...enrichedRegular, ...enrichedMakeups];

        // Update header sort icons
        document.querySelectorAll('#general-roster-table th[data-roster-sort]').forEach(th => {
          const key = th.dataset.rosterSort;
          th.classList.remove('sorted-asc', 'sorted-desc');
          const icon = th.querySelector('.sort-icon');
          if (key === rosterSortKey) {
            th.classList.add(rosterSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc');
            if (icon) icon.textContent = rosterSortOrder === 'asc' ? '▲' : '▼';
          } else {
            if (icon) icon.textContent = '⇅';
          }
        });

        rosterTbody.innerHTML = enrichedRoster.map(item => {
          const s = item.student;
          const isMakeup = item.isMakeupRow || s.studentType === 'makeup';
          const makeupBadge = isMakeup
            ? `<span class="makeup-status-badge" title="Học sinh học bù">🔄 Học bù${s.sourceClassName ? ` (${escapeHtml(s.sourceClassName)})` : ''}</span>`
            : '';

          const attBadge = item.attStatus === 'present'
            ? '<span class="status-pill done" style="background:#eaf5ec; color:#2e6d42; font-weight:700;">✓ Có mặt</span>'
            : item.attStatus === 'late'
              ? `<span class="status-pill" style="background:#fef3c7; color:#92400e; font-weight:700;">⏱ Muộn ${item.attMinutes}p</span>`
              : (item.attStatus === 'absent' || item.attStatus === 'absent_excused' || item.attStatus === 'absent_unexcused')
                ? '<span class="status-pill" style="background:#fee2e2; color:#991b1b; font-weight:700;">× Vắng</span>'
                : '<span class="status-pill" style="background:#f3f4f6; color:#6b7280;">Chưa điểm danh</span>';

          const hwBadge = item.hwStatus === 'submitted' || item.hwStatus === 'graded'
            ? `<span class="status-pill done" style="background:#eaf5ec; color:#2e6d42;">✓ Đã nộp ${item.hwScore !== null ? `(${item.hwScore}đ)` : ''}</span>`
            : item.hwStatus === 'not_submitted'
              ? `<span class="status-pill" style="background:#fee2e2; color:#991b1b;">× Chưa nộp ${item.hwReason ? `(${escapeHtml(item.hwReason)})` : ''}</span>`
              : '<span class="status-pill" style="background:#f3f4f6; color:#6b7280;">· Chưa thu</span>';

          const scoreHtml = (item.hwScore !== null || item.testScore !== null)
            ? `${item.hwScore !== null ? `BTVN: <strong>${item.hwScore}đ</strong> ` : ''}${item.testScore !== null ? `Test: <strong style="color:#6d28d9;">${item.testScore}đ</strong>` : ''}`
            : '<small style="color:#a8b4aa;">—</small>';

          const schoolOrMakeupText = isMakeup
            ? `Học Bù (${s.sourceClassName || s.school || 'T2'})`
            : (s.school || '—');

          return `
            <tr class="${isMakeup ? 'makeup-row-tr' : ''}">
              <td style="text-align:center;">
                ${!isMakeup ? `<input type="checkbox" class="roster-student-cb" data-student-id="${escapeHtml(s.id)}" ${selectedRosterIds.has(s.id) ? 'checked' : ''} />` : '<span title="Học bù">🔄</span>'}
              </td>
              <td>${escapeHtml(item.familyName || '—')}</td>
              <td>
                <strong style="color:${isMakeup ? '#581c87' : '#214e2d'};">${escapeHtml(item.givenName || s.name)}</strong>
                ${makeupBadge}
                ${renderInlineTags(s)}
              </td>
              <td>${escapeHtml(schoolOrMakeupText)}</td>
              <td>${attBadge}${isMakeup ? ' <span class="makeup-status-badge">Học bù</span>' : ''}</td>
              <td>${hwBadge}</td>
              <td style="text-align:center;">${scoreHtml}</td>
              <td>${item.note ? `<span title="${escapeHtml(item.note)}" style="display:inline-block; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.note)}</span>` : '<small style="color:#a8b4aa;">—</small>'}</td>
              <td style="text-align:center; white-space:nowrap;">
                <button type="button" class="outline-button find-seat-btn" data-find-seat-student="${escapeHtml(s.id)}" data-find-seat-class="${escapeHtml(cls.id)}" title="Mở sơ đồ lớp và tìm nhanh chỗ ngồi học sinh này">🗺 Tìm chỗ</button>
                <button type="button" class="outline-button" data-open-stu-class="${escapeHtml(s.id)}" style="padding:2px 6px; font-size:8.5px; margin-left:3px;">Hồ sơ ↗</button>
              </td>
            </tr>
          `;
        }).join('');

        rosterTbody.querySelectorAll('.roster-student-cb').forEach(cb => {
          cb.onchange = () => {
            if (cb.checked) selectedRosterIds.add(cb.dataset.studentId);
            else selectedRosterIds.delete(cb.dataset.studentId);
            updateRosterBulkBar();
          };
        });

        rosterTbody.querySelectorAll('[data-open-stu-class]').forEach(btn => {
          btn.onclick = () => {
            const s = studentById(btn.dataset.openStuClass);
            navigateTo(`students/${s?.studentCode || s?.id}/class/${cls.code || cls.id}`);
          };
        });

        updateRosterBulkBar();
      }

      // Wire sorting clicks
      document.querySelectorAll('#general-roster-table th[data-roster-sort]').forEach(th => {
        th.onclick = () => {
          const key = th.dataset.rosterSort;
          if (rosterSortKey === key) {
            rosterSortOrder = rosterSortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            rosterSortKey = key;
            rosterSortOrder = 'asc';
          }
          renderRosterTableRows();
        };
      });

      renderRosterTableRows();

      const selectAllCb = $('#roster-bulk-select-all');
      if (selectAllCb) {
        selectAllCb.checked = false;
        selectAllCb.onchange = () => {
          if (selectAllCb.checked) roster.forEach(s => selectedRosterIds.add(s.id));
          else selectedRosterIds.clear();
          document.querySelectorAll('.roster-student-cb').forEach(cb => cb.checked = selectAllCb.checked);
          updateRosterBulkBar();
        };
      }

      if ($('#roster-bulk-clear-btn')) {
        $('#roster-bulk-clear-btn').onclick = () => {
          selectedRosterIds.clear();
          if (selectAllCb) selectAllCb.checked = false;
          rosterTbody.querySelectorAll('.roster-student-cb').forEach(cb => cb.checked = false);
          updateRosterBulkBar();
        };
      }

      if ($('#roster-bulk-add-tag-btn')) {
        $('#roster-bulk-add-tag-btn').onclick = () => {
          if (!selectedRosterIds.size) return;
          const tag = prompt('Nhập tên tag muốn thêm cho các học sinh đã chọn (ví dụ: Cần chú ý, Mục tiêu 9+):');
          if (!tag || !tag.trim()) return;
          selectedRosterIds.forEach(id => {
            const s = studentById(id);
            if (s) {
              s.tags = s.tags || [];
              if (!s.tags.includes(tag.trim())) s.tags.push(tag.trim());
            }
          });
          saveStudentRecords(students, makeupStudents);
          save();
          renderClassGeneralView(cls.id);
          toast(`Đã thêm tag "${tag.trim()}" cho ${selectedRosterIds.size} học sinh.`);
        };
      }

      if ($('#roster-bulk-remove-tag-btn')) {
        $('#roster-bulk-remove-tag-btn').onclick = () => {
          if (!selectedRosterIds.size) return;
          const tag = prompt('Nhập tên tag muốn xóa khỏi các học sinh đã chọn:');
          if (!tag || !tag.trim()) return;
          selectedRosterIds.forEach(id => {
            const s = studentById(id);
            if (s && s.tags) s.tags = s.tags.filter(t => t !== tag.trim());
          });
          saveStudentRecords(students, makeupStudents);
          save();
          renderClassGeneralView(cls.id);
          toast(`Đã xóa tag "${tag.trim()}" khỏi các học sinh đã chọn.`);
        };
      }

      if ($('#roster-bulk-add-class-btn')) {
        $('#roster-bulk-add-class-btn').onclick = () => {
          if (!selectedRosterIds.size) return;
          const otherClasses = (classCatalog || []).filter(c => c.id !== cls.id);
          const optionsText = otherClasses.map((c, i) => `${i + 1}. [${c.code || c.id}] ${c.name}`).join('\n');
          const choice = prompt(`Chọn lớp muốn thêm vào (Nhập số thứ tự):\n${optionsText}`);
          const idx = Number(choice) - 1;
          if (isNaN(idx) || !otherClasses[idx]) return;
          const targetClass = otherClasses[idx];
          selectedRosterIds.forEach(id => {
            const s = studentById(id);
            if (s) {
              s.classIds = s.classIds || [];
              if (!s.classIds.includes(targetClass.id)) s.classIds.push(targetClass.id);
            }
          });
          saveStudentRecords(students, makeupStudents);
          save();
          renderClassGeneralView(cls.id);
          toast(`Đã thêm ${selectedRosterIds.size} học sinh vào lớp ${targetClass.code || targetClass.name}.`);
        };
      }

      if ($('#roster-bulk-move-class-btn')) {
        $('#roster-bulk-move-class-btn').onclick = () => {
          if (!selectedRosterIds.size) return;
          const otherClasses = (classCatalog || []).filter(c => c.id !== cls.id);
          const optionsText = otherClasses.map((c, i) => `${i + 1}. [${c.code || c.id}] ${c.name}`).join('\n');
          const choice = prompt(`Chuyển ${selectedRosterIds.size} học sinh sang lớp nào? (Nhập số thứ tự):\n${optionsText}`);
          const idx = Number(choice) - 1;
          if (isNaN(idx) || !otherClasses[idx]) return;
          const targetClass = otherClasses[idx];
          selectedRosterIds.forEach(id => {
            const s = studentById(id);
            if (s) {
              s.classIds = (s.classIds || []).filter(cid => cid !== cls.id);
              if (!s.classIds.includes(targetClass.id)) s.classIds.push(targetClass.id);
            }
          });
          saveStudentRecords(students, makeupStudents);
          save();
          renderClassGeneralView(cls.id);
          toast(`Đã chuyển ${selectedRosterIds.size} học sinh sang lớp ${targetClass.code || targetClass.name}.`);
        };
      }

      if ($('#roster-bulk-remove-class-btn')) {
        $('#roster-bulk-remove-class-btn').onclick = () => {
          if (!selectedRosterIds.size) return;
          if (!confirm(`Xác nhận bỏ ${selectedRosterIds.size} học sinh đã chọn khỏi lớp ${cls.name}?`)) return;
          selectedRosterIds.forEach(id => {
            const s = studentById(id);
            if (s) s.classIds = (s.classIds || []).filter(cid => cid !== cls.id);
          });
          saveStudentRecords(students, makeupStudents);
          save();
          renderClassGeneralView(cls.id);
          toast(`Đã bỏ ${selectedRosterIds.size} học sinh khỏi lớp này.`);
        };
      }
    }
  }

  // Setup general view buttons
  if ($('#general-enter-live-btn')) {
    $('#general-enter-live-btn').onclick = () => {
      navigateTo(`class/${cls.code || cls.id}/live/map`);
    };
  }
  if ($('#general-edit-class-btn')) {
    $('#general-edit-class-btn').onclick = () => {
      openClassConfig(cls.id);
    };
  }
  if ($('#general-roster-btn')) {
    $('#general-roster-btn').onclick = () => {
      if (window.__featuresApp?.openRosterAdmin) window.__featuresApp.openRosterAdmin(cls.id);
    };
  }
  if ($('#general-back-classes-btn')) {
    $('#general-back-classes-btn').onclick = () => {
      navigateTo('class');
    };
  }
  if ($('#general-export-roster-btn')) {
    $('#general-export-roster-btn').onclick = () => {
      const records = roster.map(s => ({
        student: s,
        seat: '—',
        attendance: null,
        homework: { status: 'uncollected' }
      }));
      window.__featuresApp?.exportRoster?.(cls.name, records) || toast('Đã xuất danh sách lớp.');
    };
  }
}

function enterClass(classId, date, isHistoryMode = false, targetView = 'seating') {
  const cls = resolveClass(classId);
  if (!cls) return;
  CURRENT_CLASS_ID = cls.id;
  checklistDate = date || new Date().toLocaleDateString('sv-SE');
  isClassHistoryViewMode = Boolean(isHistoryMode);

  reloadClassSessionData(CURRENT_CLASS_ID, checklistDate);
  showClassWorkspace();

  const histBanner = $('#history-session-banner');
  const histRecord = window.__featuresApp?.getSessionRecord ? window.__featuresApp.getSessionRecord(CURRENT_CLASS_ID, checklistDate) : null;

  if (isClassHistoryViewMode || (histRecord && histRecord.status === 'closed' && checklistDate !== new Date().toLocaleDateString('sv-SE'))) {
    isClassHistoryViewMode = true;
    if (histBanner) {
      histBanner.hidden = false;
      $('#history-banner-date').textContent = new Date(`${checklistDate}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      $('#history-banner-lesson').textContent = `Bài học: ${histRecord?.lessonTitle || '—'}`;
      $('#history-banner-staff').textContent = `Trợ giảng: ${histRecord?.closedBy?.name || histRecord?.assistantName || cls.assistantName || '—'}`;
    }
    const badge = $('#session-status-badge');
    if (badge) {
      badge.className = 'session-badge-state closed';
      badge.innerHTML = '● Đã đóng ca (Lịch sử)';
    }
    if ($('#close-session-btn')) $('#close-session-btn').hidden = true;
    if ($('#open-session-btn')) $('#open-session-btn').hidden = true;
  } else {
    isClassHistoryViewMode = false;
    if (histBanner) histBanner.hidden = true;
    if ($('#close-session-btn')) $('#close-session-btn').hidden = false;
    window.__featuresApp?.updateSessionStateUI?.();
  }

  // Setup banner navigation buttons
  if ($('#history-back-general-btn')) {
    $('#history-back-general-btn').onclick = () => navigateTo(`class/${cls.code || cls.id}/general`);
  }
  if ($('#history-switch-live-btn')) {
    $('#history-switch-live-btn').onclick = () => navigateTo(`class/${cls.code || cls.id}/live/map`);
  }
  if ($('#header-class-general-btn')) {
    $('#header-class-general-btn').onclick = () => navigateTo(`class/${cls.code || cls.id}/general`);
  }
  if ($('#header-edit-class-btn')) {
    $('#header-edit-class-btn').hidden = (selectedRole() !== 'admin' && selectedRole() !== 'office');
    $('#header-edit-class-btn').onclick = () => openClassConfig(cls.id);
  }

  setClassView(targetView === 'chatlog' ? 'chat' : targetView === 'scores' ? 'scores' : targetView === 'checklist' ? 'checklist' : targetView === 'students' ? 'students' : 'seating');
  render();
  window.__featuresApp?.onClassWorkspaceOpened?.();
}

function exitToMainMenu() {
  $('#class-general-view').hidden = true;
  $('#class-workspace').hidden = true;
  $('#main-menu-view').hidden = false;
  setMainMenuPanel('work');
  renderMainMenu();
}

function navigateTo(path, replace = false) {
  const cleanPath = path.replace(/^\//, '');
  const url = '/' + cleanPath;
  try {
    if (replace) {
      history.replaceState({ path: cleanPath }, '', url);
    } else {
      history.pushState({ path: cleanPath }, '', url);
    }
  } catch (e) {
    location.hash = cleanPath;
  }
  handleRoute();
}

function handleRoute() {
  let path = location.hash ? location.hash.replace(/^#\/?/, '') : location.pathname.replace(/^\//, '');
  const params = new URLSearchParams(location.search);
  if (!path && params.get('view') === 'class' && params.get('class')) {
    const c = resolveClass(params.get('class'));
    path = `class/${c?.code || params.get('class')}/live/map`;
  }
  if (!path) path = 'class';

  const parts = path.split('/').filter(Boolean);

  // Route: class
  if (parts[0] === 'class' || parts[0] === 'classes') {
    if (parts.length === 1) {
      exitToMainMenu();
      return;
    }

    const classRef = parts[1];
    const cls = resolveClass(classRef);
    if (!cls) {
      toast(`Không tìm thấy lớp: ${classRef}`);
      exitToMainMenu();
      return;
    }

    const action = parts[2] || 'general';

    if (action === 'general') {
      $('#main-menu-view').hidden = true;
      $('#class-workspace').hidden = true;
      $('#class-general-view').hidden = false;
      renderClassGeneralView(cls.id);
      return;
    }

    if (action === 'live') {
      const subtab = parts[3] || 'map';
      const today = new Date().toLocaleDateString('sv-SE');
      enterClass(cls.id, today, false, subtab);
      return;
    }

    if (action === 'history') {
      const dateArg = parts[3];
      const subtab = parts[4] || 'map';
      const allHist = window.__featuresApp?.loadSessionHistory ? window.__featuresApp.loadSessionHistory() : [];
      const classHist = allHist.filter(s => s.classId === cls.id);
      let targetDate = dateArg;
      if (!targetDate && classHist.length) {
        targetDate = classHist[0].date;
      } else if (targetDate) {
        const match = classHist.find(s => s.date === targetDate || s.id.includes(targetDate));
        if (match) targetDate = match.date;
      }
      if (!targetDate) targetDate = new Date().toLocaleDateString('sv-SE');
      enterClass(cls.id, targetDate, true, subtab);
      return;
    }

    enterClass(cls.id, new Date().toLocaleDateString('sv-SE'), false, 'seating');
    return;
  }

  // Route: students
  if (parts[0] === 'students') {
    if (parts.length === 1) {
      if (window.__featuresApp?.renderMasterStudentDirectory) {
        window.__featuresApp.renderMasterStudentDirectory();
        $('#student-directory-dialog')?.showModal();
      }
      return;
    }

    const studentRef = parts[1];
    const stu = resolveStudent(studentRef);
    if (!stu) {
      toast(`Không tìm thấy học sinh: ${studentRef}`);
      return;
    }

    if (parts.length === 2) {
      openStudentProfile(stu.id);
      return;
    }

    if (parts[2] === 'class' && parts[3]) {
      const classRef = parts[3];
      const cls = resolveClass(classRef);
      if (!cls) {
        toast(`Không tìm thấy lớp: ${classRef}`);
        return;
      }

      if (parts.length === 4) {
        if (window.__featuresApp?.openStudentClassProfile) {
          window.__featuresApp.openStudentClassProfile(stu.id, cls.id);
        }
        return;
      }

      if (parts[4] === 'history') {
        let targetDate = null;
        if (parts[5] === 'map') {
          const seatEntry = stu.seatingHistory?.find(sh => sh.classId === cls.id);
          const attEntry = stu.attendanceHistory?.find(ah => ah.classId === cls.id);
          targetDate = seatEntry?.date || attEntry?.date;
          if (!targetDate) {
            const allHist = window.__featuresApp?.loadSessionHistory ? window.__featuresApp.loadSessionHistory() : [];
            const classHist = allHist.filter(s => s.classId === cls.id);
            targetDate = classHist[0]?.date || new Date().toLocaleDateString('sv-SE');
          }
        } else {
          targetDate = parts[5];
        }

        enterClass(cls.id, targetDate, true, 'seating');
        $('#student-profile-dialog')?.close();
        $('#student-class-profile-dialog')?.close();

        setTimeout(() => {
          highlightStudentSeat(stu.id);
        }, 250);
        return;
      }
    }
  }
}

$('#work-menu-nav').onclick=()=>setMainMenuPanel('work');$('#management-menu-nav').onclick=()=>setMainMenuPanel('management');$('#work-menu-tab').onclick=()=>setMainMenuPanel('work');$('#management-menu-tab').onclick=()=>setMainMenuPanel('management');
$('#main-menu-shortcut').onclick=()=>navigateTo('class');
window.addEventListener('popstate', handleRoute);
window.addEventListener('hashchange', handleRoute);
document.addEventListener('click',event=>{
  const enter=event.target.closest('[data-enter-class]');
  if(enter){
    event.preventDefault();
    const targetCls = resolveClass(enter.dataset.enterClass);
    navigateTo(`class/${targetCls?.code || enter.dataset.enterClass}/live/map`);
    return;
  }
  const histBtn=event.target.closest('[data-class-history]');
  if(histBtn){
    event.preventDefault();
    const targetCls = resolveClass(histBtn.dataset.classHistory);
    navigateTo(`class/${targetCls?.code || histBtn.dataset.classHistory}/general`);
    return;
  }
  const rosterBtn=event.target.closest('[data-roster-class]');
  if(rosterBtn){
    event.preventDefault();
    if(window.__featuresApp?.openRosterAdmin){window.__featuresApp.openRosterAdmin(rosterBtn.dataset.rosterClass);}
    return;
  }
  const seatMapBtn=event.target.closest('[data-view-seat-student]');
  if(seatMapBtn){
    event.preventDefault();
    const targetClass=seatMapBtn.dataset.viewSeatClass||CURRENT_CLASS_ID;
    const targetDate=seatMapBtn.dataset.viewSeatDate||checklistDate;
    const targetStudentId=seatMapBtn.dataset.viewSeatStudent;
    const targetCls=resolveClass(targetClass);
    const targetStu=resolveStudent(targetStudentId);
    $('#student-profile-dialog')?.close();
    $('#student-class-profile-dialog')?.close();
    navigateTo(`students/${targetStu?.studentCode || targetStudentId}/class/${targetCls?.code || targetClass}/history/${targetDate}/map`);
    return;
  }
  const sessionEdit=event.target.closest('[data-edit-session]');if(sessionEdit){if(window.__featuresApp?.openSessionScheduleDialog){window.__featuresApp.openSessionScheduleDialog(sessionEdit.dataset.editSession);}else{openSessionChange(sessionEdit.dataset.editSession);}return;}
  const edit=event.target.closest('[data-edit-class]');if(edit){openClassConfig(edit.dataset.editClass);return;}const remove=event.target.closest('[data-delete-class]');if(remove){const item=classCatalog.find(row=>row.id===remove.dataset.deleteClass);if(item&&window.confirm(`Xóa lớp ${item.name} khỏi danh sách quản lý? Dữ liệu buổi học đã lưu trên thiết bị sẽ không bị xóa.`)){classCatalog=classCatalog.filter(row=>row.id!==item.id);saveClassCatalog(classCatalog);renderMainMenu();}}});
function roleLabel(role){return ({assistant:'Trợ giảng',office:'Văn phòng',teacher:'Giáo viên',admin:'Admin'})[role]||role;}
function renderEmployeeAdminList(){const host=$('#employee-admin-list');host.innerHTML=masterData.employees.map(employee=>'<div class="employee-admin-row" data-employee-id="'+escapeHtml(employee.id)+'"><label class="field-label">Mã<input data-employee-code value="'+escapeHtml(employee.code)+'" required></label><label class="field-label">Họ tên<input data-employee-name value="'+escapeHtml(employee.name)+'" required></label><label class="field-label">Vai trò<select data-employee-role><option value="assistant" '+(employee.role==='assistant'?'selected':'')+'>Trợ giảng</option><option value="office" '+(employee.role==='office'?'selected':'')+'>Văn phòng</option><option value="teacher" '+(employee.role==='teacher'?'selected':'')+'>Giáo viên</option><option value="admin" '+(employee.role==='admin'?'selected':'')+'>Admin</option></select></label></div>').join('');}
$('#manage-employees-button').onclick=()=>{
  setMainMenuPanel('management');
  $('#mgmt-tab-staff')?.click();
  if (window.__featuresApp?.renderStaffManagement) {
    window.__featuresApp.renderStaffManagement();
  }
};$('#close-employee-admin').onclick=()=>$('#employee-admin-dialog').close();$('#employee-admin-form').addEventListener('submit',event=>{event.preventDefault();const edits=[...document.querySelectorAll('[data-employee-id]')].map(row=>({id:row.dataset.employeeId,code:row.querySelector('[data-employee-code]').value.trim(),name:row.querySelector('[data-employee-name]').value.trim(),role:row.querySelector('[data-employee-role]').value})),code=$('#employee-code-input').value.trim(),name=$('#employee-name-input').value.trim(),role=$('#employee-role-input').value;if(!code||!name)return;const combinedCodes=[...edits.map(item=>item.code),...(code?[code]:[])];if(new Set(combinedCodes.map(item=>item.toLocaleUpperCase())).size!==combinedCodes.length){toast('Mã nhân viên phải là duy nhất.');return;}for(const update of edits){const old=masterData.employees.find(item=>item.id===update.id);if(!old)continue;Object.assign(old,update);if(old.role!==update.role){for(const item of classCatalog){for(const field of ['teacherIds','assistantIds','officeIds'])item[field]=(item[field]||[]).filter(id=>id!==old.id);if(update.role==='teacher')(item.teacherIds||=[]).push(old.id);if(update.role==='assistant')(item.assistantIds||=[]).push(old.id);if(update.role==='office')(item.officeIds||=[]).push(old.id);item.teacherId=item.teacherIds?.[0]||'';item.teacherName=employeeNames(item.teacherIds||[]);item.assistantName=employeeNames(item.assistantIds||[]);}}}if(code){masterData.employees.push({id:'employee-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),code,name,role});}saveMasterData(masterData);saveClassCatalog(classCatalog);$('#employee-code-input').value='';$('#employee-name-input').value='';renderEmployeeAdminList();renderMainMenu();toast('Đã lưu danh sách nhân viên.');});
function fillSessionStaffSelect(select,role,selectedIds=[]){const names=masterData.employees.filter(employee=>employee.role===role).map(employee=>'<option value="'+escapeHtml(employee.id)+'" '+(selectedIds.includes(employee.id)?'selected':'')+'>'+escapeHtml(employee.name)+' · '+escapeHtml(employee.code)+'</option>').join('');select.innerHTML='<option value="@none">Không phân công '+(role==='assistant'?'trợ giảng':'giáo viên')+'</option>'+names;for(const option of select.options)if(option.value==='@none')option.selected=false;}
function openSessionChange(classId){const item=classCatalog.find(row=>row.id===classId);if(!item)return;$('#session-change-class-id').value=classId;const date=occurrenceDate(item).toLocaleDateString('sv-SE');$('#session-change-date').value=date;const existing=getSessionChange(classId,date);$('#session-change-type').value=existing?.status==='cancelled'?'cancel':existing?.status==='makeup'?'makeup':existing?.note?'staff_change':'staff_change';$('#session-makeup-date').value='';$('#makeup-date-field').hidden=!['makeup','holiday_makeup'].includes($('#session-change-type').value);$('#session-change-note').value=existing?.note||'';fillSessionStaffSelect($('#session-change-teachers'),'teacher',existing?.teacherIds||[]);fillSessionStaffSelect($('#session-change-assistants'),'assistant',existing?.assistantIds||[]);$('#session-change-dialog').showModal();}
$('#close-session-change').onclick=()=>$('#session-change-dialog').close();$('#cancel-session-change').onclick=()=>$('#session-change-dialog').close();$('#session-change-type').onchange=event=>{$('#makeup-date-field').hidden=!['makeup','holiday_makeup'].includes(event.target.value);};$('#session-change-form').addEventListener('submit',event=>{event.preventDefault();const classId=$('#session-change-class-id').value,item=classCatalog.find(row=>row.id===classId),date=$('#session-change-date').value,type=$('#session-change-type').value;if(!item||!date)return;const readIds=select=>{const ids=[...select.selectedOptions].map(option=>option.value);if(ids.includes('@none'))return [];return ids.length?ids:undefined;},teacherIds=readIds($('#session-change-teachers')),assistantIds=readIds($('#session-change-assistants')),note=$('#session-change-note').value.trim(),makeRecord=(sessionDate,status)=>({classId,date:sessionDate,status,teacherIds,assistantIds,note,updatedAt:Date.now(),updatedBy:currentEmployeeId});if(type==='holiday_makeup'){sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'cancelled'),note:note||'Nghỉ lễ'};const makeupDate=$('#session-makeup-date').value;if(makeupDate)sessionChanges[sessionChangeKey(classId,makeupDate)]={...makeRecord(makeupDate,'makeup'),sourceDate:date,note:note||'Buổi học bù'};}else if(type==='cancel'){sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'cancelled'),note:note||'Lớp nghỉ'};}else if(type==='makeup'){sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'makeup'),note:note||'Buổi học bù'};}else{sessionChanges[sessionChangeKey(classId,date)]={...makeRecord(date,'scheduled')};}saveClassSessionChanges(sessionChanges);$('#session-change-dialog').close();renderMainMenu();toast('Đã lưu điều chỉnh cho buổi học.');});
function layoutCounts(item){return item.defaultLayout.map(row=>row.desks.length);}
let selectedTeacherIds=[],selectedAssistantIds=[],selectedOfficeIds=[];
function renderStaffSelection(){for(const [ids,hostId,role] of [[selectedTeacherIds,'config-teachers-selected','teacher'],[selectedAssistantIds,'config-assistants-selected','assistant'],[selectedOfficeIds,'config-office-selected','office']]){const host=$('#'+hostId);host.innerHTML=ids.map(id=>{const employee=masterData.employees.find(item=>item.id===id);return employee?`<span class="staff-chip">${escapeHtml(employee.name)} <small>${escapeHtml(employee.code)}</small><button type="button" data-remove-staff="${escapeHtml(id)}" data-staff-role="${role}" aria-label="Bỏ ${escapeHtml(employee.name)}">×</button></span>`:'';}).join('')||'<small class="staff-picker-empty">Chưa chọn nhân viên</small>';}}
function renderEmployeeOptions(select,role,selected){const available=masterData.employees.filter(employee=>employee.role===role&&!selected.includes(employee.id));select.innerHTML='<option value="">Chọn nhân viên…</option>'+available.map(employee=>`<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.name)} · ${escapeHtml(employee.code)}</option>`).join('');}
function renderMasterDataChoices(item){$('#config-class-subject').innerHTML=masterData.subjects.map(subject=>`<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join('');if(item?.subjectId)$('#config-class-subject').value=item.subjectId;selectedTeacherIds=item?.teacherIds?.slice()||(item?.teacherId?[item.teacherId]:[]);selectedAssistantIds=item?.assistantIds?.slice()||((selectedRole()==='assistant'?[currentEmployeeId]:[]));selectedOfficeIds=item?.officeIds?.slice()||((selectedRole()==='office'?[currentEmployeeId]:[]));renderStaffSelection();renderEmployeeOptions($('#config-teacher-choice'),'teacher',selectedTeacherIds);renderEmployeeOptions($('#config-assistant-choice'),'assistant',selectedAssistantIds);renderEmployeeOptions($('#config-office-choice'),'office',selectedOfficeIds);}
function readConfigNotifications(){return [...document.querySelectorAll('.config-notification-row')].map(row=>({id:row.dataset.ruleId||`rule-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,anchor:row.querySelector('[data-rule-anchor]').value,offsetMinutes:Number(row.querySelector('[data-rule-offset]').value)||0,title:row.querySelector('[data-rule-title]').value.trim(),body:row.querySelector('[data-rule-body]').value.trim()})).filter(rule=>rule.title||rule.body);}
function renderConfigNotifications(rules){$('#config-notification-list').innerHTML=rules.map((rule,index)=>`<div class="config-notification-row" data-rule-id="${escapeHtml(rule.id||`notice-${index+1}`)}"><label class="field-label">Mốc<select data-rule-anchor aria-label="Mốc tính thông báo"><option value="start" ${rule.anchor==='start'?'selected':''}>Giờ bắt đầu</option><option value="end" ${rule.anchor==='end'?'selected':''}>Giờ kết thúc</option></select></label><label class="field-label">Lệch phút<input data-rule-offset type="number" value="${Number(rule.offsetMinutes)||0}" aria-label="Số phút lệch mốc" /></label><label class="field-label">Tiêu đề<input data-rule-title required value="${escapeHtml(rule.title||'')}" placeholder="Ví dụ: Thu BTVN" /></label><label class="field-label">Nội dung<input data-rule-body value="${escapeHtml(rule.body||'')}" placeholder="Việc cần nhắc" /></label><button type="button" class="remove-config-notification" data-remove-notification="${index}" aria-label="Xóa mốc">×</button></div>`).join('')||'<div class="notification-config-empty">Chưa có mốc thông báo. Thêm mốc nếu lớp cần nhắc tự động.</div>';}
function openClassConfig(id=''){
  const item=classCatalog.find(row=>row.id===id);
  $('#class-config-title').textContent=item?'Chỉnh sửa lớp':'Thêm lớp học';
  $('#config-class-id').value=item?.id||'';
  $('#config-class-name').value=item?.name||'';
  if($('#config-class-code'))$('#config-class-code').value=item?.code||(item?.id?item.id.replace(/^class-/,'').toUpperCase().replace(/[^A-Z0-9]/g,''):'');
  if($('#config-class-grade'))$('#config-class-grade').value=normalizeGradeToBirthYear(item?.grade||'2013');
  renderMasterDataChoices(item);
  $('#config-class-weekday').value=String(item?.weekday??1);
  $('#config-class-start').value=item?.startTime||'15:30';
  $('#config-class-end').value=item?.endTime||'17:00';
  $('#config-class-room').value=item?.room||'';
  const counts=item?layoutCounts(item):[3,3,2];
  $('#config-layout-aisles').value=counts.length;
  $('#config-layout-desks').value=counts.join(', ');
  if($('#config-layout-dividers')){
    const divIndices = [];
    (item?.defaultLayout?.[0]?.desks || []).forEach((d, idx) => {
      if (d.dividerAfter) divIndices.push(idx + 1);
    });
    $('#config-layout-dividers').value = divIndices.length ? divIndices.join(', ') : '2';
  }
  $('#config-start-checklist').value=(item?.defaultChecklist.startItems||[]).join('\n');
  $('#config-end-checklist').value=(item?.defaultChecklist.endItems||[]).join('\n');
  renderConfigNotifications(item?.defaultNotifications||[]);
  $('#class-config-dialog').showModal();
}
$('#add-class-button').onclick=()=>openClassConfig();$('#close-class-config').onclick=()=>$('#class-config-dialog').close();$('#cancel-class-config').onclick=()=>$('#class-config-dialog').close();
function addSelectedEmployee(role){const select=role==='teacher'?$('#config-teacher-choice'):role==='office'?$('#config-office-choice'):$('#config-assistant-choice'),ids=role==='teacher'?selectedTeacherIds:role==='office'?selectedOfficeIds:selectedAssistantIds;if(select.value&&!ids.includes(select.value))ids.push(select.value);select.value='';renderStaffSelection();renderEmployeeOptions(select,role,ids);}
$('#add-config-teacher').onclick=()=>addSelectedEmployee('teacher');$('#add-config-assistant').onclick=()=>addSelectedEmployee('assistant');$('#add-config-office').onclick=()=>addSelectedEmployee('office');document.querySelector('.staff-picker').parentElement.addEventListener('click',event=>{const button=event.target.closest('[data-remove-staff]');if(!button)return;const ids=button.dataset.staffRole==='teacher'?selectedTeacherIds:button.dataset.staffRole==='office'?selectedOfficeIds:selectedAssistantIds;const index=ids.indexOf(button.dataset.removeStaff);if(index>=0)ids.splice(index,1);renderStaffSelection();renderEmployeeOptions(button.dataset.staffRole==='teacher'?$('#config-teacher-choice'):button.dataset.staffRole==='office'?$('#config-office-choice'):$('#config-assistant-choice'),button.dataset.staffRole,ids);});
$('#add-config-notification').onclick=()=>{const rules=readConfigNotifications();rules.push({id:`rule-${Date.now()}`,anchor:'start',offsetMinutes:0,title:'Thông báo mới',body:''});renderConfigNotifications(rules);};$('#config-notification-list').addEventListener('click',event=>{const remove=event.target.closest('[data-remove-notification]');if(!remove)return;const rules=readConfigNotifications();rules.splice(Number(remove.dataset.removeNotification),1);renderConfigNotifications(rules);});
$('#class-config-form').addEventListener('submit',event=>{event.preventDefault();const id=$('#config-class-id').value||`class-${Date.now().toString(36)}`,counts=$('#config-layout-desks').value.split(',').map(value=>Math.max(1,Math.min(30,Number(value.trim())||1))),aisles=Math.max(1,Math.min(8,Number($('#config-layout-aisles').value)||counts.length)),teacherIds=[...selectedTeacherIds],assistantIds=[...selectedAssistantIds],officeIds=[...selectedOfficeIds];if(!teacherIds.length||!assistantIds.length){toast('Chọn ít nhất một giáo viên và một trợ giảng phụ trách lớp.');return;}while(counts.length<aisles)counts.push(2);counts.length=aisles;const subject=masterData.subjects.find(item=>item.id===$('#config-class-subject').value),teachers=masterData.employees.filter(item=>teacherIds.includes(item.id)),assistants=masterData.employees.filter(item=>assistantIds.includes(item.id)),startItems=$('#config-start-checklist').value.split('\n').map(value=>value.trim()).filter(Boolean),endItems=$('#config-end-checklist').value.split('\n').map(value=>value.trim()).filter(Boolean),old=classCatalog.find(item=>item.id===id),code=($('#config-class-code')?.value||'').trim().toUpperCase(),grade=normalizeGradeToBirthYear(($('#config-class-grade')?.value||'2013').trim()),dividerSet=new Set(String($('#config-layout-dividers')?.value||'2').split(',').map(v=>Number(v.trim())).filter(n=>n>0)),classInfo={id,code,grade,name:$('#config-class-name').value.trim(),subjectId:subject?.id||'',subject:subject?.name||'',teacherIds,teacherId:teacherIds[0]||'',teacherName:teachers.map(item=>item.name).join(', '),assistantIds,officeIds,assistantName:assistants.map(item=>item.name).join(', '),weekday:Number($('#config-class-weekday').value),startTime:$('#config-class-start').value,endTime:$('#config-class-end').value,room:$('#config-class-room').value.trim(),defaultLayout:counts.map((count,row)=>({id:`${id}-aisle-${row+1}`,desks:Array.from({length:count},(_,desk)=>({id:`${id}-desk-${row+1}-${desk+1}`,seats:2,dividerAfter:dividerSet.has(desk+1)&&desk<count-1}))})),defaultChecklist:{startItems,endItems},defaultNotifications:readConfigNotifications()};if(old)classCatalog=classCatalog.map(item=>item.id===id?classInfo:item);else classCatalog.push(classInfo);saveClassCatalog(classCatalog);$('#class-config-dialog').close();renderMainMenu();if($('#class-general-view')&&!$('#class-general-view').hidden){renderClassGeneralView(classInfo.id);}if($('#class-workspace')&&!$('#class-workspace').hidden){showClassWorkspace();}toast(old?'Đã cập nhật cấu hình lớp.':'Đã thêm lớp học.');});
// initial query will run after setupFeatures
let liveClassSortKey = 'name';
let liveClassSortOrder = 'asc';
let selectedLiveClassStudentIds = new Set();

function renderStudentList(){
  const host=$('#student-list-items'),makeupHost=$('#makeup-list-items');if(!host)return;
  if (makeupHost) {
    makeupHost.innerHTML = '';
    const makeupSec = makeupHost.closest('.makeup-roster-section');
    if (makeupSec) makeupSec.hidden = true;
  }
  const placements=new Map(allEntries().filter(({entry})=>entry.studentId).map(place=>[place.entry.studentId,place]));
  const lateIds=new Set(lateQueue);
  const byGivenName=(a,b)=>{const aGiven=a.givenName||splitStudentName(a.name).givenName,bGiven=b.givenName||splitStudentName(b.name).givenName,aFamily=a.familyName||splitStudentName(a.name).familyName,bFamily=b.familyName||splitStudentName(b.name).familyName;return aGiven.localeCompare(bGiven,'vi')||aFamily.localeCompare(bFamily,'vi');};
  const roster=classStudents();
  const classMakeups=makeupStudents.filter(student=>student.attendingClassId===CURRENT_CLASS_ID||placements.has(student.id)||lateIds.has(student.id));

  const buildRecord=(student, idx, isMakeupRow = false)=>{
    const id=student.id;
    const place=placements.get(id);
    const desk=place&&desks().find(item=>item.desk.id===place.deskId);
    const inLate=lateIds.has(id);
    const attHist=(student.attendanceHistory||[]).find(h=>h.classId===CURRENT_CLASS_ID&&h.date===checklistDate);
    const sessNote=(student.sessionNotes||[]).find(n=>n.classId===CURRENT_CLASS_ID&&n.date===checklistDate);

    const attendance = place?.entry.attendance
      || (inLate ? (student.attendance || { status: 'late', lateMinutes: 10 }) : null)
      || (attHist ? { status: attHist.status, reason: attHist.reason, lateMinutes: attHist.lateMinutes || attHist.minutesLate || 10 } : null);

    const homework = place?.entry.homework
      || (inLate && student.homework ? student.homework : null)
      || (sessNote?.homeworkStatus ? { status: sessNote.homeworkStatus, score: sessNote.homeworkScore ?? null, reason: sessNote.homeworkReason || '' } : null)
      || { status: 'uncollected' };

    const seat = desk ? `Dãy ${desk.ci+1} · Bàn ${desk.di+1}` : (inLate ? 'Khu vực đến muộn' : 'Chưa xếp chỗ');
    const testScore = place?.entry.testScore ?? checklist.testScores?.[id] ?? student.testScore ?? null;
    const note = sessionNoteFor(id) || '';
    const parts = splitStudentName(student.name);
    const familyName = student.familyName ?? parts.familyName;
    const givenName = student.givenName ?? parts.givenName;

    return { student, familyName, givenName, isMakeupRow: isMakeupRow || student.studentType === 'makeup', originalIndex: idx + 1, attendance, homework, seat, testScore, note };
  };

  const records=roster.map((s, idx)=>buildRecord(s, idx, false));
  const makeupRecords=classMakeups.map((s, idx)=>buildRecord(s, idx, true));
  const allSessionRecords=[...records, ...makeupRecords];

  const present=allSessionRecords.filter(r=>r.attendance?.status==='present').length;
  const late=allSessionRecords.filter(r=>r.attendance?.status==='late').length;
  const absent=records.filter(r=>r.attendance?.status==='absent'||r.attendance?.status==='absent_excused'||r.attendance?.status==='absent_unexcused').length;
  const noHomework=allSessionRecords.filter(r=>r.homework.status==='not_submitted').length;

  $('#session-student-total').textContent=`${records.length} học sinh${makeupRecords.length ? ` (+${makeupRecords.length} học bù)` : ''}`;
  if ($('#list-present-count')) $('#list-present-count').textContent=present;
  if ($('#list-late-count')) $('#list-late-count').textContent=late;
  if ($('#list-absent-count')) $('#list-absent-count').textContent=absent;
  if ($('#list-homework-count')) $('#list-homework-count').textContent=noHomework;

  if (document.activeElement && host.contains(document.activeElement) && document.activeElement.matches('[data-session-note]')) {
    return;
  }

  const query=$('#student-list-search').value.trim(),filter=$('#student-list-filter').value;
  const filterAndSort = (list) => {
    let items = [...list];
    if(query){
      const ranked=searchStudents(items.map(record=>record.student),query),order=new Map(ranked.map((student,index)=>[student.id,index]));
      items=items.filter(record=>order.has(record.student.id)).sort((a,b)=>order.get(a.student.id)-order.get(b.student.id));
    }
    if(filter==='present')items=items.filter(r=>r.attendance?.status==='present');
    if(filter==='late')items=items.filter(r=>r.attendance?.status==='late');
    if(filter==='absent')items=items.filter(r=>r.attendance?.status==='absent'||r.attendance?.status==='absent_excused'||r.attendance?.status==='absent_unexcused');
    if(filter==='unmarked')items=items.filter(r=>!r.attendance?.status);
    if(filter==='homework')items=items.filter(r=>r.homework.status==='not_submitted');
    if(filter==='makeup')items=items.filter(r=>r.isMakeupRow);

    items.sort((a, b) => {
      let cmp = 0;
      if (liveClassSortKey === 'family') {
        cmp = (a.familyName || '').localeCompare(b.familyName || '', 'vi') || (a.givenName || '').localeCompare(b.givenName || '', 'vi');
      } else if (liveClassSortKey === 'name') {
        cmp = byGivenName(a.student, b.student);
      } else if (liveClassSortKey === 'school') {
        cmp = (a.student.school || a.student.sourceClassName || '').localeCompare(b.student.school || b.student.sourceClassName || '', 'vi');
      } else if (liveClassSortKey === 'seat') {
        cmp = (a.seat || '').localeCompare(b.seat || '', 'vi');
      } else if (liveClassSortKey === 'attendance') {
        const attOrder = { present: 1, late: 2, absent_excused: 3, absent_unexcused: 4, absent: 5 };
        cmp = (attOrder[a.attendance?.status] || 99) - (attOrder[b.attendance?.status] || 99);
      } else if (liveClassSortKey === 'homework') {
        const hwOrder = { graded: 1, submitted: 2, uncollected: 3, not_submitted: 4 };
        cmp = (hwOrder[a.homework?.status] || 99) - (hwOrder[b.homework?.status] || 99);
      } else if (liveClassSortKey === 'score') {
        const aSc = a.homework?.score ?? a.testScore ?? -1;
        const bSc = b.homework?.score ?? b.testScore ?? -1;
        cmp = aSc - bSc;
      } else if (liveClassSortKey === 'note') {
        cmp = (a.note || '').localeCompare(b.note || '', 'vi');
      } else {
        cmp = a.originalIndex - b.originalIndex;
      }
      return liveClassSortOrder === 'desc' ? -cmp : cmp;
    });
    return items;
  };

  // Makeup students are always placed at the bottom of the main table
  const visibleRegular = filter === 'makeup' ? [] : filterAndSort(records);
  const visibleMakeup = filterAndSort(makeupRecords);
  const visible = [...visibleRegular, ...visibleMakeup];

  const renderUnifiedTable = (items) => {
    if (!items.length) {
      return `<div class="empty-list">${allSessionRecords.length ? 'Không có học sinh phù hợp với bộ lọc.' : 'Danh sách lớp hiện chưa có hồ sơ học sinh.'}</div>`;
    }
    const sortIcon = (key) => liveClassSortKey === key ? (liveClassSortOrder === 'asc' ? '▲' : '▼') : '⇅';
    const sortClass = (key) => liveClassSortKey === key ? (liveClassSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';

    const bulkBarHtml = `
      <div id="live-student-bulk-bar" class="bulk-actions-bar" ${selectedLiveClassStudentIds.size ? '' : 'hidden'} style="margin-bottom:10px;">
        <div class="bulk-actions-info">
          <span>Đã chọn <strong id="live-student-bulk-count">${selectedLiveClassStudentIds.size}</strong> học sinh:</span>
        </div>
        <div class="bulk-actions-buttons">
          <button type="button" class="outline-button" id="live-bulk-add-tag">🏷 Thêm tag</button>
          <button type="button" class="outline-button" id="live-bulk-remove-tag">🏷 Xóa tag</button>
          <button type="button" class="outline-button" id="live-bulk-add-class">➕ Thêm vào lớp khác</button>
          <button type="button" class="outline-button" id="live-bulk-move-class">🔄 Chuyển lớp</button>
          <button type="button" class="outline-button text-danger" id="live-bulk-remove-class">✕ Bỏ khỏi lớp</button>
          <button type="button" class="outline-button" id="live-bulk-clear">✕ Bỏ chọn</button>
        </div>
      </div>
    `;

    return `
      ${bulkBarHtml}
      <div class="attendance-table-wrap">
        <table class="attendance-report-table" style="font-size:10.5px;">
          <thead>
            <tr>
              <th style="width:30px; text-align:center;"><input type="checkbox" id="live-student-select-all" ${visibleRegular.length && visibleRegular.every(i => selectedLiveClassStudentIds.has(i.student.id)) ? 'checked' : ''} title="Chọn tất cả" /></th>
              <th class="sortable-th ${sortClass('family')}" data-live-sort="family">Họ đệm <span class="sort-icon">${sortIcon('family')}</span></th>
              <th class="sortable-th ${sortClass('name')}" data-live-sort="name">Tên <span class="sort-icon">${sortIcon('name')}</span></th>
              <th class="sortable-th ${sortClass('school')}" data-live-sort="school">Trường / Phân loại <span class="sort-icon">${sortIcon('school')}</span></th>
              <th class="sortable-th ${sortClass('seat')}" data-live-sort="seat">Vị trí ngồi <span class="sort-icon">${sortIcon('seat')}</span></th>
              <th class="sortable-th ${sortClass('attendance')}" data-live-sort="attendance">Tình trạng điểm danh <span class="sort-icon">${sortIcon('attendance')}</span></th>
              <th class="sortable-th ${sortClass('homework')}" data-live-sort="homework">Tình trạng BTVN <span class="sort-icon">${sortIcon('homework')}</span></th>
              <th style="width:85px; text-align:center;" class="sortable-th ${sortClass('score')}" data-live-sort="score">Điểm số <span class="sort-icon">${sortIcon('score')}</span></th>
              <th class="sortable-th ${sortClass('note')}" data-live-sort="note">Ghi chú chung trong buổi <span class="sort-icon">${sortIcon('note')}</span></th>
              <th style="width:125px; text-align:center;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(({student, familyName, givenName, isMakeupRow, attendance, homework, seat, testScore, note}) => {
              const attStatus = attendance?.status;
              const statusBadge = attStatus === 'present'
                ? '<span class="student-state state-present">✓ Có mặt</span>'
                : attStatus === 'late'
                  ? `<span class="student-state state-late">⏱ Đi muộn ${attendance?.lateMinutes ? `(${attendance.lateMinutes}p)` : ''}</span>`
                  : (attStatus === 'absent' || attStatus === 'absent_excused' || attStatus === 'absent_unexcused')
                    ? `<span class="student-state state-missing">× ${attStatus === 'absent_excused' ? 'Vắng có phép' : 'Vắng mặt'}</span>`
                    : '<span class="student-state state-pending">Chưa điểm danh</span>';

              const makeupStatePill = isMakeupRow
                ? `<span class="makeup-status-badge" title="Học sinh học bù ở cuối danh sách">🔄 Học bù${student.sourceClassName ? ` (${escapeHtml(student.sourceClassName)})` : ''}</span>`
                : '';

              const hwBadge = homework.status === 'not_submitted'
                ? `<span class="student-state state-missing">× Không nộp ${homework.reason ? `(${escapeHtml(homework.reason)})` : ''}</span>`
                : homework.status === 'submitted'
                  ? '<span class="student-state state-collected">✓ Đã thu BTVN</span>'
                  : homework.status === 'graded'
                    ? `<span class="student-state state-collected">✓ Đã chấm · ${escapeHtml(homework.score ?? '')}đ</span>`
                    : '<span class="student-state state-pending">· Chưa thu BTVN</span>';

              const scoreCell = (homework.score !== null && homework.score !== undefined) || (testScore !== null && testScore !== undefined)
                ? `${homework.score !== null && homework.score !== undefined ? `BTVN: <strong>${homework.score}đ</strong> ` : ''}${testScore !== null && testScore !== undefined ? `Test: <strong style="color:#6d28d9;">${testScore}đ</strong>` : ''}`
                : '<small style="color:#a8b4aa;">—</small>';

              const schoolLabel = isMakeupRow
                ? `Học Bù (${student.sourceClassName || student.school || 'T2'})`
                : (student.school || '—');

              return `
                <tr class="${isMakeupRow ? 'makeup-row-tr' : ''}">
                  <td style="text-align:center;">
                    ${!isMakeupRow ? `<input type="checkbox" class="live-student-cb" data-student-id="${escapeHtml(student.id)}" ${selectedLiveClassStudentIds.has(student.id) ? 'checked' : ''} />` : '<span title="Học sinh học bù">🔄</span>'}
                  </td>
                  <td>
                    <button type="button" data-open-student-profile="${escapeHtml(student.id)}" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font:inherit; color:#395140;">
                      ${escapeHtml(familyName || '—')}
                    </button>
                  </td>
                  <td>
                    <button type="button" data-open-student-profile="${escapeHtml(student.id)}" style="background:none; border:none; padding:0; cursor:pointer; text-align:left; font:inherit;">
                      <strong style="color:${isMakeupRow ? '#581c87' : '#214e2d'};">${escapeHtml(givenName || student.name)}</strong>
                      ${makeupStatePill}
                      ${renderInlineTags(student)}
                    </button>
                  </td>
                  <td>${escapeHtml(schoolLabel)}</td>
                  <td>
                    <span class="room-chip" style="font-size:8.5px;">${escapeHtml(seat)}</span>
                  </td>
                  <td>${statusBadge}${isMakeupRow ? ' <span class="makeup-status-badge">Học bù</span>' : ''}</td>
                  <td>${hwBadge}</td>
                  <td style="text-align:center;">${scoreCell}</td>
                  <td>
                    <input class="attendance-note-input" data-session-note="${escapeHtml(student.id)}" aria-label="Ghi chú chung cho ${escapeHtml(student.name)}" placeholder="Nhập ghi chú buổi học..." value="${escapeHtml(note)}" style="width:100%; min-width:130px;" />
                  </td>
                  <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="outline-button find-seat-btn" data-find-seat-student="${escapeHtml(student.id)}" title="Mở sơ đồ lớp và tìm nhanh chỗ ngồi học sinh này">🗺 Tìm chỗ</button>
                    <button type="button" class="outline-button" data-open-student-profile="${escapeHtml(student.id)}" style="padding:3px 7px; font-size:9px; margin-left:3px;">Hồ sơ ↗</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  host.innerHTML = renderUnifiedTable(visible);

  // Wire sort headers in #student-list-items
  host.querySelectorAll('th[data-live-sort]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.liveSort;
      if (liveClassSortKey === key) {
        liveClassSortOrder = liveClassSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        liveClassSortKey = key;
        liveClassSortOrder = 'asc';
      }
      renderStudentList();
    };
  });

  // Wire checkboxes & bulk actions in #student-list-items
  host.querySelectorAll('.live-student-cb').forEach(cb => {
    cb.onchange = () => {
      if (cb.checked) selectedLiveClassStudentIds.add(cb.dataset.studentId);
      else selectedLiveClassStudentIds.delete(cb.dataset.studentId);
      renderStudentList();
    };
  });

  const selectAllLive = host.querySelector('#live-student-select-all');
  if (selectAllLive) {
    selectAllLive.onchange = () => {
      if (selectAllLive.checked) visibleRegular.forEach(item => selectedLiveClassStudentIds.add(item.student.id));
      else selectedLiveClassStudentIds.clear();
      renderStudentList();
    };
  }

  host.querySelector('#live-bulk-clear')?.addEventListener('click', () => {
    selectedLiveClassStudentIds.clear();
    renderStudentList();
  });

  host.querySelector('#live-bulk-add-tag')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    const tag = prompt('Nhập tên tag muốn thêm cho các học sinh đã chọn:');
    if (!tag || !tag.trim()) return;
    selectedLiveClassStudentIds.forEach(id => {
      const s = studentById(id);
      if (s) {
        s.tags = s.tags || [];
        if (!s.tags.includes(tag.trim())) s.tags.push(tag.trim());
      }
    });
    save();
    render();
    toast(`Đã thêm tag "${tag.trim()}" cho ${selectedLiveClassStudentIds.size} học sinh.`);
  });

  host.querySelector('#live-bulk-remove-tag')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    const tag = prompt('Nhập tên tag muốn xóa khỏi các học sinh đã chọn:');
    if (!tag || !tag.trim()) return;
    selectedLiveClassStudentIds.forEach(id => {
      const s = studentById(id);
      if (s && s.tags) s.tags = s.tags.filter(t => t !== tag.trim());
    });
    save();
    render();
    toast(`Đã xóa tag "${tag.trim()}" khỏi các học sinh đã chọn.`);
  });

  host.querySelector('#live-bulk-add-class')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    const otherClasses = (classCatalog || []).filter(c => c.id !== CURRENT_CLASS_ID);
    const optionsText = otherClasses.map((c, i) => `${i + 1}. [${c.code || c.id}] ${c.name}`).join('\n');
    const choice = prompt(`Chọn lớp muốn thêm vào (Nhập số thứ tự):\n${optionsText}`);
    const idx = Number(choice) - 1;
    if (isNaN(idx) || !otherClasses[idx]) return;
    const targetClass = otherClasses[idx];
    selectedLiveClassStudentIds.forEach(id => {
      const s = studentById(id);
      if (s) {
        s.classIds = s.classIds || [];
        if (!s.classIds.includes(targetClass.id)) s.classIds.push(targetClass.id);
      }
    });
    save();
    render();
    toast(`Đã thêm ${selectedLiveClassStudentIds.size} học sinh vào lớp ${targetClass.code || targetClass.name}.`);
  });

  host.querySelector('#live-bulk-move-class')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    const otherClasses = (classCatalog || []).filter(c => c.id !== CURRENT_CLASS_ID);
    const optionsText = otherClasses.map((c, i) => `${i + 1}. [${c.code || c.id}] ${c.name}`).join('\n');
    const choice = prompt(`Chuyển ${selectedLiveClassStudentIds.size} học sinh sang lớp nào? (Nhập số thứ tự):\n${optionsText}`);
    const idx = Number(choice) - 1;
    if (isNaN(idx) || !otherClasses[idx]) return;
    const targetClass = otherClasses[idx];
    selectedLiveClassStudentIds.forEach(id => {
      const s = studentById(id);
      if (s) {
        s.classIds = (s.classIds || []).filter(cid => cid !== CURRENT_CLASS_ID);
        if (!s.classIds.includes(targetClass.id)) s.classIds.push(targetClass.id);
      }
    });
    selectedLiveClassStudentIds.clear();
    save();
    render();
    toast(`Đã chuyển học sinh sang lớp ${targetClass.code || targetClass.name}.`);
  });

  host.querySelector('#live-bulk-remove-class')?.addEventListener('click', () => {
    if (!selectedLiveClassStudentIds.size) return;
    if (!confirm(`Xác nhận bỏ ${selectedLiveClassStudentIds.size} học sinh đã chọn khỏi lớp này?`)) return;
    selectedLiveClassStudentIds.forEach(id => {
      const s = studentById(id);
      if (s) s.classIds = (s.classIds || []).filter(cid => cid !== CURRENT_CLASS_ID);
    });
    selectedLiveClassStudentIds.clear();
    save();
    render();
    toast('Đã bỏ học sinh đã chọn khỏi lớp.');
  });
}
$('#student-list-search').addEventListener('input',renderStudentList);$('#student-list-filter').addEventListener('change',renderStudentList);
function renderAttendanceExport(){
  const dateLabel = new Date(`${checklistDate}T00:00:00`).toLocaleDateString('vi-VN');
  const placements = new Map(allEntries().filter(({entry})=>entry.studentId).map(({entry})=>[entry.studentId,entry.attendance?.status||'present']));
  for(const id of lateQueue)placements.set(id,studentById(id)?.attendance?.status||'late');
  
  // Sort alphabetically by Vietnamese given name then family name
  const roster = [...classStudents()].sort((a,b)=>{
    const aGiven = a.givenName || splitStudentName(a.name).givenName;
    const bGiven = b.givenName || splitStudentName(b.name).givenName;
    const aFamily = a.familyName || splitStudentName(a.name).familyName;
    const bFamily = b.familyName || splitStudentName(b.name).familyName;
    return aGiven.localeCompare(bGiven,'vi') || aFamily.localeCompare(bFamily,'vi');
  });

  const mainRows = roster.map(student=>{
    const attendance = placements.get(student.id), status = attendance ? attendanceLabel(attendance) : 'Vắng';
    const fam = student.familyName || splitStudentName(student.name).familyName;
    const giv = student.givenName || splitStudentName(student.name).givenName;
    return `<tr><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong></td><td>${escapeHtml(student.studentCode || '—')}</td><td>${escapeHtml(student.school || '')}</td><td>${escapeHtml(status)}</td><td><input class="attendance-note-input" data-session-note="${escapeHtml(student.id)}" aria-label="Ghi chú chung cho ${escapeHtml(student.name)}" value="${escapeHtml(sessionNoteFor(student.id))}" /></td></tr>`;
  }).join('');

  const sessionMakeups = makeupStudents.filter(student=>student.attendingClassId===CURRENT_CLASS_ID&&(placements.has(student.id)||lateQueue.includes(student.id))).sort((a,b)=>{
    const aGiven = a.givenName || splitStudentName(a.name).givenName;
    const bGiven = b.givenName || splitStudentName(b.name).givenName;
    return aGiven.localeCompare(bGiven,'vi') || (a.familyName||'').localeCompare(b.familyName||'','vi');
  });

  const makeupRows = sessionMakeups.map(student=>{
    const fam = student.familyName || splitStudentName(student.name).familyName;
    const giv = student.givenName || splitStudentName(student.name).givenName;
    return `<tr><td>${escapeHtml(fam)}</td><td><strong>${escapeHtml(giv)}</strong></td><td>${escapeHtml(student.studentCode || '—')}</td><td>${escapeHtml(student.sourceClassName || '')}</td><td><input class="attendance-note-input" data-session-note="${escapeHtml(student.id)}" aria-label="Ghi chú chung cho học sinh học bù ${escapeHtml(student.name)}" value="${escapeHtml(sessionNoteFor(student.id))}" /></td></tr>`;
  }).join('');

  const curClass = activeClassConfig();
  $('#attendance-export-content').innerHTML = `
    <div class="attendance-report-heading">
      <strong>${escapeHtml(curClass.code || curClass.name)} · ${escapeHtml(curClass.name)}</strong>
      <span>Ngày học: ${escapeHtml(dateLabel)} · Phòng: ${escapeHtml(curClass.room || '—')}</span>
    </div>
    <h3>Danh sách chính · ${roster.length} học sinh (Xếp theo Alphabet)</h3>
    <div class="attendance-table-wrap">
      <table class="attendance-report-table">
        <thead>
          <tr>
            <th>Họ đệm</th>
            <th>Tên</th>
            <th>Mã HS</th>
            <th>Trường</th>
            <th>Điểm danh (${escapeHtml(dateLabel)})</th>
            <th>Ghi chú chung</th>
          </tr>
        </thead>
        <tbody>${mainRows || '<tr><td colspan="6">Lớp chưa có học sinh.</td></tr>'}</tbody>
      </table>
    </div>
    <h3 class="makeup-report-title">Học bù trong buổi này · ${sessionMakeups.length} học sinh</h3>
    <div class="attendance-table-wrap">
      <table class="attendance-report-table makeup-report-table">
        <thead>
          <tr>
            <th>Họ đệm</th>
            <th>Tên</th>
            <th>Mã HS</th>
            <th>Bù của lớp</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>${makeupRows || '<tr><td colspan="5">Không có học sinh học bù trong buổi này.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}
$('#export-attendance-button').onclick=()=>{renderAttendanceExport();$('#attendance-export-dialog').showModal();};
document.addEventListener('input',event=>{const input=event.target.closest('[data-session-note]');if(!input)return;saveSessionNote(input.dataset.sessionNote,input.value);});
$('#close-attendance-export').onclick=()=>$('#attendance-export-dialog').close();$('#close-attendance-export-secondary').onclick=()=>$('#attendance-export-dialog').close();$('#print-attendance-export').onclick=()=>window.print();
function profileDate(item){return item.date||new Date(item.timestamp||Date.now()).toLocaleDateString('vi-VN');}
function openStudentProfile(id, origin = null){
  const student=studentById(id);if(!student)return;activeProfileId=id;
  if(origin) previousStudentProfileOrigin = origin;
  const parts=splitStudentName(student.name),familyName=student.familyName??parts.familyName,givenName=student.givenName??parts.givenName;
  const classes=(student.classIds||[]).map(classId=>{
    const c=classCatalog.find(x=>x.id===classId);
    return c?`${c.code||c.name}`:classId;
  }).join(', ')||(student.studentType==='makeup'?`Học bù · ${student.sourceClassName||'chưa rõ lớp'}`:'Chưa gắn lớp');
  
  const classBadges=(student.classIds||[]).map(classId=>{
    const c=classCatalog.find(x=>x.id===classId);
    return `<span class="profile-chip" data-open-class-drilldown="${escapeHtml(classId)}" style="cursor:pointer; font-weight:700; color:#367950;" title="Bấm xem chi tiết học sinh tại lớp này">${escapeHtml(c?.code||classId)} ↗</span>`;
  }).join('')||`<span class="profile-chip">${escapeHtml(student.studentType==='makeup'?`Học bù · ${student.sourceClassName||'chưa rõ lớp'}`:'Chưa ghi nhận lớp')}</span>`;
  
  const tags=student.tags||[],tagBadges=tags.map(tag=>`<span class="profile-chip profile-tag-chip">${escapeHtml(tag)}</span>`).join('')||'<small>Chưa gắn tag</small>';
  const photo = student.photoURL;
  const attendance=student.attendanceHistory||student.history||[],seats=student.seatingHistory||[],scores=student.scores||[],generalNotes=[...(student.sessionNotes||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))),notes=Array.isArray(student.notes)?student.notes.join('\n'):student.notes||'';
  
  const portraitBlock = photo ? `
    <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
      <button type="button" id="student-photo-expand" class="profile-avatar-button" style="border:none; background:none; padding:0; cursor:pointer;" aria-label="Mở ảnh ${escapeHtml(student.name)} cỡ lớn">
        <img class="profile-portrait" id="profile-portrait-preview" src="${escapeHtml(photo)}" alt="Ảnh chân dung ${escapeHtml(student.name)}" />
      </button>
      <div style="display:flex; gap:4px; margin-top:2px;">
        <label class="primary-button" style="padding:4px 8px; font-size:9.5px; cursor:pointer; font-weight:600;">
          📷 Đổi ảnh
          <input type="file" id="profile-upload-portrait-input" accept="image/*" style="display:none;" />
        </label>
        <button type="button" id="profile-remove-photo-btn" class="outline-button text-danger" style="padding:4px 7px; font-size:9.5px;">Xóa</button>
      </div>
    </div>
  ` : `
    <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
      <div id="profile-portrait-preview" class="profile-portrait profile-portrait-placeholder">📷</div>
      <label class="primary-button" style="padding:5px 9px; font-size:10px; cursor:pointer; font-weight:600;">
        📷 Tải ảnh chân dung
        <input type="file" id="profile-upload-portrait-input" accept="image/*" style="display:none;" />
      </label>
    </div>
  `;

  const allAvailableClasses = [...classCatalog];
  if (!allAvailableClasses.some(c => c.id === 'class-tutoring')) {
    allAvailableClasses.push(TUTORING_CLASS_CONFIG);
  }

  let enrolledClassIds = [...(student.classIds || [])];

  $('#student-profile-content').innerHTML=`<div class="profile-header">${portraitBlock}<div><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.studentType==='makeup'?`Học sinh học bù từ ${student.sourceClassName||'lớp chưa rõ'}`:student.school||'Chưa có trường')}</small><small>${escapeHtml(classes)}</small></div></div><div class="profile-membership-grid"><section class="profile-data-group"><h3>Các lớp đang học (Bấm để xem chi tiết theo lớp)</h3><div class="profile-chip-list">${classBadges}</div></section><section class="profile-data-group"><h3>Tag đã gắn</h3><div class="profile-chip-list">${tagBadges}</div></section></div><div class="profile-edit-grid"><label class="field-label">Họ và tên đệm<input id="profile-family-name" value="${escapeHtml(familyName)}" /></label><label class="field-label">Tên<input id="profile-given-name" value="${escapeHtml(givenName)}" /></label><label class="field-label">Trường<input id="profile-school" value="${escapeHtml(student.school||'')}" /></label><label class="field-label">Mã học sinh<input id="profile-code" value="${escapeHtml(student.studentCode||'')}" placeholder="Ví dụ: K09.3049" style="text-transform:uppercase;" /></label><label class="field-label">Tên phụ huynh<input id="profile-parent-name" value="${escapeHtml(student.parentContact?.name||'')}" /></label><label class="field-label">Số điện thoại phụ huynh<input id="profile-parent-phone" type="tel" value="${escapeHtml(student.parentContact?.phone||'')}" /></label><div class="field-label profile-wide"><span>Các lớp đang theo học:</span><div id="profile-enrolled-classes-wrap" style="margin-top:6px; padding:10px; background:#fbfdfb; border:1px solid #dce5dd; border-radius:8px;"></div></div><label class="field-label profile-wide">Tag phân loại (phân tách bằng dấu phẩy)<input id="profile-tags" value="${escapeHtml(tags.join(', '))}" placeholder="Ví dụ: Mới, Cần chú ý, HS Giỏi, Mục tiêu 9+" /></label><label class="field-label profile-wide">Ghi chú chung học lực & thông tin học sinh<textarea id="profile-learning-notes" rows="3" placeholder="Ghi chú về học lực, nề nếp, đặc điểm của học sinh...">${escapeHtml(student.learningNotes||notes)}</textarea></label><label class="field-label profile-wide">Link ảnh chân dung (hoặc tải trực tiếp ở trên)<input id="profile-photo-url" value="${escapeHtml(student.photoURL||'')}" placeholder="https://... hoặc data:image/..." /></label></div>`;

  function renderEnrolledClassesUI() {
    const wrap = $('#profile-enrolled-classes-wrap');
    if (!wrap) return;

    const chipsHtml = enrolledClassIds.map(cid => {
      const c = allAvailableClasses.find(x => x.id === cid) || { id: cid, code: cid, name: cid };
      return `
        <span class="profile-class-chip" data-class-chip="${escapeHtml(cid)}">
          🏷 <strong>${escapeHtml(c.code || c.name)}</strong>
          <small style="color:#56695b; font-weight:400;">(${escapeHtml(c.grade ? formatBirthYearInline(c.grade) : c.name)})</small>
          <button type="button" data-remove-class-chip="${escapeHtml(cid)}" title="Xóa lớp này khỏi học sinh">×</button>
        </span>
      `;
    }).join('') || '<small style="color:#8a998c; font-style:italic;">Chưa gắn lớp nào</small>';

    const availableToAdd = allAvailableClasses.filter(c => !enrolledClassIds.includes(c.id));
    const addOptionsHtml = availableToAdd.map(c => `
      <option value="${escapeHtml(c.id)}">[${escapeHtml(c.code || c.id)}] ${escapeHtml(c.name)} (${c.grade ? formatBirthYearInline(c.grade) : 'Bổ trợ'})</option>
    `).join('');

    const pickerHtml = availableToAdd.length ? `
      <div style="display:inline-flex; align-items:center; gap:6px; margin-top:8px;">
        <select id="profile-class-to-add-select" style="padding:4px 8px; font-size:11px; border:1px solid #cbd8cd; border-radius:6px; background:#fff; outline:none;">
          ${addOptionsHtml}
        </select>
        <button type="button" id="profile-btn-add-class" class="primary-button" style="padding:4px 10px; font-size:10px; font-weight:700;">＋ Thêm lớp</button>
      </div>
    ` : '<small style="color:#5b7760; font-weight:600; display:block; margin-top:6px;">(Đã gắn tất cả các lớp)</small>';

    wrap.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:4px;">
        ${chipsHtml}
      </div>
      ${pickerHtml}
    `;

    wrap.querySelectorAll('[data-remove-class-chip]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const cid = btn.dataset.removeClassChip;
        enrolledClassIds = enrolledClassIds.filter(id => id !== cid);
        renderEnrolledClassesUI();
      };
    });

    const addBtn = wrap.querySelector('#profile-btn-add-class');
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.preventDefault();
        const select = wrap.querySelector('#profile-class-to-add-select');
        const selectedClassId = select?.value;
        if (selectedClassId && !enrolledClassIds.includes(selectedClassId)) {
          enrolledClassIds.push(selectedClassId);
          renderEnrolledClassesUI();
        }
      };
    }
  }

  renderEnrolledClassesUI();

  const uploadInput = $('#profile-upload-portrait-input');
  if (uploadInput) {
    uploadInput.onchange = (e) => {
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
        saveStudentRecords(students, makeupStudents);
        save();
        render();
        toast('Đã cập nhật ảnh chân dung học sinh thành công.');
        openStudentProfile(student.id, origin);
      };
      reader.readAsDataURL(file);
    };
  }

  const removePhotoBtn = $('#profile-remove-photo-btn');
  if (removePhotoBtn) {
    removePhotoBtn.onclick = () => {
      if (!confirm('Bạn có chắc muốn xóa ảnh chân dung này?')) return;
      student.photoURL = null;
      saveStudentRecords(students, makeupStudents);
      save();
      render();
      toast('Đã xóa ảnh chân dung.');
      openStudentProfile(student.id, origin);
    };
  }

  $('#student-profile-dialog').showModal();
}
function openStudentPhoto(id){const student=studentById(id),photo=safeHttpUrl(student?.photoURL);if(!student||!photo){toast('Học sinh chưa có ảnh đại diện.');return;}$('#student-photo-full').src=photo;$('#student-photo-full').alt=`Ảnh ${student.name}`;$('#student-photo-caption').textContent=student.name;$('#student-photo-dialog').showModal();}
$('#student-profile-content').addEventListener('click',e=>{
  const drilldown = e.target.closest('[data-open-class-drilldown]');
  if (drilldown && window.__featuresApp?.openStudentClassProfile) {
    $('#student-profile-dialog')?.close();
    window.__featuresApp.openStudentClassProfile(activeProfileId, drilldown.dataset.openClassDrilldown);
    return;
  }if(e.target.closest('#student-photo-expand'))openStudentPhoto(activeProfileId);});$('#student-list-items').addEventListener('click',e=>{const row=e.target.closest('[data-open-student-profile]');if(row)openStudentProfile(row.dataset.openStudentProfile);});$('#makeup-list-items')?.addEventListener('click',e=>{const row=e.target.closest('[data-open-student-profile]');if(row)openStudentProfile(row.dataset.openStudentProfile);});
const closeStudentProfile=()=>{
  $('#student-profile-dialog').close();
  const origin = previousStudentProfileOrigin;
  previousStudentProfileOrigin = null;
  if (origin?.from === 'class-profile') {
    if (window.__featuresApp?.openStudentClassProfile) {
      window.__featuresApp.openStudentClassProfile(activeProfileId, origin.classId);
    }
  } else if (origin?.from === 'directory') {
    $('#student-directory-dialog')?.showModal();
  }
};
$('#close-student-profile').onclick=closeStudentProfile;
$('#close-student-profile-secondary').onclick=closeStudentProfile;
$('#close-student-photo').onclick=()=>$('#student-photo-dialog').close();

$('#save-student-profile').onclick=()=>{
  const student=studentById(activeProfileId);
  if(!student)return;
  const familyName=$('#profile-family-name').value.trim(),
        givenName=$('#profile-given-name').value.trim(),
        name=[familyName,givenName].filter(Boolean).join(' '),
        photoValue=$('#profile-photo-url').value.trim();

  let photo = null;
  if (photoValue) {
    if (photoValue.startsWith('data:image/')) {
      photo = photoValue;
    } else {
      photo = safeHttpUrl(photoValue);
      if (!photo) {
        toast('Link ảnh cần bắt đầu bằng http:// hoặc https:// (hoặc tải trực tiếp từ máy tính).');
        $('#profile-photo-url').focus();
        return;
      }
    }
  }

  if(!name){
    toast('Hãy nhập họ tên học sinh.');
    $('#profile-given-name').focus();
    return;
  }

  const rawCode = $('#profile-code').value.trim();
  student.studentCode = rawCode ? rawCode.toUpperCase() : null;
  student.familyName = familyName;
  student.givenName = givenName;
  student.name = name;
  student.school = $('#profile-school').value.trim();
  student.parentContact = {
    name: $('#profile-parent-name').value.trim(),
    phone: $('#profile-parent-phone').value.trim()
  };

  if (typeof enrolledClassIds !== 'undefined') {
    student.classIds = enrolledClassIds.length ? enrolledClassIds : (student.classIds || []);
  }

  student.tags = [...new Set($('#profile-tags').value.split(',').map(tag=>tag.trim()).filter(Boolean))];
  student.photoURL = photo || null;
  student.learningNotes = $('#profile-learning-notes').value.trim();

  saveStudentRecords(students, makeupStudents);
  save();
  render();
  $('#student-profile-dialog').close();

  const origin = previousStudentProfileOrigin;
  previousStudentProfileOrigin = null;

  if (origin?.from === 'class-profile') {
    if (window.__featuresApp?.openStudentClassProfile) {
      window.__featuresApp.openStudentClassProfile(student.id, origin.classId);
    }
  } else if (origin?.from === 'directory') {
    if (window.__featuresApp?.renderMasterStudentDirectory) {
      window.__featuresApp.renderMasterStudentDirectory();
      $('#student-directory-dialog')?.showModal();
    }
  } else if (origin?.from === 'class-general') {
    if (renderClassGeneralView) {
      renderClassGeneralView(origin.classId);
    }
  }

  toast('Đã lưu thông tin học sinh.');
};
function render(){
  const isNoHwActive = Boolean(window.__featuresApp?.isNoHomeworkSession?.());
  for(const {desk} of desks())deskItems[desk.id]??=[];
  const occupants=allEntries();

  const classroomWrap = document.querySelector('.classroom-wrap');
  if (classroomWrap) {
    classroomWrap.classList.toggle('teacher-view-wrap', isTeacherView);
    const boardLabel = classroomWrap.querySelector('.board-label');
    if (boardLabel) {
      boardLabel.innerHTML = isTeacherView 
        ? '<span></span>BẢNG VIẾT · BỤC GIẢNG (Góc nhìn Giáo viên từ bục giảng nhìn xuống)' 
        : '<span></span>BẢNG · ĐẦU LỚP';
    }
    const backSpan = classroomWrap.querySelector('.back-of-room > span');
    if (backSpan) {
      backSpan.textContent = isTeacherView ? 'CUỐI LỚP (Phía xa bục giảng)' : 'CUỐI LỚP';
    }
  }

  const displayLayout = isTeacherView 
    ? [...layout].reverse().map(aisle => ({
        ...aisle,
        desks: [...aisle.desks].reverse()
      }))
    : layout;

  const teacherNotice = $('#teacher-view-notice');
  if (teacherNotice) teacherNotice.hidden = !isTeacherView;

  const mapSearchQuery = normalizeSearchText($('#seating-map-search-input')?.value || '');

  classroom.innerHTML=displayLayout.map((aisle,ci)=>{
    const maxOccupants=Math.max(1,...aisle.desks.map(d=>(deskItems[d.id]||[]).length)),
          aisleWidth=Math.max(148,24+maxOccupants*80),
          studentWidth=Math.floor((aisleWidth-24-(maxOccupants-1)*5)/maxOccupants);
    const origAisleIdx = isTeacherView ? (layout.length - 1 - ci) : ci;
    const sideLabel = isTeacherView ? (ci < displayLayout.length / 2 ? ' (Tay phải GV)' : ' (Tay trái GV)') : '';

    return `<div class="desk-row" style="--aisle-width:${aisleWidth}px;--max-occupants:${maxOccupants};--student-width:${studentWidth}px">
      <div class="row-label">
        <span>DÃY ${origAisleIdx+1}${sideLabel}</span>
        <button type="button" class="row-collect-hw-btn" data-collect-aisle="${origAisleIdx}" title="Thu BTVN cả dãy ${origAisleIdx+1}">📥 Thu BTVN</button>
      </div>
      <div class="desks">${aisle.desks.map((desk, di)=>{
        const list=deskItems[desk.id]||[];
        const displayList = isTeacherView ? [...list].reverse() : list;
        const addBtnHtml = isSeatingEditMode 
          ? `<button type="button" class="desk-add-compact-btn" data-add-to-desk="${desk.id}" title="Thêm học sinh vào bàn này">＋</button>`
          : '';

        const seatsHtml = displayList.length ? displayList.map((entry,idx)=>{
          const origIndex = isTeacherView ? (list.length - 1 - idx) : idx;
          const student=studentById(entry.studentId),
                hw=entry.homework||student?.homework,
                att=entry.attendance||student?.attendance;
          const isMakeupStudent = Boolean(student && (student.studentType === 'makeup' || !(student.classIds || []).includes(CURRENT_CLASS_ID)));
          const isUncollectedWarn = Boolean(!isNoHwActive && student && (!hw || hw.status === 'uncollected'));
          const prevHistory = (student?.attendanceHistory || []).find(h => h.date !== checklistDate);
          const isDebtWarn = Boolean(!isNoHwActive && prevHistory?.homework && prevHistory.homework.status === 'not_submitted');
          const warnClass = isUncollectedWarn ? 'seat-uncollected-warn' : (isDebtWarn ? 'seat-debt-warn' : '');
          const warnTag = isUncollectedWarn ? '<span class="seat-warning-tag warn-uncollected" title="Chưa thu BTVN buổi này">⚠</span>' : (isDebtWarn ? '<span class="seat-warning-tag warn-debt" title="Nợ BTVN buổi trước">!</span>' : '');
          const makeupBadgeHtml = isMakeupStudent ? '<span class="makeup-seat-badge" title="Học sinh học bù">🔄 BÙ</span>' : '';
          const isSearchMatch = Boolean(mapSearchQuery && student && normalizeSearchText(`${student.name} ${student.studentCode || ''} ${(student.tags || []).join(' ')}`).includes(mapSearchQuery));
          return `<button class="seat occupied seat-token ${student?'seat-named':'seat-anonymous'} ${isMakeupStudent?'seat-makeup':''} ${att?.status==='late'?'attendance-late':''} ${warnClass} ${isSearchMatch?'seat-search-match':''}" data-entry-index="${origIndex}" data-desk-id="${desk.id}" data-student-id="${escapeHtml(student?.id||'')}" aria-label="${student?`${student.name}${isMakeupStudent?' (Học bù)':''}; BTVN ${homeworkLabel(hw?.status)}; ${attendanceLabel(att?.status)}`:'Biểu tượng học sinh chưa ghi tên'}">${student?'':`<span class="seat-symbol">${studentIcon}</span>`}${student?`<span class="seat-name">${makeupBadgeHtml}${escapeHtml(student.name)}${renderInlineTags(student)}${warnTag}<span class="homework-mark ${homeworkClass(hw?.status)}" title="${homeworkLabel(hw?.status)}">${homeworkSymbol(hw)}</span></span>`:hw?.status&&hw.status!=='uncollected'?`<span class="homework-mark ${homeworkClass(hw.status)}" title="${homeworkLabel(hw.status)}">${homeworkSymbol(hw)}</span>`:''}</button>`;
        }).join('') : '<span class="seat-empty-text">Bàn trống</span>';

        const deskHtml = `<div class="desk" data-desk-id="${desk.id}">
          <div class="desk-seats">${seatsHtml}</div>
          ${addBtnHtml}
        </div>`;

        // Render desk divider between upper desk and lower desk
        let dividerHtml = '';
        if (di < aisle.desks.length - 1) {
          const origDividerDeskIdx = isTeacherView ? (aisle.desks.length - 2 - di) : di;
          const origDividerDesk = layout[origAisleIdx]?.desks?.[origDividerDeskIdx];
          const hasDivider = Boolean(origDividerDesk?.dividerAfter);
          const upperNum = origDividerDeskIdx + 1;
          const lowerNum = origDividerDeskIdx + 2;
          if (isSeatingEditMode) {
            dividerHtml = `<button type="button" class="desk-divider-slot ${hasDivider ? 'active' : ''}" data-toggle-divider-aisle="${origAisleIdx}" data-toggle-divider-desk="${origDividerDeskIdx}" title="Bấm để bật/tắt vạch phân cách giữa Bàn ${upperNum} và Bàn ${lowerNum}">
              <span class="divider-bar"></span>
              <span class="divider-pill">${hasDivider ? `━ PHÂN CÁCH BÀN ${upperNum} - ${lowerNum} ━` : '＋ Phân cách bàn'}</span>
            </button>`;
          } else if (hasDivider) {
            dividerHtml = `<div class="desk-divider-readonly" aria-label="Vạch phân cách bàn ${upperNum} và bàn ${lowerNum}">
              <span class="divider-bar"></span>
              <span class="divider-pill">━ BÀN ${upperNum} / BÀN ${lowerNum} ━</span>
            </div>`;
          }
        }

        return deskHtml + dividerHtml;
      }).join('')}</div>
    </div>`;
  }).join('');

  classroom.querySelectorAll('.row-collect-hw-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      collectAisleHomework(Number(btn.dataset.collectAisle));
    };
  });

  const named=occupants.filter(x=>x.entry.studentId),attended=named.filter(x=>x.entry.attendance||studentById(x.entry.studentId)?.attendance).length;
  const homeworkCounts={uncollected:0,not_submitted:0,submitted:0,graded:0};occupants.forEach(({entry})=>{const status=(entry.homework||studentById(entry.studentId)?.homework)?.status||'uncollected';homeworkCounts[status]=(homeworkCounts[status]||0)+1;});
  const rosterTotal = classStudents().length;
  $('#attendance-count').textContent=`${attended} / ${occupants.length}`;
  const countSub = $('#attendance-count-sub'); if (countSub) countSub.textContent = `đã điểm danh / vào chỗ (sĩ số ${rosterTotal})`;
  $('#remaining-count').textContent=`${occupants.length-attended} học sinh vào chỗ chưa điểm danh`;
  const roomTplPill = $('#room-template-pill'); if (roomTplPill) roomTplPill.textContent = configClass?.room || 'Phòng học';
  const isFin = Boolean(localStorage.getItem(`lopvui.finalized-session.v1.${CURRENT_CLASS_ID}.${checklistDate}`));
  const finalizedBadge = $('#finalized-indicator-badge'); if (finalizedBadge) finalizedBadge.hidden = !isFin;
  if (isNoHwActive) {
    $('#homework-count').textContent = '0';
    $('#homework-count-detail').textContent = 'Ca học này không có BTVN (Tự động/Đã chọn)';
  } else {
    $('#homework-count').textContent=homeworkCounts.not_submitted+homeworkCounts.submitted+homeworkCounts.graded;
    $('#homework-count-detail').textContent=`${homeworkCounts.not_submitted} không nộp · ${homeworkCounts.submitted} đã thu · ${homeworkCounts.graded} đã chấm`;
  }
  $('#seat-count').textContent=`${desks().length} bàn`;
  $('#roster-count').textContent=`${classStudents().length} học sinh trong danh sách lớp`;
  $('#finalize-button').disabled=!occupants.length;
  $('#pool-count').textContent='Kéo biểu tượng ở giữa vào bàn bất kỳ (hoặc chạm để thêm nhanh)';
  $('#student-pool').innerHTML=`<button type="button" class="pool-token pool-token-rect" data-pool-token="0" aria-label="Kéo biểu tượng học sinh vào bàn"><span class="pool-token-icon">${studentIcon}</span><span class="pool-token-label">＋ Kéo học sinh mới vào bàn (hoặc chạm để thêm)</span></button>`;
  $('#late-area').innerHTML=lateQueue.map(id=>{
    const s=studentById(id);
    if(!s)return '';
    const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(CURRENT_CLASS_ID);
    return `<button type="button" class="late-token ${isMakeup ? 'late-makeup' : ''}" data-late-key="${id}" aria-label="${s.name}; kéo vào bàn"><span>◷</span><span class="late-name">${isMakeup ? '<span class="makeup-seat-badge">🔄 BÙ</span>' : ''}${escapeHtml(s.name)}</span><small>${s.arrivalTime||'đến muộn'}</small></button>`;
  }).join('')||'<span class="late-empty">Học sinh đến muộn sẽ chờ tại đây. Kéo vào chỗ ngồi khi sẵn sàng (kể cả khi đã khóa sửa sơ đồ).</span>';
  const allRosterAndMakeup = [...classStudents(), ...makeupStudents.filter(m => m.attendingClassId === CURRENT_CLASS_ID)];
  $('#roster-list').innerHTML=allRosterAndMakeup.map(s=>{
    const parts = splitStudentName(s.name);
    const fam = s.familyName ?? parts.familyName;
    const giv = s.givenName ?? parts.givenName;
    const isMakeup = s.studentType === 'makeup';
    const seatedPlace = allEntries().find(place=>place.entry.studentId===s.id);
    return `<div class="student-option roster-option" style="justify-content:space-between;"><span class="student-option-name"><strong>${escapeHtml(fam)} ${escapeHtml(giv)}</strong> ${isMakeup ? '<span class="makeup-status-badge">🔄 Học bù</span>' : ''}${renderInlineTags(s)}<small>${escapeHtml(isMakeup ? `Bù từ: ${s.sourceClassName || 'Lớp khác'}` : (s.school||'Hồ sơ học sinh'))} · ${attendanceLabel(seatedPlace?.entry.attendance?.status)}</small></span><button type="button" class="outline-button find-seat-btn" data-find-seat-student="${escapeHtml(s.id)}">🗺 Tìm chỗ</button></div>`;
  }).join('')||'<div class="empty-list">Danh sách lớp chưa có hồ sơ.</div>';
  renderStudentList();renderChecklist();if(typeof renderScoresView==='function')renderScoresView();
}

function collectAisleHomework(aisleIndex) {
  const aisle = layout[aisleIndex];
  if (!aisle) return;
  pushSeatingUndo();
  let count = 0;
  aisle.desks.forEach(desk => {
    const list = deskItems[desk.id] || [];
    list.forEach(entry => {
      const s = studentById(entry.studentId);
      const curHw = entry.homework || s?.homework;
      if (!curHw || curHw.status === 'uncollected' || curHw.status === 'not_submitted') {
        entry.homework = { status: 'submitted', reason: '', score: null };
        if (s) s.homework = { status: 'submitted', reason: '', score: null };
        count++;
      }
    });
  });
  save();
  render();
  toast(count > 0 ? `Đã thu BTVN cho ${count} học sinh tại Dãy ${aisleIndex + 1}.` : `Toàn bộ học sinh Dãy ${aisleIndex + 1} đã có trạng thái BTVN.`);
}

// Hook toolbar buttons
const undoLayoutBtn = $('#undo-layout-button');
if (undoLayoutBtn) undoLayoutBtn.onclick = undoSeating;

const toggleSeatingEditBtn = $('#toggle-seating-edit-btn');
if (toggleSeatingEditBtn) {
  toggleSeatingEditBtn.onclick = () => {
    isSeatingEditMode = !isSeatingEditMode;
    updateSeatingEditBtn();
    render();
    toast(isSeatingEditMode 
      ? 'Chế độ sửa sơ đồ: ĐANG BẬT (Cho phép kéo thả và nút ＋ thêm học sinh).' 
      : 'Chế độ sửa sơ đồ: ĐÃ KHÓA (Khóa sửa sơ đồ; vẫn kéo được học sinh đi muộn vào bàn và bấm điểm danh).');
  };
}

const teacherViewBtn = $('#teacher-view-button');
if (teacherViewBtn) {
  teacherViewBtn.onclick = () => {
    isTeacherView = !isTeacherView;
    teacherViewBtn.classList.toggle('active', isTeacherView);
    teacherViewBtn.style.background = isTeacherView ? '#233d31' : '';
    teacherViewBtn.style.color = isTeacherView ? '#fff' : '';
    teacherViewBtn.style.borderColor = isTeacherView ? '#233d31' : '';
    teacherViewBtn.textContent = isTeacherView ? '👨‍🏫 Góc nhìn GV (Bật)' : '👨‍🏫 Góc nhìn Giáo viên';
    render();
    toast(isTeacherView ? 'Đã bật góc nhìn Giáo viên (bục giảng nhìn xuống).' : 'Đã quay lại góc nhìn Trợ giảng.');
  };
}

// Global Ctrl+Z shortcut for seating undo
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !$('#seat-dialog')?.open && !$('#late-dialog')?.open) {
      e.preventDefault();
      undoSeating();
    }
  }
});

function growLayoutIfNeeded(){if(!layout.length)layout.push({id:`aisle-${Date.now()}`,desks:[]});layout.at(-1).desks.push({id:`desk-${Date.now()}`,seats:2});deskItems[layout.at(-1).desks.at(-1).id]=[];}
function findSpot(deskId,index){return {deskId,index};}
function currentEntry(){return activeSpot?deskItems[activeSpot.deskId]?.[activeSpot.index]:null;}
function setHomeworkFields(home={status:'uncollected'}){$('#homework-status').value=home.status||'uncollected';$('#homework-score').value=home.score??'';$('#homework-reason').value=home.reason||'';toggleHomeworkFields($('#homework-status').value,'homework');document.querySelectorAll('[data-homework-choice]').forEach(button=>button.classList.toggle('selected',button.dataset.homeworkChoice===($('#homework-status').value==='graded'?'submitted':$('#homework-status').value)));}
function toggleHomeworkFields(status,prefix){const reasonFields=$(`#${prefix==='homework'?'no-homework-fields':'late-no-homework-fields'}`);if(reasonFields)reasonFields.hidden=status!=='not_submitted';const gradeField=$(`#${prefix==='homework'?'grade-field':'late-grade-field'}`);if(gradeField)gradeField.hidden=!(status==='submitted'||status==='graded');}
function showAttendance(att={}){$('#attendance-status').value=att.status||'present';}
function identityPicker(query=''){const used=assignedIds();if(currentEntry()?.studentId)used.delete(currentEntry().studentId);const matches=searchStudents([...classStudents(),...makeupStudents.filter(student=>student.attendingClassId===CURRENT_CLASS_ID)],query,{excludeIds:used});$('#student-options').innerHTML=`${matches.map(s=>`<button type="button" class="student-option" data-student="${escapeHtml(s.id)}"><span class="student-option-name">${escapeHtml(s.name)}${studentSearchMeta(s)}</span><span class="student-check">Chọn</span></button>`).join('')||`<div class="empty-list">${query.trim()?'Chưa có hồ sơ phù hợp.':'Nhập tên để tìm học sinh trong danh sách.'}</div>`}<button type="button" class="student-option new-or-makeup" id="new-or-makeup-choice">＋ Học sinh mới / Học bù</button><div id="identity-kind-host"></div><div id="identity-form-host"></div>`;$('#student-options').querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>assignStudent(b.dataset.student));$('#new-or-makeup-choice').onclick=()=>{$('#identity-kind-host').innerHTML='<div class="identity-actions"><button type="button" class="outline-button" id="new-student-choice">Học sinh mới</button><button type="button" class="outline-button" id="makeup-student-choice">Học bù</button></div>';$('#new-student-choice').onclick=()=>showIdentityForm('new');$('#makeup-student-choice').onclick=()=>showIdentityForm('makeup');};}
function showIdentityForm(kind){const makeup=kind==='makeup';$('#identity-form-host').innerHTML=`<div class="identity-form"><strong>${makeup?'Thông tin học sinh học bù':'Thông tin học sinh mới'}</strong><label class="field-label">Họ và tên<input id="identity-name" placeholder="Ví dụ: Nguyễn Minh Anh" /></label><label class="field-label">${makeup?'Học bù lớp':'Trường'}<input id="identity-school" placeholder="${makeup?'Ví dụ: Toán 8B':'Tên trường'}" /></label>${makeup?'':'<label class="field-label">Tên phụ huynh<input id="identity-parent-name" placeholder="Không bắt buộc" /></label><label class="field-label">Số điện thoại phụ huynh<input id="identity-parent-phone" type="tel" placeholder="Không bắt buộc" /></label>'}<button type="button" class="primary-button confirm-seat" id="save-identity">Xác nhận</button></div>`;$('#save-identity').onclick=()=>{const name=$('#identity-name').value.trim(),school=$('#identity-school').value.trim(),parentContact={name:$('#identity-parent-name')?.value.trim()||'',phone:$('#identity-parent-phone')?.value.trim()||''};if(!name||!school){toast('Vui lòng điền họ tên và trường/lớp học bù.');return;}const student=createStudentProfile({name,school,kind:makeup?'makeup':'regular',parentContact});if(makeup)makeupStudents.push(student);else students.push(student);save();assignStudent(student.id);};}
function assignStudent(id){
  pushSeatingUndo();const entry=currentEntry();if(!entry)return;entry.studentId=id;selectedStudentId=id;const person=studentById(id);person.homework=entry.homework||person.homework||{status:'uncollected'};entry.attendance={status:'present',reason:entry.homework?.reason||null,note:entry.homework?.note||''};person.attendance=entry.attendance;recordHistory(person,entry.attendance,entry.homework||person.homework);recordSeatHistory(person,activeSpot.deskId,activeSpot.index);const noteField=$('#seat-general-note');noteField.value=sessionNoteFor(id);noteField.dataset.sessionNote=id;noteField.disabled=false; /* per-student log removed */ save();render();$('#student-search').value=person.name;$('#student-options').hidden=true;$('#identity-form-host').innerHTML='';renderStudentInfo('#selected-student-info',person);$('#seat-dialog-hint').textContent=`Đã điểm danh ${person.name}. Có thể cập nhật BTVN bên dưới.`;}
function openStudent(deskId,index){activeSpot=findSpot(deskId,index);const entry=currentEntry();selectedStudentId=entry.studentId||null;const deskInfo=desks().find(x=>x.desk.id===deskId),noteField=$('#seat-general-note');$('#seat-dialog-title').textContent=`Dãy ${deskInfo.ci+1} · Bàn ${deskInfo.di+1} · Vị trí ${index+1}`;$('#seat-dialog-hint').textContent=selectedStudentId?`${studentById(selectedStudentId)?.name||'Học sinh'} · cập nhật BTVN và điểm danh.`:'Nhập tên học sinh để mở tìm kiếm.';$('#pick-student-section').hidden=false;$('#homework-section').hidden=false;$('#student-search').value=selectedStudentId?studentById(selectedStudentId)?.name||'':'';noteField.value=selectedStudentId?sessionNoteFor(selectedStudentId):'';noteField.disabled=!selectedStudentId;if(selectedStudentId)noteField.dataset.sessionNote=selectedStudentId;else delete noteField.dataset.sessionNote;identityPicker('');$('#student-options').hidden=true;renderStudentInfo('#selected-student-info',studentById(selectedStudentId));setHomeworkFields(entry.homework||studentById(selectedStudentId)?.homework||{status:'uncollected'});$('#seat-dialog').showModal();}
function insertIntoDesk(entry,destDeskId,destIndex,source){
  pushSeatingUndo();const target=deskItems[destDeskId]||(deskItems[destDeskId]=[]);if(source?.type==='seat'){const from=deskItems[source.deskId];from.splice(source.index,1);if(source.deskId===destDeskId&&source.index<destIndex)destIndex--;}else if(source?.type==='late')lateQueue=lateQueue.filter(id=>id!==source.studentId);destIndex=Math.max(0,Math.min(destIndex,target.length));target.splice(destIndex,0,entry);recordSeatHistory(studentById(entry.studentId),destDeskId,destIndex);save();render();}
function dropIndexAt(deskEl,x){const tokens=[...deskEl.querySelectorAll('.desk-seats [data-entry-index]')].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);if(!tokens.length)return 0;const centers=tokens.map(token=>{const r=token.getBoundingClientRect();return r.left+r.width/2;});if(x<centers[0])return 0;for(let i=1;i<centers.length;i++)if(x<centers[i])return i;return tokens.length;}
function showDropMarker(deskEl,index){const area=deskEl.querySelector('.desk-seats');if(!area)return;const marker=area.querySelector('.drop-marker')||document.createElement('span'),tokens=[...area.querySelectorAll('[data-entry-index]')].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left),rect=area.getBoundingClientRect();marker.className='drop-marker';marker.setAttribute('aria-hidden','true');let x=rect.width/2;if(tokens.length){if(index<=0){x=tokens[0].getBoundingClientRect().left-rect.left;}else if(index>=tokens.length){x=tokens.at(-1).getBoundingClientRect().right-rect.left;}else{x=(tokens[index-1].getBoundingClientRect().right+tokens[index].getBoundingClientRect().left)/2-rect.left;}}marker.style.left=`${Math.max(1,Math.min(rect.width-4,x-2))}px`;marker.style.top='2px';marker.style.height=`${Math.max(20,rect.height-4)}px`;if(!marker.isConnected)area.append(marker);}
function addAnonymousToDesk(deskId,index,openMenu=false){
  pushSeatingUndo();const list=deskItems[deskId]||(deskItems[deskId]=[]),entry={studentId:null,homework:{status:'uncollected'},attendance:null};list.splice(index,0,entry);save();render();if(openMenu)openStudent(deskId,index);}

document.querySelectorAll('[data-homework-choice]').forEach(button=>button.onclick=()=>{const status=button.dataset.homeworkChoice;$('#homework-status').value=status;toggleHomeworkFields(status,'homework');document.querySelectorAll('[data-homework-choice]').forEach(choice=>choice.classList.toggle('selected',choice===button));});$('#late-homework-status').addEventListener('change',e=>toggleHomeworkFields(e.target.value,'late'));
$('#save-homework').onclick=()=>{
  const entry=currentEntry();
  if(!entry)return;

  // Tự động lưu học sinh mới/học bù nếu đang nhập tên mà chưa bấm xác nhận riêng
  const idNameInp = $('#identity-name')?.value?.trim();
  if (!entry.studentId && idNameInp) {
    const idSchoolInp = $('#identity-school')?.value?.trim() || '';
    const isMakeup = Boolean($('#identity-school')?.placeholder?.includes('Toán'));
    const parentContact = {
      name: $('#identity-parent-name')?.value?.trim() || '',
      phone: $('#identity-parent-phone')?.value?.trim() || ''
    };
    const student = createStudentProfile({
      name: idNameInp,
      school: idSchoolInp || (isMakeup ? 'Chưa rõ lớp' : 'Chưa rõ trường'),
      kind: isMakeup ? 'makeup' : 'regular',
      parentContact,
      tags: []
    });
    if (isMakeup) makeupStudents.push(student);
    else students.push(student);
    save();
    entry.studentId = student.id;
    selectedStudentId = student.id;
    toast(`Đã tự động lưu ${student.name} vào hệ thống.`);
  }

  let status=$('#homework-status').value;const scoreValue=$('#homework-score').value.trim();if(status==='submitted'&&scoreValue)status='graded';if(status==='not_submitted'&&!entry.studentId){toast('Chọn tên học sinh trước khi lưu trạng thái không nộp.');$('#student-search').focus();return;}if(status==='not_submitted'&&!$('#homework-reason').value){toast('Chọn lý do không nộp BTVN.');return;}if(scoreValue&&(Number(scoreValue)<0||Number(scoreValue)>10)){toast('Điểm BTVN cần nằm trong khoảng 0 đến 10.');return;}const sharedNote=$('#seat-general-note').value.trim();entry.homework={status,score:scoreValue?Number(scoreValue):null,reason:status==='not_submitted'?$('#homework-reason').value:null,note:status==='not_submitted'?sharedNote:''};entry.homeworkSaved=true;const person=studentById(entry.studentId);if(person){saveSessionNote(person.id,sharedNote);person.homework=entry.homework;recordStudentScore(person,entry.homework.score,'BTVN');}if(status==='not_submitted'&&person){entry.attendance={status:'present',reason:entry.homework.reason,note:entry.homework.note};person.attendance=entry.attendance;recordHistory(person,entry.attendance,entry.homework);}
    const allSeated = allEntries().filter(e => e.entry.studentId);
    const allAccounted = allSeated.length > 0 && allSeated.every(e => {
      const st = e.entry.homework?.status || studentById(e.entry.studentId)?.homework?.status;
      return st && st !== 'uncollected';
    });
    if (allAccounted && !checklist._allHwLogged) {
      checklist._allHwLogged = true;
      addClassActivity(`${currentStaffName()} đã thu và kiểm tra hết BTVN (${allSeated.length} học sinh)`, 'homework');
      createClassNotification('Đã thu hết BTVN', `Tất cả ${allSeated.length} học sinh có mặt đã được kiểm tra BTVN.`, 'homework');
    }save();render();$('#seat-dialog').close();toast(status==='uncollected'?'Đã lưu BTVN: Chưa thu.':status==='submitted'?'Đã ghi nhận đã thu BTVN.':status==='graded'?'Đã ghi nhận điểm BTVN.':`Đã ghi nhận ${person.name} không nộp và điểm danh có mặt.`);};
$('#student-search').addEventListener('input',e=>{const entry=currentEntry();if(entry?.studentId&&e.target.value!==studentById(entry.studentId)?.name){entry.studentId=null;entry.attendance=null;selectedStudentId=null;renderStudentInfo('#selected-student-info',null);save();render();}identityPicker(e.target.value);$('#student-options').hidden=!e.target.value.trim();});$('#close-seat').onclick=()=>$('#seat-dialog').close();$('#clear-seat').onclick=()=>{if(!activeSpot)return;const entry=currentEntry();if(!entry)return;const person=studentById(entry.studentId);const hasSavedData=Boolean(entry.studentId||entry.attendance||entry.homeworkSaved||(entry.homework?.status&&entry.homework.status!=='uncollected')||person?.history?.length);if(hasSavedData){const name=person?.name;const message=name?`${name} đã có dữ liệu. Bỏ học sinh khỏi sơ đồ lớp? Hồ sơ và lịch sử đã lưu sẽ được giữ lại.`:'Vị trí này đã có dữ liệu BTVN/điểm danh. Bỏ vị trí khỏi sơ đồ lớp?';if(!window.confirm(message))return;}deskItems[activeSpot.deskId].splice(activeSpot.index,1);save();render();$('#seat-dialog').close();};
$('#student-search').addEventListener('input',()=>{const noteField=$('#seat-general-note');if(!selectedStudentId){noteField.value='';noteField.disabled=true;delete noteField.dataset.sessionNote;}});
classroom.addEventListener('click',e=>{
  if(suppressClick){e.preventDefault();suppressClick=false;return;}
  const dividerBtn=e.target.closest('[data-toggle-divider-aisle]');
  if(dividerBtn){
    if(!isSeatingEditMode)return;
    const aIdx=Number(dividerBtn.dataset.toggleDividerAisle);
    const dIdx=Number(dividerBtn.dataset.toggleDividerDesk);
    const targetDesk=layout[aIdx]?.desks?.[dIdx];
    if(targetDesk){
      targetDesk.dividerAfter=!targetDesk.dividerAfter;
      save();
      render();
      toast(targetDesk.dividerAfter
        ? `Đã bật vạch phân cách giữa Bàn ${dIdx+1} và Bàn ${dIdx+2} (Dãy ${aIdx+1}).`
        : `Đã tắt vạch phân cách giữa Bàn ${dIdx+1} và Bàn ${dIdx+2} (Dãy ${aIdx+1}).`);
    }
    return;
  }
  const token=e.target.closest('[data-entry-index]');
  if(token){openStudent(token.dataset.deskId,Number(token.dataset.entryIndex));return;}
  const add=e.target.closest('[data-add-to-desk]');
  if(add){if(!isSeatingEditMode)return;addAnonymousToDesk(add.dataset.addToDesk,(deskItems[add.dataset.addToDesk]||[]).length,false);}
});

// Track divider state inside #layout-dialog before saving
let draftAisleDividers = {};

function parseMobileColumnCount(rawVal, fallback = 3) {
  const digits = String(rawVal ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let num = Number(digits);
  // If user had "1" and typed another digit 2..8 on mobile ("12".."18"), use the newly typed digit!
  if (digits.length === 2 && digits.startsWith('1') && Number(digits[1]) >= 2 && Number(digits[1]) <= 8) {
    num = Number(digits[1]);
  }
  return Math.max(1, Math.min(8, num || fallback));
}

function renderAisleFields(syncInput = false){
  const colInput = $('#column-count');
  if (!colInput) return;
  const parsed = parseMobileColumnCount(colInput.value, layout.length || 3);
  if (parsed === null && !syncInput) {
    // Allow input to stay empty on mobile while the user is deleting to type a new digit!
    return;
  }
  const count = parsed ?? Math.max(1, Math.min(8, layout.length || 3));
  if (syncInput || String(colInput.value).length >= 2) {
    colInput.value = String(count);
  }

  const prior=[...document.querySelectorAll('[data-desk-count]')].map(x=>{
    const d = String(x.value || '').replace(/[^0-9]/g, '');
    return d ? Math.max(1, Math.min(30, Number(d))) : null;
  });

  $('#aisle-config').innerHTML=Array.from({length:count},(_,i)=>{
    const deskCount = prior[i] ?? layout[i]?.desks?.length ?? 3;
    if (!draftAisleDividers[i]) {
      draftAisleDividers[i] = new Set();
      (layout[i]?.desks || []).forEach((d, di) => {
        if (d.dividerAfter) draftAisleDividers[i].add(di);
      });
    }
    const chipsHtml = deskCount > 1
      ? Array.from({ length: deskCount - 1 }, (_, di) => {
          const isAct = draftAisleDividers[i].has(di);
          return `<button type="button" class="aisle-divider-chip ${isAct ? 'active' : ''}" data-aisle-divider-chip="${i}" data-divider-di="${di}">━ Giữa bàn ${di + 1} & ${di + 2}</button>`;
        }).join('')
      : '<small style="color:#87968a; font-size:9px;">Cần từ 2 bàn trở lên để đặt vạch phân cách</small>';

    return `<div class="aisle-config-card">
      <label class="field-label aisle-field" style="margin:0;">
        <span>Số bàn ở dãy ${i+1}</span>
        <div class="mobile-number-stepper">
          <button type="button" class="stepper-btn" data-aisle-dec="${i}" aria-label="Giảm số bàn dãy ${i+1}">－</button>
          <input type="text" inputmode="numeric" pattern="[0-9]*" value="${deskCount}" data-desk-count="${i}" required />
          <button type="button" class="stepper-btn" data-aisle-inc="${i}" aria-label="Tăng số bàn dãy ${i+1}">＋</button>
        </div>
      </label>
      <div style="margin-top:6px;">
        <small style="color:#4b6352; font-size:9.5px; font-weight:700;">Vạch phân cách bàn (Dãy ${i+1}):</small>
        <div class="aisle-divider-chips" data-aisle-chips-wrap="${i}">${chipsHtml}</div>
      </div>
    </div>`;
  }).join('');

  // Wire per-aisle stepper & divider chips
  $('#aisle-config').querySelectorAll('[data-aisle-dec]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.aisleDec);
      const inp = $('#aisle-config').querySelector(`[data-desk-count="${idx}"]`);
      if (!inp) return;
      inp.value = String(Math.max(1, (Number(inp.value) || 1) - 1));
      renderAisleFields(false);
    };
  });
  $('#aisle-config').querySelectorAll('[data-aisle-inc]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.aisleInc);
      const inp = $('#aisle-config').querySelector(`[data-desk-count="${idx}"]`);
      if (!inp) return;
      inp.value = String(Math.min(30, (Number(inp.value) || 1) + 1));
      renderAisleFields(false);
    };
  });
  $('#aisle-config').querySelectorAll('[data-desk-count]').forEach(inp => {
    inp.addEventListener('change', () => {
      const d = String(inp.value || '').replace(/[^0-9]/g, '');
      inp.value = String(Math.max(1, Math.min(30, Number(d) || 3)));
      renderAisleFields(false);
    });
  });
  $('#aisle-config').querySelectorAll('[data-aisle-divider-chip]').forEach(chip => {
    chip.onclick = () => {
      const aIdx = Number(chip.dataset.aisleDividerChip);
      const dIdx = Number(chip.dataset.dividerDi);
      draftAisleDividers[aIdx] = draftAisleDividers[aIdx] || new Set();
      if (draftAisleDividers[aIdx].has(dIdx)) draftAisleDividers[aIdx].delete(dIdx);
      else draftAisleDividers[aIdx].add(dIdx);
      chip.classList.toggle('active', draftAisleDividers[aIdx].has(dIdx));
    };
  });
}

$('#edit-layout').onclick=()=>{
  draftAisleDividers = {};
  layout.forEach((aisle, ci) => {
    draftAisleDividers[ci] = new Set();
    (aisle.desks || []).forEach((d, di) => {
      if (d.dividerAfter) draftAisleDividers[ci].add(di);
    });
  });
  $('#column-count').value=String(layout.length);
  renderAisleFields(true);
  $('#layout-dialog').showModal();
};
$('#column-count').addEventListener('input', () => renderAisleFields(false));
$('#column-count').addEventListener('change', () => renderAisleFields(true));
$('#column-count').addEventListener('blur', () => renderAisleFields(true));
$('#col-count-dec')?.addEventListener('click', () => {
  const cur = parseMobileColumnCount($('#column-count').value, layout.length || 3) || 1;
  $('#column-count').value = String(Math.max(1, cur - 1));
  renderAisleFields(true);
});
$('#col-count-inc')?.addEventListener('click', () => {
  const cur = parseMobileColumnCount($('#column-count').value, layout.length || 3) || 1;
  $('#column-count').value = String(Math.min(8, cur + 1));
  renderAisleFields(true);
});
$('#close-layout').onclick=()=>$('#layout-dialog').close();
$('#layout-form').addEventListener('submit',e=>{
  e.preventDefault();
  const count=parseMobileColumnCount($('#column-count').value, layout.length || 3) || 1;
  $('#column-count').value = String(count);
  const counts=[...document.querySelectorAll('[data-desk-count]')].slice(0,count).map(x=>Math.max(1,Math.min(30,Number(String(x.value||'').replace(/[^0-9]/g,''))||1)));
  const next=Array.from({length:count},(_,ci)=>({
    id:layout[ci]?.id||`aisle-${Date.now()}-${ci}`,
    desks:Array.from({length:counts[ci]},(_,di)=>{
      const existingDesk = layout[ci]?.desks[di];
      const hasDiv = Boolean(draftAisleDividers[ci]?.has(di) && di < counts[ci] - 1);
      return existingDesk
        ? { ...existingDesk, dividerAfter: hasDiv }
        : { id:`desk-${Date.now()}-${ci}-${di}`, seats:2, dividerAfter: hasDiv };
    })
  }));
  for(const old of desks()){
    if(!next.some(a=>a.desks.some(d=>d.id===old.desk.id))&&(deskItems[old.desk.id]||[]).length){
      next.at(-1).desks.push(old.desk);
      toast('Giữ lại bàn có học sinh để không mất dữ liệu.');
    }
  }
  layout=next;
  for(const {desk}of desks())deskItems[desk.id]??=[];
  save();
  render();
  $('#layout-dialog').close();
  toast('Đã lưu bố trí sơ đồ lớp và vạch phân cách bàn.');
});

function historyHtml(id){const history=studentById(id)?.history||[],cutoff=Date.now()-28*86400000,rows=history.filter(x=>!x.timestamp||x.timestamp>=cutoff);return rows.length?rows.slice(0,12).map(x=>`<div class="history-row"><span>${x.date||''}</span><span class="history-attendance ${x.status==='late'?'late':''}">${x.status==='late'?'Đi muộn':'Đúng giờ'}${x.time?` · ${x.time}`:''}</span><span class="history-homework ${homeworkClass(x.homework?.status)}" title="${homeworkLabel(x.homework?.status)}">${homeworkSymbol(x.homework)}</span></div>`).join(''):'<div class="empty-list">Chưa có lịch sử 4 tuần được lưu.</div>';}
function recordHistory(student,attendance,homework){
  if(!student || isClassHistoryViewMode) return;
  student.attendanceHistory = Array.isArray(student.attendanceHistory) ? student.attendanceHistory : [];
  const minsLate = attendance?.lateMinutes || attendance?.minutesLate || 0;
  const attEntry = {
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    status: attendance?.status || 'present',
    minutesLate: minsLate,
    lateMinutes: minsLate,
    time: attendance?.arrivalTime || null,
    reason: attendance?.reason || null,
    homework: homework ? { ...homework } : { status: 'uncollected' },
    timestamp: Date.now()
  };
  const existingIdx = student.attendanceHistory.findIndex(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
  if (existingIdx >= 0) student.attendanceHistory[existingIdx] = attEntry;
  else student.attendanceHistory.unshift(attEntry);
  student.history = student.attendanceHistory;

  student.sessionNotes = Array.isArray(student.sessionNotes) ? student.sessionNotes : [];
  const noteIdx = student.sessionNotes.findIndex(n => n.classId === CURRENT_CLASS_ID && n.date === checklistDate);
  const noteText = sessionNoteFor(student.id) || '';
  const noteEntry = {
    ...(noteIdx >= 0 ? student.sessionNotes[noteIdx] : {}),
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    homeworkStatus: homework?.status || 'uncollected',
    homeworkReason: homework?.reason || '',
    homeworkScore: homework?.score ?? null,
    note: noteText,
    updatedAt: Date.now()
  };
  if (noteIdx >= 0) student.sessionNotes[noteIdx] = noteEntry;
  else student.sessionNotes.unshift(noteEntry);
}

function recordSeatHistory(student,deskId,index){
  if(!student || isClassHistoryViewMode) return;
  const spot = desks().find(item => item.desk.id === deskId);
  student.seatingHistory = Array.isArray(student.seatingHistory) ? student.seatingHistory : [];
  const seatEntry = {
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    deskId,
    aisle: spot ? spot.ci + 1 : null,
    desk: spot ? spot.di + 1 : null,
    position: (Number(index) || 0) + 1,
    timestamp: Date.now()
  };
  const seatIdx = student.seatingHistory.findIndex(sh => sh.classId === CURRENT_CLASS_ID && sh.date === checklistDate);
  if (seatIdx >= 0) student.seatingHistory[seatIdx] = seatEntry;
  else student.seatingHistory.unshift(seatEntry);
}

function recordStudentScore(student,score,type='BTVN'){
  if(!student || isClassHistoryViewMode) return;
  student.scores = Array.isArray(student.scores) ? student.scores : [];
  const scIdx = student.scores.findIndex(sc => sc.classId === CURRENT_CLASS_ID && sc.date === checklistDate && (sc.type === type || (!sc.type && type === 'BTVN')));
  if (score === null || score === undefined || score === '') {
    if (scIdx >= 0) student.scores.splice(scIdx, 1);
    return;
  }
  const scEntry = {
    classId: CURRENT_CLASS_ID,
    date: checklistDate,
    type,
    score: Number(score),
    timestamp: Date.now()
  };
  if (scIdx >= 0) student.scores[scIdx] = scEntry;
  else student.scores.unshift(scEntry);
}

let _isSyncingLive = false;
function syncLiveSessionData() {
  if (_isSyncingLive || isClassHistoryViewMode) return;
  _isSyncingLive = true;
  try {
    const classInfo = activeClassConfig();
    const roster = classStudents();
    const entries = allEntries();
    const lateSet = new Set(lateQueue);

    // Sync seated students into their history records
    entries.forEach(({ entry, deskId, index }) => {
      if (!entry.studentId) return;
      const stu = studentById(entry.studentId);
      if (!stu) return;
      const att = entry.attendance || stu.attendance || { status: lateSet.has(stu.id) ? 'late' : 'present' };
      const hw = entry.homework || stu.homework || { status: 'uncollected' };
      recordHistory(stu, att, hw);
      recordSeatHistory(stu, deskId, index);
      if (hw.score !== null && hw.score !== undefined) {
        recordStudentScore(stu, hw.score, 'BTVN');
      }
    });

    // Sync late queue students not yet seated
    lateQueue.forEach(id => {
      const stu = studentById(id);
      if (!stu) return;
      if (entries.some(e => e.entry.studentId === id)) return;
      const att = stu.attendance || { status: 'late', lateMinutes: 10, minutesLate: 10 };
      const hw = stu.homework || { status: 'uncollected' };
      recordHistory(stu, att, hw);
    });

    // Build real-time session snapshot for session-history-repository
    const presentCount = entries.filter(e => e.entry.studentId && e.entry.attendance?.status !== 'late').length;
    const lateCount = entries.filter(e => e.entry.studentId && e.entry.attendance?.status === 'late').length + lateQueue.filter(id => !entries.some(e => e.entry.studentId === id)).length;
    const totalRoster = roster.length;
    const absentCount = Math.max(0, totalRoster - presentCount - lateCount);
    const hwCount = entries.filter(e => e.entry.studentId && (e.entry.homework?.status === 'submitted' || e.entry.homework?.status === 'graded')).length;
    const testsCollected = Object.values(checklist?.tests || {}).filter(Boolean).length;

    const checklistSummary = [
      ...(checklist?.items || []).map(i => ({ label: i.label, done: Boolean(i.done), doneBy: i.doneBy || null })),
      ...(checklist?.endItems || []).map(i => ({ label: i.label, done: Boolean(i.done), doneBy: i.doneBy || null }))
    ];

    const studentsSnapshot = roster.map(s => {
      const seated = entries.find(e => e.entry.studentId === s.id);
      const isLate = lateSet.has(s.id) || seated?.entry.attendance?.status === 'late';
      const isPresent = Boolean(seated);
      const attHist = (s.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
      const attStatus = isLate ? 'late' : isPresent ? 'present' : (attHist?.status || 'unrecorded');
      const minsLate = seated?.entry.attendance?.lateMinutes || seated?.entry.attendance?.minutesLate || s.attendance?.lateMinutes || attHist?.lateMinutes || 0;
      const hwStatus = seated?.entry.homework?.status || s.homework?.status || 'uncollected';
      const hwScore = seated?.entry.homework?.score ?? s.homework?.score ?? null;
      const hwReason = seated?.entry.homework?.reason || s.homework?.reason || '';
      const testScore = seated?.entry.testScore ?? checklist?.testScores?.[s.id] ?? s.testScore ?? null;
      return {
        studentId: s.id,
        studentName: s.name,
        studentCode: s.studentCode || null,
        school: s.school || '',
        attendance: { status: attStatus, minutesLate: isLate ? (minsLate || 10) : 0, lateMinutes: isLate ? (minsLate || 10) : 0 },
        homework: { status: hwStatus, score: hwScore, reason: hwReason },
        testScore,
        note: sessionNoteFor(s.id) || ''
      };
    });

    const staffEmp = masterData?.employees?.find(e => e.id === currentEmployeeId);
    const currentUser = {
      id: currentEmployeeId,
      name: staffEmp?.name || currentStaffName(),
      role: selectedRole()
    };

    syncActiveClassSessionRecord(CURRENT_CLASS_ID, checklistDate, currentUser, {
      className: classInfo?.name || CURRENT_CLASS_ID,
      classCode: classInfo?.code || CURRENT_CLASS_ID,
      subject: classInfo?.subject || '',
      room: classInfo?.room || '',
      grade: classInfo?.grade || '',
      teacherName: classInfo?.teacherName || '',
      assistantName: classInfo?.assistantName || '',
      lessonTitle: checklist?.lessonTitle || '',
      sessionNote: checklist?.classNote || '',
      homeworkAssignment: checklist?.homeworkAssignment || '',
      checklistSummary,
      layout,
      deskItems,
      testHandover: checklist?.handover || null,
      students: studentsSnapshot,
      stats: {
        total: totalRoster,
        present: presentCount + lateCount,
        late: lateCount,
        absent: absentCount,
        homeworkDone: hwCount,
        testsCollected
      }
    });

    window.__featuresApp?.updateSessionStateUI?.();
  } catch (err) {
    console.warn('syncLiveSessionData error:', err);
  } finally {
    _isSyncingLive = false;
  }
}
function drawLatePicker(query=''){const normalized=query.trim(),excludeIds=[...assignedIds(),...lateQueue],candidates=searchStudents([...classStudents(),...makeupStudents.filter(student=>student.attendingClassId===CURRENT_CLASS_ID)],normalized,{excludeIds});$('#late-options').innerHTML=`${candidates.map(s=>`<button type="button" class="student-option" data-late-student="${escapeHtml(s.id)}"><span class="student-option-name">${escapeHtml(s.name)}${studentSearchMeta(s)}</span></button>`).join('')||`<div class="empty-list">${normalized?'Không tìm thấy hồ sơ.':'Nhập tên để tìm học sinh.'}</div>`}<button type="button" class="student-option new-or-makeup" id="late-new-or-makeup">＋ Học sinh mới / Học bù</button><div id="late-identity-host"></div>`;$('#late-options').querySelectorAll('[data-late-student]').forEach(b=>b.onclick=()=>selectLateStudent(b.dataset.lateStudent));$('#late-new-or-makeup').onclick=()=>{$('#late-identity-host').innerHTML='<div class="identity-actions"><button type="button" class="outline-button" id="late-new-student">Học sinh mới</button><button type="button" class="outline-button" id="late-makeup-student">Học bù</button></div>';$('#late-new-student').onclick=()=>showLateIdentityForm('new');$('#late-makeup-student').onclick=()=>showLateIdentityForm('makeup');};}
function showLateIdentityForm(kind){const makeup=kind==='makeup';$('#late-identity-host').innerHTML=`<div class="identity-form"><strong>${makeup?'Học sinh học bù':'Học sinh mới'}</strong><label class="field-label">Họ và tên<input id="late-full-name" placeholder="Ví dụ: Nguyễn Minh Anh" /></label><label class="field-label">${makeup?'Học bù lớp':'Trường'}<input id="late-school" placeholder="${makeup?'Ví dụ: Toán 8B':'Tên trường'}" /></label>${makeup?'':'<label class="field-label">Tên phụ huynh<input id="late-parent-name" placeholder="Không bắt buộc" /></label><label class="field-label">Số điện thoại phụ huynh<input id="late-parent-phone" type="tel" placeholder="Không bắt buộc" /></label>'}<button type="button" class="primary-button confirm-seat" id="create-late-student">Tiếp tục</button></div>`;$('#create-late-student').onclick=()=>{const name=$('#late-full-name').value.trim(),school=$('#late-school').value.trim(),parentContact={name:$('#late-parent-name')?.value.trim()||'',phone:$('#late-parent-phone')?.value.trim()||''};if(!name||!school){toast('Vui lòng điền họ tên và trường/lớp học bù.');return;}const student=createStudentProfile({name,school,kind:makeup?'makeup':'regular',parentContact});if(makeup)makeupStudents.push(student);else students.push(student);save();selectLateStudent(student.id);};}
function setLateHomeworkFields(home={status:'uncollected'}){$('#late-homework-status').value=home.status||'uncollected';$('#late-homework-score').value=home.score??'';$('#late-homework-reason').value=home.reason||'';toggleHomeworkFields($('#late-homework-status').value,'late');document.querySelectorAll('[data-late-homework-choice]').forEach(button=>button.classList.toggle('selected',button.dataset.lateHomeworkChoice===($('#late-homework-status').value==='graded'?'submitted':$('#late-homework-status').value)));}
function selectLateStudent(id){selectedLateId=id;lateHomeworkSelected=false;const student=studentById(id),noteField=$('#late-general-note');$('#late-search').value=student.name;noteField.value=sessionNoteFor(id);noteField.dataset.sessionNote=id;$('#late-options').hidden=true;$('#late-detail-section').hidden=false;const tags=studentTagList(student);$('#late-history').innerHTML=`<div class="late-profile-meta"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.school||'Chưa cập nhật trường/lớp')}</small>${tags.map(tag=>`<span class="student-tag ${tag==='Mới'?'new-tag':''}">${escapeHtml(tag)}</span>`).join('')}</div>${historyHtml(id)}`;$('#arrival-time').value=new Date().toTimeString().slice(0,5);setLateHomeworkFields(student.homework||{status:'uncollected'});window.__featuresApp?.updateLateMinutesCalculation?.();}
$('#late-button').onclick=()=>{$('#late-search').value='';$('#late-pick-section').hidden=false;$('#late-detail-section').hidden=true;$('#late-options').hidden=true;$('#save-arrival-time').checked=true;$('#arrival-time-field').hidden=false;selectedLateId=null;lateHomeworkSelected=false;drawLatePicker();$('#late-dialog').showModal();};$('#late-search').addEventListener('input',e=>{if(selectedLateId&&e.target.value!==studentById(selectedLateId)?.name){selectedLateId=null;lateHomeworkSelected=false;$('#late-detail-section').hidden=true;}drawLatePicker(e.target.value);$('#late-options').hidden=!e.target.value.trim();});$('#close-late').onclick=()=>$('#late-dialog').close();$('#save-arrival-time').onchange=e=>$('#arrival-time-field').hidden=!e.target.checked;
document.querySelectorAll('[data-late-homework-choice]').forEach(button=>button.onclick=()=>{const status=button.dataset.lateHomeworkChoice;lateHomeworkSelected=true;$('#late-homework-status').value=status;toggleHomeworkFields(status,'late');document.querySelectorAll('[data-late-homework-choice]').forEach(choice=>choice.classList.toggle('selected',choice===button));});$('#late-homework-status').addEventListener('change',e=>{lateHomeworkSelected=true;toggleHomeworkFields(e.target.value,'late');});
$('#late-search').addEventListener('input',()=>{if(!selectedLateId){const noteField=$('#late-general-note');noteField.value='';delete noteField.dataset.sessionNote;}});$('#late-button').addEventListener('click',()=>{const noteField=$('#late-general-note');noteField.value='';delete noteField.dataset.sessionNote;});
$('#save-late').onclick=()=>{if(!selectedLateId){toast('Nhập và chọn tên học sinh trước khi xác nhận đi muộn.');$('#late-search').focus();return;}if(!lateHomeworkSelected){toast('Chọn trạng thái BTVN trước khi xác nhận đi muộn.');return;}let status=$('#late-homework-status').value;const scoreValue=$('#late-homework-score').value.trim();if(status==='submitted'&&scoreValue)status='graded';if(status==='not_submitted'&&!$('#late-homework-reason').value){toast('Chọn lý do không nộp BTVN.');return;}if(scoreValue&&(Number(scoreValue)<0||Number(scoreValue)>10)){toast('Điểm BTVN cần nằm trong khoảng 0 đến 10.');return;}const student=studentById(selectedLateId),sharedNote=$('#late-general-note').value.trim(),homework={status,score:scoreValue?Number(scoreValue):null,reason:status==='not_submitted'?$('#late-homework-reason').value:null,note:status==='not_submitted'?sharedNote:''};const lateMinutes = window.__featuresApp?.updateLateMinutesCalculation?.() || 0;const attendance={status:'late',arrivalTime:$('#save-arrival-time').checked?$('#arrival-time').value:null,lateMinutes};saveSessionNote(student.id,sharedNote);student.homework=homework;recordStudentScore(student,homework.score,'BTVN');student.attendance=attendance;student.arrivalTime=attendance.arrivalTime;recordHistory(student,attendance,homework);lateQueue.push(student.id); /* per-student late log removed */ save();render();$('#late-dialog').close();toast(`${student.name} đã ghi nhận đến muộn; kéo vào bàn.`);};

function startDrag(source,element,x,y){
  if (!isSeatingEditMode && source?.type !== 'late') return;
  dragState={source,element,x,y,started:false,targetDesk:null,dropIndex:0,ghost:null};
}
$('#student-pool').addEventListener('pointerdown',e=>{const t=e.target.closest('[data-pool-token]');if(t)startDrag({type:'pool'},t,e.clientX,e.clientY);});
classroom.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-entry-index]');if(t)startDrag({type:'seat',deskId:t.dataset.deskId,index:Number(t.dataset.entryIndex)},t,e.clientX,e.clientY);});
$('#late-area').addEventListener('pointerdown',e=>{const t=e.target.closest('[data-late-key]');if(t)startDrag({type:'late',studentId:t.dataset.lateKey},t,e.clientX,e.clientY);});
document.addEventListener('pointermove',e=>{if(!dragState)return;if(!dragState.started&&Math.hypot(e.clientX-dragState.x,e.clientY-dragState.y)>7){dragState.started=true;dragState.element.classList.add('dragging');document.body.classList.add('is-dragging');dragState.ghost=document.createElement('div');dragState.ghost.className='drag-ghost';dragState.ghost.textContent=dragState.source.type==='pool'?'Học sinh mới':dragState.source.type==='late'?studentById(dragState.source.studentId)?.name:'Di chuyển trong bàn';document.body.append(dragState.ghost);}if(dragState.started){dragState.ghost.style.left=`${e.clientX+12}px`;dragState.ghost.style.top=`${e.clientY+12}px`;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.desk[data-desk-id]');if(target!==dragState.targetDesk){dragState.targetDesk?.classList.remove('desk-drop-target');dragState.targetDesk?.querySelector('.drop-marker')?.remove();dragState.targetDesk=target;target?.classList.add('desk-drop-target');}if(target){dragState.dropIndex=dropIndexAt(target,e.clientX,e.clientY);showDropMarker(target,dragState.dropIndex);}}});
document.addEventListener('pointerup',e=>{if(!dragState)return;const drag=dragState;dragState=null;drag.element.classList.remove('dragging');drag.targetDesk?.classList.remove('desk-drop-target');drag.targetDesk?.querySelector('.drop-marker')?.remove();drag.ghost?.remove();document.body.classList.remove('is-dragging');if(!drag.started)return;suppressClick=true;setTimeout(()=>suppressClick=false,120);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.desk[data-desk-id]');if(!target)return;const deskId=target.dataset.deskId,index=dropIndexAt(target,e.clientX,e.clientY);let entry,source;if(drag.source.type==='pool'){entry={studentId:null,homework:{status:'uncollected'},attendance:null};source={type:'pool'};}else if(drag.source.type==='late'){const person=studentById(drag.source.studentId);entry={studentId:person.id,homework:person.homework||{status:'uncollected'},attendance:person.attendance||null};source={type:'late',studentId:person.id};}else{source=drag.source;entry=deskItems[source.deskId][source.index];}if(entry){insertIntoDesk(entry,deskId,index,source);toast('Đã đặt vào vị trí thả trong bàn; học sinh ở bàn khác không bị chuyển.');}});
$('#student-pool').addEventListener('click',e=>{if(suppressClick){e.preventDefault();return;}const token=e.target.closest('[data-pool-token]');if(!token)return;const first=desks()[0]?.desk;if(!first){growLayoutIfNeeded();}const deskId=desks()[0].desk.id,index=(deskItems[deskId]||[]).length;addAnonymousToDesk(deskId,index,false);});
$('#finalize-button').onclick=()=>{const pending=allEntries().filter(x=>!x.entry.studentId||!(x.entry.attendance||studentById(x.entry.studentId)?.attendance));if(pending.length){toast(`${pending.length} biểu tượng/học sinh chưa ghi tên hoặc chưa điểm danh.`);return;}addClassActivity(`${currentStaffName()} đã chốt danh sách ${allEntries().length} học sinh có mặt`,'attendance');toast(`Đã hoàn tất ghi nhận ${allEntries().length} học sinh có mặt.`);};
$('#close-students').onclick=()=>$('#students-dialog').close();
const features = setupFeatures({
  $,
  escapeHtml,
  toast,
  addClassActivity,
  createClassNotification,
  getMasterData: () => masterData,
  getClassCatalog: () => classCatalog,
  saveClassCatalog: (cats) => {
    classCatalog = cats;
    saveClassCatalog(cats);
  },
  setMasterData: (m) => {
    masterData = m;
    saveMasterData(m);
  },
  getSignedInAccount: () => signedInAccount,
  setSignedInAccount: (acc) => {
    signedInAccount = acc;
    currentEmployeeId = acc.employeeId;
  },
  getCurrentClassId: () => CURRENT_CLASS_ID,
  getActiveClassConfig: () => activeClassConfig(),
  getChecklistDate: () => checklistDate,
  classStudents: () => classStudents(),
  studentById: (id) => studentById(id),
  allEntries: () => allEntries(),
  getLateQueue: () => lateQueue,
  getStudents: () => students,
  getMakeupStudents: () => makeupStudents,
  saveStudentRecords: (st, mk) => {
    if (Array.isArray(st)) students = st;
    if (Array.isArray(mk)) makeupStudents = mk;
    saveStudentRecords(students, makeupStudents);
  },
  setLayout: (newLayout) => {
    if (Array.isArray(newLayout) && newLayout.length) {
      layout = newLayout;
      for (const { desk } of desks()) deskItems[desk.id] ??= [];
      save();
    }
  },
  sessionNoteFor: (id) => sessionNoteFor(id),
  saveSessionNote: (id, val) => saveSessionNote(id, val),
  syncLiveSessionData: () => syncLiveSessionData(),
  createStudentProfile: (p) => createStudentProfile(p),
  render: () => render(),
  renderMainMenu: () => renderMainMenu(),
  setMainMenuPanel: (p) => setMainMenuPanel(p),
  attendanceLabel: (st) => attendanceLabel(st),
  homeworkLabel: (st) => homeworkLabel(st),
  homeworkSymbol: (hw) => homeworkSymbol(hw),
  sessionChanges: () => sessionChanges,
  saveClassSessionChanges: (changes) => saveClassSessionChanges(changes),
  occurrenceDate: (cls) => occurrenceDate(cls),
  sessionChangeKey: (classId, date) => sessionChangeKey(classId, date),
  enterClass: (classId, date) => enterClass(classId, date),
  openStudentProfile: (id) => openStudentProfile(id),
  desks: () => desks(),
  getLayout: () => layout,
  getDeskItems: () => deskItems,
  resetSessionForNewShift: (classId, date, staffName) => resetSessionForNewShift(classId, date, staffName),
  navigateTo: (path, replace) => navigateTo(path, replace)
});
window.__featuresApp = features;

// Initialize continuous Real-time Sync across tabs, LAN devices, and views
function refreshUIOnRealtimeUpdate(changedKeys = [], source = 'remote') {
  if (source === 'local-save') return;
  const loginScr = document.getElementById('login-screen');
  if (loginScr && !loginScr.hidden && loginScr.style.display !== 'none') return;
  if (document.querySelector('dialog[open]')) return;

  // Reload master data, class catalog, and session changes
  masterData = loadMasterData();
  classCatalog = loadClassCatalog(localStorage, masterData);
  sessionChanges = loadClassSessionChanges();

  // Check if communication changed for notifications
  const commKey = `lopvui.class-communication.v1.${CURRENT_CLASS_ID}.${checklistDate}`;
  const previousNoticeIds = new Set((classCommunication?.notifications || []).map(item => item.id));

  // Reload active class session data & student records
  reloadClassSessionData(CURRENT_CLASS_ID, checklistDate);
  personalWorkDays = read(personalWorkKey(), {});

  // Notify new incoming notifications if any
  if (changedKeys.includes(commKey) || changedKeys.includes('*')) {
    const incoming = (classCommunication?.notifications || []).filter(item => !previousNoticeIds.has(item.id) && !item.read);
    if (incoming.length && 'Notification' in window && Notification.permission === 'granted') {
      incoming.forEach(item => {
        try { new Notification(item.title, { body: item.body, tag: item.key || item.id }); } catch {}
      });
    }
  }

  // Re-render active views smoothly without disrupting active text inputs
  renderNotifications();
  renderPersonalWork();
  if (!$('#chat-view')?.hidden) renderClassCommunication();
  if (!$('#class-workspace')?.hidden) {
    render();
    window.__featuresApp?.updateSessionStateUI?.();
    window.__featuresApp?.initSessionNoHomework?.();
  }
  if ($('#class-general-view') && !$('#class-general-view').hidden) {
    renderClassGeneralView(CURRENT_CLASS_ID);
  }
  if ($('#main-menu-view') && !$('#main-menu-view').hidden) {
    if (!$('#work-menu-panel')?.hidden || !$('#management-menu-panel')?.hidden) {
      renderMainMenu();
    }
    if ($('#mgmt-panel-students') && !$('#mgmt-panel-students').hidden) {
      window.__featuresApp?.renderMasterStudentDirectory?.();
    }
    if ($('#mgmt-panel-staff') && !$('#mgmt-panel-staff').hidden) {
      window.__featuresApp?.renderStaffManagement?.();
    }
    if ($('#mgmt-panel-templates') && !$('#mgmt-panel-templates').hidden) {
      window.__featuresApp?.renderRoomTemplatesList?.();
    }
    if ($('#tutoring-menu-panel') && !$('#tutoring-menu-panel').hidden) {
      window.__featuresApp?.renderTutoringModule?.();
    }
    if ($('#portal-menu-panel') && !$('#portal-menu-panel').hidden) {
      window.__featuresApp?.renderTAPortal?.();
    }
  }
}

const realtimeController = initRealtimeSync((changedKeys, source) => {
  refreshUIOnRealtimeUpdate(changedKeys, source);
});

realtimeController.onStatusChange(({ state, lastSyncTime }) => {
  const badge = $('#realtime-sync-badge');
  if (!badge) return;
  const timeStr = new Date(lastSyncTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const modeLabel = state === 'realtime-server'
    ? '● Đồng bộ LAN Real-time'
    : state === 'realtime-cloud'
      ? '● Đồng bộ Cloud Real-time'
      : '● Đồng bộ Real-time';
  badge.innerHTML = `<span class="rt-dot"></span><span>${modeLabel} · ${timeStr}</span>`;
  badge.classList.add('rt-pulse');
  clearTimeout(badge._pulseTimer);
  badge._pulseTimer = setTimeout(() => badge.classList.remove('rt-pulse'), 600);
});

document.addEventListener('click', (e) => {
  const rtBadge = e.target.closest('#realtime-sync-badge');
  if (rtBadge) {
    forceSyncNow('manual-click');
    toast('Đã đồng bộ dữ liệu thời gian thực mới nhất.');
    return;
  }

  // Global resilient delegation for main menu & sidebar tabs
  if (e.target.closest('#work-menu-nav') || e.target.closest('#work-menu-tab')) {
    setMainMenuPanel('work');
    return;
  }
  if (e.target.closest('#tutoring-menu-nav') || e.target.closest('#tutoring-menu-tab-btn')) {
    setMainMenuPanel('tutoring');
    return;
  }
  if (e.target.closest('#management-menu-nav') || e.target.closest('#management-menu-tab')) {
    setMainMenuPanel('management');
    return;
  }
  if (e.target.closest('#portal-menu-nav') || e.target.closest('#portal-menu-tab-btn')) {
    setMainMenuPanel('portal');
    return;
  }
  if (e.target.closest('#staff-menu-nav')) {
    setMainMenuPanel('management');
    $('#mgmt-tab-staff')?.click();
    return;
  }

  // Class workspace subtabs delegation
  if (e.target.closest('#chat-view-tab') || e.target.closest('#class-chat-nav')) {
    setClassView('chat');
    updateSubtabUrl('chatlog');
    return;
  }
  if (e.target.closest('#seating-view-tab') || e.target.closest('#class-room-nav')) {
    setClassView('seating');
    updateSubtabUrl('map');
    return;
  }
  if (e.target.closest('#scores-view-tab') || e.target.closest('#scores-sidebar-tab')) {
    setClassView('scores');
    updateSubtabUrl('scores');
    return;
  }
  if (e.target.closest('#checklist-view-tab') || e.target.closest('#checklist-sidebar-tab')) {
    setClassView('checklist');
    updateSubtabUrl('checklist');
    return;
  }
  if (e.target.closest('#students-view-tab') || e.target.closest('#students-tab')) {
    setClassView('students');
    updateSubtabUrl('students');
    return;
  }
});

if (!features?.checkAuthStatus || features.checkAuthStatus()) {
  handleRoute();
}


// ============================================================================
// v1.2 FEATURES:
// 1. Seating Map Quick Search (#seating-map-search-input & dropdown)
// 2. Find Seat Button ([data-find-seat-student]) from Student Lists to Map
// 3. Manual Score Entry Dialog (#manual-score-dialog) with Search & Enter nav
// 4. Universal Clear "×" Button on All Search Inputs
// ============================================================================

function renderSeatingMapSearchResults() {
  const input = $('#seating-map-search-input');
  const dropdown = $('#seating-map-search-results');
  if (!input || !dropdown) return;
  const rawQuery = input.value.trim();
  render(); // Re-render map so .seat-search-match highlights update
  if (!rawQuery) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    return;
  }

  const placements = new Map(allEntries().filter(({ entry }) => entry.studentId).map(place => [place.entry.studentId, place]));
  const lateSet = new Set(lateQueue);
  const pool = [...classStudents(), ...makeupStudents.filter(m => m.attendingClassId === CURRENT_CLASS_ID || placements.has(m.id) || lateSet.has(m.id))];
  const matches = searchStudents(pool, rawQuery).slice(0, 10);

  if (!matches.length) {
    dropdown.innerHTML = '<div style="padding:8px 10px; font-size:10px; color:#7b8c7e; font-style:italic;">Không tìm thấy học sinh phù hợp trong lớp.</div>';
    dropdown.hidden = false;
    return;
  }

  dropdown.innerHTML = matches.map(s => {
    const place = placements.get(s.id);
    const deskSpot = place && desks().find(item => item.desk.id === place.deskId);
    const inLate = lateSet.has(s.id);
    const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(CURRENT_CLASS_ID);
    const seatLabel = deskSpot
      ? `Dãy ${deskSpot.ci + 1} · Bàn ${deskSpot.di + 1} (Vị trí ${place.index + 1})`
      : inLate
        ? 'Đang ở khu vực Đi muộn'
        : 'Chưa xếp vào bàn';
    const seatColor = deskSpot ? '#15803d' : inLate ? '#b45309' : '#6b7280';

    return `<button type="button" class="seating-search-result-item" data-locate-seat-student="${escapeHtml(s.id)}">
      <div>
        <strong style="color:${isMakeup ? '#581c87' : '#1e3a29'};">${escapeHtml(s.name)}</strong>
        ${isMakeup ? '<span class="makeup-status-badge">🔄 Học bù</span>' : ''}
        <small style="display:block; color:#6c7d70; font-size:9px;">${escapeHtml(s.studentCode || s.school || s.sourceClassName || '')}</small>
      </div>
      <span class="room-chip" style="font-size:8.5px; font-weight:700; color:${seatColor};">${escapeHtml(seatLabel)}</span>
    </button>`;
  }).join('');
  dropdown.hidden = false;

  dropdown.querySelectorAll('[data-locate-seat-student]').forEach(btn => {
    btn.onclick = () => {
      const stuId = btn.dataset.locateSeatStudent;
      dropdown.hidden = true;
      highlightStudentSeat(stuId);
    };
  });
}

const seatingMapSearchInput = $('#seating-map-search-input');
if (seatingMapSearchInput) {
  seatingMapSearchInput.addEventListener('input', renderSeatingMapSearchResults);
  seatingMapSearchInput.addEventListener('focus', () => {
    if (seatingMapSearchInput.value.trim()) renderSeatingMapSearchResults();
  });
  seatingMapSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstBtn = $('#seating-map-search-results')?.querySelector('[data-locate-seat-student]');
      if (firstBtn) firstBtn.click();
    }
  });
}

document.addEventListener('click', (e) => {
  const wrap = $('#seating-map-search-wrap');
  const dropdown = $('#seating-map-search-results');
  if (wrap && dropdown && !wrap.contains(e.target)) {
    dropdown.hidden = true;
  }

  // Find seat button from any student list (#students-view, #general-roster-table, #students-dialog)
  const findSeatBtn = e.target.closest('[data-find-seat-student]');
  if (findSeatBtn) {
    e.preventDefault();
    e.stopPropagation();
    const stuId = findSeatBtn.dataset.findSeatStudent;
    const targetClassId = findSeatBtn.dataset.findSeatClass || CURRENT_CLASS_ID;
    $('#students-dialog')?.close();
    if ($('#class-general-view') && !$('#class-general-view').hidden) {
      enterClass(targetClassId, checklistDate || new Date().toLocaleDateString('sv-SE'), false, 'seating');
    } else {
      setClassView('seating');
      updateSubtabUrl('map');
    }
    setTimeout(() => {
      highlightStudentSeat(stuId);
    }, 120);
    return;
  }
});

// ============================================================================
// v1.3: TAB NHẬP ĐIỂM (#scores-view) & HỘP THOẠI XEM KỸ ĐIỂM HỌC SINH (#student-score-history-dialog)
// ============================================================================

function formatScoreVN(val) {
  if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) return '/';
  const num = Number(val);
  return String(num).replace('.', ',');
}

function formatShortDayMonth(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${Number(parts[2])}/${Number(parts[1])}`;
  }
  return dateStr;
}

/**
 * Trả về danh sách lịch sử điểm chi tiết của học sinh trong lớp:
 * Mỗi phần tử gồm: { scoreDisplay, statusDisplay, lessonDisplay, date, kind }
 * Với điểm BTVN: luôn ghi theo ngày và tên bài học của buổi thu & chấm bài.
 */
function getStudentScoreHistoryEntries(student, classId = CURRENT_CLASS_ID) {
  if (!student) return [];
  const allHistSessions = window.__featuresApp?.loadSessionHistory
    ? window.__featuresApp.loadSessionHistory()
    : (typeof sessionHistoryRepo.loadSessionHistory === 'function' ? sessionHistoryRepo.loadSessionHistory() : []);
  const classSessions = allHistSessions.filter(s => s.classId === classId);

  // Collect all past dates for this class from session history, student sessionNotes, attendanceHistory, and scores
  const dateSet = new Set();
  classSessions.forEach(cs => {
    if (cs.date && cs.date !== checklistDate) dateSet.add(cs.date);
  });
  (student.sessionNotes || []).forEach(sn => {
    if ((sn.classId === classId || !sn.classId) && sn.date && sn.date !== checklistDate) dateSet.add(sn.date);
  });
  (student.attendanceHistory || []).forEach(ah => {
    if ((ah.classId === classId || !ah.classId) && ah.date && ah.date !== checklistDate) dateSet.add(ah.date);
  });
  (student.scores || []).forEach(sc => {
    if ((sc.classId === classId || !sc.classId) && sc.date && sc.date !== checklistDate) dateSet.add(sc.date);
  });

  const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  const entries = [];

  for (const date of sortedDates) {
    const shortDM = formatShortDayMonth(date);
    const sess = classSessions.find(cs => cs.date === date);
    const snap = sess?.studentsSnapshot?.find(s => s.studentId === student.id);
    const sn = (student.sessionNotes || []).find(n => (n.classId === classId || !n.classId) && n.date === date);
    const att = (student.attendanceHistory || []).find(h => (h.classId === classId || !h.classId) && h.date === date);
    const dayScores = (student.scores || []).filter(sc => (sc.classId === classId || !sc.classId) && sc.date === date);

    const testScoreObj = dayScores.find(sc => sc.type && sc.type.toLowerCase() !== 'btvn');
    const btvnScoreObj = dayScores.find(sc => !sc.type || sc.type.toLowerCase() === 'btvn');

    const lessonTitle = sn?.lessonTitle
      || sess?.lessonTitle
      || testScoreObj?.lessonTitle
      || btvnScoreObj?.lessonTitle
      || `Buổi học ${shortDM}`;

    const attStatus = snap?.attendance?.status || att?.status || 'present';
    const isAbsent = attStatus === 'absent' || attStatus === 'absent_excused' || attStatus === 'absent_unexcused';
    const noteText = (sn?.note ?? snap?.note ?? '').trim();

    // 1. Nếu buổi đó có bài Test -> thêm dòng Test trước (cùng ngày)
    const testVal = sn?.testScore ?? snap?.testScore ?? testScoreObj?.score;
    if (testVal !== undefined) {
      let testStatusText = sn?.attendanceStatusOverride || '';
      if (!testStatusText) {
        const baseAtt = isAbsent ? 'Vắng' : attStatus === 'late' ? 'Có đi học (Đi muộn)' : 'Có đi học';
        testStatusText = noteText && !sn?.homeworkStatusNote ? `${baseAtt} - ${noteText}` : baseAtt;
      }
      entries.push({
        date,
        kind: 'Test',
        scoreRaw: testVal,
        scoreDisplay: formatScoreVN(testVal),
        statusDisplay: testStatusText,
        lessonDisplay: `Test ${shortDM}: ${lessonTitle}`
      });
    }

    // 2. Dòng BTVN của buổi thu bài (ghi tên bài học của buổi thu & chấm bài hôm đó)
    const hwVal = sn?.homeworkScore !== undefined
      ? sn.homeworkScore
      : (snap?.homework?.score !== undefined ? snap.homework.score : btvnScoreObj?.score);
    const hwStatus = sn?.homeworkStatus || snap?.homework?.status || (hwVal !== null && hwVal !== undefined ? 'graded' : 'uncollected');

    let btvnStatusText = sn?.homeworkStatusNote || '';
    if (!btvnStatusText) {
      let base = 'Có đi học';
      if (isAbsent) {
        base = 'Vắng';
      } else if (hwStatus === 'not_submitted') {
        base = 'Có đi học (Không làm BTVN)';
      } else if (attStatus === 'late') {
        base = 'Có đi học (Đi muộn)';
      }
      btvnStatusText = noteText ? `${base} - ${noteText}` : base;
    }

    entries.push({
      date,
      kind: 'BTVN',
      scoreRaw: hwVal ?? null,
      scoreDisplay: formatScoreVN(hwVal),
      statusDisplay: btvnStatusText,
      lessonDisplay: `BTVN ${shortDM}: ${lessonTitle}`
    });
  }

  return entries;
}

function getRecentFourScoresSummary(student, classId = CURRENT_CLASS_ID) {
  const historyEntries = getStudentScoreHistoryEntries(student, classId);
  const recentFour = historyEntries.slice(0, 4).map(e => e.scoreDisplay);
  while (recentFour.length < 4) {
    recentFour.push('/');
  }
  return recentFour.join('; ');
}

function openStudentScoreHistoryDialog(studentId) {
  const student = studentById(studentId);
  if (!student) return;
  const dialog = $('#student-score-history-dialog');
  if (!dialog) return;

  const isMakeup = student.studentType === 'makeup' || !(student.classIds || []).includes(CURRENT_CLASS_ID);
  const schoolOrMakeup = isMakeup
    ? `Học Bù (${student.sourceClassName || student.school || 'T2'})`
    : (student.school || 'Chưa rõ trường');

  const titleEl = $('#score-history-dialog-title');
  if (titleEl) {
    titleEl.textContent = `Điểm của học sinh ${student.name} - ${schoolOrMakeup}`;
  }

  const learningInput = $('#score-history-learning-note');
  if (learningInput) {
    learningInput.value = student.learningNotes || '';
    learningInput.oninput = () => {
      student.learningNotes = learningInput.value;
      saveStudentRecords(students, makeupStudents);
      save();
      // Sync input in scores tab if open
      const rowLearningInput = document.querySelector(`[data-learning-note="${CSS.escape(student.id)}"]`);
      if (rowLearningInput && document.activeElement !== rowLearningInput) {
        rowLearningInput.value = student.learningNotes;
      }
    };
  }

  const entries = getStudentScoreHistoryEntries(student, CURRENT_CLASS_ID);
  const tbody = $('#score-history-tbody');
  if (tbody) {
    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:18px; color:#87968a;">Chưa có lịch sử điểm các buổi trước cho học sinh này.</td></tr>';
    } else {
      tbody.innerHTML = entries.map(item => {
        const isMissing = item.scoreDisplay === '/';
        return `<tr>
          <td style="text-align:center;"><span class="score-history-val ${isMissing ? 'missing' : ''}">${escapeHtml(item.scoreDisplay)}</span></td>
          <td><strong>${escapeHtml(item.statusDisplay)}</strong></td>
          <td>${escapeHtml(item.lessonDisplay)}</td>
        </tr>`;
      }).join('');
    }
  }

  dialog.showModal();
}

$('#close-score-history-dialog')?.addEventListener('click', () => $('#student-score-history-dialog')?.close());
$('#close-score-history-btn')?.addEventListener('click', () => $('#student-score-history-dialog')?.close());

function applyStudentManualScore(studentId, field, rawValue) {
  const student = studentById(studentId);
  if (!student) return;
  const cleanVal = String(rawValue ?? '').trim().replace(',', '.');
  const numVal = cleanVal === '' ? null : Math.max(0, Math.min(10, Number(cleanVal)));
  if (cleanVal !== '' && isNaN(numVal)) return;

  const seated = allEntries().find(e => e.entry.studentId === studentId);
  if (field === 'hw') {
    const prevHw = seated?.entry.homework || student.homework || { status: 'uncollected' };
    const nextStatus = numVal !== null
      ? 'graded'
      : (prevHw.status === 'graded' ? 'submitted' : (prevHw.status || 'uncollected'));
    const nextHw = {
      ...prevHw,
      status: nextStatus,
      score: numVal
    };
    if (seated) {
      seated.entry.homework = nextHw;
      seated.entry.homeworkSaved = true;
    }
    student.homework = nextHw;
    recordStudentScore(student, numVal, 'BTVN');
    recordHistory(student, seated?.entry.attendance || student.attendance || { status: seated ? 'present' : 'unrecorded' }, nextHw);
  } else if (field === 'test') {
    checklist.testScores = checklist.testScores || {};
    if (numVal === null) {
      delete checklist.testScores[studentId];
    } else {
      checklist.testScores[studentId] = numVal;
    }
    if (seated) {
      seated.entry.testScore = numVal;
    }
    student.testScore = numVal;
    recordStudentScore(student, numVal, 'Test');
    saveChecklist();
  }
  save();
  const statusEl = $('#scores-tab-save-status');
  if (statusEl) {
    statusEl.textContent = `✓ Đã lưu điểm của ${student.name} lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }
}

function saveStudentLearningNote(studentId, value) {
  const student = studentById(studentId);
  if (!student) return;
  student.learningNotes = value;
  saveStudentRecords(students, makeupStudents);
  save();
  const statusEl = $('#scores-tab-save-status');
  if (statusEl) {
    statusEl.textContent = `✓ Đã lưu ghi chú học lực của ${student.name}`;
  }
}

function renderScoresView() {
  const tbody = $('#scores-tab-tbody');
  if (!tbody) return;

  // Do not wipe DOM if user is actively typing inside #scores-tab-tbody
  if (document.activeElement && tbody.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
    return;
  }

  const hasTest = Boolean(checklist.testRequired);
  if ($('#scores-tab-test-toggle')) $('#scores-tab-test-toggle').checked = hasTest;
  const testTh = $('#scores-tab-test-th');
  if (testTh) testTh.hidden = !hasTest;

  const query = ($('#scores-tab-search')?.value || '').trim();
  const filter = $('#scores-tab-filter')?.value || 'all';

  const placements = new Map(allEntries().filter(({ entry }) => entry.studentId).map(place => [place.entry.studentId, place]));
  const lateSet = new Set(lateQueue);

  const byGivenName = (a, b) => {
    const aParts = splitStudentName(a.name);
    const bParts = splitStudentName(b.name);
    return (a.givenName || aParts.givenName).localeCompare(b.givenName || bParts.givenName, 'vi')
      || (a.familyName || aParts.familyName).localeCompare(b.familyName || bParts.familyName, 'vi');
  };

  const regularList = [...classStudents()];
  const makeupList = makeupStudents.filter(m => m.attendingClassId === CURRENT_CLASS_ID || placements.has(m.id) || lateSet.has(m.id));
  const combinedStudents = [...regularList, ...makeupList];

  const buildScoreRowItem = (s) => {
    const place = placements.get(s.id);
    const inLate = lateSet.has(s.id);
    const attHist = (s.attendanceHistory || []).find(h => h.classId === CURRENT_CLASS_ID && h.date === checklistDate);
    const sessNote = (s.sessionNotes || []).find(n => n.classId === CURRENT_CLASS_ID && n.date === checklistDate);

    const attendance = place?.entry.attendance
      || (inLate ? (s.attendance || { status: 'late', lateMinutes: 10 }) : null)
      || (attHist ? { status: attHist.status, reason: attHist.reason, lateMinutes: attHist.lateMinutes || attHist.minutesLate || 10 } : null);

    const hw = place?.entry.homework
      || (inLate && s.homework ? s.homework : null)
      || (sessNote?.homeworkStatus ? { status: sessNote.homeworkStatus, score: sessNote.homeworkScore ?? null, reason: sessNote.homeworkReason || '' } : null)
      || { status: 'uncollected', score: null };

    const attStatus = attendance?.status || 'unrecorded';
    const hwStatus = hw?.status || 'uncollected';
    const isAttended = Boolean(place || inLate || attStatus === 'present' || attStatus === 'late');
    const isHwCollected = hwStatus === 'submitted' || hwStatus === 'graded';

    // Priority Group:
    // 1: Đã điểm danh + Đã thu BTVN
    // 2: Đã điểm danh - Chưa thu / Không nộp BTVN
    // 3: Chưa được điểm danh / Vắng mặt
    const priorityGroup = isAttended ? (isHwCollected ? 1 : 2) : 3;

    const isMakeup = s.studentType === 'makeup' || !(s.classIds || []).includes(CURRENT_CLASS_ID);
    const schoolDisplay = isMakeup
      ? `Học Bù (${s.sourceClassName || s.school || 'T2'})`
      : (s.school || '—');

    const hwScore = hw?.score ?? null;
    const testScore = place?.entry.testScore ?? checklist.testScores?.[s.id] ?? s.testScore ?? null;
    const parts = splitStudentName(s.name);
    const recentFour = getRecentFourScoresSummary(s, CURRENT_CLASS_ID);

    return {
      student: s,
      familyName: s.familyName ?? parts.familyName,
      givenName: s.givenName ?? parts.givenName,
      schoolDisplay,
      isMakeup,
      attStatus,
      attendance,
      hwStatus,
      hw,
      hwScore,
      testScore,
      priorityGroup,
      recentFour,
      note: sessionNoteFor(s.id) || '',
      learningNotes: s.learningNotes || ''
    };
  };

  let items = combinedStudents.map(buildScoreRowItem);

  if (query) {
    const matchedIds = new Set(searchStudents(items.map(r => r.student), query).map(s => s.id));
    items = items.filter(r => matchedIds.has(r.student.id));
  }
  if (filter === 'group1') items = items.filter(r => r.priorityGroup === 1);
  if (filter === 'group2') items = items.filter(r => r.priorityGroup === 2);
  if (filter === 'group3') items = items.filter(r => r.priorityGroup === 3);
  if (filter === 'makeup') items = items.filter(r => r.isMakeup);

  // Sort strictly by priorityGroup (1 -> 2 -> 3), then alphabetically by Vietnamese givenName
  items.sort((a, b) => {
    if (a.priorityGroup !== b.priorityGroup) return a.priorityGroup - b.priorityGroup;
    return byGivenName(a.student, b.student);
  });

  const colCount = hasTest ? 9 : 8;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding:18px; color:#87968a;">Không có học sinh nào phù hợp với bộ lọc.</td></tr>`;
    return;
  }

  const groupLabels = {
    1: '✓ NHÓM 1: ĐÃ ĐIỂM DANH + ĐÃ THU BTVN',
    2: '⚠ NHÓM 2: ĐÃ ĐIỂM DANH · CHƯA THU / KHÔNG NỘP BTVN',
    3: '○ NHÓM 3: CHƯA ĐƯỢC ĐIỂM DANH / VẮNG MẶT'
  };

  let lastGroup = null;
  const htmlRows = [];

  for (const item of items) {
    if (item.priorityGroup !== lastGroup) {
      lastGroup = item.priorityGroup;
      const groupCount = items.filter(x => x.priorityGroup === lastGroup).length;
      htmlRows.push(`
        <tr class="scores-group-divider-row group-${lastGroup}">
          <td colspan="${colCount}">${groupLabels[lastGroup]} (${groupCount} học sinh)</td>
        </tr>
      `);
    }

    const s = item.student;
    const attText = item.attStatus === 'present'
      ? '<span class="student-state state-present">✓ Có mặt</span>'
      : item.attStatus === 'late'
        ? `<span class="student-state state-late">⏱ Đi muộn${item.attendance?.lateMinutes ? ` (${item.attendance.lateMinutes}p)` : ''}</span>`
        : (item.attStatus === 'absent' || item.attStatus === 'absent_excused' || item.attStatus === 'absent_unexcused')
          ? `<span class="student-state state-missing">× ${item.attStatus === 'absent_excused' ? 'Vắng có phép' : 'Vắng mặt'}</span>`
          : '<span class="student-state state-pending">Chưa điểm danh</span>';

    const hwText = item.hwStatus === 'graded' || item.hwStatus === 'submitted'
      ? '<span class="student-state state-collected">Đã thu BTVN</span>'
      : item.hwStatus === 'not_submitted'
        ? `<span class="student-state state-missing">Không nộp BTVN${item.hw?.reason ? ` (${escapeHtml(item.hw.reason)})` : ''}</span>`
        : '<span class="student-state state-pending">Chưa thu BTVN</span>';

    htmlRows.push(`
      <tr class="${item.isMakeup ? 'makeup-row-tr' : ''}" data-score-row-student="${escapeHtml(s.id)}">
        <td>${escapeHtml(item.familyName || '—')}</td>
        <td>
          <strong style="color:${item.isMakeup ? '#581c87' : '#214e2d'};">${escapeHtml(item.givenName || s.name)}</strong>
          ${renderInlineTags(s)}
        </td>
        <td>
          ${item.isMakeup
            ? `<span class="makeup-status-badge" style="margin-left:0;">${escapeHtml(item.schoolDisplay)}</span>`
            : escapeHtml(item.schoolDisplay)}
        </td>
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            ${attText}
            ${item.priorityGroup !== 3 ? hwText : ''}
          </div>
        </td>
        <td style="text-align:center;">
          <button type="button" class="recent-scores-btn" data-open-score-history="${escapeHtml(s.id)}" title="Click để xem chi tiết điểm các buổi trước của ${escapeHtml(s.name)}">
            <span>${escapeHtml(item.recentFour)}</span>
            <small style="font-size:9px; opacity:0.8;">🔍</small>
          </button>
        </td>
        <td style="text-align:center;">
          <input type="number" min="0" max="10" step="0.25" class="manual-score-input" data-score-tab-hw="${escapeHtml(s.id)}" value="${item.hwScore !== null && item.hwScore !== undefined ? escapeHtml(item.hwScore) : ''}" placeholder="0 - 10" aria-label="Điểm BTVN ${escapeHtml(s.name)}" />
        </td>
        ${hasTest ? `
          <td style="text-align:center;">
            <input type="number" min="0" max="10" step="0.25" class="manual-score-input" data-score-tab-test="${escapeHtml(s.id)}" value="${item.testScore !== null && item.testScore !== undefined ? escapeHtml(item.testScore) : ''}" placeholder="0 - 10" aria-label="Điểm Test ${escapeHtml(s.name)}" />
          </td>
        ` : ''}
        <td>
          <input type="text" class="attendance-note-input" data-session-note="${escapeHtml(s.id)}" value="${escapeHtml(item.note)}" placeholder="Ghi chú buổi học..." style="width:100%;" />
        </td>
        <td>
          <input type="text" class="attendance-note-input" data-learning-note="${escapeHtml(s.id)}" value="${escapeHtml(item.learningNotes)}" placeholder="Ghi chú học lực chung..." style="width:100%;" />
        </td>
      </tr>
    `);
  }

  tbody.innerHTML = htmlRows.join('');

  // Wire click on recent-scores-btn to open detailed score history modal
  tbody.querySelectorAll('[data-open-score-history]').forEach(btn => {
    btn.onclick = () => openStudentScoreHistoryDialog(btn.dataset.openScoreHistory);
  });

  // Wire score inputs & Enter/Arrow navigation
  const wireInputs = (selector, field) => {
    const inputs = [...tbody.querySelectorAll(selector)];
    inputs.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        const stuId = inp.dataset[field === 'hw' ? 'scoreTabHw' : 'scoreTabTest'];
        applyStudentManualScore(stuId, field, inp.value);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = inputs[idx + 1];
          if (next) { next.focus(); next.select?.(); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = inputs[idx - 1];
          if (prev) { prev.focus(); prev.select?.(); }
        }
      });
    });
  };
  wireInputs('[data-score-tab-hw]', 'hw');
  if (hasTest) wireInputs('[data-score-tab-test]', 'test');

  // Wire learning notes input
  tbody.querySelectorAll('[data-learning-note]').forEach(inp => {
    inp.addEventListener('input', () => {
      saveStudentLearningNote(inp.dataset.learningNote, inp.value);
    });
  });
}

$('#scores-tab-search')?.addEventListener('input', renderScoresView);
$('#scores-tab-filter')?.addEventListener('change', renderScoresView);

// Universal Clear "×" Button on All Search Inputs
function initSearchClearButtons() {
  const selectors = [
    '#seating-map-search-input',
    '#student-list-search',
    '#scores-tab-search',
    '#student-search',
    '#late-search',
    '#master-student-search',
    '#tutoring-search',
    '#tutoring-student-search-input',
    '#staff-search-input'
  ];
  selectors.forEach(sel => {
    const input = document.querySelector(sel);
    if (!input || input.dataset.clearBtnEnhanced === '1') return;
    input.dataset.clearBtnEnhanced = '1';
    const parent = input.parentElement;
    if (!parent) return;
    parent.classList.add('search-clear-wrap');
    input.style.paddingRight = '26px';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'search-clear-x-btn';
    clearBtn.textContent = '×';
    clearBtn.title = 'Xóa nội dung tìm kiếm';
    clearBtn.setAttribute('aria-label', 'Xóa nội dung tìm kiếm');
    clearBtn.hidden = !input.value;
    parent.appendChild(clearBtn);

    const syncVisibility = () => {
      clearBtn.hidden = !input.value;
    };
    input.addEventListener('input', syncVisibility);
    input.addEventListener('change', syncVisibility);
    input.addEventListener('focus', syncVisibility);

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      clearBtn.hidden = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
    });
  });
}
initSearchClearButtons();
