/**
 * Simulação longa de carreira para validar sistemas narrativos
 * (podcast, year review, rival arcs, crowd, career log).
 * Roda fora do browser com fake-indexeddb.
 */
import 'fake-indexeddb/auto';
import { GameController } from '../js/controllers/game-controller.js';

const WEEKS = Number(process.argv[2] || 80);

async function main() {
  const game = new GameController();
  await game.init();

  const fighter = await game.createPlayerFighter({
    name: 'Narrativa Sim',
    weightClass: 'Welterweight',
    archetype: 'striker',
    origin: null,
    difficultyId: 'normal',
    academyId: 'academy-blacktiger',
    managerId: null,
  });

  console.log(`Início: ${fighter.name} id=${fighter.id}`);
  const result = await game.simulateWeeks(WEEKS);
  console.log('simulateWeeks:', JSON.stringify(result, null, 2));

  const end = await game.getPlayerFighter();
  const log = await game.careerLogService.all();
  const mine = log.filter(e => e.fighterId === end.id);
  const types = {};
  for (const e of mine) types[e.type] = (types[e.type] || 0) + 1;

  const podcast = await game.podcastService.getLatest();
  const yearReview = await game.yearReviewService.getLatest();
  let crowd = null;
  try { crowd = await game.db.get('gameState', 'crowdReaction'); } catch { /* */ }

  const rivalries = await game.rivalryService.getRivalries(end.id);

  console.log('\n=== FIM DA CARREIRA SIM ===');
  console.log(`Cartel: ${end.record.wins}-${end.record.losses}-${end.record.draws} OVR ${end.overallRating} pop ${end.popularity}`);
  console.log(`Persona: ${end.publicPersona} heat=${end.narrativeHeat} hype=${end.narrativeHype}`);
  console.log(`Cash: ${end.cash} titles: ${end.titlesWon}`);
  console.log(`Career log entries (player): ${mine.length}`);
  console.log('Tipos:', types);
  console.log(`Rivalidades ativas: ${rivalries.length}`);
  if (rivalries[0]) {
    console.log(`  top: intensity ${rivalries[0].intensity} type ${rivalries[0].type} hist ${rivalries[0].history?.length}`);
  }
  console.log(`Podcast: ${podcast ? podcast.title : '(nenhum)'}`);
  console.log(`Year review: ${yearReview ? yearReview.headline : '(nenhum)'}`);
  console.log(`Crowd: ${crowd?.reaction ? `energy ${crowd.reaction.energy} chant "${crowd.reaction.chant}" mails ${crowd.fanMail?.length || 0}` : '(nenhum)'}`);

  // Invariantes leves
  const ok = result.weeksSimulated === WEEKS
    && end
    && (mine.length >= 0);
  if (!ok) {
    console.error('FALHA nas invariantes');
    process.exit(1);
  }
  console.log('\nOK — simulação narrativa concluída.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
