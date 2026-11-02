import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import MapComponent from '../components/MapComponent';
import Logo from '../components/Logo';
import { 
  Shield, 
  MapPin, 
  Clock, 
  Navigation, 
  Phone, 
  AlertTriangle, 
  CheckCircle2, 
  Share2,
  Bike,
  Activity,
  Compass
} from 'lucide-react';

export default function LiveShareTracking() {
  const { rideId: paramRideId } = useParams();
  const [searchParams] = useSearchParams();
  const rideId = paramRideId || searchParams.get('token') || searchParams.get('rideId') || 'latest';

  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Live telematics
  const [phase, setPhase] = useState('APPROACHING');
  const [distanceKm, setDistanceKm] = useState(2.4);
  const [etaMins, setEtaMins] = useState(5);
  const [currentSpeed, setCurrentSpeed] = useState(36);
  const [driverCoords, setDriverCoords] = useState({ lat: 15.1485, lng: 76.9320 });
  const [pickupCoords, setPickupCoords] = useState({ lat: 15.1394, lng: 76.9214 });
  const [destCoords, setDestCoords] = useState({ lat: 15.1677, lng: 76.8506 });
  const [sosActive, setSosActive] = useState(false);
  const [sosDetails, setSosDetails] = useState(null);
  const [lastPingTime, setLastPingTime] = useState(new Date());

  const socketRef = useRef(null);

  // 1. Fetch public ride details
  useEffect(() => {
    const fetchRide = async () => {
      setLoading(true);
      try {
        let endpoint = `http://localhost:5000/api/rides/public/${rideId}`;
        if (rideId === 'latest') {
          const resSummary = await axios.get('http://localhost:5000/api/rides/public/summary');
          if (resSummary.data?.latestRide?.id) {
            endpoint = `http://localhost:5000/api/rides/public/${resSummary.data.latestRide.id}`;
          }
        }

        const res = await axios.get(endpoint);
        const rideData = res.data;
        setRide(rideData);
        setDriver(rideData.offeredBy || null);

        if (rideData.origin?.coordinates && rideData.origin.coordinates.length >= 2) {
          const origLng = rideData.origin.coordinates[0];
          const origLat = rideData.origin.coordinates[1];
          setPickupCoords({ lat: origLat, lng: origLng });
          setDriverCoords({ lat: origLat + 0.0075, lng: origLng + 0.0065 });
        }
        if (rideData.destination?.coordinates && rideData.destination.coordinates.length >= 2) {
          setDestCoords({
            lat: rideData.destination.coordinates[1],
            lng: rideData.destination.coordinates[0]
          });
        }
        if (rideData.distanceKm) {
          setDistanceKm(rideData.distanceKm);
          setEtaMins(Math.ceil(rideData.distanceKm * 2.2));
        }
      } catch (err) {
        console.warn('Failed to load shared ride:', err.message);
        setError('Could not load shared ride details. The ride may have finished or the link is invalid.');
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [rideId]);

  // 2. Socket.io Real-time Connection (No login required)
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    const socket = socketRef.current;

    const targetRoomId = ride?._id || rideId;
    if (targetRoomId && targetRoomId !== 'latest') {
      socket.emit('joinRide', targetRoomId);
    }

    socket.on('driverGPSUpdate', (data) => {
      if (data.coords) {
        setDriverCoords(data.coords);
        setLastPingTime(new Date());
      }
      if (data.speed !== undefined) setCurrentSpeed(data.speed);
      if (data.distanceKm !== undefined) setDistanceKm(data.distanceKm);
      if (data.etaMins !== undefined) setEtaMins(data.etaMins);
      if (data.phase) setPhase(data.phase);
    });

    socket.on('rideStatusUpdate', (data) => {
      if (data.phase) setPhase(data.phase);
    });

    socket.on('SOS_TRIGGERED', (data) => {
      setSosActive(true);
      setSosDetails(data);
    });

    socket.on('SOS_RESOLVED', () => {
      setSosActive(false);
      setSosDetails(null);
    });

    return () => {
      socket.disconnect();
    };
  }, [ride, rideId]);

  const copyShareLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('Live tracking link copied to clipboard!');
    }
  };

  const getStatusBadge = () => {
    switch (phase) {
      case 'ASSIGNED':
        return { text: 'Driver Dispatched', bg: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'APPROACHING':
        return { text: 'Heading to Pickup', bg: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'ARRIVED':
        return { text: 'Arrived at Pickup', bg: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'IN_PROGRESS':
        return { text: 'En Route to Campus', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'COMPLETED':
        return { text: 'Completed Safely', bg: 'bg-gray-100 text-gray-700 border-gray-200' };
      default:
        return { text: 'Live On Route', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Live Public Tracker
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              title="Copy link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>
            <a
              href="tel:112"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Helpline 112</span>
            </a>
          </div>
        </div>
      </header>

      {/* SOS Alert Banner */}
      {sosActive && (
        <div className="bg-red-600 text-white px-4 py-3 shadow-md">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 animate-bounce shrink-0" />
              <div>
                <strong>🚨 EMERGENCY SOS ACTIVATED FOR THIS RIDE</strong>
                <p className="text-red-100 text-xs">
                  Campus security and emergency contacts have been notified. Live telemetry is being monitored in real time.
                </p>
              </div>
            </div>
            <a
              href="tel:112"
              className="px-3 py-1.5 bg-white text-red-700 font-bold rounded-lg text-xs whitespace-nowrap hover:bg-red-50"
            >
              Call 112 Now
            </a>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col gap-6">
        {/* Ride Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                Tracking Commute to Campus
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.bg}`}>
                {statusBadge.text}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Shared by a verified BikeMate student. Real-time GPS stream active.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-emerald-50/70 border border-emerald-100 rounded-xl px-4 py-2.5 self-start sm:self-auto">
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Estimated Arrival</p>
              <p className="text-xl font-extrabold text-emerald-700">{etaMins} mins</p>
            </div>
            <div className="h-8 w-px bg-emerald-200" />
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Remaining</p>
              <p className="text-xl font-extrabold text-emerald-700">{distanceKm} km</p>
            </div>
          </div>
        </div>

        {/* Content Split: Map & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1">
          {/* Map Column */}
          <div className="lg:col-span-2 h-[480px] sm:h-[560px] rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs relative bg-gray-100">
            <MapComponent
              origin={pickupCoords}
              destination={destCoords}
              driverCoords={driverCoords}
              pickupCoords={pickupCoords}
              destCoords={destCoords}
              isTrackingMode={true}
              approachStatus={phase}
            />

            {/* Live GPS Ping Badge */}
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs border border-gray-200 rounded-xl px-3 py-2 shadow-sm text-xs flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div>
                <p className="font-bold text-gray-800">Live GPS Stream</p>
                <p className="text-[10px] text-gray-500">
                  {currentSpeed} km/h • Updated {lastPingTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                </p>
              </div>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="space-y-4">
            {/* Driver Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-lg shadow-inner">
                  {driver?.name ? driver.name.charAt(0).toUpperCase() : '🏍️'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {driver?.name || 'Verified Student Driver'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {driver?.college || 'Ballari Institute of Technology and Management'}
                  </p>
                  {driver?.usn && (
                    <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      USN: {driver.usn}
                    </span>
                  )}
                </div>
              </div>

              {driver?.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Driver ({driver.phone})</span>
                </a>
              )}
            </div>

            {/* Route Stops Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Commute Route
              </h4>

              <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                <div className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                  <p className="text-[11px] text-gray-400 font-medium">Pickup Point</p>
                  <p className="text-xs font-semibold text-gray-800">
                    {ride?.originAddress || 'Origin Location'}
                  </p>
                </div>

                <div className="relative pt-2">
                  <div className="absolute -left-6 top-3 w-2.5 h-2.5 rounded-full bg-[#111827] ring-4 ring-gray-200" />
                  <p className="text-[11px] text-gray-400 font-medium">Campus Destination</p>
                  <p className="text-xs font-semibold text-gray-800">
                    {ride?.destAddress || 'Ballari Institute of Technology and Management, Ballari'}
                  </p>
                </div>
              </div>
            </div>

            {/* Safety Assurance Card */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <Shield className="w-4 h-4 text-emerald-700" />
                <span>BikeMate Campus Safe Network</span>
              </div>
              <p className="text-emerald-800/80 leading-relaxed text-[11px]">
                Both driver and rider have completed institutional ID card OCR verification and college domain validation. Campus security has real-time oversight of this trip.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
