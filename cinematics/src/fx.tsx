import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Biblioteca de efeitos geométricos compartilhada pelas cinemáticas.
// Tudo é função do frame — sem estado, sem aleatoriedade fora de seed.

const rand = (seed: number) => {
  // Determinístico: mesmo seed, mesmo valor em todo render.
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Flash branco rápido no impacto. */
export const Flash: React.FC<{ at: number; color?: string }> = ({
  at,
  color = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 2, at + 14], [0, 0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  if (opacity <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: color, opacity }} />;
};

/** Anéis que expandem a partir do centro. */
export const Rings: React.FC<{
  at: number;
  color: string;
  count?: number;
}> = ({ at, color, count = 3 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const start = at + i * 5;
        const t = interpolate(frame, [start, start + 40], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        if (t <= 0 || t >= 1) return null;
        const size = t * Math.max(width, height) * 1.1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              border: `${Math.max(1, 6 * (1 - t))}px solid ${color}`,
              opacity: (1 - t) * 0.8,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Raios de luz finos girando lentamente atrás do foco central. */
export const LightRays: React.FC<{
  from: number;
  to: number;
  color: string;
  rays?: number;
}> = ({ from, to, color, rays = 12 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const inT = interpolate(frame, [from, from + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const outT = interpolate(frame, [to - 20, to], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const opacity = Math.min(inT, outT) * 0.3;
  if (opacity <= 0) return null;
  const rot = frame * 0.12;
  const R = Math.max(width, height);
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        // Raios só nas bordas — o miolo fica limpo pro cinturão e o texto.
        WebkitMaskImage:
          'radial-gradient(ellipse at center, transparent 30%, black 62%)',
        maskImage:
          'radial-gradient(ellipse at center, transparent 30%, black 62%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          transform: `rotate(${rot}deg)`,
        }}
      >
        {Array.from({ length: rays }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: -3,
              top: 0,
              width: 6,
              height: R,
              transformOrigin: '3px 0',
              transform: `rotate(${(360 / rays) * i}deg)`,
              background: `linear-gradient(${color}00, ${color}55 30%, ${color}00 85%)`,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Estilhaços geométricos que explodem do centro e caem com gravidade leve. */
export const Shards: React.FC<{
  at: number;
  color: string;
  count?: number;
  seed?: number;
}> = ({ at, color, count = 26, seed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame - at;
  if (t < 0 || t > fps * 2.2) return null;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const a = rand(seed + i) * Math.PI * 2;
        const speed = 9 + rand(seed + i + 50) * 14;
        const x = Math.cos(a) * speed * t;
        const y = Math.sin(a) * speed * t * 0.72 + 0.16 * t * t;
        const life = interpolate(t, [0, fps * 1.9], [1, 0], {
          extrapolateRight: 'clamp',
        });
        if (life <= 0) return null;
        if (Math.abs(x) > width || Math.abs(y) > height) return null;
        const s = 4 + rand(seed + i + 99) * 9;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: s,
              height: s * (0.4 + rand(seed + i + 7) * 0.8),
              background: color,
              opacity: life,
              transform: `translate(${x}px, ${y}px) rotate(${t * (6 + rand(seed + i + 3) * 10)}deg)`,
              borderRadius: 1,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Título com entrada spring, brilho varrendo e saída completa. */
export const HeroTitle: React.FC<{
  text: string;
  at: number;
  out: number;
  color: string;
  glow: string;
  size?: number;
  y?: number;
  letterSpacing?: number;
}> = ({ text, at, out, color, glow, size = 120, y = 0, letterSpacing = 6 }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = spring({
    frame: frame - at,
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.9 },
  });
  const exitT = interpolate(frame, [out - 16, out], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  if (frame < at || exitT >= 1) return null;
  const scale = 0.6 + enter * 0.4;
  const shine = interpolate(
    frame,
    [at + 18, at + 55],
    [-0.35 * width, 0.7 * width],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          transform: `translateY(${y - exitT * 40}px) scale(${scale * (1 - exitT * 0.1)})`,
          opacity: Math.min(enter * 1.4, 1) * (1 - exitT),
        }}
      >
        <div
          style={{
            fontFamily:
              "'Archivo Black','Arial Black','Segoe UI',system-ui,sans-serif",
            fontSize: size,
            fontWeight: 900,
            letterSpacing,
            color,
            textShadow: `0 0 18px ${glow}66, 0 6px 24px rgba(0,0,0,0.6)`,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-30%',
              bottom: '-30%',
              width: 90,
              left: shine,
              transform: 'skewX(-18deg)',
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Subtítulo menor abaixo do herói. */
export const SubTitle: React.FC<{
  text: string;
  at: number;
  out: number;
  color: string;
  y?: number;
  size?: number;
}> = ({ text, at, out, color, y = 110, size = 40 }) => {
  const frame = useCurrentFrame();
  const opacity =
    interpolate(frame, [at, at + 14], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad),
    }) *
    interpolate(frame, [out - 14, out], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.quad),
    });
  if (opacity <= 0) return null;
  const rise = interpolate(frame, [at, at + 14], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          transform: `translateY(${y + rise}px)`,
          opacity,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontSize: size,
          fontWeight: 600,
          letterSpacing: 10,
          color,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Vinheta escura suave nas bordas — dá profundidade sem matar o alpha do centro. */
export const EdgeVignette: React.FC<{ from: number; to: number }> = ({
  from,
  to,
}) => {
  const frame = useCurrentFrame();
  const opacity =
    interpolate(frame, [from, from + 20], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }) *
    interpolate(frame, [to - 20, to], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at center, transparent 45%, rgba(4,5,9,0.55) 100%)',
        opacity,
      }}
    />
  );
};
