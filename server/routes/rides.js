const express = require('express');
const { 
  findRide, 
  getRideById,
  offerRide, 
  requestRide, 
  getMyRequests, 
  respondToRequest, 
  getOsrmRoute,
  getPublicRideSummary 
} = require('../controllers/rideController');
const auth = require('../middleware/auth');

const router = express.Router();

// Route calculation geometry
router.get('/osrm-route', getOsrmRoute);

// Public Real-Time Platform Telemetry & Latest Ride for Landing Page
router.get('/public/summary', getPublicRideSummary);

// Authentication required for all ride operations: finding, offering, requesting, managing
router.use(auth);

router.get('/', findRide);
router.get('/search', findRide);
router.post('/', offerRide);
router.get('/requests/my', getMyRequests);
router.get('/:id', getRideById);
router.post('/:id/request', requestRide);
router.patch('/requests/:requestId', respondToRequest);

module.exports = router;
