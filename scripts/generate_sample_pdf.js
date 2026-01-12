// Quick script to validate PDF generation locally
// Usage: node scripts/generate_sample_pdf.js [template]
const fs = require('fs');
const path = require('path');
const pdfGen = require('../services/pdfGenerator');

async function main() {
  const template = process.argv[2] || 'booking_org';
  const data = {
    bookingId: 'TEST-12345',
    artistName: 'Shubh',
    organizerName: 'Shubham Agarwal',
    eventDate: '2025-10-12',
    startTime: '19:30',
    venue: 'Indira Gandhi Stadium, Delhi',
    notes: 'Green room and 2 wireless mics required.',
    price: '150000',
    artistPhone: '+91-90000 00000',
    artistEmail: 'artist@example.com',
    organizerPhone: '+91-98888 88888',
    organizerEmail: 'org@example.com',
  };
  console.log('PUPPETEER_EXECUTABLE_PATH=', process.env.PUPPETEER_EXECUTABLE_PATH);
  const buf = await pdfGen.generatePdf(template, data);
  const out = path.join(__dirname, `sample_${template}.pdf`);
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, 'bytes=', buf.length);
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
