#!/usr/bin/env node
/*
  scripts/migrate-bookings-add-organizerId.js

  Safe migration utility to populate missing organizerId/userId on Booking documents.
  By default runs in dry-run mode. Use --commit to apply changes.

  Usage (Windows cmd):
    set MONGODB_URI=mongodb://...\n    node scripts\migrate-bookings-add-organizerId.js --commit

  Or create a .env file with MONGODB_URI and run:
    node scripts\migrate-bookings-add-organizerId.js --commit

*/

const mongoose = require('mongoose');
require('dotenv').config();
const Booking = require('../models/Booking');

const argv = process.argv.slice(2);
const doCommit = argv.includes('--commit') || argv.includes('-c');

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || null;
  if (!mongoUri) {
    console.error('MONGODB_URI not set. Set it in the environment or in a .env file.');
    process.exit(2);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected. Scanning bookings for missing organizerId/userId...');

  // Find bookings where either organizerId or userId is missing or null
  const missing = await Booking.find({ $or: [ { organizerId: { $exists: false } }, { userId: { $exists: false } }, { organizerId: null }, { userId: null } ] }).lean();
  console.log('Bookings found that may need fixes:', missing.length);

  if (!missing.length) {
    console.log('No bookings to migrate. Exiting.');
    process.exit(0);
  }

  if (!doCommit) {
    console.log('Dry-run mode. No changes will be applied. To apply changes, re-run with --commit');
  }

  let fixed = 0;
  for (const b of missing) {
    const updates = {};
    try {
      // If organizerId missing but userId present -> set organizerId = userId
      if ((!('organizerId' in b) || b.organizerId === null || b.organizerId === undefined) && b.userId) {
        updates.organizerId = b.userId;
      }
      // If userId missing but organizerId present -> set userId = organizerId
      if ((!('userId' in b) || b.userId === null || b.userId === undefined) && b.organizerId) {
        updates.userId = b.organizerId;
      }

      if (Object.keys(updates).length === 0) {
        console.log('Skipping booking (no sane default):', b._id.toString());
        continue;
      }

      console.log((doCommit ? 'Applying' : 'Would apply') + ' update to booking', b._id.toString(), updates);
      if (doCommit) {
        await Booking.updateOne({ _id: b._id }, { $set: updates });
        fixed++;
      }
    } catch (e) {
      console.error('Error processing booking', b._id.toString(), e && e.message);
    }
  }

  console.log(doCommit ? `Migration complete. Bookings updated: ${fixed}` : `Dry-run complete. To apply changes re-run with --commit.`);
  await mongoose.disconnect();
  process.exit(doCommit ? 0 : 0);
}

main().catch(e => { console.error('Migration failed', e && e.stack || e); process.exit(2); });
