import React from 'react';
import logoImg from '../assets/logo-transparent.png';

export { logoImg };

export default function Logo({ 
  className = '', 
  size = 'md', 
  variant = 'auto', 
  showText = true,
  subtitle = null,
  textClassName = ''
}) {
  // Sizing configurations
  const sizeMap = {
    sm: { img: 'w-7 h-7', text: 'text-lg', container: 'gap-2' },
    md: { img: 'w-9 h-9', text: 'text-xl', container: 'gap-2.5' },
    lg: { img: 'w-12 h-12', text: 'text-2xl', container: 'gap-3' },
    xl: { img: 'w-16 h-16', text: 'text-3xl', container: 'gap-3.5' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Background styling for dark environments
  const isLightOnDark = variant === 'dark-bg';

  return (
    <div className={`inline-flex items-center ${currentSize.container} group select-none ${className}`}>
      {/* Logo Graphic Container */}
      <div className={`relative flex items-center justify-center shrink-0 rounded-2xl transition-transform duration-200 group-hover:scale-105 ${
        isLightOnDark 
          ? 'bg-white/95 p-1.5 shadow-sm ring-1 ring-white/20' 
          : 'bg-white p-1 shadow-xs border border-gray-100'
      }`}>
        <img
          src={logoImg}
          alt="BikeMate Eco Logo"
          className={`${currentSize.img} object-contain`}
        />
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col justify-center">
          <span className={`font-bold tracking-tight leading-none ${currentSize.text} ${textClassName || (isLightOnDark ? 'text-white' : 'text-gray-900')}`}>
            Bike<span className="text-[#00b87c]">Mate</span>
          </span>
          {subtitle && (
            <span className="text-[10px] text-gray-400 font-medium tracking-wide mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
