import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import SettingsModal from './SettingsModal';
import Logo from './Logo';
import {
  Home,
  Send,
  MessageSquare,
  Bell,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  Menu,
  X,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const { unreadCount, activeToast, dismissToast } = useContext(NotificationContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.name ? user.name.split(' ')[0] : 'Student';

  const navItems = [
    { name: 'Home', path: '/dashboard', icon: Home },
    { name: 'My Rides', path: '/rides', icon: Send },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/home';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f4f8f7] dark:bg-gray-950 flex flex-col md:flex-row transition-colors">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 bg-[#0c1924] text-white sticky top-0 z-40">
        <Link to="/dashboard" className="flex items-center">
          <Logo size="sm" variant="dark-bg" />
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/notifications" className="relative p-1.5 rounded-lg text-gray-300 hover:text-white">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Floating Real-time In-App Toast Notification */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-white border border-emerald-300 rounded-2xl p-4 shadow-2xl animate-fadeIn flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-lg font-bold">
            🔔
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900 truncate">{activeToast.title}</h4>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{activeToast.message}</p>
            {activeToast.actionUrl && (
              <Link
                to={activeToast.actionUrl}
                onClick={dismissToast}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 mt-2"
              >
                <span>View Now</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          <button
            onClick={dismissToast}
            className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#0c1924] text-white flex flex-col justify-between p-6 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen md:sticky md:top-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Top Section: Logo & Nav */}
        <div>
          {/* Brand Logo */}
          <div className="flex items-center justify-between mb-8 px-1">
            <Link to="/dashboard" className="flex items-center">
              <Logo size="md" variant="dark-bg" />
            </Link>
            {/* Close button on mobile */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200
                    ${
                      active
                        ? 'bg-[#00b87c] text-white shadow-sm font-semibold'
                        : 'text-[#8b9ca8] hover:text-white hover:bg-[#142535]'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8b9ca8]'}`} />
                  <span className="flex-1">{item.name}</span>
                  {item.name === 'Notifications' && unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-extrabold bg-red-500 text-white rounded-full animate-pulse shadow-xs">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 mt-2
                  ${
                    isActive('/admin')
                      ? 'bg-[#00b87c] text-white shadow-sm font-semibold'
                      : 'text-emerald-400 hover:text-white hover:bg-emerald-950/40'
                  }
                `}
              >
                <ShieldAlert className={`w-5 h-5 ${isActive('/admin') ? 'text-white' : 'text-emerald-400'}`} />
                <span>Admin Portal</span>
              </Link>
            )}
          </nav>

        </div>

        {/* Bottom Section: Settings & Logout */}
        <div className="pt-6 border-t border-white/5 space-y-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setSettingsOpen(true);
            }}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium text-[#8b9ca8] hover:text-white hover:bg-[#142535] transition-all duration-200 text-left"
          >
            <Settings className="w-5 h-5 text-[#8b9ca8]" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium text-[#8b9ca8] hover:text-white hover:bg-[#142535] transition-all duration-200 text-left"
          >
            <LogOut className="w-5 h-5 text-[#8b9ca8]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-6 sm:p-8 md:p-10 max-w-7xl w-full">
        {/* Top Greeting Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{getGreeting()}, {displayName}</span>
              <span className="inline-block animate-bounce">👋</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Here's what's happening with your commute today.
            </p>
          </div>

          <div className="shrink-0 self-start sm:self-auto flex items-center gap-2 flex-wrap">
            {(user?.role === 'faculty' || user?.userType === 'faculty') ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs sm:text-sm font-semibold shadow-xs">
                <span>👨‍🏫</span>
                <span>Faculty Commute (Any Driver)</span>
              </div>
            ) : user?.gender === 'female' ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs sm:text-sm font-semibold shadow-xs">
                <span>🌸</span>
                <span>Ladies Commute</span>
              </div>
            ) : user?.gender === 'male' ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs sm:text-sm font-semibold shadow-xs">
                <span>🛡️</span>
                <span>Gents Commute</span>
              </div>
            ) : null}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs sm:text-sm font-medium shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-[#00a86b] shrink-0" />
              <span>
                {(user?.role === 'faculty' || user?.userType === 'faculty') 
                  ? 'Verified BITM Faculty / Staff' 
                  : 'Verified BITM Student'}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="mt-2 flex-1">
          {children}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
