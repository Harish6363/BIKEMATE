const User = require('../models/User');
const Ride = require('../models/Ride');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

// Helper to record an audit log
const logSystemEvent = async (level, actionEvent, user, details) => {
  try {
    await AuditLog.create({
      level,
      actionEvent,
      user: user || 'System Admin',
      details: typeof details === 'object' ? JSON.stringify(details) : String(details)
    });
  } catch (err) {
    console.warn('Failed to record audit log:', err.message);
  }
};

// 1. Get Platform Overview & Environmental Metrics
exports.getMetrics = async (req, res) => {
  try {
    const studentCount = await User.countDocuments({ role: { $ne: 'admin' } });
    const verifiedCount = await User.countDocuments({ 
      role: { $ne: 'admin' }, 
      verificationStatus: 'verified' 
    });
    const activeRidesCount = await Ride.countDocuments({ status: 'active' });
    const totalRidesCount = await Ride.countDocuments();

    // Environmental metrics calculation (each shared bike commute saves ~0.4L petrol and ~0.8kg CO2)
    const vehiclesSaved = Math.max(0, totalRidesCount);
    const co2SavedKg = (vehiclesSaved * 0.84).toFixed(1);
    const fuelConservedL = (vehiclesSaved * 0.42).toFixed(1);

    const isDbConnected = mongoose.connection.readyState === 1;

    res.status(200).json({
      metrics: {
        registeredStudents: studentCount,
        verifiedStudents: verifiedCount,
        vehiclesSaved,
        co2SavedKg,
        fuelConservedL,
        activeRides: activeRidesCount
      },
      infrastructure: {
        backendService: 'Healthy',
        databaseStatus: isDbConnected ? 'Connected' : 'Disconnected',
        uptimeSeconds: Math.floor(process.uptime()),
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    });
  } catch (err) {
    console.error('Admin getMetrics error:', err);
    res.status(500).json({ message: 'Error retrieving metrics', error: err.message });
  }
};

// 2. Get Users for Moderation
exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { role: { $ne: 'admin' } };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { usn: regex },
        { department: regex }
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error('Admin getUsers error:', err);
    res.status(500).json({ message: 'Error retrieving users', error: err.message });
  }
};

// 3. Toggle Ban User
exports.toggleBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isBanned = !user.isBanned;
    if (user.isBanned) {
      user.banReason = req.body.reason || 'Account suspended by campus moderator';
    } else {
      user.banReason = '';
    }
    await user.save();

    await logSystemEvent(
      'SECURITY',
      user.isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
      'System Admin',
      {
        targetUserId: user._id,
        targetUserName: user.name,
        targetUserEmail: user.email,
        isBanned: user.isBanned,
        banReason: user.banReason
      }
    );

    res.status(200).json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'} successfully`, user });
  } catch (err) {
    console.error('Admin toggleBanUser error:', err);
    res.status(500).json({ message: 'Error moderating user', error: err.message });
  }
};

// 4. Verify User ID
exports.verifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.verificationStatus = 'verified';
    await user.save();

    await logSystemEvent(
      'SECURITY',
      'VERIFICATION_VERIFIED',
      'System Admin',
      {
        targetUserId: user._id,
        targetUserName: user.name,
        targetUserEmail: user.email,
        isBanned: user.isBanned || false,
        verificationStatus: 'verified'
      }
    );

    res.status(200).json({ message: `Student ID verified successfully`, user });
  } catch (err) {
    console.error('Admin verifyUser error:', err);
    res.status(500).json({ message: 'Error verifying user', error: err.message });
  }
};

// 5. Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logSystemEvent(
      'WARNING',
      'USER_DELETED',
      'System Admin',
      { targetUserId: id, targetUserName: user.name, email: user.email }
    );

    res.status(200).json({ message: 'User account removed' });
  } catch (err) {
    console.error('Admin deleteUser error:', err);
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
};

// 6. Get All Active & Scheduled Rides
exports.getRides = async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate('offeredBy', 'name college phone usn')
      .sort({ createdAt: -1 });

    res.status(200).json(rides);
  } catch (err) {
    console.error('Admin getRides error:', err);
    res.status(500).json({ message: 'Error retrieving rides', error: err.message });
  }
};

// 7. Remove / Moderate Ride
exports.deleteRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findByIdAndDelete(id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    await logSystemEvent(
      'INFO',
      'RIDE_REMOVED',
      'System Admin',
      { rideId: id, origin: ride.originAddress, destination: ride.destAddress }
    );

    res.status(200).json({ message: 'Ride listing removed successfully' });
  } catch (err) {
    console.error('Admin deleteRide error:', err);
    res.status(500).json({ message: 'Error removing ride', error: err.message });
  }
};

// 8. Get System Activity Audit Logs
exports.getLogs = async (req, res) => {
  try {
    const { level } = req.query;
    let query = {};
    if (level && level !== 'ALL') {
      query.level = level.toUpperCase();
    }

    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(100);
    res.status(200).json(logs);
  } catch (err) {
    console.error('Admin getLogs error:', err);
    res.status(500).json({ message: 'Error retrieving audit logs', error: err.message });
  }
};

// 9. Post Audit Log (e.g. from frontend SOS or actions)
exports.createLog = async (req, res) => {
  try {
    const { level, actionEvent, user, details } = req.body;
    const newLog = await AuditLog.create({
      level: level || 'INFO',
      actionEvent,
      user: user || 'System',
      details: typeof details === 'object' ? JSON.stringify(details) : String(details || '')
    });
    res.status(201).json(newLog);
  } catch (err) {
    console.error('Admin createLog error:', err);
    res.status(500).json({ message: 'Error recording log', error: err.message });
  }
};

// 10. Get All Ride Requests for Moderation
exports.getRideRequests = async (req, res) => {
  try {
    const RideRequest = require('../models/RideRequest');
    const requests = await RideRequest.find()
      .populate('requester', 'name email phone usn college department')
      .populate('driver', 'name email phone usn college department')
      .populate('ride', 'originAddress destAddress departureTime status pricePerSeat')
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (err) {
    console.error('Admin getRideRequests error:', err);
    res.status(500).json({ message: 'Error retrieving ride requests', error: err.message });
  }
};

// 11. Get All Approved College Students
exports.getApprovedStudents = async (req, res) => {
  try {
    const ApprovedStudent = require('../models/ApprovedStudent');
    const students = await ApprovedStudent.find()
      .populate('registeredUserId', 'name usn email phone createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      total: students.length,
      registeredCount: students.filter(s => s.isRegistered).length,
      students
    });
  } catch (err) {
    console.error('Admin getApprovedStudents error:', err);
    res.status(500).json({ message: 'Error retrieving approved students', error: err.message });
  }
};

// 12. Add New Approved Student Phone Number (Single or Bulk)
exports.addApprovedStudent = async (req, res) => {
  try {
    const ApprovedStudent = require('../models/ApprovedStudent');
    const { phoneNumber, phoneNumbers, name, usn, department, college } = req.body;

    // Handle Bulk Addition if phoneNumbers array or multi-line string is passed
    if (phoneNumbers) {
      let rawList = [];
      if (Array.isArray(phoneNumbers)) {
        rawList = phoneNumbers;
      } else if (typeof phoneNumbers === 'string') {
        rawList = phoneNumbers.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
      }

      let added = 0;
      let skipped = 0;

      for (const raw of rawList) {
        let clean = raw.replace(/[^0-9]/g, '');
        if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2);
        if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
        if (clean.length === 10) {
          const exists = await ApprovedStudent.findOne({ phoneNumber: clean });
          if (!exists) {
            await ApprovedStudent.create({
              phoneNumber: clean,
              name: '',
              usn: '',
              college: college || 'Ballari Institute of Technology and Management',
              department: department || 'AIML',
              registrationStatus: 'not_registered',
              isRegistered: false
            });
            added++;
          } else {
            skipped++;
          }
        }
      }

      return res.status(201).json({
        message: `Bulk import complete: ${added} phone number(s) added, ${skipped} already existed.`,
        added,
        skipped
      });
    }

    // Handle Single Phone Number Addition
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Student mobile number is required' });
    }

    let cleanPhone = phoneNumber.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = cleanPhone.slice(1);

    if (cleanPhone.length < 10) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    const existing = await ApprovedStudent.findOne({ phoneNumber: cleanPhone });
    if (existing) {
      return res.status(400).json({ message: `Mobile number ${cleanPhone} is already in the approved list.` });
    }

    const newStudent = await ApprovedStudent.create({
      phoneNumber: cleanPhone,
      name: (name || '').trim(),
      usn: (usn || '').toUpperCase().trim(),
      college: college || 'Ballari Institute of Technology and Management',
      department: department || 'AIML',
      registrationStatus: 'not_registered',
      isRegistered: false
    });

    res.status(201).json({
      message: `Mobile number ${cleanPhone} added to approved database successfully`,
      student: newStudent
    });
  } catch (err) {
    console.error('Admin addApprovedStudent error:', err);
    res.status(500).json({ message: 'Error adding approved student phone number', error: err.message });
  }
};

// 13. Delete Approved Student Phone Number
exports.deleteApprovedStudent = async (req, res) => {
  try {
    const ApprovedStudent = require('../models/ApprovedStudent');
    const { id } = req.params;

    const removed = await ApprovedStudent.findByIdAndDelete(id);
    if (!removed) {
      return res.status(404).json({ message: 'Phone number record not found' });
    }

    res.status(200).json({
      message: `Mobile number ${removed.phoneNumber} removed from authorized list`,
      removed
    });
  } catch (err) {
    console.error('Admin deleteApprovedStudent error:', err);
    res.status(500).json({ message: 'Error removing phone number', error: err.message });
  }
};
