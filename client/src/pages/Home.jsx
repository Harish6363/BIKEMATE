import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Bike, ArrowRight, MapPin, CheckCircle2, Navigation, Settings2, Sparkles, X, Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { format12Hour } from '../utils/timeFormat';

// User-provided 3D Home and BITM Emblem icons
import homeIconImg from '../assets/home-3d-icon.png';
import bitmEmblemImg from '../assets/bitm-emblem.png';

// Ballari Zone Presets: text-only, NO emojis, hostels removed
const PRESET_ZONES = [
  { name: 'KHB Colony, Ballari', coords: [76.9214, 15.1394], label: 'KHB Colony' },
  { name: 'Ballari Main Bus Stand', coords: [76.9242, 15.1438], label: 'Main Bus Stand' },
  { name: 'Cantonment, Ballari', coords: [76.9080, 15.1360], label: 'Cantonment' },
  { name: 'Sudha Cross, Ballari', coords: [76.9312, 15.1465], label: 'Sudha Cross' },
  { name: 'Gandhi Nagar, Ballari', coords: [76.9150, 15.1502], label: 'Gandhi Nagar' },
  { name: 'Ballari Institute of Technology and Management, Ballari', coords: [76.8506, 15.1677], label: 'BITM College Campus' }
];

const BITM_CAMPUS = {
  name: 'Ballari Institute of Technology and Management, Ballari',
  coords: [76.8506, 15.1677]
};

const COMMUTE_STORAGE_KEY = 'bikemate_today_commute';
const USER_HOME_KEY = 'bikemate_user_home';

const calculateDist = (c1, c2) => {
  if (!c1 || !c2) return 8.5;
  const lon1 = c1[0], lat1 = c1[1];
  const lon2 = c2[0], lat2 = c2[1];
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c * 1.25).toFixed(1));
};

function LeafletPinPicker({ initialCoords, onLocationChange }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (containerRef.current._leaflet_id) {
      delete containerRef.current._leaflet_id;
    }

    const map = L.map(containerRef.current, {
      center: [initialCoords.lat, initialCoords.lng],
      zoom: 14,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'leaflet-custom-marker',
      html: `
        <div style="background:#ef4444; width:34px; height:34px; border-radius:50%; border:2.5px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:16px;">
          📍
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker([initialCoords.lat, initialCoords.lng], { icon: pinIcon }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      onLocationChange(lat, lng);
    });

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (_) {}
        mapRef.current = null;
      }
      if (containerRef.current) {
        delete containerRef.current._leaflet_id;
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full min-h-[360px]" />;
}

export default function Home() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [upcomingRide, setUpcomingRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Commute Mode: 'TO_COLLEGE' | 'FROM_COLLEGE' | 'CUSTOM'
  const [mode, setMode] = useState('TO_COLLEGE');

  // Fixed Home location for the student
  const [homeAddress, setHomeAddress] = useState(() => {
    try {
      const savedH = localStorage.getItem(USER_HOME_KEY);
      if (savedH) {
        const p = JSON.parse(savedH);
        if (p.address) return p.address;
      }
    } catch (e) {}
    return 'KHB Colony, Ballari';
  });

  const [homeCoords, setHomeCoords] = useState(() => {
    try {
      const savedH = localStorage.getItem(USER_HOME_KEY);
      if (savedH) {
        const p = JSON.parse(savedH);
        if (p.coords) return p.coords;
      }
    } catch (e) {}
    return [76.9214, 15.1394];
  });

  // Custom Route selections
  const [customOrigin, setCustomOrigin] = useState('Ballari Main Bus Stand');
  const [customOriginCoords, setCustomOriginCoords] = useState([76.9242, 15.1438]);
  const [customDest, setCustomDest] = useState(BITM_CAMPUS.name);
  const [customDestCoords, setCustomDestCoords] = useState(BITM_CAMPUS.coords);

  // Interactive Leaflet Map Modal State for Touch/Pin Placement
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState('HOME'); // 'HOME' | 'CUSTOM_ORIGIN' | 'CUSTOM_DEST'
  const [tempPinCoords, setTempPinCoords] = useState({ lat: 15.1394, lng: 76.9214 });
  const [tempAddress, setTempAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Load saved route presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COMMUTE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.customOrigin) setCustomOrigin(parsed.customOrigin);
        if (parsed.customOriginCoords) setCustomOriginCoords(parsed.customOriginCoords);
        if (parsed.customDest) setCustomDest(parsed.customDest);
        if (parsed.customDestCoords) setCustomDestCoords(parsed.customDestCoords);
      }
    } catch (e) {
      console.warn('Error reading saved commute:', e);
    }
  }, []);

  // Compute active origin and destination for today
  let activeOriginText = homeAddress;
  let activeOriginCoords = homeCoords;
  let activeDestText = BITM_CAMPUS.name;
  let activeDestCoords = BITM_CAMPUS.coords;

  if (mode === 'FROM_COLLEGE') {
    activeOriginText = BITM_CAMPUS.name;
    activeOriginCoords = BITM_CAMPUS.coords;
    activeDestText = homeAddress;
    activeDestCoords = homeCoords;
  } else if (mode === 'CUSTOM') {
    activeOriginText = customOrigin;
    activeOriginCoords = customOriginCoords;
    activeDestText = customDest;
    activeDestCoords = customDestCoords;
  }

  const estDistanceKm = calculateDist(activeOriginCoords, activeDestCoords);
  const estFare = Math.max(10, Math.round(estDistanceKm * 2.0));

  // Persist commute settings to localStorage
  const saveCommuteSettings = (newMode, newHomeAddr, newHomeC, newCustOrig, newCustOrigC, newCustDest, newCustDestC) => {
    const curMode = newMode !== undefined ? newMode : mode;
    const curHome = newHomeAddr || homeAddress;
    const curHomeC = newHomeC || homeCoords;
    const curCustOrig = newCustOrig || customOrigin;
    const curCustOrigC = newCustOrigC || customOriginCoords;
    const curCustDest = newCustDest || customDest;
    const curCustDestC = newCustDestC || customDestCoords;

    let oText = curHome, oCoords = curHomeC;
    let dText = BITM_CAMPUS.name, dCoords = BITM_CAMPUS.coords;

    if (curMode === 'FROM_COLLEGE') {
      oText = BITM_CAMPUS.name; oCoords = BITM_CAMPUS.coords;
      dText = curHome; dCoords = curHomeC;
    } else if (curMode === 'CUSTOM') {
      oText = curCustOrig; oCoords = curCustOrigC;
      dText = curCustDest; dCoords = curCustDestC;
    }

    const payload = {
      mode: curMode,
      originText: oText,
      originCoords: oCoords,
      destText: dText,
      destCoords: dCoords,
      savedHomeAddress: curHome,
      savedHomeCoords: curHomeC,
      customOrigin: curCustOrig,
      customOriginCoords: curCustOrigC,
      customDest: curCustDest,
      customDestCoords: curCustDestC,
      distanceKm: calculateDist(oCoords, dCoords),
      fairSharePrice: Math.max(10, Math.round(calculateDist(oCoords, dCoords) * 2.0)),
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(COMMUTE_STORAGE_KEY, JSON.stringify(payload));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    saveCommuteSettings(newMode);
  };

  // Open Interactive Map to touch/set location pin
  const openMapPicker = (target) => {
    setMapPickerTarget(target);
    let initialCoords = { lat: 15.1394, lng: 76.9214 };
    let initialAddr = homeAddress;

    if (target === 'HOME' && homeCoords) {
      initialCoords = { lat: homeCoords[1], lng: homeCoords[0] };
      initialAddr = homeAddress;
    } else if (target === 'CUSTOM_ORIGIN' && customOriginCoords) {
      initialCoords = { lat: customOriginCoords[1], lng: customOriginCoords[0] };
      initialAddr = customOrigin;
    } else if (target === 'CUSTOM_DEST' && customDestCoords) {
      initialCoords = { lat: customDestCoords[1], lng: customDestCoords[0] };
      initialAddr = customDest;
    }

    setTempPinCoords(initialCoords);
    setTempAddress(initialAddr);
    setMapPickerOpen(true);
  };

  // Touching/Clicking on Leaflet map moves the pin and reverse-geocodes
  const handlePinLocationChange = async (lat, lng) => {
    setTempPinCoords({ lat, lng });
    setGeocoding(true);

    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { timeout: 3500 }
      );
      if (res.data?.display_name) {
        const parts = res.data.display_name.split(',');
        const shortAddr = parts.slice(0, 3).join(',').trim();
        setTempAddress(shortAddr || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } else {
        setTempAddress(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    } catch {
      setTempAddress(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    } finally {
      setGeocoding(false);
    }
  };

  // Save the touched pin from the map
  const confirmMapSelection = () => {
    const coordsArray = [tempPinCoords.lng, tempPinCoords.lat];
    const finalAddr = tempAddress || `Location (${tempPinCoords.lat.toFixed(4)}, ${tempPinCoords.lng.toFixed(4)})`;

    if (mapPickerTarget === 'HOME') {
      setHomeAddress(finalAddr);
      setHomeCoords(coordsArray);
      localStorage.setItem(USER_HOME_KEY, JSON.stringify({ address: finalAddr, coords: coordsArray }));
      saveCommuteSettings(mode, finalAddr, coordsArray);
    } else if (mapPickerTarget === 'CUSTOM_ORIGIN') {
      setCustomOrigin(finalAddr);
      setCustomOriginCoords(coordsArray);
      saveCommuteSettings(mode, null, null, finalAddr, coordsArray, customDest, customDestCoords);
    } else if (mapPickerTarget === 'CUSTOM_DEST') {
      setCustomDest(finalAddr);
      setCustomDestCoords(coordsArray);
      saveCommuteSettings(mode, null, null, customOrigin, customOriginCoords, finalAddr, coordsArray);
    }

    setMapPickerOpen(false);
  };

  // Check if user has a confirmed/accepted upcoming ride
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const token = localStorage.getItem('token');
        const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const [reqsRes, ridesRes] = await Promise.all([
          axios.get('http://localhost:5000/api/rides/requests/my', authHeaders).catch(() => ({ data: {} })),
          axios.get('http://localhost:5000/api/rides/my-offered', authHeaders).catch(() => ({ data: [] }))
        ]);

        // 1. Commuter side: accepted booking with driver
        const acceptedOutgoing = (reqsRes.data?.outgoing || []).find(
          r => r.status === 'accepted' && r.ride && r.ride.status !== 'completed' && r.ride.status !== 'cancelled'
        );

        if (acceptedOutgoing && acceptedOutgoing.ride) {
          setUpcomingRide({
            _id: acceptedOutgoing.ride._id || acceptedOutgoing.ride,
            departureTime: acceptedOutgoing.requestedDepartureTime || acceptedOutgoing.ride.departureTime,
            destAddress: acceptedOutgoing.ride.destAddress || 'Campus',
            driverName: acceptedOutgoing.ride.offeredBy?.name || acceptedOutgoing.driver?.name || 'Verified Driver',
            isDriver: false
          });
          return;
        }

        // 2. Driver side: offered ride with accepted passenger
        const offeredWithPassenger = (ridesRes.data || []).find(
          ride => (ride.status === 'active' || ride.status === 'full' || ride.status === 'in_progress') &&
                  (reqsRes.data?.incoming || []).some(req => (req.ride?._id === ride._id || req.ride === ride._id) && req.status === 'accepted')
        );

        if (offeredWithPassenger) {
          const acceptedPassengerReq = (reqsRes.data?.incoming || []).find(
            req => (req.ride?._id === offeredWithPassenger._id || req.ride === offeredWithPassenger._id) && req.status === 'accepted'
          );
          setUpcomingRide({
            _id: offeredWithPassenger._id,
            departureTime: offeredWithPassenger.departureTime,
            destAddress: offeredWithPassenger.destAddress || 'Campus',
            driverName: offeredWithPassenger.offeredBy?.name || user?.name || 'You',
            passengerName: acceptedPassengerReq?.requester?.name || 'Accepted Passenger',
            isDriver: true
          });
          return;
        }

        setUpcomingRide(null);
      } catch (err) {
        setUpcomingRide(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUpcoming();
  }, [user]);

  return (
    <div className="pt-2 space-y-6">
      
      {/* 1. Clean Welcome Block (Gender Route Pill Removed) */}
      <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <span>Welcome back, {user?.name || 'Student'}</span>
          <span className="text-xl">👋</span>
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
          Configure your commute route for today. Find a Ride and Offer a Ride will automatically use it.
        </p>
      </div>

      {/* 2. Todays Route Card */}
      <div className="bg-gradient-to-br from-white via-[#fafffd] to-[#f0fbf7] dark:from-[#121c27] dark:via-[#142230] dark:to-[#0f1b26] border-2 border-[#98e6c4] dark:border-emerald-800/60 rounded-[28px] p-6 sm:p-7 shadow-sm relative overflow-hidden transition-colors">
        
        {/* Header: Title is "Todays Route", subtitle removed */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#00b87c] text-white flex items-center justify-center text-xl shadow-md shadow-[#00b87c]/20">
              <Navigation className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">Todays Route</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[#00a86b] dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Route Locked</span>
              </span>
            </div>
          </div>

          {/* Mode Selector Tabs (Clean Text Only) */}
          <div className="inline-flex bg-gray-100/90 dark:bg-gray-800/90 p-1.5 rounded-2xl border border-gray-200/80 dark:border-gray-700 shrink-0 gap-1 flex-wrap">
            <button
              onClick={() => handleModeChange('TO_COLLEGE')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                mode === 'TO_COLLEGE'
                  ? 'bg-[#00b87c] text-white shadow-xs'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Home to College
            </button>

            <button
              onClick={() => handleModeChange('FROM_COLLEGE')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                mode === 'FROM_COLLEGE'
                  ? 'bg-[#00b87c] text-white shadow-xs'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              College to Home
            </button>

            <button
              onClick={() => handleModeChange('CUSTOM')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                mode === 'CUSTOM'
                  ? 'bg-[#00b87c] text-white shadow-xs'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Custom Route
            </button>
          </div>
        </div>

        {/* Route Details Box */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/90 p-5 mb-5 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Start Point */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 relative">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                📍 Starting Point (Today)
              </span>
              <p className="text-gray-900 font-bold text-sm sm:text-base truncate">
                {activeOriginText}
              </p>
              
              {/* If Home to College: Fixed with button to touch map and set Home */}
              {mode === 'TO_COLLEGE' && (
                <button
                  type="button"
                  onClick={() => openMapPicker('HOME')}
                  className="mt-2.5 text-xs text-[#00a86b] hover:text-[#008e60] font-bold flex items-center gap-1.5 transition bg-[#e1f7ec] px-3 py-1.5 rounded-lg border border-[#98e6c4]"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#00a86b]" />
                  <span>Touch Map to Set / Change Home Location</span>
                </button>
              )}

              {/* If Custom Route: Button to pick custom origin on map */}
              {mode === 'CUSTOM' && (
                <button
                  type="button"
                  onClick={() => openMapPicker('CUSTOM_ORIGIN')}
                  className="mt-2.5 text-xs text-[#00a86b] hover:text-[#008e60] font-bold flex items-center gap-1.5 transition bg-[#e1f7ec] px-3 py-1.5 rounded-lg border border-[#98e6c4]"
                >
                  <Crosshair className="w-3.5 h-3.5 text-[#00a86b]" />
                  <span>Touch Map to Pick Start Location</span>
                </button>
              )}
            </div>

            {/* Destination Point */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                🏁 Destination (Today)
              </span>
              <p className="text-gray-900 font-bold text-sm sm:text-base truncate">
                {activeDestText}
              </p>

              {/* If College to Home: Fixed with button to touch map and set Home */}
              {mode === 'FROM_COLLEGE' && (
                <button
                  type="button"
                  onClick={() => openMapPicker('HOME')}
                  className="mt-2.5 text-xs text-[#00a86b] hover:text-[#008e60] font-bold flex items-center gap-1.5 transition bg-[#e1f7ec] px-3 py-1.5 rounded-lg border border-[#98e6c4]"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#00a86b]" />
                  <span>Touch Map to Set / Change Home Location</span>
                </button>
              )}

              {/* If Custom Route: Button to pick custom destination on map */}
              {mode === 'CUSTOM' && (
                <button
                  type="button"
                  onClick={() => openMapPicker('CUSTOM_DEST')}
                  className="mt-2.5 text-xs text-[#00a86b] hover:text-[#008e60] font-bold flex items-center gap-1.5 transition bg-[#e1f7ec] px-3 py-1.5 rounded-lg border border-[#98e6c4]"
                >
                  <Crosshair className="w-3.5 h-3.5 text-[#00a86b]" />
                  <span>Touch Map to Pick Destination</span>
                </button>
              )}

              {mode !== 'CUSTOM' && (
                <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>BITM Campus Designated Route Corridor</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Below Custom Routes ONLY: Options of selecting zones (text-only, NO emojis, hostels removed) */}
          {mode === 'CUSTOM' && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div>
                <span className="text-xs font-bold text-gray-700 block mb-2">
                  Select Starting Point Zone:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ZONES.map((zone) => (
                    <button
                      key={'origin-' + zone.name}
                      type="button"
                      onClick={() => {
                        setCustomOrigin(zone.name);
                        setCustomOriginCoords(zone.coords);
                        saveCommuteSettings(mode, null, null, zone.name, zone.coords, customDest, customDestCoords);
                      }}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition font-medium ${
                        customOrigin === zone.name
                          ? 'bg-[#00b87c] text-white border-[#00b87c] shadow-xs font-bold'
                          : 'bg-white hover:bg-[#e1f7ec] hover:text-[#00a86b] border-gray-200 text-gray-700'
                      }`}
                    >
                      {zone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 block mb-2">
                  Select Destination Zone:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ZONES.map((zone) => (
                    <button
                      key={'dest-' + zone.name}
                      type="button"
                      onClick={() => {
                        setCustomDest(zone.name);
                        setCustomDestCoords(zone.coords);
                        saveCommuteSettings(mode, null, null, customOrigin, customOriginCoords, zone.name, zone.coords);
                      }}
                      className={`text-xs px-3.5 py-1.5 rounded-full border transition font-medium ${
                        customDest === zone.name
                          ? 'bg-[#00b87c] text-white border-[#00b87c] shadow-xs font-bold'
                          : 'bg-white hover:bg-[#e1f7ec] hover:text-[#00a86b] border-gray-200 text-gray-700'
                      }`}
                    >
                      {zone.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs animate-pulse">
                ✓ Route Saved
              </span>
            </div>
          )}
        </div>

        {/* Direct Action Buttons: Proceed to Find or Offer */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => {
              saveCommuteSettings();
              navigate('/find-ride');
            }}
            className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" />
            <span>Find a Ride on Today's Route ➔</span>
          </button>

          <button
            type="button"
            onClick={() => {
              saveCommuteSettings();
              navigate('/offer-ride');
            }}
            className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-full bg-[#111827] dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 border border-transparent dark:border-gray-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bike className="w-4 h-4" />
            <span>Offer a Ride on Today's Route ➔</span>
          </button>
        </div>
      </div>

      {/* 3. Interactive Location Picker Modal (Touch/Click Map) */}
      {mapPickerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[28px] w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00b87c] text-white flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">
                    {mapPickerTarget === 'HOME' ? 'Set Home Location on Map' : 'Touch Map to Select Location'}
                  </h3>
                  <p className="text-gray-500 text-xs">
                    Touch or click anywhere on the map to drop your pin in Ballari
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMapPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-200/70 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Map Area */}
            <div className="relative h-[360px] sm:h-[400px] w-full bg-gray-100 overflow-hidden">
              <LeafletPinPicker
                initialCoords={tempPinCoords}
                onLocationChange={handlePinLocationChange}
              />

              {/* Touch map floating instruction banner */}
              <div className="absolute top-3 left-3 right-3 z-[1001] bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 font-semibold shadow-md flex items-center justify-between pointer-events-auto">
                <span>📍 Touch/Click anywhere on the map to drop pin</span>
                {geocoding && <span className="text-[#00a86b] animate-pulse">Resolving address...</span>}
              </div>
            </div>

            {/* Modal Footer with Selected Address & Confirm Button */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-white space-y-3">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800">
                <span className="font-bold text-gray-500 block text-[10px] uppercase mb-0.5">Selected Address:</span>
                <p className="font-bold text-gray-900 truncate">
                  {tempAddress || `Coordinates (${tempPinCoords.lat.toFixed(4)}, ${tempPinCoords.lng.toFixed(4)})`}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMapPickerOpen(false)}
                  className="flex-1 py-3 rounded-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMapSelection}
                  className="flex-1 py-3 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs shadow-sm transition"
                >
                  Confirm & Lock Location 📍
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        
        {/* Card 1: Find a Ride (Soft Mint Tint) */}
        <div className="bg-[#eaf7f2] border border-[#daf1e8] rounded-[28px] p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            <div className="w-12 h-12 rounded-full bg-[#111827] flex items-center justify-center text-white mb-5 shadow-sm">
              <Compass className="w-6 h-6" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Find a Ride</h2>
          </div>

          <div>
            <Link
              to="/find-ride"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
            >
              <span>Search Rides</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Offer a Ride */}
        <div className="bg-white border border-gray-100 rounded-[28px] p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            <div className="w-12 h-12 rounded-full bg-[#111827] flex items-center justify-center text-white mb-5 shadow-sm">
              <Bike className="w-6 h-6" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Offer a Ride</h2>
          </div>

          <div>
            <Link
              to="/offer-ride"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
            >
              <span>Publish Ride</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: UPCOMING RIDE */}
        <div className="bg-white border border-gray-100 rounded-[28px] p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              UPCOMING RIDE
            </div>

            {upcomingRide ? (
              <div className="space-y-2 mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {upcomingRide.destAddress || 'Campus Commute'}
                </h2>
                <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl inline-block font-semibold">
                  ⏰ Departure: {upcomingRide.departureTime ? format12Hour(upcomingRide.departureTime) : 'Today'}
                </div>
                <p className="text-xs text-gray-600 font-medium pt-0.5">
                  Driver: <strong className="text-gray-900">{upcomingRide.driverName}</strong>
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">No upcoming ride</h2>
                <p className="text-gray-400 text-xs">
                  No accepted bookings scheduled.
                </p>
              </div>
            )}
          </div>

          <div>
            {upcomingRide ? (
              <Link
                to={`/track/${upcomingRide._id}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
              >
                <span>Track Ride Live</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/find-ride"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
              >
                <span>Find a Ride</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
