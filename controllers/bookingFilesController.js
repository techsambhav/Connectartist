// controllers/bookingFilesController.js
const Booking = require('../models/Booking');
const pdfGen = (() => {
  try { return require('../pdfGenerator'); } catch (e) {
    try { return require('../services/pdfGenerator'); } catch (e2) { return null; }
  }
})();
const http = require('http');
const https = require('https');
const url = require('url');

const WHICH_MAP = {
  booking_org: { template: 'booking_org', field: 'bookingOrgUrl', filenameSuffix: 'booking-confirmation' },
  booking_artist: { template: 'booking_artist', field: 'bookingArtistUrl', filenameSuffix: 'artist-contact' },
  receipt: { template: 'receipt', field: 'receiptUrl', filenameSuffix: 'receipt' }
};

function fetchExternalBuffer(externalUrl, timeout = 15000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = url.parse(externalUrl);
      const getter = parsed.protocol === 'https:' ? https.get : http.get;
      const req = getter(externalUrl, { timeout }, (proxiedRes) => {
        const status = proxiedRes.statusCode || 0;
        if (status >= 300 && status < 400 && proxiedRes.headers.location) {
          proxiedRes.resume();
          return fetchExternalBuffer(proxiedRes.headers.location, timeout).then(resolve).catch(reject);
        }
        if (status !== 200) {
          let body = '';
          proxiedRes.on('data', (chunk) => { body += chunk.toString(); });
          proxiedRes.on('end', () => {
            return reject(new Error(`External fetch failed status=${status} bodySnippet=${body.substring(0,200)}`));
          });
          return;
        }
        const chunks = [];
        let total = 0;
        proxiedRes.on('data', (chunk) => { chunks.push(chunk); total += chunk.length; });
        proxiedRes.on('end', () => { resolve(Buffer.concat(chunks, total)); });
        proxiedRes.on('error', err => reject(err));
      });

      req.on('error', err => reject(err));
      req.setTimeout(timeout, () => {
        req.abort();
        reject(new Error('Timeout fetching external URL'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function generatePdfBuffer(templateName, data) {
  // Try using new clean templates first
  if (pdfGen && pdfGen.generateCleanBookingPDF && data._id) {
    try {
      console.log(`Using new clean PDF template for ${templateName}`);
      const type = templateName === 'booking_artist' ? 'artist' : 'organizer';
      return await pdfGen.generateCleanBookingPDF(data, type);
    } catch (err) {
      console.warn('Clean PDF generation failed, falling back to old generator:', err.message);
    }
  }

  // Fallback to old generator
  if (!pdfGen || !pdfGen.generatePdf) throw new Error('pdfGenerator.generatePdf not found');
  const buf = await pdfGen.generatePdf(templateName, data);
  return buf;
}

exports.serveBookingFile = async (req, res) => {
  try {
    const { id, which } = req.params;
    if (!id || !which || !WHICH_MAP[which]) return res.status(404).send('Not found');

    const conf = WHICH_MAP[which];
    const booking = await Booking.findById(id);
    if (!booking) {
      console.warn('serveBookingFile: booking not found', id);
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Build template data once (used by old generator fallback)
    const data = {
      _id: booking._id, // Pass full booking ID for new generator
      bookingId: String(booking._id),
      artistName: booking.artistName || '',
      organizerName: booking.organizerName || booking.userName || '',
      eventDate: booking.eventDate || '',
      startTime: booking.startTime || booking.eventTime || '',
      venue: booking.venue || booking.eventLocation || '',
      notes: booking.notes || '',
      price: booking.price || booking.amount || '',
      artistPhone: booking.artistPhone || booking.artistContact || '',
      artistEmail: booking.artistEmail || '',
      organizerPhone: booking.organizerPhone || booking.contact || '',
      organizerEmail: booking.organizerEmail || '',
      // Pass entire booking for new clean PDF generator
      ...booking.toObject()
    };

    // If an external URL exists, fetch it fully into memory and return the Buffer
    if (booking.files && booking.files[conf.field]) {
      const candidate = booking.files[conf.field];
      if (typeof candidate === 'string' && (candidate.startsWith('http://') || candidate.startsWith('https://'))) {
        try {
          console.log(`bookingFilesController: fetching external file buffer for booking ${id} which=${which} url=${candidate}`);
          const buf = await fetchExternalBuffer(candidate);
          // Basic validation: PDF should start with %PDF- (first 4 bytes)
          if (!buf || buf.length < 4 || buf.slice(0,4).toString() !== '%PDF') {
            console.warn('bookingFilesController: external buffer does not start with %PDF, falling back to generation');
            // fallthrough to generation
          } else {
            const filename = `${conf.filenameSuffix}-${booking._id}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buf.length);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            // allow cross-origin XHR if needed
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(buf);
          }
        } catch (err) {
          console.warn('bookingFilesController: external fetch failed, will generate on demand:', err && err.message);
          // continue to fallback generation
        }
      }
    }

    // Fallback: generate PDF on-demand using pdfGenerator
    console.log(`bookingFilesController: generating PDF on demand for booking ${id} which=${which}`);
    const buffer = await generatePdfBuffer(conf.template, data);

    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
      console.error('bookingFilesController: generated buffer invalid', { len: buffer ? buffer.length : 0 });
      return res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
    // optional sanity: ensure starts with %PDF
    if (buffer.slice(0,4).toString() !== '%PDF') {
      console.warn('bookingFilesController: generated buffer does not start with %PDF (unexpected)');
    }

    const filename = `${conf.filenameSuffix}-${booking._id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(buffer);

  } catch (err) {
    console.error('bookingFilesController error', err && (err.stack || err.message || err));
    if (res.headersSent) {
      try { res.end(); } catch (e) {}
      return;
    }
    return res.status(500).json({ success: false, message: 'Server error generating file' });
  }
};
