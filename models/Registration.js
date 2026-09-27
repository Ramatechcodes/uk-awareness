
const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true
    },

    // -----------------------------
    // PERSONAL INFORMATION
    // -----------------------------

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    dateOfBirth: {
      type: String,
      default: ""
    },

    email: {
      type: String,
      default: "",
      trim: true
    },

    phone: {
      type: String,
      default: "",
      trim: true
    },

    address: {
      type: String,
      default: "",
      trim: true
    },

    // -----------------------------
    // EDUCATION
    // -----------------------------

    primarySchool: {
      type: String,
      default: ""
    },

    primaryGraduationYear: {
      type: String,
      default: ""
    },

    secondarySchool: {
      type: String,
      default: ""
    },

    secondaryGraduationYear: {
      type: String,
      default: ""
    },

    tertiarySchool: {
      type: String,
      default: ""
    },

    tertiaryGraduationYear: {
      type: String,
      default: ""
    },

    degree: {
      type: String,
      default: ""
    },

    course: {
      type: String,
      default: ""
    },

    // -----------------------------
    // SKILLS / PROFESSION
    // -----------------------------

    handwork: {
      type: String,
      default: ""
    },

    profession: {
      type: String,
      default: ""
    },

    employer: {
      type: String,
      default: ""
    },

    // -----------------------------
    // UK TRAVEL HISTORY
    // -----------------------------

    ukTravelledBefore: {
      type: String,
      default: ""
    },

    ukTravelYear: {
      type: String,
      default: ""
    },

    ukTravelPurpose: {
      type: String,
      default: ""
    },

    // -----------------------------
    // PARENT / GUARDIAN
    // -----------------------------

    parentName: {
      type: String,
      default: ""
    },

    parentPhone: {
      type: String,
      default: ""
    },

    parentAddress: {
      type: String,
      default: ""
    },

    // -----------------------------
    // UK TRAVEL PLANS
    // -----------------------------

    ukPurpose: {
      type: String,
      default: ""
    },

    ukTravelDate: {
      type: String,
      default: ""
    },

    ukPurposeDetails: {
      type: String,
      default: ""
    },

    // -----------------------------
    // LOCATION
    // -----------------------------

    location: {
      type: Object,
      default: null
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

module.exports = mongoose.model(
  "Registration",
  RegistrationSchema
);

