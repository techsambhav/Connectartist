// public/js/organizerDashboard.js
// Unified organizer dashboard script — renders bookings and refreshes when notified
(async function () {
  const container = document.getElementById('bookingsList') || document.getElementById('bookingsGrid') || document.getElementById('list');
  if (!container) return;

  function emptyHtml(msg) {
    container.innerHTML = `<div class="empty" style="padding:18px;color:#666">${msg}</div>`;
  }

  function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleString(); } catch (e) { return String(d); }
  }

  function bookingCardHtml(b) {
    const artistName = (b.artistProfile && (b.artistProfile.displayName || b.artistProfile.name)) || b.artistName || 'Artist';
    const avatar = (b.artistProfile && (b.artistProfile.avatarUrl || b.artistProfile.avatar)) || (b.artistAvatar || '/images/default-avatar.png');
    const eventDate = b.eventDate ? formatDate(b.eventDate) : (b.eventOn || '');
    const location = b.eventLocation || b.venue || '';
    const price = b.price || b.amount || '—';
    // Prefer same-origin relative endpoints to avoid CORS (some stored booking.files.* may point at production host)
    const tryBookingUrl = (b.files && (b.files.bookingOrgUrl || b.files.receiptUrl)) || null;
    let bookingPdf;
    try {
      if (tryBookingUrl) {
        const urlObj = new URL(tryBookingUrl, window.location.href);
        bookingPdf = (urlObj.origin === window.location.origin) ? urlObj.href : null;
      }
    } catch (e) { bookingPdf = null; }
    bookingPdf = bookingPdf || `/api/escrow/bookings/${encodeURIComponent(b._id)}/files/booking_org`;

    const tryContactUrl = (b.files && b.files.bookingArtistUrl) || null;
    let contactPdf;
    try {
      if (tryContactUrl) {
        const urlObj = new URL(tryContactUrl, window.location.href);
        contactPdf = (urlObj.origin === window.location.origin) ? urlObj.href : null;
      }
    } catch (e) { contactPdf = null; }
    contactPdf = contactPdf || `/api/escrow/bookings/${encodeURIComponent(b._id)}/files/booking_artist`;

    return `
      <div class="booking-card" style="border:1px solid #eee;padding:12px;margin:10px;border-radius:8px;display:flex;gap:12px;align-items:center;">
        <img src="${avatar}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;" />
        <div style="flex:1">
          <div style="font-weight:600">${artistName}</div>
          <div style="color:#666">${eventDate} ${location ? '• ' + location : ''}</div>
          <div style="margin-top:8px">Price: ₹${price}</div>
          <div style="margin-top:6px;color:#444;font-size:12px">Status: ${(b.status || 'pending')}</div>
        </div>
          <div style="display:flex;flex-direction:column;gap:8px;min-width:140px">
            <button class="btn download-booking" data-url="${bookingPdf}" data-id="${b._id}">Booking PDF</button>
            <button class="btn download-contact" data-url="${contactPdf}" data-id="${b._id}">Artist Contact PDF</button>
            <button class="btn contact-artist" data-email="${b.artistEmail || ''}" style="background:#f2f2f2;border:1px solid #ddd;">Contact Artist</button>
          </div>
      </div>
    `;
  }

  async function fetchBookings() {
    try {
      container.innerHTML = '<div class="empty">Loading bookings…</div>';
      const res = await fetch('/api/organizer/bookings', { credentials: 'include' });

      // handle unauthorized
      if (res.status === 401 || res.status === 403) {
        emptyHtml('You must be logged in to view bookings. <a href="/api/auth/google?redirect=' + encodeURIComponent('/organizerdashboard.html') + '">Sign in</a>');
        return [];
      }

      const json = await res.json().catch(() => null);
      // handle server that returns either array or {success:true, bookings:[]}
      let bookings = [];
      if (Array.isArray(json)) bookings = json;
      else if (json && json.success === true && Array.isArray(json.bookings)) bookings = json.bookings;
      else if (json && Array.isArray(json.data)) bookings = json.data; // defensive
      else {
        // no bookings
        emptyHtml('No bookings yet.');
        return [];
      }

      if (!bookings || bookings.length === 0) {
        emptyHtml('No bookings yet.');
        return [];
      }

      // render
      container.innerHTML = bookings.map(b => bookingCardHtml(b)).join('');
      attachActions(container);
      return bookings;
    } catch (err) {
      console.error('fetchBookings error', err);
      emptyHtml('Error loading bookings — check console for details.');
      return [];
    }
  }

  function attachActions(containerEl) {
    // download links open via href already. Add handlers for contact button
    containerEl.querySelectorAll('.contact-artist').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const email = btn.dataset.email;
        if (email) window.location.href = `mailto:${email}?subject=Query about booking`;
        else alert('Artist contact not available yet.');
      });
    });

      // download booking PDF — fetch binary and force download
      containerEl.querySelectorAll('.download-booking').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          const url = btn.dataset.url;
          const idFromAttr = btn.dataset.id || '';
          if (!url) { alert('No file URL available'); return; }
          const origText = btn.textContent;
          try {
            btn.disabled = true;
            btn.textContent = 'Downloading…';
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) { alert('Failed to fetch file'); return; }
            const blob = await res.blob();
            // try to extract filename from headers
            let filename = idFromAttr ? `${idFromAttr}_booking.pdf` : 'booking.pdf';
            try {
              const cd = res.headers.get('content-disposition') || '';
              if (cd) {
                const m1 = cd.match(/filename\*=(?:UTF-8'')?([^;\n]+)/i);
                const m2 = cd.match(/filename="?([^";\n]+)"?/i);
                const fn = (m1 && decodeURIComponent(m1[1])) || (m2 && m2[1]);
                if (fn) filename = fn;
              }
            } catch (e) { /* ignore */ }
            const a = document.createElement('a');
            const objectUrl = URL.createObjectURL(blob);
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            console.error('Download error', err);
            alert('Download failed — check console for details');
          } finally {
            btn.disabled = false;
            btn.textContent = origText;
          }
        });
      });

      // download contact PDF
      containerEl.querySelectorAll('.download-contact').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          const url = btn.dataset.url;
          const idFromAttr = btn.dataset.id || '';
          if (!url) { alert('No file URL available'); return; }
          const origText = btn.textContent;
          try {
            btn.disabled = true;
            btn.textContent = 'Downloading…';
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) { alert('Failed to fetch file'); return; }
            const blob = await res.blob();
            let filename = idFromAttr ? `${idFromAttr}_contact.pdf` : 'contact.pdf';
            try {
              const cd = res.headers.get('content-disposition') || '';
              if (cd) {
                const m1 = cd.match(/filename\*=(?:UTF-8'')?([^;\n]+)/i);
                const m2 = cd.match(/filename="?([^";\n]+)"?/i);
                const fn = (m1 && decodeURIComponent(m1[1])) || (m2 && m2[1]);
                if (fn) filename = fn;
              }
            } catch (e) { /* ignore */ }
            const a = document.createElement('a');
            const objectUrl = URL.createObjectURL(blob);
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            console.error('Download error', err);
            alert('Download failed — check console for details');
          } finally {
            btn.disabled = false;
            btn.textContent = origText;
          }
        });
      });
  }

  // poll or refresh when bookings created in other tab
  window.addEventListener('storage', (ev) => {
    if (!ev.key) return;
    if (ev.key === 'bookingCompleted') {
      try { fetchBookings(); } catch (e) {}
    }
  });

  // listen for postMessage from booking iframe/modal
  window.addEventListener('message', (ev) => {
    const m = ev && ev.data;
    if (!m) return;
    if (m.type === 'booking:completed') {
      fetchBookings();
    }
  });

  // initial load
  await fetchBookings();

  // expose refresh function for manual use
  window.reloadOrganizerBookings = fetchBookings;
})();
