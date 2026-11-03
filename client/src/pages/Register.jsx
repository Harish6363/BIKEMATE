import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowLeft, 
  GraduationCap, 
  Briefcase, 
  Sparkles, 
  Building,
  RotateCcw
} from 'lucide-react';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/PasswordStrengthMeter';
import Logo from '../components/Logo';

const steps = ['Mobile', 'ID Card', 'Email OTP', 'Password'];

// Clean and extract up to 10 digits for Indian mobile numbers
const cleanMobileDigits = (val) => (val || '').toString().replace(/\D/g, '').slice(0, 10);
// Check if valid Indian 10-digit mobile number starting with 6, 7, 8, or 9
const isValidIndianMobile = (val) => /^[6-9]\d{9}$/.test(cleanMobileDigits(val));

function Register() {
  const [searchParams] = useSearchParams();
  const initialRoleParam = searchParams.get('type') || searchParams.get('role');
  
  // Account type: 'student' or 'faculty' (or empty string if not yet chosen)
  const [userType, setUserType] = useState(
    initialRoleParam === 'faculty' || initialRoleParam === 'teacher' ? 'faculty' :
    initialRoleParam === 'student' ? 'student' : ''
  );

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ 
    name: '', 
    usn: '', 
    employeeId: '',
    userType: 'student',
    college: 'Ballari Institute of Technology and Management', 
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
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [isDuplicateCard, setIsDuplicateCard] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  
  // Real-time USN / Employee ID checks
  const [usnChecking, setUsnChecking] = useState(false);
  const [usnError, setUsnError] = useState('');
  const [empChecking, setEmpChecking] = useState(false);
  const [empError, setEmpError] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown(c => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const navigate = useNavigate();
  const API = 'http://localhost:5000/api/auth';

  const isFaculty = userType === 'faculty';

  // Password criteria evaluation
  const password = formData.password || '';
  const { criteria: passwordCriteria, metCount, isValid: isPasswordValid } = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

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
    if (/[^0-9]/.test(val)) {
      return {
        isValid: false,
        borderClass: 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/20',
        message: 'Error message: Phone number must contain only digits.',
        type: 'error'
      };
    }
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
        message: 'Please enter a valid phone number (must start with 6, 7, 8, or 9).',
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

  const phoneValidation = getPhoneValidation(formData.phone);

  const handle = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePhoneChange = (e) => {
    setFormData(f => ({ ...f, phone: e.target.value }));
    setPhoneTouched(true);
    if (error) setError('');
  };

  const handleUsnChange = (e) => {
    const raw = e.target.value.toUpperCase();
    setFormData(f => ({ ...f, usn: raw }));
    setUsnError('');
    if (error) setError('');
  };

  const handleEmployeeIdChange = (e) => {
    const raw = e.target.value.toUpperCase();
    setFormData(f => ({ ...f, employeeId: raw }));
    setEmpError('');
    if (error) setError('');
  };

  const checkUsnAvailability = async (usnToCheck) => {
    const val = (usnToCheck || formData.usn || '').trim();
    if (!val || val.length < 3) return;
    setUsnChecking(true);
    try {
      const res = await axios.post(`${API}/register/check-usn`, { 
        usn: val, 
        phone: formData.phone 
      });
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

  const checkEmployeeIdAvailability = async (empToCheck) => {
    const val = (empToCheck || formData.employeeId || '').trim();
    if (!val || val.length < 2) return;
    setEmpChecking(true);
    try {
      const res = await axios.get(`${API}/register/check-employee-id/${encodeURIComponent(val)}`);
      if (res.data?.exists) {
        setEmpError(res.data.message || `Not possible: Employee ID ${val} is already registered.`);
      } else {
        setEmpError('');
      }
    } catch (e) {
      console.warn('Employee ID check warning:', e.message);
    } finally {
      setEmpChecking(false);
    }
  };

  const isLadies = formData.gender === 'female';
  const toggleLadies = () => {
    setFormData(f => ({ ...f, gender: f.gender === 'female' ? 'male' : 'female' }));
  };

  const chooseAccountType = (type) => {
    setUserType(type);
    setFormData(f => ({
      ...f,
      userType: type,
      department: type === 'faculty' ? 'Computer Science' : 'AIML'
    }));
    setStep(0);
    setError('');
  };

  const step1 = async () => {
    setError('');
    const val = (formData.phone || '').trim();
    if (!phoneValidation.isValid) {
      setPhoneTouched(true);
      setError(phoneValidation.message);
      return;
    }
    setLoading(true);
    try { 
      const res = await axios.post(`${API}/register/step1`, { 
        phone: val, 
        userType 
      }); 

      if (res.data?.student) {
        setVerifiedStudent(res.data.student);
        setFormData(f => ({ 
          ...f, 
          phone: val, 
          userType,
          name: res.data.student.name || f.name,
          usn: res.data.student.usn || f.usn,
          college: res.data.student.college || f.college,
          department: res.data.student.department || f.department
        }));
        setSuccess(`✅ Record verified in database! Welcome ${res.data.student.name} (${res.data.student.usn})`);
        setTimeout(() => { setSuccess(''); setStep(1); }, 1000);
      } else {
        setFormData(f => ({ ...f, phone: val, userType }));
        setStep(1); 
      }
    }
    catch (err) { 
      setError(err.response?.data?.message || 'Error validating mobile number in database'); 
    }
    finally { setLoading(false); }
  };

  const step2 = async () => {
    setError(''); 
    setIsDuplicateCard(false);
    setLoading(true);
    try {
      if (!idFile) { 
        setError(`Please select your ${isFaculty ? 'faculty/staff' : 'student'} ID card image first`); 
        setLoading(false); 
        return; 
      }
      const data = new FormData();
      data.append('idCard', idFile);
      data.append('userType', userType);
      data.append('phone', formData.phone);

      const res = await axios.post(`${API}/register/upload-id`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { 
        extractedName, 
        extractedUsn, 
        extractedEmployeeId, 
        extractedCollege, 
        extractedDepartment, 
        idCardHash, 
        imageUrl 
      } = res.data;

      // Pre-fill form with extracted OCR data
      setFormData(f => ({
        ...f,
        userType,
        name: extractedName || f.name,
        usn: extractedUsn || f.usn,
        employeeId: extractedEmployeeId || f.employeeId || (isFaculty ? extractedUsn : ''),
        college: extractedCollege || f.college || 'Ballari Institute of Technology and Management',
        department: extractedDepartment || f.department || (isFaculty ? 'Computer Science' : 'AIML'),
        idCardHash: idCardHash || f.idCardHash,
        idCardImageUrl: imageUrl || f.idCardImageUrl,
      }));

      setSuccess(`✅ ${isFaculty ? 'Faculty' : 'Student'} ID scanned! Please review and verify extracted details below.`);
      setTimeout(() => { setSuccess(''); setOtp(''); setStep(2); }, 1200);
    } catch (err) { 
      const errMsg = err.response?.data?.message || 'OCR Error';
      const duplicate = err.response?.data?.isDuplicate || err.response?.data?.isDuplicateUsn || err.response?.data?.isDuplicateEmployeeId || errMsg.toLowerCase().includes('not possible');
      setIsDuplicateCard(!!duplicate);
      setError(errMsg);
      if (duplicate) {
        setIdFile(null);
      }
    }
    finally { setLoading(false); }
  };

  const sendOtp = async () => {
    if (otpCooldown > 0) return;
    setError(''); 
    setSuccess('');
    setLoading(true);
    try {
      if (isFaculty && empError) {
        setError(empError);
        setLoading(false);
        return;
      }
      if (!isFaculty && usnError) {
        setError(usnError);
        setLoading(false);
        return;
      }
      if (!formData.email || !formData.email.trim()) {
        setError('Please enter your college email address before requesting OTP.');
        setLoading(false);
        return;
      }

      const cleanEmail = formData.email.trim().replace(/[\s\u200B-\u200D\uFEFF]/g, '');

      // Strict validation: must end with @bitm.edu.in (case-insensitive check)
      if (!cleanEmail.toLowerCase().endsWith('@bitm.edu.in')) {
        setError('Invalid college email ID. Only official college email addresses ending with @bitm.edu.in are allowed.');
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API}/register/send-otp`, { 
        email: cleanEmail,
        usn: formData.usn,
        employeeId: formData.employeeId,
        name: formData.name,
        userType
      });

      // Clear the OTP entry field so user must manually type the code received in email
      setOtp('');
      setOtpCooldown(15); // 15s cooldown to prevent accidental double clicks
      setSuccess(res.data.message || `Verification code sent to ${cleanEmail} (valid for 5 minutes)!`);
    }
    catch (err) { 
      setError(err.response?.data?.message || 'Error generating or sending OTP. Please check your email address.'); 
    }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setError(''); 
    setSuccess('');
    const cleanOtp = (otp || '').replace(/\D/g, '').trim();
    const cleanEmail = (formData.email || '').trim().replace(/[\s\u200B-\u200D\uFEFF]/g, '');

    if (!cleanEmail) {
      setError('Email address is missing. Please enter your college email.');
      return;
    }
    if (!cleanEmail.toLowerCase().endsWith('@bitm.edu.in')) {
      setError('Invalid college email ID. Only official college email addresses ending with @bitm.edu.in are allowed.');
      return;
    }
    if (!cleanOtp) {
      setError('Please enter the 6-digit OTP code sent to your email.');
      return;
    }
    if (cleanOtp.length !== 6) {
      setError(`OTP must be exactly 6 digits (currently ${cleanOtp.length}/6 digits entered).`);
      return;
    }

    setLoading(true);
    try { 
      const res = await axios.post(`${API}/register/verify-otp`, { 
        email: cleanEmail, 
        otp: cleanOtp 
      }); 
      setSuccess(res.data.message || '✓ Email verified successfully!');
      setTimeout(() => {
        setSuccess('');
        setStep(3);
      }, 700);
    }
    catch (err) { 
      setError(err.response?.data?.message || 'Incorrect OTP. The code you entered is invalid. Please check your email and try again.'); 
    }
    finally { setLoading(false); }
  };

  const complete = async () => {
    setError('');
    if (!formData.name || !formData.name.trim()) {
      setError('Please review and provide your full name as shown on your ID card.');
      setStep(2);
      return;
    }
    if (isFaculty && !formData.employeeId?.trim()) {
      setError('Please enter your valid Faculty / Employee ID.');
      setStep(2);
      return;
    }
    if (isFaculty && empError) {
      setError(empError);
      setStep(2);
      return;
    }
    if (!isFaculty && !formData.usn?.trim()) {
      setError('Please enter your valid Student USN.');
      setStep(2);
      return;
    }
    if (!isFaculty && usnError) {
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
      const payload = {
        ...formData,
        userType,
        role: isFaculty ? 'faculty' : 'student'
      };
      const res = await axios.post(`${API}/register/set-password`, payload);
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
          <p className="text-gray-500 text-sm mt-1">
            {userType === 'faculty' 
              ? 'Join as college teacher / staff member' 
              : userType === 'student'
              ? "Join your college's student ride-sharing community"
              : 'Choose your campus account type to get started'}
          </p>
        </div>

        {/* STEP 0: Ask Student or Faculty Selection */}
        {!userType ? (
          <div className="bg-white border border-gray-100 rounded-[28px] p-7 shadow-xs space-y-6">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e1f7ec] text-[#00a86b] text-xs font-bold border border-[#98e6c4]">
                <Sparkles className="w-3.5 h-3.5" /> Select Account Type
              </span>
              <h2 className="text-lg font-bold text-gray-900 pt-2">Are you a Student or Faculty?</h2>
              <p className="text-xs text-gray-500">Please choose how you will be commuting on campus</p>
            </div>

            <div className="space-y-3.5">
              {/* Option 1: Student Commuter */}
              <button
                type="button"
                id="register-select-student-btn"
                onClick={() => chooseAccountType('student')}
                className="w-full text-left p-5 rounded-2xl border-2 border-gray-200 hover:border-[#00b87c] hover:bg-[#e1f7ec]/20 transition-all duration-200 group flex items-start gap-4 cursor-pointer hover:shadow-xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900 group-hover:text-[#00a86b] transition-colors">
                      🎓 Student Commuter
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400 group-hover:text-[#00b87c]">
                      Select →
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    For college students. Requires student ID card and college <strong>USN</strong>.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      Has Student USN
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200">
                      Girls ↔ Girls / Boys ↔ Boys
                    </span>
                  </div>
                </div>
              </button>

              {/* Option 2: Teacher / Faculty Staff */}
              <button
                type="button"
                id="register-select-faculty-btn"
                onClick={() => chooseAccountType('faculty')}
                className="w-full text-left p-5 rounded-2xl border-2 border-gray-200 hover:border-[#00b87c] hover:bg-[#e1f7ec]/20 transition-all duration-200 group flex items-start gap-4 cursor-pointer hover:shadow-xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900 group-hover:text-[#00a86b] transition-colors">
                      👨‍🏫 Teacher / Faculty Staff
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400 group-hover:text-[#00b87c]">
                      Select →
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    For professors, lecturers & staff. Uses <strong>Employee ID</strong> (no USN required).
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                      Employee ID / Staff Card
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300">
                      ✨ Any Boy or Girl Can Pick Up Faculty
                    </span>
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-2 text-center">
              <p className="text-xs text-gray-400">
                You can change this anytime before submitting registration.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Active Role Indicator Pill with Switch Button */}
            <div className="mb-4 flex items-center justify-between px-3 py-2 rounded-2xl bg-white border border-gray-100 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-base">{isFaculty ? '👨‍🏫' : '🎓'}</span>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    {isFaculty ? 'Teacher / Faculty Staff' : 'Student Commuter'}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {isFaculty ? 'Employee ID • Any driver can pick up' : 'Student USN • Gender-Safe'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserType('')}
                className="text-xs font-semibold text-[#00a86b] hover:text-[#008f5a] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
                title="Switch between Student and Faculty"
              >
                <RotateCcw className="w-3 h-3" /> Change
              </button>
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

              {/* STEP 1: MOBILE & COMMUTE PREFERENCE */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700">Mobile Number</label>
                      <span className={`text-[11px] font-medium transition-colors ${
                        phoneValidation.type === 'error' ? 'text-red-600 font-semibold' :
                        phoneValidation.type === 'success' ? 'text-[#00a86b] font-bold' :
                        'text-gray-400'
                      }`}>
                        {phoneValidation.message}
                      </span>
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
                        onBlur={() => setPhoneTouched(true)}
                        onChange={handlePhoneChange}
                        className={`w-full pl-20 pr-10 py-3 rounded-xl bg-gray-50 border transition text-sm font-semibold tracking-wide placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 ${phoneValidation.borderClass}`}
                        placeholder="98765 43210"
                        maxLength={10}
                      />
                      {phoneValidation.isValid && (
                        <div className="absolute right-3.5 text-[#00b87c] bg-[#e1f7ec] rounded-full p-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    {phoneValidation.type === 'error' && (
                      <p className="text-[11px] text-red-600 mt-1.5 font-medium flex items-center gap-1">
                        ⚠️ {phoneValidation.message}
                      </p>
                    )}
                    {phoneValidation.type === 'helper' && phoneTouched && (
                      <p className="text-[11px] text-red-500 mt-1.5 font-medium">
                        Please enter a valid phone number.
                      </p>
                    )}
                  </div>

                  {/* Gender / Commute Selection */}
                  <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="block text-xs font-bold text-gray-900">
                          {isFaculty ? 'Gender' : 'Campus Commute Category'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {isFaculty ? 'Staff Profile Details' : 'Strict Gender-Safe Ride Matching'}
                        </span>
                      </div>

                      {/* Switch Toggle */}
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
                        <span>Female / Ladies</span>
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
                        <span>Male / Gents</span>
                      </button>
                    </div>

                    {/* Policy Notice: Faculty vs Student */}
                    <div
                      className={`mt-2.5 text-[11px] font-medium leading-relaxed p-2.5 rounded-xl border flex items-center gap-2 ${
                        isFaculty
                          ? 'bg-purple-50 border-purple-200 text-purple-900'
                          : isLadies
                          ? 'bg-pink-50 border-pink-200 text-pink-800'
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}
                    >
                      <span className="text-sm">{isFaculty ? '✨' : isLadies ? '🌸' : '🛡️'}</span>
                      <span>
                        {isFaculty
                          ? 'Faculty Access Guarantee: Any student driver (boy or girl) can pick you up for a ride.'
                          : isLadies
                          ? 'Safety Guarantee: Girls can only give and take rides from girls.'
                          : 'Safety Guarantee: Boys can only give and take rides from boys.'}
                      </span>
                    </div>
                  </div>

                  {/* College Records Verification Notice */}
                  <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                    <span className="text-base shrink-0">🏛️</span>
                    <div className="space-y-0.5">
                      <span className="font-bold block text-[11px]">Database Record Verification Active</span>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        Registration is restricted to authorized students. Your mobile number must match official college records in the database.
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={step1} 
                    disabled={loading || !phoneValidation.isValid} 
                    className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed text-sm mt-2 cursor-pointer"
                  >
                    {loading ? 'Verifying with Database...' : 'Continue to ID Upload →'}
                  </button>
                </div>
              )}

              {/* STEP 2: ID CARD UPLOAD & OCR */}
              {step === 1 && (
                <div className="space-y-5">
                  {verifiedStudent && (
                    <div className="p-3.5 rounded-2xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#00b87c] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          ✓
                        </div>
                        <div>
                          <span className="font-bold text-xs block text-gray-900">
                            College Record: {verifiedStudent.name}
                          </span>
                          <span className="text-[11px] text-[#008f5a] font-mono">
                            USN: {verifiedStudent.usn} • {verifiedStudent.department || 'AIML'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-[#98e6c4] text-[#00a86b]">
                        Matched In DB
                      </span>
                    </div>
                  )}

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
                        Each {isFaculty ? 'faculty member' : 'student'} must upload their own unique ID card.
                      </p>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>🤖</span>
                      <span>AI ID Card Scanner ({isFaculty ? 'Faculty Staff' : 'Student'})</span>
                    </p>
                    <p className="text-[11px] text-[#008f5a]">
                      {isFaculty
                        ? 'Will automatically extract your Name, Branch / Department, and Employee ID.'
                        : 'Will automatically extract your Name, Course / Branch, and Student USN.'}
                    </p>
                  </div>

                  <label className="block border-2 border-dashed border-gray-200 hover:border-[#00b87c] bg-gray-50 hover:bg-[#e1f7ec]/30 rounded-2xl p-8 text-center transition cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => { setIdFile(e.target.files[0]); setError(''); setIsDuplicateCard(false); }} 
                    />
                    <div className="text-4xl mb-2">{isFaculty ? '🪪' : '🎓'}</div>
                    <p className="text-gray-900 font-bold text-sm">
                      {idFile ? idFile.name : `Click to Upload ${isFaculty ? 'Teacher / Faculty Staff ID Card' : 'College Student ID Card'}`}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {idFile ? `${(idFile.size / 1024).toFixed(1)} KB selected` : 'JPG or PNG • Automatic AI OCR Extraction'}
                    </p>
                  </label>

                  <button 
                    onClick={step2} 
                    disabled={loading} 
                    className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 text-sm cursor-pointer"
                  >
                    {loading ? 'Scanning ID with AI OCR...' : `Submit ${isFaculty ? 'Faculty' : 'Student'} ID for Verification`}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setStep(0)} 
                    className="w-full py-2.5 rounded-full font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Mobile Number
                  </button>
                </div>
              )}

              {/* STEP 3: REVIEW EXTRACTED DETAILS & EMAIL OTP */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs">
                    🤖 Details below were auto-extracted from your {isFaculty ? 'Faculty' : 'Student'} ID card. Please review and correct if needed.
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Full Name {isFaculty ? '(Teacher / Staff)' : '(Student)'}
                    </label>
                    <input 
                      name="name" 
                      value={formData.name} 
                      onChange={handle} 
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm font-semibold" 
                      placeholder="Your full name as on ID" 
                    />
                  </div>

                  {/* Faculty: Employee ID / Staff ID (No USN) */}
                  {isFaculty ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-gray-700">
                          Employee ID / Staff ID
                        </label>
                        {empChecking ? (
                          <span className="text-[11px] text-gray-400">Checking ID...</span>
                        ) : empError ? (
                          <span className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                            <span>⚠️</span> Already Registered
                          </span>
                        ) : formData.employeeId && formData.employeeId.length >= 2 ? (
                          <span className="text-[11px] text-[#00a86b] font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Employee ID Verified
                          </span>
                        ) : null}
                      </div>
                      <input 
                        name="employeeId" 
                        value={formData.employeeId} 
                        onChange={handleEmployeeIdChange} 
                        onBlur={() => checkEmployeeIdAvailability(formData.employeeId)}
                        className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 border text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 transition font-mono tracking-wide text-sm font-bold ${
                          empError 
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500 bg-red-50/30' 
                            : 'border-gray-200 focus:border-[#00b87c] focus:ring-[#00b87c]'
                        }`} 
                        placeholder="e.g. EMP1024 or BITM-CS-04" 
                      />
                      {empError && (
                        <p className="text-[11px] text-red-600 mt-1.5 font-medium flex items-center gap-1">
                          <span>🚫</span> {empError}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Student: USN */
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Student USN</label>
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
                        className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 border text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 transition font-mono tracking-wide text-sm font-bold ${
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
                  )}

                  {/* Branch / Department */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700">
                        {isFaculty ? 'Branch / Department' : 'Course / Department'}
                      </label>
                      <span className="text-[11px] text-[#00a86b] font-semibold flex items-center gap-1">
                        <span>✨</span>
                        <span>Auto-extracted from ID</span>
                      </span>
                    </div>
                    <input 
                      name="department" 
                      value={formData.department} 
                      onChange={handle} 
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm font-semibold tracking-wide" 
                      placeholder={isFaculty ? 'e.g. Computer Science, AIML, Mechanical' : 'e.g. AIML, CSE, EEE, AI'} 
                    />
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-medium">Quick select:</span>
                      {['AIML', 'CSE', 'EEE', 'ECE', 'AI', 'Civil', 'Mechanical', 'MBA'].map((dept) => (
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

                  {/* College Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">College Name</label>
                    <input 
                      name="college" 
                      value={formData.college} 
                      onChange={handle} 
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-sm" 
                      placeholder="Your college or institution" 
                    />
                  </div>

                  {/* Email with Step 4 Real-time Domain Validation */}
                  {(() => {
                    const enteredEmail = (formData.email || '').trim().toLowerCase();
                    const isBitmEmail = enteredEmail.endsWith('@bitm.edu.in');
                    const hasOtherDomain = enteredEmail.includes('@') && !isBitmEmail;

                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-gray-700">
                            {isFaculty ? 'College / Institutional Email' : 'College Email'}
                          </label>
                          {isBitmEmail ? (
                            <span className="text-[11px] text-[#00a86b] font-bold flex items-center gap-1 animate-fadeIn">
                              <span>✓</span> Official @bitm.edu.in
                            </span>
                          ) : hasOtherDomain ? (
                            <span className="text-[11px] text-red-600 font-semibold flex items-center gap-1 animate-fadeIn">
                              <span>⚠️</span> Must end with @bitm.edu.in
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-medium">
                              Must end with @bitm.edu.in
                            </span>
                          )}
                        </div>
                        <input 
                          name="email" 
                          type="email" 
                          value={formData.email} 
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
                            setFormData(f => ({ ...f, email: clean }));
                            if (error) setError('');
                          }} 
                          className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 border text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 transition text-sm ${
                            isBitmEmail
                              ? 'border-[#00b87c] focus:border-[#00b87c] focus:ring-[#00b87c] bg-emerald-50/20'
                              : hasOtherDomain
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                              : 'border-gray-200 focus:border-[#00b87c] focus:ring-[#00b87c]'
                          }`} 
                          placeholder={isFaculty ? 'faculty@bitm.edu.in' : 'student@bitm.edu.in'} 
                        />
                        {hasOtherDomain && (
                          <p className="text-[11px] text-red-600 mt-1.5 font-medium flex items-center gap-1">
                            <span>🚫</span> Invalid college email ID. Only official college email addresses ending with <strong>@bitm.edu.in</strong> are allowed.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Ride Privilege Note for Faculty */}
                  {isFaculty && (
                    <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
                      <span className="text-base">🌟</span>
                      <div>
                        <span className="font-bold block">Faculty Ride Sharing Privilege</span>
                        <span className="text-[11px] text-purple-700">Any boy or girl student driver travelling on your route corridor can accept and pick you up for a ride.</span>
                      </div>
                    </div>
                  )}

                  {/* Send Email OTP with Cooldown */}
                  <button 
                    type="button"
                    onClick={sendOtp} 
                    disabled={loading || otpCooldown > 0} 
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 ${
                      otpCooldown > 0
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : 'text-[#00a86b] border border-[#98e6c4] bg-[#e1f7ec] hover:bg-[#daf1e8] cursor-pointer'
                    }`}
                  >
                    <span>📧</span>
                    <span>
                      {loading 
                        ? 'Sending code...' 
                        : otpCooldown > 0 
                        ? `Resend OTP in ${otpCooldown}s` 
                        : 'Send Verification OTP to Email (Valid for 5 mins)'}
                    </span>
                  </button>

                  {/* Office 365 / Outlook Delivery Tip */}
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                    <span className="text-base leading-none">📬</span>
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold block text-blue-950">Where to find your OTP email:</span>
                      In college Outlook / Office 365, please check your <strong>Inbox</strong>, <strong>"Other" tab</strong>, and <strong>Junk Email</strong> folder.
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700">Enter 6-Digit Email OTP</label>
                      <span className="text-[11px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        ⏰ Valid for 5 minutes only
                      </span>
                    </div>
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      value={otp} 
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                        if (error) setError('');
                      }} 
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-[#00b87c] focus:bg-white focus:ring-1 focus:ring-[#00b87c] transition text-center text-xl tracking-[0.4em] font-mono font-black" 
                      placeholder="" 
                      maxLength={6} 
                    />
                    <p className="text-[11px] text-gray-400 mt-1 text-center">
                      Type the 6-digit code received on {formData.email || 'your @bitm.edu.in email'} (expires in 5 minutes)
                    </p>
                  </div>

                  <button 
                    type="button"
                    onClick={verifyOtp} 
                    disabled={loading || otp.length !== 6} 
                    className="w-full py-3 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition shadow-xs disabled:opacity-50 text-sm cursor-pointer"
                  >
                    {loading ? 'Verifying OTP...' : 'Verify OTP & Continue →'}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="w-full py-2 rounded-full font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to ID Card Upload
                  </button>
                </div>
              )}

              {/* STEP 4: SET ACCOUNT PASSWORD */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="text-center pb-1">
                    <div className="w-10 h-10 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center mx-auto mb-2 shadow-xs">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Set Account Password</h3>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Create a strong password for your {isFaculty ? 'faculty' : 'student'} account
                    </p>
                  </div>

                  {/* Password Input */}
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
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Live Password Strength Meter */}
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
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
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
                    className="w-full py-3.5 rounded-full font-semibold text-white bg-[#00b87c] hover:bg-[#00a36e] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs text-sm mt-2 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Securing Account...</span>
                      </>
                    ) : (
                      <span>🎉 Complete {isFaculty ? 'Faculty' : 'Student'} Registration</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full py-2.5 rounded-full font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Verification Details
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00a86b] hover:underline font-semibold">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
