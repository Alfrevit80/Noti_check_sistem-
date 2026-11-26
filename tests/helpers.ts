import 'fake-indexeddb/auto';
import nacl from 'tweetnacl';
import { NcsDB } from '../src/db/db';

/** Database di prova, già sbloccato con una chiave casuale. */
export async function dbDiTest(nome = 'test-' + Math.random()) {
  const d = new NcsDB(nome);
  d.impostaChiave(nacl.randomBytes(32));
  await d.open();
  return d;
}

/** Poche iterazioni PBKDF2 per tenere veloci i test. */
export const ITER_TEST = 1000;
