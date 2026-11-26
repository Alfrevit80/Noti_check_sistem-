import { describe, expect, it } from 'vitest';
import testoDat from './dati/26112600.DAT?raw';
import testoMnt from './dati/26112600.MNT?raw';
import { giri, leggiDat, sembraDat, statistiche } from '../src/import/dat';
import { leggiMnt, letturaDaMnt } from '../src/import/mnt';
import { analizzaRegistro } from '../src/analysis/registro';
import type { RegistroPol } from '../src/model/types';
import { codici } from './fixtures';

const f = leggiDat(testoDat, '26112600.DAT');
const reg: RegistroPol = { id: 'r', ramo: 'A', nomeFile: f.nomeFile, importato: '2026-11-26T14:00:00Z', campioni: f.campioni };

describe('lettore .DAT (registro nel tempo)', () => {
  it('riconosce il formato e legge i campioni', () => {
    expect(sembraDat(testoDat)).toBe(true);
    expect(sembraDat(testoMnt)).toBe(false);
    expect(f.avvisi).toEqual([]);
    expect(f.campioni).toHaveLength(1368);
    expect(f.campioni[1]).toMatchObject({ ora: '2026-11-26T13:34:53', famiglia: 'sensori', indirizzo: 1, risponde: true, pw: [302, 302, 302, 797, 893], corrente: 49, correnteIniziale: 169, sta: '050' });
    expect(f.campioni[0]).toMatchObject({ indirizzo: 0, risponde: false, sta: '000' });
  });

  it('giri: 5 di sensori (l\'ultimo interrotto) e 4 di moduli', () => {
    const g = giri(f.campioni);
    expect(g.map((x) => `${x.famiglia[0]}${x.completo ? '' : '*'}`)).toEqual(['s', 'm', 's', 'm', 's', 'm', 's', 'm', 's*']);
    expect(g[8].campioni.at(-1)!.indirizzo).toBe(87);
  });

  it('statistiche sui giri completi, solo fino all\'indirizzo 99', () => {
    const s = statistiche(f.campioni);
    expect(s.every((x) => x.indirizzo <= 99)).toBe(true);
    const s1 = s.find((x) => x.famiglia === 'sensori' && x.indirizzo === 1)!;
    expect(s1).toMatchObject({ interrogato: 4, risposte: 4 });
    expect(s.filter((x) => x.famiglia === 'moduli' && x.risposte > 0).map((x) => x.indirizzo)).toEqual([0, 2, 4, 7, 8, 10, 11, 18]);
  });
});

describe('regole sul registro', () => {
  it('modulo all\'indirizzo 0, STA diverso; nessuna risposta intermittente', () => {
    const r = analizzaRegistro(reg);
    expect(codici(r)).toEqual(['DAT_INDIRIZZO_0_A', 'DAT_VARIABILI_A', 'DAT_STA_A']);
    expect(r[1].titolo).toContain('S22 I_I 57–160');
    expect(r[0].titolo).toContain('modulo');
    expect(r[2].titolo).toContain('S3 255');
  });

  it('confronto con la lettura dello stesso lato (file .MNT)', () => {
    const l = letturaDaMnt(leggiMnt(testoMnt), 'A', 'l', '2026-11-26T13:00:00Z');
    expect(codici(analizzaRegistro(reg, [l]))).not.toContain('DAT_DIVERSO_DA_LETTURA_SENSORI_A');
  });

  it('risposta intermittente', () => {
    let k = 0;
    const camp = f.campioni.map((c) => (c.famiglia === 'sensori' && c.indirizzo === 7 && k++ === 1 ? { ...c, risponde: false, pw: [] } : c));
    const r = analizzaRegistro({ ...reg, campioni: camp });
    expect(r.find((a) => a.codice === 'DAT_INTERMITTENTI_A')!.titolo).toContain('S7 3/4');
  });

  it('file sbagliato', () => {
    expect(leggiDat('ciao').avvisi[0]).toMatch(/Nessun campione/);
  });
});
