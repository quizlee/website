import { useState, useEffect } from 'react';
import { avatarPresets, parseAvatar } from '../../lib/avatar';

interface AvatarProps {
  avatarUrl: string | null;
  initials: string;
  className?: string;
}

export function Avatar({ avatarUrl, initials, className = 'w-10 h-10 text-sm font-bold' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const parsed = parseAvatar(avatarUrl);

  if (parsed.type === 'preset' && parsed.presetKey) {
    const emoji = avatarPresets[parsed.presetKey] || '🦊';
    return (
      <div
        className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-inner select-none ${className}`}
        style={{ backgroundColor: parsed.bgColor }}
      >
        <span className="text-[1.45em] leading-none">{emoji}</span>
      </div>
    );
  }

  if (avatarUrl && !imageError) {
    return (
      <div className={`rounded-full overflow-hidden shrink-0 ${className}`}>
        <img
          src={avatarUrl}
          alt={initials || ''}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-600 overflow-hidden shrink-0 shadow-inner select-none ${className}`}>
      {initials}
    </div>
  );
}
