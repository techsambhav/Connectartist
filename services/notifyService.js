const pdfGen = require('./pdfGenerator');
const gcsClient = require('./gcsClient');
const emailer = require('./emailer');
const gupshup = require('./gupshup');
const DISABLE_GUPSHUP = process.env.DISABLE_GUPSHUP === '1' || !process.env.GUPSHUP_API_KEY;

exports.generatePdfsAndNotify = async (booking) => {
  // Generate premium PDFs using the new templates with enhanced data
  console.log('notifyService: generating premium PDFs for booking', booking._id);

  // Use the new premium PDF generator
  const bookingOrgPdf = await pdfGen.generateBookingPDF(booking, 'org');
  const bookingArtistPdf = await pdfGen.generateBookingPDF(booking, 'artist');

  // Receipt PDF can use the organizer template for now (or create separate receipt template later)
  const receiptPdf = bookingOrgPdf; // Same as organizer confirmation

  console.log('notifyService: Premium PDFs generated successfully', {
    bookingOrg: bookingOrgPdf.length,
    receipt: receiptPdf.length,
    artist: bookingArtistPdf.length
  });

  // upload to GCS if enabled; otherwise we'll attach PDFs to emails directly
  let bookingFiles = { bookingOrgUrl: null, receiptUrl: null, bookingArtistUrl: null };
  if (gcsClient.isGcsEnabled && gcsClient.isGcsEnabled()) {
    const basePath = `bookings/${booking._id}`;
    const [bookingOrgResp, receiptResp, artistResp] = await Promise.all([
      gcsClient.uploadBuffer(bookingOrgPdf, `${basePath}/booking_org.pdf`),
      gcsClient.uploadBuffer(receiptPdf, `${basePath}/receipt.pdf`),
      gcsClient.uploadBuffer(bookingArtistPdf, `${basePath}/booking_artist.pdf`)
    ]);
    bookingFiles = {
      bookingOrgUrl: bookingOrgResp.url,
      receiptUrl: receiptResp.url,
      bookingArtistUrl: artistResp.url
    };
    booking.files = bookingFiles;
    await booking.save();
    console.log('notifyService: uploaded PDFs to GCS and updated booking.files', { bookingId: booking._id, files: bookingFiles });
  } else {
    // When GCS is not enabled, expose server endpoints that generate PDFs on demand.
    // Use an absolute URL so clients opened from file:// or different origins can open the link.
    const domain = (process.env.DOMAIN && process.env.DOMAIN.startsWith('http')) ? process.env.DOMAIN.replace(/\/$/, '') : null;
    const port = process.env.PORT || '5000';
    const baseLocal = `https://localhost:${port}`;
    const baseUrl = domain || (process.env.NODE_ENV === 'production' ? baseLocal : baseLocal);

    booking.files = booking.files || {};
    booking.files.bookingOrgUrl = `${baseUrl}/api/escrow/bookings/${booking._id}/files/booking_org`;
    booking.files.receiptUrl = `${baseUrl}/api/escrow/bookings/${booking._id}/files/receipt`;
    booking.files.bookingArtistUrl = `${baseUrl}/api/escrow/bookings/${booking._id}/files/booking_artist`;
    await booking.save();
  console.log('notifyService: set booking.files to server endpoints (GCS disabled)', { bookingId: booking._id, files: booking.files });
  }

  // send emails
  const orgAttachments = [
    { filename: 'receipt.pdf', content: receiptPdf },
    { filename: 'booking_confirmation.pdf', content: bookingOrgPdf }
  ];
  const artistAttachments = [{ filename: 'booking_artist.pdf', content: bookingArtistPdf }];

  if (booking.organizerEmail) {
    // If GCS is enabled, include links; otherwise attach the PDFs
    const body = gcsClient.isGcsEnabled && gcsClient.isGcsEnabled()
      ? `Your booking is confirmed. Booking ID: ${booking._id}. Receipt: ${bookingFiles.receiptUrl}`
      : `Your booking is confirmed. Booking ID: ${booking._id}. PDFs are attached to this email.`;
    await emailer.sendEmail(booking.organizerEmail, `Payment Receipt — Booking ${booking._id}`, body, gcsClient.isGcsEnabled && gcsClient.isGcsEnabled() ? [] : orgAttachments);
  }
  if (booking.artistEmail) {
    const body = gcsClient.isGcsEnabled && gcsClient.isGcsEnabled()
      ? `You have been booked. Booking ID: ${booking._id}. Details: ${bookingFiles.bookingArtistUrl}`
      : `You have been booked. Booking ID: ${booking._id}. PDF is attached to this email.`;
    await emailer.sendEmail(booking.artistEmail, `You were booked — Booking ${booking._id}`, body, gcsClient.isGcsEnabled && gcsClient.isGcsEnabled() ? [] : artistAttachments);
  }

  // send WhatsApp/SMS (attempt both if available)
  const orgMsg = `Hi ${booking.organizerName}, your booking for ${booking.artistName} on ${booking.eventDate} is confirmed. ${bookingFiles.receiptUrl ? 'Receipt: ' + bookingFiles.receiptUrl : 'Please check your email for attached PDFs.'}`;
  const artistMsg = `Hi ${booking.artistName}, you have been booked by ${booking.organizerName} on ${booking.eventDate}. ${bookingFiles.bookingArtistUrl ? 'Details: ' + bookingFiles.bookingArtistUrl : 'Please check your email for attached PDFs.'}`;

  // organizer notifications (WhatsApp/SMS) - skip in local/dev when DISABLE_GUPSHUP is set or creds missing
  if (!DISABLE_GUPSHUP) {
    try {
      if (booking.organizerPhone) await gupshup.sendWhatsApp(booking.organizerPhone, orgMsg);
    } catch (err) {
      console.warn('organizer whatsapp failed', err);
      try { if (booking.organizerPhone) await gupshup.sendSms(booking.organizerPhone, orgMsg); } catch(e){console.warn('organizer sms failed', e);}
    }
    try {
      if (booking.artistPhone) await gupshup.sendWhatsApp(booking.artistPhone, artistMsg);
    } catch (err) {
      console.warn('artist whatsapp failed', err);
      try { if (booking.artistPhone) await gupshup.sendSms(booking.artistPhone, artistMsg); } catch(e){console.warn('artist sms failed', e);}
    }
  } else {
    console.log('Gupshup disabled - skipping whatsapp/sms notifications');
  }

  // update notification status
  booking.notificationStatus = {
    organizer: { email: !!booking.organizerEmail, whatsapp: !!booking.organizerPhone, sms: !!booking.organizerPhone, timestamp: new Date() },
    artist: { email: !!booking.artistEmail, whatsapp: !!booking.artistPhone, sms: !!booking.artistPhone, timestamp: new Date() }
  };
  await booking.save();
};

exports.notifyEventCompleted = async (booking) => {
  // send completion notifications
  const msg = `Booking ${booking._id} has been marked completed. Payout status: ${booking.payoutStatus || 'requested'}.`;
  if (booking.organizerEmail) await emailer.sendEmail(booking.organizerEmail, 'Event Completed', msg);
  if (booking.artistEmail) await emailer.sendEmail(booking.artistEmail, 'Event Completed', msg);
  // whatsapp/sms for completion notifications - skip when DISABLE_GUPSHUP is set or creds missing
  if (!DISABLE_GUPSHUP) {
    try {
      if (booking.organizerPhone) await gupshup.sendWhatsApp(booking.organizerPhone, msg);
    } catch (err) {
      console.warn('organizer completion whatsapp failed', err);
      try { if (booking.organizerPhone) await gupshup.sendSms(booking.organizerPhone, msg); } catch(e){console.warn('organizer completion sms failed', e);}
    }
    try {
      if (booking.artistPhone) await gupshup.sendWhatsApp(booking.artistPhone, msg);
    } catch (err) {
      console.warn('artist completion whatsapp failed', err);
      try { if (booking.artistPhone) await gupshup.sendSms(booking.artistPhone, msg); } catch(e){console.warn('artist completion sms failed', e);}
    }
  } else {
    console.log('Gupshup disabled - skipping completion whatsapp/sms notifications');
  }
};
