
const DB_NAME = 'StudentSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'students';

let db;
let editMode = false;
let editingStudentId = null;
let sortState = { field: 'studentId', asc: true };

document.addEventListener('DOMContentLoaded', () => {
  initDB();
  initUI();
});

function initDB() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'studentId' });
      store.createIndex('fullName', 'fullName', { unique: false });
      store.createIndex('course', 'course', { unique: false });
      store.createIndex('yearLevel', 'yearLevel', { unique: false });
    }
  };

  req.onsuccess = (e) => {
    db = e.target.result;
    displayAllStudents();
  };

  req.onerror = (e) => {
    console.error('IndexedDB error', e);
    alert('Failed to open database.');
  };
}

function initUI() {
  const form = document.getElementById('student-form');
  const search = document.getElementById('search');
  const sortById = document.getElementById('sortById');
  const sortByName = document.getElementById('sortByName');
  const cancelEdit = document.getElementById('cancel-edit');

  form.addEventListener('submit', onFormSubmit);
  search.addEventListener('input', displayAllStudentsDebounced);
  sortById.addEventListener('click', () => toggleSort('studentId', sortById));
  sortByName.addEventListener('click', () => toggleSort('fullName', sortByName));
  cancelEdit.addEventListener('click', cancelEditing);
}

function onFormSubmit(e) {
  e.preventDefault();
  const student = readForm();

  if (!validateStudent(student)) return;

  if (editMode) {
    if (!confirm('Are you sure you want to update this student?')) return;
    updateStudent(student);
  } else {
    addStudent(student);
  }
}

function readForm() {
  return {
    fullName: document.getElementById('fullName').value.trim(),
    studentId: document.getElementById('studentId').value.trim(),
    course: document.getElementById('course').value.trim(),
    yearLevel: document.getElementById('yearLevel').value,
    email: document.getElementById('email').value.trim()
  };
}

function validateStudent(student) {
  for (let key of ['fullName','studentId','course','yearLevel','email']) {
    if (!student[key]) {
      alert('Please fill out all fields.');
      return false;
    }
  }

  return true;
}

function addStudent(student) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const getReq = store.get(student.studentId);

  getReq.onsuccess = () => {
    if (getReq.result) {
      alert('Student ID must be unique. A record with this ID already exists.');
      return;
    }

    const wtx = db.transaction(STORE_NAME, 'readwrite');
    const wstore = wtx.objectStore(STORE_NAME);
    const addReq = wstore.add(student);

    addReq.onsuccess = () => {
      alert('✅ Student added successfully!');
      clearForm();
      displayAllStudents();
    };
    addReq.onerror = (e) => {
      console.error('Add failed', e);
      alert('Failed to add student.');
    };
  };

  getReq.onerror = (e) => {
    console.error('Lookup error', e);
    alert('Failed to verify Student ID uniqueness.');
  };
}

function updateStudent(student) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const putReq = store.put(student);

  putReq.onsuccess = () => {
    alert('✏️ Student record updated successfully!');
    clearForm();
    editMode = false;
    editingStudentId = null;
    document.getElementById('form-title').textContent = 'Add Student';
    document.getElementById('submit-btn').textContent = 'Add Student';
    document.getElementById('cancel-edit').classList.add('hidden');
    displayAllStudents();
  };

  putReq.onerror = (e) => {
    console.error('Update failed', e);
    alert('Failed to update student.');
  };
}

function deleteStudent(studentId) {
  if (!confirm('Delete this student record? This cannot be undone.')) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const delReq = store.delete(studentId);

  delReq.onsuccess = () => {
    alert('🗑️ Student deleted successfully!');
    displayAllStudents();
  };
  delReq.onerror = (e) => {
    console.error('Delete failed', e);
    alert('Failed to delete record.');
  };
}

function editStudent(studentId) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const getReq = store.get(studentId);

  getReq.onsuccess = () => {
    const s = getReq.result;
    if (!s) { alert('Record not found'); return; }

    document.getElementById('fullName').value = s.fullName;
    document.getElementById('studentId').value = s.studentId;
    document.getElementById('studentId').disabled = true;
    document.getElementById('course').value = s.course;
    document.getElementById('yearLevel').value = s.yearLevel;
    document.getElementById('email').value = s.email;

    editMode = true;
    editingStudentId = s.studentId;
    document.getElementById('form-title').textContent = 'Edit Student';
    document.getElementById('submit-btn').textContent = 'Save Changes';
    document.getElementById('cancel-edit').classList.remove('hidden');
    scrollToTop();
  };

  getReq.onerror = (e) => {
    console.error('Fetch for edit failed', e);
    alert('Failed to load student for editing.');
  };
}

function cancelEditing() {
  editMode = false;
  editingStudentId = null;
  document.getElementById('studentId').disabled = false;
  document.getElementById('form-title').textContent = 'Add Student';
  document.getElementById('submit-btn').textContent = 'Add Student';
  document.getElementById('cancel-edit').classList.add('hidden');
  clearForm();
}

function clearForm() {
  document.getElementById('student-form').reset();
  document.getElementById('studentId').disabled = false;
}

function displayAllStudentsDebounced() {
  if (this._timer) clearTimeout(this._timer);
  this._timer = setTimeout(displayAllStudents, 180);
}

function displayAllStudents() {
  const tbody = document.getElementById('students-tbody');
  tbody.innerHTML = '';
  const searchVal = document.getElementById('search').value.trim().toLowerCase();

  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    let students = req.result || [];

    if (searchVal) {
      students = students.filter(s =>
        s.studentId.toLowerCase().includes(searchVal) ||
        s.course.toLowerCase().includes(searchVal) ||
        String(s.yearLevel).toLowerCase().includes(searchVal)
      );
    }

    students.sort((a,b) => {
      const f = sortState.field;
      let va = (a[f] || '').toString().toLowerCase();
      let vb = (b[f] || '').toString().toLowerCase();
      if (va < vb) return sortState.asc ? -1 : 1;
      if (va > vb) return sortState.asc ? 1 : -1;
      return 0;
    });

    if (students.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.opacity = 0.8;
      td.textContent = 'No records found.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const s of students) {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapeHtml(s.studentId)}</td>
        <td>${escapeHtml(s.fullName)}</td>
        <td>${escapeHtml(s.course)}</td>
        <td>${escapeHtml(s.yearLevel)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td class="actions-btn">
          <button class="small-btn" data-action="edit" data-id="${s.studentId}">Edit</button>
          <button class="small-btn delete-btn" data-action="delete" data-id="${s.studentId}">Delete</button>
        </td>
      `;

      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.onclick = (ev) => {
        const id = ev.currentTarget.getAttribute('data-id');
        const action = ev.currentTarget.getAttribute('data-action');
        if (action === 'edit') editStudent(id);
        if (action === 'delete') deleteStudent(id);
      };
    });
  };

  req.onerror = (e) => {
    console.error('Failed to fetch students', e);
    alert('Failed to retrieve records.');
  };
}

function toggleSort(field, btn) {
  if (sortState.field === field) sortState.asc = !sortState.asc;
  else { sortState.field = field; sortState.asc = true; }

  btn.textContent = (field === 'studentId' ? 'Sort by ID ' : 'Sort by Name ') + (sortState.asc ? '↑' : '↓');
  displayAllStudents();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
