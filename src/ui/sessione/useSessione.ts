import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { leggiImpostazioni } from '../../db/repo';
import type { Centrale, Impianto, Impostazioni, Loop, Sessione } from '../../model/types';

export interface CtxSessione {
  sessione: Sessione;
  loop: Loop;
  centrale?: Centrale;
  impianto?: Impianto;
  impostazioni: Impostazioni;
}

/** undefined = caricamento, null = non trovata. */
export function useSessione(id: string): CtxSessione | null | undefined {
  return useLiveQuery(async () => {
    const sessione = await db.sessioni.get(id);
    if (!sessione) return null;
    const loop = await db.loops.get(sessione.loopId);
    if (!loop) return null;
    const centrale = await db.centrali.get(loop.centraleId);
    const impianto = centrale ? await db.impianti.get(centrale.impiantoId) : undefined;
    return { sessione, loop, centrale, impianto, impostazioni: await leggiImpostazioni() };
  }, [id]);
}
