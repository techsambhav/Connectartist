// public/js/client_checkout.js (v2) — no amount on client; server derives fixed price from artist doc
// Requires: a "Book Now" click should call bookNowForArtist(artistId, payload)
// payload requires at least: eventDate (yyyy-mm-dd); optionally eventTime, eventLocation, notes
// NOTE: do NOT send organizerId from the client. The server now requires authentication
// and will attach organizer information from the logged-in user (httpOnly cookie or Bearer token).

async function bookNowForArtist(artistId, payload) {
  try {
    if (!artistId) throw new Error('artistId is required');
    // If organizerId or eventDate missing, open the booking modal UI instead so user can fill details
    if (!payload || !payload.eventDate) {
      // Try to open booking modal if available (discover/card pages provide openBookingModal)
      if (typeof openBookingModal === 'function') {
        openBookingModal(artistId);
        return;
      }
      throw new Error('eventDate is required in payload');
    }

    // 1) Create booking + order (server derives artist price; client never sends amount)
    // Include Authorization header when token is available so server can determine organizerId from JWT
    const token = localStorage.getItem('token') || null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/escrow/bookings/artist/${artistId}/create-order`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to create order');

    const { order, bookingId } = data;

    // 2) Get public key for Checkout
    const k = await fetch('/api/public/razorpay-key');
    const j = await k.json();
    const RAZORPAY_KEY_ID = (j && j.key_id) ? j.key_id : window.RAZORPAY_KEY_ID || '';

    if (!RAZORPAY_KEY_ID) {
      throw new Error('Razorpay key not available');
    }

    // 3) Open Razorpay Checkout — the amount is baked into the order; cannot be changed by client
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'ConnectArtist',
      description: `Booking ${order.receipt}`,
      order_id: order.id,
      handler: function (response) {
        // Payment succeeded (captured via webhook). Show success and redirect.
        alert('Payment processed. You will receive confirmation shortly.');
        window.location.href = `/booking-success.html?booking=${bookingId}`;
      },
      modal: {
        ondismiss: function () {
          console.log('Checkout dismissed');
        }
      },
      prefill: {}, // optionally add organizer prefill here
      theme: { color: '#F37254' }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error('bookNowForArtist error', err);
    alert('Error: ' + (err.message || err));
  }
}

// Example: wire a button with data-artist-id
// <button class="book-now" data-artist-id="{{artistId}}">Book Now</button>
// document.querySelectorAll('.book-now').forEach(btn => {
//   btn.addEventListener('click', () => {
//     const artistId = btn.getAttribute('data-artist-id');
//     // Build payload from your UI (do NOT include organizerId)
//     const payload = { eventDate: '2025-09-05', eventLocation: 'Delhi' };
//     bookNowForArtist(artistId, payload);
//   });
// });
