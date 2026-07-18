import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Cinturão estilizado em SVG puro — placa central, placas laterais, correia.
export const Belt: React.FC<{
  at: number;
  out: number;
  main: string;
  bright: string;
  deep: string;
  scale?: number;
  y?: number;
}> = ({ at, out, main, bright, deep, scale = 1, y = -160 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - at,
    fps,
    config: { damping: 11, stiffness: 120, mass: 1 },
  });
  const exitT = interpolate(frame, [out - 16, out], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  if (frame < at || exitT >= 1) return null;

  // Flutuação sutil durante o hold — evita cara de PNG parado.
  const float = Math.sin((frame - at) / 14) * 6;
  const tilt = Math.sin((frame - at) / 22) * 1.6;

  const s = (0.5 + enter * 0.5) * scale * (1 - exitT * 0.08);
  const opacity = Math.min(enter * 1.5, 1) * (1 - exitT);

  // Brilho varrendo a placa central.
  const shineX = interpolate(frame, [at + 15, at + 60], [-260, 260], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={720}
        height={340}
        viewBox="0 0 720 340"
        style={{
          transform: `translateY(${y + float - exitT * 50}px) scale(${s}) rotate(${tilt}deg)`,
          opacity,
          filter: `drop-shadow(0 0 40px ${main}88) drop-shadow(0 14px 30px rgba(0,0,0,0.55))`,
        }}
      >
        <defs>
          <linearGradient id="strap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2118" />
            <stop offset="0.5" stopColor="#141009" />
            <stop offset="1" stopColor="#2a2118" />
          </linearGradient>
          <radialGradient id="plate" cx="0.5" cy="0.35" r="0.8">
            <stop offset="0" stopColor={bright} />
            <stop offset="0.55" stopColor={main} />
            <stop offset="1" stopColor={deep} />
          </radialGradient>
          <radialGradient id="side" cx="0.5" cy="0.4" r="0.9">
            <stop offset="0" stopColor={main} />
            <stop offset="1" stopColor={deep} />
          </radialGradient>
          <clipPath id="plateClip">
            <ellipse cx="360" cy="170" rx="150" ry="118" />
          </clipPath>
        </defs>

        {/* Correia */}
        <path
          d="M 20 130 Q 180 96 360 96 Q 540 96 700 130 L 700 210 Q 540 244 360 244 Q 180 244 20 210 Z"
          fill="url(#strap)"
          stroke={deep}
          strokeWidth="3"
        />

        {/* Placas laterais */}
        {[130, 232, 488, 590].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={170} r={40} fill="url(#side)" stroke={deep} strokeWidth="3" />
            <circle cx={cx} cy={170} r={26} fill="none" stroke={bright} strokeWidth="2.5" opacity="0.7" />
          </g>
        ))}

        {/* Placa central */}
        <ellipse cx="360" cy="170" rx="150" ry="118" fill="url(#plate)" stroke={deep} strokeWidth="5" />
        <ellipse cx="360" cy="170" rx="128" ry="98" fill="none" stroke={bright} strokeWidth="2.5" opacity="0.8" />
        <ellipse cx="360" cy="170" rx="108" ry="80" fill="none" stroke={deep} strokeWidth="2" opacity="0.6" />

        {/* Globo + luva estilizados no centro */}
        <circle cx="360" cy="158" r="46" fill="none" stroke={deep} strokeWidth="3.5" opacity="0.9" />
        <path d="M 314 158 Q 360 128 406 158 M 314 158 Q 360 188 406 158 M 360 112 L 360 204" stroke={deep} strokeWidth="2.5" fill="none" opacity="0.7" />
        <path
          d="M 342 224 q -8 -18 4 -26 q 4 -10 14 -8 q 10 -2 14 8 q 12 8 4 26 q -18 10 -36 0 Z"
          fill={deep}
          opacity="0.85"
        />

        {/* Estrelas */}
        {[300, 360, 420].map((cx, i) => (
          <path
            key={cx}
            d={`M ${cx} ${68 - (i === 1 ? 8 : 0)} l 4.5 9 l 10 1.5 l -7 7 l 1.5 10 l -9 -4.5 l -9 4.5 l 1.5 -10 l -7 -7 l 10 -1.5 Z`}
            fill={bright}
          />
        ))}

        {/* Brilho varrendo a placa */}
        <g clipPath="url(#plateClip)">
          <rect
            x={360 + shineX - 34}
            y={30}
            width={68}
            height={280}
            fill="rgba(255,255,255,0.4)"
            transform={`skewX(-16)`}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
