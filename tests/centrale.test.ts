import { describe, expect, it } from 'vitest';
import { analizzaCentrale } from '../src/analysis/centrale';
import { IMPOSTAZIONI_PREDEFINITE } from '../src/settings/defaults';
import type { Centrale } from '../src/model/types';

const am8200 = IMPOSTAZIONI_PREDEFINITE.profiliCentrale['AM-8200N'];
const c = (patch: Partial<Centrale>): Centrale => ({
  id: 'c', impiantoId: 'i', nome: 'C1', modello: 'AM-8200N', nodoCpu: '1',
  loopBase: 2, espansioni: [], firmware: '', note: '', ...patch,
});

describe('analizzaCentrale', () => {
  it('AM-8200N: 2 loop base, 4 con una LIB-8200N', () => {
    expect(am8200).toEqual({ loopBase: 2, loopMax: 4 });
    expect(analizzaCentrale(c({}), am8200)).toEqual([]);
    expect(analizzaCentrale(c({ espansioni: [{ modello: 'LIB-8200N', loop: 2 }] }), am8200)).toEqual([]);
  });

  it('oltre 4 loop = anomalia alta', () => {
    const r = analizzaCentrale(
      c({ espansioni: [{ modello: 'LIB-8200N', loop: 2 }, { modello: 'LIB-8200N', loop: 2 }] }),
      am8200,
    );
    expect(r[0].codice).toBe('CENTRALE_TROPPI_LOOP');
    expect(r[0].gravita).toBe('alta');
  });

  it('loop base diversi dal profilo = bassa', () => {
    expect(analizzaCentrale(c({ loopBase: 1 }), am8200).map((a) => a.codice)).toEqual(['CENTRALE_LOOP_BASE_DIVERSI']);
  });

  it('modello senza profilo: nessun controllo sui limiti', () => {
    expect(analizzaCentrale(c({ modello: 'X', loopBase: 9 }), undefined)).toEqual([]);
  });

  it('espansione con 0 loop', () => {
    expect(analizzaCentrale(c({ espansioni: [{ modello: 'LIB-8200N', loop: 0 }] }), am8200)[0].codice).toBe('CENTRALE_ESPANSIONE_VUOTA');
  });
});
