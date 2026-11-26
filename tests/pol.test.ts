import { describe, expect, it } from 'vitest';
import {
  analizzaLettura, analizzaLetture, buchi, confrontaAB, confrontaConCentrale, diffGriglie, indirizzi, intervalli, isolati,
  siglaMinuscola, statiCelle,
} from '../src/analysis/pol';
import { SIGLE_PREDEFINITE } from '../src/settings/defaults';
import { MODULI_A_REALE, SENSORI_A_REALE, da, lettura } from './fixturesPol';
import { S, codici, loop } from './fixtures';

const SIG = SIGLE_PREDEFINITE;

describe('funzioni di base', () => {
  it('intervalli', () => {
    expect(intervalli([1, 2, 3, 7, 9, 10])).toBe('1–3, 7, 9, 10');
  });
  it('minuscolo', () => {
    expect(siglaMinuscola('ot')).toBe(true);
    expect(siglaMinuscola('OT')).toBe(false);
    expect(siglaMinuscola('??')).toBe(false);
  });
  it('buchi e indirizzi isolati', () => {
    expect(buchi({ 1: 'OT', 2: 'OT', 5: 'OT' })).toEqual([3, 4]);
    expect(isolati({ ...da(1, 10), 30: 'OT', ...da(50, 55) })).toEqual([30]);
  });
});

describe('lettura reale ramo A (foto POL)', () => {
  const A = lettura('A', SENSORI_A_REALE, MODULI_A_REALE);

  it('conteggio: 102 sensori, 7 moduli', () => {
    expect(indirizzi(A.sensori)).toHaveLength(102);
    expect(indirizzi(A.moduli)).toHaveLength(7);
  });

  it('trova «??», minuscoli', () => {
    const r = analizzaLettura(A, loop({ protocollo: 'ADV' }));
    const inc = r.find((x) => x.codice === 'POL_INCERTI_SENSORI_A')!;
    expect(inc.titolo).toContain('19, 20, 36–38, 96');
    expect(inc.gravita).toBe('alta');
    expect(r.find((x) => x.codice === 'POL_MINUSCOLI_SENSORI_A')!.titolo).toContain('40, 41');
    expect(codici(r)).not.toContain('POL_INDIRIZZO_0_SENSORI_A');
  });

  it('buchi nella numerazione e richiesta del lato B', () => {
    const r = analizzaLetture([A], loop(), SIG, S);
    expect(r.find((x) => x.codice === 'POL_BUCHI_SENSORI')!.titolo).toContain('5, 6, 31, 42, 54, 59, 66, 67, 73, 83, 88, 103–115, 117–119');
    expect(r.find((x) => x.codice === 'POL_BUCHI_MODULI')!.titolo).toContain('1, 3, 5, 6, 9, 12–17');
    expect(codici(r)).toContain('POL_MANCA_LATO');
  });

  it('con protocollo CLIP gli indirizzi oltre 99 sono fuori range', () => {
    expect(codici(analizzaLettura(A, loop({ protocollo: 'CLIP' })))).toContain('POL_FUORI_RANGE_SENSORI_A');
  });
});

describe('confronto lato A / lato B', () => {
  it('loop integro', () => {
    const r = confrontaAB(lettura('A', da(1, 50)), lettura('B', da(1, 50)), SIG, S);
    expect(r.stato).toBe('integro');
    expect(codici(r.anomalie)).toEqual(['AB_INTEGRO']);
  });

  it('loop interrotto: zona dell\'interruzione, indirizzo doppio, più di 32 punti da un lato', () => {
    const r = confrontaAB(lettura('A', da(1, 40)), lettura('B', { ...da(41, 80), 10: 'OT' }), SIG, S);
    expect(r.stato).toBe('interrotto');
    expect(codici(r.anomalie)).toEqual(['AB_DOPPI_SENSORI', 'AB_INTERRUZIONE', 'AB_OLTRE_32_A', 'AB_OLTRE_32_B']);
    expect(r.anomalie[0].riferimenti).toEqual([10]);
    expect(r.anomalie[1].spiegazione).toMatch(/dopo l'indirizzo 40.*prima del 41/);
  });

  it('i moduli contano come punti di allarme solo se pulsanti', () => {
    const A = lettura('A', da(1, 30), { 1: 'PI', 2: 'PI', 3: 'PI', 4: 'SS', 5: 'SS' });
    const B = lettura('B', da(31, 60));
    expect(codici(confrontaAB(A, B, SIG, S).anomalie)).toContain('AB_OLTRE_32_A'); // 30 + 3 pulsanti = 33
    const A2 = lettura('A', da(1, 30), { 1: 'PI', 2: 'PI', 4: 'SS', 5: 'SS' });
    expect(codici(confrontaAB(A2, B, SIG, S).anomalie)).not.toContain('AB_OLTRE_32_A'); // 32
  });

  it('dispositivi da un solo lato con loop quasi integro', () => {
    const r = confrontaAB(lettura('A', da(1, 20)), lettura('B', da(1, 18)), SIG, S);
    expect(r.stato).toBe('parziale');
    expect(r.anomalie[0].spiegazione).toContain('Sensori solo da A: 19, 20');
  });

  it('tipo diverso e letture che peggiorano da un lato', () => {
    const A = lettura('A', { ...da(1, 20), 5: 'O', 15: '??', 16: 'ot' });
    const B = lettura('B', da(1, 20));
    expect(codici(confrontaAB(A, B, SIG, S).anomalie)).toEqual(['AB_INTEGRO', 'AB_TIPO_DIVERSO_SENSORI', 'AB_PEGGIORA_A_SENSORI']);
  });
});

describe('altre regole', () => {
  it('indirizzo 0 occupato', () => {
    expect(codici(analizzaLettura(lettura('A', { 0: 'OT', 1: 'OT' }), loop()))).toEqual(['POL_INDIRIZZO_0_SENSORI_A']);
  });
  it('«-» del POL = indirizzo doppio', () => {
    expect(codici(analizzaLettura(lettura('B', { 1: 'OT', 2: '-' }), loop()))).toEqual(['POL_DOPPI_POL_SENSORI_B']);
  });
  it('linea aperta per progetto con più di 32 punti', () => {
    expect(codici(analizzaLetture([lettura('chiuso', da(1, 33))], loop({ stile: 'aperto' }), SIG, S))).toContain('LINEA_APERTA_OLTRE_32');
  });
  it('totale atteso: mancano dispositivi', () => {
    const r = analizzaLetture([lettura('chiuso', da(1, 40))], loop({ totaleAttesoSensori: 45 }), SIG, S);
    expect(r.find((x) => x.codice === 'POL_TOTALE_SENSORI')!.spiegazione).toMatch(/Mancano 5/);
  });
});

describe('POL ↔ centrale', () => {
  it('confronta i totali per famiglia usando i Tipi HW', () => {
    const l = [lettura('chiuso', SENSORI_A_REALE, MODULI_A_REALE)];
    const ric = [{ id: 'r', ora: '', nota: '', righe: [
      { tipoDispositivo: 'NFX(I)-OPT', nuo: 0, inc: 0, tot: 100, man: 0 },
      { tipoDispositivo: 'MCP5A', nuo: 0, inc: 0, tot: 3, man: 0 },
      { tipoDispositivo: 'WMSS', nuo: 0, inc: 0, tot: 4, man: 0 },
    ] }];
    const r = confrontaConCentrale(l, ric);
    expect(codici(r)).toEqual(['POL_CENTRALE_SENSORI']);
    expect(r[0].titolo).toBe('Sensori: POL 102, centrale (TOT) 100');
  });
});

describe('storico e stati delle celle', () => {
  it('differenze tra due letture', () => {
    expect(diffGriglie({ 1: 'OT', 2: 'OT', 3: '??' }, { 1: 'OT', 3: 'OT', 4: 'O' })).toEqual({
      aggiunti: [4], persi: [2], cambiati: [{ indirizzo: 3, prima: '??', dopo: 'OT' }],
    });
  });

  it('stati A/B', () => {
    const st = statiCelle([lettura('A', { 1: 'OT', 2: 'OT', 3: '??' }), lettura('B', { 1: 'OT', 4: 'OT' })], 'sensori');
    expect(st).toEqual({ 1: 'entrambi', 2: 'soloA', 3: 'incerto', 4: 'soloB' });
  });

  it('dopo la chiusura: presente / perso', () => {
    const st = statiCelle([
      lettura('A', da(1, 5), {}, '2026-11-26T09:00:00Z'),
      lettura('B', da(6, 10), {}, '2026-11-26T09:10:00Z'),
      lettura('chiuso', { ...da(1, 8), 9: '??' }, {}, '2026-11-26T10:00:00Z'),
    ], 'sensori');
    expect(st[1]).toBe('presente');
    expect(st[9]).toBe('incerto');
    expect(st[10]).toBe('perso');
  });
});
