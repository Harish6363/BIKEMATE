const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

const ADMIN_CREDENTIALS = {
  name: 'System Admin',
  email: 'admin@bikemate.com',
  phone: '9999999999',
  password: 'Admin@123',
  role: 'admin',
  college: 'Ballari Institute of Technology and Management',
  department: 'Administration',
  verificationStatus: 'verified',
  gender: 'male'
};

async function seedAdmin() {
  const existingAdmin = await User.findOne({
    $or: [
      { role: 'admin' },
      { phone: ADMIN_CREDENTIALS.phone },
      { email: ADMIN_CREDENTIALS.email }
    ]
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(ADMIN_CREDENTIALS.password, salt);

  if (!existingAdmin) {
    const admin = await User.create({
      name: ADMIN_CREDENTIALS.name,
      email: ADMIN_CREDENTIALS.email,
      phone: ADMIN_CREDENTIALS.phone,
      passwordHash,
      password: passwordHash,
      password_hash: passwordHash,
      role: ADMIN_CREDENTIALS.role,
      college: ADMIN_CREDENTIALS.college,
      department: ADMIN_CREDENTIALS.department,
      verificationStatus: ADMIN_CREDENTIALS.verificationStatus,
      isVerified: true,
      gender: ADMIN_CREDENTIALS.gender
    });
    console.log(`✅ Admin account created successfully: ${admin.email} (${admin.phone})`);
    return admin;
  } else {
    // Update password hash and ensure role is admin
    await User.updateOne(
      { _id: existingAdmin._id },
      {
        $set: {
          role: 'admin',
          passwordHash,
          password: passwordHash,
          password_hash: passwordHash,
          verificationStatus: 'verified',
          isVerified: true
        }
      }
    );
    console.log(`✅ Admin account updated successfully: ${existingAdmin.email} (${existingAdmin.phone})`);
    return existingAdmin;
  }
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bikemate';
  mongoose.connect(mongoUri)
    .then(async () => {
      await seedAdmin();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to seed admin account:', err);
      process.exit(1);
    });
}

module.exports = { seedAdmin, ADMIN_CREDENTIALS };

