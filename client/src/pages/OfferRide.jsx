import React, { useState, useRef, useEffect, useContext } from 'react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import { AuthContext } from '../context/AuthContext';

const LIBRARIES = ['places'];

// Popular campus pickup spots in Ballari for 1-click selection
const QUICK_SPOTS = [
  'KHB Colony, Ballari',
  'Ballari Main Bus Stand',
  'Cantonment, Ballari',
  'Gandhi Nagar, Ballari',
  'Sudha Cross, Ballari'
];

const BITM_COORDS = { lat: 15.1677, lng: 76.8506 };

const SPOT_COORDS = {
  'KHB Colony, Ballari': { lat: 15.1480, lng: 76.9280 },
  'Ballari Main Bus Stand': { lat: 15.1450, lng: 76.9250 },
  'Cantonment, Ballari': { lat: 15.1320, lng: 76.9150 },
  'Gandhi Nagar, Ballari': { lat: 15.1420, lng: 76.9310 },
  'Sudha Cross, Ballari': { lat: 15.1400, lng: 76.9180 }
};

const calculateHaversineKm = (lat1, lon1, lat2, lon2) => {
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

function OfferRide() {
  const { user } = useContext(AuthContext);
  const collegeAddress = user?.college || 'Ballari Institute of Technology and Management, Ballari';

  const [direction, setDirection] = useState('TO_COLLEGE'); // 'TO_COLLEGE' | 'FROM_COLLEGE'
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState(collegeAddress);
  const [userCoords, setUserCoords] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [time, setTime] = useState(() => {
    const d = new Date(Date.now() + 30 * 60000);
    return d.toTimeString().slice(0, 5);
  });
  const [seats, setSeats] = useState(1);
  const [distanceKm, setDistanceKm] = useState(8.5);
  const [price, setPrice] = useState(17); // 8.5 km * 2 = 17
  const RATE_PER_KM = 2.0; // ₹2/KM
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const originRef = useRef();
  const destRef = useRef();
  const autocompleteRef = useRef(null);
  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const recalculatePrice = (coords) => {
    const lat = coords?.lat || 15.1480;
    const lng = coords?.lng || 76.9280;
    const dist = calculateHaversineKm(lat, lng, BITM_COORDS.lat, BITM_COORDS.lng);
    setDistanceKm(dist);
    const fairPrice = Math.max(10, Math.round(dist * RATE_PER_KM));
    setPrice(fairPrice);
  };

  // Automatically detect user's current GPS location
  const detectMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS not supported by your browser');
      return;
    }

    setDetectingLocation(true);
    setLocationStatus('📡 Acquiring GPS position...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        recalculatePrice(coords);

        // 1. Immediately set originText so the form is populated with the locked coordinates
        const immediateLabel = `My Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
        if (direction === 'TO_COLLEGE') {
          setOriginText(immediateLabel);
          if (originRef.current) originRef.current.value = immediateLabel;
        } else {
          setDestText(immediateLabel);
          if (destRef.current) destRef.current.value = immediateLabel;
        }
        setLocationStatus(`📍 GPS Locked: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        setDetectingLocation(false);

        // 2. Try reverse geocoding asynchronously using standard callback
        try {
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: coords }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const fullAddr = results[0].formatted_address;
                if (direction === 'TO_COLLEGE') {
                  setOriginText(fullAddr);
                  if (originRef.current) originRef.current.value = fullAddr;
                } else {
                  setDestText(fullAddr);
                  if (destRef.current) destRef.current.value = fullAddr;
                }
                setLocationStatus(`📍 Detected: ${results[0].address_components?.[1]?.long_name || fullAddr.slice(0, 30)}`);
              }
            });
          }
        } catch (err) {
          console.warn('Reverse geocode error:', err.message);
        }
      },
      (err) => {
        console.warn('GPS Error:', err.message);
        setDetectingLocation(false);
        setLocationStatus('⚠️ GPS inactive. Tap a quick spot below.');
        // Set Ballari default coordinates so map still works
        setUserCoords({ lat: 15.1394, lng: 76.9214 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (isLoaded) {
      detectMyLocation();
    }
  }, [isLoaded]);

  // Handle switching direction between Going to College and Returning Home
  const handleDirectionSwitch = (newDir) => {
    setDirection(newDir);
    setError('');
    if (newDir === 'TO_COLLEGE') {
      setDestText(collegeAddress);
      if (originRef.current && originText) {
        originRef.current.value = originText;
      }
    } else {
      setOriginText(collegeAddress);
      if (originRef.current) {
        originRef.current.value = collegeAddress;
      }
    }
  };

  const handleSpotSelect = (spot) => {
    setError('');
    if (direction === 'TO_COLLEGE') {
      setOriginText(spot);
      if (originRef.current) originRef.current.value = spot;
    } else {
      setDestText(spot);
      if (destRef.current) destRef.current.value = spot;
    }
    if (SPOT_COORDS[spot]) {
      recalculatePrice(SPOT_COORDS[spot]);
    }
    setLocationStatus(`📍 Selected: ${spot}`);
  };

  const submitRide = async () => {
    setError('');

    // Determine final origin and destination values with automatic fallbacks
    let finalOrigin = (direction === 'TO_COLLEGE'
      ? (originText || originRef.current?.value || '')
      : collegeAddress).trim();

    let finalDest = (direction === 'TO_COLLEGE'
      ? collegeAddress
      : (destText || destRef.current?.value || '')).trim();

    // Auto-resolve if empty
    if (!finalOrigin) {
      if (userCoords) {
        finalOrigin = `My Location (${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)})`;
      } else {
        finalOrigin = QUICK_SPOTS[0];
      }
      setOriginText(finalOrigin);
    }

    if (!finalDest) {
      finalDest = collegeAddress;
      setDestText(finalDest);
    }

    setLoading(true);

    try {
      // Use exact GPS coordinates if available, otherwise default to Ballari
      let oCoords = userCoords ? [userCoords.lng, userCoords.lat] : [76.9214, 15.1394];
      let dCoords = [76.8837, 15.1278]; // BITM campus coords

      // Try geocoding destination address if custom
      if (window.google?.maps?.Geocoder && finalDest !== collegeAddress) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: finalDest }, (res, status) => {
            if (status === 'OK' && res?.[0]?.geometry?.location) {
              dCoords = [res[0].geometry.location.lng(), res[0].geometry.location.lat()];
            }
          });
        } catch (e) {}
      }

      const departureDate = new Date();
      if (time) {
        const [h, m] = time.split(':');
        departureDate.setHours(parseInt(h), parseInt(m), 0);
      } else {
        departureDate.setMinutes(departureDate.getMinutes() + 30);
      }

      const payload = {
        originCoords: oCoords,
        destCoords: dCoords,
        originAddress: finalOrigin,
        destAddress: finalDest,
        departureTime: departureDate,
        seatsAvailable: parseInt(seats) || 1,
        distanceKm: parseFloat(distanceKm),
        ratePerKm: RATE_PER_KM,
        pricePerSeat: parseInt(price) || 50,
      };

      await axios.post('http://localhost:5000/api/rides', payload);

      setSuccess('🎉 Ride successfully published for campus!');
      setTimeout(() => navigate('/rides'), 1200);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to publish ride. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-1">
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Offer a Ride</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Fixed College: <span className="text-[#00a86b] font-semibold">{collegeAddress}</span>
            </p>
          </div>

          {/* Direction toggle pill */}
          <div className="inline-flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
            <button
              onClick={() => handleDirectionSwitch('TO_COLLEGE')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                direction === 'TO_COLLEGE'
                  ? 'bg-[#00b87c] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🏠 ➡️ 🏫</span>
              <span>Going to College</span>
            </button>
            <button
              onClick={() => handleDirectionSwitch('FROM_COLLEGE')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                direction === 'FROM_COLLEGE'
                  ? 'bg-[#00b87c] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🏫 ➡️ 🏡</span>
              <span>Heading Home</span>
            </button>
          </div>
        </div>
        
        {/* Gender Isolation Driver Guarantee Banner */}
        {user?.gender === 'female' ? (
          <div className="mb-5 p-3.5 rounded-2xl bg-pink-50/90 border border-pink-200 text-pink-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌸</span>
              <div>
                <span className="font-bold block text-pink-950">Ladies-Only Commute Protection Active</span>
                <span className="text-pink-700 text-xs">This ride will only be visible to and requestable by female students. Boys cannot request this ride.</span>
              </div>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-pink-200/60 text-pink-800 text-xs font-bold border border-pink-300">
              👩 Girls Ride With Girls
            </span>
          </div>
        ) : (
          <div className="mb-5 p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🛡️</span>
              <div>
                <span className="font-bold block text-blue-950">Gents-Only Commute Protection Active</span>
                <span className="text-blue-700 text-xs">This ride will only be visible to and requestable by male students. Girls cannot request this ride.</span>
              </div>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-blue-200/60 text-blue-800 text-xs font-bold border border-blue-300">
              👨 Boys Ride With Boys
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Form */}
          <div className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-xs">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-5 p-3.5 rounded-xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-sm flex items-center gap-2">
                <span>✅</span>
                <span>{success}</span>
              </div>
            )}

            {isLoaded ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4">
                  {/* Starting Point */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        {direction === 'TO_COLLEGE' ? '📍 My Starting Location' : '🏫 College Campus (Starting Point)'}
                      </label>
                      {direction === 'TO_COLLEGE' && (
                        <button
                          type="button"
                          onClick={detectMyLocation}
                          disabled={detectingLocation}
                          className="text-xs text-[#00a86b] hover:text-[#008e60] font-semibold flex items-center gap-1 transition"
                        >
                          <span className={detectingLocation ? 'animate-spin' : ''}>🎯</span>
                          {detectingLocation ? 'Locating...' : 'Use Current GPS'}
                        </button>
                      )}
                    </div>
                    {direction === 'TO_COLLEGE' ? (
                      <Autocomplete
                        onLoad={(auto) => { autocompleteRef.current = auto; }}
                        onPlaceChanged={() => {
                          const place = autocompleteRef.current?.getPlace();
                          if (place?.formatted_address) {
                            setOriginText(place.formatted_address);
                          } else if (originRef.current?.value) {
                            setOriginText(originRef.current.value);
                          }
                        }}
                      >
                        <input
                          ref={originRef}
                          value={originText}
                          onChange={(e) => setOriginText(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                          placeholder="Detecting GPS or choose a spot below..."
                        />
                      </Autocomplete>
                    ) : (
                      <div className="relative">
                        <input
                          readOnly
                          value={collegeAddress}
                          className="w-full px-4 py-3 rounded-xl bg-[#eaf7f2] border border-[#daf1e8] text-[#00a86b] font-medium cursor-not-allowed text-sm"
                        />
                        <span className="absolute right-3 top-2.5 text-xs bg-[#e1f7ec] text-[#00a86b] px-2 py-1 rounded-md font-medium">Campus</span>
                      </div>
                    )}
                  </div>

                  {/* Destination */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        {direction === 'TO_COLLEGE' ? '🏫 College Destination (Fixed)' : '🏡 Drop-off Location'}
                      </label>
                      {direction === 'FROM_COLLEGE' && (
                        <button
                          type="button"
                          onClick={detectMyLocation}
                          disabled={detectingLocation}
                          className="text-xs text-[#00a86b] hover:text-[#008e60] font-semibold flex items-center gap-1 transition"
                        >
                          <span className={detectingLocation ? 'animate-spin' : ''}>🎯</span>
                          {detectingLocation ? 'Locating...' : 'Use Current GPS'}
                        </button>
                      )}
                    </div>
                    {direction === 'TO_COLLEGE' ? (
                      <div className="relative">
                        <input
                          readOnly
                          value={collegeAddress}
                          className="w-full px-4 py-3 rounded-xl bg-[#eaf7f2] border border-[#daf1e8] text-[#00a86b] font-medium cursor-not-allowed text-sm"
                        />
                        <span className="absolute right-3 top-2.5 text-xs bg-[#e1f7ec] text-[#00a86b] px-2 py-1 rounded-md font-medium">Campus</span>
                      </div>
                    ) : (
                      <Autocomplete
                        onPlaceChanged={() => {
                          if (destRef.current?.value) {
                            setDestText(destRef.current.value);
                          }
                        }}
                      >
                        <input
                          ref={destRef}
                          value={destText}
                          onChange={(e) => setDestText(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                          placeholder="Where are you dropping off?"
                        />
                      </Autocomplete>
                    )}
                  </div>
                </div>

                {/* Quick campus spots */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">⚡ Quick Campus Pickup Spots in Ballari:</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SPOTS.map((spot) => (
                      <button
                        key={spot}
                        type="button"
                        onClick={() => handleSpotSelect(spot)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          originText === spot
                            ? 'bg-[#00b87c] text-white border-[#00b87c] font-semibold shadow-xs'
                            : 'bg-gray-100 hover:bg-[#e1f7ec] hover:text-[#00a86b] border-transparent hover:border-[#98e6c4] text-gray-700'
                        }`}
                      >
                        📍 {spot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location status badge */}
                {locationStatus && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span>{locationStatus}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-2 block">⏰ Departure Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-2 block">🪑 Available Seats</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={seats}
                      onChange={(e) => setSeats(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                    />
                  </div>
                </div>

                {/* System Fair-Share Pricing Engine Card */}
                <div className="bg-[#eaf7f2] rounded-2xl border border-[#daf1e8] p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                        System Fair-Share Pricing Engine
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#e1f7ec] text-[#00a86b] border border-[#98e6c4]">
                      ₹2.00 / KM (Cheap Fuel Share)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-gray-100 text-center">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-0.5">Est. Route</span>
                      <span className="text-sm font-bold text-gray-900">{distanceKm} km</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-0.5">Campus Rate</span>
                      <span className="text-sm font-bold text-[#00b87c]">₹2.00 / km</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-0.5">Auto-Calculated Fare</span>
                      <span className="text-sm font-black text-[#00a86b]">₹{price} / seat</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-600 pt-1 gap-1">
                    <span className="flex items-center gap-1 text-[#00a86b]">
                      <span>🛡️</span>
                      <span>Based on distance to BITM Campus ({distanceKm} km × ₹2)</span>
                    </span>
                    <span className="text-emerald-700 font-semibold text-[11px]">
                      Saves students ₹{Math.max(50, 100 - price)} vs Auto (₹100+)
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#e1f7ec] border border-[#98e6c4] text-xs text-[#00a86b] flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Your ride is only visible to verified students from your college community.</span>
                </div>

                <button
                  type="button"
                  onClick={submitRide}
                  disabled={loading}
                  className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Publishing Ride...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Publish Ride for Campus</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-gray-500 gap-2">
                <div className="animate-spin text-2xl">🌍</div>
                <span>Connecting to Google Maps & GPS...</span>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="h-[550px] sticky top-8 rounded-[24px] overflow-hidden border border-gray-100 shadow-xs">
            <MapComponent
              origin={direction === 'TO_COLLEGE' ? originText : collegeAddress}
              destination={direction === 'TO_COLLEGE' ? collegeAddress : destText}
              userCoords={userCoords}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default OfferRide;
