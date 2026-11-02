import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import MapComponent from '../components/MapComponent';
import { AuthContext } from '../context/AuthContext';
import { 
  Share2, 
  Shield, 
  Phone, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  Clock, 
  Navigation, 
  Radio,
  Play,
  CheckCircle2,
  Sliders,
  MapPin,
  KeyRound,
  Star,
  Receipt,
  UserCheck
} from 'lucide-react';

function LiveTracking() {
  const { rideId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [ride, setRide] = useState(location.state?.ride || null);
  const [driver, setDriver] = useState(location.state?.driver || null);
  const [loading, setLoading] = useState(!ride);
  const [rideActionLoading, setRideActionLoading] = useState(false);

  // Phases: 'AGREED' | 'IN_PROGRESS' | 'COMPLETED'
  const [phase, setPhase] = useState('AGREED');
  const [distanceKm, setDistanceKm] = useState(0);
  const [etaMins, setEtaMins] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [roadProgress, setRoadProgress] = useState(0); // 0 to 100%

  // 1. PIN Verification Modal (Driver Side)
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // 2. Dual-Sided Trip Summary & Fare Settlement Modal
  const [settlementModalData, setSettlementModalData] = useState(null);
  const [rating, setRating] = useState(5);

  // 3. SOS Emergency States
  const [sosActive, setSosActive] = useState(false);
  const [sosReason, setSosReason] = useState('Manual Campus Emergency SOS Triggered');
  const [sosCountdown, setSosCountdown] = useState(null); // 3-second abort countdown
  const sosCountdownTimerRef = useRef(null);

  // 4. Share Ride States
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // 5. Route Deviation States (>500m off expected route)
  const [showDeviationModal, setShowDeviationModal] = useState(false);
  const [deviationCountdown, setDeviationCountdown] = useState(60);
  const [deviationSnoozedUntil, setDeviationSnoozedUntil] = useState(0);

  // 6. Extended Stoppage States (>7 minutes stationary)
  const [showStoppageModal, setShowStoppageModal] = useState(false);
  const [stoppageSeconds, setStoppageSeconds] = useState(0);
  const [stoppageSnoozedUntil, setStoppageSnoozedUntil] = useState(0);

  // Emergency contact from user settings & profile
  const emergencyPhone = user?.emergencyPhone || localStorage.getItem('bm_emergency_phone') || localStorage.getItem('emergency_phone') || '9876543210';

  // Default Coordinates
  const defaultPickup = { lat: 15.1394, lng: 76.9214 }; // KHB Colony / Ballari
  const defaultCollege = { lat: 15.1677, lng: 76.8506 }; // BITM Campus
  
  const [pickupCoords, setPickupCoords] = useState(defaultPickup);
  const [destCoords, setDestCoords] = useState(defaultCollege);
  const [driverCoords, setDriverCoords] = useState(defaultPickup);
  const [osrmTripPoints, setOsrmTripPoints] = useState([]);

  const socketRef = useRef(null);

  // Determine if current user is the driver
  const currentUserId = user?._id || user?.id;
  const driverId = ride?.offeredBy?._id || ride?.offeredBy;
  const isDriver = !!(currentUserId && driverId && (currentUserId.toString() === driverId.toString()));

  // Active Boarding PIN
  const activePin = ride?.boardingPin || ride?.userRequest?.boardingPin || '6354';

  // Helper: Haversine distance in meters
  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const initCoordinates = (r) => {
    let pCoords = defaultPickup;
    let dCoords = defaultCollege;

    if (r.origin?.coordinates && r.origin.coordinates.length >= 2) {
      pCoords = { lat: r.origin.coordinates[1], lng: r.origin.coordinates[0] };
      setPickupCoords(pCoords);
    }
    if (r.destination?.coordinates && r.destination.coordinates.length >= 2) {
      dCoords = { lat: r.destination.coordinates[1], lng: r.destination.coordinates[0] };
      setDestCoords(dCoords);
    }

    if (r.status === 'in_progress') {
      setPhase('IN_PROGRESS');
      setDriverCoords(pCoords);
    } else if (r.status === 'completed') {
      setPhase('COMPLETED');
      setDriverCoords(dCoords);
      setDistanceKm(0);
      setEtaMins(0);
      setCurrentSpeed(0);
    } else {
      setPhase('AGREED');
      setDriverCoords(pCoords);
    }
  };

  // Fetch Ride if not provided via location state
  useEffect(() => {
    const fetchRideDetails = async () => {
      try {
        const id = rideId || 'latest';
        let targetRide = null;

        if (id !== 'latest') {
          const res = await axios.get(`http://localhost:5000/api/rides/${id}`);
          targetRide = res.data;
        } else {
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

  // Fetch OSRM turn-by-turn road route between Pickup and Destination
  useEffect(() => {
    const fetchOsrmPath = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/rides/osrm-route?originLng=${pickupCoords.lng}&originLat=${pickupCoords.lat}&destLng=${destCoords.lng}&destLat=${destCoords.lat}`
        );
        if (res.data?.coordinates && res.data.coordinates.length > 0) {
          const parsedPoints = res.data.coordinates.map(pt => {
            if (Array.isArray(pt)) {
              // GeoJSON [lon, lat] -> { lat, lng }
              return { lat: pt[1], lng: pt[0] };
            }
            if (pt?.lat != null && pt?.lng != null) {
              return { lat: pt.lat, lng: pt.lng };
            }
            return null;
          }).filter(Boolean);

          setOsrmTripPoints(parsedPoints);
          if (res.data.distanceKm) {
            setDistanceKm(res.data.distanceKm);
            setEtaMins(Math.max(1, Math.ceil(res.data.distanceKm * 2.2)));
          }
        }
      } catch (err) {
        console.warn('LiveTracking OSRM fetch error:', err.message);
      }
    };

    if (pickupCoords && destCoords) {
      fetchOsrmPath();
    }
  }, [pickupCoords, destCoords]);

  // Socket.io Connection for Real-time GPS broadcasting, ride lifecycle, and SOS
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    const socket = socketRef.current;

    const targetRoomId = ride?._id || rideId;
    if (targetRoomId) {
      socket.emit('joinRide', targetRoomId);
    }

    socket.on('driverGPSUpdate', (data) => {
      if (data.coords) {
        setDriverCoords(data.coords);
      }
      if (data.distance !== undefined) setDistanceKm(data.distance);
      if (data.eta !== undefined) setEtaMins(data.eta);
      if (data.speed !== undefined) setCurrentSpeed(data.speed);
      if (data.phase) setPhase(data.phase);
    });

    socket.on('rideStarted', () => {
      setPhase('IN_PROGRESS');
      setRide(prev => prev ? { ...prev, status: 'in_progress' } : null);
    });

    socket.on('rideCompleted', (data) => {
      setPhase('COMPLETED');
      setDistanceKm(0);
      setEtaMins(0);
      setCurrentSpeed(0);
      setRide(prev => prev ? { ...prev, status: 'completed' } : null);

      if (data && data.totalFare) {
        setSettlementModalData(data);
      } else {
        setSettlementModalData({
          totalFare: ride?.pricePerSeat || 21,
          distanceKm: ride?.distanceKm || 9.5,
          durationMins: 20,
          driverName: driver?.name || ride?.offeredBy?.name || 'Driver',
          passengerName: user?.name || 'Fellow Student',
          paymentMode: 'Cash / UPI Settlement'
        });
      }
    });

    socket.on('rideStatusUpdate', (data) => {
      if (data.status === 'in_progress') setPhase('IN_PROGRESS');
      if (data.status === 'completed') setPhase('COMPLETED');
    });

    socket.on('SOS_TRIGGERED', (data) => {
      setSosActive(true);
      if (data.reason) setSosReason(data.reason);
    });

    socket.on('SOS_RESOLVED', () => {
      setSosActive(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [ride, rideId, driver, user]);

  // Real Mobile GPS Telemetry (Driver physical movement)
  useEffect(() => {
    if (!isDriver || phase !== 'IN_PROGRESS') return;
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const newCoords = { lat: latitude, lng: longitude };
        setDriverCoords(newCoords);

        const remDist = parseFloat((getDistanceMeters(latitude, longitude, destCoords.lat, destCoords.lng) / 1000).toFixed(2));
        const remEta = Math.max(1, Math.ceil(remDist * 2.2));
        const spd = speed ? Math.round(speed * 3.6) : (remDist > 0.1 ? 38 : 0);

        setDistanceKm(remDist);
        setEtaMins(remEta);
        setCurrentSpeed(spd);

        const targetRideId = ride?._id || rideId || 'latest';
        socketRef.current?.emit('driverGPSUpdate', {
          rideId: targetRideId,
          coords: newCoords,
          distance: remDist,
          eta: remEta,
          speed: spd,
          phase: 'IN_PROGRESS'
        });
      },
      (err) => console.log('Geolocation watch notice:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isDriver, phase, destCoords, ride, rideId]);

  // Driver Route Progress Broadcast (Interactive road telematics for desktop testing)
  const handleRoadPositionChange = (percent) => {
    setRoadProgress(percent);
    if (!osrmTripPoints || osrmTripPoints.length < 2) return;

    const idx = Math.min(
      osrmTripPoints.length - 1,
      Math.floor((percent / 100) * (osrmTripPoints.length - 1))
    );
    const pt = osrmTripPoints[idx];
    setDriverCoords(pt);

    const remDist = parseFloat((getDistanceMeters(pt.lat, pt.lng, destCoords.lat, destCoords.lng) / 1000).toFixed(2));
    const remEta = Math.max(1, Math.ceil(remDist * 2.2));
    const speedVal = percent >= 100 ? 0 : 38;

    setDistanceKm(remDist);
    setEtaMins(remEta);
    setCurrentSpeed(speedVal);

    const targetRideId = ride?._id || rideId || 'latest';
    socketRef.current?.emit('driverGPSUpdate', {
      rideId: targetRideId,
      coords: pt,
      distance: remDist,
      eta: remEta,
      speed: speedVal,
      phase: percent >= 100 ? 'COMPLETED' : 'IN_PROGRESS'
    });
  };

  // Driver Action: Verify PIN and Start Ride
  const handleVerifyPinAndStart = async (e) => {
    if (e) e.preventDefault();
    const targetRideId = ride?._id || rideId;
    if (!targetRideId) return;

    if (!enteredPin || enteredPin.trim().length !== 4) {
      setPinError('Please enter the 4-digit PIN displayed on the rider portal.');
      return;
    }

    setRideActionLoading(true);
    setPinError('');
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.post(`http://localhost:5000/api/rides/${targetRideId}/start`, {
        pin: enteredPin.trim()
      }, authHeaders);
      setRide(res.data.ride);
      setPhase('IN_PROGRESS');
      setCurrentSpeed(38);
      setShowPinModal(false);
      socketRef.current?.emit('rideStatusUpdate', { rideId: targetRideId, status: 'in_progress', phase: 'IN_PROGRESS' });
    } catch (err) {
      setPinError(err.response?.data?.message || 'Invalid Boarding PIN. Please check with your rider.');
    } finally {
      setRideActionLoading(false);
    }
  };

  // Rider OR Driver Action: End / Complete Ride
  const handleCompleteRide = async () => {
    const targetRideId = ride?._id || rideId;
    if (!targetRideId) return;

    const confirmEnd = window.confirm('Have you reached your campus destination? Click OK to end the ride and view the fare summary.');
    if (!confirmEnd) return;

    setRideActionLoading(true);
    try {
      const res = await axios.post(`http://localhost:5000/api/rides/${targetRideId}/complete`);
      setRide(res.data.ride);
      setPhase('COMPLETED');
      setDriverCoords(destCoords);
      setDistanceKm(0);
      setEtaMins(0);
      setCurrentSpeed(0);

      if (res.data.settlement) {
        setSettlementModalData(res.data.settlement);
      } else {
        setSettlementModalData({
          totalFare: ride?.pricePerSeat || 21,
          distanceKm: ride?.distanceKm || 9.5,
          durationMins: 20,
          driverName: driver?.name || ride?.offeredBy?.name || 'Driver',
          passengerName: user?.name || 'Fellow Student',
          paymentMode: 'Cash / UPI Settlement'
        });
      }

      socketRef.current?.emit('rideStatusUpdate', { rideId: targetRideId, status: 'completed', phase: 'COMPLETED' });
    } catch (err) {
      alert(err.response?.data?.message || 'Error completing ride');
    } finally {
      setRideActionLoading(false);
    }
  };

  // Core SOS Activation Handler
  const executeSosActivation = (reason = 'Manual Campus Emergency SOS Triggered') => {
    setSosActive(true);
    setSosReason(reason);
    setSosCountdown(null);

    const studentName = user?.name || 'Verified Student';
    const studentPhone = user?.phone || '9999999999';
    const driverName = driver?.name || ride?.offeredBy?.name || 'Student Driver';
    const driverPhone = driver?.phone || ride?.offeredBy?.phone || 'Driver Phone';
    const targetRideId = ride?._id || rideId || 'latest';

    const payload = {
      rideId: targetRideId,
      userId: user?._id,
      userName: studentName,
      userPhone: studentPhone,
      driverName: driverName,
      driverPhone: driverPhone,
      vehicleNumber: ride?.bikeNumber || user?.bikeNumber || 'KA-34-EA-4412',
      emergencyPhone: emergencyPhone,
      coords: driverCoords,
      reason,
      timestamp: new Date().toISOString()
    };

    socketRef.current?.emit('SOS_TRIGGERED', payload);

    axios.post('http://localhost:5000/api/admin/logs', {
      level: 'SOS',
      actionEvent: 'CAMPUS_SOS_TRIGGERED',
      user: `${studentName} (${studentPhone})`,
      details: payload
    }).catch(err => console.warn('Failed to record SOS log:', err.message));
  };

  // Start 3-second abort countdown for manual SOS button click
  const initiateManualSos = () => {
    if (sosActive) return;
    setSosCountdown(3);
  };

  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown === 0) {
      executeSosActivation('Manual Campus Emergency SOS Triggered');
      return;
    }

    sosCountdownTimerRef.current = setTimeout(() => {
      setSosCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(sosCountdownTimerRef.current);
  }, [sosCountdown]);

  const abortManualSos = () => {
    clearTimeout(sosCountdownTimerRef.current);
    setSosCountdown(null);
  };

  const cancelActiveSos = () => {
    const targetRideId = ride?._id || rideId || 'latest';
    socketRef.current?.emit('SOS_RESOLVED', { rideId: targetRideId });
    setSosActive(false);
  };

  // ⚡ HIGH-FREQUENCY GPS BEACON MODE (1-second updates during SOS)
  useEffect(() => {
    if (!sosActive) return;

    const beaconInterval = setInterval(() => {
      const targetRideId = ride?._id || rideId || 'latest';
      socketRef.current?.emit('driverGPSUpdate', {
        rideId: targetRideId,
        coords: driverCoords,
        speed: currentSpeed,
        distance: distanceKm,
        eta: etaMins,
        phase,
        isSosBeacon: true,
        timestamp: new Date().toISOString()
      });
    }, 1000);

    return () => clearInterval(beaconInterval);
  }, [sosActive, driverCoords, currentSpeed, distanceKm, etaMins, phase, ride, rideId]);

  // Route Deviation Checker (>750m off planned path)
  useEffect(() => {
    if (phase !== 'IN_PROGRESS' || sosActive || showDeviationModal) return;
    if (Date.now() < deviationSnoozedUntil) return;
    if (!osrmTripPoints || osrmTripPoints.length < 2) return;
    if (!driverCoords) return;

    const dLat = driverCoords.lat ?? driverCoords[1];
    const dLng = driverCoords.lng ?? driverCoords[0];
    if (dLat == null || dLng == null || isNaN(dLat) || isNaN(dLng)) return;

    let minDistance = Infinity;
    for (const pt of osrmTripPoints) {
      const pLat = pt?.lat ?? pt?.[1];
      const pLng = pt?.lng ?? pt?.[0];
      if (pLat != null && pLng != null && !isNaN(pLat) && !isNaN(pLng)) {
        const d = getDistanceMeters(dLat, dLng, pLat, pLng);
        if (d < minDistance) minDistance = d;
      }
    }

    if (minDistance !== Infinity && minDistance > 500) {
      console.log(`🚨 Automated Route Deviation Detected: ${minDistance.toFixed(0)}m off-route (>500m threshold)`);
      setShowDeviationModal(true);
      setDeviationCountdown(60);
    }
  }, [driverCoords, phase, osrmTripPoints, sosActive, showDeviationModal, deviationSnoozedUntil]);

  // Deviation Countdown Timer (60 seconds)
  useEffect(() => {
    if (!showDeviationModal) return;

    if (deviationCountdown <= 0) {
      setShowDeviationModal(false);
      executeSosActivation('Automated Safety Escalation: Route Deviation >500m (Student did not respond in 60s)');
      return;
    }

    const timer = setInterval(() => {
      setDeviationCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [showDeviationModal, deviationCountdown]);

  // Extended Stoppage Monitor (Speed = 0 km/h mid-commute for >7 minutes)
  useEffect(() => {
    if (phase !== 'IN_PROGRESS' || sosActive || showStoppageModal) return;
    if (Date.now() < stoppageSnoozedUntil) return;

    if (currentSpeed === 0 && distanceKm > 0.4) {
      const timer = setInterval(() => {
        setStoppageSeconds(prev => {
          if (prev >= 420) { // 7 minutes
            setShowStoppageModal(true);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setStoppageSeconds(0);
    }
  }, [currentSpeed, phase, distanceKm, sosActive, showStoppageModal, stoppageSnoozedUntil]);

  // Direct test triggers for safety verification
  const testRouteDeviationAlert = () => {
    setShowDeviationModal(true);
    setDeviationCountdown(60);
    setDriverCoords(prev => ({ lat: prev.lat + 0.007, lng: prev.lng + 0.007 }));
  };

  const testExtendedStoppageAlert = () => {
    setShowStoppageModal(true);
    setCurrentSpeed(0);
  };

  const targetRideId = ride?._id || rideId || 'latest';
  const liveShareUrl = `${window.location.origin}/track/live-share/${targetRideId}`;

  const copyShareUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(liveShareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 3000);
    }
  };

  // WhatsApp SOS pre-filled link
  const cleanEmergencyPhone = (emergencyPhone || '9876543210').replace(/[^0-9]/g, '');
  const googleMapsUrl = `https://maps.google.com/?q=${driverCoords.lat},${driverCoords.lng}`;
  const studentName = user?.name || 'Verified Student';
  const driverName = driver?.name || ride?.offeredBy?.name || 'Student Driver';
  const vehicleNumber = ride?.bikeNumber || driver?.vehicleNumber || user?.bikeNumber || 'KA-34-EA-4412';

  const sosMessageText = `🚨 EMERGENCY SOS ALERT - BIKEMATE 🚨\nStudent: ${studentName} (${user?.phone || 'Mobile'})\nDriver: ${driverName} (${driver?.phone || 'Phone'})\nVehicle: ${vehicleNumber}\nLive GPS Location: ${googleMapsUrl}\nLive Tracking: ${liveShareUrl}\nStatus: Campus Security Alerted.`;

  const whatsappSosUrl = `https://api.whatsapp.com/send?phone=91${cleanEmergencyPhone}&text=${encodeURIComponent(sosMessageText)}`;
  const smsSosUrl = `sms:${cleanEmergencyPhone}?body=${encodeURIComponent(sosMessageText)}`;

  const getStatusBanner = () => {
    switch (phase) {
      case 'AGREED':
        return `🟢 Driver & Rider at Pickup Location • Ready to Board (Verify PIN to Start)`;
      case 'IN_PROGRESS':
        return `🚀 Commute In Progress • En Route to BITM Campus (${distanceKm} km remaining)`;
      case 'COMPLETED':
        return `🎉 Arrived safely at Ballari Institute of Technology and Management!`;
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
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  phase === 'IN_PROGRESS' 
                    ? 'bg-blue-100 text-blue-700' 
                    : phase === 'COMPLETED'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {phase === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />}
                  {phase === 'IN_PROGRESS' ? 'IN PROGRESS' : phase === 'COMPLETED' ? 'COMPLETED' : 'AGREED'}
                </span>
              </div>
              <p className="text-xs text-gray-500">Turn-by-turn road navigation and safety monitoring to BITM Campus.</p>
            </div>
          </div>

          {/* Action & Navigation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Start Ride Button (Triggers PIN Verification Modal) */}
            {phase === 'AGREED' && (
              <button
                onClick={() => {
                  setEnteredPin('');
                  setPinError('');
                  setShowPinModal(true);
                }}
                disabled={rideActionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                title="Enter rider PIN to start the commute"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Start Ride (Enter PIN) 🚀</span>
              </button>
            )}

            {/* End Ride Button (Active during IN_PROGRESS for both rider and driver) */}
            {phase === 'IN_PROGRESS' && (
              <button
                onClick={handleCompleteRide}
                disabled={rideActionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md animate-pulse cursor-pointer"
                title="Reached campus destination? Click to finish ride"
              >
                <Check className="w-3.5 h-3.5" />
                <span>End Ride (Reached Campus) 🏁</span>
              </button>
            )}

            {/* If completed, allow reopening settlement summary */}
            {phase === 'COMPLETED' && (
              <button
                onClick={() => {
                  if (!settlementModalData) {
                    setSettlementModalData({
                      totalFare: ride?.pricePerSeat || 21,
                      distanceKm: ride?.distanceKm || 9.5,
                      durationMins: 20,
                      driverName: driver?.name || ride?.offeredBy?.name || 'Driver',
                      passengerName: user?.name || 'Fellow Student',
                      paymentMode: 'Cash / UPI Settlement'
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Fare Summary</span>
              </button>
            )}

            {/* Share Live Ride with Friend Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Live Ride</span>
            </button>

            {/* Safety Verification Tests */}
            <div className="bg-gray-50 p-1 rounded-xl border border-gray-200 flex items-center gap-1 text-xs">
              <button
                onClick={testRouteDeviationAlert}
                className="px-2 py-1 rounded-lg text-amber-700 hover:bg-amber-100 font-semibold transition cursor-pointer"
                title="Verify off-route detection (>500m detour)"
              >
                ⚠️ Detour Test
              </button>
              <button
                onClick={testExtendedStoppageAlert}
                className="px-2 py-1 rounded-lg text-purple-700 hover:bg-purple-100 font-semibold transition cursor-pointer"
                title="Verify stationary stop detection"
              >
                🛑 Stop Test
              </button>
            </div>

            <Link
              to="/rides"
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-700 transition"
            >
              📋 My Rides
            </Link>
          </div>
        </div>

        {/* 1. DRIVER PIN VERIFICATION MODAL */}
        {showPinModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#00a86b] flex items-center justify-center text-2xl mx-auto shadow-inner">
                🔑
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Enter Commuter's Code to Start
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Both parties are at the pickup point. Ask the commuter for the 4-digit code displayed on their screen, type it below, and verify to commence the commute.
                </p>
              </div>

              <form onSubmit={handleVerifyPinAndStart} className="space-y-4">
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-left">
                  <span className="text-[11px] font-bold text-amber-900 block mb-0.5">Commuter Verification Required</span>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    The commuter has a unique 4-digit code on their screen. Ask them to speak it verbally upon reaching their pickup location.
                  </p>
                </div>

                <div className="relative my-4">
                  {/* Invisible input capturing focus and numeric keypad */}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoFocus
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                      setPinError('');
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    aria-label="4-digit Boarding PIN"
                  />

                  {/* 4 Distinct PIN Box / Dot slots */}
                  <div className="flex items-center justify-center gap-3">
                    {[0, 1, 2, 3].map((idx) => {
                      const digit = enteredPin[idx];
                      const isFilled = digit !== undefined && digit !== '';
                      const isCurrent = enteredPin.length === idx;

                      return (
                        <div
                          key={idx}
                          className={`w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 ${
                            isFilled
                              ? 'border-[#00b87c] bg-[#e1f7ec]/50 text-gray-900 shadow-xs'
                              : isCurrent
                              ? 'border-[#00b87c] bg-white ring-4 ring-emerald-100 shadow-md scale-105'
                              : 'border-gray-200 bg-gray-50/80 text-gray-400'
                          }`}
                        >
                          {isFilled ? (
                            <span className="font-mono text-2xl sm:text-3xl font-black text-gray-900 select-none animate-fadeIn">
                              {digit}
                            </span>
                          ) : (
                            <span className={`text-2xl font-black select-none ${
                              isCurrent ? 'text-[#00a86b] animate-pulse' : 'text-gray-300'
                            }`}>
                              ●
                            </span>
                          )}
                          <span className={`w-2 h-1 rounded-full mt-1.5 transition-colors ${
                            isFilled ? 'bg-[#00b87c]' : isCurrent ? 'bg-emerald-400' : 'bg-gray-200'
                          }`} />
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-gray-400 mt-2.5 text-center font-medium">
                    {enteredPin.length === 4
                      ? '✓ All 4 digits entered. Ready to start commute!'
                      : `Enter commuter's 4-digit code (${enteredPin.length}/4 digits)`}
                  </p>

                  {pinError && (
                    <p className="text-xs font-semibold text-red-600 mt-2.5 bg-red-50 p-2.5 rounded-xl border border-red-200">
                      {pinError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinModal(false);
                      setPinError('');
                    }}
                    className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rideActionLoading || enteredPin.length !== 4}
                    className="flex-1 py-3 rounded-2xl bg-[#00b87c] hover:bg-[#00a36e] disabled:bg-gray-300 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{rideActionLoading ? 'Verifying...' : 'Verify & Start 🚀'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. DUAL-SIDED TRIP SUMMARY & FARE SETTLEMENT MODAL */}
        {settlementModalData && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#00a86b] flex items-center justify-center text-3xl mx-auto shadow-inner">
                🎉
              </div>

              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  Commute Completed Safely!
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isDriver
                    ? `You have reached the BITM campus gate with ${settlementModalData.passengerName || 'your rider'}.`
                    : `You have safely arrived at BITM campus with ${settlementModalData.driverName || 'your driver'}.`}
                </p>
              </div>

              {/* Fare Breakdown Card */}
              <div className="bg-[#f8faf9] border border-[#e2ece7] rounded-2xl p-4 text-left space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Commute Route Distance:</span>
                  <span className="font-bold text-gray-800">{settlementModalData.distanceKm || distanceKm || 9.55} km</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Travel Duration:</span>
                  <span className="font-bold text-gray-800">{settlementModalData.durationMins || etaMins || 20} mins</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Student Fuel Share Rate:</span>
                  <span className="font-bold text-emerald-700">₹2.00 / km (Pure Fuel Split)</span>
                </div>
                <div className="pt-2 border-t border-[#e2ece7] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-gray-400 block">Total Campus Fare</span>
                    <span className="text-2xl font-black text-[#00a86b]">
                      ₹{settlementModalData.totalFare || ride?.pricePerSeat || 21}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    Manual Cash / UPI
                  </span>
                </div>
              </div>

              {/* Payment Action Instructions */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left flex items-start gap-2.5">
                <span className="text-lg shrink-0">🤝</span>
                <div className="leading-relaxed">
                  <strong className="block font-bold">
                    {isDriver ? 'Collect Payment Manually' : 'Pay Driver Directly'}
                  </strong>
                  {isDriver
                    ? `Please collect ₹${settlementModalData.totalFare || ride?.pricePerSeat || 21} directly from ${settlementModalData.passengerName || 'your passenger'} via UPI QR or Cash.`
                    : `Please pay ₹${settlementModalData.totalFare || ride?.pricePerSeat || 21} directly to ${settlementModalData.driverName || 'your driver'} via UPI (GPay/PhonePe) or Cash.`}
                </div>
              </div>

              {/* Star Rating Feedback */}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-gray-600 block">Rate this Campus Commute:</span>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-2xl transition cursor-pointer ${star <= rating ? 'text-amber-400 scale-110' : 'text-gray-200 hover:text-amber-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setSettlementModalData(null);
                  navigate('/rides');
                }}
                className="w-full py-3 rounded-2xl bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-sm shadow-md transition cursor-pointer"
              >
                ✓ Done & Settle Commute
              </button>
            </div>
          </div>
        )}

        {/* 3. MANUAL SOS COUNTDOWN MODAL (3-Second Abort / Cancel) */}
        {sosCountdown !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white border-2 border-red-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl font-black mx-auto animate-pulse">
                {sosCountdown}
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Triggering Campus Emergency SOS in {sosCountdown}s
              </h3>
              <p className="text-xs text-gray-500">
                Live GPS location and vehicle details will be broadcast to BITM Campus Security and your designated emergency contacts.
              </p>
              <div className="pt-2">
                <button
                  onClick={abortManualSos}
                  className="w-full py-3 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold text-sm transition shadow-md cursor-pointer"
                >
                  ✕ Cancel (False Alarm)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. ROUTE DEVIATION CHECK-IN MODAL (>500m Detour) */}
        {showDeviationModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white border-2 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-7 h-7 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Route Deviation Detected</h3>
                  <p className="text-xs text-amber-700 font-medium">Bike is &gt;500m away from planned path</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                You appear to be off your usual route to campus. Are you safe? Auto-escalating to emergency status in <strong>{deviationCountdown}s</strong>.
              </p>

              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-2 transition-all duration-1000 ease-linear"
                  style={{ width: `${(deviationCountdown / 60) * 100}%` }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowDeviationModal(false);
                    setDeviationSnoozedUntil(Date.now() + 10 * 60 * 1000);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  ✓ I am Safe (Intentional Detour)
                </button>
                <button
                  onClick={() => {
                    setShowDeviationModal(false);
                    executeSosActivation('Manual Escalation from Route Deviation Warning');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  🚨 Need Help (Trigger SOS)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. EXTENDED STOPPAGE MODAL (>7 min stationary) */}
        {showStoppageModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white border-2 border-purple-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-purple-700">
                <Clock className="w-7 h-7 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Extended Stoppage Check</h3>
                  <p className="text-xs text-purple-700 font-medium">Bike stationary for &gt;7 minutes mid-commute</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Your bike hasn't moved for over 7 minutes before reaching campus. Everything alright with the ride?
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowStoppageModal(false);
                    setStoppageSnoozedUntil(Date.now() + 10 * 60 * 1000);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs transition cursor-pointer"
                >
                  ✓ Caught in Traffic (All Good)
                </button>
                <button
                  onClick={() => {
                    setShowStoppageModal(false);
                    executeSosActivation('Manual Escalation from Extended Stoppage Alert');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  🚨 Need Assistance
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. SHARE LIVE RIDE MODAL */}
        {showShareModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-gray-900">Share Live Ride with Friend</h3>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-700 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Parents and roommates can watch your bike move on the map in real-time until you reach the BITM campus gate. No login needed.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-gray-700 truncate select-all">
                  {liveShareUrl}
                </span>
                <button
                  onClick={copyShareUrl}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold transition shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedShareLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedShareLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hey! Track my campus ride live on BikeMate: ${liveShareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>💬</span>
                  <span>Share via WhatsApp</span>
                </a>
                <button
                  onClick={() => window.open(liveShareUrl, '_blank')}
                  className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview Public Tracker</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. SOS EMERGENCY ACTIVE BANNER */}
        {sosActive && (
          <div className="p-4 sm:p-5 rounded-3xl bg-red-600 text-white shadow-xl space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce">🚨</span>
                <div>
                  <strong className="block font-black text-sm uppercase tracking-wide">
                    CAMPUS EMERGENCY SOS BROADCASTED
                  </strong>
                  <p className="text-xs text-red-100">
                    Reason: {sosReason} • High-Frequency (1s) GPS beaconing is broadcasting live.
                  </p>
                </div>
              </div>
              <button
                onClick={cancelActiveSos}
                className="px-4 py-1.5 bg-white text-red-700 rounded-xl text-xs font-bold hover:bg-red-50 transition self-start sm:self-auto cursor-pointer"
              >
                Mark Safe / Dismiss
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-red-500/80">
              <a
                href={whatsappSosUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <span>💬</span>
                <span>Send WhatsApp SOS ({emergencyPhone})</span>
              </a>

              <a
                href={smsSosUrl}
                className="px-3.5 py-1.5 bg-black/40 hover:bg-black/60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <span>✉️</span>
                <span>Send SMS SOS</span>
              </a>

              <a
                href="tel:112"
                className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Phone className="w-3 h-3" />
                <span>Call 112 Helpline</span>
              </a>
            </div>
          </div>
        )}

        {/* Main Split Layout: Live Map on Left, Ride Telemetry & Driver Panel on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Interactive Google Map with Live Driver Marker & OSRM Route */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pickup & Boarding Check-In Card */}
            {phase === 'AGREED' && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#00b87c] text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                    🤝
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">Driver & Rider at Pickup Location</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🟢 Ready to Board
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Both parties are at the pickup point. Rider shares the 4-digit PIN with driver to verify and commence commute.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {!isDriver ? (
                    <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white border border-emerald-300 shadow-xs">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Your Boarding Code</span>
                      <span className="font-mono text-base font-black text-[#00a86b] tracking-wider">{activePin}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEnteredPin('');
                        setPinError('');
                        setShowPinModal(true);
                      }}
                      disabled={rideActionLoading}
                      className="px-4 py-2.5 rounded-xl bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Enter Commuter Code & Start 🚀</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="h-[520px] sm:h-[580px] rounded-[24px] overflow-hidden border border-gray-100 shadow-xs relative">
              <MapComponent
                isTrackingMode={true}
                driverCoords={driverCoords}
                pickupCoords={pickupCoords}
                destCoords={destCoords}
                routeCoordinates={osrmTripPoints}
                approachStatus={getStatusBanner()}
              />

              {sosActive && (
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3.5 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-pulse">
                  <Radio className="w-4 h-4" />
                  <span>1-Second High-Precision SOS Beacon Active</span>
                </div>
              )}
            </div>

            {/* Road Progress Simulator (Available for interactive live test) */}
            {phase === 'IN_PROGRESS' && (
              <div className="bg-white border border-gray-100 rounded-[20px] p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#00b87c]" />
                    <span>Live Road Progress & Vehicle Simulator:</span>
                  </span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {roadProgress}% to Campus
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={roadProgress}
                  onChange={(e) => handleRoadPositionChange(Number(e.target.value))}
                  className="w-full accent-[#00b87c] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>📍 Start Pickup</span>
                  <span>Mid Route</span>
                  <span>🏫 BITM Campus</span>
                </div>
              </div>
            )}
          </div>

          {/* Ride Details & Control Panel */}
          <div className="space-y-4">
            {/* Live Telemetry / ETA Gauge */}
            <div className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ride Telematics
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  phase === 'COMPLETED'
                    ? 'bg-gray-100 text-gray-700 border-gray-200'
                    : phase === 'IN_PROGRESS'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                    : 'bg-[#e1f7ec] text-[#00a86b] border-[#98e6c4]'
                }`}>
                  {phase === 'AGREED' && '🤝 Agreed • Ready'}
                  {phase === 'IN_PROGRESS' && '🚀 Riding to BITM'}
                  {phase === 'COMPLETED' && '🏁 Arrived Safely'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center my-3 py-3 border-y border-gray-100">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Remaining</div>
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

              {/* Start Ride Button or End Ride Button */}
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                {phase === 'AGREED' && (
                  isDriver ? (
                    <button
                      onClick={() => {
                        setEnteredPin('');
                        setPinError('');
                        setShowPinModal(true);
                      }}
                      disabled={rideActionLoading}
                      className="w-full py-2.5 rounded-xl bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Enter Commuter Code to Start 🚀</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <p className="text-xs text-emerald-800 font-bold">Driver is at pickup point!</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">Read your 4-digit code to the driver to start the ride.</p>
                    </div>
                  )
                )}

                {phase === 'IN_PROGRESS' && (
                  <button
                    onClick={handleCompleteRide}
                    disabled={rideActionLoading}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                  >
                    <Check className="w-4 h-4" />
                    <span>End Ride (Reached Campus) 🏁</span>
                  </button>
                )}
              </div>

              {/* Boarding Code Display (Only visible to Commuter) */}
              {!isDriver ? (
                <div className="bg-[#eaf7f2] border border-[#daf1e8] rounded-2xl p-3 flex items-center justify-between mt-3 shadow-2xs">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                      Your Secret Boarding Code
                    </span>
                    <span className="text-xs text-gray-700">
                      Read this code verbally to the driver:
                    </span>
                  </div>
                  <div className="text-xl font-mono font-black tracking-widest text-[#00a86b] bg-white px-3 py-1 rounded-xl border border-[#98e6c4] shadow-xs">
                    {activePin}
                  </div>
                </div>
              ) : (
                phase === 'AGREED' && (
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex items-center justify-between mt-3">
                    <div>
                      <span className="text-[10px] text-amber-800 uppercase font-bold block">
                        Verification Required
                      </span>
                      <span className="text-xs text-gray-700">
                        Ask commuter for the 4-digit code shown on their screen.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEnteredPin('');
                        setPinError('');
                        setShowPinModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      Enter Code
                    </button>
                  </div>
                )
              )}
            </div>

            {/* Driver / Commuter Identity Card */}
            <div className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center text-xl font-black shadow-xs">
                    {(driverName || 'D')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                      {driverName}
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
                    <span className="text-gray-500 text-[11px]">{vehicleNumber} • Helmet Available</span>
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
              </div>

              {/* Communication & Emergency Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={driver?.phone ? `tel:${driver.phone}` : '#'}
                  onClick={(e) => { if (!driver?.phone) { e.preventDefault(); alert('Driver phone number not provided.'); } }}
                  className="py-2.5 px-3 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition text-center"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Driver</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="py-2.5 px-3 rounded-full bg-[#eaf7f2] hover:bg-[#daf1e8] text-emerald-800 border border-[#daf1e8] text-xs font-semibold flex items-center justify-center gap-1.5 transition text-center cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Ride</span>
                </button>
              </div>

              {/* Safety SOS Button (Triggers 3-second abort countdown) */}
              <button
                type="button"
                onClick={initiateManualSos}
                className="w-full py-2.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
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
