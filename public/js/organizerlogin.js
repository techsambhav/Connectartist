// public/js/organizerlogin.js
// Small helper to capture returned token from OAuth redirect (server writes small HTML and also sets httpOnly cookie).
(function () {
  function readUrlToken() {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userId = params.get('userId');
      const role = params.get('role');
      if (token && userId) {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('userId', userId);
          if (role) localStorage.setItem('role', role);
        } catch (e) {
          console.warn('Could not store token in localStorage', e);
        }
        // Decide where to redirect after storing token
        // Priority: explicit `redirect` param -> organizer role -> fallback frontend
        const redirectParam = params.get('redirect') || params.get('redirectTo') || params.get('organizerRedirect');
        if (redirectParam) {
          // Normalize common values that might point to the organizer dashboard
          if (redirectParam.includes('organizer/dashboard') || redirectParam.includes('organizerdashboard')) {
            window.location.replace('/organizerdashboard.html');
          } else {
            window.location.replace(redirectParam);
          }
        } else if (role === 'organizer' || window.location.pathname.includes('organizerlogin')) {
          // Role indicates organizer — go to the static organizer page
          window.location.replace('/organizerdashboard.html');
        } else {
          window.location.replace('/frontend.html');
        }
      }
    } catch (e) {
      // ignore
    }
  }
  document.addEventListener('DOMContentLoaded', readUrlToken);
})();
