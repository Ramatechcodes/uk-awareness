const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: Number,
  address: { type: String, default: "Address not available" },
  source: { type: String, default: "browser-gps" },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("Location", locationSchema);
