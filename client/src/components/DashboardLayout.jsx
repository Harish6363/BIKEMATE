import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
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
  ShieldAlert
} from 'lucide-react';


export default function DashboardLayout({ children }) {
  const { user, logout } = useContext(AuthContext);
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
    <div className="min-h-screen bg-[#f4f8f7] flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 bg-[#0c1924] text-white sticky top-0 z-40">
        <Link to="/dashboard" className="flex items-center">
          <Logo size="sm" variant="dark-bg" />
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

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
                  <span>{item.name}</span>
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
                      ? 'bg-rose-600 text-white shadow-sm font-semibold'
                      : 'text-rose-400 hover:text-white hover:bg-rose-950/40'
                  }
                `}
              >
                <ShieldAlert className={`w-5 h-5 ${isActive('/admin') ? 'text-white' : 'text-rose-400'}`} />
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>{getGreeting()}, {displayName}</span>
              <span className="inline-block animate-bounce">👋</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Here's what's happening with your commute today.
            </p>
          </div>

          <div className="shrink-0 self-start sm:self-auto flex items-center gap-2 flex-wrap">
            {user?.gender === 'female' ? (
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
              <span>Verified BITM Student</span>
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
