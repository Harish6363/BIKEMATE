const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const ApprovedStudent = require('../models/ApprovedStudent');
const { seedApprovedStudents } = require('../utils/seedApprovedStudents');
const authController = require('../controllers/authController');

// Mock response helper
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

test('Approved Students and Mobile Database Matching Suite', async (t) => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bikemate';
  await mongoose.connect(mongoUri);

  await t.test('1. Database has all 35 approved students and 0 student accounts', async () => {
    await User.deleteMany({ role: { $ne: 'admin' } });
    await ApprovedStudent.updateMany({}, { $set: { isRegistered: false, registrationStatus: 'not_registered', registeredUserId: null } });
    await seedApprovedStudents();
    const studentCount = await ApprovedStudent.countDocuments();
    assert.equal(studentCount, 35, `Expected 35 students, found ${studentCount}`);

    const regularUserCount = await User.countDocuments({ role: { $ne: 'admin' } });
    assert.equal(regularUserCount, 0, `Expected 0 student accounts, found ${regularUserCount}`);
  });

  await t.test('2. Registration Step 1 REJECTS mobile numbers NOT in the database', async () => {
    const unapprovedPhone = '9999888877';
    const req = {
      body: { phone: unapprovedPhone, userType: 'student' }
    };
    const res = createMockRes();

    await authController.registerStep1(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /not recognized in the college database/i);
  });

  await t.test('3. Registration Step 1 ACCEPTS mobile numbers that match the database', async () => {
    // K Sriram: 9380733014
    const req = {
      body: { phone: '9380733014', userType: 'student' }
    };
    const res = createMockRes();

    await authController.registerStep1(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.matched, true);
    assert.ok(res.data.student);
  });

  await t.test('4. Registration Step 1 works with 11-digit number from CSV (Ayushmaan: 62002875316)', async () => {
    const req = {
      body: { phone: '62002875316', userType: 'student' }
    };
    const res = createMockRes();

    await authController.registerStep1(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.matched, true);
  });

  await t.test('5. Complete registration rejects unauthorized mobile number', async () => {
    const req = {
      body: {
        name: 'Imposter Student',
        phone: '9988776655', // Not authorized
        usn: '3BR23AI999',
        email: 'imposter@bitm.edu.in',
        password: 'Password@123',
        gender: 'male',
        college: 'Ballari Institute of Technology and Management',
        department: 'AIML'
      }
    };
    const res = createMockRes();

    await authController.setPassword(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /does not match any official college record/i);
  });

  await t.test('6. Complete registration succeeds for authorized phone with student chosen name & USN', async () => {
    const req = {
      body: {
        name: 'K Sriram Registered',
        phone: '9380733014',
        usn: '3BR23AI068',
        email: 'sriram.test@bitm.edu.in',
        password: 'Password@123',
        gender: 'male',
        college: 'Ballari Institute of Technology and Management',
        department: 'AIML'
      }
    };
    const res = createMockRes();

    await authController.setPassword(req, res);

    assert.equal(res.statusCode, 201);
    assert.match(res.data.message, /Registration complete/i);

    // Verify User was created
    const created = await User.findOne({ phone: '9380733014' });
    assert.ok(created);
    assert.equal(created.name, 'K Sriram Registered');
    assert.equal(created.usn, '3BR23AI068');

    // Verify ApprovedStudent record marked as registered
    const approved = await ApprovedStudent.findOne({ phoneNumber: '9380733014' });
    assert.equal(approved.isRegistered, true);

    // Clean up test user to keep database empty
    await User.deleteOne({ _id: created._id });
    await ApprovedStudent.updateOne(
      { phoneNumber: '9380733014' },
      { $set: { isRegistered: false, registrationStatus: 'not_registered', registeredUserId: null } }
    );
  });

  await mongoose.disconnect();
});

