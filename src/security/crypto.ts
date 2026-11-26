// Cifratura dei dati.
//
// Schema:
//  - dalla password si ricava una chiave (KEK) con PBKDF2-SHA256 (WebCrypto, molte iterazioni);
//  - i dati sono cifrati con una chiave casuale (DEK) di 32 byte, XSalsa20-Poly1305 (tweetnacl, sincrono:
//    serve sincrono perché la cifratura avviene dentro le transazioni IndexedDB);
//  - la DEK è salvata cifrata con la KEK ("cassaforte"): cambiare password non richiede di ricifrare i dati.
// Senza password la DEK non si recupera e i dati non sono leggibili.
import nacl from 'tweetnacl';

export const ITERAZIONI_PBKDF2 = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ───────── base64 (anche per buffer grandi) ─────────

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ───────── Derivazione chiave ─────────

export async function derivaChiave(password: string, sale: Uint8Array, iterazioni: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iterazioni }, base, 256);
  return new Uint8Array(bits);
}

export const casuali = (n: number) => nacl.randomBytes(n);

// ───────── Cifratura generica di byte ─────────

/** Ritorna nonce (24 byte) || testo cifrato. */
export function cifraBytes(chiave: Uint8Array, dati: Uint8Array): Uint8Array {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(dati, nonce, chiave);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return out;
}

/** Ritorna null se la chiave è sbagliata o i dati sono stati alterati. */
export function decifraBytes(chiave: Uint8Array, dati: Uint8Array): Uint8Array | null {
  const n = nacl.secretbox.nonceLength;
  if (dati.length < n + nacl.secretbox.overheadLength) return null;
  return nacl.secretbox.open(dati.subarray(n), dati.subarray(0, n), chiave);
}

// ───────── Serializzazione di oggetti (con supporto Uint8Array) ─────────

const TAG_U8 = '__u8';

export function serializza(v: unknown): Uint8Array {
  const json = JSON.stringify(v, function (_k, val) {
    if (val instanceof Uint8Array) return { [TAG_U8]: bytesToBase64(val) };
    if (typeof Blob !== 'undefined' && val instanceof Blob) {
      throw new Error('I Blob vanno convertiti in Uint8Array prima del salvataggio');
    }
    return val;
  });
  return enc.encode(json);
}

export function deserializza<T = unknown>(b: Uint8Array): T {
  return JSON.parse(dec.decode(b), (_k, val) =>
    val && typeof val === 'object' && typeof val[TAG_U8] === 'string' && Object.keys(val).length === 1
      ? base64ToBytes(val[TAG_U8])
      : val,
  ) as T;
}

export const cifraOggetto = (chiave: Uint8Array, v: unknown) => cifraBytes(chiave, serializza(v));

export function decifraOggetto<T = unknown>(chiave: Uint8Array, b: Uint8Array): T {
  const chiaro = decifraBytes(chiave, b);
  if (!chiaro) throw new Error('Dati non decifrabili (chiave errata o dati danneggiati)');
  return deserializza<T>(chiaro);
}

// ───────── Cassaforte (chiave dei dati protetta dalla password) ─────────

export interface Cassaforte {
  id: 'cassaforte';
  versione: 1;
  kdf: 'PBKDF2-SHA256';
  iterazioni: number;
  sale: Uint8Array;
  chiaveCifrata: Uint8Array; // DEK cifrata con la KEK
  bloccoMinuti: number; // blocco automatico per inattività (0 = mai)
  creata: string;
}

export async function creaCassaforte(
  password: string,
  iterazioni = ITERAZIONI_PBKDF2,
): Promise<{ cassaforte: Cassaforte; chiave: Uint8Array }> {
  const chiave = nacl.randomBytes(32);
  const sale = nacl.randomBytes(16);
  const kek = await derivaChiave(password, sale, iterazioni);
  return {
    chiave,
    cassaforte: {
      id: 'cassaforte',
      versione: 1,
      kdf: 'PBKDF2-SHA256',
      iterazioni,
      sale,
      chiaveCifrata: cifraBytes(kek, chiave),
      bloccoMinuti: 15,
      creata: new Date().toISOString(),
    },
  };
}

/** Ritorna la chiave dei dati, oppure null se la password è errata. */
export async function apriCassaforte(c: Cassaforte, password: string): Promise<Uint8Array | null> {
  const kek = await derivaChiave(password, c.sale, c.iterazioni);
  return decifraBytes(kek, c.chiaveCifrata);
}

/** Ritorna la cassaforte con la nuova password, oppure null se la vecchia è errata. */
export async function cambiaPasswordCassaforte(
  c: Cassaforte,
  vecchia: string,
  nuova: string,
  iterazioni = c.iterazioni,
): Promise<Cassaforte | null> {
  const chiave = await apriCassaforte(c, vecchia);
  if (!chiave) return null;
  const sale = nacl.randomBytes(16);
  const kek = await derivaChiave(nuova, sale, iterazioni);
  return { ...c, iterazioni, sale, chiaveCifrata: cifraBytes(kek, chiave) };
}

export function verificaRequisitiPassword(p: string): string | null {
  if (p.length < 8) return 'La password deve avere almeno 8 caratteri.';
  if (/^\d+$/.test(p) && p.length < 10) return 'Una password di sole cifre deve avere almeno 10 cifre.';
  return null;
}

// ───────── File cifrati con password (esportazione) ─────────

export interface PaccoCifrato {
  kdf: 'PBKDF2-SHA256';
  iterazioni: number;
  sale: string; // base64
  dati: string; // base64 di nonce || testo cifrato
}

export async function cifraConPassword(testo: string, password: string, iterazioni = ITERAZIONI_PBKDF2): Promise<PaccoCifrato> {
  const sale = nacl.randomBytes(16);
  const k = await derivaChiave(password, sale, iterazioni);
  return { kdf: 'PBKDF2-SHA256', iterazioni, sale: bytesToBase64(sale), dati: bytesToBase64(cifraBytes(k, enc.encode(testo))) };
}

/** Ritorna null se la password è errata. */
export async function decifraConPassword(p: PaccoCifrato, password: string): Promise<string | null> {
  const k = await derivaChiave(password, base64ToBytes(p.sale), p.iterazioni);
  const b = decifraBytes(k, base64ToBytes(p.dati));
  return b ? dec.decode(b) : null;
}
