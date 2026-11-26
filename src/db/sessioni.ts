// Operazioni sulla sessione di verifica di un loop. Ogni modifica rilevante aggiunge un evento
// alla cronologia (che finisce nel rapportino).
import { db as dbApp, type NcsDB } from './db';
import { adesso, nuovoId } from './repo';
import type { RegistroPol, Cavo, ColorePol, EsitoLoop, Evento, FamigliaPol, Griglia, LetturaPol, Misura, Riconoscimento, Sessione, Sintomo } from '../model/types';
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

// ───────── Letture del POL-200-TS ─────────

const NOME_RAMO_LETTURA: Record<LetturaPol['ramo'], string> = { A: 'lato A', B: 'lato B', chiuso: 'loop chiuso' };

function testoEventoLettura(l: LetturaPol) {
  const n = (g: Griglia) => Object.values(g).filter((x) => x !== '').length;
  return `Lettura POL-200-TS ${NOME_RAMO_LETTURA[l.ramo]}: ${n(l.sensori)} sensori, ${n(l.moduli)} moduli`;
}

/** Nuova lettura; se `copiaDa` è indicato parte dalla griglia di quella lettura (per registrare solo le differenze). */
export async function creaLettura(sessioneId: string, ramo: LetturaPol['ramo'], copiaDa?: LetturaPol, d: NcsDB = dbApp): Promise<string> {
  const l: LetturaPol = {
    id: nuovoId(),
    ramo,
    ora: adesso(),
    origine: 'manuale',
    sensori: copiaDa ? { ...copiaDa.sensori } : {},
    moduli: copiaDa ? { ...copiaDa.moduli } : {},
    colori: copiaDa?.colori ? { sensori: { ...copiaDa.colori.sensori }, moduli: { ...copiaDa.colori.moduli } } : undefined,
    nota: '',
  };
  await modifica(sessioneId, d, (s) => ({ ...s, letture: [...s.letture, l], eventi: [...s.eventi, evento(testoEventoLettura(l), true, l.id, l.ora)] }));
  return l.id;
}

function conLettura(s: Sessione, letturaId: string, fn: (l: LetturaPol) => LetturaPol): Sessione {
  let nuova: LetturaPol | undefined;
  const letture = s.letture.map((l) => (l.id === letturaId ? (nuova = fn(l)) : l));
  if (!nuova) throw new Error('Lettura non trovata');
  const ev = s.eventi.find((e) => e.rif === letturaId);
  return {
    ...s,
    letture,
    eventi: ev ? s.eventi.map((e) => (e.rif === letturaId ? { ...e, testo: testoEventoLettura(nuova!) } : e)) : s.eventi,
  };
}

/** Imposta (o svuota con '') la sigla di una cella, ed eventualmente il colore. */
export async function impostaCella(
  sessioneId: string,
  letturaId: string,
  famiglia: FamigliaPol,
  indirizzo: number,
  sigla: string,
  colore: ColorePol | null,
  d: NcsDB = dbApp,
) {
  await modifica(sessioneId, d, (s) =>
    conLettura(s, letturaId, (l) => {
      const g = { ...l[famiglia] };
      const colori = { sensori: { ...l.colori?.sensori }, moduli: { ...l.colori?.moduli } };
      if (sigla) g[indirizzo] = sigla;
      else delete g[indirizzo];
      if (sigla && colore) colori[famiglia][indirizzo] = colore;
      else delete colori[famiglia][indirizzo];
      return { ...l, [famiglia]: g, colori };
    }),
  );
}

export async function aggiornaLettura(sessioneId: string, letturaId: string, patch: Partial<Pick<LetturaPol, 'nota' | 'ramo' | 'ora'>>, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => conLettura(s, letturaId, (l) => ({ ...l, ...patch })));
}

export async function eliminaLettura(sessioneId: string, letturaId: string, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({
    ...s,
    letture: s.letture.filter((l) => l.id !== letturaId),
    eventi: s.eventi.filter((e) => e.rif !== letturaId),
  }));
}

/** Aggiunge una lettura già pronta (es. importata da un file .MNT). */
export async function aggiungiLettura(sessioneId: string, l: LetturaPol, d: NcsDB = dbApp) {
  const testo = l.nomeFile ? `${testoEventoLettura(l)} (importata da ${l.nomeFile})` : testoEventoLettura(l);
  await modifica(sessioneId, d, (s) => ({ ...s, letture: [...s.letture, l], eventi: [...s.eventi, evento(testo, true, l.id, l.ora)] }));
}

// ───────── Registri nel tempo (.DAT) ─────────

export async function aggiungiRegistro(sessioneId: string, r: RegistroPol, d: NcsDB = dbApp) {
  const ore = r.campioni.map((c) => c.ora).sort();
  const hh = (s?: string) => (s ? s.slice(11, 16) : '');
  const testo = `Registro POL-200-TS ${NOME_RAMO_LETTURA[r.ramo]} (${r.nomeFile}): ${r.campioni.length} campioni${ore.length ? `, dalle ${hh(ore[0])} alle ${hh(ore[ore.length - 1])}` : ''}`;
  await modifica(sessioneId, d, (s) => ({
    ...s,
    registri: [...(s.registri ?? []), r],
    eventi: [...s.eventi, evento(testo, true, r.id, ore[0] && !Number.isNaN(Date.parse(ore[0])) ? new Date(ore[0]).toISOString() : r.importato)],
  }));
}

export async function eliminaRegistro(sessioneId: string, id: string, d: NcsDB = dbApp) {
  await modifica(sessioneId, d, (s) => ({ ...s, registri: (s.registri ?? []).filter((r) => r.id !== id), eventi: s.eventi.filter((e) => e.rif !== id) }));
}
