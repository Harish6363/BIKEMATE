const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  otp: { type: String, required: true, trim: true },
  expiresAt: { type: Date, required: true }
});

// Auto-delete document after expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OtpVerification = mongoose.model('OtpVerification', otpSchema);
module.exports = OtpVerification;
