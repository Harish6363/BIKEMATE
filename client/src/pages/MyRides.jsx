import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Send, MapPin, Clock, Users, ArrowRight, Check, X, Compass, Play, Navigation, KeyRound, MessageSquare, RotateCcw, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { format12Hour, formatTimeString12h } from '../utils/timeFormat';

export default function MyRides() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('offering'); // 'offering' | 'requested'
  const [rides, setRides] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState('');

  // PIN Verification Modal State on My Rides
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Re-Book Modal State
  const [rebookTarget, setRebookTarget] = useState(null); // request or ride object
  const [rebookTime, setRebookTime] = useState('08:30');
  const [rebookNote, setRebookNote] = useState('');

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const [ridesRes, reqsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/rides/my-offered', authHeaders),
        axios.get('http://localhost:5000/api/rides/requests/my', authHeaders)
      ]);
      setRides(ridesRes.data || []);
      setIncomingRequests(reqsRes.data.incoming || []);
      setOutgoingRequests(reqsRes.data.outgoing || []);
    } catch (err) {
      console.error('Error fetching rides data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRespond = async (requestId, status) => {
    setActionLoading(requestId);
    try {
      await axios.patch(`http://localhost:5000/api/rides/requests/${requestId}`, { status });
      setNotification(`Request marked as ${status}!`);
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating request');
    } finally {
      setActionLoading(null);
    }
  };

  // Driver cancels scheduled ride
  const handleCancelRide = async (rideId) => {
    if (!window.confirm('Cancel this scheduled ride? Any booked passenger will be alerted and your schedule freed.')) return;
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.patch(`http://localhost:5000/api/rides/${rideId}/cancel`, {}, authHeaders);
      setNotification('Ride cancelled successfully.');
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel ride');
    }
  };

  // Commuter cancels their booking request
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm("Cancel your ride request? The driver's seat will be released.")) return;
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.patch(`http://localhost:5000/api/rides/requests/${requestId}/cancel`, {}, authHeaders);
      setNotification('Request cancelled.');
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  // Delete a specific offered ride
  const handleDeleteRide = async (rideId) => {
    if (!window.confirm('Delete this ride permanently from your dashboard?')) return;
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.delete(`http://localhost:5000/api/rides/${rideId}`, authHeaders);
      setNotification('Ride deleted successfully.');
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete ride');
    }
  };

  // Delete a specific booking request
  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm('Delete this request from your dashboard?')) return;
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.delete(`http://localhost:5000/api/rides/requests/${requestId}`, authHeaders);
      setNotification('Request removed.');
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete request');
    }
  };

  // Clear all offered rides
  const handleClearAllOffered = async () => {
    if (!window.confirm('Clear all your offered rides from the dashboard? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.delete('http://localhost:5000/api/rides/clear-all', authHeaders);
      setNotification('All offered rides cleared.');
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear offered rides');
    }
  };

  // Clear all requests
  const handleClearAllRequests = async () => {
    if (!window.confirm('Clear all your ride requests from the dashboard? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.delete('http://localhost:5000/api/rides/requests/clear-all', authHeaders);
      setNotification('All requests cleared.');
      setTimeout(() => setNotification(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear requests');
    }
  };

  // Commuter sends Re-Book request for past completed ride
  const handleRebookSubmit = async (e) => {
    e.preventDefault();
    if (!rebookTarget) return;
    setActionLoading('rebook');
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const [h, m] = (rebookTime || '08:30').split(':');
      const depDate = new Date();
      depDate.setHours(parseInt(h, 10));
      depDate.setMinutes(parseInt(m, 10));
      depDate.setSeconds(0);
      if (depDate.getTime() < Date.now()) {
        depDate.setDate(depDate.getDate() + 1);
      }

      const prevRideId = rebookTarget.ride?._id || rebookTarget.ride || rebookTarget._id;
      const res = await axios.post('http://localhost:5000/api/rides/rebook', {
        previousRideId: prevRideId,
        requestedDepartureTime: depDate.toISOString(),
        note: rebookNote
      }, authHeaders);

      setNotification(`🎉 Re-booking sent! Chat thread connected.`);
      setTimeout(() => setNotification(''), 3000);
      setRebookTarget(null);
      fetchData();
      navigate('/messages');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to re-book ride');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyPinAndStart = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRideId) return;

    if (!enteredPin || enteredPin.trim().length !== 4) {
      setPinError('Please enter the 4-digit PIN displayed on the rider portal.');
      return;
    }

    setActionLoading(selectedRideId);
    setPinError('');
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.post(`http://localhost:5000/api/rides/${selectedRideId}/start`, {
        pin: enteredPin.trim()
      }, authHeaders);
      setNotification('🚀 Boarding PIN verified! Ride started and live GPS is active.');
      setShowPinModal(false);
      navigate(`/track/${selectedRideId}`);
    } catch (err) {
      setPinError(err.response?.data?.message || 'Invalid Boarding PIN. Please check with your rider.');
    } finally {
      setActionLoading(null);
    }
  };

  // Rides offered by the current user
  const myOfferedRides = rides;

  return (
    <div className="space-y-6">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Rides</h2>
        <p className="text-gray-500 text-sm mt-0.5">
          Manage the rides you've offered or joined.
        </p>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-4 rounded-2xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-sm font-semibold flex items-center justify-between shadow-xs">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-xs overflow-hidden min-h-[460px] flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-gray-100">
          <button
            onClick={() => setActiveTab('offering')}
            className={`
              flex-1 text-center py-4 text-sm font-semibold transition-all relative border-b-2
              ${
                activeTab === 'offering'
                  ? 'text-[#00a86b] border-[#00b87c]'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }
            `}
          >
            Rides I'm Offering
            {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-[#00b87c] text-white rounded-full">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('requested')}
            className={`
              flex-1 text-center py-4 text-sm font-semibold transition-all relative border-b-2
              ${
                activeTab === 'requested'
                  ? 'text-[#00a86b] border-[#00b87c]'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }
            `}
          >
            Rides I've Requested
            {outgoingRequests.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                {outgoingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 flex flex-col">
          {/* TAB 1: RIDES I'M OFFERING */}
          {activeTab === 'offering' && (
            <>
              {myOfferedRides.length === 0 ? (
                /* Empty State matching Screenshot 1 */
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 text-[#8fa1b3]">
                    <Send className="w-16 h-16 stroke-[1.4] -rotate-12 translate-x-1" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-6">
                    You haven't posted any rides yet.
                  </p>
                  <Link
                    to="/offer-ride"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
                  >
                    Post a Ride Offer
                  </Link>
                </div>
              ) : (
                /* List of user's offered rides */
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Active Ride Offers ({myOfferedRides.length})
                    </span>
                    <div className="flex items-center gap-3">
                      {myOfferedRides.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllOffered}
                          className="text-xs font-bold text-gray-400 hover:text-red-600 transition flex items-center gap-1 cursor-pointer bg-gray-50 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-200"
                          title="Clear all offered rides from dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear All</span>
                        </button>
                      )}
                      <Link
                        to="/offer-ride"
                        className="text-xs font-semibold text-[#00b87c] hover:underline"
                      >
                        + Offer New Ride
                      </Link>
                    </div>
                  </div>

                  {myOfferedRides.map((ride) => {
                    const rideIncoming = incomingRequests.filter(req => (req.ride?._id || req.ride) === ride._id);
                    const hasAcceptedPassenger = rideIncoming.some(req => req.status === 'accepted');
                    const isInProgress = ride.status === 'in_progress';
                    const isCompleted = ride.status === 'completed';

                    return (
                      <div key={ride._id} className="p-5 rounded-2xl border border-gray-100 bg-[#fbfdfc] hover:border-[#daf1e8] transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 flex-wrap">
                              <MapPin className="w-4 h-4 text-[#00b87c] shrink-0" />
                              <span>{ride.originAddress || 'Origin'}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>{ride.destAddress || 'BITM Campus'}</span>

                              {isInProgress && (
                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-700 border border-blue-200 animate-pulse">
                                  🚀 IN PROGRESS
                                </span>
                              )}
                              {isCompleted && (
                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-gray-100 text-gray-600 border border-gray-200">
                                  🏁 COMPLETED
                                </span>
                              )}
                              {ride.status === 'cancelled' && (
                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-100 text-red-600 border border-red-200">
                                  🚫 CANCELLED
                                </span>
                              )}
                              {!isInProgress && !isCompleted && ride.status !== 'cancelled' && hasAcceptedPassenger && (
                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  AGREED ✅ (READY TO START)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1 font-medium text-gray-700">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                {format12Hour(ride.departureTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {ride.seatsAvailable} seat(s) available
                              </span>
                              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                ₹{ride.pricePerSeat}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {isInProgress ? (
                              <Link
                                to={`/track/${ride._id}`}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition animate-pulse"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                                <span>In Progress • Live GPS</span>
                              </Link>
                            ) : isCompleted ? (
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/track/${ride._id}`}
                                  className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
                                >
                                  View Route
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => navigate('/messages')}
                                  className="px-3.5 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 border border-blue-200 cursor-pointer"
                                  title="Chat with passenger"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Chat</span>
                                </button>
                              </div>
                            ) : hasAcceptedPassenger ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRideId(ride._id);
                                    setEnteredPin('');
                                    setPinError('');
                                    setShowPinModal(true);
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
                                  title="Commuter at pickup! Enter their 4-digit code to start ride"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Start Ride (Enter Code) 🚀</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate('/messages')}
                                  className="px-3.5 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 border border-blue-200 cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Chat</span>
                                </button>
                                <Link
                                  to={`/track/${ride._id}`}
                                  className="px-3.5 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#00a86b] text-xs font-bold transition border border-emerald-200"
                                >
                                  Map
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleCancelRide(ride._id)}
                                  className="px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1 border border-red-200 cursor-pointer"
                                  title="Cancel ride and free schedule"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : ride.status !== 'cancelled' ? (
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/track/${ride._id}`}
                                  className="px-4 py-2 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs font-semibold shadow-xs"
                                >
                                  Live Tracking
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleCancelRide(ride._id)}
                                  className="px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1 border border-red-200 cursor-pointer"
                                  title="Cancel ride and free schedule"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : null}

                            {/* Delete Ride Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRide(ride._id)}
                              className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                              title="Delete this ride from dashboard"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Incoming passenger requests for this ride */}
                        {rideIncoming.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-600 mb-2">Commuter Seat Requests:</h4>
                            <div className="space-y-2">
                              {rideIncoming.map((req) => (
                                <div key={req._id} className="p-3.5 rounded-xl bg-white border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-gray-900">{req.requester?.name || 'Commuter'}</span>
                                      {(req.requester?.role === 'faculty' || req.requester?.userType === 'faculty') ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                          <span>👨‍🏫 Faculty Staff</span>
                                          <span>•</span>
                                          <span>ID: {req.requester?.employeeId || req.requester?.usn}</span>
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-gray-400">USN: {req.requester?.usn || 'BITM'}</span>
                                      )}
                                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                        req.status === 'accepted' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                        req.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-200' :
                                        req.status === 'cancelled' ? 'bg-gray-100 text-gray-500 border border-gray-200' :
                                        req.status === 'repeat_requested' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                        'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        {req.status === 'accepted' ? 'Accepted ✅' :
                                         req.status === 'repeat_requested' ? 'REPEAT REQUEST 🔄' :
                                         req.status === 'cancelled' ? 'Cancelled 🚫' :
                                         req.status}
                                      </span>
                                    </div>
                                    {req.status === 'repeat_requested' && (
                                      <div className="mt-1 text-xs text-indigo-900 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 space-y-1">
                                        {req.requestedDepartureTime && (
                                          <div className="font-semibold flex items-center gap-1.5 text-indigo-800">
                                            <Clock className="w-3.5 h-3.5" />
                                            Proposed Departure: {format12Hour(req.requestedDepartureTime)}
                                          </div>
                                        )}
                                        {req.note && (
                                          <div className="text-[11px] text-gray-600 italic">
                                            "{req.note}"
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {(req.status === 'pending' || req.status === 'repeat_requested') && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleRespond(req._id, 'accepted')}
                                        disabled={actionLoading === req._id}
                                        className="px-3.5 py-1.5 rounded-full bg-[#00b87c] text-white text-xs font-bold hover:bg-[#00a36e] shadow-xs cursor-pointer"
                                      >
                                        {req.status === 'repeat_requested' ? 'Accept & Confirm ✅' : 'Accept'}
                                      </button>
                                      <button
                                        onClick={() => handleRespond(req._id, 'rejected')}
                                        disabled={actionLoading === req._id}
                                        className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 cursor-pointer"
                                      >
                                        Decline
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => navigate('/messages')}
                                        className="px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 border border-blue-200 cursor-pointer"
                                        title="Chat first to coordinate timing"
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>Chat</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: RIDES I'VE REQUESTED */}
          {activeTab === 'requested' && (
            <>
              {outgoingRequests.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 text-[#94a3b8]">
                    <Compass className="w-16 h-16 stroke-[1.4]" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-6">
                    You haven't requested any rides yet.
                  </p>
                  <Link
                    to="/find-ride"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
                  >
                    Find a Ride Now
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      My Outgoing Requests ({outgoingRequests.length})
                    </span>
                    {outgoingRequests.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllRequests}
                        className="text-xs font-bold text-gray-400 hover:text-red-600 transition flex items-center gap-1 cursor-pointer bg-gray-50 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-200"
                        title="Clear all ride requests"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>

                  {outgoingRequests.map((req) => (
                    <div key={req._id} className="p-5 rounded-2xl border border-gray-100 bg-[#fbfdfc] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                          <MapPin className="w-4 h-4 text-[#00b87c]" />
                          <span>{req.ride?.originAddress || 'Origin'}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                          <span>{req.ride?.destAddress || 'BITM Campus'}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Driver: <strong className="text-gray-800">{req.ride?.offeredBy?.name || 'Verified BITM Student'}</strong>
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1 font-medium text-gray-700">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            {format12Hour(req.requestedDepartureTime || req.ride?.departureTime)}
                          </span>
                          {req.ride?.pricePerSeat && (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              ₹{req.ride.pricePerSeat}
                            </span>
                          )}
                        </div>
                        {req.note && (
                          <p className="text-[11px] text-gray-500 italic mt-0.5">Note: "{req.note}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          req.status === 'accepted' ? 'bg-[#e1f7ec] text-[#00a86b] border border-[#98e6c4]' :
                          req.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-200' :
                          req.status === 'cancelled' ? 'bg-gray-100 text-gray-500 border border-gray-200' :
                          req.status === 'repeat_requested' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {req.status === 'accepted' ? 'AGREED ✅' :
                           req.status === 'repeat_requested' ? 'REPEAT REQUESTED 🔄' :
                           req.status === 'cancelled' ? 'CANCELLED 🚫' :
                           req.status.toUpperCase()}
                        </span>

                        {req.status === 'accepted' && (
                          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900 border border-emerald-300 text-xs shadow-2xs">
                            <span className="text-[10px] uppercase font-bold text-emerald-700">Your Code:</span>
                            <span className="font-mono font-black text-emerald-900 tracking-wider text-base bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300 shadow-2xs">
                              {req.boardingPin || req.ride?.boardingPin || '----'}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium hidden sm:inline">(Read to driver on arrival)</span>
                          </div>
                        )}

                        {req.status === 'accepted' && (
                          <Link
                            to={`/track/${req.ride?._id || req.ride}`}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shadow-md transition ${
                              req.ride?.status === 'in_progress'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'
                                : 'bg-[#00b87c] hover:bg-[#00a36e] text-white'
                            }`}
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>{req.ride?.status === 'in_progress' ? 'Ride In Progress • Track Live' : 'Open Live Tracking'}</span>
                          </Link>
                        )}

                        {/* Direct Chat with driver */}
                        {(req.status === 'accepted' || req.status === 'repeat_requested' || req.ride?.status === 'completed') && (
                          <button
                            type="button"
                            onClick={() => navigate('/messages')}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition cursor-pointer"
                            title="Chat directly with driver"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        )}

                        {/* Re-Book Commute button for past completed rides */}
                        {(req.ride?.status === 'completed' || req.status === 'completed') && (
                          <button
                            type="button"
                            onClick={() => {
                              setRebookTarget(req);
                              setRebookNote('');
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Re-Book Commute 🔄</span>
                          </button>
                        )}

                        {/* Cancel booking request */}
                        {(req.status === 'pending' || req.status === 'accepted' || req.status === 'repeat_requested') && req.ride?.status !== 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(req._id)}
                            className="flex items-center gap-1 px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold transition cursor-pointer"
                            title="Cancel this booking request"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}
                        {/* Delete request from dashboard */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req._id)}
                          className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                          title="Delete request from dashboard"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* PIN Verification Modal on MyRides */}
      {showPinModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#00a86b] flex items-center justify-center text-2xl mx-auto shadow-inner">
              🔑
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Enter Commuter's Code to Start
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Both parties are at the pickup point. Ask the commuter for the 4-digit code displayed on their screen, type it below, and verify to commence the commute.
              </p>
            </div>

            <form onSubmit={handleVerifyPinAndStart} className="space-y-4">
              <div className="relative my-4">
                {/* Invisible input capturing focus and numeric keypad */}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                    setPinError('');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  aria-label="4-digit Boarding PIN"
                />

                {/* 4 Distinct PIN Box / Dot slots */}
                <div className="flex items-center justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => {
                    const digit = enteredPin[idx];
                    const isFilled = digit !== undefined && digit !== '';
                    const isCurrent = enteredPin.length === idx;

                    return (
                      <div
                        key={idx}
                        className={`w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 ${
                          isFilled
                            ? 'border-[#00b87c] bg-[#e1f7ec]/50 text-gray-900 shadow-xs'
                            : isCurrent
                            ? 'border-[#00b87c] bg-white ring-4 ring-emerald-100 shadow-md scale-105'
                            : 'border-gray-200 bg-gray-50/80 text-gray-400'
                        }`}
                      >
                        {isFilled ? (
                          <span className="font-mono text-2xl sm:text-3xl font-black text-gray-900 select-none animate-fadeIn">
                            {digit}
                          </span>
                        ) : (
                          <span className={`text-2xl font-black select-none ${
                            isCurrent ? 'text-[#00a86b] animate-pulse' : 'text-gray-300'
                          }`}>
                            ●
                          </span>
                        )}
                        <span className={`w-2 h-1 rounded-full mt-1.5 transition-colors ${
                          isFilled ? 'bg-[#00b87c]' : isCurrent ? 'bg-emerald-400' : 'bg-gray-200'
                        }`} />
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-gray-400 mt-2.5 text-center font-medium">
                  {enteredPin.length === 4
                    ? '✓ All 4 digits entered. Ready to start commute!'
                    : `Enter commuter's 4-digit code (${enteredPin.length}/4 digits)`}
                </p>

                {pinError && (
                  <p className="text-xs font-semibold text-red-600 mt-2.5 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinError('');
                  }}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === selectedRideId || enteredPin.length !== 4}
                  className="flex-1 py-3 rounded-2xl bg-[#00b87c] hover:bg-[#00a36e] disabled:bg-gray-300 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{actionLoading === selectedRideId ? 'Verifying...' : 'Verify & Start 🚀'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Re-Book Commute Modal */}
      {rebookTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Re-Book Commute</h3>
                  <p className="text-xs text-gray-500">Request repeat ride with your past driver</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRebookTarget(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-gray-800">
                <MapPin className="w-4 h-4 text-[#00b87c] shrink-0" />
                <span>{rebookTarget.ride?.originAddress || rebookTarget.originAddress || 'Origin'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{rebookTarget.ride?.destAddress || rebookTarget.destAddress || 'Campus'}</span>
              </div>
              <div className="text-gray-600">
                Driver: <span className="font-semibold text-gray-900">{rebookTarget.driver?.name || rebookTarget.ride?.offeredBy?.name || 'Past Driver'}</span>
              </div>
            </div>

            <form onSubmit={handleRebookSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Proposed Departure Time:
                </label>
                <input
                  type="time"
                  value={rebookTime}
                  onChange={(e) => setRebookTime(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-800"
                />
                <div className="mt-2 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time: {formatTimeString12h(rebookTime)} (12-Hour format)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Pickup Note / Coordination message (optional):
                </label>
                <textarea
                  rows={2}
                  value={rebookNote}
                  onChange={(e) => setRebookNote(e.target.value)}
                  placeholder="e.g. Can meet at College Gate or near Library bus stand..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-gray-800 resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                💬 Submitting will send the repeat ride request to the driver and immediately connect both of you in <strong>Messages</strong> so you can coordinate timings and pickup points live.
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRebookTarget(null)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'rebook'}
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{actionLoading === 'rebook' ? 'Connecting...' : 'Send Request & Open Chat 🚀'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
