import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, RefreshCw, X, CheckCircle2, Mail, Key } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Logo from '../components/Logo';

function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Identifier, 2: OTP & New Password, 3: Success
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');
  const [maskedEmailNotice, setMaskedEmailNotice] = useState('');

  const redirectPath = location.state?.from || '/';
  const redirectNotice = location.state?.message || '';

  // Real-time phone validation
  const getPhoneValidation = (val) => {
    if (!val || !val.trim()) {
      return {
        isValid: false,
        borderClass: phoneTouched ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200',
        message: 'Helper text: Enter your 10-digit mobile number.',
        type: 'helper'
      };
    }
    // Check if contains non-digits
    if (/[^0-9]/.test(val)) {
      return {
        isValid: false,
        borderClass: 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/20',
        message: 'Phone number must contain only digits.',
        type: 'error'
      };
    }
    // Check length and Indian mobile prefix
    if (val.length !== 10) {
      return {
        isValid: false,
        borderClass: 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/20',
        message: `Please enter a valid phone number. (${val.length}/10 digits)`,
        type: 'error'
      };
    }
    if (!/^[6-9]/.test(val)) {
      return {
        isValid: false,
        borderClass: 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/20',
        message: 'Must start with 6, 7, 8, or 9.',
        type: 'error'
      };
    }
    return {
      isValid: true,
      borderClass: 'border-[#00b87c] focus:border-[#00b87c] focus:ring-emerald-200 bg-emerald-50/20',
      message: '✓ Valid 10-digit mobile number',
      type: 'success'
    };
  };

  const phoneValidation = getPhoneValidation(phone);

  // Password rules validation for reset password
  const passwordRules = {
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword)
  };
  const isNewPasswordValid = Object.values(passwordRules).every(Boolean);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { phone, password });
      login(res.data.token, res.data.user);
      if (res.data.user?.role === 'admin' && (redirectPath === '/' || redirectPath === '/dashboard')) {
        navigate('/admin');
      } else {
        navigate(redirectPath === '/' ? '/dashboard' : redirectPath);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Send OTP
  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    const targetIdentifier = forgotIdentifier || phone;
    if (!targetIdentifier || !targetIdentifier.trim()) {
      setForgotError('Please enter your registered mobile number or college email.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/forgot-password/send-otp', {
        identifier: targetIdentifier.trim()
      });

      if (res.data.devOtp) setDevOtpCode(res.data.devOtp);
      if (res.data.email) setMaskedEmailNotice(res.data.email);
      if (res.data.phone && !phone) setPhone(res.data.phone);

      setForgotSuccess(res.data.message || 'Verification code sent!');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to send reset code. Please verify your details.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password: Reset with OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    const targetIdentifier = forgotIdentifier || phone;

    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the 6-digit verification code sent to you.');
      return;
    }

    if (!isNewPasswordValid) {
      setForgotError('New password does not satisfy all security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match. Please re-enter.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/forgot-password/reset', {
        identifier: targetIdentifier.trim(),
        otp: forgotOtp.trim(),
        newPassword
      });

      setForgotSuccess(res.data.message || 'Password reset successfully!');
      setPassword(newPassword); // Pre-fill password on login form
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to reset password. Please check your OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
  };

  return (
    <div className="min-h-screen bg-[#f4f8f7] flex items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-md">
        {/* Brand Logo & Heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-3">
            <Logo size="lg" />
          </Link>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Login to your verified campus commute account</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-[28px] p-8 shadow-xs">
          {redirectNotice && !error && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{redirectNotice}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Phone Number Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">Phone Number</label>
                <span className={`text-[11px] font-medium transition-colors ${
                  phoneValidation.type === 'error' ? 'text-red-600 font-semibold' :
                  phoneValidation.type === 'success' ? 'text-[#00a86b] font-bold' :
                  'text-gray-400'
                }`}>
                  {phoneValidation.message}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  📱
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onBlur={() => setPhoneTouched(true)}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneTouched(true);
                  }}
                  className={`w-full pl-9 pr-4 py-3 rounded-xl bg-gray-50 border text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 transition text-sm ${phoneValidation.borderClass}`}
                  placeholder="Enter 10-digit mobile number"
                  required
                />
              </div>
            </div>

            {/* Password Field with "Forgot password?" directly above */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStep(1);
                    setForgotError('');
                    setForgotSuccess('');
                    if (phone && !forgotIdentifier) setForgotIdentifier(phone);
                  }}
                  className="text-xs text-[#00a86b] hover:underline font-semibold"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  🔒
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !phoneValidation.isValid}
              className="w-full py-3.5 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Logging in...' : 'Login to BikeMate'}</span>
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#00a86b] hover:underline font-bold">Register here</Link>
          </p>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Campus administrator?</span>
            <Link to="/admin-login" className="text-cyan-700 hover:underline font-bold flex items-center gap-1">
              <span>Admin Portal Login</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL (Triggered by "Forgot password?" above password field) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-gray-100 rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={closeForgotModal}
              className="absolute right-5 top-5 p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Heading */}
            <div className="mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-[#00a86b] flex items-center justify-center text-lg mb-3 shadow-xs">
                <Key className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Reset Password</h2>
              <p className="text-gray-500 text-xs mt-1">
                {forgotStep === 1
                  ? 'Enter your registered mobile or college email to receive a verification code.'
                  : forgotStep === 2
                  ? 'Verify your code and create a secure new password.'
                  : 'Your password has been successfully updated.'}
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Enter Phone / Email */}
            {forgotStep === 1 && (
              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Registered Mobile Number or College Email
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. 9876543210 or student@bitm.edu.in"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotIdentifier.trim()}
                  className="w-full py-3.5 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  {forgotLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{forgotLoading ? 'Verifying Account...' : 'Send Verification Code (OTP)'}</span>
                </button>
              </form>
            )}

            {/* STEP 2: Enter OTP & New Password */}
            {forgotStep === 2 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {maskedEmailNotice && (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Code dispatched to: <strong className="text-gray-900">{maskedEmailNotice}</strong></span>
                  </div>
                )}

                {/* Dev OTP Helper */}
                {devOtpCode && (
                  <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold">Dev Code:</span> <span className="font-mono font-bold tracking-widest text-cyan-700">{devOtpCode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForgotOtp(devOtpCode)}
                      className="text-[11px] font-bold text-cyan-700 bg-cyan-100 hover:bg-cyan-200 px-2 py-0.5 rounded-lg transition"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-700">6-Digit Verification Code</label>
                    <button
                      type="button"
                      onClick={handleRequestResetOtp}
                      disabled={forgotLoading}
                      className="text-[11px] font-bold text-[#00a86b] hover:underline"
                    >
                      Resend Code
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-2.5 text-center tracking-[6px] font-mono font-bold text-lg rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition"
                    placeholder="000000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Confirm New Password</label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                {/* Password Rules Checklist */}
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] space-y-1">
                  <p className="font-bold text-gray-700 mb-1">Password Requirements:</p>
                  <div className="grid grid-cols-2 gap-1 text-gray-500">
                    <span className={passwordRules.minLength ? 'text-emerald-600 font-bold' : ''}>
                      {passwordRules.minLength ? '✓' : '•'} 8+ characters
                    </span>
                    <span className={passwordRules.hasUpper ? 'text-emerald-600 font-bold' : ''}>
                      {passwordRules.hasUpper ? '✓' : '•'} 1 Uppercase (A-Z)
                    </span>
                    <span className={passwordRules.hasLower ? 'text-emerald-600 font-bold' : ''}>
                      {passwordRules.hasLower ? '✓' : '•'} 1 Lowercase (a-z)
                    </span>
                    <span className={passwordRules.hasNumber ? 'text-emerald-600 font-bold' : ''}>
                      {passwordRules.hasNumber ? '✓' : '•'} 1 Number (0-9)
                    </span>
                    <span className={`col-span-2 ${passwordRules.hasSpecial ? 'text-emerald-600 font-bold' : ''}`}>
                      {passwordRules.hasSpecial ? '✓' : '•'} 1 Special character (!@#$%^&*)
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !isNewPasswordValid || newPassword !== confirmPassword || forgotOtp.length !== 6}
                  className="w-full py-3.5 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  {forgotLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{forgotLoading ? 'Updating Password...' : 'Save & Update Password'}</span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
                  >
                    ← Change Phone / Email
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Success Screen */}
            {forgotStep === 3 && (
              <div className="text-center py-4 space-y-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#00a86b] mx-auto flex items-center justify-center text-3xl shadow-sm border border-emerald-200">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">Password Reset Successful!</h3>
                  <p className="text-gray-500 text-xs mt-1 max-w-xs mx-auto">
                    Your password has been updated. You can now login to your BikeMate account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="w-full py-3.5 rounded-full font-bold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs text-sm"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
