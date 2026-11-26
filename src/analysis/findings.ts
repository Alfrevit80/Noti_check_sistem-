// Formato comune di tutte le anomalie prodotte dalle regole di analisi.

export type Gravita = 'critica' | 'alta' | 'media' | 'bassa' | 'info';

export interface Anomalia {
  codice: string; // identificativo stabile della regola, es. 'RETE_BUS_GUASTO'
  gravita: Gravita;
  titolo: string;
  spiegazione: string;
  doveIntervenire: string[]; // passi consigliati
  riferimenti?: (string | number)[]; // indirizzi, id di centrali, ecc.
}

export const ORDINE_GRAVITA: Record<Gravita, number> = { critica: 0, alta: 1, media: 2, bassa: 3, info: 4 };

export const ETICHETTA_GRAVITA: Record<Gravita, string> = {
  critica: 'Critica',
  alta: 'Alta',
  media: 'Media',
  bassa: 'Bassa',
  info: 'Info',
};

export function ordinaAnomalie(a: Anomalia[]): Anomalia[] {
  return [...a].sort((x, y) => ORDINE_GRAVITA[x.gravita] - ORDINE_GRAVITA[y.gravita]);
}
