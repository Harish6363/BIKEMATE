import React, { useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { User, CheckCircle2, ShieldCheck, Edit3, Check, Lock, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/PasswordStrengthMeter';

export default function Profile() {
  const { user, login } = useContext(AuthContext);

  // Real authenticated user profile state
  const [fullName, setFullName] = useState(user?.name || '');
  const [usn, setUsn] = useState(user?.usn || '');
  const [collegeName, setCollegeName] = useState(
    user?.college || 'Ballari Institute of Technology and Management'
  );
  const [department, setDepartment] = useState(
    user?.department || ''
  );
  const [phone, setPhone] = useState(user?.phone || '');

  // Keep in sync with user context
  useEffect(() => {
    if (user) {
      if (user.name) setFullName(user.name);
      if (user.usn) setUsn(user.usn);
      if (user.college) setCollegeName(user.college);
      if (user.department) setDepartment(user.department);
      if (user.phone) setPhone(user.phone);
    }
  }, [user]);

  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const { isValid: isNewPasswordValid } = getPasswordStrength(newPassword);
  const newPasswordsMatch = newPassword.length > 0 && newPassword === confirmNewPassword;

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put('http://localhost:5000/api/auth/profile', {
        name: fullName,
        usn,
        college: collegeName,
        department,
        phone
      });
      if (res.data?.user && login) {
        login(localStorage.getItem('token'), res.data.user);
      }
    } catch (err) {
      console.warn('Profile update warning:', err.response?.data?.message || err.message);
    }
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!isNewPasswordValid) {
      setPwdError('New password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPwdError('New passwords do not match. Please re-enter.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/change-password', {
        phone: phone || user?.phone,
        currentPassword,
        newPassword
      });
      setPwdSuccess(res.data?.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPwdSuccess(''), 4000);
    } catch (err) {
      setPwdError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-w-3xl">
        <h2 className="text-2xl font-bold text-gray-900">Profile Details</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5"
        >
          <Edit3 className="w-3.5 h-3.5 text-gray-500" />
          <span>{isEditing ? 'Cancel Edit' : 'Edit Details'}</span>
        </button>
      </div>

      {saved && (
        <div className="max-w-3xl p-3.5 rounded-2xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Profile credentials updated successfully.</span>
        </div>
      )}

      {/* Main Profile Card matching Screenshot 5 */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-xs p-8 max-w-3xl">
        {/* User Avatar & Name Header */}
        <div className="flex items-center gap-5 pb-8 border-b border-gray-100">
          <div className="w-16 h-16 rounded-full bg-[#e0f8ee] flex items-center justify-center text-[#00b87c] shrink-0 shadow-xs">
            <User className="w-8 h-8 stroke-[1.8]" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-900">{fullName}</h3>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="inline-block px-3 py-1 rounded-full bg-[#e0f8ee] text-[#00a86b] text-xs font-semibold">
                BITM Verified Member
              </span>
              {user?.gender === 'female' ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-semibold border border-pink-200">
                  <span>🌸</span>
                  <span>Ladies Commuter (Girls only)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                  <span>🛡️</span>
                  <span>Gents Commuter (Boys only)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Attributes Table */}
        {isEditing ? (
          <form onSubmit={handleSave} className="pt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                {(user?.role === 'faculty' || user?.userType === 'faculty') ? 'Employee ID (Faculty / Staff)' : 'USN (Student ID)'}
              </label>
              <input
                type="text"
                value={usn}
                onChange={(e) => setUsn(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Course / Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white text-sm font-semibold shadow-xs transition"
              >
                Save Profile
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">Full Name</span>
              <span className="text-sm font-bold text-gray-900">{fullName}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">
                {(user?.role === 'faculty' || user?.userType === 'faculty') ? 'Employee ID (Faculty / Staff)' : 'USN (Student ID)'}
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono tracking-wide">{user?.employeeId || usn}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">College Name</span>
              <span className="text-sm font-bold text-gray-900 text-left sm:text-right">{collegeName}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">
                {(user?.role === 'faculty' || user?.userType === 'faculty') ? 'Branch / Department' : 'Course / Department'}
              </span>
              <span className="text-sm font-bold text-gray-900 text-left sm:text-right">{department}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">Phone Number</span>
              <span className="text-sm font-bold text-gray-900 font-mono">{phone}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">Commute Category</span>
              {(user?.role === 'faculty' || user?.userType === 'faculty') ? (
                <span className="text-sm font-bold text-purple-700 flex items-center gap-1.5">
                  <span>✨ Faculty Commute (Any boy or girl can pick up)</span>
                </span>
              ) : (
                <span className={`text-sm font-bold flex items-center gap-1.5 ${user?.gender === 'female' ? 'text-pink-700' : 'text-blue-700'}`}>
                  {user?.gender === 'female' ? '🌸 Ladies (Girls ↔ Girls Only)' : '🛡️ Gents (Boys ↔ Boys Only)'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
              <span className="text-sm font-medium text-gray-600">Verification Status</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00a86b]">
                <CheckCircle2 className="w-4 h-4 text-[#00a86b]" />
                <span>
                  {(user?.role === 'faculty' || user?.userType === 'faculty') 
                    ? 'Verified BITM Faculty / Staff' 
                    : 'Verified BITM Student'}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Security & Password Card */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-xs p-8 max-w-3xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e1f7ec] text-[#00a86b] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Account Security & Password</h3>
              <p className="text-gray-500 text-xs mt-0.5">Manage your password with strong security criteria</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPasswordSection(!showPasswordSection);
              setPwdError('');
              setPwdSuccess('');
            }}
            className="text-xs font-semibold px-4 py-2 rounded-full border border-gray-200 hover:border-[#00b87c] text-gray-700 hover:text-[#00a86b] hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{showPasswordSection ? 'Hide Form' : 'Change Password'}</span>
          </button>
        </div>

        {pwdSuccess && (
          <div className="mt-4 p-3.5 rounded-2xl bg-[#e1f7ec] border border-[#98e6c4] text-[#00a86b] text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{pwdSuccess}</span>
          </div>
        )}

        {pwdError && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pwdError}</span>
          </div>
        )}

        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="pt-6 space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showCurrent ? 'Hide' : 'Show'}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
                  placeholder="Create new strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showNew ? 'Hide' : 'Show'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Password Strength Meter */}
            <PasswordStrengthMeter
              password={newPassword}
              confirmPassword={confirmNewPassword}
              showChecklist={true}
              showStrengthBar={true}
              showMatchStatus={false}
            />

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#00b87c]"
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showConfirm ? 'Hide' : 'Show'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmNewPassword && (
                <div className="mt-1.5 text-xs">
                  {newPasswordsMatch ? (
                    <span className="text-[#00a86b] font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasswordSection(false)}
                className="px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pwdLoading || !isNewPasswordValid || !newPasswordsMatch}
                className="px-6 py-2 rounded-full bg-[#00b87c] hover:bg-[#00a36e] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                {pwdLoading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
