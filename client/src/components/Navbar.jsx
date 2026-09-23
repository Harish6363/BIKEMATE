import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import Logo from './Logo';

function Navbar() {
  const { user, logout, token } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingReqCount, setPendingReqCount] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Poll or fetch pending request count for drivers
  useEffect(() => {
    if (!token || !user) {
      setPendingReqCount(0);
      return;
    }

    const checkRequests = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rides/requests/my');
        const pending = (res.data.incoming || []).filter(r => r.status === 'pending').length;
        setPendingReqCount(pending);
      } catch (e) {
        // silent fail on network/auth
      }
    };

    checkRequests();
    const interval = setInterval(checkRequests, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [token, user]);

  return (
    <>
      {/* Top Fixed Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <Logo size="md" variant="dark-bg" subtitle="BITM Campus Commute" />
          </Link>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1.5 bg-dark-800/80 p-1 rounded-2xl border border-white/5">
            <Link
              to="/find-ride"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                isActive('/find-ride')
                  ? 'bg-brand-500 text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>🔍</span>
              <span>Find Ride</span>
            </Link>

            <Link
              to="/offer-ride"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                isActive('/offer-ride')
                  ? 'bg-brand-500 text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>➕</span>
              <span>Offer Ride</span>
            </Link>

            {/* Logs Tab with pending notification indicator */}
            <Link
              to="/rides"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 relative ${
                isActive('/rides')
                  ? 'bg-brand-500 text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>📋</span>
              <span>Ride Logs</span>
              {pendingReqCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-extrabold bg-amber-500 text-black rounded-full animate-pulse">
                  {pendingReqCount}
                </span>
              )}
            </Link>

            <Link
              to="/messages"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                isActive('/messages')
                  ? 'bg-brand-500 text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>💬</span>
              <span>Chat</span>
            </Link>

            <Link
              to="/admin"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                isActive('/admin')
                  ? 'bg-cyan-700 text-white shadow-glow-sm'
                  : 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/40'
              }`}
            >
              <span>🛡️</span>
              <span>Admin</span>
            </Link>
          </div>

          {/* Right Side Controls (Replaces cluttered login/register with student profile and logout) */}
          <div className="flex items-center space-x-2">
            {user ? (
              <div className="flex items-center gap-2">
                {/* Profile Pill */}
                <Link
                  to="/profile"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                    isActive('/profile')
                      ? 'bg-brand-500/20 border-brand-500/50 text-white'
                      : 'bg-dark-800 border-white/10 text-gray-300 hover:border-brand-500/40 hover:text-white'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] text-white font-bold">
                    {(user.name || 'S')[0].toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate hidden sm:inline">{user.name || 'Profile'}</span>
                  <span className="text-[10px] text-green-400 font-bold hidden lg:inline">🛡️ Verified</span>
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  title="Log out of your account"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition flex items-center gap-1.5"
                >
                  <span>🚪</span>
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-brand hover:opacity-90 transition shadow-glow-sm flex items-center gap-1.5"
                >
                  <span>🔑</span>
                  <span>Log In</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Fixed at bottom for smartphones) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-xl border-t border-white/10 px-2 py-2">
        <div className="flex items-center justify-around">
          <Link
            to="/"
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
              isActive('/') ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-base mb-0.5">🏠</span>
            <span>Home</span>
          </Link>

          <Link
            to="/find-ride"
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
              isActive('/find-ride') ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-base mb-0.5">🔍</span>
            <span>Find</span>
          </Link>

          <Link
            to="/offer-ride"
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
              isActive('/offer-ride') ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-base mb-0.5">➕</span>
            <span>Offer</span>
          </Link>

          <Link
            to="/rides"
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition relative ${
              isActive('/rides') ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-base mb-0.5">📋</span>
            <span>Logs</span>
            {pendingReqCount > 0 && (
              <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-dark-900 animate-ping" />
            )}
          </Link>

          <Link
            to={user ? "/profile" : "/login"}
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
              isActive('/profile') || isActive('/login') ? 'text-brand-400 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-base mb-0.5">{user ? '👤' : '🔑'}</span>
            <span>{user ? 'Profile' : 'Login'}</span>
          </Link>
        </div>
      </div>
    </>
  );
}

export default Navbar;
