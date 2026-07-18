import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { Belt } from '../Belt';
import {
  EdgeVignette,
  Flash,
  HeroTitle,
  LightRays,
  Rings,
  Shards,
  SubTitle,
} from '../fx';
import {
  GOLD,
  GOLD_BRIGHT,
  GOLD_DEEP,
  PLATINUM,
  PLATINUM_BRIGHT,
  RED,
  sec,
} from '../tokens';

// Uma única composição paramétrica cobre todas as ocasiões — a variação
// vem dos props, então novas ocasiões não exigem novo componente.
export const milestoneSchema = z.object({
  headline: z.string(),
  subline: z.string(),
  theme: z.enum(['gold', 'platinum', 'crimson']),
  showBelt: z.boolean(),
});

const THEMES = {
  gold: { main: GOLD, bright: GOLD_BRIGHT, deep: GOLD_DEEP },
  platinum: { main: PLATINUM, bright: PLATINUM_BRIGHT, deep: '#8d99ab' },
  crimson: { main: RED, bright: '#ff9a9d', deep: '#7d1f23' },
} as const;

export const Milestone: React.FC<z.infer<typeof milestoneSchema>> = ({
  headline,
  subline,
  theme,
  showBelt,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const t = THEMES[theme];
  const end = durationInFrames;

  // Linha do tempo (frames): impacto → cinturão → título → subtítulo → saída.
  const impact = sec(0.25, fps);
  const beltAt = sec(0.35, fps);
  const titleAt = sec(0.8, fps);
  const subAt = sec(1.1, fps);
  const exitAt = end - sec(0.15, fps);

  return (
    <AbsoluteFill>
      {/* Sem backgroundColor — alpha precisa sobreviver. */}
      <EdgeVignette from={impact} to={exitAt} />
      <LightRays from={beltAt} to={exitAt} color={t.main} />
      <Rings at={impact} color={t.bright} />
      <Shards at={impact + 3} color={t.main} seed={7} />
      <Shards at={impact + 3} color={t.bright} count={14} seed={31} />
      {showBelt && (
        <Belt
          at={beltAt}
          out={exitAt}
          main={t.main}
          bright={t.bright}
          deep={t.deep}
        />
      )}
      <HeroTitle
        text={headline}
        at={titleAt}
        out={exitAt}
        color={t.bright}
        glow={t.main}
        size={headline.length > 14 ? 96 : 120}
        y={showBelt ? 130 : -20}
      />
      <SubTitle
        text={subline}
        at={subAt}
        out={exitAt}
        color={t.main}
        y={showBelt ? 245 : 120}
      />
      <Flash at={impact} />
    </AbsoluteFill>
  );
};
