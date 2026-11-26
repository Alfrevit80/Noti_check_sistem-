// Regole sulle tensioni: residua (prima delle misure in Ω) e di ritorno (POL-200-TS).
import type { Misura, Ramo, Soglie } from '../model/types';
import type { Anomalia } from './findings';
import { DEF_MISURE, TIPI_OHM, formattaValore, num, ultimaMisura, valoreUltima } from './misure';

export function tensioneResiduaAlta(misure: readonly Misura[], ramo: Ramo, s: Soglie): boolean {
  const v = valoreUltima(misure, ramo, 'vRes');
  return v !== undefined && Math.abs(num(v)) > s.vResiduaMaxV;
}

export function analizzaTensioni(misure: readonly Misura[], s: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  for (const r of ['A', 'B'] as const) {
    const m = ultimaMisura(misure, r, 'vRes');
    if (!m || Math.abs(num(m.valore)) <= s.vResiduaMaxV) continue;
    out.push({
      codice: `TENSIONE_RESIDUA_${r}`,
      gravita: 'alta',
      titolo: `Tensione residua sul ramo ${r}: ${formattaValore(m.valore, 'V')}`,
      spiegazione:
        'La linea è ancora carica (capacità del cavo, alimentazioni esterne, cavo non scollegato). Le misure in Ω e MΩ risultano falsate e lo strumento può danneggiarsi.',
      doveIntervenire: [
        'Verificare che il cavo sia scollegato dalla centrale e che nessun modulo sia alimentato dall\'esterno.',
        'Scaricare la linea collegando brevemente + e − (e verso terra), poi rimisurare la tensione residua.',
      ],
    });
    // misure in Ω eseguite dopo la tensione residua alta, senza una nuova misura di tensione
    const dopo = misure.filter((x) => TIPI_OHM.includes(x.tipo) && (x.ramo === r || x.ramo === 'loop') && x.ora >= m.ora);
    if (dopo.length > 0) {
      out.push({
        codice: `OHM_DA_RIPETERE_${r}`,
        gravita: 'media',
        titolo: `Misure in Ω del ramo ${r} da ripetere`,
        spiegazione: `Eseguite con tensione residua presente: ${[...new Set(dopo.map((x) => DEF_MISURE[x.tipo].etichetta))].join(', ')}.`,
        doveIntervenire: ['Scaricare la linea, verificare la tensione residua e ripetere le misure.'],
      });
    }
  }

  const vr = valoreUltima(misure, 'loop', 'vRit');
  if (typeof vr === 'number' && vr < s.vRitornoMinV) {
    out.push({
      codice: 'TENSIONE_RITORNO_BASSA',
      gravita: 'alta',
      titolo: `Tensione di ritorno bassa: ${formattaValore(vr, 'V')} (minimo ${s.vRitornoMinV} V)`,
      spiegazione: 'La resistenza della linea è troppo alta: i dispositivi lontani ricevono poca tensione.',
      doveIntervenire: [
        'Confrontare con la resistenza di loop misurata e con la sezione del cavo.',
        'Controllare giunzioni e morsetti; valutare la divisione del loop.',
      ],
    });
  }
  return out;
}
