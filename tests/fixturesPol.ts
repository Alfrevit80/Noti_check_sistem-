// Letture reali del ramo A (foto POL-200-TS inviate dal tecnico, 26/11/2026).
import type { Griglia, LetturaPol } from '../src/model/types';

/** Colonne di 10 righe (unità 0-9) a partire dalla decina indicata. */
export function daColonne(col: Record<number, string[]>): Griglia {
  const g: Griglia = {};
  for (const [dec, righe] of Object.entries(col)) righe.forEach((c, u) => c && (g[Number(dec) + u] = c));
  return g;
}

export const SENSORI_A_REALE = daColonne({
  0: ['', 'OT', 'OT', 'OT', 'OT', '', '', 'OT', 'OT', 'OT'],
  10: ['OT', 'OT', 'OT', 'OT', 'OT', 'OT', 'OT', 'OT', 'OT', '??'],
  20: ['??', 'OT', 'OT', 'OT', 'O', 'OT', 'OT', 'OT', 'OT', 'OT'],
  30: ['O', '', 'O', 'OT', 'OT', 'O', '??', '??', '??', 'OT'],
  40: ['ot', 'ot', '', 'OT', 'OT', 'OT', 'OT', 'OT', 'OT', 'OT'],
  50: ['OT', 'OT', 'OT', 'OT', '', 'OT', 'OT', 'OT', 'OT', ''],
  60: ['OT', 'OT', 'OT', 'OT', 'OT', 'OT', '', '', 'OT', 'OT'],
  70: ['OT', 'OT', 'OT', '', 'OT', 'OT', 'OT', 'OT', 'OT', 'OT'],
  80: ['OT', 'OT', 'OT', '', 'OT', 'OT', 'OT', 'OT', '', 'OT'],
  90: ['OT', 'OT', 'OT', 'OT', 'OT', 'OT', '??', 'O', 'O', 'O'],
  100: ['OT', 'OT', 'OT'],
  110: ['', '', '', '', '', '', 'OT'],
  120: Array(10).fill('OT'),
});

export const MODULI_A_REALE: Griglia = { 2: 'SS', 4: 'SS', 7: 'PI', 8: 'SS', 10: 'SS', 11: 'PI', 18: 'PI' };

let k = 0;
export const lettura = (ramo: LetturaPol['ramo'], sensori: Griglia, moduli: Griglia = {}, ora?: string): LetturaPol => ({
  id: 'l' + ++k, ramo, ora: ora ?? new Date(Date.UTC(2026, 10, 26, 9, k)).toISOString(), origine: 'manuale', sensori, moduli, nota: '',
});

/** Griglia con la stessa sigla su un intervallo di indirizzi. */
export const da = (min: number, max: number, sigla = 'OT'): Griglia => {
  const g: Griglia = {};
  for (let n = min; n <= max; n++) g[n] = sigla;
  return g;
};
