import { describe, it, expect } from 'vitest';
import { PortraitService } from '../js/services/portrait-service.js';
import { VisualIdentityService } from '../js/services/visual-identity-service.js';
import { APPEARANCE_CATEGORIES, HEADWEAR_ACCESSORY_IDXS, TALL_HAIR_IDXS } from '../js/config/appearance-config.js';

// Regressões da auditoria de identidade visual. O contrato central:
// a cara de um lutador de IA é ESTÁVEL — flutuação semanal de stats não
// pode trocar o personagem de rosto. Antes destes fixes, todas as decisões
// de viés dividiam um único stream de rng; qualquer limiar cruzado
// (pop 69→70, idade 33→34) dessincronizava o stream inteiro e 5-7
// categorias mudavam de uma vez.
const mk = (over = {}) => ({
  id: 'ai-stability-1',
  name: 'Teste Estável',
  age: 29,
  popularity: 45,
  status: 'roster',
  record: { wins: 8, losses: 3, draws: 0 },
  fightingStyle: 'Boxer',
  style: 'boxer',
  weightClass: 'Lightweight',
  ...over,
});

// Anatomia — nunca muda com stats (só o dono da cara é o hash do id)
const ANATOMY = ['skinTone', 'faceShape', 'eyeColor', 'browStyle'];

describe('identidade visual — estabilidade temporal', () => {
  it('mesmos inputs → mesma aparência (determinismo)', () => {
    expect(PortraitService.appearanceFor(mk())).toEqual(PortraitService.appearanceFor(mk()));
  });

  it('flutuação de pop sem cruzar limiar (45→55) não muda NADA', () => {
    const a = PortraitService.appearanceFor(mk({ popularity: 45 }));
    const b = PortraitService.appearanceFor(mk({ popularity: 55 }));
    expect(b).toEqual(a);
  });

  it('cruzar pop 70 só mexe nas categorias que pop governa', () => {
    const a = PortraitService.appearanceFor(mk({ popularity: 69 }));
    const b = PortraitService.appearanceFor(mk({ popularity: 70 }));
    const changed = Object.keys(a).filter(k => a[k] !== b[k]);
    // flash de popularidade: tinta, acessório, tintura — e nada de anatomia
    const allowed = new Set(['tattooStyle', 'accessory', 'hairColor', 'outfitStyle', 'trunksColor', 'accentColor']);
    for (const k of changed) expect(allowed.has(k), `categoria inesperada mudou: ${k}`).toBe(true);
    for (const k of ANATOMY) expect(a[k]).toBe(b[k]);
  });

  it('envelhecer 33→34 só mexe em cabelo/marcas de idade', () => {
    const a = PortraitService.appearanceFor(mk({ age: 33 }));
    const b = PortraitService.appearanceFor(mk({ age: 34 }));
    const changed = Object.keys(a).filter(k => a[k] !== b[k]);
    const allowed = new Set(['hairColor', 'hairStyle', 'faceMarks', 'scarStyle', 'outfitStyle', 'accessory', 'trunksColor', 'accentColor', 'beardStyle', 'mouthStyle', 'eyeShape']);
    for (const k of changed) expect(allowed.has(k), `categoria inesperada mudou: ${k}`).toBe(true);
    for (const k of ANATOMY) expect(a[k]).toBe(b[k]);
  });

  it('arquétipo não muda quando popularidade cruza 70', () => {
    const a = VisualIdentityService.resolveArchetypeId(mk({ popularity: 69 }));
    const b = VisualIdentityService.resolveArchetypeId(mk({ popularity: 71 }));
    expect(a).toBe(b);
  });

  it('arquétipo não muda com idade/cartel', () => {
    const a = VisualIdentityService.resolveArchetypeId(mk({ age: 24, record: { wins: 2, losses: 0, draws: 0 } }));
    const b = VisualIdentityService.resolveArchetypeId(mk({ age: 38, record: { wins: 20, losses: 9, draws: 0 } }));
    expect(a).toBe(b);
  });
});

describe('identidade visual — colisões e catálogo', () => {
  it('chapéu/boné/gorro rebaixam cabelo alto frontal (sem atravessar o desenho)', () => {
    for (const headwear of HEADWEAR_ACCESSORY_IDXS) {
      for (const tallHair of TALL_HAIR_IDXS) {
        const withHat = PortraitService.render({ hairStyle: tallHair, accessory: headwear }, { size: 96 });
        const noHat = PortraitService.render({ hairStyle: tallHair, accessory: 0 }, { size: 96 });
        const buzzWithHat = PortraitService.render({ hairStyle: 2, accessory: headwear }, { size: 96 });
        // Com chapéu, o cabelo frontal vira a silhueta do buzz — o SVG do
        // cabelo alto + chapéu tem que bater com buzz + chapéu (exceto
        // hairBack, que pode diferir pra cabelos longos)
        expect(withHat).not.toBe(noHat);
        if (![13, 15, 20, 21, 23, 7, 8].includes(tallHair)) {
          expect(withHat).toBe(buzzWithHat);
        }
      }
    }
  });

  it('nenhuma opção de nenhuma categoria é visualmente morta', () => {
    const base = { bodyType: 1, hairStyle: 6, beardStyle: 4, outfitStyle: 0 };
    for (const cat of APPEARANCE_CATEGORIES) {
      const seen = new Set();
      for (let i = 0; i < cat.options.length; i++) {
        const svg = PortraitService.render({ ...base, [cat.key]: i }, { size: 96 });
        expect(seen.has(svg), `${cat.key}[${i}] (${cat.options[i].label}) produz imagem idêntica a outra opção`).toBe(false);
        seen.add(svg);
      }
    }
  });

  it('appearance corrompida/incompleta normaliza sem quebrar', () => {
    for (const bad of [null, undefined, {}, { hairStyle: 999, skinTone: -5 }, { hairStyle: 'x' }]) {
      const svg = PortraitService.render(bad, { size: 96 });
      expect(svg).toContain('<svg');
    }
  });
});
