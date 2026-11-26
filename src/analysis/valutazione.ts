// Valutazione immediata di un singolo valore (colore in tabella e riscontro nella procedura guidata).
import type { Soglie, TipoMisura, ValoreMisura } from '../model/types';
import { valutaIsolamento } from './insulation';
import { num } from './misure';

export type Valutazione = 'ok' | 'attenzione' | 'basso';

export function valutaMisura(tipo: TipoMisura, v: ValoreMisura, s: Soglie): Valutazione {
  switch (tipo) {
    case 'pT':
    case 'nT':
    case 'cT':
      return valutaIsolamento(v, s);
    case 'pC':
    case 'nC': {
      // devono essere infiniti
      if (v === 'OL') return 'ok';
      return valutaIsolamento(v, s) === 'basso' ? 'basso' : 'attenzione';
    }
    case 'rP':
    case 'rN': {
      if (v === 'OL') return 'basso';
      const limite = tipo === 'rN' ? s.rNegMaxOhm : s.rLoopMaxOhm / 2;
      return v > limite ? 'basso' : v > limite * 0.9 ? 'attenzione' : 'ok';
    }
    case 'pN':
    case 'nP': {
      if (v === 'OL') return 'attenzione';
      const [min, max] = tipo === 'pN' ? s.lineaPN : s.lineaNP;
      return v < min * 0.5 ? 'basso' : v < min || v > max ? 'attenzione' : 'ok';
    }
    case 'rC':
      return v === 'OL' ? 'basso' : 'ok';
    case 'cap':
      return num(v) > s.capacitaMaxUF ? 'attenzione' : 'ok';
    case 'vLin':
      return num(v) < s.vLineaMinV ? 'basso' : 'ok';
    case 'vRes':
      return Math.abs(num(v)) > s.vResiduaMaxV ? 'basso' : 'ok';
    case 'vRit':
      return num(v) < s.vRitornoMinV ? 'basso' : 'ok';
  }
}

export const TESTO_VALUTAZIONE: Record<TipoMisura, Record<Valutazione, string>> = {
  pT: { ok: 'Isolamento buono', attenzione: 'Isolamento ridotto', basso: 'Dispersione: valore sotto soglia' },
  nT: { ok: 'Isolamento buono', attenzione: 'Isolamento ridotto', basso: 'Dispersione: valore sotto soglia' },
  cT: { ok: 'Calza isolata', attenzione: 'Isolamento calza ridotto', basso: 'Calza a terra / a massa' },
  pC: { ok: 'Nessun contatto con lo schermo', attenzione: 'Valore non infinito: possibile contatto con lo schermo', basso: 'Contatto con lo schermo' },
  nC: { ok: 'Nessun contatto con lo schermo', attenzione: 'Valore non infinito: possibile contatto con lo schermo', basso: 'Contatto con lo schermo' },
  rP: { ok: 'Nei limiti', attenzione: 'Vicino al limite', basso: 'Fuori limite o conduttore interrotto' },
  rN: { ok: 'Nei limiti', attenzione: 'Vicino al limite', basso: 'Fuori limite o conduttore interrotto' },
  pN: { ok: 'Nei valori del manuale', attenzione: 'Fuori dai valori del manuale', basso: 'Molto basso: possibile corto o polarità invertita' },
  nP: { ok: 'Nei valori del manuale', attenzione: 'Fuori dai valori del manuale', basso: 'Molto basso: possibile corto o polarità invertita' },
  rC: { ok: 'Schermo continuo', attenzione: '', basso: 'Schermo interrotto' },
  cap: { ok: 'Capacità nei limiti', attenzione: 'Capacità oltre 0,5 μF', basso: '' },
  vLin: { ok: 'Tensione di linea corretta', attenzione: '', basso: 'Sotto 14 V: possibile inversione dei collegamenti' },
  vRes: { ok: 'Linea scarica', attenzione: '', basso: 'Linea carica: scaricarla prima delle misure in Ω' },
  vRit: { ok: 'Tensione di ritorno sufficiente', attenzione: '', basso: 'Tensione di ritorno bassa: resistenza di linea troppo alta' },
};
