import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

function AdminPortal() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'logs' | 'rides'
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

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

  // Active Rides state
  const [rides, setRides] = useState([]);

  // Ride Requests state
  const [requests, setRequests] = useState([]);

  // Audit Logs state
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL'); // 'ALL' | 'INFO' | 'SECURITY' | 'WARNING' | 'ERROR' | 'SOS'

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

  // Refresh all data
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([
      fetchMetrics(),
      fetchUsers(searchQuery),
      fetchRides(),
      fetchRequests(),
      fetchLogs(logFilter)
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
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchRides, fetchRequests, fetchLogs, logFilter]);

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

  // Level Badge Color Helper
  const renderLevelBadge = (lvl) => {
    switch (lvl) {
      case 'SECURITY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-purple-950/80 text-purple-300 border border-purple-800/60">
            SECURITY
          </span>
        );
      case 'INFO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
            INFO
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-amber-950/80 text-amber-300 border border-amber-800/60">
            WARNING
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-rose-950/80 text-rose-300 border border-rose-800/60">
            ERROR
          </span>
        );
      case 'SOS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-red-950/90 text-red-300 border border-red-500/80 animate-pulse">
            SOS EVENT
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-gray-800 text-gray-300 border border-gray-700">
            {lvl}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0c1524] text-slate-100 p-6 sm:p-8 rounded-[28px] shadow-xs border border-slate-800 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Toast popup */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-cyan-500/40 text-cyan-300 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP BAR matching screenshots */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
          {/* Brand & Status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {/* BikeMate Logo */}
              <Logo size="md" variant="dark-bg" />

              {/* Cyan ADMIN PORTAL Tag */}
              <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-[#0e7490] text-cyan-100 shadow-sm">
                ADMIN PORTAL
              </span>
            </div>

            {/* Operational Pill */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1c26] border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Operational</span>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* System Admin Pill */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#131d2e] border border-slate-700/60 text-slate-200 text-xs font-medium">
              <span className="text-cyan-400">🛡️</span>
              <span>{user?.name || 'System Admin'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#131d2e] hover:bg-[#1a273e] border border-slate-700/60 text-slate-200 text-xs font-medium transition active:scale-95"
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#28131e] hover:bg-[#381a2b] border border-rose-800/40 text-rose-300 text-xs font-medium transition active:scale-95"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* 4 PRIMARY NAVIGATION TABS */}
        <nav className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto">
          {/* Tab 1: Overview & Impact */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#152336] text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <span className="text-sm">📊</span>
            <span>Overview & Impact</span>
          </button>

          {/* Tab 2: User Moderation */}
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-[#152336] text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <span className="text-sm">👥</span>
            <span>User Moderation</span>
          </button>

          {/* Tab 3: System Audit Logs */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-[#152336] text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <span className="text-sm font-mono">&gt;_</span>
            <span>System Audit Logs</span>
          </button>

          {/* Tab 4: Active Rides */}
          <button
            onClick={() => setActiveTab('rides')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'rides'
                ? 'bg-[#152336] text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <span className="text-sm">🚲</span>
            <span>Active Rides</span>
          </button>

          {/* Tab 5: Ride Requests */}
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-[#152336] text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <span className="text-sm">📩</span>
            <span>Ride Requests</span>
            {requests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                {requests.length}
              </span>
            )}
          </button>
        </nav>

        {/* TAB 1: OVERVIEW & IMPACT */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Section Header */}
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Platform Overview & Environmental Metrics</h2>
              <p className="text-xs text-slate-400 mt-1">Real-time statistics on campus ride-sharing adoption and environmental footprint offset.</p>
            </div>

            {/* 5 Stat Cards in horizontal row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Card 1: Registered Students */}
              <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800/80 shadow-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400 shrink-0 text-xl">
                  👥
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">REGISTERED STUDENTS</p>
                  <p className="text-2xl font-bold text-white leading-tight">{metrics.registeredStudents ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{metrics.verifiedStudents ?? 1} ID Verified</p>
                </div>
              </div>

              {/* Card 2: Vehicles Saved */}
              <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800/80 shadow-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0 text-xl">
                  🚗
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">VEHICLES SAVED</p>
                  <p className="text-2xl font-bold text-white leading-tight">{metrics.vehiclesSaved ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Shared Rides Off Road</p>
                </div>
              </div>

              {/* Card 3: CO2 Emissions Saved */}
              <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800/80 shadow-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-950/60 border border-teal-800/40 flex items-center justify-center text-teal-400 shrink-0 text-xl">
                  🍃
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">CO₂ EMISSIONS SAVED</p>
                  <p className="text-2xl font-bold text-white leading-tight">{metrics.co2SavedKg ?? '0'} kg</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Carbon Footprint Avoided</p>
                </div>
              </div>

              {/* Card 4: Fuel Conserved */}
              <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800/80 shadow-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0 text-xl">
                  ⛽
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">FUEL CONSERVED</p>
                  <p className="text-2xl font-bold text-white leading-tight">{metrics.fuelConservedL ?? '0'} L</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Estimated Petrol Saved</p>
                </div>
              </div>

              {/* Card 5: Active Rides */}
              <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800/80 shadow-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 text-xl">
                  📈
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ACTIVE RIDES</p>
                  <p className="text-2xl font-bold text-white leading-tight">{metrics.activeRides ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Live Scheduled Commutes</p>
                </div>
              </div>

            </div>

            {/* Server & Database Infrastructure Box */}
            <div className="max-w-md p-5 rounded-2xl bg-[#0f172a]/90 border border-slate-800/80 shadow-card space-y-3.5">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <span>🗄️</span>
                <span className="text-white">Server & Database Infrastructure</span>
              </div>

              <div className="space-y-2.5 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Backend Service</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span>✓</span>
                    <span>{infrastructure.backendService}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">MongoDB Database</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span>🗃️</span>
                    <span>{infrastructure.databaseStatus}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Server Uptime</span>
                  <span className="text-slate-200 font-mono font-medium">{formatUptime(infrastructure.uptimeSeconds)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Node Environment</span>
                  <span className="text-slate-300 font-mono">{infrastructure.nodeEnv}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: USER MODERATION */}
        {activeTab === 'users' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">User Account Moderation</h2>
              <p className="text-xs text-slate-400 mt-1">Manage student accounts, verify student identity badges, and suspend/ban problematic users.</p>
            </div>

            {/* Search Input */}
            <div className="relative max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone or department..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0f172a] border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            {/* Table */}
            <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#111c2e]/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="px-5 py-3.5">STUDENT USER</th>
                      <th className="px-5 py-3.5">CONTACT DETAILS</th>
                      <th className="px-5 py-3.5">DEPT & SEMESTER</th>
                      <th className="px-5 py-3.5">ID VERIFICATION</th>
                      <th className="px-5 py-3.5">ACCOUNT STATUS</th>
                      <th className="px-5 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-5 py-8 text-center text-slate-400">
                          No student accounts found matching your query.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isVerified = u.verificationStatus === 'verified';
                        const isBanned = !!u.isBanned;

                        return (
                          <tr key={u._id} className="hover:bg-slate-800/20 transition">
                            {/* Student User */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-cyan-700/80 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                  {(u.name || 'S')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-white text-sm">{u.name}</div>
                                  <div className="text-cyan-400/80 text-[11px]">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Contact Details */}
                            <td className="px-5 py-4 font-mono text-slate-300">
                              {u.phone || 'N/A'}
                            </td>

                            {/* Dept & Semester */}
                            <td className="px-5 py-4 text-slate-300">
                              {u.department || 'General'} ({u.semester || 'Sem 1'})
                            </td>

                            {/* ID Verification Badge */}
                            <td className="px-5 py-4">
                              {isVerified ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                                  VERIFIED
                                </span>
                              ) : (
                                <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                                  UNVERIFIED
                                </span>
                              )}
                            </td>

                            {/* Account Status */}
                            <td className="px-5 py-4">
                              {isBanned ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                                  Banned
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
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
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    isBanned
                                      ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40'
                                      : 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40'
                                  }`}
                                >
                                  {isBanned ? 'Unban' : 'Ban'}
                                </button>

                                {/* Verify ID (if not verified) */}
                                {!isVerified && (
                                  <button
                                    onClick={() => handleVerifyUser(u._id, u.name)}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/40 transition"
                                  >
                                    Verify ID
                                  </button>
                                )}

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteUser(u._id, u.name)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 transition"
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

        {/* TAB 3: ACTIVE RIDES */}
        {activeTab === 'rides' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Active & Scheduled Rides</h2>
              <p className="text-xs text-slate-400 mt-1">Review current campus ride offerings and moderate flagged listings.</p>
            </div>

            {/* Table */}
            <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#111c2e]/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="px-5 py-3.5">DRIVER</th>
                      <th className="px-5 py-3.5">PICKUP & DESTINATION</th>
                      <th className="px-5 py-3.5">VEHICLE INFO</th>
                      <th className="px-5 py-3.5">DEPARTURE TIME</th>
                      <th className="px-5 py-3.5">COST</th>
                      <th className="px-5 py-3.5">STATUS</th>
                      <th className="px-5 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {rides.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-400">
                          No active campus rides currently scheduled.
                        </td>
                      </tr>
                    ) : (
                      rides.map((r) => {
                        const depDate = r.departureTime ? new Date(r.departureTime) : null;
                        const dateFormatted = depDate && !isNaN(depDate)
                          ? depDate.toLocaleString([], { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' })
                          : 'Invalid Date';

                        return (
                          <tr key={r._id} className="hover:bg-slate-800/20 transition">
                            {/* Driver */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-white">{r.offeredBy?.name || 'Driver'}</div>
                              <div className="text-slate-400 text-[11px]">{r.offeredBy?.college || 'BITM'}</div>
                            </td>

                            {/* Pickup & Destination */}
                            <td className="px-5 py-4">
                              <div className="text-slate-200">{r.originAddress || 'Pickup'}</div>
                              <div className="text-emerald-400 text-[11px] flex items-center gap-1 font-medium mt-0.5">
                                <span>→</span>
                                <span>{r.destAddress || 'Destination'}</span>
                              </div>
                            </td>

                            {/* Vehicle Info */}
                            <td className="px-5 py-4 text-slate-300">
                              {r.vehicleType || 'Bike (N/A)'}
                            </td>

                            {/* Departure Time */}
                            <td className="px-5 py-4 font-mono text-slate-300">
                              {dateFormatted}
                            </td>

                            {/* Cost */}
                            <td className="px-5 py-4 font-bold text-emerald-400">
                              {r.pricePerSeat ? `₹${r.pricePerSeat}` : 'Free'}
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                {r.status || 'active'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => handleRemoveRide(r._id)}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
                              >
                                Remove Ride
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
        )}

        {/* TAB 4: RIDE REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Campus Ride Requests</h2>
                <p className="text-xs text-slate-400 mt-1">Review student ride booking requests, assigned drivers, and statuses.</p>
              </div>
              <div className="text-xs text-slate-400 bg-[#131d2e] px-3.5 py-1.5 rounded-xl border border-slate-800">
                Total Requests: <strong className="text-white">{requests.length}</strong>
              </div>
            </div>

            {/* Table */}
            <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#111c2e]/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="px-5 py-3.5">REQUESTER</th>
                      <th className="px-5 py-3.5">DRIVER</th>
                      <th className="px-5 py-3.5">ROUTE DETAILS</th>
                      <th className="px-5 py-3.5">SEATS & FARE</th>
                      <th className="px-5 py-3.5">STATUS</th>
                      <th className="px-5 py-3.5 text-right">REQUEST TIME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-5 py-8 text-center text-slate-400">
                          No student ride requests found in the system.
                        </td>
                      </tr>
                    ) : (
                      requests.map((req) => {
                        const reqDate = req.createdAt ? new Date(req.createdAt) : null;
                        const dateFormatted = reqDate && !isNaN(reqDate)
                          ? reqDate.toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                          : 'Recent';

                        const statusBadge = req.status === 'accepted' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                            ✓ Accepted
                          </span>
                        ) : req.status === 'rejected' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                            ✕ Rejected
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                            ⏳ Pending
                          </span>
                        );

                        return (
                          <tr key={req._id} className="hover:bg-slate-800/20 transition">
                            {/* Requester */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-white">{req.requester?.name || 'Student'}</div>
                              <div className="text-slate-400 text-[11px]">
                                {req.requester?.usn || req.requester?.phone || req.requester?.email || 'Student'}
                              </div>
                            </td>

                            {/* Driver */}
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-200">{req.driver?.name || 'Driver'}</div>
                              <div className="text-slate-400 text-[11px]">{req.driver?.phone || 'Campus Member'}</div>
                            </td>

                            {/* Route Details */}
                            <td className="px-5 py-4">
                              <div className="text-slate-200">{req.pickupAddress || req.ride?.originAddress || 'Campus Pickup'}</div>
                              <div className="text-emerald-400 text-[11px] flex items-center gap-1 font-medium mt-0.5">
                                <span>→</span>
                                <span>{req.ride?.destAddress || 'BITM Campus'}</span>
                              </div>
                            </td>

                            {/* Seats & Fare */}
                            <td className="px-5 py-4">
                              <div className="text-slate-200 font-medium">{req.seatsRequested || 1} Seat(s)</div>
                              <div className="text-emerald-400 font-bold text-[11px]">
                                {req.calculatedFare ? `₹${req.calculatedFare}` : req.ride?.pricePerSeat ? `₹${req.ride.pricePerSeat}` : 'Free'}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4">
                              {statusBadge}
                            </td>

                            {/* Request Time */}
                            <td className="px-5 py-4 font-mono text-slate-400 text-right">
                              {dateFormatted}
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

        {/* TAB 5: SYSTEM AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">System Activity Audit Logs</h2>
              <p className="text-xs text-slate-400 mt-1">Real-time log events for authentication, security violations, and SOS triggers.</p>
            </div>

            {/* Filter Pills matching screenshots */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['ALL', 'INFO', 'SECURITY', 'WARNING', 'ERROR', 'SOS'].map((lvl) => {
                const label = lvl === 'ALL' ? 'All Logs' : lvl === 'SOS' ? 'SOS Events' : lvl.charAt(0) + lvl.slice(1).toLowerCase();
                const isSelected = logFilter === lvl;

                return (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Logs Table */}
            <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#111c2e]/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="px-5 py-3.5">TIMESTAMP</th>
                      <th className="px-5 py-3.5">LEVEL</th>
                      <th className="px-5 py-3.5">ACTION EVENT</th>
                      <th className="px-5 py-3.5">USER</th>
                      <th className="px-5 py-3.5">DETAILS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-5 py-8 text-center text-slate-400">
                          No audit log events recorded for this category.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const ts = new Date(log.timestamp).toLocaleString();

                        return (
                          <tr key={log._id} className="hover:bg-slate-800/20 transition">
                            {/* Timestamp */}
                            <td className="px-5 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                              {ts}
                            </td>

                            {/* Level Badge */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {renderLevelBadge(log.level)}
                            </td>

                            {/* Action Event */}
                            <td className="px-5 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                              {log.actionEvent}
                            </td>

                            {/* User */}
                            <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                              {log.user || 'System'}
                            </td>

                            {/* Details (JSON formatted) */}
                            <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 max-w-md truncate">
                              {log.details || '-'}
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

      </div>
    </div>
  );
}

export default AdminPortal;
