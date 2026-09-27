```js
const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true
    },

    // =========================
    // PERSONAL INFORMATION
    // =========================
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    dateOfBirth: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 40
    },

    address: {
      type: String,
      trim: true,
      maxlength: 500
    },

    // =========================
    // EDUCATION
    // =========================
    primarySchool: {
      type: String,
      trim: true,
      maxlength: 200
    },

    primaryGraduationYear: {
      type: String,
      trim: true
    },

    secondarySchool: {
      type: String,
      trim: true,
      maxlength: 200
    },

    secondaryGraduationYear: {
      type: String,
      trim: true
    },

    tertiarySchool: {
      type: String,
      trim: true,
      maxlength: 250
    },

    tertiaryGraduationYear: {
      type: String,
      trim: true
    },

    degree: {
      type: String,
      trim: true,
      maxlength: 150
    },

    course: {
      type: String,
      trim: true,
      maxlength: 200
    },

    // =========================
    // SKILLS / WORK
    // =========================
    handwork: {
      type: String,
      trim: true,
      maxlength: 200
    },

    profession: {
      type: String,
      trim: true,
      maxlength: 200
    },

    employer: {
      type: String,
      trim: true,
      maxlength: 250
    },

    // =========================
    // PREVIOUS UK TRAVEL
    // =========================
    ukTravelledBefore: {
      type: String,
      trim: true
    },

    ukTravelYear: {
      type: String,
      trim: true
    },

    ukTravelPurpose: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    // =========================
    // PARENT / GUARDIAN
    // =========================
    parentName: {
      type: String,
      trim: true,
      maxlength: 150
    },

    parentPhone: {
      type: String,
      trim: true,
      maxlength: 40
    },

    parentAddress: {
      type: String,
      trim: true,
      maxlength: 500
    },

    // =========================
    // UK TRAVEL PLAN
    // =========================
    ukPurpose: {
      type: String,
      trim: true
    },

    ukTravelDate: {
      type: String,
      trim: true
    },

    ukPurposeDetails: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    // =========================
    // LOCATION
    // =========================
    location: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      heading: Number,
      speed: Number,
      formattedAddress: String,
      source: {
        type: String,
        default: "browser-gps"
      }
    },

    locationConsent: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Registration", registrationSchema);
```
