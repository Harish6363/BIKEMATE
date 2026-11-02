const axios = require('axios');

// Configurable OSRM Base URL (defaults to public demo server; override in .env for production)
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = parseInt(process.env.OSRM_TIMEOUT_MS || '7000', 10);

// In-Memory Route Cache with TTL to reduce network latency & respect rate limits
const routeCache = new Map();
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes

const getCacheKey = (coordinates, overview) => {
  return `${overview}:${coordinates.map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';')}`;
};

/**
 * Clean up expired cache items periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of routeCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      routeCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Validates coordinate array [longitude, latitude]
 */
const isValidCoord = (coord) => {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number' &&
    !isNaN(coord[0]) &&
    !isNaN(coord[1]) &&
    coord[0] >= -180 &&
    coord[0] <= 180 &&
    coord[1] >= -90 &&
    coord[1] <= 90
  );
};

/**
 * Haversine formula for preliminary candidate filtering or backup geospatial comparison
 * Distance returned in meters
 */
const haversineDistanceMeters = (lon1, lat1, lon2, lat2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Call OSRM Route service for exact road routing
 * @param {Array<[number, number]>} coordinates - Array of [longitude, latitude] pairs
 * @param {Object} options - { overview: 'full' | 'simplified' | 'false', geometries: 'geojson' }
 * @returns {Promise<Object>} Route response with actual road distance and duration
 */
const getOsrmRoute = async (coordinates, options = {}) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return {
      success: false,
      code: 'InvalidCoordinates',
      message: 'At least 2 coordinate pairs are required for routing.'
    };
  }

  for (const c of coordinates) {
    if (!isValidCoord(c)) {
      return {
        success: false,
        code: 'InvalidCoordinateValues',
        message: `Invalid coordinate pair: ${JSON.stringify(c)}`
      };
    }
  }

  const overview = options.overview || 'full';
  const geometries = options.geometries || 'geojson';
  const cacheKey = getCacheKey(coordinates, overview);

  const cached = routeCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // Format OSRM coordinate string: lon,lat;lon,lat;...
  const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsString}?overview=${overview}&geometries=${geometries}&steps=false`;

  try {
    const response = await axios.get(url, {
      timeout: OSRM_TIMEOUT_MS,
      headers: {
        'User-Agent': 'BikeMate-Campus-RideShare/2.0',
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    if (!data || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return {
        success: false,
        code: data?.code || 'NoRoute',
        message: data?.message || 'No road route found between these locations.'
      };
    }

    const primaryRoute = data.routes[0];
    const distanceMeters = Math.round(primaryRoute.distance);
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
    const durationSeconds = Math.round(primaryRoute.duration);
    const durationMins = Math.ceil(durationSeconds / 60);
    const routeCoords = primaryRoute.geometry?.coordinates || []; // [[lon, lat], ...]

    const result = {
      success: true,
      provider: 'OSRM',
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationMins,
      geometry: primaryRoute.geometry,
      coordinates: routeCoords, // [[lon, lat], ...]
      waypoints: data.waypoints
    };

    routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    console.warn(`[OSRM Warning] Route failed for ${coordsString}:`, err.message);
    return {
      success: false,
      code: err.code === 'ECONNABORTED' ? 'Timeout' : 'ServiceUnavailable',
      message: `OSRM routing service unavailable: ${err.message}`
    };
  }
};

/**
 * Orthogonal point-to-segment distance and projection parameter t
 * Uses equirectangular projection centered at segment latitude
 */
const pointToSegmentDistanceMeters = (pLon, pLat, aLon, aLat, bLon, bLat) => {
  const midLat = ((aLat + bLat + pLat) / 3) * (Math.PI / 180);
  const kx = 111320 * Math.cos(midLat); // meters per longitude degree
  const ky = 110574;                   // meters per latitude degree

  const ax = aLon * kx, ay = aLat * ky;
  const bx = bLon * kx, by = bLat * ky;
  const px = pLon * kx, py = pLat * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return {
      distanceMeters: Math.hypot(px - ax, py - ay),
      t: 0
    };
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return {
    distanceMeters: Math.hypot(px - projX, py - projY),
    t: t
  };
};

/**
 * Point-to-Route calculation: calculates perpendicular lateral distance from point to OSRM road polyline
 * and finds the relative progress index [0, 1] along the route.
 * @param {[number, number]} point - [lon, lat]
 * @param {Array<[number, number]>} polyline - Array of [lon, lat] road coordinates
 * @returns {{ distanceMeters: number, progressFraction: number, segmentIndex: number }}
 */
const pointToPolylineDistance = (point, polyline) => {
  if (!isValidCoord(point) || !Array.isArray(polyline) || polyline.length < 2) {
    return { distanceMeters: 999999, progressFraction: 0, segmentIndex: 0 };
  }

  const [pLon, pLat] = point;
  let minDistance = Infinity;
  let bestSegmentIndex = 0;
  let bestT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const { distanceMeters, t } = pointToSegmentDistanceMeters(pLon, pLat, a[0], a[1], b[0], b[1]);

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      bestSegmentIndex = i;
      bestT = t;
    }
  }

  const totalSegments = Math.max(1, polyline.length - 1);
  const progressFraction = (bestSegmentIndex + bestT) / totalSegments;

  return {
    distanceMeters: Math.round(minDistance),
    progressFraction,
    segmentIndex: bestSegmentIndex
  };
};

/**
 * Comprehensive OSRM road detour and corridor analysis
 * Compares driver's original route vs. modified route including commuter pickup and dropoff
 *
 * @param {[number, number]} driverOrigin - [lon, lat]
 * @param {[number, number]} driverDest - [lon, lat]
 * @param {[number, number]} commuterPickup - [lon, lat]
 * @param {[number, number]} commuterDropoff - [lon, lat]
 * @returns {Promise<Object>} Route detour breakdown
 */
const analyzeRouteDetour = async (driverOrigin, driverDest, commuterPickup, commuterDropoff) => {
  // 1. Calculate Driver Original Road Route
  const origRoute = await getOsrmRoute([driverOrigin, driverDest]);
  if (!origRoute.success) {
    return {
      success: false,
      error: origRoute.message || 'Driver original road route unavailable'
    };
  }

  const origDistanceMeters = origRoute.distanceMeters;
  const origDurationMins = origRoute.durationMins;
  const origPolyline = origRoute.coordinates;

  // 2. Measure Lateral Point-to-Route Distance from Driver's Polyline
  const pickupToRoute = pointToPolylineDistance(commuterPickup, origPolyline);
  const dropoffToRoute = pointToPolylineDistance(commuterDropoff, origPolyline);

  // 3. Construct Correctly Ordered Sequence: Driver Start -> Commuter Pickup -> Commuter Dropoff -> Driver Dest
  // If commuter dropoff is essentially identical to driver destination (common college destination),
  // construct: Driver Start -> Commuter Pickup -> Driver Destination
  const isCollegeDestination = haversineDistanceMeters(
    commuterDropoff[0], commuterDropoff[1],
    driverDest[0], driverDest[1]
  ) <= 300;

  const modifiedWaypoints = isCollegeDestination
    ? [driverOrigin, commuterPickup, driverDest]
    : [driverOrigin, commuterPickup, commuterDropoff, driverDest];

  // 4. Calculate Modified Road Route via OSRM
  const modRoute = await getOsrmRoute(modifiedWaypoints);
  if (!modRoute.success) {
    return {
      success: false,
      error: modRoute.message || 'Modified road route with pickup unavailable'
    };
  }

  const modDistanceMeters = modRoute.distanceMeters;
  const modDurationMins = modRoute.durationMins;

  // 5. Calculate Additional Road Distance
  const additionalDistanceMeters = Math.max(0, modDistanceMeters - origDistanceMeters);
  const additionalDurationMins = Math.max(0, modDurationMins - origDurationMins);

  // 6. Direct shared commute segment (Pickup -> Dropoff)
  const sharedRoute = await getOsrmRoute([commuterPickup, commuterDropoff]);
  const sharedDistanceKm = sharedRoute.success
    ? sharedRoute.distanceKm
    : parseFloat((haversineDistanceMeters(commuterPickup[0], commuterPickup[1], commuterDropoff[0], commuterDropoff[1]) / 1000 * 1.25).toFixed(2));

  // 7. Verify Chronological Order: Driver picks up commuter before dropping off
  // Verified by checking relative progress along original route and endpoint distances
  const isOrdered = pickupToRoute.progressFraction <= (dropoffToRoute.progressFraction + 0.08);

  return {
    success: true,
    origDistanceMeters,
    origDistanceKm: origRoute.distanceKm,
    origDurationMins,
    origPolyline,
    modDistanceMeters,
    modDistanceKm: modRoute.distanceKm,
    modDurationMins,
    modPolyline: modRoute.coordinates,
    additionalDistanceMeters,
    additionalDurationMins,
    pickupDistanceToRouteMeters: pickupToRoute.distanceMeters,
    dropoffDistanceToRouteMeters: dropoffToRoute.distanceMeters,
    pickupProgressFraction: pickupToRoute.progressFraction,
    dropoffProgressFraction: dropoffToRoute.progressFraction,
    isOrdered,
    isCollegeDestination,
    sharedDistanceKm
  };
};

module.exports = {
  OSRM_BASE_URL,
  isValidCoord,
  haversineDistanceMeters,
  getOsrmRoute,
  pointToPolylineDistance,
  analyzeRouteDetour
};
