import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true }) => {
  const sizeMap = { sm: 72, md: 96, lg: 108 };
  const s = sizeMap[size];
  const padding = s * 0.15;
  const innerS = s - padding * 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center" style={{ width: s, height: s }}>
        <div
          className="flex items-center justify-center bg-teal-600 dark:bg-teal-500"
          style={{ width: innerS, height: innerS, borderRadius: '12px' }}
        >
          <span className="text-white font-bold" style={{ fontSize: innerS * 0.4 }}>
            GHS
          </span>
        </div>
      </div>
      {showText && <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Socx</span>}
    </div>
  );
};
