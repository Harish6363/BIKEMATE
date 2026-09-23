import React from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';

export const evaluatePasswordCriteria = (password = '') => {
  return [
    {
      id: 'length',
      label: 'At least 8 characters',
      detail: '8+ chars',
      met: password.length >= 8,
    },
    {
      id: 'upper',
      label: 'At least one uppercase letter (A-Z)',
      detail: 'A-Z',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lower',
      label: 'At least one lowercase letter (a-z)',
      detail: 'a-z',
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'At least one number (0-9)',
      detail: '0-9',
      met: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&* etc.)',
      detail: '!@#$',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
};

export const getPasswordStrength = (password = '') => {
  const criteria = evaluatePasswordCriteria(password);
  const metCount = criteria.filter((c) => c.met).length;
  const isValid = metCount === 5;

  let label = 'Enter password';
  let badgeBg = 'bg-gray-100';
  let badgeText = 'text-gray-500';
  let barColor = 'bg-gray-200';
  let percent = 0;

  if (password.length > 0) {
    if (metCount === 1) {
      label = 'Very Weak';
      badgeBg = 'bg-rose-50';
      badgeText = 'text-rose-600';
      barColor = 'bg-rose-500';
      percent = 20;
    } else if (metCount === 2) {
      label = 'Weak';
      badgeBg = 'bg-rose-50';
      badgeText = 'text-rose-500';
      barColor = 'bg-rose-400';
      percent = 40;
    } else if (metCount === 3) {
      label = 'Moderate';
      badgeBg = 'bg-amber-50';
      badgeText = 'text-amber-600';
      barColor = 'bg-amber-400';
      percent = 60;
    } else if (metCount === 4) {
      label = 'Good';
      badgeBg = 'bg-emerald-50';
      badgeText = 'text-emerald-600';
      barColor = 'bg-emerald-500';
      percent = 80;
    } else if (metCount === 5) {
      label = 'Strong & Secure';
      badgeBg = 'bg-[#e1f7ec]';
      badgeText = 'text-[#00a86b]';
      barColor = 'bg-[#00b87c]';
      percent = 100;
    }
  }

  return { criteria, metCount, isValid, label, badgeBg, badgeText, barColor, percent };
};

export default function PasswordStrengthMeter({
  password = '',
  confirmPassword = null,
  showChecklist = true,
  showStrengthBar = true,
  showMatchStatus = true,
}) {
  const { criteria, metCount, isValid, label, badgeBg, badgeText, barColor } =
    getPasswordStrength(password);

  const passwordsMatch =
    confirmPassword !== null &&
    confirmPassword.length > 0 &&
    password.length > 0 &&
    password === confirmPassword;

  return (
    <div className="space-y-3">
      {/* Strength indicator header & progress bar */}
      {showStrengthBar && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
              Password Strength
            </span>
            {password.length > 0 && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-all duration-200 ${badgeBg} ${badgeText}`}
              >
                {label} ({metCount}/5)
              </span>
            )}
          </div>

          {/* 5-segment animated indicator bar */}
          <div className="grid grid-cols-5 gap-1.5 pt-0.5">
            {[1, 2, 3, 4, 5].map((index) => {
              const isActive = index <= metCount;
              return (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isActive ? barColor : 'bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Live Requirement Checklist */}
      {showChecklist && (
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Required Criteria ({metCount}/5 met)
            </span>
            {isValid && (
              <span className="text-[11px] font-bold text-[#00a86b] flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" /> All criteria satisfied
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {criteria.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 text-xs transition-colors"
              >
                {c.met ? (
                  <div className="w-4 h-4 rounded-full bg-[#00b87c] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform duration-150 scale-105">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-300 bg-white flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  </div>
                )}
                <span
                  className={
                    c.met
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-500 font-normal'
                  }
                >
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Password Matching Status */}
      {showMatchStatus && confirmPassword !== null && confirmPassword.length > 0 && (
        <div className="pt-0.5 text-xs">
          {passwordsMatch ? (
            <span className="text-[#00a86b] font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Passwords match perfectly
            </span>
          ) : (
            <span className="text-rose-500 font-medium flex items-center gap-1.5">
              <X className="w-3.5 h-3.5 stroke-[2.5]" /> Passwords do not match yet
            </span>
          )}
        </div>
      )}
    </div>
  );
}
