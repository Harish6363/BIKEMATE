import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { X, Shield, Bell, Phone, Bike, Check } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const [emergencyPhone, setEmergencyPhone] = useState(
    localStorage.getItem('bm_emergency_phone') || '9876543210'
  );
  const [bikeModel, setBikeModel] = useState(
    localStorage.getItem('bm_bike_model') || 'Honda Activa 6G (KA-34-EK-1290)'
  );
  const [notifyRides, setNotifyRides] = useState(true);
  const [notifyChats, setNotifyChats] = useState(true);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('bm_emergency_phone', emergencyPhone);
    localStorage.setItem('bm_bike_model', bikeModel);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 md:p-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Settings</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage your commute preferences and campus safety profile</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="mt-6 space-y-5">
          {/* Emergency Contact */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1.5">
              <Shield className="w-4 h-4 text-[#00b87c]" />
              <span>Campus SOS & Emergency Contact</span>
            </label>
            <input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="e.g. 9876543210 (Guardian or Campus Security)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#00b87c] focus:ring-1 focus:ring-[#00b87c]"
            />
            <p className="text-[11px] text-gray-400 mt-1">Shared with BITM campus security during live tracking emergency SOS alerts.</p>
          </div>

          {/* Vehicle Info */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1.5">
              <Bike className="w-4 h-4 text-[#00b87c]" />
              <span>Bike / Two-Wheeler Details</span>
            </label>
            <input
              type="text"
              value={bikeModel}
              onChange={(e) => setBikeModel(e.target.value)}
              placeholder="e.g. TVS Raider 125 (KA-34-EA-4412)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#00b87c] focus:ring-1 focus:ring-[#00b87c]"
            />
          </div>

          {/* Notifications toggles */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
              <Bell className="w-4 h-4 text-[#00b87c]" />
              <span>Notifications</span>
            </span>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Ride match & booking updates</span>
              <input
                type="checkbox"
                checked={notifyRides}
                onChange={(e) => setNotifyRides(e.target.checked)}
                className="w-4 h-4 accent-[#00b87c] rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Instant chat messages</span>
              <input
                type="checkbox"
                checked={notifyChats}
                onChange={(e) => setNotifyChats(e.target.checked)}
                className="w-4 h-4 accent-[#00b87c] rounded"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              {saved ? (
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
