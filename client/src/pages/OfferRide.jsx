import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bike, Clock, ShieldCheck, Lock, Sparkles, Navigation, ArrowRight, CheckCircle2, AlertCircle, Fuel, AlertTriangle } from 'lucide-react';
import MapComponent from '../components/MapComponent';
import { AuthContext } from '../context/AuthContext';
import { format12Hour, formatTimeString12h } from '../utils/timeFormat';

const COMMUTE_STORAGE_KEY = 'bikemate_today_commute';
const VEHICLE_STORAGE_KEY = 'bikemate_driver_vehicle';

function OfferRide() {
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

  // Driver Vehicle Details (Synced from Settings & User DB profile)
  const [bikeName, setBikeName] = useState(() => {
    if (user?.bikeName) return user.bikeName;
    try {
      const savedV = localStorage.getItem(VEHICLE_STORAGE_KEY);
      if (savedV) {
        const parsed = JSON.parse(savedV);
        if (parsed.bikeName) return parsed.bikeName;
      }
    } catch (e) {}
    return 'Royal Enfield Hunter 350';
  });

  const [bikeNumber, setBikeNumber] = useState(() => {
    if (user?.bikeNumber) return user.bikeNumber;
    try {
      const savedV = localStorage.getItem(VEHICLE_STORAGE_KEY);
      if (savedV) {
        const parsed = JSON.parse(savedV);
        if (parsed.bikeNumber) return parsed.bikeNumber;
      }
    } catch (e) {}
    return 'KA-34-EA-4412';
  });

  // Automatically update when user profile updates in Settings
  useEffect(() => {
    if (user?.bikeName) setBikeName(user.bikeName);
    if (user?.bikeNumber) setBikeNumber(user.bikeNumber);
  }, [user?.bikeName, user?.bikeNumber]);

  // Departure Time (defaults to +30 minutes)
  const [departureTime, setDepartureTime] = useState(() => {
    const d = new Date(Date.now() + 30 * 60000);
    return d.toTimeString().slice(0, 5);
  });

  // Available Seats: ALWAYS LOCKED TO 1
  const seatsAvailable = 1;

  // Fair-Share Calculation
  const distanceKm = commuteRoute.distanceKm || 8.5;
  const RATE_PER_KM = 2.0; // ₹2/KM campus fuel-share rate
  const fairSharePrice = Math.max(10, Math.round(distanceKm * RATE_PER_KM));

  // Driver GPS coordinates for blue circle icon
  const [userCoords, setUserCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeRide, setActiveRide] = useState(null);
  const [checkingActive, setCheckingActive] = useState(true);

  // Check if driver already has an active scheduled ride
  const fetchActiveRideStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const authConfig = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.get('http://localhost:5000/api/rides/active-status', authConfig);
      if (res.data?.hasActiveOfferedRide) {
        setActiveRide(res.data.activeOfferedRide);
      } else {
        setActiveRide(null);
      }
    } catch (err) {
      console.warn('Active ride check error:', err.message);
    } finally {
      setCheckingActive(false);
    }
  };

  useEffect(() => {
    fetchActiveRideStatus();
  }, []);

  // Cancel existing ride so driver can republish
  const handleCancelExistingRide = async () => {
    if (!activeRide) return;
    if (!window.confirm('Cancel your currently scheduled ride? Any booked commuter will be notified and your schedule unlocked.')) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const authConfig = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.patch(`http://localhost:5000/api/rides/${activeRide._id}/cancel`, {}, authConfig);
      setActiveRide(null);
      setSuccess('Previous scheduled ride cancelled. You can now publish your new commute!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel existing ride.');
    } finally {
      setLoading(false);
    }
  };

  // Detect Driver GPS location for blue circle pulse icon
  useEffect(() => {
    const oCoords = commuteRoute?.originCoords || [76.9214, 15.1394];
    if (!navigator.geolocation) {
      setUserCoords({ lat: oCoords[1], lng: oCoords[0] });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn('GPS Error, using route origin:', err.message);
        setUserCoords({ lat: oCoords[1], lng: oCoords[0] });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [commuteRoute]);

  // Persist vehicle details when modified
  const handleBikeChange = (name, num) => {
    setBikeName(name);
    setBikeNumber(num);
    localStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify({ bikeName: name, bikeNumber: num }));
  };

  const handlePublishRide = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bikeName.trim() || !bikeNumber.trim()) {
      setError('Please provide your motorcycle name and registration number.');
      return;
    }

    setLoading(true);
    try {
      const [hours, minutes] = departureTime.split(':');
      const depDate = new Date();
      depDate.setHours(parseInt(hours, 10));
      depDate.setMinutes(parseInt(minutes, 10));
      depDate.setSeconds(0);

      // If departure time selected is earlier than right now, set it for tomorrow
      if (depDate.getTime() < Date.now()) {
        depDate.setDate(depDate.getDate() + 1);
      }

      const payload = {
        originCoords: commuteRoute.originCoords || [76.9214, 15.1394],
        destCoords: commuteRoute.destCoords || [76.8506, 15.1677],
        originAddress: commuteRoute.originText,
        destAddress: commuteRoute.destText,
        departureTime: depDate.toISOString(),
        seatsAvailable: 1, // ALWAYS 1 seat
        pricePerSeat: fairSharePrice,
        distanceKm,
        bikeName: bikeName.trim(),
        bikeNumber: bikeNumber.trim().toUpperCase(),
        cancelPrevious: !!activeRide
      };

      const token = localStorage.getItem('token');
      const authConfig = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const res = await axios.post('http://localhost:5000/api/rides', payload, authConfig);

      const formatted12h = formatTimeString12h(departureTime);
      setSuccess(`🎉 Ride successfully published for ${formatted12h}! Available to same-direction students.`);
      setTimeout(() => {
        navigate('/rides');
      }, 1200);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409 && err.response?.data?.hasActiveRide) {
        setActiveRide(err.response.data.activeRide);
        setError('You already have an active scheduled ride. Use "Cancel Old Ride & Publish New" above if you wish to reschedule.');
      } else {
        setError(err.response?.data?.message || 'Error publishing shared ride. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-1">
      
      {/* 1. Header with Inherited Commute Route Banner */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">Offer a Ride</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
                Driver Commute Active
              </span>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Zero location typing needed. Inherits today's route from your dashboard setup.
            </p>
          </div>

          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition self-start lg:self-auto border border-gray-200/60"
          >
            <span>⚙️ Change Commute Route on Dashboard</span>
          </Link>
        </div>

        {/* Route Details Bar */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-teal-50/40 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-gray-900">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <span>📍 Starting Point:</span>
              <span className="text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs font-semibold">
                {commuteRoute.originText}
              </span>
            </div>

            <span className="text-gray-400 font-bold">➔</span>

            <div className="flex items-center gap-1.5 font-bold text-gray-900">
              <span>🏁 Destination:</span>
              <span className="text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs font-semibold">
                {commuteRoute.destText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-gray-600 font-medium">
              Distance: <strong className="text-gray-900">{distanceKm} km</strong>
            </span>
            <span className="text-gray-600 font-medium">
              Fare: <strong className="text-[#00a86b]">₹{fairSharePrice}</strong> (@ ₹2/km)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Gender Safety Banner */}
      {user?.gender === 'female' ? (
        <div className="p-3.5 rounded-2xl bg-pink-50/90 border border-pink-200 text-pink-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌸</span>
            <div>
              <span className="font-bold block text-pink-950">Ladies-Only Safe Ride</span>
              <span className="text-pink-700 text-xs">This ride will only be visible to and requestable by female college students.</span>
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
              <span className="font-bold block text-blue-950">Gents-Only Safe Ride</span>
              <span className="text-blue-700 text-xs">This ride will only be visible to and requestable by male college students.</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-200/60 text-blue-800 text-xs font-bold border border-blue-300">
            👨 Boys ↔ Boys
          </span>
        </div>
      )}

      {/* Active Scheduled Ride Alert Banner (Single Active Ride Enforcement) */}
      {activeRide && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-amber-950">
                  You Already Have an Active Scheduled Ride!
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  <strong>{activeRide.originAddress} ➔ {activeRide.destAddress}</strong>
                </p>
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-2">
                  <span>⏰ Departure: <strong>{format12Hour(activeRide.departureTime)}</strong></span>
                  <span>•</span>
                  <span className="uppercase font-bold text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                    {activeRide.status}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
              <Link
                to="/rides"
                className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100/60 transition shadow-2xs"
              >
                View in My Rides
              </Link>
              <button
                type="button"
                onClick={handleCancelExistingRide}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Cancel Old Ride & Publish New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success / Error Messages */}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Main Grid: Left Form | Right Map with Blue Marker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Form (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-xs space-y-5">
            
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Bike className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Vehicle & Departure Setup</h2>
            </div>

            <form onSubmit={handlePublishRide} className="space-y-4">
              
              {/* Bike Name & Registration Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    🏍️ Bike / Scooter Model
                  </label>
                  <input
                    type="text"
                    required
                    value={bikeName}
                    onChange={(e) => handleBikeChange(e.target.value, bikeNumber)}
                    placeholder="e.g. Royal Enfield Hunter 350"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold focus:outline-none focus:border-[#00b87c] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    🔢 Bike Registration Plate
                  </label>
                  <input
                    type="text"
                    required
                    value={bikeNumber}
                    onChange={(e) => handleBikeChange(bikeName, e.target.value.toUpperCase())}
                    placeholder="e.g. KA-34-EA-4412"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-mono text-sm uppercase font-bold focus:outline-none focus:border-[#00b87c] focus:bg-white transition"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1 -mt-2">
                <span className="text-[#00b87c] font-bold">✓</span>
                <span>Auto-filled from your Settings profile. Changes here persist to future rides.</span>
              </p>

              {/* Departure Time & Available Seats (LOCKED TO 1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>Departure Time (Today)</span>
                    </span>
                    <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                      ⏰ {formatTimeString12h(departureTime)}
                    </span>
                  </label>
                  <input
                    type="time"
                    required
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold focus:outline-none focus:border-[#00b87c] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center justify-between">
                    <span>Available Seats</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Locked to 1
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      readOnly
                      value={seatsAvailable}
                      className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm cursor-not-allowed"
                    />
                    <div className="absolute right-3 top-3 flex items-center gap-1 text-xs text-gray-500 font-semibold">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <span>1 Rider Always</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Publishing Shared Ride...</span>
                  </>
                ) : (
                  <>
                    <Bike className="w-5 h-5" />
                    <span>Publish Shared Commute Ride ➔</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 4. Details of System Fair-Share Pricing Engine Widget */}
          <div className="bg-gradient-to-br from-[#f8fdfb] to-[#f0faf5] rounded-[24px] border border-[#98e6c4] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-[#00a86b]" />
                <h3 className="font-extrabold text-gray-900 text-sm">System Fair-Share Pricing Engine</h3>
              </div>
              <span className="text-xs font-bold text-[#00a86b] bg-[#e1f7ec] px-2.5 py-1 rounded-full border border-[#98e6c4]">
                Transparent Formula
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] text-gray-500 block uppercase font-bold">Commute Distance</span>
                <strong className="text-base font-extrabold text-gray-900">{distanceKm} KM</strong>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] text-gray-500 block uppercase font-bold">Fuel Split Fare</span>
                <strong className="text-base font-black text-[#00a86b]">₹{fairSharePrice}</strong>
              </div>
            </div>

            {/* Fair-Share Breakdown List */}
            <div className="space-y-2 text-xs text-gray-600 bg-white/80 p-3.5 rounded-xl border border-emerald-100/80">
              <div className="flex items-center justify-between">
                <span>• Rate formula:</span>
                <strong className="text-gray-900 font-mono">{distanceKm} km × ₹2.00/km = ₹{fairSharePrice}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>• Fuel coverage:</span>
                <strong className="text-emerald-700">Covers ~40% of motorcycle petrol</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>• Environmental impact:</span>
                <strong className="text-emerald-700">~0.84 kg CO2 saved (1 less bike)</strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span>• Campus Auto fare:</span>
                <span className="text-gray-500 line-through">₹100–120</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Map (6 cols) with Blue Circle Marker */}
        <div className="lg:col-span-6 space-y-3 sticky top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <span>Driver Live Map Position (🔵 Blue Circle Icon)</span>
            </span>
            <span className="text-[11px] text-[#00a86b] font-semibold">OSRM Planned Highway Route</span>
          </div>

          <div className="h-[520px] rounded-[24px] overflow-hidden border-2 border-gray-100 shadow-xs relative bg-gray-900">
            <MapComponent
              origin={commuteRoute.originText}
              destination={commuteRoute.destText}
              userCoords={userCoords}
              userMarkerColor="#3b82f6" // 🔵 BLUE Circle Icon for Driver
            />
          </div>
        </div>

      </div>
    </div>
  );
}

export default OfferRide;
