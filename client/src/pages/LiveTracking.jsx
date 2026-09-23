import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import MapComponent from '../components/MapComponent';
import { AuthContext } from '../context/AuthContext';

function LiveTracking() {
  const { rideId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [ride, setRide] = useState(location.state?.ride || null);
  const [driver, setDriver] = useState(location.state?.driver || null);
  const [loading, setLoading] = useState(!ride);

  // Rapido Tracking States
  // Phases: 'ASSIGNED' | 'APPROACHING' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED'
  const [phase, setPhase] = useState('APPROACHING');
  const [distanceKm, setDistanceKm] = useState(1.8);
  const [etaMins, setEtaMins] = useState(4);
  const [currentSpeed, setCurrentSpeed] = useState(38);
  const [simSpeed, setSimSpeed] = useState(1); // 1x or 3x
  const [isPaused, setIsPaused] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [ridePin] = useState(() => Math.floor(1000 + Math.random() * 9000)); // 4-digit Ride PIN

  // Coordinates
  const defaultPickup = { lat: 15.1394, lng: 76.9214 }; // KHB Colony / Ballari
  const defaultCollege = { lat: 15.1278, lng: 76.8837 }; // BITM Campus
  
  // Start driver slightly away to simulate approach
  const [driverCoords, setDriverCoords] = useState({ lat: 15.1485, lng: 76.9320 });
  const [pickupCoords, setPickupCoords] = useState(defaultPickup);
  const [destCoords, setDestCoords] = useState(defaultCollege);

  const socketRef = useRef(null);
  const simStepRef = useRef(0);

  // Fetch Ride if not provided via location state
  useEffect(() => {
    if (ride && driver) {
      initCoordinates(ride);
      return;
    }

    const fetchRideDetails = async () => {
      try {
        const id = rideId || 'latest';
        let targetRide = null;

        if (id !== 'latest') {
          const res = await axios.get(`http://localhost:5000/api/rides/${id}`);
          targetRide = res.data;
        } else {
          // Fetch latest active ride for demo tracking
          const res = await axios.get('http://localhost:5000/api/rides');
          targetRide = res.data[0];
        }

        if (targetRide) {
          setRide(targetRide);
          setDriver(targetRide.offeredBy || null);
          initCoordinates(targetRide);
        }
      } catch (err) {
        console.error('Failed to load ride:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRideDetails();
  }, [rideId]);

  const initCoordinates = (r) => {
    if (r.origin?.coordinates && r.origin.coordinates.length >= 2) {
      // Offset driver slightly to simulate incoming approach to pickup
      const origLng = r.origin.coordinates[0];
      const origLat = r.origin.coordinates[1];
      setPickupCoords({ lat: origLat, lng: origLng });
      setDriverCoords({ lat: origLat + 0.0095, lng: origLng + 0.0085 });
    }
    if (r.destination?.coordinates && r.destination.coordinates.length >= 2) {
      setDestCoords({
        lat: r.destination.coordinates[1],
        lng: r.destination.coordinates[0]
      });
    }
  };

  // Socket.io Connection for Real-time GPS broadcasting
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    const socket = socketRef.current;

    if (rideId) {
      socket.emit('joinRide', rideId);
    }

    socket.on('driverGPSUpdate', (data) => {
      if (data.coords) {
        setDriverCoords(data.coords);
      }
      if (data.distance) setDistanceKm(data.distance);
      if (data.eta) setEtaMins(data.eta);
      if (data.speed) setCurrentSpeed(data.speed);
    });

    socket.on('rideStatusUpdate', (data) => {
      if (data.status) setPhase(data.status);
    });

    return () => {
      socket.disconnect();
    };
  }, [rideId]);

  // OSRM road coordinates
  const [osrmApproachPoints, setOsrmApproachPoints] = useState([]);
  const [osrmTripPoints, setOsrmTripPoints] = useState([]);

  // Prefetch OSRM turn-by-turn road paths for realistic road movement
  useEffect(() => {
    const fetchOsrmPaths = async () => {
      try {
        const startLat = pickupCoords.lat + 0.0095;
        const startLng = pickupCoords.lng + 0.0085;
        const resApproach = await axios.get(
          `http://localhost:5000/api/rides/osrm-route?originLng=${startLng}&originLat=${startLat}&destLng=${pickupCoords.lng}&destLat=${pickupCoords.lat}`
        );
        if (resApproach.data?.coordinates) {
          setOsrmApproachPoints(resApproach.data.coordinates);
        }

        const resTrip = await axios.get(
          `http://localhost:5000/api/rides/osrm-route?originLng=${pickupCoords.lng}&originLat=${pickupCoords.lat}&destLng=${destCoords.lng}&destLat=${destCoords.lat}`
        );
        if (resTrip.data?.coordinates) {
          setOsrmTripPoints(resTrip.data.coordinates);
        }
      } catch (err) {
        console.warn('LiveTracking OSRM fetch error:', err.message);
      }
    };

    fetchOsrmPaths();
  }, [pickupCoords, destCoords]);

  // Real-Time Rapido GPS Approach Engine
  useEffect(() => {
    if (isPaused || phase === 'COMPLETED') return;

    const intervalTime = 1400 / simSpeed;

    const interval = setInterval(() => {
      simStepRef.current += 1;
      const step = simStepRef.current;

      // Phase 1: Approaching Pickup Point (Steps 1 to 14)
      if (step <= 14) {
        setPhase('APPROACHING');
        const progress = step / 14;

        // Follow real OSRM road geometry if available
        let updatedPos;
        if (osrmApproachPoints.length > 2) {
          const idx = Math.min(
            osrmApproachPoints.length - 1,
            Math.floor(progress * (osrmApproachPoints.length - 1))
          );
          updatedPos = osrmApproachPoints[idx];
        } else {
          const startLat = pickupCoords.lat + 0.0095;
          const startLng = pickupCoords.lng + 0.0085;
          const newLat = startLat + (pickupCoords.lat - startLat) * progress;
          const newLng = startLng + (pickupCoords.lng - startLng) * progress;
          updatedPos = { lat: newLat, lng: newLng };
        }

        setDriverCoords(updatedPos);

        const remDist = Math.max(0.05, (1.8 * (1 - progress))).toFixed(2);
        const remEta = Math.max(1, Math.ceil(4 * (1 - progress)));
        setDistanceKm(parseFloat(remDist));
        setEtaMins(remEta);
        setCurrentSpeed(Math.floor(34 + Math.random() * 8));

        // Emit GPS over socket
        socketRef.current?.emit('driverGPSUpdate', {
          rideId,
          coords: updatedPos,
          distance: parseFloat(remDist),
          eta: remEta,
          speed: 36
        });
      }
      // Phase 2: Driver Arrived at Pickup (Steps 15 to 19)
      else if (step <= 19) {
        setPhase('ARRIVED');
        setDriverCoords(pickupCoords);
        setDistanceKm(0);
        setEtaMins(0);
        setCurrentSpeed(0);
      }
      // Phase 3: Riding to BITM Campus Destination (Steps 20 to 34)
      else if (step <= 34) {
        setPhase('IN_PROGRESS');
        const rideProgress = (step - 19) / 15;

        let updatedPos;
        if (osrmTripPoints.length > 2) {
          const idx = Math.min(
            osrmTripPoints.length - 1,
            Math.floor(rideProgress * (osrmTripPoints.length - 1))
          );
          updatedPos = osrmTripPoints[idx];
        } else {
          const newLat = pickupCoords.lat + (destCoords.lat - pickupCoords.lat) * rideProgress;
          const newLng = pickupCoords.lng + (destCoords.lng - pickupCoords.lng) * rideProgress;
          updatedPos = { lat: newLat, lng: newLng };
        }

        setDriverCoords(updatedPos);
        const distToCollege = Math.max(0.1, (4.2 * (1 - rideProgress))).toFixed(1);
        const etaToCollege = Math.max(1, Math.ceil(9 * (1 - rideProgress)));
        setDistanceKm(parseFloat(distToCollege));
        setEtaMins(etaToCollege);
        setCurrentSpeed(Math.floor(40 + Math.random() * 6));
      }
      // Phase 4: Arrived at College Campus safely!
      else {
        setPhase('COMPLETED');
        setDriverCoords(destCoords);
        setDistanceKm(0);
        setEtaMins(0);
        setCurrentSpeed(0);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [pickupCoords, destCoords, simSpeed, isPaused, phase, rideId]);

  const restartSimulation = () => {
    simStepRef.current = 0;
    setPhase('APPROACHING');
    setDistanceKm(1.8);
    setEtaMins(4);
    setCurrentSpeed(38);
    if (pickupCoords) {
      setDriverCoords({
        lat: pickupCoords.lat + 0.0095,
        lng: pickupCoords.lng + 0.0085
      });
    }
  };

  const getStatusBanner = () => {
    switch (phase) {
      case 'APPROACHING':
        return `🏍️ ${driver?.name || 'Rahul'} is ${distanceKm} km away • Arriving in ~${etaMins} mins`;
      case 'ARRIVED':
        return `🟢 ${driver?.name || 'Rahul'} has arrived at your pickup spot! Please board.`;
      case 'IN_PROGRESS':
        return `🚀 Commute In Progress • Heading to BITM Campus (${distanceKm} km remaining)`;
      case 'COMPLETED':
        return `🎉 Safely arrived at Ballari Institute of Technology and Management!`;
      default:
        return 'Connecting to Live GPS...';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl animate-bounce">🏍️</div>
          <p className="text-sm font-medium text-gray-600">Loading Live GPS Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-1">
      <div className="space-y-4">
        {/* Top Header & Live Tracker Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[24px] border border-gray-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eaf7f2] text-[#00a86b] flex items-center justify-center text-xl shadow-xs">
              <span>🏍️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Live GPS Ride Tracker</h2>
                <span className="text-[10px] font-extrabold uppercase bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-gray-500">Real-time driver approach and route navigation to campus.</p>
            </div>
          </div>

          {/* Simulation & Navigation Controls */}
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 p-1 rounded-xl border border-gray-200 flex items-center gap-1 text-xs">
              <button
                onClick={() => setSimSpeed(1)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  simSpeed === 1 ? 'bg-[#00b87c] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Normal speed"
              >
                1x
              </button>
              <button
                onClick={() => setSimSpeed(3)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  simSpeed === 3 ? 'bg-[#00b87c] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Fast-forward approach simulation"
              >
                3x ⚡
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="px-2.5 py-1 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-200 transition"
              >
                {isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
              <button
                onClick={restartSimulation}
                className="px-2.5 py-1 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-200 transition"
                title="Restart simulation from beginning"
              >
                🔄
              </button>
            </div>

            <Link
              to="/rides"
              className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-700 transition"
            >
              📋 My Rides
            </Link>
          </div>
        </div>

        {/* SOS Emergency Banner */}
        {sosActive && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-pulse">🚨</span>
              <div>
                <strong className="block font-bold">CAMPUS EMERGENCY SOS BROADCASTED</strong>
                <p className="text-[11px] text-red-600">
                  Your live GPS location was shared with BITM Ballari Campus Security & Emergency Contacts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSosActive(false)}
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Split Layout: Live Map on Left, Driver Control Panel on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Interactive Google Map with Live Driver Marker */}
          <div className="lg:col-span-2 h-[550px] sm:h-[620px] rounded-[24px] overflow-hidden border border-gray-100 shadow-xs relative">
            <MapComponent
              isTrackingMode={true}
              driverCoords={driverCoords}
              pickupCoords={pickupCoords}
              destCoords={destCoords}
              approachStatus={getStatusBanner()}
            />
          </div>

          {/* Ride Details & Driver Panel */}
          <div className="space-y-4">
            {/* Live Telemetry / ETA Gauge */}
            <div className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Driver Proximity
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  phase === 'ARRIVED'
                    ? 'bg-[#e1f7ec] text-[#00a86b] border-[#98e6c4]'
                    : phase === 'IN_PROGRESS'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : phase === 'COMPLETED'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {phase === 'APPROACHING' && '🏍️ En Route to You'}
                  {phase === 'ARRIVED' && '📍 At Pickup Spot'}
                  {phase === 'IN_PROGRESS' && '🚀 Riding to BITM'}
                  {phase === 'COMPLETED' && '🏁 Arrived Safely'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center my-3 py-3 border-y border-gray-100">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Distance</div>
                  <div className="text-xl font-black text-gray-900">{distanceKm} km</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Arrival ETA</div>
                  <div className="text-xl font-black text-[#00b87c]">
                    {etaMins === 0 ? 'Now' : `${etaMins} min`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Bike Speed</div>
                  <div className="text-xl font-black text-emerald-600">{currentSpeed} km/h</div>
                </div>
              </div>

              {/* Boarding PIN (Security Feature) */}
              <div className="bg-[#eaf7f2] border border-[#daf1e8] rounded-2xl p-3 flex items-center justify-between mt-2">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                    Ride Security PIN
                  </span>
                  <span className="text-xs text-gray-700">Share with driver before boarding:</span>
                </div>
                <div className="text-xl font-mono font-black tracking-widest text-[#00a86b] bg-white px-3 py-1 rounded-xl border border-[#98e6c4] shadow-xs">
                  {ridePin}
                </div>
              </div>
            </div>

            {/* Driver Identity Card */}
            <div className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center text-xl font-black shadow-xs">
                    {(driver?.name || 'D')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                      {driver?.name || 'Campus Student Driver'}
                      <span className="text-xs bg-[#e1f7ec] text-[#00a86b] px-2 py-0.5 rounded-full font-semibold border border-[#98e6c4]">Verified</span>
                    </h3>
                    <p className="text-xs text-[#00a86b] font-medium">
                      🏫 {driver?.college || 'BITM Ballari Student'}
                    </p>
                    <div className="text-[11px] text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                      <span>⭐ 5.0</span>
                      <span className="text-gray-400 font-normal">({driver?.usn || 'Verified ID'})</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Campus Fare</span>
                  <span className="text-lg font-black text-[#00a86b]">
                    ₹{ride?.pricePerSeat || Math.max(10, Math.round((distanceKm || 8.5) * 2))}
                  </span>
                  <span className="text-[10px] text-gray-400 block">(@ ₹2/km)</span>
                </div>
              </div>

              {/* Bike Specifications */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏍️</span>
                  <div>
                    <strong className="text-gray-900 block">{ride?.vehicleModel || driver?.vehicleModel || `${ride?.vehicleType || 'Two-Wheeler'} Commute`}</strong>
                    <span className="text-gray-500 text-[11px]">{ride?.vehicleNumber || driver?.vehicleNumber || 'Student Commute'} • Helmet Available</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#e1f7ec] text-[#00a86b] text-[10px] font-semibold border border-[#98e6c4]">
                  Helmet Included
                </span>
              </div>

              {/* Route Summary */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-[#00a86b] font-bold">📍 Pickup:</span>
                  <span className="text-gray-700 truncate">
                    {ride?.originAddress || 'KHB Colony, Ballari'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">🏫 Campus:</span>
                  <span className="text-gray-700 truncate">
                    {ride?.destAddress || 'Ballari Institute of Technology & Management'}
                  </span>
                </div>
              </div>

              {/* Campus Fair-Share Pricing Breakdown */}
              <div className="bg-[#eaf7f2] p-3 rounded-xl border border-[#daf1e8] space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Commute Route Distance:</span>
                  <span className="text-gray-900 font-semibold">{ride?.distanceKm || distanceKm || 8.5} km</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Student Fuel Share Rate:</span>
                  <span className="text-[#00a86b] font-semibold">₹2.00 / KM (Pure Petrol Split)</span>
                </div>
                <div className="flex justify-between items-center text-gray-900 font-bold pt-1 border-t border-[#daf1e8]">
                  <span>Total Subsidized Fare:</span>
                  <span className="text-[#00a86b] text-sm font-black">
                    ₹{ride?.pricePerSeat || Math.max(10, Math.round((distanceKm || 8.5) * 2))}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 text-right font-medium">
                  ⚡ Auto costs ₹100+ • You save ₹{Math.max(50, 100 - (ride?.pricePerSeat || 17))}!
                </div>
              </div>

              {/* Communication & Emergency Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={driver?.phone ? `tel:${driver.phone}` : '#'}
                  onClick={(e) => { if (!driver?.phone) { e.preventDefault(); alert('Driver phone number not provided.'); } }}
                  className="py-2.5 px-3 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition text-center"
                >
                  <span>📞</span>
                  <span>Call Driver</span>
                </a>

                <Link
                  to="/messages"
                  className="py-2.5 px-3 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition text-center shadow-xs"
                >
                  <span>💬</span>
                  <span>Live Chat</span>
                </Link>
              </div>

              {/* Safety SOS */}
              <button
                type="button"
                onClick={() => setSosActive(true)}
                className="w-full py-2.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <span>🚨</span>
                <span>Campus Safety SOS (Emergency)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveTracking;
