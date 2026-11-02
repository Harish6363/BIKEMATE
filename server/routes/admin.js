const express = require('express');
const {
  getMetrics,
  getUsers,
  toggleBanUser,
  verifyUser,
  deleteUser,
  getRides,
  deleteRide,
  getRideRequests,
  getLogs,
  createLog,
  getApprovedStudents,
  addApprovedStudent,
  deleteApprovedStudent
} = require('../controllers/adminController');

const router = express.Router();

// 1. Overview & Environmental Metrics + Infrastructure Health
router.get('/metrics', getMetrics);

// 2. User Moderation
router.get('/users', getUsers);
router.patch('/users/:id/ban', toggleBanUser);
router.patch('/users/:id/verify', verifyUser);
router.delete('/users/:id', deleteUser);

// 3. Active & Scheduled Rides Moderation
router.get('/rides', getRides);
router.delete('/rides/:id', deleteRide);

// 4. Ride Requests Moderation
router.get('/requests', getRideRequests);

// 5. System Activity Audit Logs
router.get('/logs', getLogs);
router.post('/logs', createLog);

// 6. Pre-Approved College Students / Whitelist
router.get('/approved-students', getApprovedStudents);
router.post('/approved-students', addApprovedStudent);
router.delete('/approved-students/:id', deleteApprovedStudent);

module.exports = router;
