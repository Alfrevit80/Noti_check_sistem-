import type { Loop, Misura, Ramo, Sessione, TipoMisura, ValoreMisura } from '../src/model/types';
import { SOGLIE_PREDEFINITE } from '../src/settings/defaults';

export const S = SOGLIE_PREDEFINITE;
let n = 0;
/** Crea una misura; l'ora cresce a ogni chiamata (così "l'ultima" è quella creata dopo). */
export const m = (ramo: Ramo | 'loop', tipo: TipoMisura, valore: ValoreMisura): Misura => ({
  id: 'm' + ++n, ramo, tipo, valore, ora: new Date(Date.UTC(2026, 10, 26, 8, 0, n)).toISOString(), nota: '',
});

/** Isolamento completo di un ramo, OL dove non indicato. */
export const iso = (ramo: Ramo, v: Partial<Record<'pT' | 'nT' | 'cT' | 'pC' | 'nC', ValoreMisura>> = {}) =>
  (['pT', 'nT', 'cT', 'pC', 'nC'] as const).map((k) => m(ramo, k, v[k] ?? 'OL'));

export const loop = (p: Partial<Loop> = {}): Loop => ({
  id: 'l', centraleId: 'c', numero: 1, scheda: 'CPU', descrizione: '', esito: 'da_verificare', note: '', ...p,
});

export const sessione = (p: Partial<Sessione> = {}): Sessione => ({
  id: 's', loopId: 'l', inizio: '', strumento: 'POL-200-TS', tecnico: '', misure: [], cavo: { tipo: '' },
  letture: [], riconoscimenti: [], eventi: [], esito: 'da_verificare', attivitaDaEseguire: '', note: '', ...p,
});

export const codici = (a: { codice: string }[]) => a.map((x) => x.codice);
