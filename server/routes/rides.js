const express = require('express');
const { 
  findRide, 
  getRideById,
  offerRide, 
  requestRide, 
  getMyRequests, 
  getMyOfferedRides,
  respondToRequest, 
  startRide,
  completeRide,
  getOsrmRoute,
  getPublicRideSummary,
  cancelRide,
  cancelRequest,
  rebookRide,
  getActiveCommuteStatus,
  deleteRide,
  deleteRequest,
  clearAllOfferedRides,
  clearAllRequests
} = require('../controllers/rideController');
const auth = require('../middleware/auth');

const router = express.Router();

// Route calculation geometry
router.get('/osrm-route', getOsrmRoute);

// Public Real-Time Platform Telemetry & Latest Ride for Landing Page
router.get('/public/summary', getPublicRideSummary);

// Public Live Ride Tracking for Parents/Friends Share Link
router.get('/public/:id', getRideById);

// Authentication required for all ride operations: finding, offering, requesting, managing
router.use(auth);

router.get('/', findRide);
router.get('/search', findRide);
router.get('/active-status', getActiveCommuteStatus);
router.get('/my-offered', getMyOfferedRides);
router.get('/requests/my', getMyRequests);
router.post('/', offerRide);
router.post('/rebook', rebookRide);
router.delete('/clear-all', clearAllOfferedRides);
router.delete('/requests/clear-all', clearAllRequests);
router.delete('/:id', deleteRide);
router.delete('/requests/:requestId', deleteRequest);
router.patch('/:id/cancel', cancelRide);
router.get('/:id', getRideById);
router.post('/:id/request', requestRide);
router.patch('/requests/:requestId', respondToRequest);
router.patch('/requests/:requestId/cancel', cancelRequest);
router.post('/:id/start', startRide);
router.post('/:id/complete', completeRide);

module.exports = router;
