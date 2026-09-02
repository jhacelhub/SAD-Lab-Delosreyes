const SUPABASE_URL = "https://fpisprtenkjpxqkknzos.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PQrjwkADFp0np5VnZyeutg_OEJ_9AX7";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE = "students";

// ---- DOM references ----
const form = document.getElementById("student-form");
const formTitle = document.getElementById("form-title");
const recordIdInput = document.getElementById("record-id");
const studentIdInput = document.getElementById("student_id");
const fullNameInput = document.getElementById("full_name");
const programInput = document.getElementById("program");
const programOtherInput = document.getElementById("program_other");
const yearLevelInput = document.getElementById("year_level");
const emailInput = document.getElementById("email");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formMessage = document.getElementById("form-message");
const tableBody = document.getElementById("student-table-body");

let editingId = null;

// Show/hide the "Other program" text box
programInput.addEventListener("change", () => {
  programOtherInput.hidden = programInput.value !== "__other";
  if (!programOtherInput.hidden) programOtherInput.focus();
});

function getProgramValue() {
  if (programInput.value === "__other") {
    return programOtherInput.value.trim();
  }
  return programInput.value;
}

// ---------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------
function clearErrors() {
  document.querySelectorAll(".error-text").forEach(el => (el.textContent = ""));
  document.querySelectorAll(".field").forEach(el => el.classList.remove("has-error"));
}

function setError(fieldId, message) {
  const errEl = document.getElementById("err-" + fieldId);
  const fieldEl = document.getElementById(fieldId).closest(".field");
  errEl.textContent = message;
  fieldEl.classList.add("has-error");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function validateForm(values) {
  let valid = true;

  if (!values.student_id) {
    setError("student_id", "Student ID cannot be empty.");
    valid = false;
  }

  if (!values.full_name) {
    setError("full_name", "Full name cannot be empty.");
    valid = false;
  }

  if (!values.program) {
    setError("program", "Program cannot be empty.");
    valid = false;
  }

  if (!values.year_level || values.year_level < 1 || values.year_level > 4) {
    setError("year_level", "Year level must be between 1 and 4.");
    valid = false;
  }

  if (!values.email || !isValidEmail(values.email)) {
    setError("email", "Enter a valid email address.");
    valid = false;
  }

  // Uniqueness check for student_id
  if (valid) {
    let query = supabaseClient
      .from(TABLE)
      .select("id")
      .eq("student_id", values.student_id);

    if (editingId) query = query.neq("id", editingId);

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      setError("student_id", "This Student ID is already used by another record.");
      valid = false;
    }
  }

  return valid;
}

// ---------------------------------------------------------
// READ — load and render all students
// ---------------------------------------------------------
async function loadStudents() {
  tableBody.innerHTML =
    `<tr><td colspan="5" class="empty-row">Loading records…</td></tr>`;

  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    tableBody.innerHTML =
      `<tr><td colspan="5" class="empty-row">Error loading records: ${error.message}</td></tr>`;
    return;
  }

  const countEl = document.getElementById("record-count");

  if (!data || data.length === 0) {
    countEl.textContent = "";

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">
          <div class="empty-state">
            <svg viewBox="0 0 64 64" width="44" height="44" fill="none">
              <circle cx="32" cy="32" r="30" fill="#FDF3F6"/>
              <path d="M20 44c0-8 5.5-13 12-13s12 5 12 13"
                stroke="#D63B6E"
                stroke-width="2.5"
                stroke-linecap="round"/>
              <circle cx="32" cy="24" r="7"
                stroke="#D63B6E"
                stroke-width="2.5"/>
            </svg>
            <p>
              No student records yet.<br />
              Add one using the form on the left.
            </p>
          </div>
        </td>
      </tr>`;
    return;
  }

  countEl.textContent =
    data.length + (data.length === 1 ? " record" : " records");

  tableBody.innerHTML = "";

  data.forEach(student => {
    const initials = getInitials(student.full_name);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <div class="student-cell">
          <span class="avatar">${escapeHtml(initials)}</span>
          <div class="student-cell-text">
            <span class="student-name">${escapeHtml(student.full_name)}</span>
            <span class="student-id">${escapeHtml(student.student_id)}</span>
          </div>
        </div>
      </td>

      <td>${escapeHtml(student.program)}</td>

      <td>
        <span class="year-pill">
          Y${escapeHtml(String(student.year_level))}
        </span>
      </td>

      <td>${escapeHtml(student.email)}</td>

      <td>
        <button class="btn-edit" data-id="${student.id}">
          Edit
        </button>

        <button class="btn-danger" data-id="${student.id}">
          Delete
        </button>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Wire up Edit buttons
  tableBody.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () =>
      startEdit(btn.dataset.id, data)
    );
  });

  // Wire up Delete buttons
  tableBody.querySelectorAll(".btn-danger").forEach(btn => {
    btn.addEventListener("click", () =>
      deleteStudent(btn.dataset.id)
    );
  });
}

function getInitials(name) {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last =
    parts.length > 1 ? parts[parts.length - 1][0] : "";

  return (first + last).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------
// CREATE + UPDATE
// ---------------------------------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  clearErrors();
  formMessage.textContent = "";
  formMessage.className = "form-message";

  const values = {
    student_id: studentIdInput.value.trim(),
    full_name: fullNameInput.value.trim(),
    program: getProgramValue(),
    year_level: parseInt(yearLevelInput.value, 10),
    email: emailInput.value.trim(),
  };

  saveBtn.disabled = true;

  const valid = await validateForm(values);

  if (!valid) {
    saveBtn.disabled = false;
    return;
  }

  let result;

  if (editingId) {
    // UPDATE
    result = await supabaseClient
      .from(TABLE)
      .update(values)
      .eq("id", editingId);
  } else {
    // CREATE
    result = await supabaseClient
      .from(TABLE)
      .insert([values]);
  }

  saveBtn.disabled = false;

  if (result.error) {
    formMessage.textContent = "Error: " + result.error.message;
    formMessage.classList.add("error");
    return;
  }

  formMessage.textContent = editingId
    ? "Student updated successfully."
    : "Student saved successfully.";

  formMessage.classList.add("success");

  resetForm();
  loadStudents();
});

// ---------------------------------------------------------
// Start editing a record
// ---------------------------------------------------------
function startEdit(id, allData) {
  const student = allData.find(
    s => String(s.id) === String(id)
  );

  if (!student) return;

  editingId = student.id;
  recordIdInput.value = student.id;
  studentIdInput.value = student.student_id;
  fullNameInput.value = student.full_name;

  const knownPrograms = Array.from(programInput.options)
    .map(o => o.value);

  if (knownPrograms.includes(student.program)) {
    programInput.value = student.program;
    programOtherInput.hidden = true;
    programOtherInput.value = "";
  } else {
    programInput.value = "__other";
    programOtherInput.hidden = false;
    programOtherInput.value = student.program;
  }

  yearLevelInput.value = student.year_level;
  emailInput.value = student.email;

  formTitle.textContent = "Edit Student";
  saveBtn.textContent = "Update Student";
  cancelBtn.hidden = false;

  clearErrors();

  formMessage.textContent = "";
  formMessage.className = "form-message";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

cancelBtn.addEventListener("click", () => {
  resetForm();
});

function resetForm() {
  editingId = null;

  form.reset();

  recordIdInput.value = "";
  programOtherInput.hidden = true;
  programOtherInput.value = "";

  formTitle.textContent = "Add Student";
  saveBtn.textContent = "Save Student";
  cancelBtn.hidden = true;

  clearErrors();
}

// ---------------------------------------------------------
// DELETE — with confirmation
// ---------------------------------------------------------
async function deleteStudent(id) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this student record? This cannot be undone."
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    alert("Error deleting record: " + error.message);
    return;
  }

  if (editingId === id) {
    resetForm();
  }

  loadStudents();
}

// ---------------------------------------------------------
// INITIAL LOAD
// ---------------------------------------------------------
loadStudents();