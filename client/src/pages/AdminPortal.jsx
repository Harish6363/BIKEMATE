import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/Logo';

function AdminPortal() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'logs' | 'rides'
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // Real-Time Emergency SOS Siren State
  const [incomingSosAlert, setIncomingSosAlert] = useState(null);
  const sirenAudioRef = useRef(null);
  const sirenIntervalRef = useRef(null);
  const socketRef = useRef(null);

  // Metrics state (Real-Time from DB)
  const [metrics, setMetrics] = useState({
    registeredStudents: 0,
    verifiedStudents: 0,
    vehiclesSaved: 0,
    co2SavedKg: '0.0',
    fuelConservedL: '0.0',
    activeRides: 0
  });
  const [infrastructure, setInfrastructure] = useState({
    backendService: 'Connected',
    databaseStatus: 'Connected',
    uptimeSeconds: 0,
    nodeEnv: 'production'
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Authorized Phone Numbers Whitelist state
  const [approvedStudents, setApprovedStudents] = useState([]);
  const [whitelistSearch, setWhitelistSearch] = useState('');
  const [newSinglePhone, setNewSinglePhone] = useState('');
  const [newSingleNotes, setNewSingleNotes] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Active Rides state + Date Filter
  const [rides, setRides] = useState([]);
  const [ridesDateFilter, setRidesDateFilter] = useState('ALL');

  // Ride Requests state + Date Filter
  const [requests, setRequests] = useState([]);
  const [requestsDateFilter, setRequestsDateFilter] = useState('ALL');

  // Audit Logs state + Date Filter
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL'); // 'ALL' | 'INFO' | 'SECURITY' | 'WARNING' | 'ERROR' | 'SOS'
  const [logsDateFilter, setLogsDateFilter] = useState('ALL');

  // Toast / notification
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Fetch Metrics & Infrastructure
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/metrics');
      if (res.data?.metrics) setMetrics(res.data.metrics);
      if (res.data?.infrastructure) setInfrastructure(res.data.infrastructure);
    } catch (err) {
      console.warn('Failed to load admin metrics:', err.message);
    }
  }, []);

  // 2. Fetch Users
  const fetchUsers = useCallback(async (search = '') => {
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/users?search=${encodeURIComponent(search)}`);
      setUsers(res.data || []);
    } catch (err) {
      console.warn('Failed to load users:', err.message);
    }
  }, []);

  // 3. Fetch Rides
  const fetchRides = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/rides');
      setRides(res.data || []);
    } catch (err) {
      console.warn('Failed to load rides:', err.message);
    }
  }, []);

  // 3b. Fetch Ride Requests
  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/requests');
      setRequests(res.data || []);
    } catch (err) {
      console.warn('Failed to load ride requests:', err.message);
    }
  }, []);

  // 4. Fetch Audit Logs
  const fetchLogs = useCallback(async (level = 'ALL') => {
    try {
      const levelParam = level === 'ALL' ? '' : level;
      const res = await axios.get(`http://localhost:5000/api/admin/logs?level=${levelParam}`);
      setLogs(res.data || []);
    } catch (err) {
      console.warn('Failed to load logs:', err.message);
    }
  }, []);

  // 5. Fetch Approved Students Whitelist
  const fetchApprovedStudents = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/approved-students');
      setApprovedStudents(res.data?.students || []);
    } catch (err) {
      console.warn('Failed to load approved students:', err.message);
    }
  }, []);

  // Whitelist Actions: Add Single Phone Number
  const handleAddSinglePhone = async (e) => {
    e.preventDefault();
    if (!newSinglePhone.trim()) return;
    try {
      const res = await axios.post('http://localhost:5000/api/admin/approved-students', {
        phoneNumber: newSinglePhone.trim(),
        department: newSingleNotes.trim() || 'AIML'
      });
      showToast(res.data.message || 'Phone number authorized');
      setNewSinglePhone('');
      setNewSingleNotes('');
      fetchApprovedStudents();
    } catch (err) {
      showToast(err.response?.data?.message || err.message);
    }
  };

  // Whitelist Actions: Bulk Import Phone Numbers
  const handleBulkAddPhones = async (e) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;
    try {
      const res = await axios.post('http://localhost:5000/api/admin/approved-students', {
        phoneNumbers: bulkInput.trim()
      });
      showToast(res.data.message || 'Bulk phone numbers imported');
      setBulkInput('');
      setShowBulkModal(false);
      fetchApprovedStudents();
    } catch (err) {
      showToast(err.response?.data?.message || err.message);
    }
  };

  // Whitelist Actions: Delete Phone Number
  const handleDeleteApprovedStudent = async (id, phone) => {
    if (!window.confirm(`Remove phone number ${phone} from authorized database?`)) return;
    try {
      const res = await axios.delete(`http://localhost:5000/api/admin/approved-students/${id}`);
      showToast(res.data.message || 'Phone number removed');
      fetchApprovedStudents();
    } catch (err) {
      showToast(err.response?.data?.message || err.message);
    }
  };

  // === DATE GROUPING & EXPORT UTILITIES ===
  const getDayKey = (dateVal) => {
    if (!dateVal) return 'UNKNOWN';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'UNKNOWN';
    return d.toISOString().split('T')[0];
  };

  const formatDayHeading = (isoKey) => {
    if (!isoKey || isoKey === 'UNKNOWN') return 'Earlier / Unscheduled';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (isoKey === today) {
      return `Today — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (isoKey === yesterday) {
      return `Yesterday — ${new Date(Date.now() - 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    const [y, m, d] = isoKey.split('-');
    const obj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return obj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const groupItemsByDay = (items, dateGetter, filterKey) => {
    const map = {};
    items.forEach(it => {
      const key = getDayKey(dateGetter(it));
      if (!map[key]) map[key] = [];
      map[key].push(it);
    });

    let keys = Object.keys(map).sort((a, b) => b.localeCompare(a));
    if (filterKey && filterKey !== 'ALL') {
      keys = keys.filter(k => k === filterKey);
    }

    return keys.map(k => ({
      key: k,
      heading: formatDayHeading(k),
      items: map[k]
    }));
  };

  const exportCsv = (filename, headers, rows) => {
    const esc = (v) => {
      if (v === null || v === undefined) return '""';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const content = [
      headers.map(esc).join(','),
      ...rows.map(r => r.map(esc).join(','))
    ].join('\r\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export Rides
  const handleExportRidesCsv = (dayGroup) => {
    const targetItems = dayGroup ? dayGroup.items : rides;
    const dateTag = dayGroup ? dayGroup.key : 'all-dates';
    const headers = ['Driver Name', 'College', 'Origin', 'Destination', 'Departure Time', 'Cost (₹)', 'Status', 'Vehicle'];
    const rows = targetItems.map(r => [
      r.offeredBy?.name || 'Driver',
      r.offeredBy?.college || 'BITM',
      r.originAddress || '',
      r.destAddress || '',
      r.departureTime ? new Date(r.departureTime).toLocaleString('en-IN') : '',
      r.pricePerSeat || 0,
      r.status || 'active',
      r.vehicleType || 'Bike'
    ]);
    exportCsv(`bikemate_rides_${dateTag}.csv`, headers, rows);
    showToast(`Downloaded ${targetItems.length} rides as Sheets (CSV)`);
  };

  // Export Requests
  const handleExportRequestsCsv = (dayGroup) => {
    const targetItems = dayGroup ? dayGroup.items : requests;
    const dateTag = dayGroup ? dayGroup.key : 'all-dates';
    const headers = ['Request Time', 'Passenger Name', 'Passenger Contact', 'Driver Name', 'Pickup', 'Destination', 'Seats', 'Fare (₹)', 'Status'];
    const rows = targetItems.map(rq => [
      rq.createdAt ? new Date(rq.createdAt).toLocaleString('en-IN') : '',
      rq.requester?.name || 'Student',
      rq.requester?.phone || rq.requester?.usn || '',
      rq.driver?.name || 'Driver',
      rq.pickupAddress || rq.ride?.originAddress || '',
      rq.ride?.destAddress || 'Campus',
      rq.seatsRequested || 1,
      rq.calculatedFare || rq.ride?.pricePerSeat || 0,
      rq.status || 'pending'
    ]);
    exportCsv(`bikemate_requests_${dateTag}.csv`, headers, rows);
    showToast(`Downloaded ${targetItems.length} requests as Sheets (CSV)`);
  };

  // Export Logs
  const handleExportLogsCsv = (dayGroup) => {
    const targetItems = dayGroup ? dayGroup.items : logs;
    const dateTag = dayGroup ? dayGroup.key : 'all-dates';
    const headers = ['Timestamp', 'Level', 'Action Event', 'User', 'Details'];
    const rows = targetItems.map(l => [
      l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN') : '',
      l.level || 'INFO',
      l.actionEvent || '',
      l.user || 'System',
      l.details || ''
    ]);
    exportCsv(`bikemate_audit_logs_${dateTag}.csv`, headers, rows);
    showToast(`Downloaded ${targetItems.length} audit logs as Sheets (CSV)`);
  };

  // Refresh all data
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([
      fetchMetrics(),
      fetchUsers(searchQuery),
      fetchRides(),
      fetchRequests(),
      fetchLogs(logFilter),
      fetchApprovedStudents()
    ]);
    setLastRefreshed(Date.now());
    setLoading(false);
    showToast('Platform data refreshed');
  };

  useEffect(() => {
    handleRefresh();
    // Real-Time Auto Polling every 8 seconds for active rides, requests, logs & telemetry
    const interval = setInterval(() => {
      fetchMetrics();
      fetchRides();
      fetchRequests();
      fetchLogs(logFilter);
      fetchApprovedStudents();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchRides, fetchRequests, fetchLogs, fetchApprovedStudents, logFilter]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchUsers]);

  // Log filter change
  useEffect(() => {
    fetchLogs(logFilter);
  }, [logFilter, fetchLogs]);

  // Web Audio Synthetic Siren Generator (No audio files needed, works in all browsers)
  const startSiren = useCallback(() => {
    try {
      if (sirenIntervalRef.current) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      sirenAudioRef.current = ctx;

      const playTone = () => {
        if (!sirenAudioRef.current || sirenAudioRef.current.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1150, ctx.currentTime + 0.35);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.7);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.72);
      };

      playTone();
      sirenIntervalRef.current = setInterval(playTone, 800);
    } catch (e) {
      console.warn('Audio siren start failed:', e);
    }
  }, []);

  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (sirenAudioRef.current) {
      try { sirenAudioRef.current.close(); } catch (e) {}
      sirenAudioRef.current = null;
    }
  }, []);

  // Real-Time Socket Connection for Instant SOS Alerts
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    const socket = socketRef.current;

    socket.on('ADMIN_SOS_ALERT', (data) => {
      console.log('🚨 ADMIN RECEIVED SOS ALERT:', data);
      setIncomingSosAlert(data);
      startSiren();
      fetchLogs();
      fetchMetrics();
    });

    socket.on('ADMIN_SOS_RESOLVED', (data) => {
      console.log('✅ ADMIN SOS RESOLVED:', data);
      setIncomingSosAlert(null);
      stopSiren();
      fetchLogs();
    });

    return () => {
      socket.disconnect();
      stopSiren();
    };
  }, [fetchLogs, fetchMetrics, startSiren, stopSiren]);

  const handleResolveAlert = async () => {
    stopSiren();
    if (incomingSosAlert) {
      socketRef.current?.emit('SOS_RESOLVED', { rideId: incomingSosAlert.rideId });
      try {
        await axios.post('http://localhost:5000/api/admin/logs', {
          level: 'INFO',
          actionEvent: 'CAMPUS_SOS_ACKNOWLEDGED_RESOLVED',
          user: user?.name || 'System Admin',
          details: `Resolved emergency alert for ride #${incomingSosAlert.rideId}. Campus security dispatched & student confirmed safe.`
        });
      } catch (e) {}
    }
    setIncomingSosAlert(null);
    showToast('Emergency alert acknowledged & marked resolved.');
    fetchLogs();
  };

  // User Actions: Ban / Unban
  const handleToggleBan = async (userId, currentlyBanned, userName) => {
    try {
      const res = await axios.patch(`http://localhost:5000/api/admin/users/${userId}/ban`, {
        reason: currentlyBanned ? '' : 'Violated campus safety policy'
      });
      showToast(res.data.message || `User status updated`);
      fetchUsers(searchQuery);
      fetchMetrics();
      fetchLogs(logFilter);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // User Actions: Verify ID
  const handleVerifyUser = async (userId, userName) => {
    try {
      const res = await axios.patch(`http://localhost:5000/api/admin/users/${userId}/verify`);
      showToast(`${userName} verified successfully`);
      fetchUsers(searchQuery);
      fetchMetrics();
      fetchLogs(logFilter);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // User Actions: Delete User
  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete student user ${userName}? This action cannot be undone.`)) {
      return;
    }
    try {
      await axios.delete(`http://localhost:5000/api/admin/users/${userId}`);
      showToast(`User ${userName} deleted`);
      fetchUsers(searchQuery);
      fetchMetrics();
      fetchLogs(logFilter);
    } catch (err) {
      showToast(`Error deleting user: ${err.message}`);
    }
  };

  // Ride Actions: Remove Ride
  const handleRemoveRide = async (rideId) => {
    if (!window.confirm('Remove this ride listing from the campus feed?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/rides/${rideId}`);
      showToast('Ride removed successfully');
      fetchRides();
      fetchMetrics();
      fetchLogs(logFilter);
    } catch (err) {
      showToast(`Error removing ride: ${err.message}`);
    }
  };

  // Format Uptime Helper
  const formatUptime = (sec) => {
    if (!sec || sec < 60) return `${sec || 86} sec`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min ${sec % 60} sec`;
    return `${Math.floor(sec / 3600)} hr ${Math.floor((sec % 3600) / 60)} min`;
  };

  // Level Badge Color Helper (Matching Rider Dashboard Aesthetic)
  const renderLevelBadge = (lvl) => {
    switch (lvl) {
      case 'SECURITY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
            SECURITY
          </span>
        );
      case 'INFO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            INFO
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            WARNING
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
            ERROR
          </span>
        );
      case 'SOS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide bg-red-600 text-white shadow-xs animate-pulse">
            🚨 SOS EVENT
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-gray-100 text-gray-700 border border-gray-200 shadow-xs">
            {lvl}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-gray-900 p-4 sm:p-6 md:p-8 font-sans transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Dedicated Admin Portal Header Bar - Separate from rider features */}
        <header className="bg-white p-4 sm:p-5 rounded-[24px] border border-gray-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Brand Logo & Admin Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/admin" className="flex items-center">
              <Logo size="md" />
            </Link>
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#00b87c] text-white shadow-xs">
              ADMIN PORTAL
            </span>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#00a86b] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Operational</span>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* System Admin User Badge */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold">
              <span>🛡️</span>
              <span>{user?.name || 'System Admin'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>Refresh</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition active:scale-95"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Toast popup */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-900/95 border border-emerald-400/40 text-emerald-300 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span>✓</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* FULL-SCREEN FLASHING RED SOS EMERGENCY SCREEN OVERLAY */}
        {incomingSosAlert && (
          <>
            <div className="fixed inset-0 pointer-events-none z-[9997] border-[16px] border-red-600 animate-pulse bg-red-600/15 transition-all duration-300" />
            <div className="fixed top-0 left-0 right-0 z-[9998] bg-red-600 text-white px-4 py-2.5 flex items-center justify-between shadow-2xl animate-pulse">
              <div className="flex items-center gap-2.5">
                <span className="text-xl animate-bounce">🚨</span>
                <span className="font-black text-xs sm:text-sm uppercase tracking-wide">
                  CRITICAL CAMPUS SOS ALERT: Student {incomingSosAlert.userName || 'Student'} ({incomingSosAlert.userPhone || 'Emergency'}) in distress!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={stopSiren}
                  className="text-xs px-2.5 py-1 bg-red-800 hover:bg-red-900 rounded-lg font-bold"
                >
                  Silence Siren
                </button>
                <button
                  onClick={handleResolveAlert}
                  className="text-xs px-3 py-1 bg-white text-red-700 hover:bg-red-50 rounded-lg font-bold shadow-xs"
                >
                  Acknowledge & Dispatch Security
                </button>
              </div>
            </div>
          </>
        )}

        {/* EMERGENCY SOS ALERT POPUP MODAL (WEBSOCKET SIREN ALERT) */}
        {incomingSosAlert && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white border-2 border-red-500 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-[0_0_60px_rgba(239,68,68,0.35)] text-gray-900 space-y-6">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping"></span>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-md">
                    🚨 CRITICAL CAMPUS SOS INCIDENT
                  </span>
                </div>
                <button
                  onClick={stopSiren}
                  className="text-xs px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold transition"
                >
                  🔇 Silence Siren
                </button>
              </div>

              {/* Alert Details */}
              <div className="space-y-4 bg-red-50/60 border border-red-200 rounded-2xl p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Trigger Reason</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">
                    {incomingSosAlert.reason || 'Emergency SOS Triggered by Student'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded-xl p-3 border border-red-100 shadow-xs">
                    <p className="text-gray-500 text-[10px] font-bold uppercase">Student in Distress</p>
                    <p className="font-bold text-sm text-gray-900 mt-1">{incomingSosAlert.userName || 'Student'}</p>
                    <p className="text-gray-600 font-mono mt-0.5">{incomingSosAlert.userPhone || 'No Phone'}</p>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-red-100 shadow-xs">
                    <p className="text-gray-500 text-[10px] font-bold uppercase">Assigned Driver</p>
                    <p className="font-bold text-sm text-gray-900 mt-1">{incomingSosAlert.driverName || 'Driver'}</p>
                    <p className="text-gray-600 font-mono mt-0.5">{incomingSosAlert.driverPhone || 'No Phone'}</p>
                    {incomingSosAlert.vehicleNumber && (
                      <p className="text-[#00a86b] font-semibold text-[11px] mt-0.5">{incomingSosAlert.vehicleNumber}</p>
                    )}
                  </div>
                </div>

                {/* Coordinates & Google Maps Link */}
                {incomingSosAlert.coords && (
                  <div className="text-xs text-gray-700 flex items-center justify-between bg-white p-3 rounded-xl border border-red-100">
                    <span className="font-mono text-[11px]">
                      📍 GPS: {incomingSosAlert.coords.lat?.toFixed(5)}, {incomingSosAlert.coords.lng?.toFixed(5)}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${incomingSosAlert.coords.lat},${incomingSosAlert.coords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00a86b] hover:underline font-bold text-[11px]"
                    >
                      Open Google Maps ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                {incomingSosAlert.userPhone && (
                  <a
                    href={`tel:${incomingSosAlert.userPhone}`}
                    className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs text-center transition shadow-md"
                  >
                    📞 Call Student ({incomingSosAlert.userPhone})
                  </a>
                )}
                {incomingSosAlert.rideId && (
                  <button
                    onClick={() => window.open(`/track/live-share/${incomingSosAlert.rideId}`, '_blank')}
                    className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition"
                  >
                    🗺️ Open Live Tracker
                  </button>
                )}
                <button
                  onClick={handleResolveAlert}
                  className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl bg-[#00b87c] hover:bg-[#00a36e] text-white font-bold text-xs transition shadow-md"
                >
                  ✓ Acknowledge & Mark Safe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5 PRIMARY NAVIGATION TABS (Rider Dashboard Style) */}
        <nav className="flex items-center gap-2 pb-1 overflow-x-auto">
        {/* Tab 1: Overview & Impact */}
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-[#00b87c] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80'
          }`}
        >
          <span className="text-sm">📊</span>
          <span>Overview & Impact</span>
        </button>

        {/* Tab 2: User Moderation */}
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#00b87c] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80'
          }`}
        >
          <span className="text-sm">👥</span>
          <span>User Moderation</span>
        </button>

        {/* Tab 3: Active Rides */}
        <button
          onClick={() => setActiveTab('rides')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'rides'
              ? 'bg-[#00b87c] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80'
          }`}
        >
          <span className="text-sm">🚲</span>
          <span>Active Rides</span>
          {rides.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'rides' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {rides.length}
            </span>
          )}
        </button>

        {/* Tab 4: Ride Requests */}
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'requests'
              ? 'bg-[#00b87c] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80'
          }`}
        >
          <span className="text-sm">📩</span>
          <span>Ride Requests</span>
          {requests.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {requests.length}
            </span>
          )}
        </button>

        {/* Tab 5: System Audit Logs */}
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-[#00b87c] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80'
          }`}
        >
          <span className="text-sm font-mono">&gt;_</span>
          <span>System Audit Logs</span>
        </button>

        {/* Tab 6: Authorized Phone Numbers Whitelist */}
        <button
          onClick={() => setActiveTab('whitelist')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'whitelist'
              ? 'bg-[#00b87c] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80'
          }`}
        >
          <span className="text-sm">📱</span>
          <span>Authorized Phone Numbers</span>
          {approvedStudents.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'whitelist' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {approvedStudents.length}
            </span>
          )}
        </button>
      </nav>

      {/* TAB 1: OVERVIEW & IMPACT */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Welcome Card matching Rider Home.jsx */}
          <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs">
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Platform Overview & Environmental Metrics</h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Real-time statistics on campus ride-sharing adoption and environmental footprint offset.</p>
          </div>

          {/* 4 Stat Cards in clean horizontal row (Fuel Conserved removed as requested) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Registered Students */}
            <div className="p-5 rounded-[24px] bg-white border border-gray-100 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shrink-0 text-xl shadow-xs">
                👥
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">REGISTERED STUDENTS</p>
                <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">{metrics.registeredStudents ?? 0}</p>
                <p className="text-[11px] text-[#00a86b] font-semibold mt-0.5">{metrics.verifiedStudents ?? 1} ID Verified</p>
              </div>
            </div>

            {/* Card 2: Vehicles Saved */}
            <div className="p-5 rounded-[24px] bg-white border border-gray-100 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 text-xl shadow-xs">
                🚗
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VEHICLES SAVED</p>
                <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">{metrics.vehiclesSaved ?? 0}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Shared Rides Off Road</p>
              </div>
            </div>

            {/* Card 3: CO2 Emissions Saved */}
            <div className="p-5 rounded-[24px] bg-white border border-gray-100 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 text-xl shadow-xs">
                🍃
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">CO₂ EMISSIONS SAVED</p>
                <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">{metrics.co2SavedKg ?? '0'} kg</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Carbon Footprint Avoided</p>
              </div>
            </div>

            {/* Card 4: Active Rides */}
            <div className="p-5 rounded-[24px] bg-white border border-gray-100 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 text-xl shadow-xs">
                📈
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">ACTIVE RIDES</p>
                <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">{metrics.activeRides ?? 0}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Live Scheduled Commutes</p>
              </div>
            </div>

          </div>

          {/* Server & Database Infrastructure Box (Clean White Rider Dashboard Card) */}
          <div className="max-w-md p-6 rounded-[24px] bg-white border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 font-bold text-sm text-gray-900">
              <span className="text-base">🗄️</span>
              <span>Server & Database Infrastructure</span>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                <span className="text-gray-500">Backend Service</span>
                <span className="flex items-center gap-1.5 text-[#00a86b] font-bold">
                  <span>✓</span>
                  <span>{infrastructure.backendService}</span>
                </span>
              </div>

              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                <span className="text-gray-500">MongoDB Database</span>
                <span className="flex items-center gap-1.5 text-[#00a86b] font-bold">
                  <span>🗃️</span>
                  <span>{infrastructure.databaseStatus}</span>
                </span>
              </div>

              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                <span className="text-gray-500">Server Uptime</span>
                <span className="text-gray-800 font-mono font-semibold">{formatUptime(infrastructure.uptimeSeconds)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Node Environment</span>
                <span className="text-gray-700 font-mono px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[11px] font-semibold">{infrastructure.nodeEnv}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: USER MODERATION */}
      {activeTab === 'users' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs">
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">User Account Moderation</h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Manage student accounts, verify student identity badges, and moderate users.</p>
          </div>

          {/* Search Input */}
          <div className="relative max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone or department..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-[#00b87c] transition shadow-xs"
            />
          </div>

          {/* Table (Clean Rider Dashboard Table) */}
          <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-5 py-3.5">STUDENT USER</th>
                    <th className="px-5 py-3.5">CONTACT DETAILS</th>
                    <th className="px-5 py-3.5">DEPT & SEMESTER</th>
                    <th className="px-5 py-3.5">ID VERIFICATION</th>
                    <th className="px-5 py-3.5">ACCOUNT STATUS</th>
                    <th className="px-5 py-3.5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-10 text-center text-gray-400">
                        No student accounts found matching your query.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isVerified = u.verificationStatus === 'verified';
                      const isBanned = !!u.isBanned;

                      return (
                        <tr key={u._id} className="hover:bg-gray-50/60 transition">
                          {/* Student User */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#00b87c]/10 text-[#00a86b] font-black flex items-center justify-center text-sm shadow-xs border border-[#00b87c]/20">
                                {(u.name || 'S')[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{u.name}</div>
                                <div className="text-gray-500 text-[11px]">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Contact Details */}
                          <td className="px-5 py-4 font-mono text-gray-600">
                            {u.phone || 'N/A'}
                          </td>

                          {/* Dept & Semester */}
                          <td className="px-5 py-4 text-gray-700">
                            {u.department || 'General'} ({u.semester || 'Sem 1'})
                          </td>

                          {/* ID Verification Badge */}
                          <td className="px-5 py-4">
                            {isVerified ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ VERIFIED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                UNVERIFIED
                              </span>
                            )}
                          </td>

                          {/* Account Status */}
                          <td className="px-5 py-4">
                            {isBanned ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                Banned
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Ban / Unban */}
                              <button
                                onClick={() => handleToggleBan(u._id, isBanned, u.name)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                  isBanned
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {isBanned ? 'Unban' : 'Ban'}
                              </button>

                              {/* Verify ID (if not verified) */}
                              {!isVerified && (
                                <button
                                  onClick={() => handleVerifyUser(u._id, u.name)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#00b87c]/10 hover:bg-[#00b87c]/20 text-[#00a86b] border border-[#00b87c]/30 transition"
                                >
                                  Verify ID
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteUser(u._id, u.name)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 hover:bg-rose-50 text-gray-500 hover:text-rose-600 border border-gray-200 transition"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE RIDES (DATE-SEPARATED & EXPORTABLE) */}
      {activeTab === 'rides' && (() => {
        const rideGroups = groupItemsByDay(rides, r => r.departureTime || r.createdAt, ridesDateFilter);
        const availableDates = Array.from(new Set(rides.map(r => getDayKey(r.departureTime || r.createdAt)).filter(k => k !== 'UNKNOWN'))).sort((a,b) => b.localeCompare(a));

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Header + Actions */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Active & Scheduled Rides History</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Campus ride offerings chronologically separated by calendar day.</p>
              </div>

              {/* Date Filter & Export Controls */}
              <div className="flex items-center gap-2.5 flex-wrap no-print">
                <select
                  value={ridesDateFilter}
                  onChange={(e) => setRidesDateFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#00b87c]"
                >
                  <option value="ALL">📅 All Dates ({rides.length})</option>
                  {availableDates.map(dKey => (
                    <option key={dKey} value={dKey}>{formatDayHeading(dKey)}</option>
                  ))}
                </select>

                <button
                  onClick={() => handleExportRidesCsv()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Download all rides matching filter as Excel / Sheets (CSV)"
                >
                  <span>📊</span>
                  <span>Export Sheets (.csv)</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Print or Save PDF report for selected view"
                >
                  <span>🖨️</span>
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            {/* Date-Separated Ride Groups */}
            {rideGroups.length === 0 ? (
              <div className="bg-white p-12 rounded-[28px] border border-gray-100 text-center text-gray-400 text-xs shadow-xs">
                No rides recorded for the selected date filter.
              </div>
            ) : (
              rideGroups.map((group) => (
                <div key={group.key} className="space-y-2.5">
                  {/* Day Heading Bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-100/90 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900">{group.heading}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white border border-gray-200 text-gray-700">
                        {group.items.length} {group.items.length === 1 ? 'ride' : 'rides'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <button
                        onClick={() => handleExportRidesCsv(group)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-[11px] font-semibold text-gray-700 flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Download this specific day's rides as CSV"
                      >
                        <span>📊</span>
                        <span>Day Sheets (.csv)</span>
                      </button>
                    </div>
                  </div>

                  {/* Day Table */}
                  <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="px-4 py-3">DRIVER</th>
                            <th className="px-4 py-3">ROUTE</th>
                            <th className="px-4 py-3">VEHICLE</th>
                            <th className="px-4 py-3">TIME</th>
                            <th className="px-4 py-3">COST</th>
                            <th className="px-4 py-3">STATUS</th>
                            <th className="px-4 py-3 text-right no-print">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.items.map((r) => {
                            const depDate = r.departureTime ? new Date(r.departureTime) : null;
                            const timeStr = depDate && !isNaN(depDate)
                              ? depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'TBD';

                            return (
                              <tr key={r._id} className="hover:bg-gray-50/60 transition">
                                <td className="px-4 py-3.5">
                                  <div className="font-bold text-gray-900 text-xs">{r.offeredBy?.name || 'Driver'}</div>
                                  <div className="text-gray-500 text-[10px]">{r.offeredBy?.phone || r.offeredBy?.college || 'BITM'}</div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="text-gray-800 font-medium text-xs">{r.originAddress || 'Origin'}</div>
                                  <div className="text-[#00a86b] text-[10px] flex items-center gap-1 font-semibold mt-0.5">
                                    <span>→</span>
                                    <span>{r.destAddress || 'Destination'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-gray-600 text-[11px] font-mono">
                                  {r.vehicleType || 'Bike'}
                                </td>
                                <td className="px-4 py-3.5 font-mono text-gray-600 text-xs">
                                  {timeStr}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-[#00a86b] text-xs">
                                  {r.pricePerSeat ? `₹${r.pricePerSeat}` : 'Free'}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                    {r.status || 'active'}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right no-print">
                                  <button
                                    onClick={() => handleRemoveRide(r._id)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {/* TAB 4: RIDE REQUESTS (DATE-SEPARATED & EXPORTABLE) */}
      {activeTab === 'requests' && (() => {
        const reqGroups = groupItemsByDay(requests, rq => rq.createdAt, requestsDateFilter);
        const availableDates = Array.from(new Set(requests.map(rq => getDayKey(rq.createdAt)).filter(k => k !== 'UNKNOWN'))).sort((a,b) => b.localeCompare(a));

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Header + Actions */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Campus Ride Requests History</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Review student ride booking requests, assigned drivers, and statuses separated by day.</p>
              </div>

              {/* Date Filter & Export Controls */}
              <div className="flex items-center gap-2.5 flex-wrap no-print">
                <select
                  value={requestsDateFilter}
                  onChange={(e) => setRequestsDateFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#00b87c]"
                >
                  <option value="ALL">📅 All Dates ({requests.length})</option>
                  {availableDates.map(dKey => (
                    <option key={dKey} value={dKey}>{formatDayHeading(dKey)}</option>
                  ))}
                </select>

                <button
                  onClick={() => handleExportRequestsCsv()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Download all requests matching filter as Sheets (.csv)"
                >
                  <span>📊</span>
                  <span>Export Sheets (.csv)</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Print or Save PDF report for selected view"
                >
                  <span>🖨️</span>
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            {/* Date-Separated Request Groups */}
            {reqGroups.length === 0 ? (
              <div className="bg-white p-12 rounded-[28px] border border-gray-100 text-center text-gray-400 text-xs shadow-xs">
                No ride requests recorded for the selected date filter.
              </div>
            ) : (
              reqGroups.map((group) => (
                <div key={group.key} className="space-y-2.5">
                  {/* Day Heading Bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-100/90 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900">{group.heading}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white border border-gray-200 text-gray-700">
                        {group.items.length} {group.items.length === 1 ? 'request' : 'requests'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <button
                        onClick={() => handleExportRequestsCsv(group)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-[11px] font-semibold text-gray-700 flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Download this specific day's requests as CSV"
                      >
                        <span>📊</span>
                        <span>Day Sheets (.csv)</span>
                      </button>
                    </div>
                  </div>

                  {/* Day Table */}
                  <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="px-4 py-3">REQUESTER</th>
                            <th className="px-4 py-3">DRIVER</th>
                            <th className="px-4 py-3">ROUTE DETAILS</th>
                            <th className="px-4 py-3">SEATS & FARE</th>
                            <th className="px-4 py-3">STATUS</th>
                            <th className="px-4 py-3 text-right">TIME</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.items.map((req) => {
                            const reqDate = req.createdAt ? new Date(req.createdAt) : null;
                            const timeStr = reqDate && !isNaN(reqDate)
                              ? reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Recent';

                            const statusBadge = req.status === 'accepted' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Accepted
                              </span>
                            ) : req.status === 'rejected' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                ✕ Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                ⏳ Pending
                              </span>
                            );

                            return (
                              <tr key={req._id} className="hover:bg-gray-50/60 transition">
                                <td className="px-4 py-3.5">
                                  <div className="font-bold text-gray-900 text-xs">{req.requester?.name || 'Student'}</div>
                                  <div className="text-gray-500 text-[10px]">{req.requester?.phone || req.requester?.usn || 'Campus Member'}</div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="font-semibold text-gray-800 text-xs">{req.driver?.name || 'Driver'}</div>
                                  <div className="text-gray-500 text-[10px]">{req.driver?.phone || 'Campus Driver'}</div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="text-gray-800 font-medium text-xs">{req.pickupAddress || req.ride?.originAddress || 'Origin'}</div>
                                  <div className="text-[#00a86b] text-[10px] flex items-center gap-1 font-semibold mt-0.5">
                                    <span>→</span>
                                    <span>{req.ride?.destAddress || 'Campus'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="text-gray-800 font-medium text-xs">{req.seatsRequested || 1} Seat(s)</div>
                                  <div className="text-[#00a86b] font-bold text-[11px]">
                                    {req.calculatedFare ? `₹${req.calculatedFare}` : req.ride?.pricePerSeat ? `₹${req.ride.pricePerSeat}` : 'Free'}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  {statusBadge}
                                </td>
                                <td className="px-4 py-3.5 font-mono text-gray-500 text-xs text-right">
                                  {timeStr}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {/* TAB 5: SYSTEM AUDIT LOGS (DATE-SEPARATED & EXPORTABLE) */}
      {activeTab === 'logs' && (() => {
        const logGroups = groupItemsByDay(logs, l => l.timestamp || l.createdAt, logsDateFilter);
        const availableDates = Array.from(new Set(logs.map(l => getDayKey(l.timestamp || l.createdAt)).filter(k => k !== 'UNKNOWN'))).sort((a,b) => b.localeCompare(a));

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Header + Actions */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">System Activity Audit Logs</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Real-time log events for authentication, security violations, and SOS triggers separated by day.</p>
              </div>

              {/* Date Filter & Export Controls */}
              <div className="flex items-center gap-2.5 flex-wrap no-print">
                <select
                  value={logsDateFilter}
                  onChange={(e) => setLogsDateFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#00b87c]"
                >
                  <option value="ALL">📅 All Dates ({logs.length})</option>
                  {availableDates.map(dKey => (
                    <option key={dKey} value={dKey}>{formatDayHeading(dKey)}</option>
                  ))}
                </select>

                <button
                  onClick={() => handleExportLogsCsv()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Download all audit logs matching filter as Sheets (.csv)"
                >
                  <span>📊</span>
                  <span>Export Sheets (.csv)</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Print or Save PDF report for selected view"
                >
                  <span>🖨️</span>
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            {/* Level Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
              {['ALL', 'INFO', 'SECURITY', 'WARNING', 'ERROR', 'SOS'].map((lvl) => {
                const label = lvl === 'ALL' ? 'All Logs' : lvl === 'SOS' ? '🚨 SOS Events' : lvl.charAt(0) + lvl.slice(1).toLowerCase();
                const isSelected = logFilter === lvl;

                return (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#00b87c] text-white shadow-xs'
                        : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Date-Separated Log Groups */}
            {logGroups.length === 0 ? (
              <div className="bg-white p-12 rounded-[28px] border border-gray-100 text-center text-gray-400 text-xs shadow-xs">
                No audit log events recorded for this date and filter.
              </div>
            ) : (
              logGroups.map((group) => (
                <div key={group.key} className="space-y-2.5">
                  {/* Day Heading Bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-100/90 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900">{group.heading}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white border border-gray-200 text-gray-700">
                        {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <button
                        onClick={() => handleExportLogsCsv(group)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-[11px] font-semibold text-gray-700 flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Download this specific day's logs as CSV"
                      >
                        <span>📊</span>
                        <span>Day Sheets (.csv)</span>
                      </button>
                    </div>
                  </div>

                  {/* Day Table */}
                  <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="px-4 py-3">TIME</th>
                            <th className="px-4 py-3">LEVEL</th>
                            <th className="px-4 py-3">ACTION EVENT</th>
                            <th className="px-4 py-3">USER</th>
                            <th className="px-4 py-3">DETAILS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.items.map((log) => {
                            const ts = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'TBD';

                            return (
                              <tr key={log._id} className="hover:bg-gray-50/60 transition">
                                <td className="px-4 py-3 font-mono text-gray-500 text-xs whitespace-nowrap">
                                  {ts}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {renderLevelBadge(log.level)}
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-gray-900 text-xs whitespace-nowrap">
                                  {log.actionEvent}
                                </td>
                                <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap font-medium">
                                  {log.user || 'System'}
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-gray-600 max-w-md truncate">
                                  {log.details || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {/* TAB 6: AUTHORIZED STUDENT PHONE NUMBERS (WHITELIST MANAGEMENT) */}
      {activeTab === 'whitelist' && (() => {
        const filteredList = approvedStudents.filter(item => {
          if (!whitelistSearch.trim()) return true;
          const q = whitelistSearch.toLowerCase();
          return (
            (item.phoneNumber && item.phoneNumber.toLowerCase().includes(q)) ||
            (item.department && item.department.toLowerCase().includes(q)) ||
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.usn && item.usn.toLowerCase().includes(q))
          );
        });

        const totalCount = approvedStudents.length;
        const registeredCount = approvedStudents.filter(s => s.isRegistered).length;
        const pendingCount = totalCount - registeredCount;

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Card */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Campus Authorized Phone Numbers</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                  Pre-authorized mobile numbers permitted to create student accounts. Matching strictly validates phone numbers; Name and USN are freely captured upon student registration.
                </p>
              </div>

              {/* Bulk Import Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00b87c] hover:bg-[#00a86b] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  <span>📋</span>
                  <span>Bulk Import Phone Numbers</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00a86b] flex items-center justify-center font-bold text-lg">
                  📱
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL AUTHORIZED</p>
                  <p className="text-xl font-black text-gray-900">{totalCount}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-lg">
                  ✓
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">REGISTERED STUDENTS</p>
                  <p className="text-xl font-black text-cyan-700">{registeredCount}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
                  ⏳
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PENDING FIRST SIGN-UP</p>
                  <p className="text-xl font-black text-amber-700">{pendingCount}</p>
                </div>
              </div>
            </div>

            {/* Add Single Phone Number Form */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xs">
              <h3 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-2">
                <span>➕</span>
                <span>Authorize New Student Mobile Number</span>
              </h3>

              <form onSubmit={handleAddSinglePhone} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6 relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 select-none">
                    +91
                  </span>
                  <input
                    type="text"
                    value={newSinglePhone}
                    onChange={(e) => setNewSinglePhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number (e.g. 9876543210)"
                    maxLength={14}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b87c]/30 focus:border-[#00b87c]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={newSingleNotes}
                    onChange={(e) => setNewSingleNotes(e.target.value)}
                    placeholder="Department / Batch (e.g. AIML 2026)"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b87c]/30 focus:border-[#00b87c]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-full py-2.5 px-4 rounded-xl bg-[#00b87c] hover:bg-[#00a86b] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>+ Authorize</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Whitelist Table Card */}
            <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-bold text-gray-700">
                  Showing <span className="text-[#00a86b]">{filteredList.length}</span> of {totalCount} pre-approved student numbers
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  <input
                    type="text"
                    value={whitelistSearch}
                    onChange={(e) => setWhitelistSearch(e.target.value)}
                    placeholder="Search phone, name, or USN..."
                    className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b87c]/30 focus:border-[#00b87c]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">MOBILE NUMBER</th>
                      <th className="px-4 py-3">DEPARTMENT / NOTES</th>
                      <th className="px-4 py-3">ACCOUNT STATUS</th>
                      <th className="px-4 py-3">LINKED STUDENT</th>
                      <th className="px-4 py-3">ADDED ON</th>
                      <th className="px-4 py-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-10 text-center text-gray-400">
                          No authorized numbers match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredList.map((item) => {
                        const linkedUser = item.registeredUserId;
                        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Seeded';

                        return (
                          <tr key={item._id} className="hover:bg-gray-50/60 transition">
                            <td className="px-4 py-3 font-mono font-bold text-gray-900 text-xs">
                              +91 {item.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-medium">
                              {item.department || 'AIML Student'}
                            </td>
                            <td className="px-4 py-3">
                              {item.isRegistered ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ Registered
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  ⏳ Not Registered Yet
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item.isRegistered && (linkedUser || item.name) ? (
                                <div>
                                  <div className="font-bold text-gray-900 text-xs">{linkedUser?.name || item.name}</div>
                                  <div className="text-gray-500 text-[10px] font-mono">{linkedUser?.usn || item.usn || '-'}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-[11px]">
                              {dateStr}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteApprovedStudent(item._id, item.phoneNumber)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BULK IMPORT MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Bulk Import Authorized Numbers</h3>
                <p className="text-xs text-gray-500 mt-0.5">Paste a list of student phone numbers separated by commas or line breaks.</p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkAddPhones} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Phone Numbers (10 digits each):
                </label>
                <textarea
                  rows={6}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={`9876543210\n9812345678\n9123456780, 9988776655`}
                  className="w-full p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b87c]/30 focus:border-[#00b87c]"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Prefixes like +91 or leading 0 will automatically be cleaned. Existing duplicate numbers will be ignored safely.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00b87c] hover:bg-[#00a86b] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Import All Numbers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default AdminPortal;
