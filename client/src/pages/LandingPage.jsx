import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Compass,
  Bike,
  MapPin,
  Navigation,
  ShieldCheck,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Users,
  Clock,
  Sparkles,
  Shield,
  Leaf,
  ChevronRight,
  Lock
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function LandingPage() {
  const { user, token } = useContext(AuthContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);

  // Fetch real-time public ride telemetry & latest active ride
  useEffect(() => {
    const fetchLiveSummary = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rides/public/summary');
        if (res.data?.success) {
          setLiveSummary(res.data);
        }
      } catch (err) {
        console.warn('Live summary fetch warning:', err.message);
      }
    };

    fetchLiveSummary();
    const interval = setInterval(fetchLiveSummary, 8000);
    return () => clearInterval(interval);
  }, []);

  // Smooth scroll handler for anchor links
  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    {
      title: 'Find a Ride',
      description: 'Search for fellow students heading towards campus along your route with real-time seat availability.',
      icon: Compass,
      tag: 'For Riders',
      tint: 'bg-[#eaf7f2] border-[#daf1e8]'
    },
    {
      title: 'Offer a Ride',
      description: 'Riding solo on your bike? Share your empty pillion seat, split fuel costs, and make campus friends.',
      icon: Bike,
      tag: 'For Bike Owners',
      tint: 'bg-white border-gray-100'
    },
    {
      title: 'Location-Based Matching',
      description: 'Smart geospatial routing pairs students residing in the same neighborhood or hostel with zero detours.',
      icon: MapPin,
      tag: 'Smart Routes',
      tint: 'bg-white border-gray-100'
    },
    {
      title: 'Route Optimization',
      description: 'Turn-by-turn coordinate checkpoints and live GPS tracking ensure both rider and driver meet punctually.',
      icon: Navigation,
      tag: 'Live Tracking',
      tint: 'bg-[#eaf7f2] border-[#daf1e8]'
    },
    {
      title: 'Student Verification',
      description: 'High-trust campus network enforced with AI college ID card OCR and verified university email OTP.',
      icon: ShieldCheck,
      tag: '100% Verified',
      tint: 'bg-white border-gray-100'
    },
    {
      title: 'Affordable Travel',
      description: 'Transparent micro-fares (₹10–₹25) that save up to 70% compared to local auto-rickshaws and cabs.',
      icon: Wallet,
      tag: 'Pocket Friendly',
      tint: 'bg-white border-gray-100'
    }
  ];

  const steps = [
    {
      step: '01',
      title: 'Register & Verify',
      desc: 'Sign up with your mobile number, scan your college ID card for automatic AI extraction, and verify your university email.',
      icon: ShieldCheck
    },
    {
      step: '02',
      title: 'Find or Offer a Ride',
      desc: 'Set your pickup location and college destination, or post your bike route with your daily morning departure time.',
      icon: Compass
    },
    {
      step: '03',
      title: 'Connect & Ride',
      desc: 'Receive instant ride confirmations, coordinate via built-in chat, track the bike arrival live, and commute safely together.',
      icon: Bike
    }
  ];

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-gray-900 flex flex-col font-sans selection:bg-[#00b87c]/20 selection:text-[#00a36e]">
      
      {/* =========================================================================
          NAVBAR (Sticky, Glassmorphism, Theme-Compliant)
         ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#f4f8f7]/90 backdrop-blur-md border-b border-gray-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <Logo size="md" subtitle="BITM Campus Commute" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-sm font-semibold text-gray-700 hover:text-[#00b87c] transition cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm font-semibold text-gray-700 hover:text-[#00b87c] transition cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm font-semibold text-gray-700 hover:text-[#00b87c] transition cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-sm font-semibold text-gray-700 hover:text-[#00b87c] transition cursor-pointer"
            >
              About
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            {token && user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/admin-login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200/80 transition"
                  title="Campus Moderator Access"
                >
                  <Shield className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Admin Login</span>
                </Link>

                <Link
                  to="/login"
                  className="px-4 py-2.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition-all shadow-emerald-500/10"
                >
                  <span>Register</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-200/60 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-gray-200 px-5 pt-3 pb-6 space-y-3 shadow-lg animate-fadeIn">
            <div className="space-y-1">
              <button
                onClick={() => scrollToSection('hero')}
                className="w-full text-left py-2 text-sm font-semibold text-gray-800 hover:text-[#00b87c]"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="w-full text-left py-2 text-sm font-semibold text-gray-800 hover:text-[#00b87c]"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="w-full text-left py-2 text-sm font-semibold text-gray-800 hover:text-[#00b87c]"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="w-full text-left py-2 text-sm font-semibold text-gray-800 hover:text-[#00b87c]"
              >
                About
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2.5">
              {token && user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 rounded-full text-center font-semibold text-white bg-[#00b87c] text-sm shadow-xs"
                >
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-3 rounded-full text-center font-semibold text-white bg-[#00b87c] text-sm shadow-xs"
                  >
                    Register as Student
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 rounded-full text-center font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 text-sm"
                  >
                    Student Login
                  </Link>
                  <Link
                    to="/admin-login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2 rounded-full text-center font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Portal Login</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          HERO SECTION
         ========================================================================= */}
      <section id="hero" className="relative pt-12 pb-20 md:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Heading & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Campus Trust Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs font-bold shadow-xs">
                <span>🌸</span>
                <span>Strict Gender-Safe Rides • 100% ID Verified Students</span>
              </div>

              {/* Exact Requested Hero Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.12]">
                Share Your Ride.{' '}
                <span className="text-[#00b87c]">Connect Your Campus.</span>
              </h1>

              {/* Short Description */}
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0">
                BikeMate is the official, trusted student ride-sharing network for college campuses. 
                Pair with verified classmates traveling your routine route, slash daily travel expenses, 
                dodge crowded public buses, and make every campus commute eco-friendly.
              </p>

              {/* Action Buttons: Get Started & Login */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-base font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-900 text-base font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>Student Login</span>
                </Link>
              </div>

              {/* Quick Trust Highlights - Real-time statistics from MongoDB */}
              <div className="pt-6 border-t border-gray-200/80 grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <div className="text-2xl font-extrabold text-gray-900 flex items-center gap-1.5">
                    <span>{liveSummary ? liveSummary.totalStudents : 6}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">Enrolled Students</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#00a86b]">
                    {liveSummary ? liveSummary.activeRidesCount : 0}
                  </div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">Active Campus Rides</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gray-900">
                    {liveSummary?.co2SavedKg ? `${liveSummary.co2SavedKg}kg` : '10.1kg'}
                  </div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">Campus CO₂ Saved</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive App Preview Card (Real-Time Live Campus Ride) */}
            <div className="lg:col-span-5 relative flex justify-center">
              {/* Soft decorative background glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-[#98e6c4]/40 to-[#daf1e8]/30 rounded-[36px] blur-2xl -z-10" />

              <div className="w-full max-w-md bg-white border border-gray-100 rounded-[28px] p-6 sm:p-7 shadow-xl shadow-gray-200/60 space-y-5">
                
                {/* Card Header: Live Campus Network Status */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      {liveSummary?.latestRide ? 'Live Campus Ride Match' : 'Campus Network Live'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e1f7ec] text-[#00a86b]">
                    BITM Ballari
                  </span>
                </div>

                {liveSummary?.latestRide ? (
                  <>
                    {/* Driver Profile Preview */}
                    <div className="flex items-center justify-between bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0c1924] text-white flex items-center justify-center font-bold text-sm">
                          {(liveSummary.latestRide.driverName || 'S')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{liveSummary.latestRide.driverName}</span>
                            <CheckCircle2 className="w-4 h-4 text-[#00b87c]" />
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium">
                            {liveSummary.latestRide.driverUsn || 'Campus Verified'} • {liveSummary.latestRide.driverDept || 'Student'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#00a86b]">₹{liveSummary.latestRide.pricePerSeat} / seat</div>
                        <div className="text-[10px] text-gray-400">
                          {liveSummary.latestRide.seatsAvailable} Seat{liveSummary.latestRide.seatsAvailable > 1 ? 's' : ''} Left
                        </div>
                      </div>
                    </div>

                    {/* Route Diagram */}
                    <div className="space-y-3 px-1 py-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-2.5 h-2.5 rounded-full bg-[#00b87c] ring-4 ring-[#00b87c]/20 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-gray-900 max-w-[260px] truncate">
                            {liveSummary.latestRide.originAddress}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            Departure: {liveSummary.latestRide.departureTime ? new Date(liveSummary.latestRide.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                          </div>
                        </div>
                      </div>

                      <div className="ml-1 pl-3 border-l-2 border-dashed border-gray-200 py-1 text-[11px] text-gray-400 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>Real OSRM Route • Zero Detours</span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-500/20 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-gray-900 max-w-[260px] truncate">
                            {liveSummary.latestRide.destAddress}
                          </div>
                          <div className="text-[11px] text-gray-400">Campus Destination</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center space-y-2 bg-[#f8faf9] rounded-2xl border border-gray-100">
                    <span className="text-3xl">🛵</span>
                    <h4 className="text-sm font-bold text-gray-900">Live Campus Radar Active</h4>
                    <p className="text-xs text-gray-500">
                      All campus routes monitored in real-time. Be the first to offer or find a ride today!
                    </p>
                  </div>
                )}

                {/* Ladies Safe Guarantee Pill */}
                <div className="p-3 rounded-xl bg-pink-50 border border-pink-200/80 flex items-center gap-2.5 text-pink-900 text-xs font-medium">
                  <span className="text-base shrink-0">🌸</span>
                  <span className="text-[11px]">
                    <strong>Ladies Protection:</strong> Girls match exclusively with female drivers.
                  </span>
                </div>

                {/* Live Action Button */}
                <Link
                  to={user ? "/find-ride" : "/register"}
                  className="w-full py-3 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{user ? "Explore Live Rides" : "Book Ride or List Commute"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURES SECTION (6 Requested Features in BikeMate Card Style)
         ========================================================================= */}
      <section id="features" className="py-20 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold px-3.5 py-1 rounded-full bg-[#e1f7ec] text-[#00a86b] uppercase tracking-wider">
              Comprehensive Platform Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Built Exclusively for Campus Daily Commutes
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              Say goodbye to unpredictable autos and crowded city buses. Everything you need for a fast, economical, and trusted ride.
            </p>
          </div>

          {/* 6 Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className={`rounded-[28px] p-7 border flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-1 ${item.tint}`}
                >
                  <div>
                    {/* Icon Circle */}
                    <div className="w-12 h-12 rounded-full bg-[#111827] flex items-center justify-center text-white mb-6 shadow-sm">
                      <Icon className="w-6 h-6" strokeWidth={2} />
                    </div>

                    <div className="inline-block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      {item.tag}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {item.title}
                    </h3>

                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-100/60 flex items-center text-xs font-bold text-[#00a86b]">
                    <span>Verified Feature</span>
                    <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          HOW IT WORKS SECTION (1. Register, 2. Find/Offer, 3. Connect & Ride)
         ========================================================================= */}
      <section id="how-it-works" className="py-20 bg-[#f4f8f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold px-3.5 py-1 rounded-full bg-[#e1f7ec] text-[#00a86b] uppercase tracking-wider">
              3-Step Simplicity
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              How BikeMate Works
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              Get to class on time with zero hassle. Here is how simple it is to get started.
            </p>
          </div>

          {/* 3 Steps Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((st, idx) => {
              const Icon = st.icon;
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-100 rounded-[28px] p-8 shadow-xs relative flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Step Number Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-4xl font-extrabold text-gray-200">
                        {st.step}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {st.title}
                    </h3>

                    <p className="text-gray-500 text-sm leading-relaxed">
                      {st.desc}
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-semibold">
                    <span>Step {idx + 1} of 3</span>
                    <span className="text-[#00a86b]">✓ Instant</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centered CTA under Steps */}
          <div className="text-center mt-12">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-bold shadow-xs transition-all hover:scale-105"
            >
              <span>Join Your Campus Ride Network Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </section>

      {/* =========================================================================
          ABOUT & CAMPUS TRUST SECTION
         ========================================================================= */}
      <section id="about" className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Content */}
            <div className="space-y-6">
              <span className="text-xs font-bold px-3.5 py-1 rounded-full bg-[#e1f7ec] text-[#00a86b] uppercase tracking-wider">
                Safety & Mission
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Empowering Safer, Greener, and Connected Campus Commutes
              </h2>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Founded specifically for student communities, BikeMate bridges the daily commute gap. 
                Hundreds of bikes travel into campus every morning with single riders, while other classmates 
                struggle with crowded buses and high auto costs.
              </p>
              
              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Zero-Strangers Campus Policy</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Only verified college students with active USNs and college email OTP verification can access the platform.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Dedicated Ladies-Safe Mode</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Female students can enable exclusive ladies-only matching, guaranteeing they only ride with female drivers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Leaf className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Green & Congestion-Free College</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Every carpool saves up to 0.4L petrol and prevents 0.8kg CO2 from entering campus air.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Campus Statistics Showcase */}
            <div className="bg-[#0c1924] rounded-[28px] p-8 sm:p-10 text-white shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Logo size="sm" variant="dark-bg" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Campus Telemetry
                  </span>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  Live Network
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="text-3xl font-extrabold text-white tracking-tight">BITM</div>
                  <div className="text-xs text-gray-400">Ballari Campus Network</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                    {liveSummary ? liveSummary.activeRidesCount : 0}
                  </div>
                  <div className="text-xs text-gray-400">Live Active Rides</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {liveSummary ? liveSummary.verifiedStudents : 0}
                  </div>
                  <div className="text-xs text-gray-400">Verified ID Students</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-extrabold text-cyan-400 tracking-tight">
                    {liveSummary?.co2SavedKg ? `${liveSummary.co2SavedKg}kg` : '0kg'}
                  </div>
                  <div className="text-xs text-gray-400">Campus CO₂ Saved</div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-gray-400">Are you a campus administrator?</span>
                <Link
                  to="/admin-login"
                  className="px-4 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 font-semibold transition"
                >
                  Admin Portal Login →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          CALL TO ACTION (CTA BANNER)
         ========================================================================= */}
      <section className="py-16 bg-[#f4f8f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0c1924] rounded-[32px] p-8 sm:p-14 text-center text-white relative overflow-hidden shadow-2xl">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00b87c]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-5">
              <span className="text-xs font-bold px-3.5 py-1 rounded-full bg-white/10 text-emerald-400 uppercase tracking-wider inline-block">
                Start Saving Today
              </span>

              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Ready for a Smarter Campus Commute?
              </h2>

              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                Join verified students traveling between Ballari station, hostels, and BITM campus. 
                Register your account in under 2 minutes.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link
                  to="/register"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs text-sm cursor-pointer"
                >
                  Create Free Student Account →
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-gray-900 bg-white hover:bg-gray-100 transition shadow-xs text-sm cursor-pointer"
                >
                  Student Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER (Matching BikeMate Aesthetics)
         ========================================================================= */}
      <footer className="bg-white border-t border-gray-200/80 pt-12 pb-8 mt-auto text-gray-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="space-y-3 md:col-span-2">
              <Logo size="md" />
              <p className="text-gray-500 text-xs leading-relaxed max-w-sm mt-2">
                BikeMate is the verified peer-to-peer campus ride sharing network for college students. 
                Built for safety, affordability, and a cleaner green college environment.
              </p>
              <div className="pt-2 text-gray-400 text-[11px]">
                Ballari Institute of Technology and Management (BITM), Ballari, Karnataka.
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">Platform</h4>
              <ul className="space-y-1.5">
                <li><button onClick={() => scrollToSection('hero')} className="hover:text-[#00b87c] transition cursor-pointer">Home</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-[#00b87c] transition cursor-pointer">Features</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-[#00b87c] transition cursor-pointer">How It Works</button></li>
                <li><button onClick={() => scrollToSection('about')} className="hover:text-[#00b87c] transition cursor-pointer">Safety & About</button></li>
              </ul>
            </div>

            {/* Access Portals */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">Portals</h4>
              <ul className="space-y-1.5">
                <li><Link to="/register" className="hover:text-[#00b87c] transition">Student Register</Link></li>
                <li><Link to="/login" className="hover:text-[#00b87c] transition">Student Login</Link></li>
                <li><Link to="/admin-login" className="hover:text-[#00b87c] transition font-semibold text-cyan-700">Admin Portal Login</Link></li>
                <li><Link to="/find-ride" className="hover:text-[#00b87c] transition">Find a Ride</Link></li>
                <li><Link to="/offer-ride" className="hover:text-[#00b87c] transition">Offer a Ride</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-gray-400 text-[11px]">
            <div>
              © {new Date().getFullYear()} BikeMate. All rights reserved. Exclusively for verified college students.
            </div>
            <div className="flex items-center gap-4">
              <span>Student Safety First</span>
              <span>•</span>
              <span>Green Campus</span>
              <span>•</span>
              <Link to="/admin-login" className="text-gray-500 hover:text-gray-700">Moderator Access</Link>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
