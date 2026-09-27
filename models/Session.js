const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  paid: { type: Boolean, default: false },
  accessCode: { type: String, required: true, index: true },
  trackingToken: { type: String, unique: true, sparse: true, index: true },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Session", sessionSchema);
