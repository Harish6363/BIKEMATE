import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  ArrowRight, 
  Menu, 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  GitFork, 
  Bike 
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Logo from '../components/Logo';
import campusRideHeroImg from '../assets/campus-ride-hero.jpg';

export default function LandingPage() {
  const { user, token } = useContext(AuthContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f9f8] text-slate-900 flex flex-col font-sans selection:bg-[#00b87c]/20 selection:text-[#00a36e]">
      
      {/* =========================================================================
          TOP NAVBAR (Matches Screenshot 1)
         ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#f4f9f8]/95 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <Logo size="md" subtitle="Smart Ride Sharing Platform" />
          </Link>

          {/* Desktop Navigation Links (Centered) */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-sm font-semibold text-[#00a86b] hover:text-[#008e5c] transition cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm font-medium text-slate-700 hover:text-[#00a86b] transition cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => setRoleModalOpen(true)}
              className="text-sm font-medium text-slate-700 hover:text-[#00a86b] transition cursor-pointer"
            >
              Get Started
            </button>
          </nav>

          {/* Right Action Buttons (All Green) */}
          <div className="hidden md:flex items-center space-x-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs sm:text-sm font-bold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              Log In
            </Link>

            <Link
              to="/admin-login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs sm:text-sm font-bold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
              title="Campus Admin Portal"
            >
              <Shield className="w-4 h-4 text-white" />
              <span>Admin Portal</span>
            </Link>

            <button
              type="button"
              onClick={() => setRoleModalOpen(true)}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs sm:text-sm font-bold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              Registration
            </button>
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-200/60 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-6 py-5 space-y-3 shadow-xl animate-fadeIn">
            <div className="space-y-1.5">
              <button
                onClick={() => scrollToSection('hero')}
                className="w-full text-left py-2 text-sm font-bold text-[#00a86b]"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#00a86b]"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); setRoleModalOpen(true); }}
                className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#00a86b] cursor-pointer"
              >
                Get Started
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-full text-center font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] text-sm shadow-xs"
              >
                Log In
              </Link>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); setRoleModalOpen(true); }}
                className="w-full py-2.5 rounded-full text-center font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] text-sm shadow-xs cursor-pointer"
              >
                Registration
              </button>
              <Link
                to="/admin-login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-full text-center font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] text-sm shadow-xs flex items-center justify-center gap-1.5"
              >
                <Shield className="w-4 h-4 text-white" />
                <span>Admin Portal</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          HERO SECTION (With Campus Riders Photo Backdrop)
         ========================================================================= */}
      {/* =========================================================================
          HERO BANNER (With Campus Riders Image & Integrated Artwork)
         ========================================================================= */}
      <section id="hero" className="relative w-full bg-[#f4f9f8] overflow-hidden">
        <h1 className="sr-only">BikeMate — Ride Together. Save Together. Reach Together. Smart Ride Sharing Platform</h1>
        <div className="w-full">
          <img 
            src={campusRideHeroImg} 
            alt="BikeMate - Ride Together. Save Together. Reach Together. Connect with verified BITM students travelling your way." 
            className="w-full h-auto object-cover block select-none"
          />
        </div>
      </section>

      {/* =========================================================================
          ACTION BUTTONS BAR (DISPLAYED BELOW LANDING PAGE IMAGE, JUST ABOVE HOW BIKEMATE WORKS)
         ========================================================================= */}
      <section className="bg-white border-b border-slate-200/80 py-8 sm:py-10 px-4 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {/* 1. Find a Ride */}
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm sm:text-base font-bold shadow-md transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Find a Ride</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* 2. Offer a Ride */}
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm sm:text-base font-bold shadow-md transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Bike className="w-4 h-4" />
            <span>Offer a Ride</span>
          </Link>

          {/* 3. Admin Portal */}
          <Link
            to="/admin-login"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm sm:text-base font-bold shadow-md transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-white" />
            <span>Admin Portal</span>
          </Link>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: "HOW BIKEMATE WORKS" (Matches Screenshot 2)
         ========================================================================= */}
      <section id="how-it-works" className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center mb-16 space-y-2">
            <span className="text-xs font-bold text-[#00b87c] uppercase tracking-wider block">
              HOW BIKEMATE WORKS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
              Three steps. One smarter commute.
            </h2>
          </div>

          {/* 3 Step Cards in a Row with Horizontal Dashed Connector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch relative">
            
            {/* Step 1: Verify */}
            <div className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative z-10">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#dff3ea] text-[#00a86b] flex items-center justify-center shadow-2xs">
                    <Shield className="w-6 h-6 text-[#00a86b]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    STEP 01
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#111827] mb-2.5">
                  Verify
                </h3>

                <p className="text-slate-500 text-sm leading-relaxed">
                  Upload your college ID and verify your student identity.
                </p>
              </div>
            </div>

            {/* Step 2: Match */}
            <div className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative z-10">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#dff3ea] text-[#00a86b] flex items-center justify-center shadow-2xs">
                    {/* Route match fork icon */}
                    <svg className="w-6 h-6 text-[#00a86b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="6" cy="6" r="3" />
                      <circle cx="18" cy="18" r="3" />
                      <path d="M9 6h4a5 5 0 0 1 5 5v4" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    STEP 02
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#111827] mb-2.5">
                  Match
                </h3>

                <p className="text-slate-500 text-sm leading-relaxed">
                  BikeMate finds students travelling along similar routes.
                </p>
              </div>
            </div>

            {/* Step 3: Ride */}
            <div className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative z-10">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#dff3ea] text-[#00a86b] flex items-center justify-center shadow-2xs">
                    {/* Bike icon */}
                    <svg className="w-6 h-6 text-[#00a86b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="5.5" cy="17.5" r="3.5" />
                      <circle cx="18.5" cy="17.5" r="3.5" />
                      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9l3-3 3 5 3-1" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    STEP 03
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#111827] mb-2.5">
                  Ride
                </h3>

                <p className="text-slate-500 text-sm leading-relaxed">
                  Connect, share the journey and reduce your travel cost.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 3: CALL TO ACTION BANNER (Matches Screenshot 3)
         ========================================================================= */}
      <section id="cta-section" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#f4f9f8]">
        <div className="max-w-6xl mx-auto">
          
          <div className="bg-[#0c1924] rounded-[36px] py-16 px-6 sm:px-12 text-center text-white relative shadow-2xl overflow-hidden">
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Your next ride might already be going your way.
              </h2>

              <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed pb-4">
                Join the BikeMate student community and make your daily commute smarter.
              </p>

              {/* CTA Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 pb-8">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-xs sm:text-sm font-bold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="px-6 py-3 rounded-full bg-[#142535] hover:bg-[#1b3247] text-slate-200 border border-white/10 text-xs sm:text-sm font-bold transition hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Explore BikeMate
                </button>
              </div>

              {/* Delicate Route Line SVG (Matches Screenshot 3) */}
              <div className="w-full max-w-md mx-auto pt-2">
                <svg className="w-full h-8" viewBox="0 0 360 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Start White Dot */}
                  <circle cx="16" cy="14" r="4.5" fill="#ffffff" />
                  
                  {/* Smooth Curved Line */}
                  <path 
                    d="M 21 14 Q 100 8, 180 18 T 336 14" 
                    stroke="#00b87c" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                  />
                  
                  {/* Mid Green Dot */}
                  <circle cx="180" cy="18" r="4" fill="#00b87c" />

                  {/* Destination Marker Icon */}
                  <g transform="translate(336, 6)">
                    <circle cx="4" cy="4" r="3.5" fill="#00b87c" />
                    <path d="M 4 8 L 4 14" stroke="#00b87c" strokeWidth="2" strokeLinecap="round" />
                  </g>
                </svg>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: DARK FOOTER (Matches Screenshot 4)
         ========================================================================= */}
      <footer className="bg-[#0c1924] text-white pt-16 pb-10 border-t border-white/5 mt-auto text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            
            {/* Column 1: Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Logo size="md" variant="dark-bg" />
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xs mt-2">
                Smarter rides for the BITM community.
              </p>
            </div>

            {/* Column 2: PRODUCT */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                PRODUCT
              </h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => scrollToSection('how-it-works')} 
                    className="text-slate-300 hover:text-white transition cursor-pointer text-xs"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button 
                    type="button"
                    onClick={() => setRoleModalOpen(true)} 
                    className="text-slate-300 hover:text-white transition text-xs cursor-pointer"
                  >
                    Get Started
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: ACCOUNT */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                ACCOUNT
              </h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    type="button"
                    onClick={() => setRoleModalOpen(true)} 
                    className="text-slate-300 hover:text-white transition text-xs cursor-pointer"
                  >
                    Sign Up
                  </button>
                </li>
                <li>
                  <Link 
                    to="/login" 
                    className="text-slate-300 hover:text-white transition text-xs"
                  >
                    Log In
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: HELP & SUPPORT (Exact details from Screenshot 4) */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                HELP & SUPPORT
              </h4>
              
              <div>
                <div className="font-bold text-white text-sm">D Karthik</div>
                <div className="text-slate-400 text-xs">Campus Support Lead</div>
              </div>

              <div className="pt-1 space-y-1.5">
                <a 
                  href="mailto:karthiidk36@gmail.com" 
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition text-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>karthiidk36@gmail.com</span>
                </a>

                <a 
                  href="tel:+916361609996" 
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition text-xs"
                >
                  <Phone className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>+91 6361609996</span>
                </a>
              </div>
            </div>

          </div>

          {/* Bottom Bar (Matches Screenshot 4) */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
            <div>
              BikeMate — Smart Ride Sharing Platform
            </div>
            <div className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
              STUDENT MAJOR PROJECT
            </div>
          </div>

        </div>
      </footer>

      {/* Role Selection Modal: Prompt Student vs Faculty before moving to registration steps */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 relative">
            <button
              onClick={() => setRoleModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e1f7ec] text-[#00a86b] text-xs font-bold border border-[#98e6c4] mb-2">
                ✨ Create Account
              </span>
              <h3 className="text-xl font-bold text-gray-900">Are you a Student or Faculty?</h3>
              <p className="text-xs text-gray-500 mt-1">Select your campus role to proceed to registration steps</p>
            </div>

            <div className="space-y-3.5">
              <Link
                to="/register?type=student"
                onClick={() => setRoleModalOpen(false)}
                className="w-full text-left p-4 rounded-2xl border-2 border-gray-200 hover:border-[#00b87c] hover:bg-[#e1f7ec]/20 transition flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-2xl group-hover:scale-105 transition-transform">
                  🎓
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900 group-hover:text-[#00a86b] transition-colors">
                      Student Commuter
                    </span>
                    <span className="text-xs text-[#00a86b] font-semibold">
                      Continue →
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 block mt-0.5 leading-relaxed">
                    For college students. Requires Student ID & <strong>USN</strong>. Gender-safe matching.
                  </span>
                </div>
              </Link>

              <Link
                to="/register?type=faculty"
                onClick={() => setRoleModalOpen(false)}
                className="w-full text-left p-4 rounded-2xl border-2 border-gray-200 hover:border-[#00b87c] hover:bg-[#e1f7ec]/20 transition flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold text-2xl group-hover:scale-105 transition-transform">
                  👨‍🏫
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900 group-hover:text-[#00a86b] transition-colors">
                      Teacher / Faculty Staff
                    </span>
                    <span className="text-xs text-[#00a86b] font-semibold">
                      Continue →
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 block mt-0.5 leading-relaxed">
                    Uses <strong>Employee ID</strong>. Any boy or girl student driver can pick you up!
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
