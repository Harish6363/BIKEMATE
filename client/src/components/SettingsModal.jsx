import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { X, Shield, Bell, Bike, Check, Sun, Moon, Monitor, Hash, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function SettingsModal({ isOpen, onClose }) {
  const { user, token, updateUser } = useContext(AuthContext);

  // 1. Theme Mode: 'light' | 'dark' | 'system'
  const [theme, setTheme] = useState(() => {
    return user?.themePreference || localStorage.getItem('bm_theme') || 'system';
  });

  // 2. Bike Details (Two distinct inputs as requested)
  const [bikeName, setBikeName] = useState(() => {
    if (user?.bikeName) return user.bikeName;
    try {
      const savedV = localStorage.getItem('bikemate_driver_vehicle');
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
      const savedV = localStorage.getItem('bikemate_driver_vehicle');
      if (savedV) {
        const parsed = JSON.parse(savedV);
        if (parsed.bikeNumber) return parsed.bikeNumber;
      }
    } catch (e) {}
    return 'KA-34-EA-4412';
  });

  // 3. Emergency Contact Phone Number
  const [emergencyPhone, setEmergencyPhone] = useState(() => {
    return (
      user?.emergencyPhone ||
      localStorage.getItem('bm_emergency_phone') ||
      localStorage.getItem('emergency_phone') ||
      '9876543210'
    );
  });

  // 4. Notifications
  const [notifyRides, setNotifyRides] = useState(true);
  const [notifyChats, setNotifyChats] = useState(true);

  // Status indicators
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Keep synced when user object is loaded or changed
  useEffect(() => {
    if (user) {
      if (user.themePreference) setTheme(user.themePreference);
      if (user.bikeName) setBikeName(user.bikeName);
      if (user.bikeNumber) setBikeNumber(user.bikeNumber);
      if (user.emergencyPhone) setEmergencyPhone(user.emergencyPhone);
    }
  }, [user]);

  // Apply theme dynamically to documentElement
  const handleThemeSelect = (selectedTheme) => {
    setTheme(selectedTheme);
    localStorage.setItem('bm_theme', selectedTheme);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (
      selectedTheme === 'dark' ||
      (selectedTheme === 'system' && prefersDark)
    ) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const handleMediaChange = (e) => {
      const currentTheme = localStorage.getItem('bm_theme') || 'system';
      if (currentTheme === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (media?.addEventListener) {
      media.addEventListener('change', handleMediaChange);
      return () => media.removeEventListener('change', handleMediaChange);
    }
  }, []);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');

    try {
      const cleanBikeName = bikeName.trim() || 'Royal Enfield Hunter 350';
      const cleanBikeNumber = bikeNumber.trim().toUpperCase() || 'KA-34-EA-4412';
      const cleanEmergencyPhone = emergencyPhone.trim() || '9876543210';

      // 1. Persist directly to MongoDB User document via API
      let updatedUserData = null;
      if (token) {
        try {
          const res = await axios.put(
            'http://localhost:5000/api/auth/profile',
            {
              bikeName: cleanBikeName,
              bikeNumber: cleanBikeNumber,
              emergencyPhone: cleanEmergencyPhone,
              themePreference: theme
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          if (res.data?.user) {
            updatedUserData = res.data.user;
            if (updateUser) updateUser(res.data.user);
          }
        } catch (apiErr) {
          console.warn('API profile update warn:', apiErr.response?.data?.message || apiErr.message);
        }
      }

      // If offline or user not fully returned, update local context user object
      if (!updatedUserData && user && updateUser) {
        updateUser({
          ...user,
          bikeName: cleanBikeName,
          bikeNumber: cleanBikeNumber,
          emergencyPhone: cleanEmergencyPhone,
          themePreference: theme
        });
      }

      // 2. Cache cleanly to localStorage for instant client access
      localStorage.setItem('bm_theme', theme);
      localStorage.setItem(
        'bikemate_driver_vehicle',
        JSON.stringify({ bikeName: cleanBikeName, bikeNumber: cleanBikeNumber })
      );
      localStorage.setItem('bm_emergency_phone', cleanEmergencyPhone);
      localStorage.setItem('emergency_phone', cleanEmergencyPhone);

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setIsSaving(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error('Settings save error:', err);
      setErrorMsg('Failed to save settings. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 md:p-8 overflow-hidden my-8 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage your appearance, vehicle setup, and emergency safety profile
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900">
            {errorMsg}
          </div>
        )}

        {/* Content */}
        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* 1. Theme / Mode Switcher */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Theme / Mode</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleThemeSelect('light')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  theme === 'light'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200/80'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeSelect('dark')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  theme === 'dark'
                    ? 'bg-gray-900 dark:bg-gray-700 text-white shadow-sm border border-gray-800 dark:border-gray-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeSelect('system')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  theme === 'system'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                <span>System</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              Follow system default, or lock to Light or Dark interface mode.
            </p>
          </div>

          {/* 2. Bike Details (Two Distinct Input Boxes) */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <Bike className="w-4 h-4 text-[#00b87c]" />
              <span>Two-Wheeler Details</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Bike / Scooter Model
                </label>
                <input
                  type="text"
                  required
                  value={bikeName}
                  onChange={(e) => setBikeName(e.target.value)}
                  placeholder="e.g. Royal Enfield Hunter 350"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#00b87c] focus:ring-1 focus:ring-[#00b87c] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Plate / Registration Number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={bikeNumber}
                    onChange={(e) => setBikeNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. KA-34-EA-4412"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono uppercase font-bold text-gray-900 dark:text-white focus:outline-none focus:border-[#00b87c] focus:ring-1 focus:ring-[#00b87c] transition"
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Auto-fills your ride offer cards. Saving overwrites previous details in your database profile so only current details remain.
            </p>
          </div>

          {/* 3. Emergency Contact */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              <Shield className="w-4 h-4 text-red-500" />
              <span>Emergency Contact Phone Number</span>
            </label>
            <input
              type="tel"
              required
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="e.g. 9876543210 (Parent, Guardian or Campus Warden)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              Used during live tracking emergencies: One-tap WhatsApp & SMS alerts with your real-time GPS location are dispatched directly to this number, and campus security is notified.
            </p>
          </div>

          {/* 4. Notifications toggles */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              <Bell className="w-4 h-4 text-[#00b87c]" />
              <span>Notifications</span>
            </span>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Ride match & booking updates</span>
              <input
                type="checkbox"
                checked={notifyRides}
                onChange={(e) => setNotifyRides(e.target.checked)}
                className="w-4 h-4 accent-[#00b87c] rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Instant chat messages</span>
              <input
                type="checkbox"
                checked={notifyChats}
                onChange={(e) => setNotifyChats(e.target.checked)}
                className="w-4 h-4 accent-[#00b87c] rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
