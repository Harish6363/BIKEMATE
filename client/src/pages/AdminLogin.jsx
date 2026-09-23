import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function AdminLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-[#f4f8f7] flex items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-md">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to BikeMate Home</span>
          </Link>
        </div>

        {/* Brand Logo & Heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-3">
            <Logo size="lg" />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-900/10 border border-cyan-800/20 text-[#0e7490] text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrator Access</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Campus Moderator Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Platform telemetry, student verification & safety operations</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-[28px] p-8 shadow-xs">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-start gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm font-medium"
                placeholder="10-digit registered admin phone"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Moderator Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                  placeholder="Enter administrator password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-semibold text-white bg-[#0c1924] hover:bg-[#162a3b] transition shadow-xs disabled:opacity-50 text-sm mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Student account?</span>
            <Link to="/login" className="text-[#00a86b] hover:underline font-semibold">
              Go to Student Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
