// ===========================
// ConnectArtist - discover.js
// Unified script for Discover page
// ===========================

// ---------------------------
// Authentication Handling
// ---------------------------
(function handleAuthButtons() {
  const token = localStorage.getItem('token');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutButton = document.getElementById('logoutButton');

  if (token) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'inline-block';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (signupBtn) signupBtn.style.display = 'inline-block';
    if (logoutButton) logoutButton.style.display = 'none';
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      window.location.href = '/discover.html';
    });
  }
})();

// ---------------------------
// Globals & DOM Elements
// ---------------------------
let allProfiles = []; // merged backend + local

const artistsGrid = document.getElementById('artistsGrid');
const filterToggle = document.getElementById('filterToggle');
const filterSection = document.getElementById('filterSection');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const genreFilter = document.getElementById('genreFilter');
const locationFilter = document.getElementById('locationFilter');
const availabilityFilter = document.getElementById('availabilityFilter');
const priceFilter = document.getElementById('priceFilter');
const sortFilter = document.getElementById('sortFilter');
const clearLocalBtn = document.getElementById('clearLocalProfiles');
const mainHeader = document.getElementById('mainHeader');

// ---------------------------
// Scroll Header Effect
// ---------------------------
function setupScrollHeader() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      mainHeader.classList.add('scrolled');
    } else {
      mainHeader.classList.remove('scrolled');
    }
  });
}

// ---------------------------
// Load Profiles (Backend + Local)
// ---------------------------
async function fetchAndRenderProfiles() {
  try {
    // Fetch backend profiles
    const res = await fetch('/api/profiles');
    const data = await res.json();
    let backendProfiles = [];
    if (data.success && Array.isArray(data.profiles)) {
      backendProfiles = data.profiles;
    }

    // Fetch persisted local profiles
    let localProfiles = [];
    try {
      localProfiles = JSON.parse(localStorage.getItem('persistedProfiles') || '[]');
    } catch {
      localProfiles = [];
    }

    // Clean demo/test profiles from local
    const demoPatterns = [/demo/i, /rahul/i, /shubham/i, /sambhav/i, /\.jpg/i];
    localProfiles = localProfiles.filter(p => {
      const name = (p.displayName || '').toString();
      const avatar = (p.avatarUrl || '').toString();
      return !demoPatterns.some(rx => rx.test(name) || rx.test(avatar));
    });

    // Merge unique profiles
    const map = new Map();
    backendProfiles.forEach(p => map.set(p._id || p.displayName, p));
    localProfiles.forEach(p => map.set(p._id || p.displayName, p));
    allProfiles = Array.from(map.values());

    // Save merged back to localStorage
    localStorage.setItem('persistedProfiles', JSON.stringify(allProfiles));

    // Render
    renderProfiles(allProfiles);
  } catch (err) {
    console.error('Error loading profiles:', err);
    try {
      allProfiles = JSON.parse(localStorage.getItem('persistedProfiles') || '[]');
      if (allProfiles.length) renderProfiles(allProfiles);
    } catch {
      console.warn('No profiles available');
    }
  }
}

// ---------------------------
// Render Profiles
// ---------------------------
function renderProfiles(profiles) {
  const container = document.querySelector('.all-artists');
  if (!container) return;
  container.innerHTML = '';

  const currentUserId = localStorage.getItem('userId');

  profiles.forEach(profile => {
    const avatarUrl = profile.avatarUrl || 'https://storage.googleapis.com/connectartist-media/avatars/default-avatar.png';
    const videoUrl = profile.videos?.[0]?.url || '';
    const artistId = profile._id || profile.userId || profile.id || '';

    const card = document.createElement('div');
    card.className = 'artist-card';
    card.dataset.profile = JSON.stringify(profile);
    if (artistId) card.setAttribute('data-artist-id', artistId);

    card.innerHTML = `
      <div class="artist-media">
        <img src="${avatarUrl}" alt="${profile.displayName}" class="artist-img">
        ${videoUrl ? `<div class="artist-play-btn"><i class="fas fa-play"></i></div>` : ''}
      </div>
      <div class="artist-info">
        <h3 class="artist-name">${profile.displayName}</h3>
        <div class="artist-meta">
          <span class="artist-genre">${profile.artistType || profile.genre || ''}</span>
          <span class="artist-rating"><i class="fas fa-star"></i> ${profile.rating || '5.0'}</span>
        </div>
        <div class="artist-price">Starting from ₹${profile.price || 0}</div>
        <div class="artist-actions">
          <button class="btn-book" data-artist-id="${artistId}">Book Now</button>
          <button class="btn-view-profile">View Profile</button>
          <button class="btn-favorite"><i class="far fa-heart"></i></button>
        </div>
      </div>
    `;

    // Self-booking guard
    if (currentUserId && artistId && String(currentUserId) === String(artistId)) {
      const bookBtn = card.querySelector('.btn-book');
      if (bookBtn) {
        bookBtn.textContent = 'Your Profile';
        bookBtn.disabled = true;
        bookBtn.style.opacity = '0.6';
        bookBtn.title = "You can't book yourself";
      }
    }

    container.appendChild(card);
  });
}

// ---------------------------
// Search + Filter Artists
// ---------------------------
function searchArtists() {
  const searchTerm = (searchInput.value || '').toLowerCase();
  const genre = (genreFilter.value || '').toLowerCase();
  const location = (locationFilter.value || '').toLowerCase();
  const priceRange = priceFilter.value;
  const sortBy = sortFilter.value;

  let filtered = allProfiles.filter(artist => {
    const name = (artist.displayName || '').toLowerCase();
    const genreVal = (artist.artistType || artist.genre || '').toLowerCase();
    const bio = (artist.bio || '').toLowerCase();
    const loc = (artist.location || '').toLowerCase();

    const matchesSearch = !searchTerm || name.includes(searchTerm) || genreVal.includes(searchTerm) || bio.includes(searchTerm);
    const matchesGenre = !genre || genreVal.includes(genre);
    const matchesLocation = !location || loc === location;

    let matchesPrice = true;
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(v => parseInt(v.replace('+', '')) || 0);
      const artistPrice = parseInt((artist.price || '0').toString().replace(/[^0-9]/g, '')) || 0;
      matchesPrice = max ? (artistPrice >= min && artistPrice <= max) : (artistPrice >= min);
    }

    return matchesSearch && matchesGenre && matchesLocation && matchesPrice;
  });

  // Sort
  switch (sortBy) {
    case 'rating':
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'price-low':
      filtered.sort((a, b) => (parseInt(a.price) || 0) - (parseInt(b.price) || 0));
      break;
    case 'price-high':
      filtered.sort((a, b) => (parseInt(b.price) || 0) - (parseInt(a.price) || 0));
      break;
    case 'newest':
      filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
      break;
    default: // popular
      filtered.sort((a, b) => (b.trending || 0) - (a.trending || 0));
  }

  renderProfiles(filtered);
}

// ---------------------------
// Event Listeners
// ---------------------------
if (filterToggle) {
  filterToggle.addEventListener('click', () => {
    filterSection.classList.toggle('active');
    filterToggle.innerHTML = filterSection.classList.contains('active')
      ? '<i class="fas fa-times"></i> Hide Filters'
      : '<i class="fas fa-sliders-h"></i> Show Filters';
  });
}

if (searchBtn) searchBtn.addEventListener('click', searchArtists);
if (searchInput) searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') searchArtists(); });
if (genreFilter) genreFilter.addEventListener('change', searchArtists);
if (locationFilter) locationFilter.addEventListener('change', searchArtists);
if (priceFilter) priceFilter.addEventListener('change', searchArtists);
if (sortFilter) sortFilter.addEventListener('change', searchArtists);
if (availabilityFilter) availabilityFilter.addEventListener('change', searchArtists);

if (clearLocalBtn) {
  clearLocalBtn.addEventListener('click', () => {
    if (!confirm('Clear locally saved profiles?')) return;
    localStorage.removeItem('persistedProfiles');
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('profileData')) localStorage.removeItem(k);
    });
    alert('Local profiles cleared. Reloading.');
    fetchAndRenderProfiles();
  });
}

// ---------------------------
// Booking Modal Helper
// ---------------------------
(function bookingModalHelper() {
  function createBookingModal() {
    let container = document.getElementById('bookingModalContainer');
    if (container) return container;
    container = document.createElement('div');
    container.id = 'bookingModalContainer';
    Object.assign(container.style, { position:'fixed', inset:'0', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)', zIndex:'10000' });

    const modal = document.createElement('div');
    Object.assign(modal.style, { width:'75vw', height:'75vh', background:'#fff', borderRadius:'8px', boxShadow:'0 10px 30px rgba(0,0,0,0.4)', overflow:'hidden', position:'relative' });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, { position:'absolute', top:'8px', right:'8px', fontSize:'24px', border:'none', background:'transparent', cursor:'pointer' });
    closeBtn.addEventListener('click', closeBookingModal);

    const frame = document.createElement('iframe');
    frame.id = 'bookingModalFrame';
    Object.assign(frame.style, { width:'100%', height:'100%', border:'0' });

    modal.appendChild(closeBtn);
    modal.appendChild(frame);
    container.appendChild(modal);
    container.addEventListener('click', e => { if (e.target === container) closeBookingModal(); });
    document.body.appendChild(container);
    return container;
  }

  function openBookingModal(artistId) {
    const container = createBookingModal();
    const frame = document.getElementById('bookingModalFrame');
    if (frame) frame.src = '/artistBookingDetails.html' + (artistId ? '?id=' + encodeURIComponent(artistId) : '');
    container.style.display = 'flex';
  }

  function closeBookingModal() {
    const c = document.getElementById('bookingModalContainer');
    if (c) c.remove();
  }

  window.openBookingModal = openBookingModal;
  window.closeBookingModal = closeBookingModal;
})();

// ---------------------------
// Delegated Events (Book, Fav, Profile)
// ---------------------------
document.addEventListener('click', e => {
  const card = e.target.closest('.artist-card');
  if (!card) return;
  let profile;
  try { profile = JSON.parse(card.dataset.profile); } catch { return; }

  if (e.target.closest('.btn-view-profile')) {
    e.stopPropagation();
    const artistId = profile._id || profile.userId || profile.id;
    if (artistId) window.location.href = `/card.html?id=${artistId}`;
    return;
  }

  if (e.target.closest('.btn-favorite')) {
    e.stopPropagation();
    const favBtn = e.target.closest('.btn-favorite');
    favBtn.classList.toggle('active');
    const icon = favBtn.querySelector('i');
    if (icon) { icon.classList.toggle('far'); icon.classList.toggle('fas'); }
    return;
  }

  if (e.target.closest('.btn-book')) {
    e.stopPropagation();
    const artistId = profile._id || profile.userId || profile.id;
    if (!artistId) { alert('Artist ID missing'); return; }
    if (!localStorage.getItem('token')) {
      alert('Please login to book this artist.');
      window.location.href = '/login.html';
      return;
    }
    openBookingModal(artistId);
    return;
  }
});

// ---------------------------
// Initialize
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderProfiles();
  setupScrollHeader();
}

)
// Toggle filters on mobile/tablet
filterToggle = document.getElementById("filterToggle");
filterSection = document.getElementById("filterSection");
if (filterToggle && filterSection) {
  filterToggle.addEventListener("click", () => {
    filterSection.classList.toggle("active");
    const isOpen = filterSection.classList.contains("active");
    filterToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    filterToggle.querySelector("i").classList.toggle("fa-times", isOpen);
    filterToggle.querySelector("i").classList.toggle("fa-sliders-h", !isOpen);
    filterToggle.innerHTML = isOpen
      ? '<i class="fas fa-times"></i> Hide Filters'
      : '<i class="fas fa-sliders-h"></i> Show Filters';
  });
}
(function(){
  const toggle = document.getElementById('navToggle');
  const navList = document.querySelector('#mainNav ul');
  if (!toggle || !navList) return;

  // Toggle handler
  toggle.addEventListener('click', function(){
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    this.classList.toggle('open', !expanded);
    navList.classList.toggle('show', !expanded);
  });

  // Close nav on escape
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && navList.classList.contains('show')) {
      navList.classList.remove('show');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
      toggle.focus();
    }
  });

  // Ensure nav shows on resize to desktop
  let rr;
  window.addEventListener('resize', function(){
    clearTimeout(rr);
    rr = setTimeout(function(){
      if (window.innerWidth > 900) {
        navList.classList.remove('show');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
      }
    }, 120);
  });
})();

