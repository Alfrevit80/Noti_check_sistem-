// Esportazione / importazione di un impianto completo in un file JSON.
import { db as dbApp, type NcsDB } from './db';
import { nuovoId, adesso } from './repo';
import { base64ToBytes, bytesToBase64, cifraConPassword, decifraConPassword, type PaccoCifrato } from '../security/crypto';
import { FORMATO_FILE, VERSIONE_FILE, progettoSchema, type FotoExport, type ProgettoFile } from '../model/schema';
import type { Centrale, Foto, Impianto, Loop, Rete, Sessione } from '../model/types';

// ───────── byte ↔ data URL ─────────

export function bytesToDataUrl(b: Uint8Array, mime: string): string {
  return `data:${mime || 'application/octet-stream'};base64,${bytesToBase64(b)}`;
}

export function dataUrlToBytes(url: string): { mime: string; dati: Uint8Array } {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error('Immagine non valida nel file');
  const mime = m[1] || 'application/octet-stream';
  const dati = m[2] ? base64ToBytes(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return { mime, dati };
}

// ───────── Export ─────────

export async function esportaProgetto(impiantoId: string, d: NcsDB = dbApp): Promise<ProgettoFile> {
  const impianto = await d.impianti.get(impiantoId);
  if (!impianto) throw new Error('Impianto non trovato');
  const centrali = await d.centrali.where('impiantoId').equals(impiantoId).toArray();
  const loops = await d.loops.where('centraleId').anyOf(centrali.map((c) => c.id)).toArray();
  const sessioni = await d.sessioni.where('loopId').anyOf(loops.map((l) => l.id)).toArray();
  const rete = (await d.reti.get(impiantoId)) ?? null;
  const fotoDb = await d.foto.where('impiantoId').equals(impiantoId).toArray();
  const foto: FotoExport[] = [];
  for (const f of fotoDb) {
    foto.push({
      id: f.id,
      impiantoId: f.impiantoId,
      sessioneId: f.sessioneId,
      didascalia: f.didascalia,
      ora: f.ora,
      mime: f.mime,
      dataUrl: bytesToDataUrl(f.dati, f.mime),
    });
  }
  return {
    formato: FORMATO_FILE,
    versione: VERSIONE_FILE,
    esportato: adesso(),
    impianto,
    centrali,
    rete,
    loops,
    sessioni,
    foto,
  } as ProgettoFile;
}

/** Nome del file senza dati del cliente (il nome del file resta visibile anche se il contenuto è cifrato). */
export function nomeFileExport(p: Pick<ProgettoFile, 'impianto'>): string {
  const data = (p.impianto.data || adesso().slice(0, 10)).replace(/[^0-9-]/g, '');
  const codice = p.impianto.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `NCS_${data}_${codice}.json`;
}

// ───────── File cifrato ─────────

export const FORMATO_CIFRATO = 'notifier-check-system/progetto-cifrato';

export interface FileCifrato extends PaccoCifrato {
  formato: typeof FORMATO_CIFRATO;
  versione: 1;
}

/** Esporta l'impianto in un file cifrato con la password indicata. Ritorna il testo del file. */
export async function esportaFileCifrato(impiantoId: string, password: string, d: NcsDB = dbApp, iterazioni?: number) {
  const p = await esportaProgetto(impiantoId, d);
  const pacco = await cifraConPassword(JSON.stringify(p), password, iterazioni);
  const file: FileCifrato = { formato: FORMATO_CIFRATO, versione: 1, ...pacco };
  return { nome: nomeFileExport(p), testo: JSON.stringify(file) };
}

// ───────── Import ─────────

export class ErroreImport extends Error {}

export type FileLetto = { cifrato: false; progetto: ProgettoFile } | { cifrato: true; pacco: FileCifrato };

/** Riconosce un file esportato: cifrato (serve la password) o in chiaro (versioni precedenti). */
export function leggiFile(testo: string): FileLetto {
  const json = parseJson(testo);
  if (json && typeof json === 'object' && (json as { formato?: unknown }).formato === FORMATO_CIFRATO) {
    const f = json as Partial<FileCifrato>;
    if (typeof f.sale !== 'string' || typeof f.dati !== 'string' || typeof f.iterazioni !== 'number') {
      throw new ErroreImport('File cifrato danneggiato.');
    }
    return { cifrato: true, pacco: f as FileCifrato };
  }
  return { cifrato: false, progetto: validaProgetto(json) };
}

/** Decifra un file esportato. Lancia ErroreImport se la password è errata. */
export async function decifraFile(f: FileCifrato, password: string): Promise<ProgettoFile> {
  const testo = await decifraConPassword(f, password);
  if (testo === null) throw new ErroreImport('Password errata (oppure file danneggiato).');
  return leggiFileProgetto(testo);
}

function parseJson(testo: string): unknown {
  try {
    return JSON.parse(testo);
  } catch {
    throw new ErroreImport('Il file non è un JSON valido.');
  }
}

/** Legge e valida il testo di un file di progetto in chiaro. Lancia ErroreImport con un messaggio in italiano. */
export function leggiFileProgetto(testo: string): ProgettoFile {
  return validaProgetto(parseJson(testo));
}

function validaProgetto(json: unknown): ProgettoFile {
  if (!json || typeof json !== 'object' || (json as { formato?: unknown }).formato !== FORMATO_FILE) {
    throw new ErroreImport('Il file non è un progetto di Notifier Check System.');
  }
  const v = (json as { versione?: unknown }).versione;
  if (typeof v === 'number' && v > VERSIONE_FILE) {
    throw new ErroreImport(
      `Il file è stato creato da una versione più recente dell'app (formato ${v}). Aggiorna l'app e riprova.`,
    );
  }
  const r = progettoSchema.safeParse(json);
  if (!r.success) {
    const primo = r.error.issues[0];
    throw new ErroreImport(`File danneggiato o incompleto (${primo.path.join('.') || 'radice'}: ${primo.message}).`);
  }
  return r.data;
}

export type ModoImport = 'sostituisci' | 'copia';

/**
 * Importa un progetto.
 *  - 'sostituisci': se esiste un impianto con lo stesso id, viene rimpiazzato per intero.
 *  - 'copia': tutti gli id vengono rigenerati, l'impianto viene aggiunto come nuovo.
 * Ritorna l'id dell'impianto importato.
 */
export async function importaProgetto(p: ProgettoFile, modo: ModoImport, d: NcsDB = dbApp): Promise<string> {
  const mappa = new Map<string, string>();
  const id = (vecchio: string) => {
    if (modo === 'sostituisci') return vecchio;
    let n = mappa.get(vecchio);
    if (!n) {
      n = nuovoId();
      mappa.set(vecchio, n);
    }
    return n;
  };
  const idOpt = (v?: string) => (v ? id(v) : undefined);

  const impianto: Impianto = {
    ...p.impianto,
    id: id(p.impianto.id),
    nomeImpianto: modo === 'copia' ? `${p.impianto.nomeImpianto} (copia)`.trim() : p.impianto.nomeImpianto,
    modificato: adesso(),
  };
  const centrali: Centrale[] = p.centrali.map((c) => ({ ...c, id: id(c.id), impiantoId: impianto.id }));
  const loops: Loop[] = p.loops.map((l) => ({ ...l, id: id(l.id), centraleId: id(l.centraleId) }));
  const sessioni: Sessione[] = p.sessioni.map((s) => ({
    ...(s as unknown as Sessione),
    id: id(s.id),
    loopId: id(s.loopId),
    riconoscimenti: s.riconoscimenti.map((r) => ({ ...r, fotoId: idOpt(r.fotoId) })),
  }));
  const rete: Rete | null = p.rete
    ? { ...p.rete, impiantoId: impianto.id, centraliCollegate: p.rete.centraliCollegate.map(id) }
    : null;
  const foto: Foto[] = p.foto.map((f) => ({
    id: id(f.id),
    impiantoId: impianto.id,
    sessioneId: idOpt(f.sessioneId),
    didascalia: f.didascalia,
    ora: f.ora,
    mime: f.mime,
    dati: dataUrlToBytes(f.dataUrl).dati,
  }));

  // controllo di coerenza: ogni loop deve appartenere a una centrale del file
  const idCentrali = new Set(centrali.map((c) => c.id));
  const loopsOk = loops.filter((l) => idCentrali.has(l.centraleId));
  const idLoops = new Set(loopsOk.map((l) => l.id));
  const sessioniOk = sessioni.filter((s) => idLoops.has(s.loopId));

  await d.transaction('rw', [d.impianti, d.centrali, d.reti, d.loops, d.sessioni, d.foto], async () => {
    if (modo === 'sostituisci' && (await d.impianti.get(impianto.id))) {
      const vecchieCentrali = await d.centrali.where('impiantoId').equals(impianto.id).primaryKeys();
      const vecchiLoop = await d.loops.where('centraleId').anyOf(vecchieCentrali).primaryKeys();
      await d.sessioni.where('loopId').anyOf(vecchiLoop).delete();
      await d.loops.bulkDelete(vecchiLoop);
      await d.centrali.bulkDelete(vecchieCentrali);
      await d.reti.delete(impianto.id);
      await d.foto.where('impiantoId').equals(impianto.id).delete();
    }
    await d.impianti.put(impianto);
    await d.centrali.bulkPut(centrali);
    await d.loops.bulkPut(loopsOk);
    await d.sessioni.bulkPut(sessioniOk);
    if (rete) await d.reti.put(rete);
    await d.foto.bulkPut(foto);
  });
  return impianto.id;
}
