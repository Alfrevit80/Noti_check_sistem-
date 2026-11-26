// Regole sul riconoscimento automatico della centrale (sommario NUO / INC / TOT / MAN).
import type { Loop, Riconoscimento } from '../model/types';
import type { Anomalia } from './findings';

export function totaliRiconoscimento(r: Riconoscimento) {
  return r.righe.reduce(
    (a, x) => ({ nuo: a.nuo + x.nuo, inc: a.inc + x.inc, tot: a.tot + x.tot, man: a.man + x.man }),
    { nuo: 0, inc: 0, tot: 0, man: 0 },
  );
}

export function ultimoRiconoscimento(rr: readonly Riconoscimento[]): Riconoscimento | undefined {
  return [...rr].sort((a, b) => (a.ora < b.ora ? 1 : -1))[0];
}

export function analizzaRiconoscimento(rr: readonly Riconoscimento[], loop: Pick<Loop, 'totaleAttesoSensori' | 'totaleAttesoModuli'>): Anomalia[] {
  const r = ultimoRiconoscimento(rr);
  if (!r) return [];
  const out: Anomalia[] = [];
  for (const x of r.righe) {
    const tipo = x.tipoDispositivo || 'dispositivi';
    if (x.man > 0) {
      out.push({
        codice: `RIC_MANCANTI_${tipo}`,
        gravita: 'alta',
        titolo: `${x.man} ${tipo} mancanti (MAN)`,
        spiegazione: 'Dispositivi programmati in centrale che non rispondono.',
        doveIntervenire: [
          'Confrontare con le letture del POL-200-TS per individuare gli indirizzi mancanti.',
          'Verificare indirizzo impostato, inserimento nella base e continuità della linea fino al dispositivo.',
        ],
      });
    }
    if (x.nuo > 0) {
      out.push({
        codice: `RIC_NUOVI_${tipo}`,
        gravita: 'media',
        titolo: `${x.nuo} ${tipo} nuovi da programmare (NUO)`,
        spiegazione: 'Dispositivi rilevati ma non ancora in archivio: vanno salvati e programmati.',
        doveIntervenire: ['Salvare il riconoscimento e completare la programmazione (zone, descrizioni, logiche).', 'Verificare che non siano indirizzi doppi o impostati per errore.'],
      });
    }
    if (x.inc > 0) {
      out.push({
        codice: `RIC_INC_${tipo}`,
        gravita: 'media',
        titolo: `${x.inc} ${tipo} con INC diverso da zero`,
        spiegazione: 'Dispositivi rilevati con dati diversi da quelli in archivio (ad esempio tipo diverso da quello programmato).',
        doveIntervenire: ['Verificare tipo e indirizzo dei dispositivi segnalati e aggiornare la programmazione.'],
      });
    }
  }
  const atteso = (loop.totaleAttesoSensori ?? 0) + (loop.totaleAttesoModuli ?? 0);
  const tot = totaliRiconoscimento(r).tot;
  if (atteso > 0 && tot !== atteso) {
    out.push({
      codice: 'RIC_TOTALE_DIVERSO',
      gravita: 'media',
      titolo: `Totale riconosciuto ${tot}, attesi ${atteso}`,
      spiegazione: tot < atteso ? `Mancano ${atteso - tot} dispositivi rispetto al progetto.` : `Ci sono ${tot - atteso} dispositivi in più rispetto al progetto.`,
      doveIntervenire: ['Verificare il totale atteso del loop e confrontare con le letture del POL-200-TS.'],
    });
  }
  return out;
}
