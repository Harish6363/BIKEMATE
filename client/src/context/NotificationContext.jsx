import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, token } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  // 1. Fetch user notifications from backend
  const fetchNotifications = useCallback(async () => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await axios.get('http://localhost:5000/api/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      // silent fallback
    }
  }, [token, user]);

  // Show Toast Popup banner
  const triggerToast = useCallback((notif) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setActiveToast(notif);
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
  }, []);

  const dismissToast = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setActiveToast(null);
  };

  // 2. Mark specific notification as read
  const markAsRead = async (notifId) => {
    try {
      await axios.patch(`http://localhost:5000/api/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('markAsRead error:', err.message);
    }
  };

  // 3. Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.patch('http://localhost:5000/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('markAllAsRead error:', err.message);
    }
  };

  // 4. Clear all notifications
  const clearAll = async () => {
    try {
      await axios.delete('http://localhost:5000/api/notifications/clear');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.warn('clearAll error:', err.message);
    }
  };

  // 5. Initial fetch & periodic poll
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // 6. Real-time Socket.io Connection
  useEffect(() => {
    if (!token || !user) return;

    socketRef.current = io('http://localhost:5000');
    const socket = socketRef.current;

    const currentUserId = user._id || user.id;
    if (currentUserId) {
      socket.emit('joinUser', currentUserId);
    }

    // On new notification arrived from server
    socket.on('newNotification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
      triggerToast(notif);
    });

    socket.on('unreadCountUpdate', (data) => {
      if (data && typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user, triggerToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        dismissToast,
        markAsRead,
        markAllAsRead,
        clearAll,
        refreshNotifications: fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
