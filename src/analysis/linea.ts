// Regole sulle misure di linea: + / − con dispositivi collegati, capacità, tensione di linea.
import type { Misura, Soglie } from '../model/types';
import type { Anomalia } from './findings';
import { formattaValore, valoreUltima } from './misure';

const mo = (v: number | 'OL') => formattaValore(v, 'MΩ');

export function analizzaLinea(misure: readonly Misura[], s: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  for (const r of ['A', 'B'] as const) {
    for (const [tipo, [min, max], descr] of [
      ['pN', s.lineaPN, 'tester + sul +'],
      ['nP', s.lineaNP, 'puntali invertiti'],
    ] as const) {
      const v = valoreUltima(misure, r, tipo);
      if (v === undefined) continue;
      const atteso = `${String(min).replace('.', ',')} ÷ ${String(max).replace('.', ',')} MΩ`;
      if (v === 'OL') {
        out.push({
          codice: `LINEA_${tipo.toUpperCase()}_OL_${r}`,
          gravita: 'media',
          titolo: `+ / − ramo ${r} (${descr}): OL, atteso ${atteso}`,
          spiegazione: 'Nessun dispositivo visto tra + e −: ramo interrotto vicino alla centrale o dispositivi non collegati.',
          doveIntervenire: ['Verificare il collegamento del primo dispositivo del ramo e la continuità del cavo.'],
        });
      } else if (v < min * 0.5) {
        out.push({
          codice: `LINEA_${tipo.toUpperCase()}_BASSA_${r}`,
          gravita: 'alta',
          titolo: `+ / − ramo ${r} (${descr}): ${mo(v)}, atteso ${atteso}`,
          spiegazione: 'Valore molto più basso del previsto: possibile corto tra + e −, dispositivo guasto o collegato con polarità invertita.',
          doveIntervenire: [
            'Dividere la linea a metà e rimisurare per localizzare il tratto.',
            'Controllare la polarità dei collegamenti nelle basi e nei moduli.',
          ],
        });
      } else if (v < min || v > max) {
        out.push({
          codice: `LINEA_${tipo.toUpperCase()}_FUORI_${r}`,
          gravita: 'bassa',
          titolo: `+ / − ramo ${r} (${descr}): ${mo(v)}, atteso ${atteso}`,
          spiegazione: 'Valore fuori dall\'intervallo indicato dal manuale di installazione: confrontare con l\'altro ramo e con le altre linee simili.',
          doveIntervenire: ['Ripetere la misura con lo strumento stabilizzato; se confermato, controllare polarità e collegamenti.'],
        });
      }
    }
    // + / − nei due versi uguali: i dispositivi dovrebbero dare valori diversi
    const a = valoreUltima(misure, r, 'pN');
    const b = valoreUltima(misure, r, 'nP');
    if (typeof a === 'number' && typeof b === 'number' && a > 0 && Math.abs(a - b) / a < 0.05 && a < s.isolamentoMinMOhm) {
      out.push({
        codice: `LINEA_SIMMETRICA_${r}`,
        gravita: 'media',
        titolo: `+ / − ramo ${r}: stesso valore nei due versi (${mo(a)})`,
        spiegazione: 'Con i dispositivi collegati i due versi danno valori diversi; un valore uguale e basso fa pensare a una resistenza (dispersione o corto resistivo) tra i conduttori.',
        doveIntervenire: ['Ispezionare scatole e basi per umidità o conduttori che si toccano.'],
      });
    }
  }

  const cap = valoreUltima(misure, 'loop', 'cap');
  if (typeof cap === 'number' && cap > s.capacitaMaxUF) {
    out.push({
      codice: 'CAPACITA_ALTA',
      gravita: 'media',
      titolo: `Capacità + / − ${formattaValore(cap, 'μF')} (massimo ${String(s.capacitaMaxUF).replace('.', ',')} μF)`,
      spiegazione: 'Capacità oltre il limite: cavo non idoneo (non twistato o non schermato) o troppo lungo. Disturba la comunicazione.',
      doveIntervenire: ['Verificare tipo e lunghezza del cavo (twistato a passo stretto 5–10 cm, schermato).'],
    });
  }

  const vl = valoreUltima(misure, 'loop', 'vLin');
  if (typeof vl === 'number' && vl < s.vLineaMinV) {
    out.push({
      codice: 'TENSIONE_LINEA_BASSA',
      gravita: 'alta',
      titolo: `Tensione di linea ${formattaValore(vl, 'V')} (sotto ${s.vLineaMinV} V)`,
      spiegazione: 'Secondo il manuale di installazione una tensione inferiore a 14 Vcc indica un\'inversione nei collegamenti di sensori o moduli.',
      doveIntervenire: ['Controllare la polarità di basi e moduli dividendo la linea in sezioni.', 'Il POL-200-TS segnala la polarità inversa con l\'icona dedicata.'],
    });
  }
  return out;
}
