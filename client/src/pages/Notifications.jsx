import React, { useState, useEffect, useContext } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

export default function Notifications() {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rides/requests/my');
        const list = [];
        (res.data.incoming || []).forEach(r => {
          if (r.status === 'pending') {
            list.push({
              id: r._id,
              title: 'New Seat Request',
              message: `${r.requester?.name || 'A student'} requested a seat on your ride.`,
              time: 'Just now',
              type: 'request'
            });
          }
        });
        setNotifications(list);
      } catch (e) {
        // silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchNotifs();
  }, []);

  const handleClearAll = () => {
    setNotifications([]);
  };

  return (
    <div className="space-y-6">
      {/* Header bar with "Notifications" and "Clear all" */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
        <button
          onClick={handleClearAll}
          className="px-4 py-1.5 rounded-full border border-gray-900 text-xs sm:text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
        >
          Clear all
        </button>
      </div>

      {/* Main Content Area */}
      {notifications.length === 0 ? (
        /* Empty state matching Screenshot 4 */
        <div className="min-h-[400px] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3 text-[#94a3b8]">
            <Bell className="w-16 h-16 stroke-[1.3]" />
          </div>
          <p className="text-gray-500 text-sm font-medium">
            No notifications yet.
          </p>
        </div>
      ) : (
        /* List of active notifications */
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
          {notifications.map((n) => (
            <div key={n.id} className="p-5 flex items-start justify-between gap-4 hover:bg-[#fbfdfc] transition">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{n.title}</h4>
                  <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                  <span className="text-[11px] text-gray-400 mt-1 block">{n.time}</span>
                </div>
              </div>
              <button
                onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
