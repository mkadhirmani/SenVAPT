import React from 'react';

export default function Logo({ theme = 'dark', size = 'md', iconOnly = false, className = '' }) {
  if (iconOnly) {
    return (
      <img
        src="/logo/icon.png"
        alt="Sennovate Icon"
        className={`${size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} object-contain ${className}`}
      />
    );
  }

  const logoSrc = theme === 'dark' ? '/logo/Logo White.png' : '/logo/Logo dark.jpg';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src={logoSrc}
        alt="Sennovate Inc."
        className={`${
          size === 'sm' ? 'h-7' : size === 'lg' ? 'h-11' : 'h-8'
        } object-contain transition-opacity duration-200`}
      />
    </div>
  );
}
