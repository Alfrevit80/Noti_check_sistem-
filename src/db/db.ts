import Dexie, { type Table } from 'dexie';
import type { Centrale, Foto, Impianto, Impostazioni, Loop, Rete, Sessione } from '../model/types';

export class NcsDB extends Dexie {
  impianti!: Table<Impianto, string>;
  centrali!: Table<Centrale, string>;
  reti!: Table<Rete, string>;
  loops!: Table<Loop, string>;
  sessioni!: Table<Sessione, string>;
  foto!: Table<Foto, string>;
  impostazioni!: Table<Impostazioni, string>;

  constructor(nome = 'notifier-check-system') {
    super(nome);
    // Versione 1 dello schema. Per cambiarlo: aggiungere this.version(2).stores(...).upgrade(...)
    this.version(1).stores({
      impianti: 'id, cliente, data, modificato',
      centrali: 'id, impiantoId',
      reti: 'impiantoId',
      loops: 'id, centraleId, [centraleId+numero]',
      sessioni: 'id, loopId, inizio',
      foto: 'id, impiantoId, sessioneId',
      impostazioni: 'id',
    });
  }
}

export const db = new NcsDB();
