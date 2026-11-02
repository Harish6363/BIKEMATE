const Ride = require('../models/Ride');
const RideRequest = require('../models/RideRequest');
const User = require('../models/User');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const { createNotification } = require('./notificationController');
const {
  getOsrmRoute,
  analyzeRouteDetour,
  haversineDistanceMeters
} = require('../services/osrmService');
const {
  CONFIG,
  calculatePricing,
  matchRides
} = require('../services/matchingService');
const {
  generatePin,
  hashPin,
  verifyPin,
  encryptPin,
  decryptPin
} = require('../utils/pinSecurity');

// Helper to extract authenticated user from header
const getAuthUser = async (req) => {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user) return user;
    } catch (e) {}
  }
  return null;
};

// ============================================================================
// 1. FIND RIDES: Intelligent OSRM-Based Corridor, Detour & Directional Matching
// ============================================================================
exports.findRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({
        message: 'Authentication required. Please log into your verified student account before searching for rides.'
      });
    }

    // College verification check
    if (authUser.verificationStatus && authUser.verificationStatus !== 'verified' && authUser.role !== 'admin') {
      return res.status(403).json({
        message: 'Student Verification Required: Only verified college students can search for or join rides. Please upload your student ID for verification.'
      });
    }

    if (authUser.isBanned) {
      return res.status(403).json({
        message: `Account is suspended. Reason: ${authUser.banReason || 'Policy violation'}`
      });
    }

    const { originLng, originLat, destLng, destLat } = req.query;

    // Stage A: Preliminary Database Filtering
    // 1. Strict gender segregation for students (Female <-> Female, Male <-> Male)
    //    EXCEPTION: Faculty/Staff can be picked up by any boy or girl!
    // 2. Exclude rides offered by the logged-in user themselves
    // 3. Exclude cancelled, completed, full, or in-progress rides
    // 4. Must have seatsAvailable > 0
    const isFaculty = authUser.role === 'faculty' || authUser.userType === 'faculty';
    const query = {
      status: 'active',
      seatsAvailable: { $gt: 0 },
      offeredBy: { $ne: authUser._id }
    };
    if (!isFaculty) {
      query.gender = authUser.gender || 'male';
    }

    const candidateRides = await Ride.find(query)
      .populate('offeredBy', 'name college department phone gender usn employeeId role userType verificationStatus')
      .sort({ departureTime: 1, createdAt: -1 })
      .limit(CONFIG.MAX_CANDIDATES);

    if (candidateRides.length === 0) {
      return res.status(200).json([]);
    }

    // If commuter supplied pickup and dropoff coordinates, execute full OSRM matching
    if (originLng && originLat && destLng && destLat) {
      const commuterPickup = [parseFloat(originLng), parseFloat(originLat)];
      const commuterDropoff = [parseFloat(destLng), parseFloat(destLat)];

      const matchedRides = await matchRides(authUser, candidateRides, commuterPickup, commuterDropoff);
      return res.status(200).json(matchedRides);
    }

    // If no coordinates passed (e.g. general active rides list), format with pricing
    const formattedRides = candidateRides.map(r => {
      const dist = r.distanceKm || 8.5;
      const pricing = calculatePricing(dist);
      const obj = r.toObject();
      delete obj.boardingPinHash;
      delete obj.boardingPinEncrypted;
      return {
        ...obj,
        matchType: 'DIRECT_MATCH',
        matchScore: 90,
        matchExplanation: 'Active scheduled campus commute.',
        calculatedFare: pricing.studentContribution,
        studentContribution: pricing.studentContribution,
        estimatedAutoFare: pricing.estimatedAutoFare,
        savingsVsAuto: pricing.estimatedSavings,
        sharedDistanceKm: dist,
        detourMeters: 0
      };
    });

    res.status(200).json(formattedRides);
  } catch (error) {
    console.error('Find rides error:', error);
    res.status(500).json({ message: 'Error finding matching rides', error: error.message });
  }
};

// ============================================================================
// 1b. GET SINGLE RIDE BY ID (Secure Boarding PIN Delivery)
// ============================================================================
exports.getRideById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('offeredBy', 'name college department phone usn gender');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    const authUser = req.user || await getAuthUser(req);
    const rideObj = ride.toObject();

    // Sensitive security rule: Never reveal Boarding PIN hash or encrypted data in public or driver view
    delete rideObj.boardingPinHash;

    const isDriver = authUser && ride.offeredBy?._id?.toString() === authUser._id?.toString();

    if (isDriver) {
      // Driver NEVER sees the Boarding PIN in the API response
      delete rideObj.boardingPinEncrypted;
      delete rideObj.boardingPin;
    } else if (authUser) {
      // Check if logged-in commuter has an accepted request for this ride
      const userRequest = await RideRequest.findOne({
        ride: ride._id,
        requester: authUser._id,
        status: { $in: ['accepted', 'pending', 'repeat_requested'] }
      });

      if (userRequest) {
        const reqObj = userRequest.toObject();
        delete reqObj.boardingPinHash;

        // Decrypt PIN ONLY for the authorized commuter
        if (userRequest.status === 'accepted' && (userRequest.boardingPinEncrypted || ride.boardingPinEncrypted)) {
          const enc = userRequest.boardingPinEncrypted || ride.boardingPinEncrypted;
          const decrypted = decryptPin(enc);
          reqObj.boardingPin = decrypted;
          rideObj.boardingPin = decrypted;
        } else {
          delete reqObj.boardingPinEncrypted;
          delete rideObj.boardingPinEncrypted;
        }

        rideObj.userRequest = reqObj;
      } else {
        delete rideObj.boardingPinEncrypted;
      }
    } else {
      delete rideObj.boardingPinEncrypted;
    }

    res.status(200).json(rideObj);
  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({ message: 'Error fetching ride details', error: error.message });
  }
};

// ============================================================================
// 1c. GET MY OFFERED RIDES (Driver Dashboard)
// ============================================================================
exports.getMyOfferedRides = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const rides = await Ride.find({ offeredBy: authUser._id })
      .select('-boardingPinHash -boardingPinEncrypted') // Driver must receive code verbally, never via payload
      .populate('offeredBy', 'name college phone usn gender')
      .sort({ createdAt: -1 });

    res.status(200).json(rides);
  } catch (error) {
    console.error('Get my offered rides error:', error);
    res.status(500).json({ message: 'Error fetching offered rides', error: error.message });
  }
};

// ============================================================================
// 2. OFFER A RIDE (Single Active Ride Enforcement & Real OSRM Road Distance)
// ============================================================================
exports.offerRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required. Please log into your account before offering a ride.' });
    }

    if (authUser.verificationStatus && authUser.verificationStatus !== 'verified' && authUser.role !== 'admin') {
      return res.status(403).json({
        message: 'Verification Required: Only verified college students can offer rides. Please complete ID verification.'
      });
    }

    const userId = authUser._id;
    const userGender = authUser.gender || 'male';

    // 1. Single Active Ride Check: Driver cannot publish overlapping active/in_progress rides
    const existingActiveRide = await Ride.findOne({
      offeredBy: userId,
      status: { $in: ['active', 'full', 'in_progress'] }
    });

    if (existingActiveRide) {
      if (!req.body.cancelPrevious) {
        return res.status(409).json({
          hasActiveRide: true,
          activeRide: existingActiveRide,
          message: 'You already have an active scheduled ride. Complete or cancel it before offering a new ride.'
        });
      }

      // If cancelPrevious is confirmed, cleanly cancel existing ride and notify affected commuters
      existingActiveRide.status = 'cancelled';
      await existingActiveRide.save();

      const affected = await RideRequest.find({ ride: existingActiveRide._id, status: { $in: ['pending', 'accepted'] } });
      for (const reqItem of affected) {
        reqItem.status = 'cancelled';
        await reqItem.save();
        await createNotification({
          recipient: reqItem.requester,
          sender: userId,
          type: 'RIDE_UPDATE',
          title: '🚫 Ride Rescheduled by Driver',
          message: `${authUser.name} rescheduled their ride. A new commute has been published.`,
          actionUrl: '/find-ride'
        });
      }
    }

    const {
      originCoords,
      destCoords,
      originAddress,
      destAddress,
      routePolyline,
      departureTime,
      bikeName,
      bikeNumber
    } = req.body;

    const oCoords = originCoords || [76.9214, 15.1394];
    const dCoords = destCoords || [76.8506, 15.1677]; // BITM Campus

    // Calculate real driving distance via OSRM
    const osrmRes = await getOsrmRoute([oCoords, dCoords]);
    const calculatedDist = osrmRes.success
      ? osrmRes.distanceKm
      : parseFloat((haversineDistanceMeters(oCoords[0], oCoords[1], dCoords[0], dCoords[1]) / 1000 * 1.25).toFixed(2));

    const pricing = calculatePricing(calculatedDist);

    const newRide = await Ride.create({
      offeredBy: userId,
      gender: userGender,
      ride_id: 'RIDE-' + Date.now().toString().slice(-6),
      origin: {
        type: 'Point',
        coordinates: oCoords
      },
      originAddress: originAddress || 'Pickup Point',
      destination: {
        type: 'Point',
        coordinates: dCoords
      },
      destAddress: destAddress || 'Ballari Institute of Technology and Management, Ballari',
      routePolyline: routePolyline || (osrmRes.success ? JSON.stringify(osrmRes.geometry) : null),
      distanceKm: calculatedDist,
      ratePerKm: CONFIG.RATE_PER_KM,
      departureTime: departureTime ? new Date(departureTime) : new Date(Date.now() + 30 * 60000),
      seatsAvailable: 1, // Enforce maximum of ONE commuter per bike
      pricePerSeat: pricing.studentContribution,
      bikeName: (bikeName && bikeName.trim()) ? bikeName.trim() : (authUser.bikeName || 'Royal Enfield Hunter 350'),
      bikeNumber: (bikeNumber && bikeNumber.trim()) ? bikeNumber.trim().toUpperCase() : (authUser.bikeNumber || 'KA-34-EA-4412'),
      status: 'active'
    });

    const populated = await Ride.findById(newRide._id)
      .select('-boardingPinHash -boardingPinEncrypted')
      .populate('offeredBy', 'name college phone gender');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Offer ride error:', error);
    res.status(500).json({ message: 'Error offering ride', error: error.message });
  }
};

// ============================================================================
// 3. REQUEST A RIDE (Single Active Booking Check, Gender Safety & OSRM Fare)
// ============================================================================
exports.requestRide = async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required. Please log into your verified student account.' });
    }

    if (authUser.verificationStatus && authUser.verificationStatus !== 'verified' && authUser.role !== 'admin') {
      return res.status(403).json({
        message: 'Student Verification Required: Only verified college students can request rides.'
      });
    }

    const requesterId = authUser._id;
    const requesterGender = authUser.gender || 'male';

    const ride = await Ride.findById(rideId).populate('offeredBy');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const driverGender = ride.gender || ride.offeredBy?.gender || 'male';

    // Strict Gender-Safety Validation: Female <-> Female, Male <-> Male
    // EXCEPTION: Any boy or girl can pick up faculty for a ride!
    const isRequesterFaculty = authUser.role === 'faculty' || authUser.userType === 'faculty';
    const isDriverFaculty = ride.offeredBy?.role === 'faculty' || ride.offeredBy?.userType === 'faculty';

    if (!isRequesterFaculty && !isDriverFaculty && requesterGender !== driverGender) {
      const isFemaleRide = driverGender === 'female';
      return res.status(403).json({
        message: isFemaleRide
          ? 'Campus Safety Policy: This is a Ladies-only ride. Gents cannot request or join rides offered by ladies.'
          : 'Campus Safety Policy: This is a Gents-only ride. Ladies cannot request or join rides offered by gents.'
      });
    }

    if (ride.offeredBy._id.toString() === requesterId.toString()) {
      return res.status(400).json({ message: 'You cannot request to join your own ride!' });
    }

    if (ride.seatsAvailable <= 0 || ride.status === 'full') {
      return res.status(400).json({ message: 'Sorry, this ride is already full.' });
    }

    if (['completed', 'cancelled', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({ message: `Cannot request a ride that is currently ${ride.status}.` });
    }

    // Check if request already submitted for this exact ride
    let existingRequest = await RideRequest.findOne({ ride: rideId, requester: requesterId });
    if (existingRequest) {
      return res.status(200).json({
        message: 'Request already submitted and currently ' + existingRequest.status,
        request: existingRequest
      });
    }

    // Single Active Booking Check: Commuter cannot have multiple conflicting active requests
    const conflictingRequest = await RideRequest.findOne({
      requester: requesterId,
      status: { $in: ['pending', 'accepted', 'repeat_requested'] },
      ride: { $ne: rideId }
    }).populate('ride').populate('driver', 'name');

    if (conflictingRequest && conflictingRequest.ride && ['active', 'full', 'in_progress'].includes(conflictingRequest.ride.status)) {
      if (!req.body.cancelPrevious) {
        return res.status(409).json({
          hasActiveRequest: true,
          conflictingRequest: {
            id: conflictingRequest._id,
            driverName: conflictingRequest.driver?.name || 'Fellow Student',
            originAddress: conflictingRequest.ride?.originAddress,
            departureTime: conflictingRequest.ride?.departureTime,
            status: conflictingRequest.status
          },
          message: `You already have an active request with ${conflictingRequest.driver?.name || 'a driver'}. Would you like to switch to this ride?`
        });
      }

      // If cancelPrevious is confirmed, cleanly cancel previous request and release seat
      const wasAccepted = conflictingRequest.status === 'accepted';
      conflictingRequest.status = 'cancelled';
      await conflictingRequest.save();

      if (wasAccepted) {
        await Ride.findByIdAndUpdate(conflictingRequest.ride._id, {
          $inc: { seatsAvailable: 1 },
          status: 'active'
        });
      }

      if (conflictingRequest.driver) {
        await createNotification({
          recipient: conflictingRequest.driver._id,
          sender: requesterId,
          type: 'RIDE_UPDATE',
          title: 'Seat Request Switched',
          message: `${authUser.name} switched their seat request to another driver. Your seat is available again.`,
          actionUrl: '/rides'
        });
      }
    }

    const { pickupCoords, pickupAddress } = req.body || {};
    const driverCoords = ride.origin?.coordinates || [76.9214, 15.1394];
    const collegeCoords = ride.destination?.coordinates || [76.8506, 15.1677];
    const userPickupCoords = pickupCoords || driverCoords;

    // Calculate actual road distance via OSRM
    const osrmSegment = await getOsrmRoute([userPickupCoords, collegeCoords]);
    const sharedDistKm = osrmRes = osrmSegment.success
      ? osrmSegment.distanceKm
      : parseFloat((haversineDistanceMeters(userPickupCoords[0], userPickupCoords[1], collegeCoords[0], collegeCoords[1]) / 1000 * 1.25).toFixed(2));

    const pricing = calculatePricing(sharedDistKm);

    const newRequest = await RideRequest.create({
      ride: rideId,
      requester: requesterId,
      driver: ride.offeredBy._id,
      pickupAddress: pickupAddress || ride.originAddress,
      distanceKm: pricing.applicableDistanceKm,
      calculatedFare: pricing.studentContribution,
      seatsRequested: 1,
      status: 'pending'
    });

    const populatedRequest = await RideRequest.findById(newRequest._id)
      .populate('requester', 'name college phone usn employeeId role userType department')
      .populate('ride', 'originAddress destAddress departureTime pricePerSeat distanceKm ratePerKm')
      .populate('driver', 'name college phone usn employeeId role userType');

    // Notify driver about new seat request
    await createNotification({
      recipient: ride.offeredBy._id,
      sender: requesterId,
      type: 'RIDE_REQUEST',
      title: 'New Ride Request 📋',
      message: `${populatedRequest.requester?.name || 'A student'} requested a seat on your ride to campus (${populatedRequest.pickupAddress || 'Pickup Point'}).`,
      rideId: ride._id,
      actionUrl: '/rides'
    });

    if (global.io) {
      global.io.to(`user_${ride.offeredBy._id}`).emit('newRideRequest', {
        request: populatedRequest
      });
    }

    res.status(201).json({
      message: `Request sent! Subsidized fare: ₹${pricing.studentContribution} (${pricing.applicableDistanceKm} km @ ₹2/km)`,
      request: populatedRequest,
      fare: pricing.studentContribution,
      pricing
    });
  } catch (error) {
    console.error('Request ride error:', error);
    res.status(500).json({ message: 'Error submitting ride request', error: error.message });
  }
};

// ============================================================================
// 4. GET MY REQUESTS (Both Incoming for Driver & Outgoing for Commuter)
// ============================================================================
exports.getMyRequests = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const userId = authUser._id;

    // 1. Incoming Requests (User is Driver)
    // Driver MUST verbally receive code from commuter; NEVER expose PIN in driver payload
    const rawIncoming = await RideRequest.find({ driver: userId })
      .populate('requester', 'name college phone usn employeeId role userType department gender')
      .populate('ride', 'originAddress destAddress departureTime seatsAvailable pricePerSeat distanceKm ratePerKm status offeredBy')
      .sort({ createdAt: -1 });

    const incoming = rawIncoming.map(r => {
      const obj = r.toObject();
      delete obj.boardingPinHash;
      delete obj.boardingPinEncrypted;
      delete obj.boardingPin;
      if (obj.ride) {
        delete obj.ride.boardingPinHash;
        delete obj.ride.boardingPinEncrypted;
        delete obj.ride.boardingPin;
      }
      return obj;
    });

    // 2. Outgoing Requests (User is Commuter)
    // Commuter needs their boardingPin to verbally speak to the driver
    const rawOutgoing = await RideRequest.find({ requester: userId })
      .populate('driver', 'name college phone usn employeeId role userType gender')
      .populate({
        path: 'ride',
        select: 'originAddress destAddress departureTime seatsAvailable pricePerSeat distanceKm ratePerKm status offeredBy boardingPinEncrypted',
        populate: { path: 'offeredBy', select: 'name college phone usn employeeId role userType gender' }
      })
      .sort({ createdAt: -1 });

    const outgoing = rawOutgoing.map(r => {
      const obj = r.toObject();
      delete obj.boardingPinHash;

      if (obj.status === 'accepted') {
        const enc = obj.boardingPinEncrypted || obj.ride?.boardingPinEncrypted;
        if (enc) {
          obj.boardingPin = decryptPin(enc);
        }
      }

      delete obj.boardingPinEncrypted;
      if (obj.ride) {
        delete obj.ride.boardingPinHash;
        delete obj.ride.boardingPinEncrypted;
      }
      return obj;
    });

    res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
};

// ============================================================================
// 5. DRIVER RESPONDS TO REQUEST (Atomic Seat Reservation & Secure Hashed PIN)
// ============================================================================
exports.respondToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' | 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or rejected.' });
    }

    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const request = await RideRequest.findById(requestId).populate('ride');
    if (!request) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    // Only the driver who owns the ride can respond
    if (request.driver.toString() !== authUser._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized: Only the driver can accept or reject this request.' });
    }

    let generatedPin = null;

    if (status === 'accepted') {
      const ride = await Ride.findById(request.ride._id || request.ride);
      if (!ride) {
        return res.status(404).json({ message: 'Associated ride not found.' });
      }

      // Generate secure 4-digit Boarding PIN
      generatedPin = generatePin();
      const pinHash = await hashPin(generatedPin);
      const pinEncrypted = encryptPin(generatedPin);
      const expiresAt = new Date(Date.now() + 3 * 3600000); // 3 hours validity

      // If this request was for a repeat/past ride or the ride was already completed,
      // create a fresh active ride instance for this repeat commute
      if (ride.status === 'completed' || request.status === 'repeat_requested') {
        const existingActiveRide = await Ride.findOne({
          offeredBy: authUser._id,
          status: { $in: ['active', 'full', 'in_progress'] }
        });
        if (existingActiveRide) {
          return res.status(400).json({
            message: 'You already have an active or ongoing ride. Please complete or cancel it before accepting a new repeat commute.'
          });
        }

        const newDepartureTime = request.requestedDepartureTime || new Date(Date.now() + 30 * 60000);
        const newRide = await Ride.create({
          offeredBy: authUser._id,
          origin: ride.origin,
          originAddress: ride.originAddress,
          destination: ride.destination,
          destAddress: ride.destAddress,
          routePolyline: ride.routePolyline,
          distanceKm: ride.distanceKm,
          ratePerKm: ride.ratePerKm || 2,
          departureTime: newDepartureTime,
          seatsAvailable: 0,
          pricePerSeat: request.calculatedFare || ride.pricePerSeat,
          status: 'full',
          boardingPinHash: pinHash,
          boardingPinEncrypted: pinEncrypted,
          boardingPinExpiresAt: expiresAt,
          pinVerificationAttempts: 0,
          bikeName: ride.bikeName,
          bikeNumber: ride.bikeNumber,
          gender: ride.gender
        });

        request.ride = newRide._id;
      } else {
        // Prevent race conditions: Atomically reserve seat on the ride
        const updatedRide = await Ride.findOneAndUpdate(
          { _id: ride._id, seatsAvailable: { $gt: 0 }, status: 'active' },
          {
            $inc: { seatsAvailable: -1 },
            status: 'full',
            boardingPinHash: pinHash,
            boardingPinEncrypted: pinEncrypted,
            boardingPinExpiresAt: expiresAt,
            pinVerificationAttempts: 0
          },
          { new: true }
        );

        if (!updatedRide) {
          return res.status(400).json({
            message: 'Seat is no longer available. This ride has already been filled.'
          });
        }
      }

      request.boardingPinHash = pinHash;
      request.boardingPinEncrypted = pinEncrypted;
      request.boardingPinExpiresAt = expiresAt;
      request.pinVerificationAttempts = 0;
    }

    request.status = status;
    await request.save();

    const updated = await RideRequest.findById(requestId)
      .populate('requester', 'name college phone usn')
      .populate('driver', 'name college phone')
      .populate('ride');

    const driverId = authUser._id;
    const requesterId = updated.requester?._id || updated.requester;

    // Notify requester about driver's decision
    if (status === 'accepted') {
      // NOTE: Plaintext PIN is NOT sent in push notification or driver response for security.
      // Commuter views it securely in their authenticated dashboard.
      await createNotification({
        recipient: requesterId,
        sender: driverId,
        type: 'RIDE_ACCEPTED',
        title: 'Ride Request Accepted! ✅',
        message: `${authUser.name} accepted your ride request! Your Boarding PIN is ready in My Rides. Commute is confirmed.`,
        rideId: request.ride?._id || request.ride,
        actionUrl: `/track/${request.ride?._id || request.ride}`
      });

      if (global.io) {
        global.io.to(`user_${requesterId}`).emit('requestStatusUpdate', {
          requestId,
          status: 'accepted',
          rideId: request.ride?._id || request.ride
        });
      }
    } else {
      await createNotification({
        recipient: requesterId,
        sender: driverId,
        type: 'RIDE_REJECTED',
        title: 'Ride Request Declined',
        message: `${authUser.name} was unable to accept your ride request at this time.`,
        rideId: request.ride?._id || request.ride,
        actionUrl: '/find-ride'
      });
    }

    const responseObj = updated.toObject();
    delete responseObj.boardingPinHash;
    delete responseObj.boardingPinEncrypted;
    // Driver NEVER receives the plaintext PIN in the response
    delete responseObj.boardingPin;

    res.status(200).json({
      message: `Request has been ${status}!`,
      request: responseObj
    });
  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({ message: 'Error updating request', error: error.message });
  }
};

// ============================================================================
// 6. START RIDE (Driver Enters Commuter's 4-Digit Boarding PIN with Attempt Limits)
// ============================================================================
exports.startRide = async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const { pin } = req.body || {};
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const ride = await Ride.findById(rideId).populate('offeredBy', 'name phone usn');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Only the driver who offered this ride can enter the PIN to start it
    const isDriver = ride.offeredBy._id.toString() === authUser._id.toString();
    if (!isDriver) {
      return res.status(403).json({
        message: 'Unauthorized: Only the driver can enter the commuter boarding PIN to start this ride.'
      });
    }

    if (ride.status === 'in_progress') {
      return res.status(200).json({ message: 'Ride is already in progress.', ride });
    }

    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ message: `Cannot start a ride that is already ${ride.status}.` });
    }

    // Check Attempt Limits (Max 5 attempts)
    if (ride.pinVerificationAttempts >= (ride.maxPinAttempts || 5)) {
      return res.status(403).json({
        message: 'Security Alert: Maximum verification attempts exceeded (5/5). This ride is locked for safety.'
      });
    }

    // Check Expiry
    if (ride.boardingPinExpiresAt && new Date() > new Date(ride.boardingPinExpiresAt)) {
      return res.status(400).json({
        message: 'Boarding PIN has expired. Please re-schedule or contact campus support.'
      });
    }

    if (!pin || pin.toString().trim().length !== 4) {
      return res.status(400).json({
        message: 'Boarding PIN required: Please enter the 4-digit code displayed on your commuter’s screen.'
      });
    }

    const inputPin = pin.toString().trim();

    // Verify entered PIN against bcrypt hash stored in ride or accepted request
    let isPinValid = false;
    if (ride.boardingPinHash) {
      isPinValid = await verifyPin(inputPin, ride.boardingPinHash);
    }

    if (!isPinValid) {
      const acceptedReq = await RideRequest.findOne({ ride: rideId, status: 'accepted' });
      if (acceptedReq && acceptedReq.boardingPinHash) {
        isPinValid = await verifyPin(inputPin, acceptedReq.boardingPinHash);
      }
    }

    if (!isPinValid) {
      ride.pinVerificationAttempts = (ride.pinVerificationAttempts || 0) + 1;
      await ride.save();

      const remaining = Math.max(0, (ride.maxPinAttempts || 5) - ride.pinVerificationAttempts);
      return res.status(400).json({
        message: `Incorrect PIN. Please ask your commuter to verify their 4-digit code (${remaining} attempt${remaining === 1 ? '' : 's'} remaining).`
      });
    }

    // Valid PIN: Transition to IN_PROGRESS and Invalidate the PIN immediately
    ride.status = 'in_progress';
    ride.startedAt = new Date();
    ride.boardingPinHash = null;
    ride.boardingPinEncrypted = null;
    await ride.save();

    await RideRequest.updateMany(
      { ride: rideId, status: 'accepted' },
      {
        $set: {
          boardingPinHash: null,
          boardingPinEncrypted: null
        }
      }
    );

    const acceptedRequests = await RideRequest.find({ ride: rideId, status: 'accepted' })
      .populate('requester', 'name phone usn');

    // Broadcast rideStarted via Socket.io
    if (global.io) {
      global.io.to(`ride_${rideId}`).emit('rideStarted', {
        rideId,
        status: 'in_progress',
        startedAt: ride.startedAt
      });
    }

    // Notify accepted passengers
    for (const reqItem of acceptedRequests) {
      const recipientId = reqItem.requester?._id || reqItem.requester;
      if (recipientId) {
        await createNotification({
          recipient: recipientId,
          sender: authUser._id,
          type: 'RIDE_STARTED',
          title: '🚀 Ride Started!',
          message: `${ride.offeredBy.name} verified your Boarding PIN! Commute to campus is now in progress.`,
          rideId: ride._id,
          actionUrl: `/track/${ride._id}`
        });
      }
    }

    res.status(200).json({
      message: 'PIN verified successfully! Commute started and live GPS is active.',
      ride
    });
  } catch (error) {
    console.error('startRide error:', error);
    res.status(500).json({ message: 'Error starting ride', error: error.message });
  }
};

// ============================================================================
// 7. COMPLETE RIDE (Settlement & Fair Share Breakdown)
// ============================================================================
exports.completeRide = async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const ride = await Ride.findById(rideId).populate('offeredBy', 'name phone usn');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    const acceptedRequests = await RideRequest.find({ ride: rideId, status: 'accepted' })
      .populate('requester', 'name phone usn');

    const isDriver = ride.offeredBy._id.toString() === authUser._id.toString();
    const isPassenger = acceptedRequests.some(r => {
      const reqId = r.requester?._id || r.requester;
      return reqId.toString() === authUser._id.toString();
    });

    if (!isDriver && !isPassenger) {
      return res.status(403).json({ message: 'Only the driver or passenger of this ride can complete it.' });
    }

    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    const primaryRequest = acceptedRequests[0];
    const applicableDist = ride.distanceKm || 8.5;
    const pricing = calculatePricing(applicableDist);
    const totalFare = primaryRequest?.calculatedFare || pricing.studentContribution;
    const durationMins = ride.startedAt
      ? Math.max(1, Math.round((ride.completedAt - new Date(ride.startedAt)) / 60000))
      : Math.max(5, Math.ceil(applicableDist * 2.2));

    const settlementPayload = {
      rideId,
      status: 'completed',
      completedAt: ride.completedAt,
      completedBy: isPassenger ? 'passenger' : 'driver',
      totalFare,
      distanceKm: applicableDist,
      durationMins,
      driverName: ride.offeredBy?.name || 'Driver',
      driverPhone: ride.offeredBy?.phone || '',
      passengerName: primaryRequest?.requester?.name || 'Fellow Student',
      paymentMode: 'Cash / Direct UPI Settlement'
    };

    if (global.io) {
      global.io.to(`ride_${rideId}`).emit('rideCompleted', settlementPayload);
      global.io.to(`ride_${rideId}`).emit('rideStatusUpdate', {
        rideId,
        status: 'completed'
      });
    }

    for (const reqItem of acceptedRequests) {
      const recipientId = reqItem.requester?._id || reqItem.requester;
      if (recipientId) {
        await createNotification({
          recipient: recipientId,
          sender: ride.offeredBy._id,
          type: 'RIDE_COMPLETED',
          title: '🎉 Arrived Safely at Destination!',
          message: `Your ride with ${ride.offeredBy.name} is complete. Total Fare: ₹${totalFare} (Direct Cash/UPI).`,
          rideId: ride._id,
          actionUrl: `/track/${ride._id}`
        });
      }
    }

    if (isPassenger) {
      await createNotification({
        recipient: ride.offeredBy._id,
        sender: authUser._id,
        type: 'RIDE_COMPLETED',
        title: '🏁 Passenger Ended Ride',
        message: `${primaryRequest?.requester?.name || 'Passenger'} marked ride as completed. Total Fare to collect: ₹${totalFare}.`,
        rideId: ride._id,
        actionUrl: `/track/${ride._id}`
      });
    }

    res.status(200).json({
      message: 'Ride completed successfully!',
      settlement: settlementPayload,
      ride
    });
  } catch (error) {
    console.error('completeRide error:', error);
    res.status(500).json({ message: 'Error completing ride', error: error.message });
  }
};

// ============================================================================
// 8. OSRM Free Open-Source Turn-by-Turn Road Routing API Endpoint
// ============================================================================
exports.getOsrmRoute = async (req, res) => {
  try {
    const { originLng, originLat, destLng, destLat, waypointLng, waypointLat } = req.query;

    if (!originLng || !originLat || !destLng || !destLat) {
      return res.status(400).json({ message: 'Missing coordinates: originLng, originLat, destLng, destLat are required.' });
    }

    const waypoints = [
      [parseFloat(originLng), parseFloat(originLat)]
    ];

    if (waypointLng && waypointLat) {
      waypoints.push([parseFloat(waypointLng), parseFloat(waypointLat)]);
    }

    waypoints.push([parseFloat(destLng), parseFloat(destLat)]);

    const result = await getOsrmRoute(waypoints);
    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: result.message || 'Routing service unavailable'
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('getOsrmRoute error:', error);
    res.status(500).json({ message: 'Routing error', error: error.message });
  }
};

// ============================================================================
// 9. RE-BOOK A PAST RIDE & OPEN DIRECT CHAT
// ============================================================================
exports.rebookRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const { previousRideId, requestedDepartureTime, note } = req.body;
    if (!previousRideId) {
      return res.status(400).json({ message: 'Previous ride identifier is required for re-booking' });
    }

    let prevRide = await Ride.findById(previousRideId).populate('offeredBy');
    if (!prevRide) {
      // In case previousRideId was actually a RideRequest ID
      const reqDoc = await RideRequest.findById(previousRideId).populate({
        path: 'ride',
        populate: { path: 'offeredBy' }
      });
      if (reqDoc?.ride) {
        prevRide = reqDoc.ride;
      }
    }
    if (!prevRide) return res.status(404).json({ message: 'Past ride not found' });

    const driver = prevRide.offeredBy;
    if (!driver) return res.status(404).json({ message: 'Driver for this ride not found' });

    if (driver._id.toString() === authUser._id.toString()) {
      return res.status(400).json({ message: 'Cannot re-book your own ride' });
    }

    // Gender-safety check on re-book (Faculty bypasses cross-gender restriction)
    const isCommuterFaculty = authUser.role === 'faculty' || authUser.userType === 'faculty';
    const isDriverFaculty = driver.role === 'faculty' || driver.userType === 'faculty';
    if (!isCommuterFaculty && !isDriverFaculty && (authUser.gender || 'male') !== (driver.gender || 'male')) {
      return res.status(403).json({
        message: 'Campus Safety Policy: Re-booking across different genders is prohibited.'
      });
    }

    const depDate = requestedDepartureTime ? new Date(requestedDepartureTime) : new Date(Date.now() + 60 * 60000);

    // Create a repeat booking request
    const repeatRequest = await RideRequest.create({
      ride: prevRide._id,
      requester: authUser._id,
      passenger: authUser._id,
      driver: driver._id,
      status: 'repeat_requested',
      pickupAddress: prevRide.originAddress,
      distanceKm: prevRide.distanceKm,
      calculatedFare: prevRide.pricePerSeat,
      note: note || '',
      requestedDepartureTime: depDate
    });

    const conversationId = repeatRequest._id.toString();
    const initialText = `👋 Hi ${driver.name}, I'd like to re-book our commute on ${prevRide.originAddress} ➔ ${prevRide.destAddress}! ${note ? `Note: "${note}"` : ''}`;

    await Message.create({
      ride: prevRide._id,
      conversationId,
      sender: authUser._id,
      senderName: authUser.name,
      receiver: driver._id,
      content: initialText,
      sentAt: new Date()
    });

    await createNotification({
      recipient: driver._id,
      sender: authUser._id,
      type: 'RIDE_REQUEST',
      title: '🔄 Repeat Commute Request!',
      message: `${authUser.name} wants to ride with you again on ${prevRide.originAddress} ➔ ${prevRide.destAddress}. Check your chat & My Rides to coordinate.`,
      actionUrl: '/rides'
    });

    if (global.io) {
      global.io.to(`user_${driver._id}`).emit('newRideRequest', {
        request: repeatRequest
      });
    }

    res.status(201).json({
      success: true,
      message: `Repeat commute request sent to ${driver.name}! Chat thread is connected.`,
      request: repeatRequest,
      conversationId
    });
  } catch (err) {
    console.error('rebookRide error:', err);
    res.status(500).json({ message: err.message || 'Failed to re-book ride', error: err.message });
  }
};

// ============================================================================
// 10. CANCEL RIDE (Driver)
// ============================================================================
exports.cancelRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    if (ride.offeredBy.toString() !== authUser._id.toString()) {
      return res.status(403).json({ message: 'Only the driver can cancel this ride' });
    }

    if (ride.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel an already completed ride' });
    }

    ride.status = 'cancelled';
    await ride.save();

    const affectedRequests = await RideRequest.find({
      ride: ride._id,
      status: { $in: ['pending', 'accepted', 'repeat_requested'] }
    }).populate('requester');

    for (const reqItem of affectedRequests) {
      reqItem.status = 'cancelled';
      await reqItem.save();
      if (reqItem.requester) {
        await createNotification({
          recipient: reqItem.requester._id,
          sender: authUser._id,
          type: 'RIDE_UPDATE',
          title: '🚫 Ride Cancelled by Driver',
          message: `${authUser.name} cancelled today's scheduled ride (${ride.originAddress} ➔ ${ride.destAddress}). The seat has been released.`,
          actionUrl: '/find-ride'
        });
      }
    }

    if (global.io) {
      global.io.to(`ride_${ride._id}`).emit('rideStatusUpdate', { rideId: ride._id, status: 'cancelled' });
    }

    res.status(200).json({ success: true, message: 'Ride cancelled successfully', ride });
  } catch (err) {
    console.error('cancelRide error:', err);
    res.status(500).json({ message: 'Failed to cancel ride', error: err.message });
  }
};

// ============================================================================
// 11. CANCEL REQUEST (Commuter)
// ============================================================================
exports.cancelRequest = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const request = await RideRequest.findById(req.params.requestId).populate('ride').populate('driver');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.requester.toString() !== authUser._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to cancel this request' });
    }

    const wasAccepted = request.status === 'accepted';
    request.status = 'cancelled';
    await request.save();

    if (wasAccepted && request.ride) {
      await Ride.findByIdAndUpdate(request.ride._id, {
        $inc: { seatsAvailable: 1 },
        status: 'active'
      });
    }

    if (request.driver) {
      await createNotification({
        recipient: request.driver._id,
        sender: authUser._id,
        type: 'RIDE_UPDATE',
        title: 'Seat Request Cancelled',
        message: `${authUser.name} cancelled their seat request. Your seat is now available for other students.`,
        actionUrl: '/rides'
      });
    }

    res.status(200).json({ success: true, message: 'Request cancelled successfully', request });
  } catch (err) {
    console.error('cancelRequest error:', err);
    res.status(500).json({ message: 'Failed to cancel request', error: err.message });
  }
};

// ============================================================================
// 12. CHECK ACTIVE COMMUTE STATUS
// ============================================================================
exports.getActiveCommuteStatus = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const activeOfferedRide = await Ride.findOne({
      offeredBy: authUser._id,
      status: { $in: ['active', 'full', 'in_progress'] }
    }).populate('offeredBy', 'name phone');

    const activeBookingRequest = await RideRequest.findOne({
      requester: authUser._id,
      status: { $in: ['pending', 'accepted', 'repeat_requested'] }
    }).populate({
      path: 'ride',
      match: { status: { $in: ['active', 'full', 'in_progress'] } }
    }).populate('driver', 'name phone');

    res.status(200).json({
      hasActiveOfferedRide: !!activeOfferedRide,
      activeOfferedRide,
      hasActiveBookingRequest: !!(activeBookingRequest && activeBookingRequest.ride),
      activeBookingRequest: activeBookingRequest?.ride ? activeBookingRequest : null
    });
  } catch (err) {
    console.error('getActiveCommuteStatus error:', err);
    res.status(500).json({ message: 'Error checking commute status', error: err.message });
  }
};

// ============================================================================
// 13. DELETE RIDE (Driver)
// ============================================================================
exports.deleteRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    if (ride.offeredBy.toString() !== authUser._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to delete this ride' });
    }

    await RideRequest.deleteMany({ ride: ride._id });
    await Ride.findByIdAndDelete(ride._id);

    res.status(200).json({ success: true, message: 'Ride deleted successfully' });
  } catch (err) {
    console.error('deleteRide error:', err);
    res.status(500).json({ message: 'Failed to delete ride', error: err.message });
  }
};

// ============================================================================
// 14. DELETE REQUEST (Commuter)
// ============================================================================
exports.deleteRequest = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const request = await RideRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.requester.toString() !== authUser._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to delete this request' });
    }

    await RideRequest.findByIdAndDelete(request._id);
    res.status(200).json({ success: true, message: 'Request removed successfully' });
  } catch (err) {
    console.error('deleteRequest error:', err);
    res.status(500).json({ message: 'Failed to delete request', error: err.message });
  }
};

// ============================================================================
// 15. CLEAR ALL OFFERED RIDES (Driver)
// ============================================================================
exports.clearAllOfferedRides = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    const userRides = await Ride.find({ offeredBy: authUser._id });
    const rideIds = userRides.map(r => r._id);

    await RideRequest.deleteMany({ ride: { $in: rideIds } });
    await Ride.deleteMany({ offeredBy: authUser._id });

    res.status(200).json({ success: true, message: 'All offered rides cleared successfully' });
  } catch (err) {
    console.error('clearAllOfferedRides error:', err);
    res.status(500).json({ message: 'Failed to clear offered rides', error: err.message });
  }
};

// ============================================================================
// 16. CLEAR ALL REQUESTS (Commuter)
// ============================================================================
exports.clearAllRequests = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: 'Authentication required' });

    await RideRequest.deleteMany({ requester: authUser._id });
    res.status(200).json({ success: true, message: 'All requests cleared successfully' });
  } catch (err) {
    console.error('clearAllRequests error:', err);
    res.status(500).json({ message: 'Failed to clear requests', error: err.message });
  }
};

// ============================================================================
// 17. PUBLIC TELEMETRY SUMMARY
// ============================================================================
exports.getPublicRideSummary = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: { $ne: 'admin' } });
    const verifiedStudents = await User.countDocuments({ role: { $ne: 'admin' }, verificationStatus: 'verified' });
    const activeRidesCount = await Ride.countDocuments({ status: 'active' });
    const totalRidesCount = await Ride.countDocuments();

    const latestRide = await Ride.findOne({ status: 'active' })
      .populate('offeredBy', 'name college department usn gender')
      .sort({ createdAt: -1 });

    const vehiclesSaved = Math.max(0, totalRidesCount);
    const co2SavedKg = (vehiclesSaved * 0.84).toFixed(1);
    const fuelConservedL = (vehiclesSaved * 0.42).toFixed(1);

    res.status(200).json({
      success: true,
      totalStudents,
      verifiedStudents,
      activeRidesCount,
      totalRidesCount,
      co2SavedKg,
      fuelConservedL,
      latestRide: latestRide ? {
        id: latestRide._id,
        driverName: latestRide.offeredBy?.name || 'Student Driver',
        driverUsn: latestRide.offeredBy?.usn || '',
        driverDept: latestRide.offeredBy?.department || 'Engineering',
        driverGender: latestRide.offeredBy?.gender || 'male',
        originAddress: latestRide.originAddress,
        destAddress: latestRide.destAddress,
        departureTime: latestRide.departureTime,
        pricePerSeat: latestRide.pricePerSeat || 15,
        seatsAvailable: latestRide.seatsAvailable || 1,
        vehicleType: latestRide.vehicleType || 'Motorcycle'
      } : null
    });
  } catch (error) {
    console.error('getPublicRideSummary error:', error);
    res.status(500).json({ message: 'Summary error', error: error.message });
  }
};
