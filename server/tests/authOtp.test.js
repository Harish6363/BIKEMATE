const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OtpVerification = require('../models/OtpVerification');
const authController = require('../controllers/authController');

function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

test('Email OTP Backend Generation & Verification Suite', async (t) => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bikemate';
  await mongoose.connect(mongoUri);

  const testEmail = 'otptest.student@bitm.edu.in';

  await t.test('1. sendOtp generates OTP in backend ONLY and does NOT reveal devOtp to client', async () => {
    const req = {
      body: {
        email: testEmail,
        usn: '3BR23AI099',
        userType: 'student'
      }
    };
    const res = createMockRes();

    await authController.sendOtp(req, res);

    assert.equal(res.statusCode, 200);
    // Crucial check: devOtp MUST NOT be returned in JSON response
    assert.equal(res.data.devOtp, undefined, 'devOtp must not be exposed in client response');
    assert.doesNotMatch(res.data.message, /use code:/i, 'Message must not contain the OTP code');

    // Verify OTP exists in database
    const dbRecord = await OtpVerification.findOne({ email: testEmail });
    assert.ok(dbRecord, 'OTP record must be saved in database');
    assert.equal(typeof dbRecord.otp, 'string');
    assert.equal(dbRecord.otp.length, 6, 'OTP must be 6 digits');
  });

  await t.test('2. verifyOtp REJECTS incorrect OTP with explicit warning message', async () => {
    const req = {
      body: {
        email: testEmail,
        otp: '000000' // wrong OTP
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /incorrect otp/i);
  });

  await t.test('3. verifyOtp ACCEPTS correct OTP generated in database', async () => {
    const dbRecord = await OtpVerification.findOne({ email: testEmail });
    assert.ok(dbRecord);

    const req = {
      body: {
        email: testEmail,
        otp: dbRecord.otp
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.data.message, /verified successfully/i);

    // Verify OTP was consumed
    const consumed = await OtpVerification.findOne({ email: testEmail });
    assert.equal(consumed, null, 'OTP should be deleted once verified');
  });

  await t.test('4. verifyOtp succeeds with mixed-case email (e.g. 3BR23AI068@bitm.edu.in)', async () => {
    const uppercaseEmail = '3BR23AI068@bitm.edu.in';
    const sendReq = {
      body: {
        email: uppercaseEmail,
        usn: '3BR23AI068',
        userType: 'student'
      }
    };
    const sendRes = createMockRes();
    await authController.sendOtp(sendReq, sendRes);
    assert.equal(sendRes.statusCode, 200);

    // Retrieve generated OTP from DB
    const record = await OtpVerification.findOne({
      $or: [
        { email: uppercaseEmail.toLowerCase() },
        { email: uppercaseEmail }
      ]
    });
    assert.ok(record, 'Record must exist');

    // Test verifying with lowercase email
    const verifyReq1 = {
      body: {
        email: '3br23ai068@bitm.edu.in',
        otp: record.otp
      }
    };
    const verifyRes1 = createMockRes();
    await authController.verifyOtp(verifyReq1, verifyRes1);
    assert.equal(verifyRes1.statusCode, 200);
    assert.match(verifyRes1.data.message, /verified successfully/i);
  });

  await mongoose.disconnect();
});
