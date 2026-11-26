import { describe, expect, it } from 'vitest';
import { analizzaIsolamento, valutaIsolamento } from '../src/analysis/insulation';
import { S, codici, iso, m } from './fixtures';

describe('valutaIsolamento', () => {
  it('soglie del manuale: <2 MΩ basso, <20 attenzione (richiesti 15÷20 MΩ), OL ok', () => {
    expect(valutaIsolamento(0.2, S)).toBe('basso');
    expect(valutaIsolamento(1.5, S)).toBe('basso');
    expect(valutaIsolamento(5, S)).toBe('attenzione');
    expect(valutaIsolamento(20, S)).toBe('ok');
    expect(valutaIsolamento('OL', S)).toBe('ok');
  });
});

describe('analizzaIsolamento', () => {
  it('tutto OL su entrambi i rami: nessuna anomalia', () => {
    expect(analizzaIsolamento([...iso('A'), ...iso('B')], S)).toEqual([]);
  });

  it('valore basso solo sul + = positivo guasto', () => {
    const r = analizzaIsolamento(iso('A', { pT: 0.3 }), S);
    expect(codici(r)).toEqual(['ISO_TERRA_POS_A']);
    expect(r[0].gravita).toBe('alta');
    expect(r[0].doveIntervenire.join(' ')).toMatch(/metà/);
    expect(r[0].doveIntervenire.join(' ')).toMatch(/isolatori NON separano/);
  });

  it('valore basso solo sul − = negativo guasto', () => {
    expect(codici(analizzaIsolamento(iso('B', { nT: 0.05 }), S))).toEqual(['ISO_TERRA_NEG_B']);
  });

  it('entrambi bassi: indica il più basso come conduttore probabile', () => {
    const r = analizzaIsolamento(iso('A', { pT: 0.8, nT: 0.1 }), S);
    expect(codici(r)).toEqual(['ISO_TERRA_ENTRAMBI_A']);
    expect(r[0].spiegazione).toMatch(/negativo/);
  });

  it('entrambi bassi e simili: non distinguibile', () => {
    expect(analizzaIsolamento(iso('A', { pT: 0.5, nT: 0.45 }), S)[0].spiegazione).toMatch(/non si distingue/);
  });

  it('isolamento ridotto (tra 1 e 20 MΩ) = media', () => {
    const r = analizzaIsolamento(iso('A', { pT: 8 }), S);
    expect(codici(r)).toEqual(['ISO_TERRA_RIDOTTO_PT_A']);
    expect(r[0].gravita).toBe('media');
  });

  it('calza/terra bassa = schermo a massa o a terra in più punti', () => {
    const r = analizzaIsolamento(iso('A', { cT: 0.2 }), S);
    expect(codici(r)).toEqual(['ISO_CALZA_TERRA_A']);
    expect(r[0].spiegazione).toMatch(/solo in centrale/);
  });

  it('+/calza non infinito = contatto schermo-conduttore, anche se alto (bassa)', () => {
    expect(analizzaIsolamento(iso('A', { pC: 200 }), S)[0]).toMatchObject({ codice: 'ISO_CALZA_COND_POS_A', gravita: 'bassa' });
    expect(analizzaIsolamento(iso('A', { nC: 0.1 }), S)[0]).toMatchObject({ codice: 'ISO_CALZA_COND_NEG_A', gravita: 'alta' });
  });

  it('conduttore su calza + calza a terra = la dispersione passa dallo schermo', () => {
    const r = analizzaIsolamento(iso('A', { pT: 0.2, cT: 0.3, pC: 0.1 }), S);
    expect(codici(r)).toContain('ISO_CATENA_SCHERMO_A');
    expect(codici(r)).toContain('ISO_TERRA_POS_A');
  });

  it('dispersione vista solo dal ramo A = linea interrotta, guasto lato A', () => {
    const r = analizzaIsolamento([...iso('A', { nT: 0.2 }), ...iso('B')], S);
    expect(codici(r)).toEqual(['ISO_TERRA_NEG_A', 'ISO_SOLO_A']);
  });

  it('dispersione vista da entrambi i rami: nessun "solo da"', () => {
    const r = analizzaIsolamento([...iso('A', { nT: 0.2 }), ...iso('B', { nT: 0.2 })], S);
    expect(codici(r)).not.toContain('ISO_SOLO_A');
  });

  it('vale l\'ultima misura registrata (rimisura dopo intervento)', () => {
    expect(analizzaIsolamento([m('A', 'pT', 0.1), m('A', 'pT', 'OL')], S)).toEqual([]);
  });

  it('soglie modificabili', () => {
    expect(analizzaIsolamento(iso('A', { pT: 3 }), { ...S, isolamentoMinMOhm: 5 })[0].codice).toBe('ISO_TERRA_POS_A');
  });
});
