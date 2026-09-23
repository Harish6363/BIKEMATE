import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, token } = useContext(AuthContext);
  const location = useLocation();

  if (!token || !user) {
    return (
      <Navigate
        to={adminOnly ? "/admin-login" : "/login"}
        replace
        state={{
          from: location.pathname,
          message: adminOnly
            ? '🔒 Admin Authentication Required: Please log in with campus moderator credentials.'
            : '🔒 Student Login Required: Please log in to your account before finding or offering a ride.'
        }}
      />
    );
  }

  if (adminOnly && user?.role !== 'admin') {
    return (
      <Navigate
        to="/admin-login"
        replace
        state={{
          from: location.pathname,
          message: '⛔ Access Denied: Administrator privileges are required to view this area.'
        }}
      />
    );
  }

  return children;
}
