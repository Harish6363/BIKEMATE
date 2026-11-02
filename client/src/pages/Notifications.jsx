import React, { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  Trash2, 
  X, 
  ArrowRight, 
  Compass, 
  Bike, 
  ShieldAlert, 
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { NotificationContext } from '../context/NotificationContext';

export default function Notifications() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAll,
    refreshNotifications 
  } = useContext(NotificationContext);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'RIDE_REQUEST':
        return { icon: '📋', bg: 'bg-amber-50 text-amber-600 border-amber-200' };
      case 'RIDE_ACCEPTED':
        return { icon: '✅', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
      case 'RIDE_REJECTED':
        return { icon: '❌', bg: 'bg-rose-50 text-rose-600 border-rose-200' };
      case 'RIDE_STARTED':
        return { icon: '🚀', bg: 'bg-blue-50 text-blue-600 border-blue-200' };
      case 'RIDE_COMPLETED':
        return { icon: '🎉', bg: 'bg-purple-50 text-purple-600 border-purple-200' };
      case 'SOS_ALERT':
        return { icon: '🚨', bg: 'bg-red-50 text-red-600 border-red-200' };
      default:
        return { icon: '🔔', bg: 'bg-[#e1f7ec] text-[#00a86b] border-[#98e6c4]' };
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time updates on seat requests, ride agreements, and commute status.
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold border border-gray-200 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-xs min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[#f0faf5] flex items-center justify-center mb-4 text-[#00b87c]">
            <Bell className="w-10 h-10 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            You're all caught up!
          </h3>
          <p className="text-gray-500 text-xs max-w-sm">
            No new notifications right now. When students request rides, confirm agreements, or start commutes, updates will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const badge = getNotificationIcon(n.type);
            const isUnread = !n.read;

            return (
              <div
                key={n._id}
                onClick={() => { if (isUnread) markAsRead(n._id); }}
                className={`
                  p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4
                  ${
                    isUnread
                      ? 'bg-white border-emerald-200 shadow-xs ring-1 ring-emerald-100'
                      : 'bg-[#fafbfc] border-gray-100 opacity-90 hover:opacity-100'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  {/* Icon Avatar */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border text-xl shadow-2xs ${badge.bg}`}>
                    {badge.icon}
                  </div>

                  {/* Body */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{n.title}</h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 pt-0.5 text-[11px] text-gray-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Button */}
                {n.actionUrl && (
                  <div className="self-end sm:self-auto shrink-0">
                    <Link
                      to={n.actionUrl}
                      onClick={() => { if (isUnread) markAsRead(n._id); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold transition shadow-xs"
                    >
                      <span>Take Action</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
