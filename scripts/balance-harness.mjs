// Harness estatístico de balanceamento — mede se o motor de cartas é
// justo em vez de confiar em "ajustei no olho e parece certo".
//
// Roda: npm run balance
import { Fighter } from '../js/models/fighter.js';
import { CombatAdapter } from '../js/controllers/combat-adapter.js';

const BASE_ATTRS = {
  boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
  cardio: 50, chin: 50, fightIQ: 50,
  power: 50, footwork: 50, headMovement: 50, clinch: 50,
  takedowns: 50, takedownDefense: 50, groundControl: 50,
  submissionOffense: 50, submissionDefense: 50,
  strength: 50, speed: 50, durability: 50, recovery: 50,
  composure: 50, aggression: 50, adaptability: 50,
};

function makeFighter(id, attrOverrides = {}, extra = {}) {
  return new Fighter({
    id, name: id, age: 27, nationality: 'BR', weightClass: 'lightweight',
    fightingStyle: 'balanced',
    record: { wins: 0, losses: 0, draws: 0 },
    attributes: { ...BASE_ATTRS, ...attrOverrides },
    hidden: { evolution: 50, discipline: 50, potential: 60, determination: 50 },
    status: 'active', organizationId: null, createdAt: '2026-01-01',
    style: 'freestyle', perks: [],
    ...extra,
  });
}

async function runBatch(n, buildPair) {
  let winsA = 0, winsB = 0, draws = 0;
  const methods = {};
  for (let i = 0; i < n; i++) {
    const [a, b] = buildPair();
    const adapter = new CombatAdapter();
    // headless: interactive=false, awardReward=false (motor de cartas puro)
    const result = await adapter.runFight(a, b, false, 'balanced', 3, false, false, false);
    if (result.isDraw) draws++;
    else if (result.winnerId === a.id) winsA++;
    else winsB++;
    methods[result.method] = (methods[result.method] || 0) + 1;
  }
  return {
    n,
    winRateA: +(100 * winsA / n).toFixed(1),
    winRateB: +(100 * winsB / n).toFixed(1),
    drawRate: +(100 * draws / n).toFixed(1),
    decisiveWinRateA: winsA + winsB > 0
      ? +(100 * winsA / (winsA + winsB)).toFixed(1)
      : null,
    methods: Object.fromEntries(
      Object.entries(methods).map(([k, v]) => [k, +(100 * v / n).toFixed(1)])
    ),
  };
}

function printResult(label, r, expectation) {
  console.log(`\n${label}`);
  console.log(`  N=${r.n}  A=${r.winRateA}%  B=${r.winRateB}%  draw=${r.drawRate}%`);
  console.log(`  decisões: A=${r.decisiveWinRateA ?? '-'}%  B=${r.decisiveWinRateA == null ? '-' : +(100 - r.decisiveWinRateA).toFixed(1)}%`);
  console.log(`  métodos: ${JSON.stringify(r.methods)}`);
  if (expectation) console.log(`  esperado: ${expectation}`);
}

// Motor de cartas resolve turno-a-turno (mais pesado que o antigo
// estatístico) — N menor pra manter o harness rodável em segundos.
const N = 1000;

async function main() {
  console.log('='.repeat(70));
  console.log('HARNESS DE BALANCEAMENTO — CombatAdapter (motor de cartas)');
  console.log('='.repeat(70));

  // 1) Espelho puro: dois lutadores idênticos, zero vantagem de nenhum lado.
  // Se isso não sair perto de 50/50, o motor tem viés estrutural (ex: o
  // fighterA sempre citado primeiro leva alguma vantagem por posição).
  const mirror = await runBatch(N, () => [makeFighter('a'), makeFighter('b')]);
  printResult('1) Espelho (atributos idênticos, sem plano/tática)', mirror,
    'decisões ~50/50 ± poucos pontos; empates reportados separadamente');

  // 2) Curva de habilidade: A recebe delta crescente em TODOS os atributos.
  // Precisa subir de forma monotônica e suave — sem degrau, sem platô, sem
  // 50 pontos de vantagem virando "sempre ganha" (o que mataria a variância
  // que faz o jogo parecer justo em vez de determinístico).
  for (const delta of [5, 10, 20, 30, 50]) {
    const boosted = Object.fromEntries(
      Object.entries(BASE_ATTRS).map(([k, v]) => [k, Math.min(99, v + delta)])
    );
    const r = await runBatch(N, () => [makeFighter('a', boosted), makeFighter('b')]);
    printResult(`2) A com +${delta} em todos atributos`, r,
      delta <= 10 ? 'leve favorito, não domínio' : 'favorito claro, mas B ainda vence uma fração real');
  }

  // 3) O que o usuário reportou: "meus lutadores tao se dando bem" — testa
  // especificamente a vantagem de plano de jogo lido corretamente
  // (_planEdge), que é o bônus que SÓ o jogador escolhe conscientemente.
  const planAdvantage = await runBatch(N, () => {
    const a = makeFighter('a', { fightIQ: 70 }); // dispara traits do plano
    const b = makeFighter('b');
    return [a, b];
  });
  printResult('3) A com fightIQ alto (proxy de "leu o plano certo")', planAdvantage,
    'vantagem visível mas não avassaladora — planEdge é só um dos ~8 fatores do score');

  // 4) Varredura de perks — cada um sozinho, mesma base, pra achar
  // combinação isolada que já vira exploit sem precisar de atributo melhor.
  const _perksToTest = [
    'powerMultiplier', // nomes de perk reais variam; ver PERKS em game-config —
  ];
  console.log('\n4) Perks individuais (ver lista real em js/config/game-config.js PERKS):');
  console.log('   pulado no harness base — rodar manualmente com --perk=<id> se suspeitar de um específico.');

  console.log('\n' + '='.repeat(70));
  console.log('Leitura: decisões do cenário 1 fora de ~48-52% = bug estrutural, prioridade máxima.');
  console.log('Cenário 2 sem curva suave = fórmula precisa de recalibração dos pesos.');
  console.log('='.repeat(70));
}

main();
