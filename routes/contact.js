const express = require("express");
const router = express.Router();
const mongoose = require('mongoose');
const Contact = require("../models/Contact");
const Profile = require("../models/Profile");
const auth = require('../middleware/auth');

// Helper to resolve a profile identifier which may be either an ObjectId (_id) or a userId string
async function resolveProfile(identifier) {
  if (!identifier) return null;
  // If it looks like an ObjectId, try to find by _id first
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const p = await Profile.findById(identifier);
    if (p) return p;
  }
  // Fallback: try to find by userId (string)
  return await Profile.findOne({ userId: identifier });
}

// Get all contacts for a profile - owner-only
router.get("/", auth, async (req, res) => {
  try {
    const profileIdentifier = req.query.profileId;
    if (!profileIdentifier) return res.status(400).json({ message: 'profileId query param required' });

    const profile = await resolveProfile(profileIdentifier);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    // Enforce that the authenticated user owns this profile
    if (String(profile.userId) !== String(req.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const contacts = await Contact.find({ profileId: profile._id });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single contact - owner-only
router.get("/:id", auth, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const profile = await Profile.findById(contact.profileId);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    if (String(profile.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save contact (create) - owner-only
router.post("/", auth, async (req, res) => {
  try {
    // Require profileId in body (could be Profile._id or Profile.userId)
    const profileIdentifier = req.body.profileId;
    if (!profileIdentifier) return res.status(400).json({ message: 'profileId is required' });

    const profile = await resolveProfile(profileIdentifier);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    if (String(profile.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    // Ensure we store the profile._id as reference
    const payload = Object.assign({}, req.body, { profileId: profile._id });
    const contact = new Contact(payload);
    await contact.save();
    res.json(contact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update contact - owner-only
router.put("/:id", auth, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const profile = await Profile.findById(contact.profileId);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    if (String(profile.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    // If profileId in body is provided, resolve and ensure it still belongs to the user
    if (req.body.profileId) {
      const resolved = await resolveProfile(req.body.profileId);
      if (!resolved) return res.status(404).json({ message: 'Profile not found' });
      if (String(resolved.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden to reassign profile' });
      req.body.profileId = resolved._id;
    }

    Object.assign(contact, req.body);
    await contact.save();
    res.json(contact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete contact - owner-only
router.delete("/:id", auth, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const profile = await Profile.findById(contact.profileId);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    if (String(profile.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
