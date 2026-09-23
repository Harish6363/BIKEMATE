const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true }, // Not hashed for MVP simplicity, should be hashed in prod
  expiresAt: { type: Date, required: true }
});

// Auto-delete document after expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OtpVerification = mongoose.model('OtpVerification', otpSchema);
module.exports = OtpVerification;
