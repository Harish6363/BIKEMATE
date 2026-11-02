const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { seedApprovedStudents } = require('./seedApprovedStudents');
const { seedAdmin } = require('./seedAdmin');

async function resetAllAccounts() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bikemate';
  console.log(`Connecting to MongoDB at: ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;

  console.log('\n🧹 [DATABASE RESET] Removing all user accounts and related records...');

  // 1. Remove all users
  const userResult = await db.collection('users').deleteMany({});
  console.log(`- Removed ${userResult.deletedCount} user accounts from 'users' collection.`);

  // 2. Remove dependent user data to prevent orphaned references
  const collectionsToClear = [
    'rides',
    'riderequests',
    'notifications',
    'messages',
    'otpverifications',
    'auditlogs',
    'refresh_tokens',
    'match_feedback',
    'matches',
    'available_rides',
    'userstatistics',
    'verificationsessions',
    'savedlocations',
    'emergencycontacts'
  ];

  for (const collName of collectionsToClear) {
    try {
      const res = await db.collection(collName).deleteMany({});
      if (res.deletedCount > 0) {
        console.log(`- Cleared ${res.deletedCount} documents from '${collName}'.`);
      }
    } catch (e) {
      // Collection might not exist, ignore
    }
  }

  // 3. Drop approvedstudents collection so stale indexes are removed completely
  try {
    await db.collection('approvedstudents').drop();
    console.log(`- Dropped old 'approvedstudents' collection and stale indexes.`);
  } catch (e) {
    // Ignore if collection did not exist
  }

  // 4. Seed all 35 approved students from details(name,usn,phone).csv
  await seedApprovedStudents();

  // 5. Ensure system admin account is seeded
  await seedAdmin();

  const finalUserCount = await db.collection('users').countDocuments();
  const finalApprovedCount = await db.collection('approvedstudents').countDocuments();

  console.log(`\n🎉 Reset complete!`);
  console.log(`- Total User Accounts: ${finalUserCount} (All removed)`);
  console.log(`- Total Approved Students: ${finalApprovedCount} (Ready for registration matching)`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
}

if (require.main === module) {
  resetAllAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error during database reset:', err);
      process.exit(1);
    });
}

module.exports = { resetAllAccounts };
