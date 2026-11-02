import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, ArrowLeft, ArrowRight, Smartphone } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function AdminLogin() {
  const [phone, setPhone] = useState('9999999999');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        phone: phone.trim(),
        password
      });

      const { token, user } = res.data;

      // Verify that the user has admin role
      if (user?.role !== 'admin') {
        setError('Access Denied: This portal is reserved exclusively for campus administrators and moderators.');
        return;
      }

      login(token, user);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Admin login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f7] relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Decorative ambient backgrounds matching Image 2 */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl pointer-events-none" />
      {/* Subtle leaf watermark graphic in top right */}
      <div className="absolute top-2 right-4 text-emerald-200/40 pointer-events-none select-none">
        <svg width="220" height="220" viewBox="0 0 100 100" fill="currentColor">
          <path d="M10,90 Q40,10 90,10 Q90,60 10,90 Z" />
          <path d="M25,75 Q50,30 85,20" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back Link */}
        <div className="mb-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to BikeMate Home</span>
          </Link>
        </div>

        {/* Brand Logo & Heading (Matches Image 2) */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <Logo size="lg" subtitle="Smart Ride Sharing Platform" />
          </Link>
          
          <div className="mt-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#e1f7ec] border border-[#a2deca] text-[#00a86b] text-xs font-bold uppercase tracking-wider shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00a86b]" />
              <span>Administrator Access</span>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight">
            Campus Moderator <span className="text-[#00b87c]">Portal</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium">
            Platform telemetry, student verification & safety operations
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-[32px] p-7 sm:p-8 shadow-xl shadow-slate-200/50">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-start gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            {/* Field 1: Admin Phone Number */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-1.5">
                <Smartphone className="w-4 h-4 text-gray-700" />
                <span>Admin Phone Number</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#f0f7ff]/60 border border-[#00b87c] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b87c]/20 text-sm font-semibold tracking-wide transition"
                placeholder="9999999999"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
                Enter your registered admin mobile number
              </p>
            </div>

            {/* Field 2: Moderator Password */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-1.5">
                <Lock className="w-4 h-4 text-gray-700" />
                <span>Moderator Password</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#f0f7ff]/60 border border-gray-200 focus:border-[#00b87c] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b87c]/20 text-sm font-medium transition"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
                Enter your moderator password
              </p>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00b87c] focus:ring-[#00b87c] accent-[#00b87c] cursor-pointer"
                />
                <span className="text-xs font-semibold text-gray-700">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Please contact the campus system administrator or IT cell to reset your moderator password.')}
                className="text-xs font-bold text-[#00a86b] hover:text-[#008e5c] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Green Submit Button with Arrow */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-md hover:shadow-lg disabled:opacity-50 text-sm mt-3 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Student Account Footer Link (Pill Styled as in Image 2) */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium text-gray-600">Student account?</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#e1f7ec] hover:bg-[#d0f2e2] text-[#00a86b] font-bold text-xs transition"
            >
              <span>Go to Student Login</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
