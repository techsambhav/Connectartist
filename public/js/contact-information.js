const form = document.getElementById("contactForm");
const contactList = document.getElementById("contactInfoContainer") || document.getElementById("contactList");
const toast = document.getElementById("toast");

// If this script is loaded inside the card overlay, a global `CURRENT_PROFILE_ID` may be set
// Otherwise, try to read a hidden input #profileId in the DOM
// Determine profile identifiers available to the injected script
let CURRENT_PROFILE_ID = window.CURRENT_PROFILE_ID || (document.getElementById('profileId') && document.getElementById('profileId').value) || null;
let CURRENT_PROFILE_USER_ID = window.CURRENT_PROFILE_USER_ID || (document.getElementById('profileUserId') && document.getElementById('profileUserId').value) || null;

function showToast(message, type = "success") {
  toast.innerText = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

// Small success modal for overlay use
function showSuccessModal(message = 'Your contacts are saved successfully') {
  // Determine container: prefer overlay if present
  const overlay = document.getElementById('contactInfoOverlay');
  const mount = overlay || document.body;

  // Create modal elements
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'ci-success-overlay';
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = '0';
  modalOverlay.style.left = '0';
  modalOverlay.style.width = '100vw';
  modalOverlay.style.height = '100vh';
  modalOverlay.style.display = 'flex';
  modalOverlay.style.alignItems = 'center';
  modalOverlay.style.justifyContent = 'center';
  modalOverlay.style.background = 'rgba(0,0,0,0.5)';
  modalOverlay.style.zIndex = '3000';

  const box = document.createElement('div');
  box.style.background = '#0f1720';
  box.style.color = '#fff';
  box.style.padding = '20px 22px';
  box.style.borderRadius = '10px';
  box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
  box.style.maxWidth = '420px';
  box.style.width = '90%';
  box.style.textAlign = 'center';

  const msg = document.createElement('div');
  msg.style.marginBottom = '16px';
  msg.style.fontSize = '1rem';
  msg.textContent = message;

  const ok = document.createElement('button');
  ok.textContent = 'OK';
  ok.style.padding = '8px 16px';
  ok.style.border = 'none';
  ok.style.borderRadius = '8px';
  ok.style.cursor = 'pointer';
  ok.style.background = '#fff';
  ok.style.color = '#000';

  ok.addEventListener('click', () => {
    // Remove modal
    modalOverlay.remove();
    // If running inside card overlay, close it as requested
    if (typeof window.closeContactInfoBox === 'function') {
      try { window.closeContactInfoBox(); } catch (e) { console.error(e); }
    }
  });

  box.appendChild(msg);
  box.appendChild(ok);
  modalOverlay.appendChild(box);
  mount.appendChild(modalOverlay);
}

let EXISTING_CONTACT = null; // will hold the single contact for current profile (if any)
let editingContactId = null; // id of contact being edited
let editingField = null; // name of field being updated via Update button

// Load saved contact for this profile (single contact expected)
async function loadContacts() {
  let url = "/api/contacts";
  if (CURRENT_PROFILE_ID) url += `?profileId=${encodeURIComponent(CURRENT_PROFILE_ID)}`;
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, { headers });
  const contacts = await res.json();
  if (res.status === 401 || res.status === 403) {
    showToast('You are not authorized to access contact information', 'error');
    // If inside overlay, close it to avoid showing blank content
    if (typeof window.closeContactInfoBox === 'function') window.closeContactInfoBox();
    return;
  }
  const list = Array.isArray(contacts) ? contacts : (contacts.data || []);
  EXISTING_CONTACT = list.length ? list[0] : null;
  renderSavedFields(EXISTING_CONTACT);
  populateFormFromExistingContact(EXISTING_CONTACT);
}

function populateFormFromExistingContact(contact) {
  if (!contact) return;
  // Only fill inputs for fields that have saved values; leave others blank
  if (contact.phone) document.getElementById('phone').value = contact.phone;
  else document.getElementById('phone').value = '';

  if (contact.location) document.getElementById('location').value = contact.location;
  else document.getElementById('location').value = '';

  if (contact.email) document.getElementById('email').value = contact.email;
  else document.getElementById('email').value = '';

  if (contact.altNumber) {
    if (document.getElementById('alternatePhone')) document.getElementById('alternatePhone').value = contact.altNumber;
    if (document.getElementById('altNumber')) document.getElementById('altNumber').value = contact.altNumber;
  } else {
    if (document.getElementById('alternatePhone')) document.getElementById('alternatePhone').value = '';
    if (document.getElementById('altNumber')) document.getElementById('altNumber').value = '';
  }

  if (contact.altEmail) {
    if (document.getElementById('alternateEmail')) document.getElementById('alternateEmail').value = contact.altEmail;
    if (document.getElementById('altEmail')) document.getElementById('altEmail').value = contact.altEmail;
  } else {
    if (document.getElementById('alternateEmail')) document.getElementById('alternateEmail').value = '';
    if (document.getElementById('altEmail')) document.getElementById('altEmail').value = '';
  }
}

function renderSavedFields(contact) {
  // contactList is the display container inside the contact-display section
  contactList.innerHTML = "";
  const displaySection = document.getElementById('contactDisplay');
  if (!contact) {
    if (displaySection) displaySection.style.display = 'none';
    return;
  }

  if (displaySection) displaySection.style.display = 'block';

  const fields = [
    { key: 'phone', label: 'Phone' },
    { key: 'location', label: 'Location' },
    { key: 'email', label: 'Email' },
    { key: 'altNumber', label: 'Alternate Phone' },
    { key: 'altEmail', label: 'Alternate Email' },
  ];

  fields.forEach(f => {
    const val = contact[f.key];
    if (val && String(val).trim() !== '') {
      const card = document.createElement('div');
      card.className = 'contact-item';

      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'contact-field';

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = f.label;

      const value = document.createElement('div');
      value.className = 'value';
      value.textContent = val;

      fieldDiv.appendChild(label);
      fieldDiv.appendChild(value);

      const actions = document.createElement('div');
      actions.className = 'contact-actions';

  // Create labeled buttons (icon + text) for clarity
  const updateBtn = document.createElement('button');
  updateBtn.className = 'btn btn-primary';
  updateBtn.title = 'Update field';
  updateBtn.innerHTML = '<i class="fas fa-edit" style="margin-right:8px"></i> Update';
  updateBtn.addEventListener('click', () => startFieldEdit(contact._id, f.key, val));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-secondary';
  deleteBtn.title = 'Delete field';
  deleteBtn.style.borderColor = 'rgba(255,255,255,0.06)';
  deleteBtn.innerHTML = '<i class="fas fa-trash" style="margin-right:8px"></i> Delete';
  deleteBtn.addEventListener('click', () => deleteField(contact._id, f.key));

  actions.appendChild(updateBtn);
  actions.appendChild(deleteBtn);

      card.appendChild(fieldDiv);
      card.appendChild(actions);

      contactList.appendChild(card);
    }
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const contact = {
    phone: document.getElementById("phone").value,
    location: document.getElementById("location").value,
    email: document.getElementById("email").value,
    altNumber: document.getElementById("alternatePhone") ? document.getElementById("alternatePhone").value : (document.getElementById("altNumber") && document.getElementById("altNumber").value),
    altEmail: document.getElementById("alternateEmail") ? document.getElementById("alternateEmail").value : (document.getElementById("altEmail") && document.getElementById("altEmail").value),
  // Prefer profile document id, fallback to profile owner userId (server resolves either)
  profileId: CURRENT_PROFILE_ID || CURRENT_PROFILE_USER_ID || undefined,
  };
  // Build payload keeping only non-empty fields
  const payload = {};
  Object.keys(contact).forEach(k => {
    if (contact[k] !== undefined && contact[k] !== null && String(contact[k]).trim() !== '') payload[k] = contact[k];
  });

  try {
    let res;
    // If a single-field edit is active, send only that field to the specific contact id
  if (editingField && editingContactId) {
      const singlePayload = {};
      // get the current value from form for that field
      let v;
      if (editingField === 'altNumber') v = (document.getElementById('alternatePhone') || document.getElementById('altNumber')).value;
      else if (editingField === 'altEmail') v = (document.getElementById('alternateEmail') || document.getElementById('altEmail')).value;
      else v = document.getElementById(editingField) ? document.getElementById(editingField).value : '';
      singlePayload[editingField] = v;
      res = await fetch(`/api/contacts/${editingContactId}`, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}),
        body: JSON.stringify(singlePayload),
      });
    } else if (editingContactId) {
      // Editing whole contact (editContact was used) - PUT to that id
      res = await fetch(`/api/contacts/${editingContactId}`, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}),
        body: JSON.stringify(payload),
      });
    } else if (EXISTING_CONTACT && EXISTING_CONTACT._id) {
      // Update existing contact with provided fields
      res = await fetch(`/api/contacts/${EXISTING_CONTACT._id}`, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}),
        body: JSON.stringify(payload),
      });
    } else {
      // Create a new contact
      // ensure we send profileId (CURRENT_PROFILE_ID) to server
      if (CURRENT_PROFILE_ID) payload.profileId = CURRENT_PROFILE_ID;
      res = await fetch('/api/contacts', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}),
        body: JSON.stringify(payload),
      });
    }

    if (res.status === 401 || res.status === 403) {
      showToast('You are not authorized to perform this action', 'error');
      if (typeof window.closeContactInfoBox === 'function') window.closeContactInfoBox();
      return;
    }

    if (res.ok) {
      if (document.getElementById('contactInfoOverlay')) {
        showSuccessModal('Your contacts are saved successfully');
      } else {
        showToast('Contact saved!');
      }
      form.reset();
      editingField = null;
      editingContactId = null;
      await loadContacts();
    } else {
      showToast('Error saving contact', 'error');
    }
  } catch (err) {
    console.error('Save contact error', err);
    showToast('Error saving contact', 'error');
  }
});

async function editContact(id) {
  // For backward compatibility: load full contact into form for editing
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`/api/contacts/${id}`, { headers });
  const contact = await res.json();
  if (res.status === 401 || res.status === 403) {
    showToast('You are not authorized to access this contact', 'error');
    if (typeof window.closeContactInfoBox === 'function') window.closeContactInfoBox();
    return;
  }
  editingContactId = id;
  editingField = null; // editing whole contact via form

  document.getElementById('phone').value = contact.phone || '';
  document.getElementById('location').value = contact.location || '';
  document.getElementById('email').value = contact.email || '';
  if (document.getElementById('alternatePhone')) document.getElementById('alternatePhone').value = contact.altNumber || '';
  if (document.getElementById('altNumber')) document.getElementById('altNumber').value = contact.altNumber || '';
  if (document.getElementById('alternateEmail')) document.getElementById('alternateEmail').value = contact.altEmail || '';
  if (document.getElementById('altEmail')) document.getElementById('altEmail').value = contact.altEmail || '';
}

// Start editing a single field - called from Update button next to a field
function startFieldEdit(contactId, field, value) {
  editingContactId = contactId;
  editingField = field;
  // Pre-fill the corresponding input only
  if (field === 'altNumber') {
    if (document.getElementById('alternatePhone')) document.getElementById('alternatePhone').value = value;
    if (document.getElementById('altNumber')) document.getElementById('altNumber').value = value;
  } else if (field === 'altEmail') {
    if (document.getElementById('alternateEmail')) document.getElementById('alternateEmail').value = value;
    if (document.getElementById('altEmail')) document.getElementById('altEmail').value = value;
  } else {
    const el = document.getElementById(field);
    if (el) el.value = value;
  }
  // focus the input
  const inputEl = (field === 'altNumber' ? (document.getElementById('alternatePhone') || document.getElementById('altNumber')) : (field === 'altEmail' ? (document.getElementById('alternateEmail') || document.getElementById('altEmail')) : document.getElementById(field)));
  if (inputEl) inputEl.focus();
}

// Delete a single field (sets it to empty string)
async function deleteField(contactId, field) {
  if (!confirm('Delete this field?')) return;
  try {
    const payload = {};
    payload[field] = '';
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast('Field deleted');
      await loadContacts();
    } else {
      showToast('Error deleting field', 'error');
    }
  } catch (err) {
    console.error('deleteField error', err);
    showToast('Error deleting field', 'error');
  }
}

async function deleteContact(id) {
  const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
  if (res.ok) {
    showToast("Contact deleted");
    loadContacts();
  } else {
    showToast("Error deleting contact", "error");
  }
}

if (document.getElementById("remindLater")) {
  document.getElementById("remindLater").addEventListener("click", () => {
    showToast("We’ll remind you later!");
  });
}

loadContacts();
