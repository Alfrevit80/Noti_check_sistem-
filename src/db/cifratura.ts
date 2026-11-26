// Middleware Dexie che cifra ogni record prima che arrivi su IndexedDB.
//
// Su disco ogni record diventa { <chiave primaria>, <campi indicizzati>, __c: <dati cifrati> }:
// restano in chiaro solo gli identificativi (UUID casuali) e i campi usati negli indici
// (id di collegamento, date). Tutto il resto (clienti, indirizzi, misure, foto, chiave API…) è cifrato.
import type { DBCore, DBCoreCursor, DBCoreTable, Middleware } from 'dexie';
import { cifraOggetto, decifraOggetto } from '../security/crypto';

export const CAMPO_CIFRATO = '__c';

export class ArchivioBloccatoError extends Error {
  constructor() {
    super('Archivio bloccato: inserisci la password.');
    this.name = 'ArchivioBloccatoError';
  }
}

function campiInChiaro(t: DBCoreTable): string[] {
  const out = new Set<string>();
  const add = (kp: string | string[] | null) => {
    if (!kp) return;
    for (const k of Array.isArray(kp) ? kp : [kp]) out.add(k.split('.')[0]);
  };
  add(t.schema.primaryKey.keyPath);
  for (const i of t.schema.indexes) add(i.keyPath);
  return [...out];
}

export function creaMiddlewareCifratura(
  getChiave: () => Uint8Array | null,
  tabelleEscluse: ReadonlySet<string>,
): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'Cifratura',
    level: -2, // sotto tutti i middleware di Dexie (cache compresa): sopra si vedono solo dati in chiaro
    create(down) {
      return {
        ...down,
        table(nome) {
          const t = down.table(nome);
          if (tabelleEscluse.has(nome)) return t;
          const chiari = campiInChiaro(t);

          const cifra = (v: Record<string, unknown>) => {
            const k = getChiave();
            if (!k) throw new ArchivioBloccatoError();
            const r: Record<string, unknown> = {};
            for (const c of chiari) if (c in v) r[c] = v[c];
            r[CAMPO_CIFRATO] = cifraOggetto(k, v);
            return r;
          };
          const decifra = (v: unknown) => {
            if (!v || typeof v !== 'object' || !(CAMPO_CIFRATO in v)) return v; // record vecchio in chiaro
            const k = getChiave();
            if (!k) throw new ArchivioBloccatoError();
            return decifraOggetto(k, (v as Record<string, Uint8Array>)[CAMPO_CIFRATO]);
          };
          const avvolgiCursore = (c: DBCoreCursor): DBCoreCursor =>
            Object.create(c, {
              value: { get: () => decifra(c.value) },
              key: { get: () => c.key },
              primaryKey: { get: () => c.primaryKey },
              continue: { value: (k?: unknown) => c.continue(k) },
              continuePrimaryKey: { value: (k: unknown, pk: unknown) => c.continuePrimaryKey(k, pk) },
              advance: { value: (n: number) => c.advance(n) },
            });

          return {
            ...t,
            mutate(req) {
              if (req.type === 'add' || req.type === 'put') {
                try {
                  return t.mutate({ ...req, values: req.values.map((v) => cifra(v)) });
                } catch (e) {
                  return Promise.reject(e);
                }
              }
              return t.mutate(req);
            },
            get: (req) => t.get(req).then(decifra),
            getMany: (req) => t.getMany(req).then((r) => r.map(decifra)),
            query: (req) => t.query(req).then((r) => (req.values ? { ...r, result: r.result.map(decifra) } : r)),
            openCursor: (req) =>
              t.openCursor(req).then((c) => (c && req.values !== false ? avvolgiCursore(c) : c)),
          };
        },
      };
    },
  };
}
