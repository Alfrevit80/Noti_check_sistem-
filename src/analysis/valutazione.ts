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
    case 'gCP':
    case 'gCN':
    case 'gTP':
    case 'gTN':
    case 'gTC':
      // fondo scala del POL 1000 kΩ (= 1 MΩ, già sotto il minimo di 2 MΩ del manuale): ogni valore misurabile è un guasto
      return v === 'OL' ? 'ok' : 'basso';
    case 'gPN':
      return v === 'OL' ? 'ok' : v < 1 ? 'basso' : v < 100 ? 'attenzione' : 'ok';
    case 'cPN':
      return v !== 'OL' && v > s.capacitaMaxUF * 1000 ? 'attenzione' : 'ok';
    case 'cCP':
    case 'cCN':
      return 'ok';
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
  gPN: { ok: 'Nessun guasto tra + e −', attenzione: 'Valore basso tra + e −: da confrontare con un loop sano', basso: 'Corto tra + e −' },
  gCP: { ok: 'Calza isolata dal +', attenzione: '', basso: 'Contatto tra calza e positivo' },
  gCN: { ok: 'Calza isolata dal −', attenzione: '', basso: 'Contatto tra calza e negativo' },
  gTP: { ok: 'Nessuna dispersione', attenzione: '', basso: 'Dispersione del positivo verso terra' },
  gTN: { ok: 'Nessuna dispersione', attenzione: '', basso: 'Dispersione del negativo verso terra' },
  gTC: { ok: 'Nessuna dispersione', attenzione: '', basso: 'Calza verso terra' },
  cPN: { ok: 'Registrata', attenzione: 'Oltre 500 nF', basso: '' },
  cCP: { ok: 'Registrata', attenzione: '', basso: '' },
  cCN: { ok: 'Registrata', attenzione: '', basso: '' },
  vRes: { ok: 'Linea scarica', attenzione: '', basso: 'Linea carica: scaricarla prima delle misure in Ω' },
  vRit: { ok: 'Tensione di ritorno sufficiente', attenzione: '', basso: 'Tensione di ritorno bassa: resistenza di linea troppo alta' },
};
