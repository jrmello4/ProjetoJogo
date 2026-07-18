import React from 'react';
import { Composition } from 'remotion';
import { Milestone, milestoneSchema } from './compositions/Milestone';

const FPS = 30;
const W = 1920;
const H = 1080;

const defs: Array<{
  id: string;
  durationSec: number;
  props: {
    headline: string;
    subline: string;
    theme: 'gold' | 'platinum' | 'crimson';
    showBelt: boolean;
  };
}> = [
  {
    id: 'BeltWin',
    durationSec: 5,
    props: {
      headline: 'NOVO CAMPEÃO',
      subline: 'O cinturão tem um novo dono',
      theme: 'gold',
      showBelt: true,
    },
  },
  {
    id: 'WorldChampion',
    durationSec: 6,
    props: {
      headline: 'CAMPEÃO MUNDIAL',
      subline: 'O topo do mundo',
      theme: 'platinum',
      showBelt: true,
    },
  },
  {
    id: 'TitleDefense',
    durationSec: 4,
    props: {
      headline: 'CINTURÃO DEFENDIDO',
      subline: 'O reinado continua',
      theme: 'gold',
      showBelt: true,
    },
  },
  {
    id: 'Retirement',
    durationSec: 6,
    props: {
      headline: 'UMA LENDA SE DESPEDE',
      subline: 'Obrigado por tudo',
      theme: 'crimson',
      showBelt: false,
    },
  },
  {
    id: 'HallOfFame',
    durationSec: 6,
    props: {
      headline: 'HALL DA FAMA',
      subline: 'Imortalizado para sempre',
      theme: 'platinum',
      showBelt: false,
    },
  },
];

export const Root: React.FC = () => (
  <>
    {defs.map((d) => (
      <Composition
        key={d.id}
        id={d.id}
        component={Milestone}
        schema={milestoneSchema}
        durationInFrames={d.durationSec * FPS}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={d.props}
      />
    ))}
  </>
);
