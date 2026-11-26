import { describe, expect, it } from 'vitest';
import { analizzaLinea } from '../src/analysis/linea';
import { aggiornaSoglie, SOGLIE_PREDEFINITE } from '../src/settings/defaults';
import { S, codici, m } from './fixtures';

describe('linea + / − con dispositivi (manuale: 1÷1,3 e 0,7÷0,9 MΩ)', () => {
  it('valori nei range: nessuna anomalia', () => {
    expect(analizzaLinea([m('A', 'pN', 1.1), m('A', 'nP', 0.8)], S)).toEqual([]);
  });
  it('molto basso = corto o polarità invertita (alta)', () => {
    const r = analizzaLinea([m('A', 'pN', 0.2)], S);
    expect(r[0]).toMatchObject({ codice: 'LINEA_PN_BASSA_A', gravita: 'alta' });
  });
  it('poco fuori range = bassa; OL = media', () => {
    expect(analizzaLinea([m('B', 'nP', 1.0)], S)[0]).toMatchObject({ codice: 'LINEA_NP_FUORI_B', gravita: 'bassa' });
    expect(analizzaLinea([m('A', 'pN', 'OL')], S)[0].codice).toBe('LINEA_PN_OL_A');
  });
  it('stesso valore basso nei due versi = resistenza tra i conduttori', () => {
    expect(codici(analizzaLinea([m('A', 'pN', 0.3), m('A', 'nP', 0.3)], S))).toContain('LINEA_SIMMETRICA_A');
  });
});

describe('capacità e tensione di linea', () => {
  it('capacità oltre 0,5 μF', () => {
    expect(codici(analizzaLinea([m('loop', 'cap', 0.7)], S))).toEqual(['CAPACITA_ALTA']);
    expect(analizzaLinea([m('loop', 'cap', 0.3)], S)).toEqual([]);
  });
  it('tensione di linea sotto 14 V = inversione dei collegamenti', () => {
    const r = analizzaLinea([m('loop', 'vLin', 12)], S);
    expect(r[0].codice).toBe('TENSIONE_LINEA_BASSA');
    expect(r[0].spiegazione).toMatch(/inversione/);
    expect(analizzaLinea([m('loop', 'vLin', 24)], S)).toEqual([]);
  });
});

describe('aggiornamento soglie salvate', () => {
  it('i vecchi predefiniti non modificati passano ai valori del manuale; quelli cambiati restano', () => {
    const vecchie = { ...SOGLIE_PREDEFINITE, isolamentoMinMOhm: 1, rLoopMaxOhm: 35, versione: undefined,
      tabellaSezioni: [{ lunghezzaMaxM: 1000, sezioneMinMm2: 1.0 }, { lunghezzaMaxM: 1500, sezioneMinMm2: 1.5 }, { lunghezzaMaxM: 2500, sezioneMinMm2: 2.5 }, { lunghezzaMaxM: 3000, sezioneMinMm2: 4.0 }] };
    const n = aggiornaSoglie(vecchie);
    expect(n.isolamentoMinMOhm).toBe(2);
    expect(n.tabellaSezioni[0]).toEqual({ lunghezzaMaxM: 500, sezioneMinMm2: 0.5 });
    expect(n.rLoopMaxOhm).toBe(35);
    expect(aggiornaSoglie({ ...SOGLIE_PREDEFINITE, isolamentoMinMOhm: 1 }).isolamentoMinMOhm).toBe(1); // già v2: scelta dell'utente
  });
});
