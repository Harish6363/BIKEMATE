import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Compass, ShieldCheck, Sparkles, Navigation, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import MapComponent from '../components/MapComponent';
import { AuthContext } from '../context/AuthContext';
import { format12Hour } from '../utils/timeFormat';

const COMMUTE_STORAGE_KEY = 'bikemate_today_commute';

function FindRide() {
  const { user } = useContext(AuthContext);
  const collegeAddress = user?.college || 'Ballari Institute of Technology and Management, Ballari';
  const navigate = useNavigate();

  // Route inherited from Dashboard
  const [commuteRoute, setCommuteRoute] = useState(() => {
    try {
      const saved = localStorage.getItem(COMMUTE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.originCoords) && Array.isArray(parsed.destCoords)) {
          return parsed;
        }
      }
    } catch (e) {}
    return {
      mode: 'TO_COLLEGE',
      originText: 'KHB Colony, Ballari',
      originCoords: [76.9214, 15.1394],
      destText: 'Ballari Institute of Technology and Management, Ballari',
      destCoords: [76.8506, 15.1677],
      distanceKm: 8.5
    };
  });

  const [userCoords, setUserCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Acquiring GPS position...');
  const [rides, setRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [requestedRides, setRequestedRides] = useState({});
  const [lastRequestedRide, setLastRequestedRide] = useState(null);
  const [requestMsg, setRequestMsg] = useState('');
  const [switchConfirm, setSwitchConfirm] = useState(null); // { rideId, driverName, conflictingRequest }

  // Polylines for Dual-Color Map Visualization
  const [driverRoutePoints, setDriverRoutePoints] = useState(null);
  const [sharedRoutePoints, setSharedRoutePoints] = useState(null);
  const [detourRoutePoints, setDetourRoutePoints] = useState(null);

  // 1. Detect live user coordinates (Rider location) for red circle icon
  useEffect(() => {
    const oCoords = commuteRoute?.originCoords || [76.9214, 15.1394];
    if (!navigator.geolocation) {
      setLocationStatus('GPS not supported, using route origin');
      setUserCoords({ lat: oCoords[1], lng: oCoords[0] });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocationStatus(`GPS Locked (🔴 Live Rider Pulse)`);
      },
      (err) => {
        console.warn('GPS Error, using saved route coords:', err.message);
        setUserCoords({ lat: oCoords[1], lng: oCoords[0] });
        setLocationStatus('Using Route Starting Point');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [commuteRoute]);

  // 2. Fetch OSRM coordinates for Driver master route and Rider shared commute
  const fetchDualRoutesForRide = useCallback(async (ride) => {
    if (!ride) return;
    try {
      const dOrig = ride.origin?.coordinates || ride.driverOriginCoords || [76.9214, 15.1394];
      const dDest = ride.destination?.coordinates || ride.driverDestCoords || [76.8506, 15.1677];
      const rOrig = commuteRoute.originCoords || [76.9214, 15.1394];
      const rDest = commuteRoute.destCoords || [76.8506, 15.1677];

      // Fetch Driver Route (Solid Blue)
      const driverRes = await axios.get(
        `http://localhost:5000/api/rides/osrm-route?originLng=${dOrig[0]}&originLat=${dOrig[1]}&destLng=${dDest[0]}&destLat=${dDest[1]}`
      );
      if (driverRes.data?.coordinates) {
        setDriverRoutePoints(driverRes.data.coordinates);
      }

      // Fetch Rider Shared Commute Route (Vibrant Green)
      const riderRes = await axios.get(
        `http://localhost:5000/api/rides/osrm-route?originLng=${rOrig[0]}&originLat=${rOrig[1]}&destLng=${rDest[0]}&destLat=${rDest[1]}`
      );
      if (riderRes.data?.coordinates) {
        setSharedRoutePoints(riderRes.data.coordinates);
      }

      // Detour Connector (Dashed Orange) between driver start and rider pickup
      if (Math.abs(dOrig[0] - rOrig[0]) > 0.002 || Math.abs(dOrig[1] - rOrig[1]) > 0.002) {
        setDetourRoutePoints([
          { lat: dOrig[1], lng: dOrig[0] },
          { lat: rOrig[1], lng: rOrig[0] }
        ]);
      } else {
        setDetourRoutePoints(null);
      }
    } catch (err) {
      console.warn('Error fetching dual routes:', err.message);
    }
  }, [commuteRoute]);

  // 3. Search rides matching today's commute corridor
  const searchRides = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const oCoords = commuteRoute?.originCoords || [76.9214, 15.1394];
      const dCoords = commuteRoute?.destCoords || [76.8506, 15.1677];
      const oLng = oCoords[0];
      const oLat = oCoords[1];
      const dLng = dCoords[0];
      const dLat = dCoords[1];

      const res = await axios.get('http://localhost:5000/api/rides', {
        params: { originLng: oLng, originLat: oLat, destLng: dLng, destLat: dLat }
      });

      // Filter out user's own rides so a driver never sees their own ride when searching
      const currentUserId = user?._id ? user._id.toString() : '';
      const availableRides = (res.data || []).filter(r => {
        const ownerId = (r.offeredBy?._id || r.offeredBy || '').toString();
        return !currentUserId || ownerId !== currentUserId;
      });

      setRides(availableRides);
      if (availableRides.length > 0) {
        setSelectedRide(availableRides[0]);
        fetchDualRoutesForRide(availableRides[0]);
      } else {
        setSelectedRide(null);
        setDriverRoutePoints(null);
        setSharedRoutePoints(null);
        setDetourRoutePoints(null);
      }
    } catch (err) {
      console.error('Error finding rides:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial search on page load
  useEffect(() => {
    searchRides();
  }, []);

  // Handle selecting a ride card
  const handleSelectRide = (ride) => {
    setSelectedRide(ride);
    fetchDualRoutesForRide(ride);
  };

  // Request to join ride (Supports cancelPrevious if switching drivers)
  const handleRequestRide = async (rideId, driverName, cancelPrevious = false) => {
    try {
      const oCoords = userCoords ? [userCoords.lng, userCoords.lat] : commuteRoute.originCoords;
      const res = await axios.post(`http://localhost:5000/api/rides/${rideId}/request`, {
        pickupCoords: oCoords,
        pickupAddress: commuteRoute.originText,
        cancelPrevious
      });
      setRequestedRides(prev => ({ ...prev, [rideId]: true }));
      setLastRequestedRide(rideId);
      const fare = res.data.fare || selectedRide?.calculatedFare || 17;
      const dist = res.data.distanceKm || selectedRide?.sharedDistanceKm || 8.5;
      setRequestMsg(`🎉 Seat requested with ${driverName}! Fair Share: ₹${fare} (${dist} km @ ₹2/km)`);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.hasActiveRequest) {
        setSwitchConfirm({
          rideId,
          driverName,
          conflictingRequest: err.response.data.conflictingRequest
        });
      } else {
        alert(err.response?.data?.message || 'Failed to submit ride request.');
      }
    }
  };

  return (
    <div className="space-y-6 pt-1">
      
      {/* 1. Header with Inherited Commute Route Banner */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">Find a Ride</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#00a86b] text-xs font-bold border border-emerald-200">
                Route Inherited from Dashboard
              </span>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Zero location typing needed. Matches student drivers travelling along today's commute corridor.
            </p>
          </div>

          {/* Quick link back to dashboard to change route */}
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-[#e1f7ec] hover:text-[#00a86b] text-xs font-bold text-gray-700 transition self-start lg:self-auto border border-gray-200/60"
          >
            <span>⚙️ Change Commute Route on Dashboard</span>
          </Link>
        </div>

        {/* Route Details Bar */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-blue-50/50 border border-emerald-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-gray-900">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>📍 Pickup (Rider):</span>
              <span className="text-[#00a86b] bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs font-semibold">
                {commuteRoute.originText}
              </span>
            </div>

            <span className="text-gray-400 font-bold">➔</span>

            <div className="flex items-center gap-1.5 font-bold text-gray-900">
              <span>🏁 Destination:</span>
              <span className="text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs font-semibold">
                {commuteRoute.destText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-gray-600 font-medium">
              Corridor Detour: <strong className="text-amber-600">500m–800m</strong>
            </span>
            <span className="text-gray-600 font-medium">
              Rate: <strong className="text-emerald-700">₹2.00/km</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Gender Safety & Faculty Commute Banner */}
      {(user?.role === 'faculty' || user?.userType === 'faculty') ? (
        <div className="p-3.5 rounded-2xl bg-purple-50/90 border border-purple-200 text-purple-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">👨‍🏫</span>
            <div>
              <span className="font-bold block text-purple-950">Faculty Commute Access Active</span>
              <span className="text-purple-700 text-xs">As a faculty member, any student driver (boy or girl) can pick you up for a ride along your route corridor.</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-200/60 text-purple-900 text-xs font-bold border border-purple-300 shrink-0">
            ✨ Any Driver (Boys & Girls)
          </span>
        </div>
      ) : user?.gender === 'female' ? (
        <div className="p-3.5 rounded-2xl bg-pink-50/90 border border-pink-200 text-pink-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌸</span>
            <div>
              <span className="font-bold block text-pink-950">Ladies-Only Safe Commute Active</span>
              <span className="text-pink-700 text-xs">Only verified female student drivers travelling in your route corridor are displayed.</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-pink-200/60 text-pink-800 text-xs font-bold border border-pink-300">
            👩 Girls ↔ Girls
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛡️</span>
            <div>
              <span className="font-bold block text-blue-950">Gents-Only Safe Commute Active</span>
              <span className="text-blue-700 text-xs">Only verified male student drivers travelling in your route corridor are displayed.</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-200/60 text-blue-800 text-xs font-bold border border-blue-300">
            👨 Boys ↔ Boys
          </span>
        </div>
      )}

      {/* Request Alert Message */}
      {requestMsg && (
        <div className="p-4 rounded-2xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏍️</span>
            <div>
              <strong className="block text-sm font-bold text-gray-900">{requestMsg}</strong>
              <span className="text-xs text-[#00a86b]">Live GPS tracking and boarding PIN are ready.</span>
            </div>
          </div>
          <Link
            to={`/track/${lastRequestedRide || 'latest'}`}
            className="px-5 py-2 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs shadow-xs transition shrink-0"
          >
            <span>📍 Track Driver Live GPS 🚀</span>
          </Link>
        </div>
      )}

      {/* 3. Main Grid: Left Rides List | Right Dual-Color Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (5 cols): Search Button & Matched Rides */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Big Search Route Matches Button */}
          <button
            type="button"
            onClick={searchRides}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#00b87c] to-[#009665] hover:from-[#00a36e] hover:to-[#00875a] text-white font-bold text-sm sm:text-base shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2.5"
          >
            {loading ? (
              <>
                <span className="animate-spin text-lg">⏳</span>
                <span>Calculating Corridor Matches...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Search Today's Route Matches</span>
              </>
            )}
          </button>

          {/* Results Summary Header */}
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 px-1">
            <span>
              {rides.length} Corridor Match{rides.length === 1 ? '' : 'es'} Found
            </span>
            <span className="text-[#00a86b]">
              {selectedRide ? `Viewing: ${selectedRide.offeredBy?.name || 'Driver'}` : 'Tap a ride to inspect'}
            </span>
          </div>

          {/* Empty State */}
          {searched && rides.length === 0 && !loading && (
            <div className="text-center p-8 rounded-[24px] bg-white border border-gray-100 shadow-xs text-gray-500">
              <div className="text-4xl mb-3">🏍️</div>
              <p className="font-bold text-gray-900 mb-1">No rides matching this corridor right now</p>
              <p className="text-xs text-gray-500 mb-4">
                You can try switching mode on Dashboard (e.g. Campus to Home) or offer a ride yourself!
              </p>
              <Link
                to="/offer-ride"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111827] text-white text-xs font-bold"
              >
                <span>Offer Ride Instead ➔</span>
              </Link>
            </div>
          )}

          {/* Matched Ride Cards */}
          <div className="space-y-3">
            {rides.map((ride) => {
              const isSelected = selectedRide?._id === ride._id;
              const matchType = ride.matchType || 'DIRECT_MATCH';

              return (
                <div
                  key={ride._id}
                  onClick={() => handleSelectRide(ride)}
                  className={`p-5 rounded-[24px] bg-white border-2 transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'border-[#00b87c] ring-2 ring-[#00b87c]/20 shadow-md bg-[#fafffd]'
                      : 'border-gray-100 hover:border-[#98e6c4]'
                  }`}
                >
                  {/* Top Match Tag & Gender Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {matchType === 'DIRECT_MATCH' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#00a86b] text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                        <span>🎯 Direct Route Match</span>
                        {ride.matchScore ? <span className="opacity-80">({ride.matchScore}%)</span> : null}
                      </span>
                    ) : matchType === 'EN_ROUTE_DROP_OFF' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 flex items-center gap-1">
                        <span>📍 En-Route Drop-Off</span>
                        {ride.matchScore ? <span className="opacity-80">({ride.matchScore}%)</span> : null}
                      </span>
                    ) : matchType === 'DETOUR_CORRIDOR' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                        <span>⚡ Corridor Detour (+{ride.additionalDistanceMeters || ride.detourMeters || 450}m)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200 flex items-center gap-1">
                        <span>🧭 Nearby Alternative (Lower Confidence)</span>
                      </span>
                    )}

                    <span className="text-[11px] font-extrabold text-[#00a86b] bg-[#e1f7ec] px-2.5 py-0.5 rounded-full">
                      ₹{ride.calculatedFare || ride.studentContribution || ride.pricePerSeat} (@ ₹2/km)
                    </span>
                  </div>

                  {/* Explainable Matching Reasoning */}
                  {ride.matchExplanation && (
                    <div className="mb-2.5 p-2 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-600 flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">💡</span>
                      <span className="leading-tight">{ride.matchExplanation}</span>
                    </div>
                  )}

                  {/* Driver Name & Vehicle Details */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-1.5">
                        <span>{ride.offeredBy?.name || 'Fellow Student'}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00a86b]" />
                      </h3>
                      {/* Driver Vehicle Info */}
                      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mt-0.5">
                        <span>🏍️</span>
                        <span>{ride.bikeName || 'Royal Enfield Hunter 350'}</span>
                        <span className="text-gray-400">•</span>
                        <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-800 font-mono text-[10px] uppercase font-bold border border-gray-200">
                          {ride.bikeNumber || 'KA-34-EA-4412'}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-gray-500 font-medium block">Departure</span>
                      <strong className="text-xs text-gray-900 font-bold">
                        {ride.departureTime ? format12Hour(ride.departureTime) : 'Flexible'}
                      </strong>
                    </div>
                  </div>

                  {/* Route Corridor Chips */}
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-[11px] text-gray-600 mb-3 space-y-1">
                    <div className="truncate">
                      <span className="text-gray-400 font-bold">From:</span> {ride.originAddress || 'Origin'}
                    </div>
                    <div className="truncate">
                      <span className="text-gray-400 font-bold">To:</span> {ride.destAddress || collegeAddress}
                    </div>
                  </div>

                  {/* Trip Stats & Auto Savings */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3.5">
                    <span>Shared: <strong className="text-gray-900">{ride.sharedDistanceKm || 8.5} km</strong></span>
                    <span>Auto: <span className="line-through text-gray-400 font-medium">₹{ride.estimatedAutoFare || Math.round((ride.sharedDistanceKm || 8.5) * 14)}</span></span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md" title="Compared to ₹14/km commercial auto rate">
                      ⚡ Save ₹{ride.savingsVsAuto || Math.max(0, Math.round((ride.sharedDistanceKm || 8.5) * 14) - (ride.calculatedFare || 17))} vs Auto
                    </span>
                  </div>

                  {/* Request Button */}
                  {requestedRides[ride._id] ? (
                    <div className="flex gap-2">
                      <div className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-[#e1f7ec] text-[#00a86b] border border-[#98e6c4] flex items-center justify-center gap-1">
                        <span>✓</span>
                        <span>Request Sent</span>
                      </div>
                      <Link
                        to={`/track/${ride._id}`}
                        state={{ ride, driver: ride.offeredBy }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-[#00b87c] hover:bg-[#00a36e] text-white shadow-xs transition flex items-center justify-center gap-1"
                      >
                        <span>Live GPS 🚀</span>
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestRide(ride._id, ride.offeredBy?.name || 'Driver');
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <span>Request to Join Ride 🏍️</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 cols): Map with Dual Polylines & Fair Share Breakdown */}
        <div className="lg:col-span-7 space-y-4 sticky top-6">
          
          {/* Map Section */}
          <div className="h-[460px] rounded-[24px] overflow-hidden border-2 border-gray-100 shadow-xs relative bg-gray-900">
            {/* Map Legend Floating Pill */}
            <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 bg-gray-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-[11px] text-white">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <strong>You (Rider Live GPS)</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1 bg-[#2563eb] rounded" />
                  <span>Driver Route</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1 bg-[#00b87c] rounded" />
                  <span>Shared Commute</span>
                </span>
                {detourRoutePoints && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1 bg-[#f97316] rounded" />
                    <span>500m–800m Detour</span>
                  </span>
                )}
              </div>

              <span className="text-cyan-400 font-mono text-[10px]">OSRM Routed</span>
            </div>

            <MapComponent
              origin={commuteRoute.originText}
              destination={commuteRoute.destText}
              userCoords={userCoords}
              userMarkerColor="#ef4444" // 🔴 RED Circle Icon for Rider
              rides={rides}
              selectedRide={selectedRide}
              onSelectRide={(r) => handleSelectRide(r)}
              onRequestRide={(rId, dName) => handleRequestRide(rId, dName)}
              driverRoutePoints={driverRoutePoints}
              sharedRoutePoints={sharedRoutePoints}
              detourRoutePoints={detourRoutePoints}
            />
          </div>

          {/* Details of Distance, Fair Calculation & Vehicle Breakdown Card */}
          {selectedRide ? (
            <div className="p-5 rounded-[24px] bg-white border border-gray-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-sm">Corridor Trip & Fair-Share Engine</h4>
                    <p className="text-gray-500 text-xs">Transparent Ballari student commute split</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#e1f7ec] text-[#00a86b] font-bold text-xs border border-[#98e6c4]">
                  ₹2.00 / KM Standard
                </span>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-500 block font-bold uppercase">Shared Commute</span>
                  <strong className="text-base font-extrabold text-gray-900">
                    {selectedRide.sharedDistanceKm || 8.5} km
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-500 block font-bold uppercase">Pickup Detour</span>
                  <strong className="text-base font-extrabold text-amber-600">
                    {selectedRide.detourMeters || 620} m
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100 text-center">
                  <span className="text-[10px] text-emerald-800 block font-bold uppercase">Calculated Fare</span>
                  <strong className="text-base font-black text-[#00a86b]">
                    ₹{selectedRide.calculatedFare || selectedRide.pricePerSeat}
                  </strong>
                </div>
              </div>

              {/* Vehicle & Auto Comparison Info */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <div className="flex items-center gap-2 text-gray-700">
                  <span>🏍️</span>
                  <span>Driver Vehicle: <strong>{selectedRide.bikeName || 'Royal Enfield Hunter 350'}</strong> ({selectedRide.bikeNumber || 'KA-34-EA-4412'})</span>
                </div>
                <div className="text-emerald-700 font-bold">
                  ⚡ Auto Fare: ~₹{Math.max(50, Math.round((selectedRide.sharedDistanceKm || 8.5) * 14))} ➔ You save ₹{selectedRide.savingsVsAuto || 80}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-500">
              Select a ride from the list to preview dual-color corridor road route and fair calculation breakdown.
            </div>
          )}
        </div>

      </div>

      {/* Switch Ride Confirmation Modal (1 Active Request Rule) */}
      {switchConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mx-auto shadow-inner">
              🔄
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-gray-900">Switch Ride Request?</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                You already requested a ride with <strong className="text-gray-900">{switchConfirm.conflictingRequest?.driverName || 'another driver'}</strong>
                {switchConfirm.conflictingRequest?.departureTime ? ` (Scheduled: ${format12Hour(switchConfirm.conflictingRequest.departureTime)})` : ''}.
              </p>
              <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 font-medium text-left">
                Students can hold 1 active booking at a time. Switching will release your seat with {switchConfirm.conflictingRequest?.driverName || 'the previous driver'} and send a fresh request to <strong>{switchConfirm.driverName}</strong>.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSwitchConfirm(null)}
                className="flex-1 py-2.5 rounded-full border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition cursor-pointer"
              >
                Keep Waiting
              </button>
              <button
                type="button"
                onClick={() => {
                  const { rideId, driverName } = switchConfirm;
                  setSwitchConfirm(null);
                  handleRequestRide(rideId, driverName, true);
                }}
                className="flex-1 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                Cancel & Switch ➔
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindRide;
