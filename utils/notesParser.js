/**
 * utils/notesParser.js
 * Parses the free-text `notes` field on a booking document into a structured
 * object used by pdfGenerator.js when building premium PDF templates.
 *
 * The notes field may contain lines like:
 *   Event Type: Wedding
 *   Audience Size: 200
 *   Load-In Time: 17:00
 *   Soundcheck Time: 18:00
 *   Number of Sets: 2
 *   Set Duration: 45 minutes
 *   Stage Size: Medium
 *   Technical Rider: PA System, Microphones, Stage Lighting
 *   Technical Notes: Please ensure no feedback
 *   Travel Responsibility: Organizer
 *   Accommodation Provided: yes
 *   Hotel Name: Hotel Taj
 *   Travel Allowance: 2000
 *   Backup Contact: +91 9999999999
 *   Venue Manager: Rahul
 *   Additional Notes: Anything else
 *   Terms Accepted: yes
 *   Terms Version: v1.0
 *   Terms Timestamp: 2025-01-01T10:00:00Z
 *   End Time: 21:00
 */

/**
 * Extract a value from lines matching "Key: Value" (case-insensitive key).
 */
function extractField(lines, ...keys) {
  for (const key of keys) {
    const pattern = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'i');
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }
  }
  return null;
}

/**
 * Parse booking notes string into a structured object.
 * Unrecognised lines are collected into additionalNotes.
 *
 * @param {string} notes - Raw notes string from booking document
 * @returns {Object} Parsed fields with sensible defaults
 */
function parseBookingNotes(notes) {
  if (!notes || typeof notes !== 'string') {
    return getDefaultNotes();
  }

  const lines = notes.split(/\r?\n/);

  const eventType         = extractField(lines, 'Event Type', 'EventType');
  const audienceSize      = extractField(lines, 'Audience Size', 'AudienceSize');
  const loadInTime        = extractField(lines, 'Load-?In Time', 'LoadIn Time', 'Load In Time');
  const soundcheckTime    = extractField(lines, 'Soundcheck Time', 'Sound Check Time');
  const endTime           = extractField(lines, 'End Time', 'EndTime');
  const numberOfSets      = extractField(lines, 'Number of Sets', 'NumberOfSets', 'Sets');
  const setDuration       = extractField(lines, 'Set Duration', 'SetDuration');
  const stageSize         = extractField(lines, 'Stage Size', 'StageSize');
  const technicalNotes    = extractField(lines, 'Technical Notes', 'TechnicalNotes');
  const travelResponsibility = extractField(lines, 'Travel Responsibility', 'TravelResponsibility');
  const hotelName         = extractField(lines, 'Hotel Name', 'HotelName');
  const travelAllowance   = extractField(lines, 'Travel Allowance', 'TravelAllowance');
  const backupContact     = extractField(lines, 'Backup Contact', 'BackupContact');
  const venueManager      = extractField(lines, 'Venue Manager', 'VenueManager');
  const additionalNotes   = extractField(lines, 'Additional Notes', 'AdditionalNotes');
  const termsVersion      = extractField(lines, 'Terms Version', 'TermsVersion');
  const termsTimestamp    = extractField(lines, 'Terms Timestamp', 'TermsTimestamp');

  // Boolean fields
  const accommodationRaw  = extractField(lines, 'Accommodation Provided', 'AccommodationProvided');
  const accommodationProvided = accommodationRaw
    ? ['yes', 'true', '1'].includes(accommodationRaw.toLowerCase())
    : false;

  const termsAcceptedRaw  = extractField(lines, 'Terms Accepted', 'TermsAccepted');
  const termsAccepted = termsAcceptedRaw
    ? ['yes', 'true', '1'].includes(termsAcceptedRaw.toLowerCase())
    : false;

  // Technical rider — comma-separated list
  const riderRaw = extractField(lines, 'Technical Rider', 'TechnicalRider');
  const technicalRider = riderRaw
    ? riderRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return {
    eventType,
    audienceSize,
    loadInTime,
    soundcheckTime,
    endTime,
    numberOfSets,
    setDuration,
    stageSize,
    technicalRider,
    technicalNotes,
    travelResponsibility,
    accommodationProvided,
    hotelName,
    travelAllowance,
    backupContact,
    venueManager,
    additionalNotes,
    termsAccepted,
    termsVersion,
    termsTimestamp,
  };
}

/**
 * Return safe default values when notes is empty or unparseable.
 */
function getDefaultNotes() {
  return {
    eventType: null,
    audienceSize: null,
    loadInTime: null,
    soundcheckTime: null,
    endTime: null,
    numberOfSets: null,
    setDuration: null,
    stageSize: null,
    technicalRider: [],
    technicalNotes: null,
    travelResponsibility: null,
    accommodationProvided: false,
    hotelName: null,
    travelAllowance: null,
    backupContact: null,
    venueManager: null,
    additionalNotes: null,
    termsAccepted: false,
    termsVersion: null,
    termsTimestamp: null,
  };
}

/**
 * Get a fallback default value for a specific field from the booking object.
 * Used by pdfGenerator when a parsed notes field is missing.
 *
 * @param {string} field - Camelcase field name
 * @param {Object} booking - Booking document
 * @returns {string|null}
 */
function getDefaultValue(field, booking) {
  const map = {
    loadInTime: booking && (booking.loadInTime || booking.startTime || null),
    soundcheckTime: booking && (booking.soundcheckTime || null),
  };
  return map[field] !== undefined ? map[field] : null;
}

module.exports = { parseBookingNotes, getDefaultValue };
