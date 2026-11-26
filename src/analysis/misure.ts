// Funzioni di supporto sulle misure (pure, senza dipendenze dall'interfaccia).
import type { Misura, Ramo, TipoMisura, ValoreMisura } from '../model/types';

export type RamoMisura = Ramo | 'loop';

export interface DefMisura {
  tipo: TipoMisura;
  etichetta: string; // breve, per le tabelle
  descrizione: string; // per la procedura guidata
  unita: 'MΩ' | 'Ω' | 'V' | 'μF';
  consentiOL: boolean;
  rami: RamoMisura[];
  istruzioni: string;
}

export const DEF_MISURE: Record<TipoMisura, DefMisura> = {
  vRes: {
    tipo: 'vRes', etichetta: 'Tensione residua + / −', descrizione: 'Tensione residua tra + e −', unita: 'V',
    consentiOL: false, rami: ['A', 'B'],
    istruzioni: 'Multimetro in Vcc tra + e − del ramo scollegato dalla centrale.',
  },
  pT: {
    tipo: 'pT', etichetta: '+ / terra', descrizione: 'Isolamento positivo verso terra', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Strumento in MΩ: un puntale sul + del ramo, l\'altro sulla terra della centrale.',
  },
  nT: {
    tipo: 'nT', etichetta: '− / terra', descrizione: 'Isolamento negativo verso terra', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Strumento in MΩ: un puntale sul − del ramo, l\'altro sulla terra della centrale.',
  },
  cT: {
    tipo: 'cT', etichetta: 'calza / terra', descrizione: 'Isolamento calza (schermo) verso terra', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Calza scollegata dalla terra della centrale. Un puntale sulla calza, l\'altro sulla terra.',
  },
  pC: {
    tipo: 'pC', etichetta: '+ / calza', descrizione: 'Isolamento positivo verso calza', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Un puntale sul + del ramo, l\'altro sulla calza.',
  },
  nC: {
    tipo: 'nC', etichetta: '− / calza', descrizione: 'Isolamento negativo verso calza', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Un puntale sul − del ramo, l\'altro sulla calza.',
  },
  pN: {
    tipo: 'pN', etichetta: '+ / − (tester + su +)', descrizione: 'Linea + / − con dispositivi, tester + sul +', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Con sensori e moduli installati: tester (+) sul + della linea, tester (−) sul −. Manuale: 1 ÷ 1,3 MΩ.',
  },
  nP: {
    tipo: 'nP', etichetta: '+ / − (tester + su −)', descrizione: 'Linea + / − con dispositivi, puntali invertiti', unita: 'MΩ',
    consentiOL: true, rami: ['A', 'B'],
    istruzioni: 'Puntali invertiti: tester (+) sul − della linea, tester (−) sul +. Manuale: 0,7 ÷ 0,9 MΩ.',
  },
  rP: {
    tipo: 'rP', etichetta: 'A+ → B+', descrizione: 'Resistenza del positivo da A a B', unita: 'Ω',
    consentiOL: true, rami: ['loop'],
    istruzioni: 'Ohmmetro tra il + del ramo A e il + del ramo B (entrambi scollegati dalla centrale).',
  },
  rN: {
    tipo: 'rN', etichetta: 'A− → B−', descrizione: 'Resistenza del negativo da A a B', unita: 'Ω',
    consentiOL: true, rami: ['loop'],
    istruzioni: 'Ohmmetro tra il − del ramo A e il − del ramo B (entrambi scollegati dalla centrale).',
  },
  rC: {
    tipo: 'rC', etichetta: 'Calza A → B', descrizione: 'Resistenza della calza da A a B', unita: 'Ω',
    consentiOL: true, rami: ['loop'],
    istruzioni: 'Ohmmetro tra la calza del ramo A e la calza del ramo B. Deve essere continua: circa 2–3 volte la resistenza del negativo.',
  },
  cap: {
    tipo: 'cap', etichetta: 'Capacità + / −', descrizione: 'Capacità tra + e − del loop', unita: 'μF',
    consentiOL: false, rami: ['loop'],
    istruzioni: 'Multimetro del POL-200-TS (o capacimetro) tra + e −. Massimo ammesso 0,5 μF (500 nF).',
  },
  vLin: {
    tipo: 'vLin', etichetta: 'Tensione di linea', descrizione: 'Tensione di linea con centrale alimentata', unita: 'V',
    consentiOL: false, rami: ['loop'],
    istruzioni: 'Loop ricollegato e centrale alimentata, nessun punto programmato: la tensione deve essere 24 Vcc.',
  },
  vRit: {
    tipo: 'vRit', etichetta: 'Tensione di ritorno (POL)', descrizione: 'Tensione di ritorno letta sul POL-200-TS', unita: 'V',
    consentiOL: false, rami: ['loop'],
    istruzioni: 'Valore di tensione di ritorno indicato dal POL-200-TS a loop chiuso.',
  },
};

export const TIPI_ISOLAMENTO: TipoMisura[] = ['pT', 'nT', 'cT', 'pC', 'nC'];
export const TIPI_LINEA: TipoMisura[] = ['pN', 'nP'];
export const TIPI_OHM: TipoMisura[] = ['pT', 'nT', 'cT', 'pC', 'nC', 'pN', 'nP', 'rP', 'rN', 'rC'];

/** Ultima misura registrata (per ora) di un tipo su un ramo. */
export function ultimaMisura(misure: readonly Misura[], ramo: RamoMisura, tipo: TipoMisura): Misura | undefined {
  let u: Misura | undefined;
  for (const m of misure) {
    if (m.ramo === ramo && m.tipo === tipo && (!u || m.ora >= u.ora)) u = m;
  }
  return u;
}

export function valoreUltima(misure: readonly Misura[], ramo: RamoMisura, tipo: TipoMisura): ValoreMisura | undefined {
  return ultimaMisura(misure, ramo, tipo)?.valore;
}

/** OL → Infinity. */
export const num = (v: ValoreMisura): number => (v === 'OL' ? Infinity : v);

export function formattaValore(v: ValoreMisura | undefined, unita?: string): string {
  if (v === undefined) return '—';
  if (v === 'OL') return 'OL';
  const t = Number.isInteger(v) ? String(v) : v.toLocaleString('it-IT', { maximumFractionDigits: 3 });
  return unita ? `${t} ${unita}` : t;
}

export const nomeRamo = (r: RamoMisura) => (r === 'loop' ? 'loop' : `ramo ${r}`);
