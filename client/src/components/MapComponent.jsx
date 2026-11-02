import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default center: Ballari BITM Campus & City Corridor [lat, lng]
const DEFAULT_CENTER = {
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

// Universal Normalizer: safely converts {lat, lng}, {latitude, longitude}, [lng, lat], or [lat, lng] into Leaflet [lat, lng]
export const normalizeLatLng = (p) => {
  if (!p) return null;
  // Object format: { lat, lng } or { latitude, longitude }
  if (typeof p === 'object' && !Array.isArray(p)) {
    const lat = typeof p.lat === 'number' ? p.lat : parseFloat(p.lat ?? p.latitude);
    const lng = typeof p.lng === 'number' ? p.lng : parseFloat(p.lng ?? p.longitude ?? p.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }
  // Array format: [x, y]
  if (Array.isArray(p) && p.length >= 2) {
    const v0 = parseFloat(p[0]);
    const v1 = parseFloat(p[1]);
    if (isNaN(v0) || isNaN(v1)) return null;

    // For Karnataka/Ballari (India): Latitude is ~14.5 - 16.5, Longitude is ~75.5 - 78.5
    // If first element is > 50, it is Longitude: [lon, lat] (GeoJSON/OSRM format) -> convert to [lat, lon]
    if (v0 > 50 && v1 < 50) {
      return [v1, v0];
    }
    // If first element is < 50, it is Latitude: [lat, lon]
    if (v0 < 50 && v1 > 50) {
      return [v0, v1];
    }
    // Fallback: standard GeoJSON [lon, lat] -> [lat, lon]
    return [v1, v0];
  }
  return null;
};

// Safely normalizes an array of coordinates into Leaflet-valid [lat, lng] tuples
export const normalizePolyline = (pts) => {
  if (!pts || !Array.isArray(pts)) return [];
  const valid = [];
  for (let i = 0; i < pts.length; i++) {
    const norm = normalizeLatLng(pts[i]);
    if (norm) {
      valid.push(norm);
    }
  }
  return valid;
};

const parseLocationToCoords = (loc) => {
  if (!loc) return null;
  const norm = normalizeLatLng(loc);
  if (norm) return { lat: norm[0], lng: norm[1] };

  if (typeof loc === 'string') {
    const match = loc.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
    if (match) {
      const v0 = parseFloat(match[1]);
      const v1 = parseFloat(match[2]);
      const res = normalizeLatLng([v0, v1]);
      if (res) return { lat: res[0], lng: res[1] };
    }

    const lower = loc.toLowerCase();
    for (const [key, coords] of Object.entries(KNOWN_BALLARI_LOCATIONS)) {
      if (lower.includes(key)) return coords;
    }
  }
  return DEFAULT_CENTER;
};

function MapComponent({
  origin,
  destination,
  userCoords,
  userMarkerColor = '#3b82f6',
  rides = [],
  selectedRide = null,
  onSelectRide = null,
  onRequestRide = null,
  isTrackingMode = false,
  driverCoords = null,
  pickupCoords = null,
  destCoords = null,
  approachStatus = null,
  routeCoordinates = null,
  onRouteCalculated = null,
  driverRoutePoints = null,
  sharedRoutePoints = null,
  detourRoutePoints = null
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [osrmRoutePoints, setOsrmRoutePoints] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ distanceKm: null, durationMins: null });

  // 1. Initialize Leaflet Map (Safe against React StrictMode re-mounts)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    // Remove stale Leaflet ID on container if present from previous mount
    if (mapContainerRef.current._leaflet_id) {
      delete mapContainerRef.current._leaflet_id;
    }

    const normCenter = normalizeLatLng(driverCoords) || normalizeLatLng(userCoords) || [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];

    let map = null;
    try {
      map = L.map(mapContainerRef.current, {
        center: normCenter,
        zoom: isTrackingMode ? 14 : 13,
        zoomControl: true,
        attributionControl: false
      });

      // High-performance OpenStreetMap standard tiles (Zero API key / Zero billing requirement)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      const routeLayer = L.layerGroup().addTo(map);
      const markersLayer = L.layerGroup().addTo(map);

      routeLayerRef.current = routeLayer;
      markersLayerRef.current = markersLayer;
      mapRef.current = map;
    } catch (err) {
      console.warn('Map initialization notice:', err.message);
    }

    const timer = setTimeout(() => {
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize();
        } catch (_) {}
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (_) {}
        mapRef.current = null;
      }
      routeLayerRef.current = null;
      markersLayerRef.current = null;
      if (mapContainerRef.current) {
        delete mapContainerRef.current._leaflet_id;
      }
    };
  }, []);

  // Fetch OSRM turn-by-turn road route
  const fetchOsrmRoute = useCallback(async (startPt, endPt, waypointPt = null) => {
    if (!startPt || !endPt) return;

    const normStart = normalizeLatLng(startPt);
    const normEnd = normalizeLatLng(endPt);
    if (!normStart || !normEnd) return;

    try {
      let url = `http://localhost:5000/api/rides/osrm-route?originLng=${normStart[1]}&originLat=${normStart[0]}&destLng=${normEnd[1]}&destLat=${normEnd[0]}`;
      if (waypointPt) {
        const normWaypoint = normalizeLatLng(waypointPt);
        if (normWaypoint) {
          url += `&waypointLng=${normWaypoint[1]}&waypointLat=${normWaypoint[0]}`;
        }
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
      }
    } catch (err) {
      console.warn('OSRM route fetch fallback:', err.message);
      // Fallback straight segment
      const fallback = [
        normStart,
        ...(waypointPt ? [normalizeLatLng(waypointPt)] : []).filter(Boolean),
        normEnd
      ];
      setOsrmRoutePoints(fallback);
    }
  }, [onRouteCalculated]);

  // Route calculation trigger
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      setOsrmRoutePoints(routeCoordinates);
    } else if (isTrackingMode && (pickupCoords || destCoords)) {
      const start = pickupCoords || driverCoords || DEFAULT_CENTER;
      const end = destCoords || { lat: 15.1677, lng: 76.8506 };
      fetchOsrmRoute(start, end);
    } else if (origin && destination) {
      const origPt = parseLocationToCoords(origin);
      const destPt = parseLocationToCoords(destination);
      if (origPt && destPt) {
        fetchOsrmRoute(origPt, destPt);
      }
    } else {
      setOsrmRoutePoints([]);
    }
  }, [origin, destination, pickupCoords, destCoords, routeCoordinates, isTrackingMode, fetchOsrmRoute]);

  // 2. Render Polylines & Markers safely on Leaflet Map
  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !routeLayer || !markersLayer) return;

    try {
      routeLayer.clearLayers();
      markersLayer.clearLayers();

      const boundsPoints = [];

      // --- POLYLINES ---

      // 1. Driver Full Master Route (Solid Blue)
      if (driverRoutePoints && driverRoutePoints.length > 0) {
        const latlngs = normalizePolyline(driverRoutePoints);
        if (latlngs.length > 0) {
          L.polyline(latlngs, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85,
            smoothFactor: 1
          }).addTo(routeLayer);
          latlngs.forEach(pt => boundsPoints.push(pt));
        }
      }

      // 2. Shared Commute Stretch (Vibrant Green)
      if (sharedRoutePoints && sharedRoutePoints.length > 0) {
        const latlngs = normalizePolyline(sharedRoutePoints);
        if (latlngs.length > 0) {
          L.polyline(latlngs, {
            color: '#00b87c',
            weight: 7,
            opacity: 0.95,
            smoothFactor: 1
          }).addTo(routeLayer);
          latlngs.forEach(pt => boundsPoints.push(pt));
        }
      }

      // 3. Detour Corridor Connector (Dashed Orange)
      if (detourRoutePoints && detourRoutePoints.length > 0) {
        const latlngs = normalizePolyline(detourRoutePoints);
        if (latlngs.length > 0) {
          L.polyline(latlngs, {
            color: '#f97316',
            weight: 4,
            opacity: 0.9,
            dashArray: '6, 8',
            smoothFactor: 1
          }).addTo(routeLayer);
          latlngs.forEach(pt => boundsPoints.push(pt));
        }
      }

      // 4. Single OSRM Route Fallback
      if (!driverRoutePoints && !sharedRoutePoints && osrmRoutePoints && osrmRoutePoints.length > 0) {
        const latlngs = normalizePolyline(osrmRoutePoints);
        if (latlngs.length > 0) {
          L.polyline(latlngs, {
            color: isTrackingMode ? '#06b6d4' : '#6366f1',
            weight: 5,
            opacity: 0.9,
            smoothFactor: 1
          }).addTo(routeLayer);
          latlngs.forEach(pt => boundsPoints.push(pt));
        }
      }

      // --- MARKERS ---

      // Search Mode: Available Rides
      if (!isTrackingMode && Array.isArray(rides) && rides.length > 0) {
        rides.forEach(r => {
          const coords = r.origin?.coordinates;
          const norm = normalizeLatLng(coords);
          if (!norm) return;

          const bikeIcon = L.divIcon({
            className: 'leaflet-custom-marker',
            html: `
              <div style="background:#4f46e5; width:36px; height:36px; border-radius:50%; border:2.5px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:18px; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
                🏍️
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
          });

          const marker = L.marker(norm, { icon: bikeIcon }).addTo(markersLayer);
          boundsPoints.push(norm);

          // Popup Content
          const popupContainer = document.createElement('div');
          popupContainer.className = 'p-1 text-gray-900 font-sans';
          popupContainer.innerHTML = `
            <div style="font-weight:700; font-size:13px; margin-bottom:2px; display:flex; align-items:center; gap:6px;">
              <span>🏍️</span>
              <span>${r.offeredBy?.name || 'Driver'}</span>
              <span style="font-size:10px; background:#e0e7ff; color:#4338ca; padding:1px 6px; border-radius:999px; font-weight:700;">Verified</span>
            </div>
            <div style="font-size:11px; color:#4b5563; margin-bottom:4px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              📍 ${r.originAddress || 'Starting Point'}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:8px; border-top:1px solid #e5e7eb; padding-top:4px;">
              <span style="color:#6b7280;">🪑 ${r.seatsAvailable} seat(s)</span>
              <strong style="color:#4f46e5; font-size:13px;">₹${r.pricePerSeat}</strong>
            </div>
          `;

          if (onRequestRide) {
            const reqBtn = document.createElement('button');
            reqBtn.textContent = 'Request to Join Ride 🏍️';
            reqBtn.style.cssText = 'width:100%; padding:6px 12px; background:#4f46e5; color:white; font-size:11px; font-weight:700; border-radius:8px; border:none; cursor:pointer; transition:background 0.2s;';
            reqBtn.onmouseover = () => { reqBtn.style.background = '#4338ca'; };
            reqBtn.onmouseout = () => { reqBtn.style.background = '#4f46e5'; };
            reqBtn.onclick = (e) => {
              e.stopPropagation();
              map.closePopup();
              onRequestRide(r._id, r.offeredBy?.name || 'Driver');
            };
            popupContainer.appendChild(reqBtn);
          }

          marker.bindPopup(popupContainer, { maxWidth: 240 });
          marker.on('click', () => {
            if (onSelectRide) onSelectRide(r);
          });
        });
      }

      // User Location Marker (Red for Rider, Blue for Driver)
      const normUser = normalizeLatLng(userCoords);
      if (normUser && !isTrackingMode) {
        const userMarkerIcon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `
            <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:40px; height:40px; border-radius:50%; background:${userMarkerColor}40; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="background:${userMarkerColor}; width:20px; height:20px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:2;"></div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        L.marker(normUser, { icon: userMarkerIcon }).addTo(markersLayer);
        boundsPoints.push(normUser);
      }

      // Live Tracking Mode Markers
      if (isTrackingMode) {
        // 1. Moving Driver
        const normDriver = normalizeLatLng(driverCoords);
        if (normDriver) {
          const movingDriverIcon = L.divIcon({
            className: 'leaflet-custom-marker',
            html: `
              <div style="position:relative; width:46px; height:46px; display:flex; align-items:center; justify-content:center;">
                <span style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(6,182,212,0.4); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
                <div style="background:#0ea5e9; width:36px; height:36px; border-radius:50%; border:3px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:18px; z-index:2;">
                  🏍️
                </div>
              </div>
            `,
            iconSize: [46, 46],
            iconAnchor: [23, 23]
          });

          L.marker(normDriver, {
            icon: movingDriverIcon,
            zIndexOffset: 1000
          }).addTo(markersLayer);
          boundsPoints.push(normDriver);
        }

        // 2. Pickup Coords
        const normPickup = normalizeLatLng(pickupCoords);
        if (normPickup) {
          const pickupIcon = L.divIcon({
            className: 'leaflet-custom-marker',
            html: `
              <div style="background:#10b981; width:36px; height:36px; border-radius:50%; border:2.5px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:18px;">
                📍
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          L.marker(normPickup, {
            icon: pickupIcon,
            zIndexOffset: 900
          }).addTo(markersLayer);
          boundsPoints.push(normPickup);
        }

        // 3. Dest Campus Coords
        const normDest = normalizeLatLng(destCoords);
        if (normDest) {
          const collegeIcon = L.divIcon({
            className: 'leaflet-custom-marker',
            html: `
              <div style="background:#eab308; width:36px; height:36px; border-radius:50%; border:2.5px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:18px;">
                🏫
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          L.marker(normDest, {
            icon: collegeIcon,
            zIndexOffset: 800
          }).addTo(markersLayer);
          boundsPoints.push(normDest);
        }
      }

      // --- AUTO FIT BOUNDS OR PAN ---
      if (isTrackingMode && normalizeLatLng(driverCoords)) {
        map.panTo(normalizeLatLng(driverCoords));
      } else if (boundsPoints.length > 1) {
        map.fitBounds(L.latLngBounds(boundsPoints), {
          padding: [45, 45],
          maxZoom: 16
        });
      } else if (boundsPoints.length === 1) {
        map.panTo(boundsPoints[0]);
      }
    } catch (err) {
      console.warn('MapComponent layer update error:', err);
    }
  }, [
    rides,
    userCoords,
    userMarkerColor,
    isTrackingMode,
    driverCoords,
    pickupCoords,
    destCoords,
    driverRoutePoints,
    sharedRoutePoints,
    detourRoutePoints,
    osrmRoutePoints,
    onSelectRide,
    onRequestRide
  ]);

  return (
    <div className="w-full h-full min-h-[450px] rounded-2xl overflow-hidden border border-white/10 shadow-card relative isolate">
      
      {/* Live Map Top Floating Status Badge */}
      {isTrackingMode && approachStatus && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-dark-900/95 backdrop-blur-md border border-cyan-500/40 px-4 py-3 rounded-2xl shadow-glow-sm flex items-center justify-between pointer-events-auto">
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
      {!isTrackingMode && Array.isArray(rides) && rides.length > 0 && (
        <div className="absolute top-4 left-4 z-20 bg-dark-900/95 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs pointer-events-auto">
          <span className="text-base">🏍️</span>
          <span className="text-white font-bold">{rides.length} Available Riders</span>
          <span className="text-cyan-400 text-[10px] font-semibold">● OSRM Routed</span>
        </div>
      )}

      {/* OSRM Status Tag bottom-right */}
      <div className="absolute bottom-4 right-4 z-20 bg-dark-950/90 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[10px] text-gray-300 flex items-center gap-1.5 pointer-events-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        <span>OSRM Turn-by-Turn Routing</span>
      </div>

      {/* The Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', minHeight: '450px', background: '#1e293b' }}
      />
    </div>
  );
}

export default React.memo(MapComponent);
