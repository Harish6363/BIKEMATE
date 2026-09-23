import React, { useState, useRef, useEffect, useContext } from 'react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import MapComponent from '../components/MapComponent';
import { AuthContext } from '../context/AuthContext';

const LIBRARIES = ['places'];

const QUICK_SPOTS = [
  'KHB Colony, Ballari',
  'Ballari Main Bus Stand',
  'Cantonment, Ballari',
  'Gandhi Nagar, Ballari',
  'Sudha Cross, Ballari'
];

function FindRide() {
  const { user } = useContext(AuthContext);
  const collegeAddress = user?.college || 'Ballari Institute of Technology and Management, Ballari';
  const navigate = useNavigate();

  const [direction, setDirection] = useState('TO_COLLEGE'); // 'TO_COLLEGE' | 'FROM_COLLEGE'
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState(collegeAddress);
  const [userCoords, setUserCoords] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [rides, setRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [requestedRides, setRequestedRides] = useState({});
  const [lastRequestedRide, setLastRequestedRide] = useState(null);
  const [requestMsg, setRequestMsg] = useState('');

  const originRef = useRef();
  const destRef = useRef();
  const autocompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // Automatically detect user's current live location via browser Geolocation API
  const detectMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported by browser');
      return;
    }

    setDetectingLocation(true);
    setLocationStatus('📡 Acquiring GPS position...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);

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
          console.warn('Geocoding error:', err);
        }
      },
      (err) => {
        console.warn('GPS Error:', err.message);
        setDetectingLocation(false);
        setLocationStatus('⚠️ GPS inactive. Tap a quick spot below.');
        setUserCoords({ lat: 15.1394, lng: 76.9214 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Fetch initial active rides across campus so student sees all riders on map right away
  useEffect(() => {
    const fetchCampusRides = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rides');
        setRides(res.data);
      } catch (e) {
        console.error('Error fetching initial campus rides:', e);
      }
    };
    fetchCampusRides();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      detectMyLocation();
    }
  }, [isLoaded]);

  // Handle switching direction between Going to College and Returning Home
  const handleDirectionSwitch = (newDir) => {
    setDirection(newDir);
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
    if (direction === 'TO_COLLEGE') {
      setOriginText(spot);
      if (originRef.current) originRef.current.value = spot;
    } else {
      setDestText(spot);
      if (destRef.current) destRef.current.value = spot;
    }
    setLocationStatus(`📍 Selected: ${spot}`);
  };

  const searchRides = async () => {
    let finalOrigin = (direction === 'TO_COLLEGE'
      ? (originText || originRef.current?.value || '')
      : collegeAddress).trim();

    let finalDest = (direction === 'TO_COLLEGE'
      ? collegeAddress
      : (destText || destRef.current?.value || '')).trim();

    if (!finalOrigin) {
      if (userCoords) {
        finalOrigin = `My Location (${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)})`;
      } else {
        finalOrigin = QUICK_SPOTS[0];
      }
      setOriginText(finalOrigin);
    }

    setLoading(true);
    setSearched(true);

    try {
      let oLng = userCoords ? userCoords.lng : 76.9214;
      let oLat = userCoords ? userCoords.lat : 15.1394;
      let dLng = 76.8837;
      let dLat = 15.1278;

      if (window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        try {
          const [oRes, dRes] = await Promise.all([
            geocoder.geocode({ address: finalOrigin }),
            geocoder.geocode({ address: finalDest }),
          ]);
          if (oRes?.results?.[0]?.geometry?.location) {
            oLng = oRes.results[0].geometry.location.lng();
            oLat = oRes.results[0].geometry.location.lat();
          }
          if (dRes?.results?.[0]?.geometry?.location) {
            dLng = dRes.results[0].geometry.location.lng();
            dLat = dRes.results[0].geometry.location.lat();
          }
        } catch (e) {}
      }

      const res = await axios.get('http://localhost:5000/api/rides', {
        params: { originLng: oLng, originLat: oLat, destLng: dLng, destLat: dLat }
      });
      setRides(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRide = async (rideId, driverName) => {
    try {
      const oCoords = userCoords ? [userCoords.lng, userCoords.lat] : [76.9214, 15.1394];
      const res = await axios.post(`http://localhost:5000/api/rides/${rideId}/request`, {
        pickupCoords: oCoords,
        pickupAddress: originText || 'Current Location'
      });
      setRequestedRides(prev => ({ ...prev, [rideId]: true }));
      setLastRequestedRide(rideId);
      const fare = res.data.fare || 17;
      const dist = res.data.distanceKm || 8.5;
      setRequestMsg(`🎉 Seat requested with ${driverName}! Calculated Fare: ₹${fare} (${dist} km @ ₹2/km)`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit ride request.');
    }
  };

  return (
    <div className="space-y-6 pt-1">
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Find a Ride</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Fixed Campus: <span className="text-[#00a86b] font-semibold">{collegeAddress}</span>
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

        {/* Gender Isolation Commute Banner */}
        {user?.gender === 'female' ? (
          <div className="mb-5 p-3.5 rounded-2xl bg-pink-50/90 border border-pink-200 text-pink-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌸</span>
              <div>
                <span className="font-bold block text-pink-950">Ladies-Only Safe Commute Active</span>
                <span className="text-pink-700 text-xs">Girls can only give and take rides from girls. Mapped exclusively to female drivers.</span>
              </div>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-pink-200/60 text-pink-800 text-xs font-bold border border-pink-300">
              👩 Girls ↔ Girls
            </span>
          </div>
        ) : (
          <div className="mb-5 p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🛡️</span>
              <div>
                <span className="font-bold block text-blue-950">Gents-Only Safe Commute Active</span>
                <span className="text-blue-700 text-xs">Boys can only give and take rides from boys. Mapped exclusively to male drivers.</span>
              </div>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-blue-200/60 text-blue-800 text-xs font-bold border border-blue-300">
              👨 Boys ↔ Boys
            </span>
          </div>
        )}

        {requestMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏍️</span>
              <div>
                <strong className="block text-sm font-bold text-gray-900">{requestMsg}</strong>
                <span className="text-xs text-[#00a86b]">Live GPS tracking and approach radar are active.</span>
              </div>
            </div>
            <Link
              to={`/track/${lastRequestedRide || 'latest'}`}
              className="px-5 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>📍 Track Driver Live GPS 🚀</span>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left panel */}
          <div>
            <div className="bg-white border border-gray-100 rounded-[24px] p-6 mb-6 shadow-xs">
              {isLoaded ? (
                <div className="space-y-4">
                  {/* Origin Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        {direction === 'TO_COLLEGE' ? '📍 My Current Location (Pickup)' : '🏫 College Campus (Starting Point)'}
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
                          placeholder="Detecting GPS or pick a spot below..."
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

                  {/* Destination Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        {direction === 'TO_COLLEGE' ? '🏫 College Destination (Fixed)' : '🏡 My Home / Drop-off Location'}
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
                          placeholder="Where are you heading?"
                        />
                      </Autocomplete>
                    )}
                  </div>

                  {/* Quick spots */}
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

                  <button
                    type="button"
                    onClick={searchRides}
                    disabled={loading}
                    className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Searching Nearby Route Matches...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>Search Nearby Student Rides</span>
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

            {/* Results */}
            {searched && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {rides.length} matching ride{rides.length === 1 ? '' : 's'} on this route
                  </h3>
                </div>

                {rides.length === 0 && !loading && (
                  <div className="text-center p-8 rounded-[24px] bg-white border border-gray-100 shadow-xs text-gray-500">
                    <div className="text-4xl mb-3">🏍️</div>
                    <p className="font-semibold text-gray-900 mb-1">No rides found on this exact route right now</p>
                    <p className="text-xs text-gray-500">Try selecting a different pickup spot above or check back shortly.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {rides.map((ride) => (
                    <div key={ride._id} className="p-5 rounded-[24px] bg-white border border-gray-100 hover:border-[#98e6c4] hover:shadow-md transition shadow-xs">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-900 font-bold flex items-center gap-2 flex-wrap">
                            {ride.offeredBy?.name || 'Fellow Student'}
                            <span className="text-xs bg-[#e1f7ec] text-[#00a86b] px-2.5 py-0.5 rounded-full font-semibold border border-[#98e6c4]">Verified Student</span>
                            {ride.gender === 'female' ? (
                              <span className="text-xs bg-pink-50 text-pink-700 px-2.5 py-0.5 rounded-full font-bold border border-pink-200 flex items-center gap-1">
                                🌸 Ladies Ride
                              </span>
                            ) : (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1">
                                🛡️ Gents Ride
                              </span>
                            )}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">{ride.offeredBy?.college || collegeAddress}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e1f7ec] text-[#00a86b]">
                          Available
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-xs text-gray-700 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100 gap-2">
                        <div className="flex items-center gap-3">
                          <span>🪑 <strong>{ride.seatsAvailable}</strong> seat</span>
                          <span>📏 <strong>{ride.distanceKm || 8.5} km</strong></span>
                          <span>⏰ <strong>{new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                        </div>
                        <div className="text-right">
                          <div className="text-[#00a86b] font-extrabold text-sm">
                            ₹{ride.pricePerSeat} <span className="text-[10px] text-gray-400 font-normal">(@ ₹2/km)</span>
                          </div>
                          <span className="text-[10px] text-emerald-600 block font-medium">
                            ⚡ Save ₹{Math.max(50, 100 - (ride.pricePerSeat || 17))} vs Auto
                          </span>
                        </div>
                      </div>
                      {requestedRides[ride._id] ? (
                        <div className="flex gap-2">
                          <div className="flex-1 py-2.5 rounded-full text-xs font-bold text-center bg-[#e1f7ec] text-[#00a86b] border border-[#98e6c4] flex items-center justify-center gap-1">
                            <span>✓</span>
                            <span>Requested</span>
                          </div>
                          <Link
                            to={`/track/${ride._id}`}
                            state={{ ride, driver: ride.offeredBy }}
                            className="flex-1 py-2.5 rounded-full text-xs font-bold text-center bg-[#00b87c] hover:bg-[#00a36e] text-white shadow-xs transition flex items-center justify-center gap-1.5"
                          >
                            <span>📍 Track Live GPS 🚀</span>
                          </Link>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleRequestRide(ride._id, ride.offeredBy?.name || 'Driver')}
                          disabled={ride.seatsAvailable <= 0}
                          className="w-full py-2.5 rounded-full text-sm font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <span>Request to Join Ride 🏍️</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map display */}
          <div className="h-[620px] sticky top-8 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <span>🗺️</span>
                <span>Campus Radar ({rides.length} live riders around Ballari)</span>
              </span>
              <Link
                to="/track"
                className="text-xs text-[#00a86b] hover:underline font-bold flex items-center gap-1 transition"
              >
                <span>📍 Live GPS Tracking 🚀</span>
              </Link>
            </div>
            <div className="flex-1 rounded-[24px] overflow-hidden border border-gray-100 shadow-xs">
              <MapComponent
                origin={direction === 'TO_COLLEGE' ? originText : collegeAddress}
                destination={direction === 'TO_COLLEGE' ? collegeAddress : destText}
                userCoords={userCoords}
                rides={rides}
                selectedRide={selectedRide}
                onSelectRide={(r) => setSelectedRide(r)}
                onRequestRide={(rId, dName) => handleRequestRide(rId, dName)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FindRide;
