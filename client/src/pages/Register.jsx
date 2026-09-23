import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/PasswordStrengthMeter';
import Logo from '../components/Logo';

const steps = ['Mobile', 'ID Card', 'Email OTP', 'Password'];

// Clean and extract up to 10 digits for Indian mobile numbers
const cleanMobileDigits = (val) => (val || '').toString().replace(/\D/g, '').slice(0, 10);
// Check if valid Indian 10-digit mobile number starting with 6, 7, 8, or 9
const isValidIndianMobile = (val) => /^[6-9]\d{9}$/.test(cleanMobileDigits(val));

function Register() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ 
    name: '', 
    usn: '', 
    college: '', 
    department: 'AIML', 
    phone: '', 
    email: '', 
    password: '', 
    gender: 'female',
    idCardImageUrl: '',
    idCardHash: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [idFile, setIdFile] = useState(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDuplicateCard, setIsDuplicateCard] = useState(false);
  const [usnChecking, setUsnChecking] = useState(false);
  const [usnError, setUsnError] = useState('');
  const navigate = useNavigate();
  const API = 'http://localhost:5000/api/auth';

  // Password criteria evaluation
  const password = formData.password || '';
  const { criteria: passwordCriteria, metCount, isValid: isPasswordValid } = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Mobile number validation state
  const phoneDigits = cleanMobileDigits(formData.phone);
  const isPhoneValid = isValidIndianMobile(formData.phone);

  const handle = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePhoneChange = (e) => {
    const cleaned = cleanMobileDigits(e.target.value);
    setFormData(f => ({ ...f, phone: cleaned }));
    if (error) setError('');
  };

  const handleUsnChange = (e) => {
    const raw = e.target.value.toUpperCase();
    setFormData(f => ({ ...f, usn: raw }));
    setUsnError('');
    if (error) setError('');
  };

  const checkUsnAvailability = async (usnToCheck) => {
    const val = (usnToCheck || formData.usn || '').trim();
    if (!val || val.length < 3) return;
    setUsnChecking(true);
    try {
      const res = await axios.get(`${API}/register/check-usn/${encodeURIComponent(val)}`);
      if (res.data?.exists) {
        setUsnError(res.data.message || `Not possible: USN ${val} is already registered.`);
      } else {
        setUsnError('');
      }
    } catch (e) {
      console.warn('USN check warning:', e.message);
    } finally {
      setUsnChecking(false);
    }
  };

  const isLadies = formData.gender === 'female';
  const toggleLadies = () => {
    setFormData(f => ({ ...f, gender: f.gender === 'female' ? 'male' : 'female' }));
  };

  const step1 = async () => {
    setError('');
    const digits = cleanMobileDigits(formData.phone);
    if (!digits) {
      setError('Please enter your 10-digit mobile number.');
      return;
    }
    if (digits.length !== 10) {
      setError(`Mobile number must be exactly 10 digits (currently ${digits.length} digits).`);
      return;
    }
    if (!/^[6-9]/.test(digits)) {
      setError('Mobile number must start with 6, 7, 8, or 9.');
      return;
    }
    setLoading(true);
    try { 
      await axios.post(`${API}/register/step1`, { phone: digits }); 
      setFormData(f => ({ ...f, phone: digits }));
      setStep(1); 
    }
    catch (err) { 
      setError(err.response?.data?.message || 'Error validating mobile number'); 
    }
    finally { setLoading(false); }
  };

  const step2 = async () => {
    setError(''); 
    setIsDuplicateCard(false);
    setLoading(true);
    try {
      if (!idFile) { setError('Please select your ID card image first'); setLoading(false); return; }
      const data = new FormData();
      data.append('idCard', idFile);
      const res = await axios.post(`${API}/register/upload-id`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { extractedName, extractedUsn, extractedCollege, extractedDepartment, idCardHash, imageUrl } = res.data;
      // Pre-fill form with OCR data - user can still review or adjust these
      setFormData(f => ({
        ...f,
        name: extractedName || f.name,
        usn: extractedUsn || f.usn,
        college: extractedCollege || f.college,
        department: extractedDepartment || f.department || 'AIML',
        idCardHash: idCardHash || f.idCardHash,
        idCardImageUrl: imageUrl || f.idCardImageUrl,
      }));
      setSuccess(`✅ ID scanned! Please review and correct the extracted details below.`);
      setTimeout(() => { setSuccess(''); setStep(2); }, 1200);
    } catch (err) { 
      const errMsg = err.response?.data?.message || 'OCR Error';
      const duplicate = err.response?.data?.isDuplicate || err.response?.data?.isDuplicateUsn || errMsg.toLowerCase().includes('not possible');
      setIsDuplicateCard(!!duplicate);
      setError(errMsg);
      if (duplicate) {
        setIdFile(null);
      }
    }
    finally { setLoading(false); }
  };

  const sendOtp = async () => {
    setError(''); setLoading(true);
    try {
      if (usnError) {
        setError(usnError);
        setLoading(false);
        return;
      }
      const res = await axios.post(`${API}/register/send-otp`, { 
        email: formData.email,
        usn: formData.usn
      });
      if (res.data.devOtp) {
        setOtp(res.data.devOtp);
        setSuccess(res.data.emailSent ? `OTP sent to email! (Dev code: ${res.data.devOtp})` : `OTP generated: ${res.data.devOtp} (Auto-filled)`);
      } else {
        setSuccess(res.data.message || 'OTP sent! Please check your email.');
      }
    }
    catch (err) { setError(err.response?.data?.message || 'Error sending OTP'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setError(''); setLoading(true);
    try { await axios.post(`${API}/register/verify-otp`, { email: formData.email, otp }); setStep(3); }
    catch (err) { setError(err.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const complete = async () => {
    setError('');
    if (!formData.name || !formData.name.trim()) {
      setError('Please review and provide your full name as shown on your ID card.');
      setStep(2);
      return;
    }
    if (usnError) {
      setError(usnError);
      setStep(2);
      return;
    }
    if (!isPasswordValid) {
      setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      return;
    }
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/register/set-password`, formData);
      setSuccess(res.data.message || 'Registration complete! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) { 
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed'); 
    }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f7] flex items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-md">
        {/* Brand Logo & Heading */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <Logo size="lg" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Join your college's student ride-sharing community</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6 px-2">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <button
                type="button"
                onClick={() => { setError(''); setStep(i); }}
                className="flex flex-col items-center space-y-1 focus:outline-none cursor-pointer group"
                title={`Switch to ${s}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < step 
                    ? 'bg-[#00b87c] text-white shadow-xs group-hover:brightness-105' 
                    : i === step 
                    ? 'bg-[#00b87c] text-white shadow-xs ring-4 ring-[#00b87c]/20' 
                    : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] font-medium transition-colors ${i === step ? 'text-[#00a86b] font-bold' : 'text-gray-400 group-hover:text-gray-600'}`}>{s}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${i < step ? 'bg-[#00b87c]' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white border border-gray-100 rounded-[28px] p-8 shadow-xs">
          {error && <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">{error}</div>}
          {success && <div className="mb-5 p-3 rounded-xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs font-semibold">{success}</div>}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Mobile Number</label>
                  {phoneDigits.length === 10 && isPhoneValid ? (
                    <span className="text-[11px] text-[#00a86b] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid Mobile Number
                    </span>
                  ) : phoneDigits.length > 0 ? (
                    <span className={`text-[11px] font-medium ${!/^[6-9]/.test(phoneDigits) ? 'text-amber-600' : 'text-gray-500'}`}>
                      {phoneDigits.length}/10 digits
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">10-digit Indian Mobile</span>
                  )}
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1 text-gray-600 font-semibold text-sm border-r border-gray-200 pr-2.5 pointer-events-none select-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    id="register-phone-input"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className={`w-full pl-20 pr-10 py-3 rounded-xl bg-gray-50 border transition text-sm font-semibold tracking-wide placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 ${
                      isPhoneValid
                        ? 'border-[#00b87c] focus:border-[#00b87c] focus:ring-[#00b87c]'
                        : phoneDigits.length > 0 && !/^[6-9]/.test(phoneDigits)
                        ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500'
                        : 'border-gray-200 focus:border-[#00b87c] focus:ring-[#00b87c]'
                    }`}
                    placeholder="98765 43210"
                    maxLength={10}
                  />
                  {isPhoneValid && (
                    <div className="absolute right-3.5 text-[#00b87c] bg-[#e1f7ec] rounded-full p-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {phoneDigits.length > 0 && !/^[6-9]/.test(phoneDigits) && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium flex items-center gap-1">
                    ⚠️ Mobile number must start with 6, 7, 8, or 9
                  </p>
                )}
                {phoneDigits.length > 0 && phoneDigits.length < 10 && /^[6-9]/.test(phoneDigits) && (
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Enter remaining {10 - phoneDigits.length} digit{10 - phoneDigits.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Campus Gender Safe Matching Toggle */}
              <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="block text-xs font-bold text-gray-900">
                      Campus Commute Category
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Strict Gender-Safe Ride Matching
                    </span>
                  </div>

                  {/* Ladies Switch Toggle */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold transition-colors ${isLadies ? 'text-pink-600' : 'text-gray-400'}`}>
                      🌸 Ladies
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLadies}
                      id="ladies-toggle-switch"
                      onClick={toggleLadies}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isLadies ? 'bg-pink-500 ring-2 ring-pink-300/50' : 'bg-gray-300'
                      }`}
                      title={isLadies ? 'Switch to Gents' : 'Switch to Ladies'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isLadies ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Quick Selection Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="register-ladies-btn"
                    onClick={() => setFormData(f => ({ ...f, gender: 'female' }))}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isLadies
                        ? 'bg-pink-50 border-pink-400 text-pink-700 ring-2 ring-pink-400/20 shadow-xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100/70'
                    }`}
                  >
                    <span>🌸</span>
                    <span>Ladies / Female</span>
                  </button>
                  <button
                    type="button"
                    id="register-gents-btn"
                    onClick={() => setFormData(f => ({ ...f, gender: 'male' }))}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isLadies
                        ? 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-400/20 shadow-xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100/70'
                    }`}
                  >
                    <span>🛡️</span>
                    <span>Gents / Male</span>
                  </button>
                </div>

                {/* Policy Notice */}
                <div
                  className={`mt-2.5 text-[11px] font-medium leading-relaxed p-2.5 rounded-xl border flex items-center gap-2 ${
                    isLadies
                      ? 'bg-pink-50 border-pink-200 text-pink-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <span className="text-sm">{isLadies ? '🌸' : '🛡️'}</span>
                  <span>
                    {isLadies
                      ? 'Safety Guarantee: Girls can only give and take rides from girls.'
                      : 'Safety Guarantee: Boys can only give and take rides from boys.'}
                  </span>
                </div>
              </div>

              <button onClick={step1} disabled={loading} className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 text-sm mt-2 cursor-pointer">
                {loading ? 'Validating...' : 'Continue to ID Upload →'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              {isDuplicateCard && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  <div className="flex items-center gap-2 font-bold text-red-800 text-sm mb-1">
                    <span className="text-base">🚫</span>
                    <span>Registration Not Possible</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {error}
                  </p>
                  <p className="mt-2 text-[11px] text-red-600">
                    Each student must upload their own unique college ID card. If you believe someone else used your ID card by mistake, please contact the campus administrator.
                  </p>
                </div>
              )}
              <label className="block border-2 border-dashed border-gray-200 hover:border-[#00b87c] bg-gray-50 hover:bg-[#e1f7ec]/30 rounded-2xl p-8 text-center transition cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { setIdFile(e.target.files[0]); setError(''); setIsDuplicateCard(false); }} />
                <div className="text-4xl mb-2">🪪</div>
                <p className="text-gray-900 font-bold text-sm">{idFile ? idFile.name : 'Click to Upload College ID Card'}</p>
                <p className="text-gray-500 text-xs mt-1">{idFile ? `${(idFile.size / 1024).toFixed(1)} KB selected` : 'JPG or PNG • Automatic AI OCR Verification'}</p>
              </label>
              <button onClick={step2} disabled={loading} className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 text-sm cursor-pointer">
                {loading ? 'Scanning ID with OCR...' : 'Submit ID Card for Verification'}
              </button>
              <button type="button" onClick={() => setStep(0)} className="w-full py-2.5 rounded-full font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Mobile Number
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs">
                🤖 Details below were auto-extracted from your ID card. Please review and correct if needed.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input name="name" value={formData.name} onChange={handle} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm" placeholder="Your full name as on ID" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">USN</label>
                  {usnChecking ? (
                    <span className="text-[11px] text-gray-400">Checking USN...</span>
                  ) : usnError ? (
                    <span className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                      <span>⚠️</span> Already Registered
                    </span>
                  ) : formData.usn && formData.usn.length >= 3 ? (
                    <span className="text-[11px] text-[#00a86b] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> USN Verified
                    </span>
                  ) : null}
                </div>
                <input 
                  name="usn" 
                  value={formData.usn} 
                  onChange={handleUsnChange} 
                  onBlur={() => checkUsnAvailability(formData.usn)}
                  className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 border text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 transition font-mono tracking-wide text-sm ${
                    usnError 
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500 bg-red-50/30' 
                      : 'border-gray-200 focus:border-[#00b87c] focus:ring-[#00b87c]'
                  }`} 
                  placeholder="e.g. 3BR23AI034" 
                />
                {usnError && (
                  <p className="text-[11px] text-red-600 mt-1.5 font-medium flex items-center gap-1">
                    <span>🚫</span> {usnError}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Course / Department</label>
                  <span className="text-[11px] text-[#00a86b] font-semibold flex items-center gap-1">
                    <span>✨</span>
                    <span>Auto-detected from ID</span>
                  </span>
                </div>
                <input 
                  name="department" 
                  value={formData.department} 
                  onChange={handle} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm font-semibold tracking-wide" 
                  placeholder="e.g. AIML, CSE, EEE, AI" 
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-medium">Quick select:</span>
                  {['AIML', 'CSE', 'EEE', 'ECE', 'AI', 'Civil', 'Mechanical'].map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, department: dept }))}
                      className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold border transition cursor-pointer ${
                        formData.department?.toUpperCase() === dept.toUpperCase()
                          ? 'bg-[#e1f7ec] border-[#98e6c4] text-[#00a86b]'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">College Name</label>
                <input name="college" value={formData.college} onChange={handle} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm" placeholder="Your college name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">College Email</label>
                <input name="email" type="email" value={formData.email} onChange={handle} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm" placeholder="student@college.edu.in" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Campus Commute Category</label>
                <div className={`p-3 rounded-xl border flex items-center justify-between ${isLadies ? 'bg-pink-50/60 border-pink-200' : 'bg-blue-50/60 border-blue-200'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{isLadies ? '🌸' : '🛡️'}</span>
                    <div>
                      <span className={`text-xs font-bold block ${isLadies ? 'text-pink-700' : 'text-blue-700'}`}>
                        {isLadies ? 'Ladies / Female Commuter' : 'Gents / Male Commuter'}
                      </span>
                      <span className="text-[11px] text-gray-500 block">
                        {isLadies ? 'Mapped to female rides & riders only' : 'Mapped to male rides & riders only'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleLadies}
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-xs transition cursor-pointer"
                  >
                    Change to {isLadies ? 'Gents' : 'Ladies'}
                  </button>
                </div>
              </div>
              <button onClick={sendOtp} disabled={loading} className="w-full py-2.5 rounded-xl font-semibold text-[#00a86b] border border-[#98e6c4] bg-[#e1f7ec] hover:bg-[#daf1e8] transition text-xs">
                {loading ? 'Sending...' : '📧 Send Email OTP'}
              </button>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">6-Digit OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-center text-lg tracking-widest font-mono font-bold" placeholder="000000" maxLength={6} />
              </div>
              <button onClick={verifyOtp} disabled={loading} className="w-full py-3 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 text-sm">
                {loading ? 'Verifying...' : 'Verify OTP & Continue →'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full py-2 rounded-full font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-xs flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to ID Card Upload
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-10 h-10 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center mx-auto mb-2 shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Set Account Password</h3>
                <p className="text-gray-500 text-xs mt-0.5">Create a strong, secure password for your student account</p>
              </div>

              {/* Password Input with Show/Hide Toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handle}
                    className="w-full pl-4 pr-11 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                    placeholder="Enter a secure password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Live Password Strength Meter & 5-rule criteria */}
              <PasswordStrengthMeter
                password={formData.password}
                confirmPassword={confirmPassword}
                showChecklist={true}
                showStrengthBar={true}
                showMatchStatus={false}
              />

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                    {passwordsMatch ? (
                      <span className="text-[#00a86b] font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-rose-500 font-medium flex items-center gap-1">
                        <X className="w-3.5 h-3.5" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={complete}
                disabled={loading || !isPasswordValid || !passwordsMatch}
                className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs text-sm mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Securing Account...</span>
                  </>
                ) : (
                  <span>🎉 Complete Registration</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-full font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-xs flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Verification Details
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00a86b] hover:underline font-semibold">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
