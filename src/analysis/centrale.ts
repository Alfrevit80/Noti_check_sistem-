// Controlli sulla configurazione di una centrale.
import type { Centrale, ProfiloCentrale } from '../model/types';
import { numeroLoopTotali } from '../db/repo';
import { ordinaAnomalie, type Anomalia } from './findings';

export function analizzaCentrale(c: Centrale, profilo: ProfiloCentrale | undefined): Anomalia[] {
  const out: Anomalia[] = [];
  const totali = numeroLoopTotali(c);

  if (profilo) {
    if (totali > profilo.loopMax) {
      out.push({
        codice: 'CENTRALE_TROPPI_LOOP',
        gravita: 'alta',
        titolo: `${totali} loop configurati: la ${c.modello} ne gestisce al massimo ${profilo.loopMax}`,
        spiegazione: `La ${c.modello} ha ${profilo.loopBase} loop sulla scheda madre ed è espandibile fino a ${profilo.loopMax}.`,
        doveIntervenire: ['Controllare il numero di schede di espansione e di loop per scheda.', 'Verificare il modello di centrale selezionato.'],
      });
    }
    if (c.loopBase !== profilo.loopBase) {
      out.push({
        codice: 'CENTRALE_LOOP_BASE_DIVERSI',
        gravita: 'bassa',
        titolo: `Loop sulla scheda base: ${c.loopBase} (la ${c.modello} ne ha ${profilo.loopBase})`,
        spiegazione: 'Il numero di loop della scheda madre non corrisponde alla configurazione tipica del modello.',
        doveIntervenire: ['Verificare il dato sulla centrale o correggere il profilo del modello nelle Impostazioni.'],
      });
    }
  }

  const senzaLoop = c.espansioni.map((e, i) => ({ e, i })).filter(({ e }) => e.loop <= 0);
  if (senzaLoop.length > 0) {
    out.push({
      codice: 'CENTRALE_ESPANSIONE_VUOTA',
      gravita: 'bassa',
      titolo: 'Scheda di espansione senza loop',
      spiegazione: `Schede con 0 loop: ${senzaLoop.map(({ i }) => `#${i + 1}`).join(', ')}.`,
      doveIntervenire: ['Indicare quanti loop gestisce la scheda oppure rimuoverla.'],
    });
  }

  return ordinaAnomalie(out);
}
