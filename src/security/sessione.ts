// Gestione della sessione: creazione password, sblocco, blocco, cambio password.
import Dexie from 'dexie';
import { db as dbApp, tabelleDati, type NcsDB } from '../db/db';
import type { Foto } from '../model/types';
import {
  ITERAZIONI_PBKDF2,
  apriCassaforte,
  cambiaPasswordCassaforte,
  creaCassaforte,
  verificaRequisitiPassword,
  type Cassaforte,
} from './crypto';

export type StatoArchivio = 'nuovo' | 'bloccato' | 'sbloccato';

export async function leggiCassaforte(d: NcsDB = dbApp): Promise<Cassaforte | undefined> {
  return d.cassaforte.get('cassaforte');
}

export async function statoArchivio(d: NcsDB = dbApp): Promise<StatoArchivio> {
  if (d.sbloccato) return 'sbloccato';
  return (await leggiCassaforte(d)) ? 'bloccato' : 'nuovo';
}

/** Converte le foto salvate come Blob (versioni precedenti) in byte, che si possono cifrare. */
async function fotoInByte(foto: Foto[]): Promise<Foto[]> {
  const out: Foto[] = [];
  for (const f of foto) {
    const dati = f.dati as unknown;
    out.push(dati instanceof Blob ? { ...f, mime: f.mime || dati.type, dati: new Uint8Array(await dati.arrayBuffer()) } : f);
  }
  return out;
}

/**
 * Primo avvio: crea la password, sblocca l'archivio e cifra gli eventuali dati
 * già presenti in chiaro (creati prima che esistesse il login).
 */
export async function creaPassword(password: string, d: NcsDB = dbApp, iterazioni = ITERAZIONI_PBKDF2) {
  const errore = verificaRequisitiPassword(password);
  if (errore) throw new Error(errore);
  if (await leggiCassaforte(d)) throw new Error('La password è già stata impostata.');

  const { cassaforte, chiave } = await creaCassaforte(password, iterazioni);
  // letture fuori dalla transazione (la conversione delle foto è asincrona)
  const tabelle = tabelleDati(d);
  const contenuti = await Promise.all(tabelle.map((t) => t.toArray()));
  const iFoto = tabelle.indexOf(d.foto);
  contenuti[iFoto] = await fotoInByte(contenuti[iFoto] as Foto[]);

  d.impostaChiave(chiave);
  try {
    await d.transaction('rw', [...tabelle, d.cassaforte], async () => {
      await d.cassaforte.put(cassaforte);
      for (let i = 0; i < tabelle.length; i++) {
        // bulkPut riscrive ogni record: il middleware lo cifra
        if (contenuti[i].length) await (tabelle[i] as Dexie.Table).bulkPut(contenuti[i]);
      }
    });
  } catch (e) {
    d.impostaChiave(null);
    throw e;
  }
}

/** Ritorna false se la password è errata. */
export async function sblocca(password: string, d: NcsDB = dbApp): Promise<boolean> {
  const c = await leggiCassaforte(d);
  if (!c) throw new Error('Nessuna password impostata.');
  const chiave = await apriCassaforte(c, password);
  if (!chiave) return false;
  d.impostaChiave(chiave);
  return true;
}

export function blocca(d: NcsDB = dbApp) {
  d.impostaChiave(null);
}

/** Ritorna false se la password attuale è errata. */
export async function cambiaPassword(vecchia: string, nuova: string, d: NcsDB = dbApp): Promise<boolean> {
  const errore = verificaRequisitiPassword(nuova);
  if (errore) throw new Error(errore);
  const c = await leggiCassaforte(d);
  if (!c) throw new Error('Nessuna password impostata.');
  const nuovaC = await cambiaPasswordCassaforte(c, vecchia, nuova);
  if (!nuovaC) return false;
  await d.cassaforte.put(nuovaC);
  return true;
}

export async function impostaBloccoMinuti(minuti: number, d: NcsDB = dbApp) {
  await d.cassaforte.update('cassaforte', { bloccoMinuti: Math.max(0, Math.round(minuti)) });
}

/** Password dimenticata: cancella definitivamente tutti i dati di questo dispositivo. */
export async function eliminaTuttiIDati(d: NcsDB = dbApp) {
  d.impostaChiave(null);
  d.close();
  await Dexie.delete(d.name);
}
