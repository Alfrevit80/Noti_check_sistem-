// Funzioni di supporto sulle misure (pure, senza dipendenze dall'interfaccia).
import type { Misura, Ramo, TipoMisura, ValoreMisura } from '../model/types';

export type RamoMisura = Ramo | 'loop';

export interface DefMisura {
  tipo: TipoMisura;
  etichetta: string; // breve, per le tabelle
  descrizione: string; // per la procedura guidata
  unita: 'MΩ' | 'Ω' | 'V';
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
  vRit: {
    tipo: 'vRit', etichetta: 'Tensione di ritorno (POL)', descrizione: 'Tensione di ritorno letta sul POL-200-TS', unita: 'V',
    consentiOL: false, rami: ['loop'],
    istruzioni: 'Valore di tensione di ritorno indicato dal POL-200-TS a loop chiuso.',
  },
};

export const TIPI_ISOLAMENTO: TipoMisura[] = ['pT', 'nT', 'cT', 'pC', 'nC'];
export const TIPI_OHM: TipoMisura[] = ['pT', 'nT', 'cT', 'pC', 'nC', 'rP', 'rN'];

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
