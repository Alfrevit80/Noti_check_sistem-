import { describe, expect, it } from 'vitest';
import { GUIDE_MISURE, GUIDE_PASSI } from '../src/guide/guideMisure';
import { DEF_MISURE } from '../src/analysis/misure';
import { stimaLunghezza, resistenzaConduttore } from '../src/analysis/loopResistance';
import { S } from './fixtures';

describe('linee guida delle misure', () => {
  it('ogni misura ha la sua guida completa', () => {
    for (const tipo of Object.keys(DEF_MISURE) as (keyof typeof DEF_MISURE)[]) {
      const g = GUIDE_MISURE[tipo];
      expect(g, tipo).toBeDefined();
      expect(g.strumento.length).toBeGreaterThan(5);
      expect(g.esecuzione.length).toBeGreaterThan(0);
      const atteso = g.atteso(S);
      expect(atteso).not.toMatch(/undefined|NaN/);
    }
  });
  it('i valori attesi seguono le soglie impostate', () => {
    expect(GUIDE_MISURE.vRit.atteso({ ...S, vRitornoMinV: 18 })).toMatch(/18 V/);
    expect(GUIDE_MISURE.rN.atteso(S)).toMatch(/20 Ω/);
  });
  it('suggerimenti per i passi non di misura', () => {
    for (const p of ['sintomo', 'cavo', 'pol', 'riconoscimento']) expect(GUIDE_PASSI[p].length).toBeGreaterThan(0);
  });
});

describe('stima della lunghezza dalla resistenza', () => {
  it('è l\'inverso della resistenza attesa', () => {
    expect(stimaLunghezza(resistenzaConduttore(1200, 1.5), 1.5)).toBe(1200);
    expect(stimaLunghezza(13, 1.5)).toBe(1000);
  });
});
