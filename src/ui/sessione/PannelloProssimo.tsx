// Cima del riepilogo della verifica: avanzamento, indicatori a colpo d'occhio, prossimi passi consigliati.
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Cable, Radio, ShieldCheck, Zap } from 'lucide-react';
import type { Loop, Sessione, SiglaPol, Soglie } from '../../model/types';
import { avanzamento, prossimiPassi } from '../../analysis/prossimoPasso';
import { ultimaMisura, TIPI_ISOLAMENTO, formattaValore } from '../../analysis/misure';
import { valutaMisura } from '../../analysis/valutazione';
import { analizzaSessione } from '../../analysis/sessione';
import { confrontaAB, ultimaLettura } from '../../analysis/pol';
import { passoDaRiprendere } from './GuidaPage';

type Stato = 'ok' | 'att' | 'err' | 'nd';

function Indicatore({ et, val, stato, a, icona: I }: { et: string; val: string; stato: Stato; a: string; icona: typeof Zap }) {
  return (
    <Link to={a} className={`indicatore ${stato}`}>
      <span className="et">
        <I size={13} style={{ verticalAlign: '-2px' }} /> {et}
      </span>
      <span className="val">{val}</span>
    </Link>
  );
}

export function PannelloProssimo({ s, loop, soglie, sigle }: { s: Sessione; loop: Loop; soglie: Soglie; sigle: readonly SiglaPol[] }) {
  const perc = avanzamento(s);
  const passi = s.fine ? [] : prossimiPassi(s, loop, soglie, sigle);
  const g = `/sessione/${s.id}/guida`;

  // isolamento: peggiore valutazione tra i due rami
  const isoVal = (['A', 'B'] as const).flatMap((r) => TIPI_ISOLAMENTO.map((t) => ultimaMisura(s.misure, r, t)).filter(Boolean).map((m) => valutaMisura(m!.tipo, m!.valore, soglie)));
  const isoStato: Stato = !isoVal.length ? 'nd' : isoVal.includes('basso') ? 'err' : isoVal.includes('attenzione') ? 'att' : 'ok';
  const rP = ultimaMisura(s.misure, 'loop', 'rP')?.valore;
  const rN = ultimaMisura(s.misure, 'loop', 'rN')?.valore;
  const tot = typeof rP === 'number' && typeof rN === 'number' ? rP + rN : undefined;
  const resStato: Stato =
    rP === undefined && rN === undefined ? 'nd' : rP === 'OL' || rN === 'OL' || (tot ?? 0) > soglie.rLoopMaxOhm ? 'err' : typeof rP === 'number' && typeof rN === 'number' && Math.abs(rP - rN) > Math.max(2, 0.2 * Math.min(rP, rN)) ? 'att' : 'ok';
  const A = ultimaLettura(s.letture, 'A');
  const B = ultimaLettura(s.letture, 'B');
  const ab = A && B ? confrontaAB(A, B, sigle, soglie).stato : null;
  const polStato: Stato = !s.letture.length ? 'nd' : ab === 'integro' ? 'ok' : ab === 'interrotto' ? 'err' : ab === 'parziale' ? 'att' : 'att';
  const polVal = !s.letture.length ? 'da leggere' : ab === 'integro' ? 'loop integro' : ab === 'interrotto' ? 'interrotto' : ab === 'parziale' ? 'parziale' : `${s.letture.length} letture`;
  const vr = ultimaMisura(s.misure, 'loop', 'vRit')?.valore;
  const an = analizzaSessione(s, loop, soglie, sigle);
  const alte = an.filter((a) => a.gravita === 'alta' || a.gravita === 'critica').length;

  return (
    <>
      <section className="scheda prossimo">
        <div className="titolo-riga">
          <h2 className="sezione-titolo">
            <Activity size={20} /> {s.fine ? 'Verifica chiusa' : 'Cosa fare adesso'}
          </h2>
          {!s.fine && (
            <Link className="bottone primario" to={`${g}/${passoDaRiprendere(s)}`}>
              Continua la procedura <ArrowRight size={18} />
            </Link>
          )}
        </div>
        <div className={`barra-avanzamento ${perc === 100 ? 'completa' : ''}`} aria-label={`Avanzamento ${perc}%`}>
          <div style={{ width: `${perc}%` }} />
        </div>
        <p className="tenue" style={{ margin: '0.35rem 0 0.75rem' }}>
          Avanzamento {perc}% · {alte ? `${alte} anomalie gravi` : 'nessuna anomalia grave'}
        </p>
        {passi.length > 0 && (
          <ol>
            {passi.map((p, i) => (
              <li key={p.titolo} className={p.urgente ? 'urgente' : ''}>
                <Link to={`${g}/${p.passo}${p.q ? `?q=${p.q}` : ''}`}>
                  <span className="n">{i + 1}</span>
                  <span>
                    <strong>{p.titolo}</strong>
                    <small>{p.motivo}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="indicatori">
        <Indicatore et="Isolamento" icona={ShieldCheck} stato={isoStato} a={`${g}/isoA`} val={isoStato === 'nd' ? 'da misurare' : isoStato === 'ok' ? 'buono' : isoStato === 'att' ? 'ridotto' : 'guasto'} />
        <Indicatore et="Resistenza" icona={Cable} stato={resStato} a={`${g}/resistenza`} val={tot !== undefined ? formattaValore(Math.round(tot * 10) / 10, 'Ω') : rP === 'OL' || rN === 'OL' ? 'aperto' : 'da misurare'} />
        <Indicatore et="POL" icona={Radio} stato={polStato} a={`${g}/pol`} val={polVal} />
        <Indicatore
          et="V ritorno"
          icona={Zap}
          stato={vr === undefined ? 'nd' : typeof vr === 'number' && vr < soglie.vRitornoMinV ? 'err' : 'ok'}
          a={`${g}/multimetro`}
          val={vr === undefined ? 'da misurare' : formattaValore(vr, 'V')}
        />
      </div>
    </>
  );
}
