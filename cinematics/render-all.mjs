// Renderiza todas as cinemáticas como WebM VP9 com canal alpha
// direto em ../assets/cinematics/, prontas pro jogo consumir.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const OUT_DIR = '../assets/cinematics';
mkdirSync(OUT_DIR, { recursive: true });

const comps = ['BeltWin', 'WorldChampion', 'TitleDefense', 'Retirement', 'HallOfFame'];

for (const id of comps) {
  const out = `${OUT_DIR}/${id}.webm`;
  console.log(`\n=== Rendering ${id} -> ${out}`);
  execSync(
    `npx remotion render ${id} "${out}" --codec=vp9 --pixel-format=yuva420p --image-format=png`,
    { stdio: 'inherit' }
  );
}
console.log('\nDone.');
