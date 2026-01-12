// ============================================================================
// PROFESSIONAL ARTIST BOOKING FORM - COMPREHENSIVE CLIENT-SIDE LOGIC
// Features: Manual Venue Input, Geolocation, Validation, File Upload, Razorpay Integration
// ============================================================================

let selectedFiles = [];

// Empty function to prevent Google Maps API callback errors
window.initAutocomplete = function() {
  console.log('Google Maps API not used - manual venue input enabled');
};

// ============================================================================
// GEOLOCATION & VENUE HELPERS
// ============================================================================

function useMyLocation() {
  const statusEl = document.getElementById('location-status');
  const venueInput = document.getElementById('venueAutocomplete');

  if (!navigator.geolocation) {
    showMessage('❌ Geolocation is not supported by your browser', 'error');
    return;
  }

  // Show loading state
  if (statusEl) {
    statusEl.textContent = '📍 Getting your location...';
    statusEl.style.color = '#00b894';
    statusEl.style.display = 'block';
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Store coordinates
      document.getElementById('venue_lat').value = lat;
      document.getElementById('venue_lng').value = lng;

      // Try to get address from reverse geocoding (using free nominatim API)
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (data && data.display_name) {
          const address = data.display_name;
          venueInput.value = address;
          document.getElementById('venue_formatted_address').value = address;

          // Extract city and postal code
          if (data.address) {
            document.getElementById('venue_city').value = data.address.city || data.address.town || data.address.village || '';
            document.getElementById('venue_postal_code').value = data.address.postcode || '';
          }

          if (statusEl) {
            statusEl.textContent = '✅ Location found!';
            statusEl.style.color = '#00b894';
            setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
          }

          clearError('venueAutocomplete');
          showMessage('✅ Location detected successfully!', 'success');
        }
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
        // Still save coordinates even if address lookup fails
        venueInput.value = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        document.getElementById('venue_formatted_address').value = venueInput.value;

        if (statusEl) {
          statusEl.textContent = '⚠️ Got coordinates, but address lookup failed';
          statusEl.style.color = '#fdcb6e';
        }

        showMessage('✅ Coordinates saved. Please add venue details manually.', 'success');
      }
    },
    (error) => {
      console.error('Geolocation error:', error);
      let errorMsg = 'Unable to get your location. ';

      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg += 'Please enable location permissions in your browser.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg += 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMsg += 'Location request timed out.';
          break;
        default:
          errorMsg += 'An unknown error occurred.';
      }

      if (statusEl) {
        statusEl.textContent = '❌ ' + errorMsg;
        statusEl.style.color = '#d63031';
      }

      showMessage('❌ ' + errorMsg, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function clearHiddenVenueFields() {
  document.getElementById('venue_place_id').value = '';
  document.getElementById('venue_lat').value = '';
  document.getElementById('venue_lng').value = '';
  document.getElementById('venue_formatted_address').value = '';
  document.getElementById('venue_city').value = '';
  document.getElementById('venue_postal_code').value = '';
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);

  if (field) field.setAttribute('aria-invalid', 'true');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);

  if (field) field.removeAttribute('aria-invalid');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
}

function validateEmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

function validatePhone(phone) {
  const cleaned = phone.trim().replace(/\s+/g, '');
  // India: +91XXXXXXXXXX or 10 digits or E.164-like
  const indiaRegex = /^(\+91|91)?[6-9]\d{9}$/;
  const e164Regex = /^\+?[1-9]\d{7,14}$/;
  return indiaRegex.test(cleaned) || e164Regex.test(cleaned);
}

function validateForm() {
  let isValid = true;

  // Name validation
  const name = document.getElementById('organizerName').value.trim();
  if (name.length < 2) {
    showError('organizerName', 'Name must be at least 2 characters');
    isValid = false;
  } else {
    clearError('organizerName');
  }

  // Email validation
  const email = document.getElementById('organizerEmail').value.trim();
  if (!validateEmail(email)) {
    showError('organizerEmail', 'Please enter a valid email address');
    isValid = false;
  } else {
    clearError('organizerEmail');
  }

  // Phone validation
  const phone = document.getElementById('organizerPhone').value.trim();
  if (!validatePhone(phone)) {
    showError('organizerPhone', 'Invalid phone format. Use 10 digits or +91XXXXXXXXXX');
    isValid = false;
  } else {
    clearError('organizerPhone');
  }

  // Event type validation
  const eventType = document.getElementById('eventType').value;
  if (!eventType) {
    showError('eventType', 'Please select an event type');
    isValid = false;
  } else {
    clearError('eventType');
  }

  // Audience size validation
  const audienceSize = parseInt(document.getElementById('audienceSize').value);
  if (!audienceSize || audienceSize < 1) {
    showError('audienceSize', 'Please enter a valid audience size');
    isValid = false;
  } else {
    clearError('audienceSize');
  }

  // Venue validation (accept manual input if Places API not available)
  const venueInput = document.getElementById('venueAutocomplete').value.trim();
  const formattedAddress = document.getElementById('venue_formatted_address').value.trim();

  if (!venueInput) {
    showError('venueAutocomplete', 'Please enter a venue address');
    isValid = false;
  } else {
    // If user typed address, ensure it's saved to formatted_address field
    if (!formattedAddress) {
      document.getElementById('venue_formatted_address').value = venueInput;
    }
    clearError('venueAutocomplete');
  }

  // Date validation (must be in future)
  const eventDate = document.getElementById('eventDate').value;
  if (!eventDate) {
    showError('eventDate', 'Please select an event date');
    isValid = false;
  } else {
    const selectedDate = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      showError('eventDate', 'Event date must be in the future');
      isValid = false;
    } else {
      clearError('eventDate');
    }
  }

  // Time validation
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;

  if (!startTime) {
    showError('startTime', 'Please enter a start time');
    isValid = false;
  } else {
    clearError('startTime');
  }

  if (!endTime) {
    showError('endTime', 'Please enter an end time');
    isValid = false;
  } else if (startTime && endTime && endTime <= startTime) {
    showError('endTime', 'End time must be after start time');
    isValid = false;
  } else {
    clearError('endTime');
  }

  // Price validation
  const price = parseFloat(document.getElementById('price').value);
  if (!price || price < 1) {
    showError('price', 'Please enter a valid price');
    isValid = false;
  } else {
    clearError('price');
  }

  // Terms & Conditions validation
  const termsAccepted = document.getElementById('termsAccepted').checked;
  const cancellationAccepted = document.getElementById('cancellationPolicyAccepted').checked;

  if (!termsAccepted || !cancellationAccepted) {
    showError('terms', 'You must accept both Terms & Conditions and Cancellation Policy');
    isValid = false;
  } else {
    clearError('terms');
  }

  return isValid;
}

// ============================================================================
// FILE UPLOAD HANDLING
// ============================================================================

function setupFileUpload() {
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.getElementById('fileUploadArea');
  const fileList = document.getElementById('fileList');

  // Click to upload
  uploadArea.addEventListener('click', (e) => {
    if (e.target === uploadArea || e.target.closest('.file-upload')) {
      fileInput.click();
    }
  });

  // File selection
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

function handleFiles(files) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];

  for (const file of files) {
    if (file.size > maxSize) {
      showMessage(`File "${file.name}" exceeds 5MB limit`, 'error');
      continue;
    }

    if (!allowedTypes.includes(file.type)) {
      showMessage(`File "${file.name}" has unsupported format`, 'error');
      continue;
    }

    selectedFiles.push(file);
  }

  renderFileList();
}

function renderFileList() {
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span>${file.name} (${formatFileSize(file.size)})</span>
      <button type="button" onclick="removeFile(${index})">Remove</button>
    `;
    fileList.appendChild(fileItem);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

window.removeFile = removeFile;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================================
// MESSAGE DISPLAY
// ============================================================================

function showMessage(text, type = 'error') {
  const message = document.getElementById('message');
  if (!message) return;

  message.textContent = text;
  message.className = `visible ${type}`;
  message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (type === 'success') {
    setTimeout(() => {
      message.classList.remove('visible');
    }, 5000);
  }
}

// ============================================================================
// JWT EXPIRY CHECK
// ============================================================================

function isJwtExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload || !payload.exp) return false;
    return (payload.exp * 1000) < Date.now();
  } catch (e) {
    return true;
  }
}

// ============================================================================
// MAIN FORM INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const bookingForm = document.getElementById("bookingForm");
  const hiddenIdField = document.getElementById("userId");
  const urlParams = new URLSearchParams(window.location.search);
  const artistIdFromUrl = urlParams.get("id") || urlParams.get("userId") || urlParams.get('artistId');

  if (hiddenIdField && !hiddenIdField.value && artistIdFromUrl) {
    hiddenIdField.value = artistIdFromUrl;
  }

  // Setup file upload handlers
  setupFileUpload();

  // Real-time validation on blur
  document.getElementById('organizerEmail').addEventListener('blur', () => {
    const email = document.getElementById('organizerEmail').value.trim();
    if (email && !validateEmail(email)) {
      showError('organizerEmail', 'Please enter a valid email address');
    } else {
      clearError('organizerEmail');
    }
  });

  document.getElementById('organizerPhone').addEventListener('blur', () => {
    const phone = document.getElementById('organizerPhone').value.trim();
    if (phone && !validatePhone(phone)) {
      showError('organizerPhone', 'Invalid phone format. Use 10 digits or +91XXXXXXXXXX');
    } else {
      clearError('organizerPhone');
    }
  });

  document.getElementById('endTime').addEventListener('change', () => {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    if (startTime && endTime && endTime <= startTime) {
      showError('endTime', 'End time must be after start time');
    } else {
      clearError('endTime');
    }
  });

  document.getElementById('eventDate').addEventListener('change', () => {
    const eventDate = document.getElementById('eventDate').value;
    if (eventDate) {
      const selectedDate = new Date(eventDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        showError('eventDate', 'Event date must be in the future');
      } else {
        clearError('eventDate');
      }
    }
  });

  // Venue manual input handler
  const venueInput = document.getElementById('venueAutocomplete');
  if (venueInput) {
    venueInput.addEventListener('blur', () => {
      const address = venueInput.value.trim();
      if (address) {
        document.getElementById('venue_formatted_address').value = address;
        clearError('venueAutocomplete');
      }
    });

    venueInput.addEventListener('input', () => {
      const address = venueInput.value.trim();
      if (address) {
        document.getElementById('venue_formatted_address').value = address;
      }
    });
  }

  // Fetch artist price for prefill
  async function ensureArtistPrice() {
    try {
      const aid = (hiddenIdField && hiddenIdField.value) || artistIdFromUrl;
      if (!aid) return;

      const res = await fetch(`/api/profiles/${encodeURIComponent(aid)}`);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data && data.success && data.profile) {
        const prof = data.profile;
        const priceVal = prof.price || prof.bookingPrice || prof.fee || '';
        if (priceVal && document.getElementById('price')) {
          document.getElementById('price').value = priceVal;
          document.getElementById('price').placeholder = `Suggested: ₹${priceVal}`;
        }
      }
    } catch (e) {
      console.warn('Could not fetch artist profile for price', e);
    }
  }

  ensureArtistPrice();

  // ============================================================================
  // FORM SUBMISSION HANDLER
  // ============================================================================

  bookingForm && bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Run comprehensive validation
    if (!validateForm()) {
      showMessage('Please fix the errors above before submitting', 'error');
      return;
    }

    // Disable submit button during processing
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    // Check for authentication token
    let token = localStorage.getItem("token");
    if (token && isJwtExpired(token)) {
      console.warn('Clearing expired local token');
      localStorage.removeItem('token');
      token = null;
    }

    const artistId = hiddenIdField ? hiddenIdField.value : artistIdFromUrl;
    if (!artistId) {
      showMessage('Artist ID is missing. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking & Proceed to Payment';
      return;
    }

    // Build payload with backend-compatible field names
    // The backend expects: organizerName, organizerEmail, organizerPhone, eventDate, eventTime, eventLocation, notes
    const venueAddress = document.getElementById('venue_formatted_address').value || document.getElementById('venueAutocomplete').value.trim();

    // Build notes with all additional information
    const additionalInfo = [];

    // Add event type and audience size
    const eventType = document.getElementById('eventType').value;
    const audienceSize = document.getElementById('audienceSize').value;
    if (eventType) additionalInfo.push(`Event Type: ${eventType}`);
    if (audienceSize) additionalInfo.push(`Audience Size: ${audienceSize}`);

    // Add times
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    if (endTime) additionalInfo.push(`End Time: ${endTime}`);

    // Add backup contact
    const backupName = document.getElementById('organizerBackupName').value.trim();
    const backupPhone = document.getElementById('organizerBackupPhone').value.trim();
    if (backupName || backupPhone) {
      additionalInfo.push(`Backup Contact: ${backupName || 'N/A'} - ${backupPhone || 'N/A'}`);
    }

    // Add performance details
    const numSets = document.getElementById('numberOfSets').value;
    const setDuration = document.getElementById('setDuration').value;
    const loadInTime = document.getElementById('loadInTime').value;
    const soundcheckTime = document.getElementById('soundcheckTime').value;
    if (numSets) additionalInfo.push(`Number of Sets: ${numSets}`);
    if (setDuration) additionalInfo.push(`Set Duration: ${setDuration} minutes`);
    if (loadInTime) additionalInfo.push(`Load-in Time: ${loadInTime}`);
    if (soundcheckTime) additionalInfo.push(`Soundcheck Time: ${soundcheckTime}`);

    // Add technical rider
    const technicalItems = [];
    if (document.getElementById('paSystem').checked) technicalItems.push('PA System');
    if (document.getElementById('monitors').checked) technicalItems.push('Monitors');
    if (document.getElementById('lights').checked) technicalItems.push('Lights');
    if (document.getElementById('backline').checked) technicalItems.push('Backline');
    if (document.getElementById('power').checked) technicalItems.push('Dedicated Power');
    if (technicalItems.length > 0) {
      additionalInfo.push(`Technical Requirements: ${technicalItems.join(', ')}`);
    }
    const stageSize = document.getElementById('stageSize').value.trim();
    if (stageSize) additionalInfo.push(`Stage Size: ${stageSize}`);
    const techNotes = document.getElementById('technicalNotes').value.trim();
    if (techNotes) additionalInfo.push(`Technical Notes: ${techNotes}`);

    // Add travel & accommodation
    const travelResp = document.getElementById('travelResponsibility').value;
    const accommodation = document.getElementById('accommodationProvided').value;
    const hotelName = document.getElementById('hotelName').value.trim();
    const travelAllowance = document.getElementById('travelAllowance').value;
    if (travelResp) additionalInfo.push(`Travel Responsibility: ${travelResp}`);
    if (accommodation === 'true') {
      additionalInfo.push(`Accommodation Provided: Yes${hotelName ? ' (' + hotelName + ')' : ''}`);
    }
    if (travelAllowance) additionalInfo.push(`Travel Allowance: ₹${travelAllowance}`);

    // Add user notes
    const userNotes = document.getElementById('notes').value.trim();
    if (userNotes) additionalInfo.push(`Additional Notes: ${userNotes}`);

    // Add T&C acceptance
    additionalInfo.push('Terms & Conditions Accepted: Yes (v1.0)');
    additionalInfo.push('Cancellation Policy Accepted: Yes');

    // Combine all notes
    const combinedNotes = additionalInfo.join(' | ');

    const payload = {
      artistId: artistId,
      organizerName: document.getElementById('organizerName').value.trim(),
      organizerEmail: document.getElementById('organizerEmail').value.trim(),
      organizerPhone: document.getElementById('organizerPhone').value.trim(),
      eventDate: document.getElementById('eventDate').value,
      eventTime: startTime, // Backend expects 'eventTime' which maps to 'startTime' in DB
      eventLocation: venueAddress, // Backend expects 'eventLocation' which maps to 'venue' in DB
      notes: combinedNotes,
      price: parseFloat(document.getElementById('price').value)
    };    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      showMessage('Creating booking...', 'success');

      const res = await fetch(`/api/escrow/bookings/artist/${encodeURIComponent(artistId)}/create-order`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(async () => {
        const t = await res.text();
        throw new Error('Invalid server response: ' + t);
      });

      if (!data || !data.success) {
        throw new Error(data && data.message ? data.message : 'Failed to create booking');
      }

      const order = data.order || null;
      const bookingId = data.bookingId || null;
      const paymentGatewayConfigured = data.paymentGatewayConfigured;

      // If server responded but payment gateway is not configured (dev mode)
      if (!order || paymentGatewayConfigured === false) {
        showMessage('Booking created successfully (dev mode - no payment required)', 'success');
        bookingForm.style.display = 'none';
        showSuccessBox({ bookingId, artistId });

        // Notify server to run post-booking actions
        try {
          await fetch(`/api/payments/bookings/${encodeURIComponent(bookingId)}/verify`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'none' })
          });
        } catch (e) {
          console.warn('Verify endpoint failed:', e);
        }

        // Poll for generated files
        await pollForFiles(bookingId, token);

        // Notify parent window
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'booking:completed', bookingId }, '*');
          }
          localStorage.setItem('bookingCompleted', JSON.stringify({ bookingId, ts: Date.now() }));
        } catch (e) {}

        return;
      }

      // Get Razorpay public key
      const keyRes = await fetch('/api/public/razorpay-key', { credentials: 'include' });
      const keyJson = await keyRes.json().catch(() => ({}));
      const RAZORPAY_KEY_ID = keyJson.key_id || window.RAZORPAY_KEY_ID || '';

      if (!RAZORPAY_KEY_ID) {
        throw new Error('Payment gateway configuration missing');
      }

      // Open Razorpay Checkout
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'ConnectArtist',
        description: `Artist Booking - ${payload.eventType}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            // Hide form and show success immediately
            bookingForm.style.display = 'none';
            showSuccessBox({ bookingId, artistId });
            showMessage('Payment successful! Processing your booking...', 'success');

            // Verify payment with server
            try {
              const verifyRes = await fetch(`/api/payments/bookings/${encodeURIComponent(bookingId)}/verify`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  method: 'razorpay'
                })
              });

              if (verifyRes.ok) {
                showMessage('Booking confirmed! Generating documents...', 'success');
              }
            } catch (e) {
              console.warn('Verify endpoint failed:', e);
            }

            // Poll for generated booking files
            await pollForFiles(bookingId, token);

            // Notify parent window and other tabs
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'booking:completed', bookingId }, '*');
              }
              localStorage.setItem('bookingCompleted', JSON.stringify({ bookingId, ts: Date.now() }));
            } catch (e) {}

          } catch (e) {
            console.error('Error handling payment:', e);
            showMessage('Payment received but verification pending. Check your email for confirmation.', 'error');
          }
        },
        modal: {
          ondismiss: function () {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Booking & Proceed to Payment';
            showMessage('Payment was cancelled. You can try again when ready.', 'error');
          }
        },
        prefill: {
          name: payload.organizerName,
          email: payload.organizerEmail,
          contact: payload.organizerPhone
        },
        notes: {
          bookingId: bookingId,
          eventType: payload.eventType,
          eventDate: payload.eventDate
        },
        theme: {
          color: '#00b894'
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();

      // Re-enable button after Razorpay opens (in case user closes it)
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Booking & Proceed to Payment';
      }, 1000);

    } catch (error) {
      console.error('Error creating booking:', error);
      showMessage('❌ ' + (error.message || 'Failed to create booking. Please try again.'), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking & Proceed to Payment';
    }
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Poll server for booking files (receipt/booking PDFs)
  async function pollForFiles(bookingId, token) {
    let tries = 0;
    const maxTries = 10;

    while (tries < maxTries) {
      try {
        const pollHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
          headers: pollHeaders,
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          const booking = data.booking || data;

          if (booking && booking.files && (booking.files.receiptUrl || booking.files.bookingOrgUrl)) {
            const url = booking.files.receiptUrl || booking.files.bookingOrgUrl;

            // Update download button in success box
            const downloadBtn = document.querySelector('.download-booking-btn');
            if (downloadBtn) {
              downloadBtn.dataset.url = url;
              downloadBtn.disabled = false;
              downloadBtn.textContent = 'Download Booking Confirmation';
            }

            return true;
          }
        }
      } catch (e) {
        console.warn('Poll attempt failed:', e);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
      tries++;
    }

    return false;
  }

  // Show success dialog after booking creation
  function showSuccessBox({ bookingId, artistId }) {
    if (bookingForm) bookingForm.setAttribute('aria-hidden', 'true');

    // Add animations CSS
    if (!document.getElementById('success-box-animations')) {
      const style = document.createElement('style');
      style.id = 'success-box-animations';
      style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.8) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes scaleOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.9); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes checkmarkPop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        @keyframes checkmarkDraw { from { opacity: 0; transform: scale(0.7) rotate(-10deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);
    }

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'booking-success-backdrop';
    backdrop.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
      z-index: 9999; display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'booking-success-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.style.cssText = `
      background: linear-gradient(135deg, #ffffff 0%, #f8fafb 100%);
      max-width: 540px; width: 92%; padding: 0; border-radius: 20px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.1);
      text-align: center; position: relative;
      animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    `;

    // Header section with gradient
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #1a73e8 0%, #00b894 100%);
      padding: 40px 32px 32px; position: relative; overflow: hidden;
    `;

    // Animated checkmark with circle
    const checkmarkContainer = document.createElement('div');
    checkmarkContainer.style.cssText = `
      width: 80px; height: 80px; margin: 0 auto 16px;
      background: white; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      animation: checkmarkPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
    `;

    const checkmark = document.createElement('div');
    checkmark.innerHTML = '✓';
    checkmark.style.cssText = `
      font-size: 48px; font-weight: 700; color: #00b894;
      animation: checkmarkDraw 0.4s ease-out 0.4s both;
    `;
    checkmarkContainer.appendChild(checkmark);

    const title = document.createElement('h2');
    title.textContent = 'Booking Confirmed!';
    title.style.cssText = `
      color: white; margin: 0 0 8px; font-size: 32px; font-weight: 700;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      animation: slideDown 0.5s ease-out 0.3s both;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Your event is secured';
    subtitle.style.cssText = `
      color: rgba(255, 255, 255, 0.95); font-size: 16px; margin: 0;
      animation: slideDown 0.5s ease-out 0.4s both;
    `;

    header.appendChild(checkmarkContainer);
    header.appendChild(title);
    header.appendChild(subtitle);

    // Content section
    const content = document.createElement('div');
    content.style.cssText = `padding: 32px; background: white;`;

    // Booking ID card
    const bookingCard = document.createElement('div');
    bookingCard.style.cssText = `
      background: #f8fafb; border: 2px solid #e8f0fe; border-radius: 12px;
      padding: 20px; margin-bottom: 24px;
      animation: fadeInUp 0.5s ease-out 0.5s both;
    `;

    const bookingLabel = document.createElement('div');
    bookingLabel.textContent = 'Booking ID';
    bookingLabel.style.cssText = `
      color: #666; font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 6px;
    `;

    const bookingIdText = document.createElement('div');
    bookingIdText.textContent = bookingId;
    bookingIdText.style.cssText = `
      color: #1a73e8; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace;
      word-break: break-all;
    `;

    bookingCard.appendChild(bookingLabel);
    bookingCard.appendChild(bookingIdText);

    const msgSub = document.createElement('p');
    msgSub.innerHTML = '📧 Confirmation email sent to your inbox';
    msgSub.style.cssText = `
      color: #666; font-size: 14px; margin: 0 0 28px;
      animation: fadeInUp 0.5s ease-out 0.6s both;
    `;

    // Download button with spinner
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-booking-btn';
    downloadBtn.dataset.bookingId = bookingId;
    downloadBtn.dataset.url = `/api/escrow/bookings/${encodeURIComponent(bookingId)}/files/booking_org`;
    downloadBtn.innerHTML = `
      <span style="display: inline-block;">📄</span>
      <span>Preparing documents...</span>
    `;
    downloadBtn.disabled = true;
    downloadBtn.style.cssText = `
      width: 100%; padding: 18px 24px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
      color: white; font-size: 16px; font-weight: 600; cursor: not-allowed;
      opacity: 0.6; margin-bottom: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
      animation: fadeInUp 0.5s ease-out 0.7s both;
      position: relative; overflow: hidden;
    `;

    // Enable download button after delay
    setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.style.cursor = 'pointer';
      downloadBtn.style.opacity = '1';
      downloadBtn.innerHTML = `
        <span style="display: inline-block;">⬇️</span>
        <span>Download Booking Confirmation</span>
      `;
      downloadBtn.addEventListener('mouseenter', () => {
        if (!downloadBtn.disabled) {
          downloadBtn.style.transform = 'translateY(-2px)';
          downloadBtn.style.boxShadow = '0 8px 20px rgba(26, 115, 232, 0.4)';
        }
      });
      downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.transform = 'translateY(0)';
        downloadBtn.style.boxShadow = '0 4px 12px rgba(26, 115, 232, 0.3)';
      });
    }, 2500);

    // Download handler
    downloadBtn.addEventListener('click', async () => {
      if (downloadBtn.disabled) return;

      const url = downloadBtn.dataset.url || `/api/escrow/bookings/${encodeURIComponent(bookingId)}/files/booking_org`;
      const originalHTML = downloadBtn.innerHTML;

      try {
        // Show downloading state with spinner
        downloadBtn.innerHTML = `
          <span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span>
          <span>Downloading your booking confirmation...</span>
        `;
        downloadBtn.disabled = true;
        downloadBtn.style.cursor = 'not-allowed';
        downloadBtn.style.opacity = '0.8';

        const resp = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/pdf' }
        });

        if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status} ${resp.statusText}`);

        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `booking-${bookingId}-confirmation.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        // Show success
        downloadBtn.innerHTML = `
          <span style="display: inline-block;">✓</span>
          <span>Download Complete</span>
        `;
        downloadBtn.style.background = 'linear-gradient(135deg, #00b894 0%, #00a07b 100%)';
        downloadBtn.style.opacity = '1';

        setTimeout(() => {
          downloadBtn.innerHTML = originalHTML;
          downloadBtn.disabled = false;
          downloadBtn.style.cursor = 'pointer';
          downloadBtn.style.background = 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)';
        }, 2500);

      } catch (err) {
        console.error('Download error:', err);
        downloadBtn.innerHTML = `
          <span style="display: inline-block;">⚠️</span>
          <span>Download Failed - Try Again</span>
        `;
        downloadBtn.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
        downloadBtn.disabled = false;
        downloadBtn.style.cursor = 'pointer';
        downloadBtn.style.opacity = '1';

        setTimeout(() => {
          downloadBtn.innerHTML = originalHTML;
          downloadBtn.style.background = 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)';
        }, 3000);

        showMessage('Could not download confirmation. Please check your dashboard.', 'error');
      }
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-success-btn';
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      width: 100%; padding: 16px; border: 2px solid #e0e0e0; border-radius: 12px;
      background: transparent; color: #666; font-size: 15px; font-weight: 600; cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: fadeInUp 0.5s ease-out 0.8s both;
    `;

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#f5f5f5';
      closeBtn.style.borderColor = '#bbb';
      closeBtn.style.transform = 'translateY(-1px)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.borderColor = '#e0e0e0';
      closeBtn.style.transform = 'translateY(0)';
    });

    // Close handler
    function close() {
      backdrop.style.animation = 'fadeOut 0.2s ease-out';
      dialog.style.animation = 'scaleOut 0.2s ease-out';
      setTimeout(() => {
        backdrop.remove();
        if (bookingForm) {
          bookingForm.style.display = '';
          bookingForm.removeAttribute('aria-hidden');
        }
      }, 200);
    }

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // Assemble dialog
    content.appendChild(bookingCard);
    content.appendChild(msgSub);
    content.appendChild(downloadBtn);
    content.appendChild(closeBtn);

    dialog.appendChild(header);
    dialog.appendChild(content);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Focus management
    downloadBtn.focus();
  }

  // Expose helper to set userId programmatically (for iframe usage)
  window.setBookingUserId = (id) => {
    if (hiddenIdField) hiddenIdField.value = id;
  };

  // Render an accessible modal success dialog with download and close actions
  function showSuccessBox({ bookingId, artistId, artistName }) {
    // Hide underlying content for accessibility
    if (bookingForm) bookingForm.setAttribute('aria-hidden', 'true');

    // Create backdrop
    let backdrop = document.getElementById('booking-success-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'booking-success-backdrop';
      backdrop.style.position = 'fixed';
      backdrop.style.left = '0';
      backdrop.style.top = '0';
      backdrop.style.width = '100%';
      backdrop.style.height = '100%';
      backdrop.style.background = 'rgba(0,0,0,0.5)';
      backdrop.style.display = 'flex';
      backdrop.style.alignItems = 'center';
      backdrop.style.justifyContent = 'center';
      backdrop.style.zIndex = '9999';
      document.body.appendChild(backdrop);
    }

    // Create dialog
    let dialog = document.getElementById('booking-success-dialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'booking-success-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.style.background = '#fff';
      dialog.style.borderRadius = '8px';
      dialog.style.padding = '20px';
      dialog.style.width = '90%';
      dialog.style.maxWidth = '540px';
      dialog.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
      dialog.style.maxHeight = '90%';
      dialog.style.overflow = 'auto';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '12px';
      header.innerHTML = `<div style="font-size:28px;color:#2e7d32">✓</div><div><h2 style="margin:0">Booking Confirmed!</h2><div style="color:#666">You have successfully booked <strong class="booking-artist-name">${artistName || ''}</strong></div></div>`;

      const details = document.createElement('div');
      details.style.marginTop = '12px';
      details.className = 'booking-success-details';
      details.innerHTML = `
        <p id="booking-success-summary">Booking ID: <span class="booking-id">${bookingId}</span></p>
        <p class="booking-meta">Artist: <span class="booking-artist-name">${artistName || ''}</span></p>
        <div class="booking-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        </div>
      `;

      const actions = document.createElement('div');
      actions.style.marginTop = '10px';

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-booking-btn';
      downloadBtn.textContent = 'Download booking confirmation (PDF)';
      downloadBtn.style.padding = '10px 14px';
      downloadBtn.style.background = '#1976d2';
      downloadBtn.style.color = '#fff';
      downloadBtn.style.border = 'none';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.padding = '10px 12px';
      closeBtn.style.marginLeft = '8px';

      const viewLink = document.createElement('a');
      viewLink.href = `/booking-details.html?booking=${encodeURIComponent(bookingId)}`;
      viewLink.textContent = 'View Booking';
      viewLink.style.marginLeft = '8px';

      const spinner = document.createElement('span');
      spinner.className = 'download-spinner';
      spinner.style.display = 'none';
      spinner.style.marginLeft = '8px';
      spinner.textContent = 'Preparing...';

      const actionWrap = dialog.querySelector('.booking-actions') || details.querySelector('.booking-actions');
      actionWrap.appendChild(downloadBtn);
      actionWrap.appendChild(spinner);
      actionWrap.appendChild(closeBtn);
      actionWrap.appendChild(viewLink);

      dialog.appendChild(header);
      dialog.appendChild(details);
      backdrop.appendChild(dialog);

      // focus management
      const focusable = [downloadBtn, closeBtn, viewLink];
      let lastFocused = document.activeElement;
      downloadBtn.focus();

      function trap(e) {
        const focusables = backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        if (e.key === 'Escape') {
          close();
        }
      }

      function close() {
        try { backdrop.remove(); } catch (e) {}
        if (bookingForm) {
          bookingForm.style.display = '';
          bookingForm.removeAttribute('aria-hidden');
        }
        document.removeEventListener('keydown', trap);
        if (lastFocused) try { lastFocused.focus(); } catch (e) {}
      }

      closeBtn.addEventListener('click', close);
      backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) close(); });
      document.addEventListener('keydown', trap);

      downloadBtn.addEventListener('click', async (e) => {
        const url = e.currentTarget.dataset.url || `/api/escrow/bookings/${encodeURIComponent(bookingId)}/files/booking_org`;
        downloadBtn.disabled = true;
        spinner.style.display = '';
        try {
          const resp = await fetch(url, { method: 'GET', credentials: 'include' });
          if (!resp.ok) throw new Error('Failed to fetch file');
          const blob = await resp.blob();
          const filename = `booking-${bookingId}.pdf`;
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
        } catch (err) {
          console.error('Download failed', err);
          alert('Could not download booking confirmation. Please try again later.');
        } finally {
          downloadBtn.disabled = false;
          spinner.style.display = 'none';
        }
      });
    }
  }
});
