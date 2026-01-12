// admin.js

document.addEventListener("DOMContentLoaded", () => {
  fetchProfiles();
});

let currentUserId = null;
let currentProfileId = null;
let removedMedia = { photos: [], videos: [], audios: [] };

// 1️⃣ Fetch & render all profiles
async function fetchProfiles() {
  try {
    const res = await fetch("/api/profiles");
    const data = await res.json();

    if (!data.success) {
      console.error("Failed to fetch profiles:", data.message);
      return;
    }

    const list = document.querySelector(".profile-list");
    list.innerHTML = "";

    data.profiles.forEach(profile => {
      const card = document.createElement("div");
      card.className = "profile-card";
      card.innerHTML = `
        <img src="${profile.avatarUrl || "https://via.placeholder.com/150"}" alt="avatar">
        <h3>${profile.displayName || "Unnamed"}</h3>
        <p>${profile.artistType || ""}</p>
        <p>₹${profile.price || 0}</p>
        <div class="profile-actions">
      <button class="btn btn-edit" onclick="openEditModal('${profile._id}')">Edit</button>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error("Error fetching profiles:", err);
  }
}

// 2️⃣ Open Edit Modal
async function openEditModal(profileId) {
  currentProfileId = profileId;
  removedMedia = { photos: [], videos: [], audios: [] };

  const res = await fetch(`/api/profile/${profileId}`);
  const profile = await res.json();

  // store both ids: profile document id and owner userId
  document.getElementById('editProfileId').value = profile._id || profileId;
  currentUserId = profile.userId || null;

  // Match the IDs used in admin.html
  document.getElementById('editDisplayName').value = profile.displayName || "";
  document.getElementById('editBio').value = profile.bio || "";
  document.getElementById('editArtistType').value = profile.artistType || "";
  document.getElementById('editPrice').value = profile.price || "";
  document.getElementById('editLocation').value = profile.location || "";

  renderMediaSection("photos", profile.photos);
  renderMediaSection("videos", profile.videos);
  renderMediaSection("audios", profile.audios);

  document.querySelector(".edit-modal").classList.add("active");
}

function renderMediaSection(type, mediaArray = []) {
  // Map logical type to DOM grid IDs used in admin.html
  const map = { photos: 'editPhotosGrid', videos: 'editVideoGrid', audios: 'editAudioGrid' };
  const container = document.getElementById(map[type]);
  if (!container) return;

  container.innerHTML = "";
  mediaArray.forEach((item, idx) => {
    const el = document.createElement("div");
    el.classList.add("media-item");
    el.innerHTML = `
      ${type === "photos" ? `<img src="${item.url}">` : ""}
      ${type === "videos" ? `<video src="${item.url}" controls></video>` : ""}
      ${type === "audios" ? `<audio src="${item.url}" controls></audio>` : ""}
      <button class="delete-btn" onclick="removeMedia('${type}', ${idx})">&times;</button>
    `;
    container.appendChild(el);
  });
}

function removeMedia(type, index) {
  if (!removedMedia[type]) removedMedia[type] = [];
  removedMedia[type].push(index);
  const map = { photos: 'editPhotosGrid', videos: 'editVideoGrid', audios: 'editAudioGrid' };
  const container = document.getElementById(map[type]);
  if (container && container.children[index]) {
    container.children[index].remove();
  }
}

// 3️⃣ Save Edited Profile
async function saveProfile() {
  const form = document.querySelector(".edit-form");
  const formData = new FormData(form);

  // send both identifiers to avoid ambiguity server-side
  formData.append("profileId", currentProfileId || document.getElementById('editProfileId').value);
  formData.append("userId", currentUserId || document.getElementById('editProfileId').value);
  formData.append("removedMedia", JSON.stringify(removedMedia));

  try {
    const res = await fetch("/api/admin/profile/update", {
      method: "POST",
      body: formData
    });
    const result = await res.json();

    if (result.success) {
      alert("Profile updated successfully!");
      document.querySelector(".edit-modal").classList.remove("active");
      fetchProfiles();
    } else {
      alert("Error updating profile: " + result.message);
    }
  } catch (err) {
    console.error("Error saving profile:", err);
  }
}

// 4️⃣ Close Modal
function closeEditModal() {
  document.querySelector(".edit-modal").classList.remove("active");
}
