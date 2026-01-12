// public/js/sessionAuth.js
// Provides startOAuthAs(role) to safely begin a new OAuth flow after clearing old session state.

async function startOAuthAs(role) {
  try {
    // 1) Clear server cookies (best-effort)
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});

    // 2) Clear localStorage so no stale Authorization tokens linger
    try {
      ['token','userId','role','userEmail','artistDraftProfile','organizerFilterState','sessionRole'].forEach(k => localStorage.removeItem(k));
    } catch (e) {}

    // 3) Kick off OAuth with state defining desired session role
    if (role === 'organizer') {
      window.location.href = '/api/auth/google/organizer';
    } else {
      window.location.href = '/api/auth/google';
    }
  } catch (err) {
    console.error('startOAuthAs error', err);
    window.location.href = role === 'organizer' ? '/api/auth/google/organizer' : '/api/auth/google';
  }
}

// call periodically or on page load to sync session role
async function syncSessionRoleFromServer() {
  try {
    const res = await fetch('/api/auth/session-role', { credentials: 'include' });
    if (!res.ok) return;
    const j = await res.json();
    const serverSessionRole = j && j.sessionRole ? j.sessionRole : null;
    const clientRole = localStorage.getItem('role') || null;
    if (serverSessionRole !== clientRole) {
      // clear client side stale tokens to avoid mixed sessions
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
      } catch (e) {}
    }
  } catch (e) { /* ignore */ }
}

// Auto-wire common buttons by id when present
(function(){
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    // Sync session role on page load
    syncSessionRoleFromServer();

    const artistBtnIds = ['btn-login','btn-artist'];
    artistBtnIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => { e.preventDefault(); startOAuthAs('artist'); });
    });
    const organizerBtnIds = ['organizerBtn','btn-organizer','organizerLoginBtn'];
    organizerBtnIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => { e.preventDefault(); startOAuthAs('organizer'); });
    });
  });
})();

// Expose globally (optional)
window.startOAuthAs = startOAuthAs;
window.syncSessionRoleFromServer = syncSessionRoleFromServer;
