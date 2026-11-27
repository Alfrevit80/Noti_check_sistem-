// "Cosa faccio adesso?": suggerisce i prossimi passi della verifica in base ai dati già raccolti.
import type { Loop, Sessione, Soglie, SiglaPol } from '../model/types';
import { ultimaMisura, TIPI_ISOLAMENTO } from './misure';
import { tensioneResiduaAlta } from './voltages';
import { analizzaSessione } from './sessione';
import { ultimaLettura } from './pol';

export interface ProssimoPasso {
  titolo: string;
  motivo: string;
  passo: string; // id del passo della procedura guidata
  q?: string;
  urgente?: boolean;
}

export function prossimiPassi(s: Sessione, loop: Loop, soglie: Soglie, sigle?: readonly SiglaPol[], max = 3): ProssimoPasso[] {
  const out: ProssimoPasso[] = [];
  const ha = (r: 'A' | 'B' | 'loop', t: Parameters<typeof ultimaMisura>[2]) => !!ultimaMisura(s.misure, r, t);

  for (const r of ['A', 'B'] as const) {
    if (tensioneResiduaAlta(s.misure, r, soglie)) {
      out.push({ titolo: `Scarica la linea del ramo ${r}`, motivo: 'C\'è tensione residua: le misure in Ω sarebbero falsate.', passo: 'scollegamento', q: `vRes-${r}`, urgente: true });
    }
  }
  if (!s.sintomo) out.push({ titolo: 'Indica il sintomo', motivo: 'Cosa segnala la centrale su questo loop.', passo: 'sintomo' });
  if (!ha('A', 'vRes') || !ha('B', 'vRes')) out.push({ titolo: 'Misura la tensione residua', motivo: 'Prima di ogni misura in Ω la linea deve essere scarica.', passo: 'scollegamento' });
  for (const r of ['A', 'B'] as const) {
    const manca = TIPI_ISOLAMENTO.find((t) => !ha(r, t));
    if (manca) out.push({ titolo: `Isolamento del ramo ${r}`, motivo: 'Verso terra e verso la calza, a cavo scollegato.', passo: `iso${r}`, q: manca });
  }
  if (!ha('loop', 'rP') || !ha('loop', 'rN')) out.push({ titolo: 'Resistenza di loop', motivo: '+ e − da A a B: totale ≤ 40 Ω, negativo ≤ 20 Ω, + ≈ −.', passo: 'resistenza' });

  const A = ultimaLettura(s.letture, 'A');
  const B = ultimaLettura(s.letture, 'B');
  const C = ultimaLettura(s.letture, 'chiuso');
  if (!C && (!A || !B)) {
    out.push({
      titolo: `Leggi con il POL dal lato ${A ? 'B' : 'A'}`,
      motivo: 'Con le letture dai due lati l\'app trova interruzioni, indirizzi doppi e dispositivi che rispondono da un solo lato. Usa la modalità ADV.',
      passo: 'pol',
    });
  }
  if (!ha('loop', 'vRit') || !ha('loop', 'gCP')) {
    out.push({ titolo: 'Schermata Multimetro del POL', motivo: 'Guasti calza / conduttori, terra, capacità e V ritorno in una sola schermata.', passo: 'multimetro' });
  }
  if (!s.riconoscimenti.length) out.push({ titolo: 'Riconoscimento automatico della centrale', motivo: 'Sommario NUO / INC / TOT / MAN da confrontare con il POL.', passo: 'riconoscimento' });

  // anomalie gravi: suggerisce il primo intervento
  const gravi = analizzaSessione(s, loop, soglie, sigle).filter((a) => a.gravita === 'critica' || a.gravita === 'alta');
  if (gravi.length && out.length < max) {
    const a = gravi[0];
    out.push({ titolo: `Intervieni: ${a.titolo}`, motivo: a.doveIntervenire[0] ?? a.spiegazione, passo: 'esito', urgente: true });
  }
  if (!s.fine && out.length === 0) out.push({ titolo: 'Chiudi la verifica', motivo: 'Tutte le misure base ci sono: scegli l\'esito e genera il rapportino.', passo: 'esito' });

  // le urgenze prima
  return [...out.filter((x) => x.urgente), ...out.filter((x) => !x.urgente)].slice(0, max);
}

/** Avanzamento della verifica (0-100) sui passi principali. */
export function avanzamento(s: Sessione): number {
  const passi = [
    !!s.sintomo,
    ['A', 'B'].every((r) => ultimaMisura(s.misure, r as 'A', 'vRes')),
    TIPI_ISOLAMENTO.every((t) => ultimaMisura(s.misure, 'A', t)),
    TIPI_ISOLAMENTO.every((t) => ultimaMisura(s.misure, 'B', t)),
    !!ultimaMisura(s.misure, 'loop', 'rP') && !!ultimaMisura(s.misure, 'loop', 'rN'),
    s.letture.length > 0,
    !!ultimaMisura(s.misure, 'loop', 'vRit') || !!ultimaMisura(s.misure, 'loop', 'gCP'),
    s.riconoscimenti.length > 0,
    !!s.fine,
  ];
  return Math.round((passi.filter(Boolean).length / passi.length) * 100);
}
