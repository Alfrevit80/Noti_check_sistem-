import Dexie, { type Table } from 'dexie';
import type { Centrale, Foto, Impianto, Impostazioni, Loop, Rete, Sessione } from '../model/types';
import type { Cassaforte } from '../security/crypto';
import { creaMiddlewareCifratura } from './cifratura';

export class NcsDB extends Dexie {
  impianti!: Table<Impianto, string>;
  centrali!: Table<Centrale, string>;
  reti!: Table<Rete, string>;
  loops!: Table<Loop, string>;
  sessioni!: Table<Sessione, string>;
  foto!: Table<Foto, string>;
  impostazioni!: Table<Impostazioni, string>;
  /** Unica tabella non cifrata: contiene la chiave dei dati protetta dalla password. */
  cassaforte!: Table<Cassaforte, string>;

  private chiave: Uint8Array | null = null;

  constructor(nome = 'notifier-check-system') {
    super(nome);
    this.version(1).stores({
      impianti: 'id, cliente, data, modificato',
      centrali: 'id, impiantoId',
      reti: 'impiantoId',
      loops: 'id, centraleId, [centraleId+numero]',
      sessioni: 'id, loopId, inizio',
      foto: 'id, impiantoId, sessioneId',
      impostazioni: 'id',
    });
    // v2: cifratura. Il nome del cliente non è più un indice (gli indici restano in chiaro su disco).
    this.version(2).stores({
      impianti: 'id, data, modificato',
      cassaforte: 'id',
    });
    this.use(creaMiddlewareCifratura(() => this.chiave, new Set(['cassaforte'])));
  }

  impostaChiave(k: Uint8Array | null) {
    this.chiave = k;
  }

  get sbloccato() {
    return this.chiave !== null;
  }
}

export const db = new NcsDB();

/** Tabelle con dati dell'utente (tutte cifrate). */
export const tabelleDati = (d: NcsDB) => [d.impianti, d.centrali, d.reti, d.loops, d.sessioni, d.foto, d.impostazioni];
