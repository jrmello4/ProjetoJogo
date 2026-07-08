const FIRST_NAMES_MALE = [
  'Carlos', 'João', 'Pedro', 'Lucas', 'Rafael', 'Felipe', 'Bruno', 'Thiago',
  'Diego', 'André', 'Gabriel', 'Leonardo', 'Marcos', 'Eduardo', 'Rodrigo',
  'Michael', 'John', 'Daniel', 'Anthony', 'Justin', 'Nate', 'Khabib',
  'Conor', 'Israel', 'Max', 'Dustin', 'Kamaru', 'Stipe', 'Francis',
  'Jorge', 'Rafael', 'Demian', 'Henry', 'Charles', 'Gilbert', 'Alex',
  'Auston', 'Sean', 'Derrick', 'Benoit', 'Punahele', 'Curtis', 'Chris',
  'Darrion', 'Matt', 'Colby', 'Johnny', 'Bo', 'Al', 'Alex', 'Volkan',
  'Tai', 'Kevin', 'Olivier', 'Ikram', 'Armen', 'Anatoly', 'Sedriques',
  'Dusko', 'Chris', 'Caio', 'Renan', 'Luis', 'Mateus', 'Yan', 'Vinicius',
  'Brendson', 'Elves', 'Drakkar', 'Igor', 'Vitor', 'Aleksei', 'Nikita',
  'Dmitry', 'Sergei', 'Alexander', 'Kirill', 'Makhmud', 'Abus', 'Islam',
  'Magomed', 'Ruslan', 'Shamil', 'Adlan', 'Bekzat', 'Daur', 'Nassurdine',
  'Bubba', 'Tim', 'Phil', 'Deiveson', 'Brandon', 'Jose', 'Marlon',
  'Jalin', 'Cory', 'Brandon', 'Steve', 'Clay', 'TJ', 'Tony', 'Movsar',
  'Abdul', 'Randy', 'Kai', 'Shavvat', 'Muin', 'Nathaniel', 'Renato',
  'Jack', 'Chris', 'Bobby', 'Grant', 'Shara', 'Dakota', 'Drew', 'Mike',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Ferreira', 'Costa', 'Souza', 'Almeida',
  'Rodrigues', 'Lima', 'Gomes', 'Andrade', 'Barbosa', 'Cardoso', 'Machado',
  'Nascimento', 'Ribeiro', 'Moreira', 'Araújo', 'Mendes', 'Cavalcanti',
  'Smith', 'Johnson', 'Jones', 'Brown', 'Williams', 'Davis', 'Miller',
  'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White',
  'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright',
  'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter',
  'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell',
  'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris',
  'Moroz', 'Volkov', 'Emeev', 'Nemkov', 'Shorey', 'Gastelum', 'Lineker',
  'Whittaker', 'Adesanya', 'Dricus', 'Du', 'Plessis', 'Strickland',
  'Blanchfield', 'Zuffa', 'Lemos', 'Canales', 'Fialho', 'Dolidze',
  'Safarov', 'Makhachev', 'Khamzayev', 'Nurmagomedov', 'Abdurakhimov',
  'Seddon', 'Makarov', 'Kopylov', 'Tuleev', 'Panda', 'Khan', 'Bisping',
  'Dakic', 'Pereira', 'Sapojnikov', 'Tawanda', 'Lemos', 'Nascimento',
];

const NATIONALITIES = [
  { code: 'BR', name: 'Brazilian' },
  { code: 'US', name: 'American' },
  { code: 'GB', name: 'British' },
  { code: 'IR', name: 'Iranian' },
  { code: 'RU', name: 'Russian' },
  { code: 'PL', name: 'Polish' },
  { code: 'SE', name: 'Swedish' },
  { code: 'DK', name: 'Danish' },
  { code: 'FR', name: 'French' },
  { code: 'NL', name: 'Dutch' },
  { code: 'DE', name: 'German' },
  { code: 'AU', name: 'Australian' },
  { code: 'ZA', name: 'South African' },
  { code: 'NG', name: 'Nigerian' },
  { code: 'EG', name: 'Egyptian' },
  { code: 'JP', name: 'Japanese' },
  { code: 'KR', name: 'Korean' },
  { code: 'CN', name: 'Chinese' },
  { code: 'CA', name: 'Canadian' },
  { code: 'MX', name: 'Mexican' },
  { code: 'AR', name: 'Argentine' },
  { code: 'CL', name: 'Chilean' },
  { code: 'CO', name: 'Colombian' },
  { code: 'IE', name: 'Irish' },
  { code: 'IS', name: 'Icelandic' },
  { code: 'FI', name: 'Finnish' },
  { code: 'NO', name: 'Norwegian' },
  { code: 'AZ', name: 'Azerbaijani' },
  { code: 'GE', name: 'Georgian' },
  { code: 'KZ', name: 'Kazakh' },
];

const WEIGHT_CLASSES = [
  'Strawweight',
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
];

const STYLES = [
  'Boxing', 'Kickboxing', 'Muay Thai', 'Wrestling', 'BJJ', 'Mixed',
];

export class DataGenerator {
  static randomName() {
    const first = FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return `${first} ${last}`;
  }

  static randomNationality() {
    return NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
  }

  static randomWeightClass() {
    return WEIGHT_CLASSES[Math.floor(Math.random() * WEIGHT_CLASSES.length)];
  }

  static randomStyle() {
    return STYLES[Math.floor(Math.random() * STYLES.length)];
  }

  static generateFighter(organizationId = null, opts = {}) {
    const age = opts.age ?? Math.floor(Math.random() * 15) + 21;
    const nat = DataGenerator.randomNationality();
    const weight = opts.weightClass || DataGenerator.randomWeightClass();
    const style = DataGenerator.randomStyle();

    const [skillMin, skillMax] = opts.skillRange || [30, 60];
    const baseSkill = skillMin + Math.floor(Math.random() * (skillMax - skillMin + 1));

    const primary = Math.floor(Math.random() * 5);
    const attributes = {
      boxing: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10 + (primary === 0 ? 15 : 0)),
      kickboxing: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10 + (primary === 1 ? 15 : 0)),
      muayThai: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10 + (primary === 2 ? 15 : 0)),
      wrestling: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10 + (primary === 3 ? 15 : 0)),
      bjj: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10 + (primary === 4 ? 15 : 0)),
      cardio: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10),
      chin: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10),
      fightIQ: Math.min(99, baseSkill + Math.floor(Math.random() * 20) - 10),
    };

    const hidden = {
      potential: Math.min(99, Math.max(10, baseSkill + Math.floor(Math.random() * 40))),
      discipline: Math.floor(Math.random() * 60) + 20,
      determination: Math.floor(Math.random() * 60) + 20,
      evolution: Math.floor(Math.random() * 30) + 10,
    };

    // Cartel coerente com a idade: carreira começa ~19 anos e um atleta
    // ativo faz no máximo ~3-4 lutas por ano.
    const careerYears = Math.max(0, age - 19);
    const careerCap = Math.min(30, Math.ceil(careerYears * 3.5));
    const fightCeiling = opts.maxFights != null ? Math.min(opts.maxFights, careerCap) : careerCap;
    const fights = Math.floor(Math.random() * (fightCeiling + 1));
    // Empates são raros no MMA — no máximo 1, com chance baixa
    const draws = fights > 0 && Math.random() < 0.1 ? 1 : 0;
    const decided = fights - draws;
    const wins = Math.round(decided * (0.35 + Math.random() * 0.4));
    const losses = decided - wins;

    // DNA traits: máx 2 traits, chances ponderadas
    const dna = DataGenerator._generateDNA();

    // Popularidade baseada em experiência
    const basePop = Math.min(80, fights * 2 + Math.floor(Math.random() * 20));
    const popularity = Math.max(5, basePop);

    // Corte de peso
    const weightCut = {
      naturalWeight: Math.floor(Math.random() * 15) + 1,
      ease: Math.floor(Math.random() * 60) + 20,
      lastCutImpact: 0,
    };

    return {
      id: null,
      name: DataGenerator.randomName(),
      age,
      nationality: nat,
      weightClass: weight,
      fightingStyle: style,
      record: { wins, losses, draws },
      attributes,
      hidden,
      dna,
      popularity,
      weightCut,
      status: organizationId ? 'roster' : 'free',
      organizationId: organizationId || null,
      contract: null,
      fights: [],
      ranking: 0,
      morale: Math.floor(Math.random() * 30) + 70,
      fatigue: 0,
      createdAt: new Date().toISOString(),
    };
  }

  static _generateDNA() {
    const traits = [];
    const pool = [
      { key: 'pressurePerformer', chance: 0.15 },
      { key: 'bigEventNervous', chance: 0.12 },
      { key: 'exceptionalRecovery', chance: 0.10 },
      { key: 'injuryProne', chance: 0.10 },
      { key: 'emotionallyUnstable', chance: 0.08 },
    ];

    for (const t of pool) {
      if (traits.length >= 2) break;
      if (Math.random() < t.chance) {
        traits.push(t.key);
      }
    }

    const dna = {
      pressurePerformer: false,
      bigEventNervous: false,
      exceptionalRecovery: false,
      injuryProne: false,
      emotionallyUnstable: false,
    };
    for (const key of traits) {
      dna[key] = true;
    }
    return dna;
  }

  static generateFreeAgents(count = 30, opts = {}) {
    const agents = [];
    for (let i = 0; i < count; i++) {
      agents.push(DataGenerator.generateFighter(null, opts));
    }
    return agents;
  }

  static generateRoster(count = 10, organizationId, opts = {}) {
    const roster = [];
    for (let i = 0; i < count; i++) {
      roster.push(DataGenerator.generateFighter(organizationId, opts));
    }
    return roster;
  }

  // Roster de uma promoção de IA, distribuído uniformemente entre as
  // divisões informadas para garantir matchmaking viável.
  static generatePromotionRoster(promotion, weightClasses) {
    const roster = [];
    for (let i = 0; i < promotion.rosterSize; i++) {
      const weightClass = weightClasses[i % weightClasses.length];
      const fighter = DataGenerator.generateFighter(promotion.id, {
        weightClass,
        skillRange: promotion.skill,
      });
      roster.push(fighter);
    }
    return roster;
  }

  // Prospecto jovem para a equipe inicial do jogador: cru, mas com
  // potencial alto — o arco "do zero ao campeão" começa aqui.
  static generateProspect(weightClass) {
    const fighter = DataGenerator.generateFighter(null, {
      weightClass,
      skillRange: [36, 48],
      age: 20 + Math.floor(Math.random() * 4),
      maxFights: 4,
    });
    fighter.hidden.potential = 65 + Math.floor(Math.random() * 26); // 65-90
    fighter.hidden.evolution = 25 + Math.floor(Math.random() * 20);
    fighter.popularity = 5 + Math.floor(Math.random() * 10);
    return fighter;
  }
}
