// Esportazione / importazione di un impianto completo in un file JSON.
import { db as dbApp, type NcsDB } from './db';
import { nuovoId, adesso } from './repo';
import { FORMATO_FILE, VERSIONE_FILE, progettoSchema, type FotoExport, type ProgettoFile } from '../model/schema';
import type { Centrale, Foto, Impianto, Loop, Rete, Sessione } from '../model/types';

// ───────── Blob ↔ data URL (funziona anche fuori dal browser, per i test) ─────────

export async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${b.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

export function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error('Immagine non valida nel file');
  const mime = m[1] || 'application/octet-stream';
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: mime });
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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
      dataUrl: await blobToDataUrl(f.dati),
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

export function nomeFileExport(p: Pick<ProgettoFile, 'impianto'>): string {
  const base = [p.impianto.cliente, p.impianto.nomeImpianto].filter(Boolean).join('_') || 'impianto';
  const pulito = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `NCS_${pulito}_${p.impianto.data || adesso().slice(0, 10)}.json`;
}

// ───────── Import ─────────

export class ErroreImport extends Error {}

/** Legge e valida il testo di un file di progetto. Lancia ErroreImport con un messaggio in italiano. */
export function leggiFileProgetto(testo: string): ProgettoFile {
  let json: unknown;
  try {
    json = JSON.parse(testo);
  } catch {
    throw new ErroreImport('Il file non è un JSON valido.');
  }
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
    dati: dataUrlToBlob(f.dataUrl),
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
