// Operazioni sui dati. Ogni funzione accetta il database come ultimo parametro
// (predefinito: quello dell'app) così i test possono usarne uno separato.
import { db as dbApp, type NcsDB } from './db';
import type { Centrale, Impianto, Impostazioni, Loop, Rete, Sessione } from '../model/types';
import { IMPOSTAZIONI_PREDEFINITE, SOGLIE_PREDEFINITE, nuovaChecklistRete } from '../settings/defaults';

export function nuovoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const adesso = () => new Date().toISOString();
export const oggi = () => adesso().slice(0, 10);

// ───────── Impostazioni ─────────

export async function leggiImpostazioni(d: NcsDB = dbApp): Promise<Impostazioni> {
  const s = await d.impostazioni.get('app');
  // unione con i predefiniti: le chiavi aggiunte in versioni nuove non mancano mai
  return {
    ...IMPOSTAZIONI_PREDEFINITE,
    ...s,
    soglie: { ...SOGLIE_PREDEFINITE, ...s?.soglie },
    profiliCentrale: { ...IMPOSTAZIONI_PREDEFINITE.profiliCentrale, ...s?.profiliCentrale },
    id: 'app',
  };
}

export async function salvaImpostazioni(patch: Partial<Impostazioni>, d: NcsDB = dbApp) {
  const attuali = await leggiImpostazioni(d);
  await d.impostazioni.put({ ...attuali, ...patch, id: 'app' });
}

// ───────── Impianti ─────────

export async function creaImpianto(dati: Partial<Impianto> = {}, d: NcsDB = dbApp): Promise<Impianto> {
  const imp = await leggiImpostazioni(d);
  const ora = adesso();
  const nuovo: Impianto = {
    id: nuovoId(),
    cliente: '',
    nomeImpianto: '',
    indirizzo: '',
    tecnico: imp.tecnicoPredefinito,
    data: oggi(),
    note: '',
    ...dati,
    creato: ora,
    modificato: ora,
  };
  await d.impianti.add(nuovo);
  return nuovo;
}

export async function aggiornaImpianto(id: string, patch: Partial<Impianto>, d: NcsDB = dbApp) {
  await d.impianti.update(id, { ...patch, modificato: adesso() });
}

async function toccaImpianto(impiantoId: string, d: NcsDB) {
  await d.impianti.update(impiantoId, { modificato: adesso() });
}

/** Elimina l'impianto e tutto ciò che contiene. */
export async function eliminaImpianto(id: string, d: NcsDB = dbApp) {
  await d.transaction('rw', [d.impianti, d.centrali, d.reti, d.loops, d.sessioni, d.foto], async () => {
    const centrali = await d.centrali.where('impiantoId').equals(id).primaryKeys();
    const loops = await d.loops.where('centraleId').anyOf(centrali).primaryKeys();
    await d.sessioni.where('loopId').anyOf(loops).delete();
    await d.loops.bulkDelete(loops);
    await d.centrali.bulkDelete(centrali);
    await d.reti.delete(id);
    await d.foto.where('impiantoId').equals(id).delete();
    await d.impianti.delete(id);
  });
}

// ───────── Centrali ─────────

export function numeroLoopTotali(c: Pick<Centrale, 'loopBase' | 'espansioni'>): number {
  return c.loopBase + c.espansioni.reduce((s, e) => s + (e.loop || 0), 0);
}

/** Descrizione della scheda che ospita il loop n (1-based). */
export function schedaDelLoop(c: Pick<Centrale, 'loopBase' | 'espansioni'>, n: number): string {
  if (n <= c.loopBase) return 'CPU';
  let primo = c.loopBase;
  for (let i = 0; i < c.espansioni.length; i++) {
    const e = c.espansioni[i];
    if (n <= primo + e.loop) return `${e.modello || 'Espansione'} #${i + 1}`;
    primo += e.loop;
  }
  return '—';
}

export async function creaCentrale(impiantoId: string, dati: Partial<Centrale> = {}, d: NcsDB = dbApp) {
  const imp = await leggiImpostazioni(d);
  const n = await d.centrali.where('impiantoId').equals(impiantoId).count();
  const modello = dati.modello ?? imp.modelliCentrale[0] ?? 'AM-8200N';
  const c: Centrale = {
    id: nuovoId(),
    impiantoId,
    nome: `Centrale ${n + 1}`,
    modello,
    nodoCpu: String(n + 1),
    loopBase: imp.profiliCentrale[modello]?.loopBase ?? 2, // AM-8200N: 2 loop sulla scheda madre
    espansioni: [],
    firmware: '',
    note: '',
    ...dati,
  };
  await d.centrali.add(c);
  await sincronizzaLoop(c, d);
  await toccaImpianto(impiantoId, d);
  return c;
}

export async function aggiornaCentrale(id: string, patch: Partial<Centrale>, d: NcsDB = dbApp) {
  await d.centrali.update(id, patch);
  const c = await d.centrali.get(id);
  if (c) {
    await sincronizzaLoop(c, d);
    await toccaImpianto(c.impiantoId, d);
  }
}

/**
 * Crea i loop mancanti in base a loop base + espansioni e aggiorna la scheda.
 * I loop in eccesso NON vengono cancellati (potrebbero avere misure registrate):
 * restano visibili e si eliminano a mano.
 */
export async function sincronizzaLoop(c: Centrale, d: NcsDB = dbApp) {
  const totali = numeroLoopTotali(c);
  const esistenti = await d.loops.where('centraleId').equals(c.id).toArray();
  const perNumero = new Map(esistenti.map((l) => [l.numero, l]));
  for (let n = 1; n <= totali; n++) {
    const scheda = schedaDelLoop(c, n);
    const l = perNumero.get(n);
    if (!l) {
      await d.loops.add({
        id: nuovoId(),
        centraleId: c.id,
        numero: n,
        scheda,
        descrizione: '',
        esito: 'da_verificare',
        note: '',
      });
    } else if (l.scheda !== scheda) {
      await d.loops.update(l.id, { scheda });
    }
  }
}

export async function eliminaCentrale(id: string, d: NcsDB = dbApp) {
  const c = await d.centrali.get(id);
  if (!c) return;
  await d.transaction('rw', [d.centrali, d.loops, d.sessioni, d.reti, d.impianti], async () => {
    const loops = await d.loops.where('centraleId').equals(id).primaryKeys();
    await d.sessioni.where('loopId').anyOf(loops).delete();
    await d.loops.bulkDelete(loops);
    await d.centrali.delete(id);
    const rete = await d.reti.get(c.impiantoId);
    if (rete) {
      await d.reti.update(c.impiantoId, { centraliCollegate: rete.centraliCollegate.filter((x) => x !== id) });
    }
    await toccaImpianto(c.impiantoId, d);
  });
}

// ───────── Loop ─────────

export async function aggiornaLoop(id: string, patch: Partial<Loop>, d: NcsDB = dbApp) {
  await d.loops.update(id, patch);
}

export async function eliminaLoop(id: string, d: NcsDB = dbApp) {
  await d.transaction('rw', [d.loops, d.sessioni], async () => {
    await d.sessioni.where('loopId').equals(id).delete();
    await d.loops.delete(id);
  });
}

// ───────── Rete ─────────

export function nuovaRete(impiantoId: string): Rete {
  return {
    impiantoId,
    tipo: 'CANbus',
    tipoAltro: '',
    topologia: 'Anello',
    centraliCollegate: [],
    statoBus: 'Non verificato',
    checklist: nuovaChecklistRete(),
    note: '',
  };
}

export async function leggiRete(impiantoId: string, d: NcsDB = dbApp): Promise<Rete> {
  return (await d.reti.get(impiantoId)) ?? nuovaRete(impiantoId);
}

export async function salvaRete(rete: Rete, d: NcsDB = dbApp) {
  await d.reti.put(rete);
  await toccaImpianto(rete.impiantoId, d);
}

// ───────── Sessioni (usate dalla fase 2) ─────────

export async function creaSessione(loopId: string, d: NcsDB = dbApp): Promise<Sessione> {
  const imp = await leggiImpostazioni(d);
  // tecnico: quello indicato nell'impianto, altrimenti quello predefinito
  const loop = await d.loops.get(loopId);
  const centrale = loop ? await d.centrali.get(loop.centraleId) : undefined;
  const impianto = centrale ? await d.impianti.get(centrale.impiantoId) : undefined;
  const s: Sessione = {
    id: nuovoId(),
    loopId,
    inizio: adesso(),
    strumento: imp.strumentoPredefinito,
    tecnico: impianto?.tecnico || imp.tecnicoPredefinito,
    misure: [],
    cavo: { tipo: '' },
    letture: [],
    riconoscimenti: [],
    eventi: [],
    esito: 'da_verificare',
    attivitaDaEseguire: '',
    note: '',
  };
  await d.sessioni.add(s);
  return s;
}
