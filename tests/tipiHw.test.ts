import { describe, expect, it } from 'vitest';
import { TIPI_HW, cercaTipoHw } from '../src/settings/tipiHw';

describe('tipi HW', () => {
  it('codici univoci', () => {
    expect(new Set(TIPI_HW.map((t) => t.codice)).size).toBe(TIPI_HW.length);
  });
  it('ricerca tollerante a maiuscole e spazi', () => {
    expect(cercaTipoHw('nfx(i)-opt')?.famiglia).toBe('sensore');
    expect(cercaTipoHw('NRX- OPT')?.codice).toBe('NRX-OPT');
    expect(cercaTipoHw('MCP5A')?.famiglia).toBe('modulo');
  });
});
