// Salvataggio esplicito: i campi salvano già da soli, ma il tasto "Salva" (o Ctrl+S) scrive subito
// anche quello che è ancora in modifica. Ogni componente con dati non salvati ascolta l'evento
// e aggiunge la propria scrittura all'elenco delle promesse da attendere.
import { useEffect, useRef } from 'react';

const EVENTO = 'ncs-salva';

export interface RichiestaSalvataggio {
  promesse: Promise<unknown>[];
}

export async function salvaTutto(): Promise<void> {
  const richiesta: RichiestaSalvataggio = { promesse: [] };
  window.dispatchEvent(new CustomEvent<RichiestaSalvataggio>(EVENTO, { detail: richiesta }));
  await Promise.all(richiesta.promesse);
  // chiede ancora al browser di non cancellare l'archivio quando manca spazio
  await navigator.storage?.persist?.().catch(() => undefined);
}

/** Registra una funzione da chiamare quando l'utente preme "Salva". Se restituisce una promessa, viene attesa. */
export function useAlSalvataggio(fn: () => Promise<unknown> | void) {
  const rif = useRef(fn);
  rif.current = fn;
  useEffect(() => {
    const h = (e: Event) => {
      const r = rif.current();
      if (r) (e as CustomEvent<RichiestaSalvataggio>).detail.promesse.push(r);
    };
    window.addEventListener(EVENTO, h);
    return () => window.removeEventListener(EVENTO, h);
  }, []);
}
