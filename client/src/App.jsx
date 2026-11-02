import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/AdminLogin';
import MyRides from './pages/MyRides';
import FindRide from './pages/FindRide';
import OfferRide from './pages/OfferRide';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import AdminPortal from './pages/AdminPortal';
import LiveTracking from './pages/LiveTracking';
import LiveShareTracking from './pages/LiveShareTracking';

function DashboardRouteWrapper() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Landing, Authentication & Public Share Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/track/live-share" element={<LiveShareTracking />} />
        <Route path="/track/live-share/:rideId" element={<LiveShareTracking />} />

        {/* Protected Student Dashboard Shell - Requires Login */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardRouteWrapper />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/rides" element={<MyRides />} />
          <Route path="/my-rides" element={<MyRides />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/find-ride" element={<FindRide />} />
          <Route path="/offer-ride" element={<OfferRide />} />
          <Route path="/track" element={<LiveTracking />} />
          <Route path="/track/:rideId" element={<LiveTracking />} />
        </Route>

        {/* Protected Dedicated Admin Portal - Separate from Rider Shell */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly={true}>
              <AdminPortal />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect to Dashboard */}
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
