import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Send, MapPin, Clock, Users, ArrowRight, Check, X, Compass } from 'lucide-react';

export default function MyRides() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('offering'); // 'offering' | 'requested'
  const [rides, setRides] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState('');

  const fetchData = async () => {
    try {
      const [ridesRes, reqsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/rides'),
        axios.get('http://localhost:5000/api/rides/requests/my')
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

  // Filter rides offered by current logged-in user
  const myOfferedRides = rides.filter(r => {
    if (!user) return false;
    const driverId = r.offeredBy?._id || r.offeredBy;
    const currentUserId = user._id || user.id;
    return driverId === currentUserId;
  });

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
                    <Link
                      to="/offer-ride"
                      className="text-xs font-semibold text-[#00b87c] hover:underline"
                    >
                      + Offer New Ride
                    </Link>
                  </div>

                  {myOfferedRides.map((ride) => {
                    const rideIncoming = incomingRequests.filter(req => (req.ride?._id || req.ride) === ride._id);
                    return (
                      <div key={ride._id} className="p-5 rounded-2xl border border-gray-100 bg-[#fbfdfc] hover:border-[#daf1e8] transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                              <MapPin className="w-4 h-4 text-[#00b87c]" />
                              <span>{ride.originAddress || 'Origin'}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                              <span>{ride.destAddress || 'BITM Campus'}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

                          <div className="flex items-center gap-2">
                            <Link
                              to={`/track/${ride._id}`}
                              className="px-4 py-2 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs font-semibold shadow-xs"
                            >
                              Live Tracking
                            </Link>
                          </div>
                        </div>

                        {/* Incoming passenger requests for this ride */}
                        {rideIncoming.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-600 mb-2">Student Seat Requests:</h4>
                            <div className="space-y-2">
                              {rideIncoming.map((req) => (
                                <div key={req._id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100">
                                  <div>
                                    <span className="text-xs font-bold text-gray-900">{req.requester?.name || 'Student'}</span>
                                    <span className="text-[11px] text-gray-400 ml-2">USN: {req.requester?.usn || 'BITM'}</span>
                                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                                      {req.status}
                                    </span>
                                  </div>
                                  {req.status === 'pending' && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleRespond(req._id, 'accepted')}
                                        disabled={actionLoading === req._id}
                                        className="px-3 py-1 rounded-full bg-[#00b87c] text-white text-xs font-semibold hover:bg-[#00a36e]"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleRespond(req._id, 'rejected')}
                                        disabled={actionLoading === req._id}
                                        className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200"
                                      >
                                        Decline
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
                  <div className="pb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      My Outgoing Requests ({outgoingRequests.length})
                    </span>
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
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          req.status === 'accepted' ? 'bg-[#e1f7ec] text-[#00a86b]' :
                          req.status === 'rejected' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {req.status.toUpperCase()}
                        </span>

                        {req.status === 'accepted' && (
                          <Link
                            to={`/track/${req.ride?._id || req.ride}`}
                            className="px-4 py-1.5 rounded-full bg-[#00b87c] text-white text-xs font-semibold shadow-xs hover:bg-[#00a36e]"
                          >
                            Live Tracking
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
