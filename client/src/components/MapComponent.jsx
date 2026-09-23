import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import axios from 'axios';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '450px'
};

// Default center: Ballari BITM Campus & City Corridor
const defaultCenter = {
  lat: 15.1485,
  lng: 76.8850
};

// Known Ballari Campus & City Landmarks lookup
const KNOWN_BALLARI_LOCATIONS = {
  bitm: { lat: 15.1677, lng: 76.8506 },
  college: { lat: 15.1677, lng: 76.8506 },
  campus: { lat: 15.1677, lng: 76.8506 },
  ballari: { lat: 15.1394, lng: 76.9214 },
  khb: { lat: 15.1394, lng: 76.9214 },
  bus: { lat: 15.1438, lng: 76.9242 },
  stand: { lat: 15.1438, lng: 76.9242 },
  cantonment: { lat: 15.1360, lng: 76.9080 },
  gandhi: { lat: 15.1502, lng: 76.9150 },
  sudha: { lat: 15.1465, lng: 76.9312 },
  hospet: { lat: 15.1600, lng: 76.8650 }
};

const parseLocationToCoords = (loc) => {
  if (!loc) return null;
  if (typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return loc;
  }
  if (typeof loc === 'string') {
    // Check if contains "(lat, lng)" pattern
    const match = loc.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    const lower = loc.toLowerCase();
    for (const [key, coords] of Object.entries(KNOWN_BALLARI_LOCATIONS)) {
      if (lower.includes(key)) return coords;
    }
  }
  return { lat: 15.1394, lng: 76.9214 }; // Default to Ballari center
};

function MapComponent({
  origin,
  destination,
  userCoords,
  rides = [],
  selectedRide = null,
  onSelectRide = null,
  onRequestRide = null,
  isTrackingMode = false,
  driverCoords = null,
  pickupCoords = null,
  destCoords = null,
  approachStatus = null,
  onRouteCalculated = null
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places']
  });

  const [osrmRoutePoints, setOsrmRoutePoints] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ distanceKm: null, durationMins: null });
  const [mapCenter, setMapCenter] = useState(driverCoords || userCoords || defaultCenter);
  const [activeRidePopup, setActiveRidePopup] = useState(null);
  const mapRef = useRef(null);

  // Recenter map on user or driver position
  useEffect(() => {
    if (isTrackingMode && driverCoords) {
      setMapCenter(driverCoords);
      if (mapRef.current) {
        mapRef.current.panTo(driverCoords);
      }
    } else if (userCoords) {
      setMapCenter(userCoords);
    }
  }, [userCoords, driverCoords, isTrackingMode]);

  // Fetch OSRM turn-by-turn road route
  const fetchOsrmRoute = useCallback(async (startPt, endPt, waypointPt = null) => {
    if (!startPt || !endPt) return;

    try {
      let url = `http://localhost:5000/api/rides/osrm-route?originLng=${startPt.lng}&originLat=${startPt.lat}&destLng=${endPt.lng}&destLat=${endPt.lat}`;
      if (waypointPt) {
        url += `&waypointLng=${waypointPt.lng}&waypointLat=${waypointPt.lat}`;
      }

      const res = await axios.get(url, { timeout: 8000 });
      if (res.data?.coordinates && res.data.coordinates.length > 0) {
        setOsrmRoutePoints(res.data.coordinates);
        setRouteMeta({
          distanceKm: res.data.distanceKm,
          durationMins: res.data.durationMins
        });

        if (onRouteCalculated) {
          onRouteCalculated(res.data);
        }

        // Fit bounds to polyline in non-tracking mode
        if (mapRef.current && window.google?.maps?.LatLngBounds && !isTrackingMode) {
          const bounds = new window.google.maps.LatLngBounds();
          res.data.coordinates.forEach((pt) => bounds.extend(pt));
          mapRef.current.fitBounds(bounds, 50);
        }
      }
    } catch (err) {
      console.warn('OSRM route fetch failed, using direct polyline fallback:', err.message);
      // Fallback straight segment
      const fallback = [
        startPt,
        ...(waypointPt ? [waypointPt] : []),
        endPt
      ];
      setOsrmRoutePoints(fallback);
    }
  }, [isTrackingMode, onRouteCalculated]);

  // Route calculation trigger
  useEffect(() => {
    if (isTrackingMode && driverCoords && (pickupCoords || destCoords)) {
      const end = destCoords || { lat: 15.1677, lng: 76.8506 };
      fetchOsrmRoute(driverCoords, end, pickupCoords);
    } else if (origin && destination) {
      const origPt = parseLocationToCoords(origin);
      const destPt = parseLocationToCoords(destination);
      if (origPt && destPt) {
        fetchOsrmRoute(origPt, destPt);
      }
    } else {
      setOsrmRoutePoints([]);
    }
  }, [origin, destination, driverCoords, pickupCoords, destCoords, isTrackingMode, fetchOsrmRoute]);

  // SVG Bike Icon (Data URL for Google Maps Marker)
  const bikeIconSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle cx="22" cy="22" r="20" fill="#4f46e5" stroke="#ffffff" stroke-width="2.5" filter="url(#glow)"/>
      <circle cx="22" cy="22" r="15" fill="#6366f1" />
      <text x="50%" y="54%" font-size="20" text-anchor="middle" dominant-baseline="central">🏍️</text>
    </svg>
  `)}`;

  const movingDriverIconSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="24" fill="#06b6d4" opacity="0.3" />
      <circle cx="26" cy="26" r="19" fill="#0ea5e9" stroke="#ffffff" stroke-width="3" />
      <text x="50%" y="54%" font-size="22" text-anchor="middle" dominant-baseline="central">🏍️</text>
    </svg>
  `)}`;

  const collegeIconSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="19" fill="#eab308" stroke="#ffffff" stroke-width="2.5" />
      <text x="50%" y="54%" font-size="20" text-anchor="middle" dominant-baseline="central">🏫</text>
    </svg>
  `)}`;

  const pickupIconSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="19" fill="#10b981" stroke="#ffffff" stroke-width="2.5" />
      <text x="50%" y="54%" font-size="20" text-anchor="middle" dominant-baseline="central">📍</text>
    </svg>
  `)}`;

  return isLoaded ? (
    <div className="w-full h-full min-h-[450px] rounded-2xl overflow-hidden border border-white/10 shadow-card relative">
      
      {/* Live Map Top Floating Status Badge */}
      {isTrackingMode && approachStatus && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-dark-900/90 backdrop-blur-md border border-cyan-500/40 px-4 py-3 rounded-2xl shadow-glow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-white text-xs sm:text-sm font-bold">{approachStatus}</span>
          </div>
          <div className="flex items-center gap-2">
            {routeMeta.distanceKm && (
              <span className="text-[11px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-2.5 py-0.5 rounded-full">
                {routeMeta.distanceKm} km OSRM
              </span>
            )}
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-brand-500/30 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/40">
              Live GPS
            </span>
          </div>
        </div>
      )}

      {/* Map Active Rides Counter Pill in non-tracking mode */}
      {!isTrackingMode && rides.length > 0 && (
        <div className="absolute top-4 left-4 z-20 bg-dark-900/90 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs">
          <span className="text-base">🏍️</span>
          <span className="text-white font-bold">{rides.length} Available Riders</span>
          <span className="text-cyan-400 text-[10px] font-semibold">● OSRM Routed</span>
        </div>
      )}

      {/* OSRM Status Tag bottom-right */}
      <div className="absolute bottom-4 right-4 z-20 bg-dark-950/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[10px] text-gray-300 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        <span>OSRM Turn-by-Turn Routing</span>
      </div>

      <GoogleMap
        onLoad={(map) => { mapRef.current = map; }}
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={isTrackingMode ? 14 : 13}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4f46e5" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] }
          ]
        }}
      >
        {/* OSRM Free Turn-by-Turn Road Polyline */}
        {osrmRoutePoints && osrmRoutePoints.length > 0 && (
          <Polyline
            path={osrmRoutePoints}
            options={{
              strokeColor: isTrackingMode ? '#06b6d4' : '#6366f1',
              strokeWeight: 5,
              strokeOpacity: 0.9,
              geodesic: true
            }}
          />
        )}

        {/* 1. In Search Mode: Render all available ride markers */}
        {!isTrackingMode && rides.map((r) => {
          const coords = r.origin?.coordinates;
          if (!coords || coords.length < 2) return null;
          const pos = { lat: coords[1], lng: coords[0] };

          return (
            <Marker
              key={r._id}
              position={pos}
              title={`${r.offeredBy?.name || 'Driver'} (₹${r.pricePerSeat})`}
              icon={{
                url: bikeIconSvg,
                scaledSize: new window.google.maps.Size(38, 38),
                anchor: new window.google.maps.Point(19, 19)
              }}
              onClick={() => {
                setActiveRidePopup(r);
                if (onSelectRide) onSelectRide(r);
              }}
            />
          );
        })}

        {/* 2. InfoWindow popup for selected ride marker */}
        {!isTrackingMode && activeRidePopup && activeRidePopup.origin?.coordinates && (
          <InfoWindow
            position={{
              lat: activeRidePopup.origin.coordinates[1],
              lng: activeRidePopup.origin.coordinates[0]
            }}
            onCloseClick={() => setActiveRidePopup(null)}
          >
            <div className="p-2.5 max-w-xs text-gray-900">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">🏍️</span>
                <strong className="text-sm font-bold text-gray-900">
                  {activeRidePopup.offeredBy?.name || 'Fellow Student'}
                </strong>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                  Verified
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1 truncate">
                📍 {activeRidePopup.originAddress || 'Starting Point'}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-700 mb-2.5 pt-1 border-t border-gray-200">
                <span>🪑 {activeRidePopup.seatsAvailable} seat(s)</span>
                <strong className="text-indigo-600 font-bold">₹{activeRidePopup.pricePerSeat}</strong>
              </div>
              {onRequestRide && (
                <button
                  type="button"
                  onClick={() => {
                    onRequestRide(activeRidePopup._id, activeRidePopup.offeredBy?.name || 'Driver');
                    setActiveRidePopup(null);
                  }}
                  className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition"
                >
                  Request to Join Ride 🏍️
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {/* 3. User Current GPS Marker */}
        {userCoords && !isTrackingMode && (
          <Marker
            position={userCoords}
            title="Your Current Location"
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#38bdf8',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2.5
            }}
          />
        )}

        {/* 4. Live Rapido Tracking Mode Markers */}
        {isTrackingMode && (
          <>
            {/* Live Moving Driver Marker */}
            {driverCoords && (
              <Marker
                position={driverCoords}
                title="Driver Live Position"
                zIndex={999}
                icon={{
                  url: movingDriverIconSvg,
                  scaledSize: new window.google.maps.Size(46, 46),
                  anchor: new window.google.maps.Point(23, 23)
                }}
              />
            )}

            {/* Passenger Pickup Point Marker */}
            {pickupCoords && (
              <Marker
                position={pickupCoords}
                title="Your Pickup Point"
                zIndex={900}
                icon={{
                  url: pickupIconSvg,
                  scaledSize: new window.google.maps.Size(40, 40),
                  anchor: new window.google.maps.Point(20, 20)
                }}
              />
            )}

            {/* Destination BITM Campus Marker */}
            {destCoords && (
              <Marker
                position={destCoords}
                title="Destination: BITM Campus"
                zIndex={800}
                icon={{
                  url: collegeIconSvg,
                  scaledSize: new window.google.maps.Size(40, 40),
                  anchor: new window.google.maps.Point(20, 20)
                }}
              />
            )}
          </>
        )}
      </GoogleMap>
    </div>
  ) : (
    <div className="w-full h-full min-h-[450px] flex flex-col items-center justify-center bg-dark-800 text-gray-400 rounded-2xl border border-white/5">
      <div className="animate-spin text-3xl mb-3">📍</div>
      <p>Loading Interactive Map with OSRM Routing...</p>
    </div>
  );
}

export default React.memo(MapComponent);
