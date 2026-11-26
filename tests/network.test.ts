import { describe, expect, it } from 'vitest';
import { analizzaRete } from '../src/analysis/network';
import { nuovaRete } from '../src/db/repo';
import type { Centrale, Rete } from '../src/model/types';

const centrale = (id: string, nodo: string): Centrale => ({
  id, impiantoId: 'i', nome: `C${id}`, modello: 'AM-8200N', nodoCpu: nodo,
  loopBase: 1, espansioni: [], firmware: '', note: '',
});

const reteOk = (ids: string[]): Rete => ({
  ...nuovaRete('i'),
  statoBus: 'OK',
  centraliCollegate: ids,
  checklist: nuovaRete('i').checklist.map((v) => ({ ...v, esito: 'si' })),
});

const codici = (a: { codice: string }[]) => a.map((x) => x.codice);

describe('analizzaRete', () => {
  it('nessuna anomalia con una sola centrale e indirizzo univoco', () => {
    expect(analizzaRete(null, [centrale('1', '1')])).toEqual([]);
  });

  it('segnala la rete non compilata con più centrali', () => {
    expect(codici(analizzaRete(null, [centrale('1', '1'), centrale('2', '2')]))).toEqual(['RETE_NON_COMPILATA']);
  });

  it('nessuna anomalia con rete completa e tutto OK', () => {
    expect(analizzaRete(reteOk(['1', '2']), [centrale('1', '1'), centrale('2', '2')])).toEqual([]);
  });

  it('indirizzi CPU duplicati = critica, anche senza rete', () => {
    const r = analizzaRete(null, [centrale('1', '3'), centrale('2', '3')]);
    expect(r[0].codice).toBe('RETE_NODO_DUPLICATO');
    expect(r[0].gravita).toBe('critica');
  });

  it('bus guasto e CPU non collegata', () => {
    const rete = { ...reteOk(['1']), statoBus: 'Guasto' as const };
    const r = analizzaRete(rete, [centrale('1', '1'), centrale('2', '2')]);
    expect(codici(r)).toContain('RETE_BUS_GUASTO');
    expect(codici(r)).toContain('RETE_CPU_NON_COLLEGATE');
    expect(r.find((x) => x.codice === 'RETE_CPU_NON_COLLEGATE')!.riferimenti).toEqual(['2']);
  });

  it('backup non fatto = media; voci non compilate = info; ordinate per gravità', () => {
    const rete = reteOk(['1', '2']);
    rete.checklist = rete.checklist.map((v) =>
      v.id === 'backup' ? { ...v, esito: 'no' } : v.id === 'archivi' ? { ...v, esito: 'no' } : v.id === 'orologio' ? { ...v, esito: null } : v,
    );
    const r = analizzaRete(rete, [centrale('1', '1'), centrale('2', '2')]);
    expect(codici(r)).toEqual(['RETE_CHECK_ARCHIVI', 'RETE_CHECK_BACKUP', 'RETE_CHECK_INCOMPLETA']);
    expect(r[1].gravita).toBe('media');
  });

  it('voce personalizzata "no" produce comunque un\'anomalia', () => {
    const rete = reteOk(['1', '2']);
    rete.checklist.push({ id: 'custom-x', testo: 'Alimentatore di rete', esito: 'no', nota: 'manca' });
    const r = analizzaRete(rete, [centrale('1', '1'), centrale('2', '2')]);
    expect(r[0].titolo).toContain('Alimentatore di rete');
    expect(r[0].spiegazione).toContain('manca');
  });
});

describe('indirizzo di rete (manuale: 1-32)', () => {
  it('fuori range o non numerico', () => {
    expect(analizzaRete(null, [centrale('1', '33')])[0].codice).toBe('RETE_NODO_FUORI_RANGE');
    expect(analizzaRete(null, [centrale('1', 'A')])[0].codice).toBe('RETE_NODO_FUORI_RANGE');
    expect(analizzaRete(null, [centrale('1', '32')])).toEqual([]);
  });
});
