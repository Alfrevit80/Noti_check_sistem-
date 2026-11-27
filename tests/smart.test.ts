import { describe, expect, it } from 'vitest';
import { analizzaMultimetroPol } from '../src/analysis/multimetroPol';
import { confrontaAB, analizzaLettura } from '../src/analysis/pol';
import { avanzamento, prossimiPassi } from '../src/analysis/prossimoPasso';
import { leggiRispostaMultimetro, testoLetturaMultimetro } from '../src/ai/copiaPerClaude';
import { valutaMisura } from '../src/analysis/valutazione';
import { SIGLE_PREDEFINITE } from '../src/settings/defaults';
import { S, codici, iso, loop, m, sessione } from './fixtures';
import { da, lettura } from './fixturesPol';

// Schermate Multimetro del POL fotografate in cantiere il 26/11/2026
const ore1312 = [m('loop', 'rP', 19), m('loop', 'rN', 9), m('loop', 'rC', 44), m('loop', 'gPN', 9), m('loop', 'gCP', 52), m('loop', 'gCN', 272)];
const ore1513 = [m('loop', 'rP', 'OL'), m('loop', 'rN', 'OL'), m('loop', 'rC', 'OL'), m('loop', 'gPN', 'OL'), m('loop', 'gCP', 'OL'), m('loop', 'gCN', 'OL'),
  m('loop', 'gTP', 'OL'), m('loop', 'gTN', 'OL'), m('loop', 'gTC', 'OL'), m('loop', 'cPN', 'OL'), m('loop', 'cCP', 10), m('loop', 'cCN', 62)];

describe('Multimetro del POL', () => {
  it('13:12 — contatto calza / positivo, perdita + / −', () => {
    const r = analizzaMultimetroPol(ore1312, S);
    expect(codici(r)).toEqual(['POLM_CALZA_CONDUTTORE', 'POLM_PIU_MENO']);
    expect(r[0].spiegazione).toMatch(/positivo/);
  });
  it('15:13 — isolamento buono, capacità sbilanciata = possibile interruzione del +', () => {
    const r = analizzaMultimetroPol(ore1513, S);
    expect(codici(r)).toEqual(['POLM_CAPACITA_SBILANCIATA']);
    expect(r[0].spiegazione).toMatch(/positivo/);
  });
  it('calza «>150 Ω» con + e − regolari = calza non collegata al POL', () => {
    expect(codici(analizzaMultimetroPol([m('loop', 'rP', 19), m('loop', 'rN', 9), m('loop', 'rC', 'OL')], S))).toEqual(['POLM_CALZA_NON_COLLEGATA']);
  });
  it('negativo 0 Ω = morsetti del POL uniti', () => {
    expect(codici(analizzaMultimetroPol([m('loop', 'rP', 'OL'), m('loop', 'rN', 0)], S))).toEqual(['POLM_ZERO_NEG']);
  });
  it('dispersione verso terra', () => {
    expect(codici(analizzaMultimetroPol([m('loop', 'gTN', 120)], S))).toEqual(['POLM_TERRA']);
  });
  it('valutazione: ogni valore misurabile di calza / conduttore è un guasto', () => {
    expect(valutaMisura('gCP', 'OL', S)).toBe('ok');
    expect(valutaMisura('gCP', 995, S)).toBe('basso');
    expect(valutaMisura('gPN', 9, S)).toBe('attenzione');
  });
});

describe('lettura della schermata Multimetro tramite Claude', () => {
  it('richiesta e risposta', () => {
    expect(testoLetturaMultimetro()).toContain('GUASTO CALZA POS');
    const r = leggiRispostaMultimetro('RES POSITIVO: 19\nRES NEGATIVO: 9\nRES CALZA: >150\nGUASTO POS-NEG: 9\nGUASTO CALZA POS: 52\nGUASTO CALZA NEG: 272\nTERRA CALZA: OL\nCAP CALZA NEG: 71\nV RITORNO: 18,5\nboh');
    expect(r).toEqual([
      { tipo: 'rP', valore: 19 }, { tipo: 'rN', valore: 9 }, { tipo: 'rC', valore: 'OL' }, { tipo: 'gPN', valore: 9 },
      { tipo: 'gCP', valore: 52 }, { tipo: 'gCN', valore: 272 }, { tipo: 'gTC', valore: 'OL' }, { tipo: 'cCN', valore: 71 }, { tipo: 'vRit', valore: 18.5 },
    ]);
  });
});

describe('portata: il segnale non arriva in fondo da nessuno dei due lati', () => {
  it('letture del 26/11 dalla centrale, lato A e lato B', () => {
    // lato A: mancano i primi del percorso (1-18, 21-23, 25-28); lato B: mancano 19, 20, 35-38, 96-99, 104-110
    const comuni = { ...da(30, 34), ...da(39, 95), ...da(100, 102), ...da(120, 129) };
    const A = lettura('A', { ...comuni, 19: 'OT', 20: 'OT', 24: 'OT', ...da(35, 38), ...da(96, 99), ...da(104, 110) });
    const B = lettura('B', { ...comuni, ...da(1, 18), ...da(21, 29) });
    const r = confrontaAB(A, B, SIGLE_PREDEFINITE, S);
    expect(r.stato).toBe('parziale');
    expect(codici(r.anomalie)).toContain('AB_PORTATA');
    expect(r.anomalie.find((a) => a.codice === 'AB_PORTATA')!.gravita).toBe('alta');
  });
  it('pochi dispositivi da un solo lato: resta il caso generico', () => {
    expect(codici(confrontaAB(lettura('A', da(1, 20)), lettura('B', da(1, 18)), SIGLE_PREDEFINITE, S).anomalie)).toContain('AB_SOLO_UN_LATO');
  });
});

describe('modalità del POL', () => {
  it('CLIP&ADV su una centrale ADV: consiglia di leggere in ADV', () => {
    const l = { ...lettura('A', da(1, 5)), modalita: 'CLIP&ADV' as const };
    expect(codici(analizzaLettura(l, loop({ protocollo: 'ADV' })))).toContain('POL_MODALITA_A');
    expect(codici(analizzaLettura({ ...l, modalita: 'ADV' }, loop()))).not.toContain('POL_MODALITA_A');
  });
});

describe('prossimo passo', () => {
  it('verifica nuova: sintomo, tensione residua, isolamento', () => {
    const p = prossimiPassi(sessione(), loop(), S);
    expect(p.map((x) => x.passo)).toEqual(['sintomo', 'scollegamento', 'isoA']);
    expect(avanzamento(sessione())).toBe(0);
  });
  it('tensione residua alta: prima di tutto scaricare la linea', () => {
    const p = prossimiPassi(sessione({ misure: [m('A', 'vRes', 12)] }), loop(), S);
    expect(p[0]).toMatchObject({ passo: 'scollegamento', urgente: true });
  });
  it('misure fatte ma manca il lato B del POL', () => {
    const s = sessione({
      sintomo: { tipo: 'loop_aperto', ramo: 'non_noto', descrizione: '', ora: '' },
      misure: [m('A', 'vRes', 0), m('B', 'vRes', 0), ...iso('A'), ...iso('B'), m('loop', 'rP', 10), m('loop', 'rN', 10)],
      letture: [lettura('A', da(1, 10))],
    });
    expect(prossimiPassi(s, loop(), S)[0].titolo).toBe('Leggi con il POL dal lato B');
    expect(avanzamento(s)).toBe(67);
  });
});
