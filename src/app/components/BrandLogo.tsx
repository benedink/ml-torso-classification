type BrandLogoProps = {
  variant?: 'compact' | 'full';
  className?: string;
};

export function BrandLogo({ variant = 'compact', className = '' }: BrandLogoProps) {
  const symbol = (
    <svg
      viewBox="0 0 260 260"
      className="block h-auto w-full"
      role="img"
      aria-label="School Uniform Compliance Detection System logo"
    >
      <defs>
        <linearGradient id="logo-ring" x1="35%" y1="20%" x2="75%" y2="85%">
          <stop offset="0%" stopColor="#8ad4ff" />
          <stop offset="45%" stopColor="#2a9cff" />
          <stop offset="100%" stopColor="#1d2d8f" />
        </linearGradient>
        <linearGradient id="logo-shield" x1="30%" y1="10%" x2="80%" y2="90%">
          <stop offset="0%" stopColor="#2b2f8f" />
          <stop offset="100%" stopColor="#151b5f" />
        </linearGradient>
        <filter id="logo-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.24 0 0 0 0 0.52 0 0 0 0 1 0 0 0 0.85 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#logo-glow)">
        <circle cx="130" cy="118" r="75" fill="none" stroke="url(#logo-ring)" strokeWidth="11" opacity="0.95" />
        <path
          d="M182 64 A82 82 0 0 1 182 174"
          fill="none"
          stroke="#26358f"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M100 52 A92 92 0 0 1 180 52"
          fill="none"
          stroke="#26358f"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M92 182 A92 92 0 0 1 92 70"
          fill="none"
          stroke="#26358f"
          strokeWidth="10"
          strokeLinecap="round"
        />

        <path
          d="M130 72 L182 88 L176 134 C172 159 154 179 130 188 C106 179 88 159 84 134 L78 88 Z"
          fill="url(#logo-shield)"
          stroke="#0f1447"
          strokeWidth="2"
        />

        <path
          d="M110 94 C110 84 118 76 130 76 C142 76 150 84 150 94 C150 104 142 111 130 111 C118 111 110 104 110 94 Z"
          fill="#ffffff"
        />
        <path
          d="M98 97 L110 94 L128 109 L92 116 Z"
          fill="#ffffff"
          opacity="0.9"
        />
        <path
          d="M162 97 L150 94 L132 109 L168 116 Z"
          fill="#ffffff"
          opacity="0.9"
        />
        <path
          d="M117 114 L130 125 L123 145 L111 139 Z"
          fill="#ffffff"
        />
        <path
          d="M143 114 L130 125 L137 145 L149 139 Z"
          fill="#ffffff"
        />
        <path
          d="M108 126 L98 136 L108 136 L116 129 Z"
          fill="#ffffff"
          opacity="0.95"
        />
        <path
          d="M152 126 L162 136 L152 136 L144 129 Z"
          fill="#ffffff"
          opacity="0.95"
        />

        <rect x="118" y="156" width="24" height="26" rx="7" fill="#ffffff" />
        <circle cx="130" cy="168" r="6.5" fill="none" stroke="#2a2f8f" strokeWidth="4" />
        <circle cx="130" cy="168" r="2.5" fill="#2a2f8f" />

        <g fill="#4fa5ff" opacity="0.95">
          <rect x="176" y="48" width="14" height="14" rx="1.5" />
          <rect x="193" y="39" width="14" height="14" rx="1.5" />
          <rect x="210" y="48" width="14" height="14" rx="1.5" />
          <rect x="186" y="66" width="14" height="14" rx="1.5" />
          <rect x="202" y="65" width="14" height="14" rx="1.5" />
          <rect x="219" y="64" width="14" height="14" rx="1.5" />
          <rect x="177" y="84" width="14" height="14" rx="1.5" />
          <rect x="194" y="83" width="14" height="14" rx="1.5" />
        </g>
      </g>
    </svg>
  );

  if (variant === 'compact') {
    return <div className={className}>{symbol}</div>;
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="w-full max-w-[340px]">{symbol}</div>
      <div className="text-center leading-none">
        <div className="text-sm sm:text-lg font-bold tracking-wide text-[#162a82]">
          School Uniform Compliance
        </div>
        <div className="mt-1 text-[10px] sm:text-xs font-bold tracking-[0.45em] text-emerald-700">
          DETECTION SYSTEM
        </div>
      </div>
    </div>
  );
}
