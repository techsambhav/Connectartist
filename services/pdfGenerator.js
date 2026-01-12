const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');
const Mustache = require('mustache');
const crypto = require('crypto');
const { parseBookingNotes, getDefaultValue } = require('../utils/notesParser');

// Set Puppeteer cache directory for Render
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
}

function getByPath(obj, pathStr) {
  if (!obj || !pathStr) return '';
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === undefined || cur === null) return '';
    cur = cur[p];
  }
  // convert objects/arrays to JSON string, else return primitive
  if (typeof cur === 'object') return JSON.stringify(cur);
  return String(cur);
}

/**
 * Generate a 6-digit security code from booking ID
 */
function generateSecurityCode(bookingId) {
  const hash = crypto.createHash('sha256').update(bookingId.toString()).digest('hex');
  return hash.substring(0, 6).toUpperCase();
}

/**
 * Format booking ID in readable format: CA-BKG-XXXX-XXXX
 */
function formatBookingId(bookingId) {
  const id = bookingId.toString();
  const last8 = id.slice(-8);
  return `CA-BKG-${last8.slice(0, 4)}-${last8.slice(4)}`.toUpperCase();
}

/**
 * Format date as "Friday, 25 Dec 2025"
 */
function formatEventDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Format price with currency symbol and commas
 */
function formatPrice(amount) {
  try {
    const num = parseFloat(amount);
    return `₹${num.toLocaleString('en-IN')}`;
  } catch (e) {
    return `₹${amount}`;
  }
}

/**
 * Get initials from name
 */
function getInitials(name) {
  if (!name) return 'N';
  return name.charAt(0).toUpperCase();
}

/**
 * Fetch artist photo from Profile model
 */
async function getArtistPhoto(artistId) {
  try {
    const Profile = require('../models/Profile');
    const profile = await Profile.findOne({ userId: artistId });
    return profile?.photo || null;
  } catch (error) {
    console.error('Error fetching artist photo:', error);
    return null;
  }
}

/**
 * Generate QR code as data URL
 */
async function generateQRCode(url) {
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 1
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

/**
 * Format technical rider as HTML checklist
 */
function formatTechnicalChecklist(riderArray) {
  if (!Array.isArray(riderArray) || riderArray.length === 0) {
    return '<li class="tech-item"><span class="checkmark">✓</span> <span>No specific requirements</span></li>';
  }

  return riderArray.map(item =>
    `<li class="tech-item"><span class="checkmark">✓</span> <span>${item.trim()}</span></li>`
  ).join('\n');
}

/**
 * Build enriched data object for premium templates
 */
async function buildPremiumTemplateData(booking) {
  // Parse notes field to extract structured data
  const parsedNotes = parseBookingNotes(booking.notes || '');

  // Fetch artist photo
  const artistPhoto = await getArtistPhoto(booking.artistId);

  // Generate QR code for booking verification
  const baseUrl = process.env.BASE_URL || 'https://connectartist.com';
  const qrCodeUrl = await generateQRCode(`${baseUrl}/booking/${booking._id}`);

  // Generate security code
  const securityCode = generateSecurityCode(booking._id);

  // Calculate deposit and pending amounts
  const totalAmount = parseFloat(booking.price) || 0;
  const depositAmount = totalAmount * 0.3; // 30% deposit
  const pendingAmount = totalAmount - depositAmount;

  // Format technical checklist
  const technicalChecklist = formatTechnicalChecklist(parsedNotes.technicalRider);

  // Build complete data object
  return {
    // Booking basics
    bookingId: formatBookingId(booking._id),
    rawBookingId: booking._id.toString(),

    // Artist details
    artistName: booking.artistName || 'Artist Name',
    artistEmail: booking.artistEmail || '',
    artistPhone: booking.artistPhone || '',
    artistPhoto: artistPhoto,
    artistInitial: getInitials(booking.artistName),
    artistGenre: booking.artistGenre || parsedNotes.eventType || 'Musician',

    // Organizer details
    organizerName: booking.organizerName || 'Organizer Name',
    organizerEmail: booking.organizerEmail || '',
    organizerPhone: booking.organizerPhone || '',
    organizerInitial: getInitials(booking.organizerName),

    // Event details
    eventDate: formatEventDate(booking.eventDate),
    rawEventDate: booking.eventDate,
    startTime: booking.startTime || parsedNotes.loadInTime || 'TBD',
    endTime: parsedNotes.endTime || 'TBD',
    venue: booking.venue || 'Venue TBD',
    eventType: parsedNotes.eventType || 'Event',
    audienceSize: parsedNotes.audienceSize || 'N/A',

    // Performance details
    loadInTime: parsedNotes.loadInTime || getDefaultValue('loadInTime', booking),
    soundcheckTime: parsedNotes.soundcheckTime || getDefaultValue('soundcheckTime', booking),
    numberOfSets: parsedNotes.numberOfSets || '1',
    setDuration: parsedNotes.setDuration || '60 minutes',

    // Technical requirements
    technicalRider: parsedNotes.technicalRider || [],
    technicalChecklist: technicalChecklist,
    stageSize: parsedNotes.stageSize || 'Standard',
    technicalNotes: parsedNotes.technicalNotes || '',

    // Travel & accommodation
    travelResponsibility: parsedNotes.travelResponsibility || 'To be discussed',
    accommodationProvided: parsedNotes.accommodationProvided || false,
    hotelName: parsedNotes.hotelName || '',
    travelAllowance: parsedNotes.travelAllowance || '0',

    // Contact & backup
    backupContact: parsedNotes.backupContact || '',
    venueManager: parsedNotes.venueManager || parsedNotes.backupContact || 'N/A',

    // Payment details
    price: formatPrice(booking.price),
    rawPrice: booking.price,
    depositAmount: formatPrice(depositAmount),
    pendingAmount: formatPrice(pendingAmount),
    paymentStatus: booking.paymentStatus || 'pending',
    paymentStatusBadge: booking.paymentStatus === 'captured' ? 'Confirmed' : 'Pending',
    paymentStatusColor: booking.paymentStatus === 'captured' ? '#00b894' : '#fdcb6e',

    // Additional info
    additionalNotes: parsedNotes.additionalNotes || '',
    specialRequests: booking.specialRequests || '',

    // Terms & conditions
    termsAccepted: parsedNotes.termsAccepted || false,
    termsVersion: parsedNotes.termsVersion || 'v1.0',
    termsTimestamp: parsedNotes.termsTimestamp || new Date().toISOString(),

    // Security & verification
    qrCodeUrl: qrCodeUrl,
    securityCode: securityCode,

    // Timestamps
    generatedDate: new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    currentYear: new Date().getFullYear(),

    // Support contact
    supportEmail: 'support@connectartist.com',
    supportPhone: '+91 1800-123-4567'
  };
}

async function renderHtmlTemplate(templateName, data) {
  // Keep templates in /templates folder, e.g. templates/booking_org_premium.html
  const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
  let template = await fs.readFile(templatePath, 'utf8');

  // Use Mustache for advanced template rendering with loops and conditionals
  const html = Mustache.render(template, data);

  return html;
}

async function htmlToPdfBuffer(html) {
  const launchOptions = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-zygote'
    ],
    headless: true
  };

  // Try to resolve an executable path explicitly for reliability
  // Priority: PUPPETEER_EXECUTABLE_PATH env > puppeteer.executablePath() > undefined
  try {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (typeof puppeteer.executablePath === 'function') {
      const p = puppeteer.executablePath();
      if (p && typeof p === 'string') launchOptions.executablePath = p;
    }
  } catch (e) {
    // ignore and let Puppeteer try defaults
  }

  console.log('Launching browser with options:', launchOptions);
  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (firstErr) {
    console.warn('Primary launch failed, attempting Windows fallbacks…', firstErr && firstErr.message);
    // Try common Windows paths for Chrome/Edge
    const winEnv = process.env;
    const candidates = [
      path.join(winEnv['ProgramFiles'] || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
      path.join(winEnv['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
      path.join(winEnv['LOCALAPPDATA'] || 'C:/Users/Default/AppData/Local', 'Google/Chrome/Application/chrome.exe'),
      path.join(winEnv['ProgramFiles'] || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
      path.join(winEnv['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    ];
    let lastErr = firstErr;
    for (const exe of candidates) {
      try {
        console.log('Trying executablePath fallback:', exe);
        browser = await puppeteer.launch({ ...launchOptions, executablePath: exe });
        if (browser) break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!browser) {
      // As a last resort, programmatically download a Chromium build
      try {
        console.log('Attempting programmatic Chromium install via @puppeteer/browsers...');
        const { install, computeExecutablePath, detectBrowserPlatform, Browser } = require('@puppeteer/browsers');
        const cacheDir = path.join(process.cwd(), '.cache', 'puppeteer');
        const platform = detectBrowserPlatform();
        // Stable is fine; alternatively can use a specific buildId compatible with current Puppeteer
        const buildId = 'stable';
        await install({ browser: Browser.CHROME, cacheDir, buildId, platform });
        const execPath = computeExecutablePath({ browser: Browser.CHROME, cacheDir, buildId, platform });
        console.log('Chromium installed at:', execPath);
        browser = await puppeteer.launch({ ...launchOptions, executablePath: execPath });
      } catch (installErr) {
        console.error('Programmatic Chromium install failed:', installErr && installErr.message);
        throw lastErr || firstErr;
      }
    }
  }
  const page = await browser.newPage();
  // Ensure styles are applied and fonts loaded
  await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 45000 });
  await page.emulateMediaType('screen');
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  await page.close();
  await browser.close();
  return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
}

/**
 * Generate premium booking PDF with enhanced data and templates
 * @param {Object} booking - Booking object from database
 * @param {String} type - 'org' for organizer or 'artist' for artist
 * @returns {Buffer} PDF buffer
 */
exports.generateBookingPDF = async (booking, type) => {
  try {
    console.log(`Generating premium PDF for booking ${booking._id}, type: ${type}`);

    // Build enriched data object
    const data = await buildPremiumTemplateData(booking);

    // Select premium template
    const templateName = type === 'artist' ? 'booking_artist_premium' : 'booking_org_premium';

    // Render HTML with Mustache
    const html = await renderHtmlTemplate(templateName, data);

    // Generate PDF
    const buffer = await htmlToPdfBuffer(html);

    console.log(`Premium PDF generated successfully for ${templateName}, size: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error(`Premium PDF generation failed for booking ${booking._id}:`, error);

    // Fallback: create a simple text-based PDF using PDFKit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        console.log(`Fallback PDF created, size: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });

      doc.on('error', reject);

      // Create a simple fallback PDF
      doc.fontSize(18).text('Booking Confirmation', 50, 50);
      doc.moveDown(0.5);
      doc.fontSize(12);

      const safe = (v) => (v == null || v === '' ? 'N/A' : String(v));
      doc.text(`Booking ID: ${safe(booking._id)}`);
      doc.text(`Artist: ${safe(booking.artistName)}`);
      doc.text(`Organizer: ${safe(booking.organizerName)}`);
      doc.text(`Date: ${safe(booking.eventDate)}  Time: ${safe(booking.startTime)}`);
      doc.text(`Venue: ${safe(booking.venue)}`);
      doc.text(`Amount: ₹${safe(booking.price)}`);
      if (booking.notes) {
        doc.moveDown(0.5); doc.text(`Notes: ${safe(booking.notes)}`);
      }

      doc.moveDown(1);
      doc.fillColor('#666').text('This is a system-generated document.', { align: 'left' }).fillColor('#000');
      doc.end();
    });
  }
};

/**
 * Legacy function for backward compatibility
 * Use generateBookingPDF instead for premium templates
 */
exports.generatePdf = async (templateName, data) => {
  try {
    console.log(`Generating PDF for template: ${templateName} (legacy mode)`);
    const html = await renderHtmlTemplate(templateName, data || {});
    const buffer = await htmlToPdfBuffer(html);
    console.log(`PDF generated successfully for ${templateName}, size: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error(`PDF generation failed for ${templateName}:`, error);

    // Fallback: create a simple text-based PDF using PDFKit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        console.log(`Fallback PDF created for ${templateName}, size: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });

      doc.on('error', reject);

      // Create a simple fallback PDF (uses top-level keys like templates)
      doc.fontSize(18).text('Booking Document', 50, 50);
      doc.moveDown(0.5);
      doc.fontSize(12);

      const safe = (v) => (v == null || v === '' ? 'N/A' : String(v));
      doc.text(`Booking ID: ${safe(data && data.bookingId)}`);
      doc.text(`Artist: ${safe(data && data.artistName)}`);
      doc.text(`Organizer: ${safe(data && data.organizerName)}`);
      doc.text(`Date: ${safe(data && data.eventDate)}  Time: ${safe(data && data.startTime)}`);
      doc.text(`Venue: ${safe(data && data.venue)}`);
      doc.text(`Amount: ₹${safe(data && data.price)}`);
      if (data && data.notes) {
        doc.moveDown(0.5); doc.text(`Notes: ${safe(data.notes)}`);
      }

      doc.moveDown(1);
      doc.fillColor('#666').text('This is a system-generated document.', { align: 'left' }).fillColor('#000');
      doc.end();
    });
  }
};

/**
 * Generate PDF using new clean templates (booking-confirmation.html or artist-contact.html)
 * @param {Object} booking - Mongoose booking document
 * @param {String} type - 'organizer' or 'artist'
 * @returns {Promise<Buffer>} PDF buffer
 */
exports.generateCleanBookingPDF = async (booking, type = 'organizer') => {
  try {
    console.log(`Generating clean PDF for booking ${booking._id}, type: ${type}`);

    // Build payload for new templates
    const payload = buildCleanTemplatePayload(booking);

    // Generate QR code
    const qrUrl = `https://yourdomain.com/verify/${booking._id}`;
    payload.qrDataUri = await QRCode.toDataURL(qrUrl, { width: 300, margin: 1 });

    // Select template
    const templateName = type === 'artist' ? 'artist-contact' : 'booking-confirmation';
    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);

    // Read and render template
    const templateHtml = await fs.readFile(templatePath, 'utf-8');
    const html = Mustache.render(templateHtml, payload);

    // Generate PDF with Puppeteer
    const buffer = await htmlToPdfBuffer(html);

    console.log(`Clean PDF generated successfully for ${templateName}, size: ${buffer.length} bytes`);
    return buffer;

  } catch (error) {
    console.error(`Clean PDF generation failed for booking ${booking._id}:`, error);
    throw error;
  }
};

/**
 * Build payload for clean templates from booking object
 */
function buildCleanTemplatePayload(booking) {
  const payload = {
    bookingId: String(booking._id),
    generatedAt: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),

    // Logo (use placeholder or actual logo URL)
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjMWE3M2U4Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q0E8L3RleHQ+PC9zdmc+',

    // Event details
    event: {
      name: booking.eventName || 'Event',
      date: formatEventDate(booking.eventDate),
      time: booking.startTime || booking.eventTime || 'TBD',
      venue: booking.venue || booking.eventLocation || 'TBD',
      city: booking.eventCity || 'TBD',
      expectedGuests: booking.expectedGuests || 'TBD'
    },

    // Artist details
    artist: {
      name: booking.artistName || 'Artist',
      photo: booking.artistPhoto || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODQiIGhlaWdodD0iODQiIHZpZXdCb3g9IjAgMCA4NCA4NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI0MiIgY3k9IjQyIiByPSI0MiIgZmlsbD0iI2UwZTBlMCIvPjxwYXRoIGQ9Ik00MiAyNEM0Ni40MTgzIDI0IDUwIDI3LjU4MTcgNTAgMzJDNTAgMzYuNDE4MyA0Ni40MTgzIDQwIDQyIDQwQzM3LjU4MTcgNDAgMzQgMzYuNDE4MyAzNCAzMkMzNCAyNy41ODE3IDM3LjU4MTcgMjQgNDIgMjRaTTQyIDQ0QzUxLjM4ODggNDQgNTkgNDcuMzgxMiA1OSA1MS41VjU3SDI1VjUxLjVDMjUgNDcuMzgxMiAzMi42MTEyIDQ0IDQyIDQ0WiIgZmlsbD0iIzk5OTk5OSIvPjwvc3ZnPg==',
      genre: booking.genre || 'N/A',
      duration: booking.performanceDuration || 'TBD'
    },

    // Organizer details
    organizer: {
      name: booking.organizerName || booking.userName || 'Organizer',
      email: booking.organizerEmail || booking.userEmail || 'N/A',
      phone: booking.organizerPhone || booking.userPhone || 'N/A',
      company: booking.organizerCompany || 'N/A'
    },

    // Venue manager (if different from organizer)
    venueManager: {
      name: booking.venueManagerName || booking.organizerName || 'N/A',
      phone: booking.venueManagerPhone || booking.organizerPhone || 'N/A'
    },

    // Performance details
    performance: {
      loadIn: booking.loadInTime || 'TBD',
      soundcheck: booking.soundcheckTime || 'TBD',
      showtime: booking.startTime || booking.eventTime || 'TBD',
      duration: booking.performanceDuration || 'TBD'
    },

    // Technical rider
    technicalRider: booking.technicalRequirements
      ? (Array.isArray(booking.technicalRequirements)
          ? booking.technicalRequirements
          : booking.technicalRequirements.split(',').map(s => s.trim()))
      : ['PA System', 'Microphones', 'Stage Lighting'],

    // Attachments
    attachments: booking.attachments || [],

    // Payment details
    payment: {
      total: (booking.price || 0).toLocaleString('en-IN'),
      advance: (booking.advanceAmount || booking.price * 0.25 || 0).toLocaleString('en-IN'),
      balance: ((booking.price || 0) - (booking.advanceAmount || booking.price * 0.25 || 0)).toLocaleString('en-IN'),
      currency: 'INR',
      method: booking.paymentMethod || 'Razorpay',
      status: booking.paymentStatus || 'Pending'
    },

    // Travel & accommodation (for artist PDF)
    travel: {
      pickupLocation: booking.pickupLocation || 'TBD',
      pickupTime: booking.pickupTime || 'TBD',
      accommodation: booking.accommodationDetails || 'TBD'
    },

    // Terms
    terms: {
      cancellation: booking.cancellationPolicy || '48 hours notice required for cancellation.',
      refund: booking.refundPolicy || 'Advance amount non-refundable.',
      modifications: 'Minor changes allowed with mutual consent.'
    }
  };

  return payload;
}

