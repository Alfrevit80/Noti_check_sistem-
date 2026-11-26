// Operazioni sulla sessione di verifica di un loop. Ogni modifica rilevante aggiunge un evento
// alla cronologia (che finisce nel rapportino).
import { db as dbApp, type NcsDB } from './db';
import { adesso, nuovoId } from './repo';
import type { Cavo, EsitoLoop, Evento, Misura, Riconoscimento, Sessione, Sintomo } from '../model/types';
import { testoEventoMisura } from '../analysis/sessione';
import { ESITI_LOOP } from '../ui/etichette';

const TESTO_SINTOMO: Record<Sintomo['tipo'], string> = {
  dispersione: 'Dispersione verso terra',
  loop_aperto: 'Loop aperto',
  corto: 'Cortocircuito',
  guasto: 'Guasto',
  nessuno: 'Nessuna segnalazione',
};
export const testoSintomo = (t: Sintomo['tipo']) => TESTO_SINTOMO[t];

const testoRamoSintomo = (r: Sintomo['ramo']) =>
  r === 'A' || r === 'B' ? `ramo ${r}` : r === 'entrambi' ? 'entrambi i rami' : 'ramo non indicato';

async function modifica(id: string, d: NcsDB, fn: (s: Sessione) => Sessione) {
  await d.transaction('rw', d.sessioni, async () => {
    const s = await d.sessioni.get(id);
    if (!s) throw new Error('Verifica non trovata');
    await d.sessioni.put(fn(s));
  });
}

const evento = (testo: string, automatico = true, rif?: string, ora = adesso()): Evento => ({ id: nuovoId(), ora, testo, automatico, rif });

export async function registraMisura(
  sessioneId: string,
  m: Pick<Misura, 'ramo' | 'tipo' | 'valore'> & { nota?: string },
  d: NcsDB = dbApp,
): Promise<Misura> {
  const misura: Misura = { id: nuovoId(), ora: adesso(), nota: m.nota ?? '', ramo: m.ramo, tipo: m.tipo, valore: m.valore };
  await modifica(sessioneId, d, (s) => ({
    ...s,
    misure: [...s.misure, misura],
    eventi: [...s.eventi, evento(testoEventoMisura(m.ramo, m.tipo, m.valore), true, misura.id, misura.ora)],
  }));
  return misura;
}

export async function eliminaMisura(sessioneId: string, misuraId: string, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({
    ...s,
    misure: s.misure.filter((x) => x.id !== misuraId),
    eventi: s.eventi.filter((e) => e.rif !== misuraId),
  }));
}

export async function impostaSintomo(sessioneId: string, sintomo: Omit<Sintomo, 'ora'>, d: NcsDB = dbApp) {
  const ora = adesso();
  const testo = `Sintomo segnalato dalla centrale: ${TESTO_SINTOMO[sintomo.tipo]}${
    sintomo.tipo === 'nessuno' ? '' : ` (${testoRamoSintomo(sintomo.ramo)})`
  }${sintomo.descrizione ? ` — ${sintomo.descrizione}` : ''}`;
  await modifica(sessioneId, d, (s) => ({
    ...s,
    sintomo: { ...sintomo, ora },
    // un solo evento "sintomo": se lo si corregge, si aggiorna
    eventi: [...s.eventi.filter((e) => e.rif !== 'sintomo'), evento(testo, true, 'sintomo', s.sintomo?.ora ?? ora)],
  }));
}

/** Aggiorna solo i campi indicati, sul valore attuale nel database (due salvataggi ravvicinati non si sovrascrivono). */
export async function salvaCavo(sessioneId: string, patch: Partial<Cavo>, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({ ...s, cavo: { ...s.cavo, ...patch } }));
}

export async function salvaRiconoscimento(sessioneId: string, r: Omit<Riconoscimento, 'id' | 'ora'> & { id?: string }, d: NcsDB = dbApp) {
  const id = r.id ?? nuovoId();
  await modifica(sessioneId, d, (s) => {
    const esistente = s.riconoscimenti.find((x) => x.id === id);
    const nuovo: Riconoscimento = { ...r, id, ora: esistente?.ora ?? adesso() };
    const tot = nuovo.righe.reduce((a, x) => ({ nuo: a.nuo + x.nuo, inc: a.inc + x.inc, tot: a.tot + x.tot, man: a.man + x.man }), { nuo: 0, inc: 0, tot: 0, man: 0 });
    const testo = `Riconoscimento automatico della centrale: TOT ${tot.tot}, NUO ${tot.nuo}, INC ${tot.inc}, MAN ${tot.man}`;
    return {
      ...s,
      riconoscimenti: esistente ? s.riconoscimenti.map((x) => (x.id === id ? nuovo : x)) : [...s.riconoscimenti, nuovo],
      eventi: [...s.eventi.filter((e) => e.rif !== id), evento(testo, true, id, nuovo.ora)],
    };
  });
  return id;
}

export async function eliminaRiconoscimento(sessioneId: string, id: string, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({
    ...s,
    riconoscimenti: s.riconoscimenti.filter((x) => x.id !== id),
    eventi: s.eventi.filter((e) => e.rif !== id),
  }));
}

export async function aggiungiNota(sessioneId: string, testo: string, d: NcsDB = dbApp, ora = adesso()) {
  if (!testo.trim()) return;
  await modifica(sessioneId, d, (s) => ({ ...s, eventi: [...s.eventi, evento(testo.trim(), false, undefined, ora)] }));
}

export async function eliminaEvento(sessioneId: string, eventoId: string, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({ ...s, eventi: s.eventi.filter((e) => e.id !== eventoId) }));
}

export async function aggiornaSessione(sessioneId: string, patch: Partial<Pick<Sessione, 'note' | 'attivitaDaEseguire' | 'tecnico' | 'strumento' | 'esito'>>, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({ ...s, ...patch }));
}

/** Chiude la verifica con l'esito scelto e lo riporta sul loop. */
export async function chiudiSessione(sessioneId: string, esito: EsitoLoop, d: NcsDB = dbApp) {
  const ora = adesso();
  let loopId = '';
  const testo = `Verifica chiusa — esito: ${ESITI_LOOP.find((x) => x.valore === esito)?.testo ?? esito}`;
  await modifica(sessioneId, d, (s) => {
    loopId = s.loopId;
    return { ...s, esito, fine: ora, eventi: [...s.eventi.filter((e) => e.rif !== 'chiusura'), evento(testo, true, 'chiusura', ora)] };
  });
  await d.loops.update(loopId, { esito });
}

export async function riapriSessione(sessioneId: string, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({ ...s, fine: undefined, eventi: s.eventi.filter((e) => e.rif !== 'chiusura') }));
}

export async function eliminaSessione(sessioneId: string, d: NcsDB = dbApp) {
  await d.transaction('rw', [d.sessioni, d.foto], async () => {
    await d.foto.where('sessioneId').equals(sessioneId).delete();
    await d.sessioni.delete(sessioneId);
  });
}

/** Cronologia ordinata per ora. */
export const cronologia = (s: Pick<Sessione, 'eventi'>) => [...s.eventi].sort((a, b) => (a.ora < b.ora ? -1 : a.ora > b.ora ? 1 : 0));
