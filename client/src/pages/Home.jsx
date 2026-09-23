import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Bike, ArrowRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

export default function Home() {
  const { user } = useContext(AuthContext);
  const [upcomingRide, setUpcomingRide] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user has an active/upcoming ride
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rides/requests/my');
        // Find first accepted upcoming request or active ride
        const accepted = (res.data.outgoing || []).find(r => r.status === 'accepted');
        if (accepted && accepted.ride) {
          setUpcomingRide(accepted.ride);
        }
      } catch (err) {
        // Fallback silently if offline/unauthenticated
      } finally {
        setLoading(false);
      }
    };
    fetchUpcoming();
  }, []);

  return (
    <div className="pt-2">
      {/* 3 Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Find a Ride (Soft Mint Tint) */}
        <div className="bg-[#eaf7f2] border border-[#daf1e8] rounded-[28px] p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            {/* Dark Circle with Compass Icon */}
            <div className="w-12 h-12 rounded-full bg-[#111827] flex items-center justify-center text-white mb-6 shadow-sm">
              <Compass className="w-6 h-6" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Find a Ride</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              See who's travelling your way.
            </p>
          </div>

          <div>
            <Link
              to="/find-ride"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
            >
              <span>Find a Ride</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Offer a Ride (White Card with Dark Bordered Button) */}
        <div className="bg-white border border-gray-100 rounded-[28px] p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            {/* Dark Circle with Bicycle Icon */}
            <div className="w-12 h-12 rounded-full bg-[#111827] flex items-center justify-center text-white mb-6 shadow-sm">
              <Bike className="w-6 h-6" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Offer a Ride</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Share your route with other students.
            </p>
          </div>

          <div>
            <Link
              to="/offer-ride"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-900 text-sm font-semibold shadow-xs transition-all"
            >
              <span>Offer a Ride</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: UPCOMING RIDE (White Card) */}
        <div className="bg-white border border-gray-100 rounded-[28px] p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              UPCOMING RIDE
            </div>

            {upcomingRide ? (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Ride to Campus</h2>
                <p className="text-gray-500 text-xs mb-3 font-medium">
                  {upcomingRide.destAddress || 'Ballari Institute of Technology and Management'}
                </p>
                <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl mb-6 inline-block font-medium">
                  ⏰ Departure: {upcomingRide.departureTime ? new Date(upcomingRide.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No upcoming ride</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                  Match with a student heading to BITM.
                </p>
              </div>
            )}
          </div>

          <div>
            {upcomingRide ? (
              <Link
                to={`/track/${upcomingRide._id}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
              >
                <span>Track Ride Live</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/find-ride"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
              >
                <span>Find a Ride</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
