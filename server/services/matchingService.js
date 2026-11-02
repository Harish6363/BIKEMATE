const {
  haversineDistanceMeters,
  analyzeRouteDetour,
  getOsrmRoute
} = require('./osrmService');

// Configurable Matching Parameters via Environment Variables
const CONFIG = {
  MAX_ADDITIONAL_DISTANCE_METERS: parseInt(process.env.MAX_ADDITIONAL_DISTANCE_METERS || '750', 10),
  CORRIDOR_THRESHOLD_METERS: parseInt(process.env.CORRIDOR_THRESHOLD_METERS || '750', 10),
  DIRECT_MATCH_RADIUS_METERS: parseInt(process.env.DIRECT_MATCH_RADIUS_METERS || '1200', 10),
  NEARBY_CAMPUS_RADIUS_METERS: parseInt(process.env.NEARBY_CAMPUS_RADIUS_METERS || '2500', 10),
  COSINE_SIMILARITY_THRESHOLD: parseFloat(process.env.COSINE_SIMILARITY_THRESHOLD || '0.35'),
  RATE_PER_KM: parseFloat(process.env.RATE_PER_KM || '2.00'),
  MIN_FARE: parseFloat(process.env.MIN_FARE || '10.00'),
  AUTO_RATE_PER_KM: parseFloat(process.env.AUTO_RATE_PER_KM || '14.00'),
  MAX_CANDIDATES: parseInt(process.env.MAX_CANDIDATES || '50', 10)
};

/**
 * Directional alignment using Cosine Similarity between commuter and driver vectors
 */
const calculateCosineSimilarity = (commuterVector, driverVector) => {
  const dot = commuterVector[0] * driverVector[0] + commuterVector[1] * driverVector[1];
  const commuterNorm = Math.hypot(commuterVector[0], commuterVector[1]) || 0.00001;
  const driverNorm = Math.hypot(driverVector[0], driverVector[1]) || 0.00001;
  return dot / (commuterNorm * driverNorm);
};

/**
 * Calculate Fair-Share Pricing and Comparison with Commercial Auto-Rickshaw
 */
const calculatePricing = (distanceKm) => {
  const applicableDist = Math.max(0.5, distanceKm || 8.5);
  const studentContribution = parseFloat(Math.max(CONFIG.MIN_FARE, applicableDist * CONFIG.RATE_PER_KM).toFixed(2));
  const estimatedAutoFare = parseFloat((applicableDist * CONFIG.AUTO_RATE_PER_KM).toFixed(2));
  const estimatedSavings = parseFloat(Math.max(0, estimatedAutoFare - studentContribution).toFixed(2));

  return {
    applicableDistanceKm: parseFloat(applicableDist.toFixed(2)),
    studentContribution,
    estimatedAutoFare,
    estimatedSavings,
    ratePerKm: CONFIG.RATE_PER_KM,
    autoRatePerKm: CONFIG.AUTO_RATE_PER_KM
  };
};

/**
 * Intelligent OSRM Ride Matching Engine
 *
 * @param {Object} authUser - Verified commuter database user record
 * @param {Array<Object>} candidateRides - Active database rides passing preliminary filter
 * @param {[number, number]} commuterPickup - [lon, lat]
 * @param {[number, number]} commuterDropoff - [lon, lat]
 * @returns {Promise<Array<Object>>} Ranked, scored, and classified matching rides
 */
const matchRides = async (authUser, candidateRides, commuterPickup, commuterDropoff) => {
  const matches = [];

  const commuterVector = [
    commuterDropoff[0] - commuterPickup[0],
    commuterDropoff[1] - commuterPickup[1]
  ];

  for (const ride of candidateRides) {
    const driverOrigin = ride.origin?.coordinates || [76.9214, 15.1394];
    const driverDest = ride.destination?.coordinates || [76.8506, 15.1677];

    // Stage B: Directional Alignment Filter
    const driverVector = [
      driverDest[0] - driverOrigin[0],
      driverDest[1] - driverOrigin[1]
    ];
    const cosSimilarity = calculateCosineSimilarity(commuterVector, driverVector);

    // Discard journeys heading in the opposite direction
    if (cosSimilarity < CONFIG.COSINE_SIMILARITY_THRESHOLD) {
      continue;
    }

    // Direct endpoint distance checks
    const distPickupToDriverOrigin = haversineDistanceMeters(
      commuterPickup[0], commuterPickup[1],
      driverOrigin[0], driverOrigin[1]
    );
    const distDropoffToDriverDest = haversineDistanceMeters(
      commuterDropoff[0], commuterDropoff[1],
      driverDest[0], driverDest[1]
    );

    // Stage C: Real OSRM Road Route Detour Analysis
    const detourAnalysis = await analyzeRouteDetour(
      driverOrigin,
      driverDest,
      commuterPickup,
      commuterDropoff
    );

    // If OSRM is temporarily unavailable or returns no route, do not treat straight-line as road distance
    if (!detourAnalysis.success) {
      continue;
    }

    const {
      origDistanceKm,
      origDurationMins,
      modDistanceKm,
      modDurationMins,
      additionalDistanceMeters,
      pickupDistanceToRouteMeters,
      dropoffDistanceToRouteMeters,
      isOrdered,
      dropoffProgressFraction,
      sharedDistanceKm
    } = detourAnalysis;

    // Reject candidates that violate chronological order (pickup after dropoff)
    if (!isOrdered) {
      continue;
    }

    // Stage D: Match Classification (Strict, Non-overlapping, Priority Order)
    let classification = null;
    let confidence = 'high';
    let explanation = '';
    let matchScore = 0;

    // 1. Tier 1: DIRECT_MATCH
    if (
      distPickupToDriverOrigin <= CONFIG.DIRECT_MATCH_RADIUS_METERS &&
      distDropoffToDriverDest <= CONFIG.DIRECT_MATCH_RADIUS_METERS &&
      additionalDistanceMeters <= CONFIG.DIRECT_MATCH_RADIUS_METERS
    ) {
      classification = 'DIRECT_MATCH';
      confidence = 'high';
      matchScore = Math.min(99, Math.round(95 + (1 - additionalDistanceMeters / CONFIG.DIRECT_MATCH_RADIUS_METERS) * 4));
      explanation = `Starts ${distPickupToDriverOrigin}m from you and shares the direct road route with only ${additionalDistanceMeters}m detour.`;
    }
    // 2. Tier 2: EN_ROUTE_DROP_OFF
    else if (
      (distPickupToDriverOrigin <= 1500 || pickupDistanceToRouteMeters <= CONFIG.CORRIDOR_THRESHOLD_METERS) &&
      dropoffDistanceToRouteMeters <= CONFIG.CORRIDOR_THRESHOLD_METERS &&
      dropoffProgressFraction < 0.95 &&
      additionalDistanceMeters <= CONFIG.MAX_ADDITIONAL_DISTANCE_METERS
    ) {
      classification = 'EN_ROUTE_DROP_OFF';
      confidence = 'high';
      matchScore = Math.min(92, Math.round(85 + (1 - additionalDistanceMeters / CONFIG.MAX_ADDITIONAL_DISTANCE_METERS) * 7));
      explanation = `Driver is passing your location and drops you off along their active campus route with ${additionalDistanceMeters}m detour.`;
    }
    // 3. Tier 3: DETOUR_CORRIDOR
    else if (
      pickupDistanceToRouteMeters <= CONFIG.CORRIDOR_THRESHOLD_METERS &&
      dropoffDistanceToRouteMeters <= CONFIG.CORRIDOR_THRESHOLD_METERS &&
      additionalDistanceMeters <= CONFIG.MAX_ADDITIONAL_DISTANCE_METERS
    ) {
      classification = 'DETOUR_CORRIDOR';
      confidence = 'high';
      matchScore = Math.min(84, Math.round(75 + (1 - additionalDistanceMeters / CONFIG.MAX_ADDITIONAL_DISTANCE_METERS) * 9));
      explanation = `Pickup is ${pickupDistanceToRouteMeters}m from the driver's road corridor with a ${additionalDistanceMeters}m extra driving distance.`;
    }
    // 4. Tier 4: CORRIDOR_NEARBY (Fallback for nearby journeys within 2.5 km)
    else if (
      (pickupDistanceToRouteMeters <= CONFIG.NEARBY_CAMPUS_RADIUS_METERS || distPickupToDriverOrigin <= CONFIG.NEARBY_CAMPUS_RADIUS_METERS) &&
      distDropoffToDriverDest <= CONFIG.NEARBY_CAMPUS_RADIUS_METERS &&
      cosSimilarity >= CONFIG.COSINE_SIMILARITY_THRESHOLD
    ) {
      classification = 'CORRIDOR_NEARBY';
      confidence = 'low';
      matchScore = Math.min(74, Math.round(60 + (cosSimilarity - 0.35) * 20));
      explanation = `Nearby campus driver traveling toward BITM; requires a flexible pickup meeting point (~${Math.round(pickupDistanceToRouteMeters)}m away).`;
    }

    // If candidate does not meet any classification tier, reject it
    if (!classification) {
      continue;
    }

    // Calculate Fair-Share Pricing
    const pricing = calculatePricing(sharedDistanceKm);

    const matchEntry = {
      ...ride.toObject(),
      matchType: classification,
      confidence,
      matchScore,
      matchExplanation: explanation,
      // OSRM Road Metrics
      origDistanceKm,
      origDurationMins,
      modDistanceKm,
      modDurationMins,
      additionalDistanceMeters,
      pickupDetourMeters: pickupDistanceToRouteMeters,
      dropoffDetourMeters: dropoffDistanceToRouteMeters,
      detourMeters: additionalDistanceMeters,
      sharedDistanceKm: pricing.applicableDistanceKm,
      // Pricing
      calculatedFare: pricing.studentContribution,
      studentContribution: pricing.studentContribution,
      estimatedAutoFare: pricing.estimatedAutoFare,
      savingsVsAuto: pricing.estimatedSavings,
      ratePerKm: pricing.ratePerKm,
      // Geometry & Coordinates
      riderPickupCoords: commuterPickup,
      riderDestCoords: commuterDropoff,
      driverOriginCoords: driverOrigin,
      driverDestCoords: driverDest,
      cosSimilarity: parseFloat(cosSimilarity.toFixed(2))
    };

    matches.push(matchEntry);
  }

  // Stage E: Deterministic Ranking
  const typeRank = {
    DIRECT_MATCH: 1,
    EN_ROUTE_DROP_OFF: 2,
    DETOUR_CORRIDOR: 3,
    CORRIDOR_NEARBY: 4
  };

  matches.sort((a, b) => {
    // 1. Priority Category Rank
    const rankA = typeRank[a.matchType] || 10;
    const rankB = typeRank[b.matchType] || 10;
    if (rankA !== rankB) return rankA - rankB;

    // 2. Lowest Additional Road Distance
    if (Math.abs(a.additionalDistanceMeters - b.additionalDistanceMeters) > 30) {
      return a.additionalDistanceMeters - b.additionalDistanceMeters;
    }

    // 3. Lowest Pickup Detour
    if (Math.abs(a.pickupDetourMeters - b.pickupDetourMeters) > 30) {
      return a.pickupDetourMeters - b.pickupDetourMeters;
    }

    // 4. Match Score Descending
    return b.matchScore - a.matchScore;
  });

  return matches;
};

module.exports = {
  CONFIG,
  calculateCosineSimilarity,
  calculatePricing,
  matchRides
};
