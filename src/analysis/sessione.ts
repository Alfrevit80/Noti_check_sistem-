// Analisi complessiva di una sessione di verifica del loop.
import type { EsitoLoop, Loop, Sessione, Soglie } from '../model/types';
import { ordinaAnomalie, type Anomalia } from './findings';
import { analizzaIsolamento, valutaIsolamento } from './insulation';
import { analizzaResistenza } from './loopResistance';
import { analizzaTensioni } from './voltages';
import { analizzaRiconoscimento } from './riconoscimento';
import { analizzaLinea } from './linea';
import { analizzaLetture, confrontaConCentrale } from './pol';
import { analizzaFileLetture } from './mappa';
import { analizzaRegistri } from './registro';
import { SIGLE_PREDEFINITE } from '../settings/defaults';
import type { SiglaPol } from '../model/types';
import { DEF_MISURE, TIPI_ISOLAMENTO, valoreUltima, type RamoMisura } from './misure';
import type { TipoMisura } from '../model/types';

/** Misure della procedura base: isolamento A e B, resistenza A→B. */
export const MISURE_BASE: { ramo: RamoMisura; tipo: TipoMisura }[] = [
  ...(['A', 'B'] as const).flatMap((ramo) => TIPI_ISOLAMENTO.map((tipo) => ({ ramo, tipo }))),
  { ramo: 'loop', tipo: 'rP' },
  { ramo: 'loop', tipo: 'rN' },
];

export function misureMancanti(s: Pick<Sessione, 'misure'>) {
  return MISURE_BASE.filter(({ ramo, tipo }) => valoreUltima(s.misure, ramo, tipo) === undefined);
}

function confrontoSintomo(s: Sessione, soglie: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  if (!s.sintomo) return out;
  if (s.sintomo.tipo === 'dispersione') {
    const tutti = (['A', 'B'] as const).flatMap((r) => (['pT', 'nT', 'cT'] as const).map((k) => valoreUltima(s.misure, r, k)));
    if (tutti.every((v) => v !== undefined && valutaIsolamento(v, soglie) === 'ok')) {
      out.push({
        codice: 'SINTOMO_DISPERSIONE_NON_TROVATA',
        gravita: 'info',
        titolo: 'Dispersione segnalata ma isolamento del cavo buono',
        spiegazione:
          'A cavo scollegato le misure verso terra sono buone: il guasto può essere intermittente (umidità, temperatura), su un\'altra linea collegata alla stessa scheda, oppure in centrale.',
        doveIntervenire: [
          'Ricollegare il loop e verificare se la segnalazione ricompare e su quale ramo.',
          'Controllare le altre linee della centrale (loop, sirene, alimentazioni esterne).',
          'Ripetere le misure in un momento diverso (dopo pioggia o a impianto caldo).',
        ],
      });
    }
  }
  if (s.sintomo.tipo === 'loop_aperto') {
    const rP = valoreUltima(s.misure, 'loop', 'rP');
    const rN = valoreUltima(s.misure, 'loop', 'rN');
    if (typeof rP === 'number' && typeof rN === 'number' && rP + rN <= soglie.rLoopMaxOhm) {
      out.push({
        codice: 'SINTOMO_APERTO_CONTINUITA_OK',
        gravita: 'info',
        titolo: 'Loop aperto segnalato ma continuità A→B corretta',
        spiegazione:
          'A cavo scollegato la continuità è buona: il problema può essere in centrale (morsetti del loop, scheda), un isolatore che interviene solo sotto tensione o un guasto intermittente.',
        doveIntervenire: [
          'Controllare serraggio e ordine dei morsetti A e B in centrale.',
          'Ricollegare e leggere con il POL-200-TS da entrambi i lati per vedere dove si interrompe la comunicazione.',
        ],
      });
    }
  }
  return out;
}

export function analizzaSessione(s: Sessione, loop: Loop, soglie: Soglie, sigle: readonly SiglaPol[] = SIGLE_PREDEFINITE): Anomalia[] {
  return ordinaAnomalie([
    ...analizzaTensioni(s.misure, soglie),
    ...analizzaIsolamento(s.misure, soglie),
    ...analizzaResistenza(s.misure, s.cavo, soglie),
    ...analizzaLinea(s.misure, soglie),
    ...analizzaRiconoscimento(s.riconoscimenti, loop),
    ...analizzaLetture(s.letture, loop, sigle, soglie),
    ...confrontaConCentrale(s.letture, s.riconoscimenti),
    ...analizzaFileLetture(s.letture, sigle, soglie),
    ...analizzaRegistri(s.registri, s.letture),
    ...confrontoSintomo(s, soglie),
  ]);
}

/** Esito proposto in base alle anomalie (la scelta finale resta al tecnico). */
export function esitoSuggerito(anomalie: readonly Anomalia[], s: Pick<Sessione, 'misure'>): EsitoLoop {
  if (anomalie.some((a) => a.gravita === 'critica' || a.gravita === 'alta')) return 'non_conforme';
  if (anomalie.some((a) => a.gravita === 'media')) return 'ok_con_riserva';
  if (misureMancanti(s).length > 0) return 'da_verificare';
  return 'ok';
}

/** Testo dell'evento automatico per una misura registrata. */
export function testoEventoMisura(ramo: RamoMisura, tipo: TipoMisura, valore: number | 'OL'): string {
  const d = DEF_MISURE[tipo];
  const v = valore === 'OL' ? 'OL' : `${String(valore).replace('.', ',')} ${d.unita}`;
  return `${d.descrizione}${ramo === 'loop' ? '' : ` — ramo ${ramo}`}: ${v}`;
}
