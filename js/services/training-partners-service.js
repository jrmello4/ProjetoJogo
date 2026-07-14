import { clamp } from '../utils/helpers.js';
import { PARTNER_CONFIG, PLAN_SPECIALTY } from '../config/game-config.js';

// A sala de treino viva — Fase 3b.
//
// A academia já espalhava `academyId` pelos lutadores da IA, mas o próprio
// código chamava isso de "só cor local". E `TrainingCamp.processCamp` já
// aceitava um `team` para escolher sparring partner — que o GameController
// sempre passava como `[]`. Havia uma sala de treino inteira desenhada e vazia.
//
// Este serviço a povoa. Os seus companheiros passam a ser pessoas: você aprende
// com eles, você os machuca, você cria vínculo — e um dia a promoção te oferece
// uma luta contra um deles.
//
// E o fecho com O Livro Sobre Você: **quem treinou com você conhece o seu
// livro.** Não há como esconder a sua fita de quem te viu treinar todo dia.
export class TrainingPartnersService {
  constructor(db, fighterCtrl, notifService, careerLogService = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.careerLogService = careerLogService;
  }

  // Quem treina na sua academia hoje. A sala de treino não é um elenco que você
  // gerencia (isso morreu com o modo academia) — é um lugar onde outras pessoas
  // também estão tentando construir a carreira delas.
  async getTeammates(fighter) {
    if (!fighter?.academyId) return [];
    const all = await this.fighterCtrl.getAllFighters();
    return all.filter(f =>
      f.id !== fighter.id
      && f.academyId === fighter.academyId
      && f.status !== 'retired'
    );
  }

  static bondOf(fighter, partnerId) {
    return fighter.bonds?.[partnerId] ?? PARTNER_CONFIG.BOND_DEFAULT;
  }

  static bondLabel(bond) {
    if (bond >= 75) return 'Irmão de treino';
    if (bond >= 50) return 'Parceiro de confiança';
    if (bond >= 25) return 'Colega de academia';
    return 'Apenas dividem o tatame';
  }

  static _setBond(fighter, partnerId, value) {
    if (!fighter.bonds) fighter.bonds = {};
    fighter.bonds[partnerId] = clamp(value, 0, 100);
  }

  // Uma semana de sparring. Chamada de dentro do camp — não é um botão próprio,
  // porque sparring não é uma atividade separada do treino: é o treino.
  //
  // Devolve o que aconteceu para o chamador narrar. Não persiste nada: quem
  // salva é o GameController, depois de aplicar tudo da semana.
  static spar(fighter, partner, intensity, weaponTarget = null) {
    const bond = this.bondOf(fighter, partner.id);
    const out = { partnerName: partner.name, bond, osmosis: null, partnerInjured: false, weaponBoost: 0 };

    // Quem te vê treinar todo dia aprende a te ler. Isto é o gancho de O Livro
    // Sobre Você fechando: a sua fita pública é uma coisa; o cara que dividiu o
    // tatame com você por 8 semanas é outra. Dele não há como esconder nada.
    if (!fighter.sparredWith) fighter.sparredWith = {};
    fighter.sparredWith[partner.id] = (fighter.sparredWith[partner.id] || 0) + 1;

    // Osmose: você rouba um pedaço do jogo de quem te bate. Só funciona com
    // vínculo — um parceiro que te odeia não te ensina nada, só te machuca.
    const osmosisChance = PARTNER_CONFIG.OSMOSIS_BASE_CHANCE
      * (bond / 100)
      * PARTNER_CONFIG.OSMOSIS_INTENSITY[intensity];

    if (Math.random() < osmosisChance) {
      const attr = this._strongestAttr(partner, fighter);
      if (attr) {
        // Nunca ultrapassa o parceiro: você aprende COM ele, não fica melhor que
        // ele de graça. E respeita o teto de sequela permanente (§B.2).
        const ceiling = Math.min(partner.attributes[attr], fighter.effectiveCeiling(attr));
        if (fighter.attributes[attr] < ceiling) {
          fighter.attributes[attr] = clamp(fighter.attributes[attr] + 1, 0, ceiling);
          out.osmosis = attr;
        }
      }
    }

    // Um parceiro forte na especialidade da arma que você está instalando
    // acelera a instalação. Não dá pra aprender wrestling sem alguém que saiba
    // wrestling te jogando no chão.
    if (weaponTarget) {
      const spec = PLAN_SPECIALTY[weaponTarget];
      const partnerScore = spec === 'grappling' ? partner.grapplingScore
        : spec === 'striking' ? partner.strikingScore
          : partner.attributes.cardio;
      if (partnerScore >= PARTNER_CONFIG.WEAPON_PARTNER_MIN_SCORE) {
        out.weaponBoost = PARTNER_CONFIG.WEAPON_PARTNER_BOOST;
      }
    }

    // Sparring duro machuca gente de verdade. O parceiro não é um boneco: ele
    // tem carreira, tem luta marcada, e você pode acabar com ela.
    const injuryChance = PARTNER_CONFIG.PARTNER_INJURY_CHANCE[intensity] || 0;
    if (Math.random() < injuryChance) {
      out.partnerInjured = true;
      out.injuryWeeks = PARTNER_CONFIG.PARTNER_INJURY_MIN_WEEKS
        + Math.floor(Math.random() * PARTNER_CONFIG.PARTNER_INJURY_SPREAD);
      this._setBond(fighter, partner.id, bond + PARTNER_CONFIG.BOND_ON_INJURY);
    } else {
      this._setBond(fighter, partner.id, bond + PARTNER_CONFIG.BOND_PER_WEEK[intensity]);
    }

    out.newBond = this.bondOf(fighter, partner.id);
    return out;
  }

  // Você não aprende o que o parceiro faz bem — aprende o que ele faz MELHOR
  // QUE VOCÊ. Um wrestler de elite não te ensina boxe, ainda que boxe seja o
  // segundo melhor atributo dele.
  static _strongestAttr(partner, fighter) {
    const TRAINABLE = [
      'boxing', 'kickboxing', 'muayThai', 'wrestling', 'bjj', 'takedowns',
      'groundControl', 'submissionOffense', 'submissionDefense', 'footwork',
      'headMovement', 'clinch', 'power', 'speed', 'cardio', 'composure', 'fightIQ',
    ];

    let best = null;
    let bestGap = 0;
    for (const attr of TRAINABLE) {
      const gap = (partner.attributes[attr] ?? 0) - (fighter.attributes[attr] ?? 0);
      if (gap > bestGap) {
        bestGap = gap;
        best = attr;
      }
    }
    return best;
  }

  // Aplica a lesão no parceiro. Separado de `spar` porque mexer no OUTRO
  // lutador é escrita no banco, e `spar` é puro de propósito.
  async injurePartner(partner, weeks, absWeekNow, fighterName) {
    const prevStatus = partner.status;
    partner.status = 'injured';
    partner.injury = {
      untilAbsWeek: absWeekNow + weeks,
      description: 'Lesionado no sparring',
      resumeStatus: prevStatus,
    };
    partner.availableFromAbsWeek = partner.injury.untilAbsWeek;
    await this.fighterCtrl.updateFighter(partner);

    await this.notifService.add(
      'danger',
      '🤕 Você Machucou seu Parceiro',
      `${partner.name} saiu do treino lesionado (${weeks} semanas). Ele tinha a própria carreira pra tocar.`
    );
  }

  // Fase 3b — o dilema: a promoção te oferece uma luta contra um companheiro.
  // Não existe escolha limpa. Aceitar rende a luta; recusar preserva a pessoa.
  async isTeammate(fighter, opponentId) {
    const opponent = await this.fighterCtrl.getFighter(opponentId);
    if (!opponent || !fighter.academyId) return null;
    if (opponent.academyId !== fighter.academyId) return null;

    return {
      id: opponent.id,
      name: opponent.name,
      bond: TrainingPartnersService.bondOf(fighter, opponent.id),
      bondLabel: TrainingPartnersService.bondLabel(TrainingPartnersService.bondOf(fighter, opponent.id)),
    };
  }

  // Você aceitou lutar contra o amigo. O vínculo não sobrevive a isso.
  async breakBond(fighter, partnerId, absWeekNow) {
    const partner = await this.fighterCtrl.getFighter(partnerId);
    const bond = TrainingPartnersService.bondOf(fighter, partnerId);
    TrainingPartnersService._setBond(fighter, partnerId, PARTNER_CONFIG.BOND_AFTER_BETRAYAL);

    await this.notifService.add(
      'warning',
      '💔 Vocês Vão se Enfrentar',
      `${partner?.name || 'Seu parceiro'} soube que você aceitou. O tatame não vai ser o mesmo.`
    );
    if (this.careerLogService && bond >= PARTNER_CONFIG.BETRAYAL_LOG_MIN_BOND) {
      await this.careerLogService.publish(fighter.id, 'fought_friend', absWeekNow, 70, {
        partnerName: partner?.name,
        bond: Math.round(bond),
      });
    }
    return { ok: true, previousBond: bond };
  }
}
