import { describe, expect, it } from 'vitest';
import { analizzaResistenza, lunghezzaMassima, resistenzaConduttore, sezioneMinima } from '../src/analysis/loopResistance';
import { S, codici, m } from './fixtures';

const r = (p: number | 'OL', n: number | 'OL') => [m('loop', 'rP', p), m('loop', 'rN', n)];
const cavo = (lunghezzaM?: number, sezioneMm2?: number) => ({ lunghezzaM, sezioneMm2, tipo: '' });

describe('resistenza di loop', () => {
  it('valori nei limiti: nessuna anomalia', () => {
    expect(analizzaResistenza(r(15, 15), cavo(), S)).toEqual([]);
  });

  it('totale oltre 40 Ω', () => {
    expect(codici(analizzaResistenza(r(21, 20), cavo(), S))).toEqual(['RES_TOTALE_ALTA']);
  });

  it('negativo oltre 20 Ω anche con totale entro 40', () => {
    expect(codici(analizzaResistenza(r(18, 21), cavo(), S))).toEqual(['RES_NEGATIVO_ALTO']);
  });

  it('soglie configurabili', () => {
    expect(analizzaResistenza(r(15, 15), cavo(), { ...S, rLoopMaxOhm: 25 })[0].codice).toBe('RES_TOTALE_ALTA');
  });

  it('entrambi OL = loop aperto; uno solo = conduttore interrotto', () => {
    expect(codici(analizzaResistenza(r('OL', 'OL'), cavo(), S))).toEqual(['RES_LOOP_APERTO']);
    expect(codici(analizzaResistenza(r(12, 'OL'), cavo(), S))).toEqual(['RES_INTERROTTO_NEG']);
  });

  it('+ e − molto diversi = morsetto/giunzione resistiva', () => {
    const a = analizzaResistenza(r(10, 16), cavo(), S);
    expect(codici(a)).toEqual(['RES_SBILANCIATA']);
    expect(a[0].spiegazione).toMatch(/negativo/);
    expect(analizzaResistenza(r(10, 11), cavo(), S)).toEqual([]);
  });

  it('confronto con la resistenza attesa del cavo', () => {
    expect(resistenzaConduttore(1000, 1.5)).toBeCloseTo(13, 1); // tabella POL-200-TS
    expect(resistenzaConduttore(1000, 2.5)).toBeCloseTo(7.8, 1);
    expect(codici(analizzaResistenza(r(18, 18), cavo(1000, 1.5), S))).toEqual(['RES_OLTRE_CAVO_POS', 'RES_OLTRE_CAVO_NEG']);
    expect(analizzaResistenza(r(13, 13), cavo(1000, 1.5), S)).toEqual([]);
    expect(codici(analizzaResistenza(r(3, 3), cavo(1000, 1.5), S))).toEqual(['RES_SOTTO_CAVO_POS', 'RES_SOTTO_CAVO_NEG']);
  });
});

describe('sezione del cavo', () => {
  it('tabella del manuale: sezione minima per lunghezza', () => {
    expect(sezioneMinima(400, S.tabellaSezioni)).toBe(0.5);
    expect(sezioneMinima(800, S.tabellaSezioni)).toBe(1);
    expect(sezioneMinima(1200, S.tabellaSezioni)).toBe(1.5);
    expect(sezioneMinima(2000, S.tabellaSezioni)).toBe(2.5);
    expect(sezioneMinima(5000, S.tabellaSezioni)).toBeNull();
  });

  it('sezione insufficiente e lunghezza oltre tabella', () => {
    expect(codici(analizzaResistenza([], cavo(2000, 1.5), S))).toEqual(['CAVO_SEZIONE_INSUFFICIENTE']);
    expect(codici(analizzaResistenza([], cavo(3500, 2.5), S))).toEqual(['CAVO_TROPPO_LUNGO']);
    expect(codici(analizzaResistenza([], cavo(2800, 2.5), { ...S, tabellaSezioni: S.tabellaSezioni.slice(0, 3) }))).toEqual(['CAVO_OLTRE_TABELLA']);
    expect(analizzaResistenza([], cavo(1400, 1.5), S)).toEqual([]);
  });

  it('lunghezza massima per stare entro 40 Ω', () => {
    expect(Math.round(lunghezzaMassima(1.5, 40))).toBe(1538);
  });
});

describe('dal manuale di installazione', () => {
  it('solo negativo misurato: totale = 2 × negativo', () => {
    expect(codici(analizzaResistenza([m('loop', 'rN', 19)], cavo(), S))).toEqual([]);
    expect(codici(analizzaResistenza([m('loop', 'rN', 21)], cavo(), S))).toEqual(['RES_TOTALE_ALTA', 'RES_NEGATIVO_ALTO']);
  });

  it('calza: interrotta o fuori da 2–3 volte il negativo', () => {
    expect(codici(analizzaResistenza([...r(10, 10), m('loop', 'rC', 'OL')], cavo(), S))).toEqual(['RES_CALZA_INTERROTTA']);
    expect(analizzaResistenza([...r(10, 10), m('loop', 'rC', 25)], cavo(), S)).toEqual([]);
    expect(codici(analizzaResistenza([...r(10, 10), m('loop', 'rC', 60)], cavo(), S))).toEqual(['RES_CALZA_ANOMALA']);
  });
});
