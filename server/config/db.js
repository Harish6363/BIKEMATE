const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryMongoServer;

const connectDB = async () => {
  try {
    const configuredMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bikemate';

    try {
      const conn = await mongoose.connect(configuredMongoUri);
      console.log(`MongoDB Connected: ${conn.connection.host}`);

      // Auto-sync approved students from CSV and ensure admin account exists
      try {
        const { seedApprovedStudents } = require('../utils/seedApprovedStudents');
        await seedApprovedStudents();
        const { seedAdmin } = require('../utils/seedAdmin');
        await seedAdmin();
      } catch (seedErr) {
        console.warn('Notice: Auto-seed skipped:', seedErr.message);
      }

      // Ensure stale unique indexes are safely dropped
      try {
        const reqColl = mongoose.connection.collection('riderequests');
        const idxs = await reqColl.indexes();
        if (idxs.some(i => i.name === 'ride_1_passenger_1')) {
          await reqColl.dropIndex('ride_1_passenger_1');
          console.log('Cleaned up legacy stale index: ride_1_passenger_1');
        }
      } catch (_) {}

      return;
    } catch (configuredError) {
      const localMongoFallback = configuredMongoUri.includes('localhost') || configuredMongoUri.includes('127.0.0.1');

      if (!localMongoFallback) {
        throw configuredError;
      }

      console.warn('Local MongoDB unavailable. Starting in-memory MongoDB fallback...');
      memoryMongoServer = await MongoMemoryServer.create();
      const fallbackConn = await mongoose.connect(memoryMongoServer.getUri());
      console.log(`MongoDB Connected via in-memory fallback: ${fallbackConn.connection.host}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);

    if (memoryMongoServer) {
      await memoryMongoServer.stop();
    }

    process.exit(1);
  }
};

module.exports = connectDB;
