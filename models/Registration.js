const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 40 },
  address: { type: String, trim: true, maxlength: 500 },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    formattedAddress: String,
    source: { type: String, default: "browser-gps" }
  },
  locationConsent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("Registration", registrationSchema);
