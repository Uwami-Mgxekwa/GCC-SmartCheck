/**
 * GCC SmartCheck — app.js
 * Authentication via Back4App (Parse Platform).
 * Config is loaded from js/config.js (sourced from .env).
 */

// ─────────────────────────────────────────────────────────────────────────────
// PARSE INIT
// ─────────────────────────────────────────────────────────────────────────────

// Parse SDK is loaded via CDN in each HTML page before this script.
function initParse() {
  if (typeof Parse === 'undefined') {
    console.error('Parse SDK not loaded.');
    return;
  }
  Parse.initialize(GCC_CONFIG.parse.appId, GCC_CONFIG.parse.clientKey);
  Parse.serverURL = GCC_CONFIG.parse.serverURL;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: 'check-circle', danger: 'x-circle', info: 'info', warning: 'warning' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="ph ph-${icons[type] || 'info'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(8, '0');
}

const Store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn('localStorage write failed:', e); }
  },
  remove(key) { localStorage.removeItem(key); }
};

function todayISO() { return new Date().toISOString().split('T')[0]; }

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current Parse session user, or null.
 * We also cache the role in localStorage so pages can read it synchronously.
 */
function getCurrentUser() {
  return Store.get('gcc_session');
}

function isLoggedIn() {
  const s = Store.get('gcc_session');
  // Session expires after 8 hours
  return s && s.role === 'lecturer' && (Date.now() - s.ts) < 8 * 60 * 60 * 1000;
}

/**
 * Redirect to login if not authenticated.
 * Called at the top of protected pages (dashboard, scan).
 */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '../index.html';
  }
}

/**
 * Sign out and go back to the landing page.
 */
async function logout() {
  Store.remove('gcc_session');
  window.location.href = '../index.html';
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE  (index.html)
// ─────────────────────────────────────────────────────────────────────────────

function initLogin() {
  initParse();
  if (!document.getElementById('login-form')) return;

  // Already logged in → go straight to dashboard
  if (isLoggedIn()) {
    window.location.href = 'pages/dashboard.html';
    return;
  }

  window.currentRole = 'lecturer';
}
function switchRole(role) {
  window.currentRole = role;
  document.getElementById('tab-lecturer').classList.toggle('active', role === 'lecturer');
  document.getElementById('tab-student').classList.toggle('active', role === 'student');

  // Username field and login form only shown for lecturer
  const usernameGroup = document.getElementById('username-group');
  const loginForm     = document.getElementById('login-form');
  const lecturerNote  = document.getElementById('lecturer-note');

  if (role === 'student') {
    // Students don't log in — they register
    usernameGroup.style.display = 'none';
    if (loginForm)    loginForm.style.display    = 'none';
    if (lecturerNote) lecturerNote.style.display = 'none';
  } else {
    usernameGroup.style.display = 'block';
    if (loginForm)    loginForm.style.display    = 'block';
    if (lecturerNote) lecturerNote.style.display = 'block';
  }

  // Show/hide the register shortcut
  const registerBtn = document.getElementById('register-shortcut');
  if (registerBtn) registerBtn.style.display = role === 'lecturer' ? 'none' : 'block';

  clearLoginAlert();
}

function togglePassword() {
  const pw   = document.getElementById('password');
  const icon = document.getElementById('toggle-pw');
  if (pw.type === 'password') {
    pw.type = 'text';
    icon.className = 'ph ph-eye-slash input-icon-right';
  } else {
    pw.type = 'password';
    icon.className = 'ph ph-eye input-icon-right';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin .8s linear infinite"></i> Signing in…';

  if (window.currentRole === 'lecturer') {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      // Use REST API with master key — Back4App blocks client key on login endpoint
      const response = await fetch(
        GCC_CONFIG.parse.serverURL + '/login?username=' +
          encodeURIComponent(username) + '&password=' + encodeURIComponent(password),
        {
          method: 'GET',
          headers: {
            'X-Parse-Application-Id': GCC_CONFIG.parse.appId,
            'X-Parse-Master-Key':     GCC_CONFIG.parse.masterKey
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Only allow lecturers
      if (data.role !== 'lecturer') {
        showLoginAlert('Access denied. This login is for lecturers only.', 'danger');
        resetLoginBtn(btn);
        return;
      }

      // Store session info locally
      Store.set('gcc_session', {
        role:        data.role,
        username:    data.username,
        name:        data.displayName || data.username,
        sessionToken: data.sessionToken,
        ts:          Date.now()
      });

      showToast('Welcome back, ' + (data.displayName || username) + '!', 'success');
      setTimeout(() => { window.location.href = 'pages/dashboard.html'; }, 800);

    } catch (err) {
      showLoginAlert('Invalid username or password.', 'danger');
      resetLoginBtn(btn);
    }

  } else {
    // Student tab → redirect to registration (no student login)
    window.location.href = 'pages/register.html';
  }
}

function resetLoginBtn(btn) {
  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-sign-in"></i> Sign In';
}

function showLoginAlert(msg, type) {
  const el   = document.getElementById('login-alert');
  const icon = type === 'danger' ? 'warning-circle' : 'check-circle';
  el.className = `alert alert-${type}`;
  el.innerHTML = `<i class="ph ph-${icon}"></i><span>${msg}</span>`;
  el.classList.remove('hidden');
}

function clearLoginAlert() {
  const el = document.getElementById('login-alert');
  if (el) { el.className = 'hidden'; el.innerHTML = ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER PAGE  (pages/register.html)
// ─────────────────────────────────────────────────────────────────────────────

let currentIdType = 'id';
let generatedStudentId = null;

const idConfigs = {
  id: {
    label: 'SA ID Number', placeholder: '13-digit ID number',
    hint: 'Enter your 13-digit South African ID number', icon: 'ph-hash', type: 'text'
  },
  passport: {
    label: 'Passport Number', placeholder: 'e.g. A12345678',
    hint: 'Enter your passport number exactly as it appears', icon: 'ph-passport', type: 'text'
  },
  dob: {
    label: 'Date of Birth', placeholder: '',
    hint: 'Enter your date of birth', icon: 'ph-calendar', type: 'date'
  }
};

function setIdType(type) {
  currentIdType = type;
  ['id', 'passport', 'dob'].forEach(t => {
    document.getElementById('type-' + t).classList.toggle('active', t === type);
  });
  const cfg = idConfigs[type];
  document.getElementById('id-label').textContent = cfg.label;
  const inp = document.getElementById('identifier');
  inp.placeholder = cfg.placeholder;
  inp.type = cfg.type;
  inp.value = '';
  document.getElementById('id-hint').textContent = cfg.hint;
  document.getElementById('id-icon').className = `ph ${cfg.icon} input-icon`;
}

async function handleRegister(e) {
  e.preventDefault();
  const fname      = document.getElementById('fname').value.trim();
  const lname      = document.getElementById('lname').value.trim();
  const email      = document.getElementById('email').value.trim();
  const identifier = document.getElementById('identifier').value.trim();

  if (!fname || !lname || !identifier) {
    showRegAlert('Please fill in all required fields.', 'danger');
    return;
  }

  // Check for duplicate in localStorage (offline-first)
  const students  = Store.get('gcc_students', []);
  const duplicate = students.find(s =>
    s.fname.toLowerCase() === fname.toLowerCase() &&
    s.lname.toLowerCase() === lname.toLowerCase() &&
    s.identifier === identifier
  );

  if (duplicate) {
    showRegAlert('A student with these details is already registered.', 'warning');
    generatedStudentId = duplicate.id;
    renderQR(duplicate);
    return;
  }

  const raw  = fname.toLowerCase() + lname.toLowerCase() + identifier + Date.now();
  generatedStudentId = 'gcc-' + simpleHash(raw);

  const student = {
    id: generatedStudentId, fname, lname, email, identifier,
    idType: currentIdType, registeredAt: new Date().toISOString()
  };

  // Save locally
  students.push(student);
  Store.set('gcc_students', students);

  // Also save to Parse (best-effort — works offline too)
  try {
    initParse();
    const Student = Parse.Object.extend('Student');
    const obj = new Student();
    obj.set('studentId', student.id);
    obj.set('fname', fname);
    obj.set('lname', lname);
    obj.set('email', email || '');
    obj.set('identifier', identifier);
    obj.set('idType', currentIdType);
    await obj.save();
  } catch (err) {
    // Non-fatal: data is already in localStorage
    console.warn('Parse save failed (offline?):', err.message);
  }

  renderQR(student);
  showRegSuccess();
  showToast('Registration successful! QR code generated.', 'success');
}

function renderQR(student) {
  const output = document.getElementById('qr-output');
  output.innerHTML =
    '<div id="qr-canvas-wrap"></div>' +
    `<div class="qr-student-name">${student.fname} ${student.lname}</div>` +
    `<div class="qr-student-id">${student.id}</div>`;
  output.classList.add('has-qr');

  new QRCode(document.getElementById('qr-canvas-wrap'), {
    text: student.id, width: 180, height: 180,
    colorDark: '#0f172a', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('qr-actions').classList.remove('hidden');
}

function showRegSuccess() {
  document.getElementById('panel-1').classList.add('hidden');
  document.getElementById('panel-success').classList.remove('hidden');
  document.getElementById('step-1').classList.replace('active', 'done');
  document.getElementById('step-2').classList.add('done');
  document.getElementById('step-3').classList.add('active');
}

function downloadQR() {
  const canvas = document.querySelector('#qr-canvas-wrap canvas');
  if (!canvas) { showToast('Generate a QR code first.', 'danger'); return; }
  const link = document.createElement('a');
  link.download = generatedStudentId + '-qr.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('QR code downloaded.', 'success');
}

function printQR() {
  const canvas = document.querySelector('#qr-canvas-wrap canvas');
  if (!canvas) { showToast('Generate a QR code first.', 'danger'); return; }
  const students = Store.get('gcc_students', []);
  const student  = students.find(s => s.id === generatedStudentId);
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>GCC SmartCheck QR</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px}
    h2{margin-bottom:4px}p{color:#64748b;margin-bottom:24px}
    .id{font-family:monospace;font-size:.75rem;color:#94a3b8;margin-top:8px}</style>
    </head><body>
    <h2>${student ? student.fname + ' ' + student.lname : 'Student'}</h2>
    <p>GCC SmartCheck — Attendance QR Code</p>
    <img src="${canvas.toDataURL()}" style="width:220px;height:220px;border-radius:8px"/>
    <div class="id">${generatedStudentId}</div>
    </body></html>`);
  win.document.close();
  win.print();
}

function showRegAlert(msg, type) {
  const el   = document.getElementById('reg-alert');
  const icon = type === 'danger' ? 'warning-circle' : type === 'warning' ? 'warning' : 'check-circle';
  el.className = `alert alert-${type}`;
  el.innerHTML = `<i class="ph ph-${icon}"></i><span>${msg}</span>`;
  el.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE  (pages/dashboard.html)
// ─────────────────────────────────────────────────────────────────────────────

// Default courses seeded on first load — user can edit freely in the Courses tab
const DEFAULT_COURSES = {
  'System Development': ['Advanced Database Management Systems', 'Advanced Programming I'],
  'Office Administration': ['Digital Literacy']
};

/** Get courses map from localStorage, seeding defaults on first run */
function getCourses() {
  const stored = Store.get('gcc_courses');
  if (stored) return stored;
  Store.set('gcc_courses', DEFAULT_COURSES);
  return DEFAULT_COURSES;
}

/** Populate the course dropdown in Session Setup from stored courses */
function populateCourseDropdown() {
  const sel  = document.getElementById('sel-course');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select course…</option>';
  Object.keys(getCourses()).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c; sel.appendChild(opt);
  });
  if (prev) { sel.value = prev; updateModules(); }
}

function initDashboard() {
  initParse();
  requireAuth();

  const user = getCurrentUser();
  const displayName = user ? (user.name || user.username) : 'Lecturer';
  document.getElementById('welcome-msg').textContent =
    'Welcome back, ' + displayName + ' — manage sessions and view attendance.';

  document.getElementById('sel-date').value = todayISO();
  populateCourseDropdown();
  loadStats();
  loadAttendance();
  loadStudents();
  loadSessionConfig();
}

function updateModules() {
  const course  = document.getElementById('sel-course').value;
  const sel     = document.getElementById('sel-module');
  sel.innerHTML = '<option value="">Select module…</option>';
  (getCourses()[course] || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m; sel.appendChild(opt);
  });
}

function loadSessionConfig() {
  const s = Store.get('gcc_active_session');
  if (!s) return;
  populateCourseDropdown();
  document.getElementById('sel-course').value = s.course;
  updateModules();
  document.getElementById('sel-module').value = s.module;
  document.getElementById('sel-date').value   = s.date;
  setSessionBadge(true, s);
}

function saveSession() {
  const course = document.getElementById('sel-course').value;
  const module = document.getElementById('sel-module').value;
  const date   = document.getElementById('sel-date').value;
  if (!course || !module || !date) { showToast('Please fill in all session fields.', 'danger'); return; }
  Store.set('gcc_active_session', { course, module, date });
  setSessionBadge(true, { course, module, date });
  showToast('Session saved. Head to the scanner to start.', 'success');
}

function clearSession() {
  Store.remove('gcc_active_session');
  document.getElementById('sel-course').value = '';
  document.getElementById('sel-module').innerHTML = '<option value="">Select module…</option>';
  document.getElementById('sel-date').value = todayISO();
  setSessionBadge(false);
  showToast('Session cleared.', 'info');
}

function setSessionBadge(active, s) {
  const badge = document.getElementById('session-status-badge');
  const info  = document.getElementById('active-session-info');
  if (active) {
    badge.textContent = 'Session Active';
    badge.className   = 'badge badge-success';
    info.classList.remove('hidden');
    document.getElementById('active-session-text').textContent =
      `Active: ${s.course} — ${s.module} on ${s.date}`;
  } else {
    badge.textContent = 'No Active Session';
    badge.className   = 'badge badge-primary';
    info.classList.add('hidden');
  }
}

function loadStats() {
  const students   = Store.get('gcc_students', []);
  const attendance = Store.get('gcc_attendance', []);
  const today      = todayISO();
  const presentIds = [...new Set(attendance.filter(r => r.date === today).map(r => r.studentId))];
  document.getElementById('stat-students').textContent = students.length;
  document.getElementById('stat-present').textContent  = presentIds.length;
  document.getElementById('stat-sessions').textContent =
    [...new Set(attendance.map(r => r.date + r.module))].length;
  document.getElementById('stat-absent').textContent   =
    Math.max(0, students.length - presentIds.length);
}

let allAttendance = [];

function loadAttendance() {
  allAttendance = Store.get('gcc_attendance', []);
  renderAttendance(allAttendance);
  const modules = [...new Set(allAttendance.map(r => r.module))];
  const sel = document.getElementById('module-filter');
  sel.innerHTML = '<option value="">All Modules</option>';
  modules.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m; sel.appendChild(opt);
  });
}

function renderAttendance(records) {
  const tbody = document.getElementById('attendance-tbody');
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <i class="ph ph-clipboard-text"></i>
      <p>No attendance records yet. Start a session and scan students.</p>
      </div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...records].reverse().map(r => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-light);
          color:var(--primary);display:flex;align-items:center;justify-content:center;
          font-weight:700;font-size:.75rem;flex-shrink:0">
          ${(r.name || '?').charAt(0).toUpperCase()}
        </div>
        <span style="font-weight:500">${r.name || 'Unknown'}</span>
      </div></td>
      <td><code style="font-size:.75rem;color:var(--text-muted)">${r.studentId}</code></td>
      <td><span class="badge badge-primary">${r.module || '—'}</span></td>
      <td>${r.date || '—'}</td>
      <td>${r.time || '—'}</td>
      <td><span class="badge badge-success">Present</span></td>
    </tr>`).join('');
}

function filterAttendance(q) {
  renderAttendance(allAttendance.filter(r =>
    (r.name || '').toLowerCase().includes(q.toLowerCase()) ||
    (r.studentId || '').toLowerCase().includes(q.toLowerCase())
  ));
}

function filterByModule(mod) {
  renderAttendance(mod ? allAttendance.filter(r => r.module === mod) : allAttendance);
}

let allStudents = [];

function loadStudents() {
  allStudents = Store.get('gcc_students', []);
  renderStudents(allStudents);
}

function renderStudents(students) {
  const el = document.getElementById('students-list');
  if (!students.length) {
    el.innerHTML = `<div class="empty-state"><i class="ph ph-users"></i><p>No students registered yet.</p></div>`;
    return;
  }
  el.innerHTML = students.map(s => `
    <div class="student-row">
      <div class="student-avatar">${s.fname.charAt(0).toUpperCase()}</div>
      <div class="student-info">
        <div class="name">${s.fname} ${s.lname}</div>
        <div class="meta">${s.email || 'No email'} &bull; Registered ${new Date(s.registeredAt).toLocaleDateString()}</div>
      </div>
      <code style="font-size:.7rem;color:var(--text-muted)">${s.id}</code>
      <button class="btn btn-ghost btn-sm" onclick="deleteStudent('${s.id}')">
        <i class="ph ph-trash"></i>
      </button>
    </div>`).join('');
}

function filterStudents(q) {
  renderStudents(allStudents.filter(s =>
    (s.fname + ' ' + s.lname).toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase())
  ));
}

function deleteStudent(id) {
  if (!confirm('Remove this student? Their attendance records will remain.')) return;
  Store.set('gcc_students', Store.get('gcc_students', []).filter(s => s.id !== id));
  loadStudents(); loadStats();
  showToast('Student removed.', 'info');
}

function exportCSV() {
  if (!allAttendance.length) { showToast('No records to export.', 'danger'); return; }
  const header = 'Name,Student ID,Module,Date,Time,Status\n';
  const rows   = allAttendance.map(r =>
    `"${r.name}","${r.studentId}","${r.module}","${r.date}","${r.time}","Present"`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `gcc-attendance-${todayISO()}.csv`);
  showToast('CSV exported.', 'success');
}

function exportJSON() {
  if (!allAttendance.length) { showToast('No records to export.', 'danger'); return; }
  const blob = new Blob([JSON.stringify({ attendance: allAttendance }, null, 2)], { type: 'application/json' });
  saveAs(blob, `gcc-attendance-${todayISO()}.json`);
  showToast('JSON exported.', 'success');
}

function exportStudentsJSON() {
  if (!allStudents.length) { showToast('No students to export.', 'danger'); return; }
  const blob = new Blob([JSON.stringify({ students: allStudents }, null, 2)], { type: 'application/json' });
  saveAs(blob, 'gcc-students.json');
  showToast('Students exported.', 'success');
}

function clearAttendance() {
  if (!confirm('Clear all attendance records? This cannot be undone.')) return;
  Store.remove('gcc_attendance');
  allAttendance = []; renderAttendance([]); loadStats();
  showToast('Attendance records cleared.', 'info');
}

function clearStudents() {
  if (!confirm('Remove ALL registered students? This cannot be undone.')) return;
  Store.remove('gcc_students');
  allStudents = []; renderStudents([]); loadStats();
  showToast('All students removed.', 'info');
}

function switchTab(name) {
  const names = ['attendance', 'session', 'courses', 'students'];
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', names[i] === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'courses') renderCourseList();
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

let selectedCourse = null;

function renderCourseList() {
  const courses = getCourses();
  const keys    = Object.keys(courses);
  const el      = document.getElementById('course-list');
  document.getElementById('course-count').textContent = keys.length;

  if (!keys.length) {
    el.innerHTML = `<div class="empty-state" style="padding:32px 16px">
      <i class="ph ph-books"></i><p>No courses yet. Add one below.</p></div>`;
    return;
  }

  el.innerHTML = keys.map(name => `
    <div class="course-item ${name === selectedCourse ? 'active' : ''}"
         onclick="selectCourse('${name.replace(/'/g,"\\'")}')">
      <div class="course-item-icon"><i class="ph ph-chalkboard"></i></div>
      <div class="course-item-info">
        <div class="course-item-name">${name}</div>
        <div class="course-item-count">${courses[name].length} module${courses[name].length !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="padding:4px 8px"
        onclick="event.stopPropagation();deleteCourse('${name.replace(/'/g,"\\'")}')">
        <i class="ph ph-trash" style="color:var(--danger)"></i>
      </button>
    </div>`).join('');

  if (selectedCourse) renderModuleList(selectedCourse);
}

function selectCourse(name) {
  selectedCourse = name;
  renderCourseList();
  renderModuleList(name);
}

function renderModuleList(courseName) {
  const courses = getCourses();
  const modules = courses[courseName] || [];
  document.getElementById('module-panel-title').textContent = courseName;
  document.getElementById('module-count').textContent = modules.length + ' module' + (modules.length !== 1 ? 's' : '');
  document.getElementById('module-add-form').style.display = 'flex';

  const el = document.getElementById('module-list');
  if (!modules.length) {
    el.innerHTML = `<div class="empty-state" style="padding:24px 16px">
      <i class="ph ph-chalkboard"></i><p>No modules yet. Add one below.</p></div>`;
    return;
  }

  el.innerHTML = modules.map((m, i) => `
    <div class="module-item">
      <i class="ph ph-dot-outline" style="color:var(--primary);flex-shrink:0"></i>
      <span class="module-item-name">${m}</span>
      <button class="btn btn-ghost btn-sm" style="padding:4px 8px"
        onclick="deleteModule('${courseName.replace(/'/g,"\\'")}', ${i})">
        <i class="ph ph-x" style="color:var(--danger)"></i>
      </button>
    </div>`).join('');
}

function addCourse() {
  const input = document.getElementById('new-course-name');
  const name  = input.value.trim();
  if (!name) { showToast('Enter a course name.', 'danger'); return; }

  const courses = getCourses();
  if (courses[name]) { showToast('That course already exists.', 'warning'); return; }

  courses[name] = [];
  Store.set('gcc_courses', courses);
  input.value = '';
  selectedCourse = name;
  renderCourseList();
  renderModuleList(name);
  populateCourseDropdown();
  showToast('Course "' + name + '" added.', 'success');
}

function deleteCourse(name) {
  if (!confirm('Delete "' + name + '" and all its modules?')) return;
  const courses = getCourses();
  delete courses[name];
  Store.set('gcc_courses', courses);
  if (selectedCourse === name) {
    selectedCourse = null;
    document.getElementById('module-panel-title').textContent = 'Select a course';
    document.getElementById('module-count').textContent = '0 modules';
    document.getElementById('module-add-form').style.display = 'none';
    document.getElementById('module-list').innerHTML = `<div class="empty-state" style="padding:32px 16px">
      <i class="ph ph-chalkboard"></i><p>Select a course on the left to manage its modules.</p></div>`;
  }
  renderCourseList();
  populateCourseDropdown();
  showToast('Course deleted.', 'info');
}

function addModule() {
  if (!selectedCourse) { showToast('Select a course first.', 'danger'); return; }
  const input = document.getElementById('new-module-name');
  const name  = input.value.trim();
  if (!name) { showToast('Enter a module name.', 'danger'); return; }

  const courses = getCourses();
  if (!courses[selectedCourse]) courses[selectedCourse] = [];
  if (courses[selectedCourse].includes(name)) { showToast('Module already exists.', 'warning'); return; }

  courses[selectedCourse].push(name);
  Store.set('gcc_courses', courses);
  input.value = '';
  renderCourseList();
  renderModuleList(selectedCourse);
  populateCourseDropdown();
  showToast('Module "' + name + '" added.', 'success');
}

function deleteModule(courseName, index) {
  const courses = getCourses();
  courses[courseName].splice(index, 1);
  Store.set('gcc_courses', courses);
  renderCourseList();
  renderModuleList(courseName);
  populateCourseDropdown();
  showToast('Module removed.', 'info');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN PAGE  (pages/scan.html)
// ─────────────────────────────────────────────────────────────────────────────

let html5QrCode   = null;
let scannerActive = false;
const scannedToday = new Set();

function initScanner() {
  initParse();
  requireAuth();

  const activeSession = Store.get('gcc_active_session');
  if (activeSession) {
    document.getElementById('bar-course').textContent = activeSession.course;
    document.getElementById('bar-module').textContent = activeSession.module;
    document.getElementById('bar-date').textContent   = activeSession.date;
  } else {
    document.getElementById('no-session-alert').classList.remove('hidden');
  }

  loadTodayRecords();
}

function startScanner() {
  document.getElementById('scanner-idle').style.display = 'none';
  document.getElementById('scan-overlay').classList.remove('hidden');
  document.getElementById('start-btn').classList.add('hidden');
  document.getElementById('stop-btn').classList.remove('hidden');
  document.getElementById('status-dot').classList.add('active');
  document.getElementById('status-text').textContent = 'Camera active';

  html5QrCode = new Html5Qrcode('reader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    (decodedText) => processStudentId(decodedText.trim()),
    () => {}
  ).catch(() => {
    showFlash('Camera access denied. Use manual entry below.', 'error');
    stopScanner();
  });
  scannerActive = true;
}

function stopScanner() {
  if (html5QrCode && scannerActive) { html5QrCode.stop().catch(() => {}); scannerActive = false; }
  document.getElementById('scanner-idle').style.display = 'flex';
  document.getElementById('scan-overlay').classList.add('hidden');
  document.getElementById('start-btn').classList.remove('hidden');
  document.getElementById('stop-btn').classList.add('hidden');
  document.getElementById('status-dot').classList.remove('active');
  document.getElementById('status-text').textContent = 'Camera off';
}

function manualMark() {
  const val = document.getElementById('manual-id').value.trim();
  if (!val) { showToast('Enter a student ID.', 'danger'); return; }
  processStudentId(val);
  document.getElementById('manual-id').value = '';
}

function processStudentId(id) {
  if (scannedToday.has(id)) { showFlash('Already marked present this session.', 'warning'); return; }

  const students = Store.get('gcc_students', []);
  const student  = students.find(s => s.id === id);
  if (!student) { showFlash('Student not found. ID: ' + id, 'error'); return; }

  const activeSession = Store.get('gcc_active_session');
  const now = new Date();
  const record = {
    studentId: student.id,
    name:   student.fname + ' ' + student.lname,
    module: activeSession ? activeSession.module : 'Unknown',
    course: activeSession ? activeSession.course : 'Unknown',
    date:   activeSession ? activeSession.date : todayISO(),
    time:   formatTime(now),
    ts:     now.toISOString()
  };

  const attendance = Store.get('gcc_attendance', []);
  attendance.push(record);
  Store.set('gcc_attendance', attendance);

  scannedToday.add(id);
  addToScanList(record);
  updateScanSummary();
  showFlash(student.fname + ' ' + student.lname + ' marked present', 'success');
}

function addToScanList(record) {
  const list  = document.getElementById('attendance-list');
  const empty = list.querySelector('.attendance-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'att-item';
  item.innerHTML = `
    <div class="att-avatar">${record.name.charAt(0).toUpperCase()}</div>
    <div class="att-info">
      <div class="att-name">${record.name}</div>
      <div class="att-time">${record.time}</div>
    </div>
    <i class="ph ph-check-circle att-check"></i>`;
  list.insertBefore(item, list.firstChild);
  document.getElementById('present-count').textContent =
    list.querySelectorAll('.att-item').length;
}

function updateScanSummary() {
  const students = Store.get('gcc_students', []);
  document.getElementById('sum-present').textContent = scannedToday.size;
  document.getElementById('sum-absent').textContent  = Math.max(0, students.length - scannedToday.size);
}

function loadTodayRecords() {
  const activeSession = Store.get('gcc_active_session');
  const today = activeSession ? activeSession.date : todayISO();
  const attendance = Store.get('gcc_attendance', []);
  attendance
    .filter(r => r.date === today && (!activeSession || r.module === activeSession.module))
    .forEach(r => { scannedToday.add(r.studentId); addToScanList(r); });
  updateScanSummary();
}

function exportScanCSV() {
  const activeSession = Store.get('gcc_active_session');
  const attendance    = Store.get('gcc_attendance', []);
  const records = activeSession
    ? attendance.filter(r => r.module === activeSession.module && r.date === activeSession.date)
    : attendance;
  if (!records.length) { showToast('No records to export.', 'danger'); return; }
  const header = 'Name,Student ID,Module,Date,Time\n';
  const rows   = records.map(r =>
    `"${r.name}","${r.studentId}","${r.module}","${r.date}","${r.time}"`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `attendance-${activeSession ? activeSession.module + '-' : ''}${todayISO()}.csv`);
  showToast('CSV exported.', 'success');
}

function clearScanList() {
  if (!confirm("Clear today's scan list? Saved records will remain.")) return;
  scannedToday.clear();
  document.getElementById('attendance-list').innerHTML = `
    <div class="attendance-empty">
      <i class="ph ph-users"></i>
      <p>No students marked yet.<br/>Start scanning to see them here.</p>
    </div>`;
  document.getElementById('present-count').textContent = '0';
  updateScanSummary();
  showToast('Scan list cleared.', 'info');
}

let flashTimeout = null;
function showFlash(msg, type) {
  const existing = document.querySelector('.scan-result-flash');
  if (existing) existing.remove();
  if (flashTimeout) clearTimeout(flashTimeout);
  const icons = { success: 'check-circle', error: 'x-circle', warning: 'warning' };
  const el = document.createElement('div');
  el.className = `scan-result-flash ${type}`;
  el.innerHTML = `<i class="ph ph-${icons[type] || 'info'}"></i><span>${msg}</span>`;
  document.body.appendChild(el);
  flashTimeout = setTimeout(() => {
    el.style.animation = 'fadeOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 2500);
}
