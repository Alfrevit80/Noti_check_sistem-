import testo0 from './dati/26112600.MNT?raw';
import testo1 from './dati/26112601.MNT?raw';
import { describe, expect, it } from 'vitest';
import { datiIllegibili, leggiMnt, letturaDaMnt } from '../src/import/mnt';
import { analizzaDettagli, analizzaFileLetture, analizzaMappa, confrontaDettagli, costruisciMappa, dorsale } from '../src/analysis/mappa';
import { indirizzi } from '../src/analysis/pol';
import { SIGLE_PREDEFINITE } from '../src/settings/defaults';
import { S, codici } from './fixtures';

// File reali del POL-200-TS (ramo A, 26/11/2026), seriali anonimizzati
const f0 = leggiMnt(testo0, '26112600.MNT');
const f1 = leggiMnt(testo1, '26112601.MNT');
const l0 = letturaDaMnt(f0, 'A', 'l0', '2026-11-26T09:00:00Z');
const l1 = letturaDaMnt(f1, 'A', 'l1', '2026-11-26T09:05:00Z');

describe('lettore .MNT', () => {
  it('intestazione, colonne, dispositivi', () => {
    expect(f0.software).toBe('Mar 16 2021');
    expect(f0.database).toBe('Oct 24 2017');
    expect(f0.dispositivi).toHaveLength(111);
    expect(f0.dispositivi.filter((d) => d.famiglia === 'moduli')).toHaveLength(7);
    expect(f0.avvisi).toEqual([]);
    const d1 = f0.dispositivi[0];
    expect(d1).toMatchObject({ indirizzo: 1, famiglia: 'sensori', tipoCodice: '020', tipoNome: 'OTTIC0(EU)', costruttore: 'NOT', dataProd: '25/49', dep: 'S002', iso: 'Y', sta: '050' });
    expect(d1.pw).toEqual([302, 302, 302, 797, 893]);
    expect(f0.dispositivi.find((d) => d.famiglia === 'moduli' && d.indirizzo === 2)).toMatchObject({ tipoNome: 'SIR.STROBE WSS', dep: 'S018' });
    expect(f0.dispositivi.find((d) => d.indirizzo === 40 && d.famiglia === 'sensori')!.dep).toBe('');
  });

  it('tollerante: tabulazioni, righe sporche, file sbagliato', () => {
    const t = 'Add  M/S  Type  Man  Serial N  YY/WW  PW1  I  DEP\n\n5\tS\t020\tOTTIC0(EU)\tNOT\t1234ABCD\t25/49\t0300\t049\tPNL\nriga strana\n';
    const f = leggiMnt(t);
    expect(f.dispositivi[0]).toMatchObject({ indirizzo: 5, dep: 'PNL', pw: [300], corrente: 49 });
    expect(f.avvisi[0]).toMatch(/non riconosciuta/);
    expect(leggiMnt('ciao').avvisi[0]).toMatch(/Nessun dispositivo/);
  });

  it('conversione in griglia: sigle dai tipi, «??» per le risposte corrotte', () => {
    expect(l0.sensori[1]).toBe('OT');
    expect(l0.moduli[7]).toBe('PI');
    expect(l0.moduli[2]).toBe('SS');
    const incerti = indirizzi(l0.sensori).filter((n) => l0.sensori[n] === '??');
    expect(incerti).toEqual([19, 20, 36, 37, 38, 96, 98, 99, 104, 105]);
    expect(datiIllegibili({ seriale: 'XXXXXXXX', costruttore: 'NOT' })).toBe(true);
  });
});

describe('mappatura dal DEP', () => {
  const m = costruisciMappa(f0.dispositivi);
  it('percorso fisico dalla centrale', () => {
    expect(m.radici.map((r) => r.id)).toEqual(['S002']);
    const d = dorsale(m).map((n) => n.id);
    expect(d.slice(0, 6)).toEqual(['S002', 'S001', 'S004', 'S003', 'S007', 'S008']);
    expect(d).toContain('M018');
    expect(d[d.length - 2]).toBe('M004');
  });
  it('derivazioni, non mappati', () => {
    expect(m.derivazioni.map((n) => n.id).sort()).toEqual(['M004', 'M018', 'S039', 'S065', 'S075']);
    expect(m.nonMappati.map((x) => x.indirizzo).sort((a, b) => a - b)).toEqual([40, 97, 104, 105]);
  });
  it('regole: ultimo dispositivo, corrotti in fondo al ramo', () => {
    const r = analizzaMappa(l0, SIGLE_PREDEFINITE, S);
    expect(codici(r)).toEqual(['MAPPA_FINE_A', 'MAPPA_DERIVAZIONI_A', 'MAPPA_CORROTTI_IN_FONDO_A', 'MAPPA_NON_MAPPATI_A']);
    expect(r[0].titolo).toBe('Ultimo punto del percorso (lato A): Modulo 4, da cui dipendono S19, S20, S32, S96, S98, S99');
    expect(r[2].spiegazione).toMatch(/S19, S20/);
  });
});

describe('regole sui dettagli', () => {
  it('risposte corrotte e STA anomalo (HON/MOR/HMI qui hanno seriale illeggibile: già tra le corrotte)', () => {
    const r = analizzaDettagli(l0);
    expect(codici(r)).toEqual(['MNT_ILLEGGIBILI_A', 'MNT_STA_A']);
    expect(r[0].titolo).toContain('S37');
  });
  it('costruttore diverso con seriale leggibile', () => {
    const l = { ...l0, dettagli: l0.dettagli!.map((d) => (d.indirizzo === 1 && d.famiglia === 'sensori' ? { ...d, costruttore: 'HON' } : d)) };
    expect(analizzaDettagli(l).find((a) => a.codice === 'MNT_COSTRUTTORE_A')!.titolo).toContain('S1 HON');
  });
  it('confronto tra i due file: risposte instabili e fantasma', () => {
    const r = confrontaDettagli(l0, l1);
    expect(codici(r)).toEqual(['MNT_INSTABILI_A', 'MNT_FANTASMA_A']);
    expect(r[0].titolo).toContain('S32, S35, S36, S37, S96, S98, S104, S105');
    expect(r[1].titolo).toContain('sensori 106–110');
  });
  it('analisi complessiva delle letture da file', () => {
    expect(codici(analizzaFileLetture([l0, l1], SIGLE_PREDEFINITE, S))).toContain('MNT_INSTABILI_A');
  });
});
