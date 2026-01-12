// Test script for new PDF system integration
const pdfGenerator = require('./services/pdfGenerator');

// Mock booking object matching Mongoose schema
const mockBooking = {
  _id: '507f1f77bcf86cd799439011',
  eventName: 'Summer Music Festival 2024',
  eventDate: new Date('2024-08-15'),
  startTime: '19:00',
  venue: 'Grand Arena',
  eventLocation: 'Grand Arena, Downtown',
  eventCity: 'Mumbai',
  expectedGuests: '500',

  artistName: 'DJ Shadow',
  artistPhoto: null,
  genre: 'Electronic/House',
  performanceDuration: '2 hours',

  organizerName: 'Event Productions Ltd',
  userName: 'John Doe',
  organizerEmail: 'john@eventprod.com',
  userEmail: 'john@eventprod.com',
  organizerPhone: '+91 98765 43210',
  userPhone: '+91 98765 43210',
  organizerCompany: 'Event Productions Ltd',

  venueManagerName: 'Sarah Smith',
  venueManagerPhone: '+91 98765 43211',

  loadInTime: '16:00',
  soundcheckTime: '17:30',

  technicalRequirements: ['PA System 10kW', 'DJ Controller', 'Stage Lighting', 'Fog Machine', '2x Monitor Speakers'],

  price: 150000,
  advanceAmount: 50000,
  paymentMethod: 'Razorpay',
  paymentStatus: 'Advance Paid',

  pickupLocation: 'Airport Terminal 2',
  pickupTime: '14:00',
  accommodationDetails: 'Hotel Taj - Deluxe Room',

  cancellationPolicy: '48 hours notice required for cancellation. Advance non-refundable.',
  refundPolicy: 'Advance amount is non-refundable. Balance refundable if cancelled 48 hours prior.',

  attachments: [
    { name: 'Stage_Layout.pdf', url: '#' },
    { name: 'Contract.pdf', url: '#' }
  ]
};

async function testPDFGeneration() {
  console.log('🧪 Testing New Clean PDF Generation System\n');
  console.log('=' .repeat(60));

  try {
    // Test organizer PDF
    console.log('\n📄 Generating Organizer PDF (booking-confirmation.html)...');
    const startOrg = Date.now();
    const orgBuffer = await pdfGenerator.generateCleanBookingPDF(mockBooking, 'organizer');
    const timeOrg = Date.now() - startOrg;
    console.log(`✅ Organizer PDF generated successfully!`);
    console.log(`   Size: ${(orgBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Time: ${timeOrg}ms`);

    // Save to output
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const orgPath = path.join(outputDir, 'test_clean_organizer.pdf');
    fs.writeFileSync(orgPath, orgBuffer);
    console.log(`   Saved to: ${orgPath}\n`);

    // Test artist PDF
    console.log('📄 Generating Artist PDF (artist-contact.html)...');
    const startArt = Date.now();
    const artBuffer = await pdfGenerator.generateCleanBookingPDF(mockBooking, 'artist');
    const timeArt = Date.now() - startArt;
    console.log(`✅ Artist PDF generated successfully!`);
    console.log(`   Size: ${(artBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Time: ${timeArt}ms`);

    const artPath = path.join(outputDir, 'test_clean_artist.pdf');
    fs.writeFileSync(artPath, artBuffer);
    console.log(`   Saved to: ${artPath}\n`);

    console.log('=' .repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total size: ${((orgBuffer.length + artBuffer.length) / 1024).toFixed(2)} KB`);
    console.log(`   Total time: ${timeOrg + timeArt}ms`);
    console.log(`   Average: ${((timeOrg + timeArt) / 2).toFixed(0)}ms per PDF`);

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run test
testPDFGeneration()
  .then(() => {
    console.log('\n✨ Test completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Test failed with error:', err);
    process.exit(1);
  });
