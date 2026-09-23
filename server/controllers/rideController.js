const Ride = require('../models/Ride');
const RideRequest = require('../models/RideRequest');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const https = require('https');

// Helper to extract authenticated user from header
const getAuthUser = async (req) => {
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

// 1. Find rides using geospatial queries (Strict gender matching: girls <-> girls, boys <-> boys)
exports.findRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required. Please log into your account before searching for or finding rides.' });
    }

    const userGender = authUser.gender || 'male';
    const { originLng, originLat, destLng, destLat } = req.query;

    // Strict gender filtering: female students only see female rides, male students only see male rides
    let query = { 
      status: "active", 
      seatsAvailable: { $gt: 0 },
      gender: userGender
    };

    if (originLng && originLat) {
      query.origin = {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(originLng), parseFloat(originLat)] },
          $maxDistance: 25000 // 25km radius covers whole city & suburbs
        }
      };
    }

    let matches = await Ride.find(query).populate('offeredBy', 'name college phone gender');

    // If no exact geo matches, return recent active rides of the same gender
    if (matches.length === 0) {
      matches = await Ride.find({ status: "active", seatsAvailable: { $gt: 0 }, gender: userGender })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('offeredBy', 'name college phone gender');
    }

    res.status(200).json(matches);
  } catch (error) {
    console.error('Find rides error:', error);
    res.status(500).json({ message: 'Error finding rides', error: error.message });
  }
};


// 1b. Get single ride by ID
exports.getRideById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate('offeredBy', 'name college phone usn');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    res.status(200).json(ride);
  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({ message: 'Error fetching ride details', error: error.message });
  }
};

// Haversine distance calculator in KM (approximate road distance = straight line * 1.25)
const calculateDistanceKm = (coords1, coords2) => {
  if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) return 8.5;
  const lon1 = coords1[0], lat1 = coords1[1];
  const lon2 = coords2[0], lat2 = coords2[1];
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straight = R * c;
  return parseFloat((straight * 1.25).toFixed(1));
};

const RATE_PER_KM = 2.0; // ₹2/KM campus fuel-share rate

// 2. Offer a ride
exports.offerRide = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required. Please log into your account before offering a ride.' });
    }
    const userId = authUser._id;
    const userGender = authUser.gender || 'male';

    const { originCoords, destCoords, originAddress, destAddress, routePolyline, departureTime, seatsAvailable, pricePerSeat, distanceKm } = req.body;

    const oCoords = originCoords || [76.9214, 15.1394];
    const dCoords = destCoords || [76.8506, 15.1677]; // BITM Campus
    const calculatedDist = distanceKm || calculateDistanceKm(oCoords, dCoords);
    // Fair-share price: ₹2 / KM, minimum base fare ₹10
    const calculatedPrice = pricePerSeat || Math.max(10, Math.round(calculatedDist * RATE_PER_KM));

    const newRide = await Ride.create({
      offeredBy: userId,
      gender: userGender,
      ride_id: 'RIDE-' + Date.now().toString().slice(-6),
      origin: { 
        type: "Point", 
        coordinates: oCoords 
      },
      originAddress: originAddress || 'Pickup Point',
      destination: { 
        type: "Point", 
        coordinates: dCoords 
      },
      destAddress: destAddress || 'Ballari Institute of Technology and Management, Ballari',
      routePolyline,
      distanceKm: calculatedDist,
      ratePerKm: RATE_PER_KM,
      departureTime: departureTime || new Date(Date.now() + 30 * 60000),
      seatsAvailable: seatsAvailable || 1,
      pricePerSeat: calculatedPrice,
      status: "active"
    });

    const populated = await Ride.findById(newRide._id).populate('offeredBy', 'name college phone gender');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Offer ride error:', error);
    res.status(500).json({ message: 'Error offering ride', error: error.message });
  }
};

// 3. Request a ride (Rider requests to join)
exports.requestRide = async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required. Please log in before requesting or joining a ride.' });
    }
    const requesterId = authUser._id;
    const requesterGender = authUser.gender || 'male';

    const ride = await Ride.findById(rideId).populate('offeredBy');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const driverGender = ride.gender || (ride.offeredBy && ride.offeredBy.gender) || 'male';

    // Strict gender-safety validation: girls <-> girls, boys <-> boys
    if (requesterGender !== driverGender) {
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

    // Check if request already exists
    let existingRequest = await RideRequest.findOne({ ride: rideId, requester: requesterId });
    if (existingRequest) {
      return res.status(200).json({ 
        message: 'Request already submitted and currently ' + existingRequest.status,
        request: existingRequest
      });
    }

    const { pickupCoords, pickupAddress, distanceKm: reqDist } = req.body || {};

    // Calculate rider-to-requester and requester-to-college distance
    const driverCoords = ride.origin?.coordinates || [76.9214, 15.1394];
    const userPickupCoords = pickupCoords || driverCoords;
    const collegeCoords = ride.destination?.coordinates || [76.8506, 15.1677];

    // Detour distance from driver to requester
    const detourDist = calculateDistanceKm(driverCoords, userPickupCoords);
    // Distance from requester to college
    const commuteDist = calculateDistanceKm(userPickupCoords, collegeCoords);
    const totalDist = reqDist || parseFloat((detourDist + commuteDist).toFixed(1));

    // Fare calculated strictly on ₹2 / KM basis (minimum ₹10 base fuel share)
    const fare = Math.max(10, Math.round(totalDist * RATE_PER_KM));

    const newRequest = await RideRequest.create({
      ride: rideId,
      requester: requesterId,
      driver: ride.offeredBy._id,
      pickupAddress: pickupAddress || ride.originAddress,
      distanceKm: totalDist,
      calculatedFare: fare,
      status: 'pending'
    });

    const populatedRequest = await RideRequest.findById(newRequest._id)
      .populate('requester', 'name college phone usn')
      .populate('ride', 'originAddress destAddress departureTime pricePerSeat distanceKm ratePerKm')
      .populate('driver', 'name college phone');

    console.log(`\n🔔 [NEW RIDE REQUEST]`);
    console.log(`👤 Requester : ${populatedRequest.requester?.name} (${populatedRequest.requester?.phone})`);
    console.log(`🏍️ Driver    : ${populatedRequest.driver?.name}`);
    console.log(`📍 Route     : ${populatedRequest.ride?.originAddress} -> ${populatedRequest.ride?.destAddress}`);
    console.log(`📏 Distance  : ${totalDist} km @ ₹${RATE_PER_KM}/km -> Fare: ₹${fare}\n`);

    res.status(201).json({ 
      message: `Request sent! Subsidized fare: ₹${fare} (${totalDist} km @ ₹2/km)`, 
      request: populatedRequest,
      fare,
      ride
    });
  } catch (error) {
    console.error('Request ride error:', error);
    res.status(500).json({ message: 'Error submitting ride request', error: error.message });
  }
};

// 4. Get My Requests (both incoming as driver & outgoing as rider)
exports.getMyRequests = async (req, res) => {
  try {
    const authUser = req.user || await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required. Please log into your account to view your rides.' });
    }
    const userId = authUser._id;

    const incoming = await RideRequest.find({ driver: userId })
      .populate('requester', 'name college phone usn')
      .populate('ride', 'originAddress destAddress departureTime seatsAvailable pricePerSeat distanceKm ratePerKm')
      .sort({ createdAt: -1 });

    const outgoing = await RideRequest.find({ requester: userId })
      .populate('driver', 'name college phone')
      .populate('ride', 'originAddress destAddress departureTime seatsAvailable pricePerSeat distanceKm ratePerKm')
      .sort({ createdAt: -1 });

    res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
};

// 5. Driver responds to request (accept or reject)
exports.respondToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' | 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or rejected.' });
    }

    const request = await RideRequest.findById(requestId).populate('ride');
    if (!request) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    request.status = status;
    await request.save();

    // If accepted, decrement available seats on the ride
    if (status === 'accepted' && request.ride) {
      const ride = await Ride.findById(request.ride._id);
      if (ride) {
        ride.seatsAvailable = Math.max(0, ride.seatsAvailable - (request.seatsRequested || 1));
        if (ride.seatsAvailable === 0) {
          ride.status = 'full';
        }
        await ride.save();
      }
    }

    const updated = await RideRequest.findById(requestId)
      .populate('requester', 'name college phone usn')
      .populate('driver', 'name college phone')
      .populate('ride');

    console.log(`\n✅ [RIDE REQUEST ${status.toUpperCase()}] Request #${requestId} is now ${status}\n`);

    res.status(200).json({ message: `Request has been ${status}!`, request: updated });
  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({ message: 'Error updating request', error: error.message });
  }
};

// 6. OSRM Free Open-Source Turn-by-Turn Road Routing
exports.getOsrmRoute = async (req, res) => {
  try {
    const { originLng, originLat, destLng, destLat, waypointLng, waypointLat } = req.query;

    if (!originLng || !originLat || !destLng || !destLat) {
      return res.status(400).json({ message: 'Missing coordinates: originLng, originLat, destLng, destLat are required.' });
    }

    let coordsString = `${originLng},${originLat}`;
    if (waypointLng && waypointLat) {
      coordsString += `;${waypointLng},${waypointLat}`;
    }
    coordsString += `;${destLng},${destLat}`;

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

    const fetchOsrm = () => {
      return new Promise((resolve, reject) => {
        const request = https.get(
          osrmUrl,
          {
            headers: {
              'User-Agent': 'BikeMate-App/1.0',
              'Accept': 'application/json'
            },
            timeout: 7000
          },
          (response) => {
            let data = '';
            response.on('data', (chunk) => (data += chunk));
            response.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed);
              } catch (e) {
                reject(new Error('Invalid JSON from OSRM'));
              }
            });
          }
        );

        request.on('error', (err) => reject(err));
        request.on('timeout', () => {
          request.destroy();
          reject(new Error('OSRM request timed out'));
        });
      });
    };

    try {
      const osrmData = await fetchOsrm();
      if (osrmData && osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const coordinates = (route.geometry?.coordinates || []).map((coord) => ({
          lat: coord[1],
          lng: coord[0]
        }));
        const distanceKm = parseFloat((route.distance / 1000).toFixed(2));
        const durationMins = Math.ceil(route.duration / 60);

        return res.status(200).json({
          success: true,
          provider: 'OSRM',
          distanceKm,
          durationMins,
          coordinates,
          rawGeoJson: route.geometry
        });
      }
    } catch (osrmErr) {
      console.warn('OSRM live call failed, falling back to simulated road path:', osrmErr.message);
    }

    // High quality road fallback interpolation
    const start = { lat: parseFloat(originLat), lng: parseFloat(originLng) };
    const end = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
    const points = [];
    const steps = 25;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curve = Math.sin(t * Math.PI) * 0.0035;
      points.push({
        lat: start.lat + (end.lat - start.lat) * t + curve,
        lng: start.lng + (end.lng - start.lng) * t
      });
    }

    const dist = calculateDistanceKm([start.lng, start.lat], [end.lng, end.lat]);
    res.status(200).json({
      success: true,
      provider: 'OSRM_FALLBACK',
      distanceKm: dist,
      durationMins: Math.ceil(dist * 2.2),
      coordinates: points
    });
  } catch (error) {
    console.error('getOsrmRoute error:', error);
    res.status(500).json({ message: 'Routing error', error: error.message });
  }
};

// 8. Public Telemetry & Summary for Landing Page (Real-Time)
exports.getPublicRideSummary = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: { $ne: 'admin' } });
    const verifiedStudents = await User.countDocuments({ role: { $ne: 'admin' }, verificationStatus: 'verified' });
    const activeRidesCount = await Ride.countDocuments({ status: 'active' });
    const totalRidesCount = await Ride.countDocuments();

    // Query most recent active ride from database for the hero card preview
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
