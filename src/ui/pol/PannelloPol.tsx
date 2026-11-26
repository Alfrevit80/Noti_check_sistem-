// Riepilogo delle letture POL di una verifica: elenco, griglia combinata A/B, sequenza, confronto.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FamigliaPol, Griglia, LetturaPol, Loop, Sessione, SiglaPol, Soglie } from '../../model/types';
import { analizzaLetture, confrontaAB, confrontaConCentrale, indirizzi, statiCelle, ultimaLettura, type StatoCella } from '../../analysis/pol';
import { ordinaAnomalie } from '../../analysis/findings';
import { creaLettura } from '../../db/sessioni';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { formattaOra } from '../etichette';
import { GrigliaPol } from './GrigliaPol';
import { LegendaStati } from './LegendaStati';
import { VistaSequenza } from './VistaSequenza';
import { NOME_RAMO } from './LetturaPage';
import { ConfrontoLetture } from './ConfrontoLetture';

const STATI_AB: StatoCella[] = ['soloA', 'soloB', 'entrambi', 'doppio', 'incerto'];
const STATI_CHIUSO: StatoCella[] = ['presente', 'perso', 'incerto'];

export function PannelloPol({ s, loop, sigle, soglie, conAnalisi = true }: { s: Sessione; loop: Loop; sigle: readonly SiglaPol[]; soglie: Soglie; conAnalisi?: boolean }) {
  const nav = useNavigate();
  const [famiglia, setFamiglia] = useState<FamigliaPol>('sensori');
  const [vista, setVista] = useState<'griglia' | 'sequenza'>('griglia');

  async function nuova(ramo: LetturaPol['ramo']) {
    const id = await creaLettura(s.id, ramo);
    nav(`/sessione/${s.id}/lettura/${id}`);
  }

  const A = ultimaLettura(s.letture, 'A');
  const B = ultimaLettura(s.letture, 'B');
  const C = ultimaLettura(s.letture, 'chiuso');
  const stati = statiCelle(s.letture, famiglia);
  // griglia combinata: sigla dell'ultima lettura che ha quell'indirizzo
  const combinata: Griglia = {};
  for (const l of [A, B, C].filter((x): x is LetturaPol => !!x).sort((x, y) => (x.ora < y.ora ? -1 : 1))) Object.assign(combinata, l[famiglia]);
  const ab = A && B ? confrontaAB(A, B, sigle, soglie) : null;
  const ordinate = [...s.letture].sort((x, y) => (x.ora < y.ora ? 1 : -1));
  const max = Math.max(20, ...indirizzi(combinata));

  return (
    <>
      <div className="azioni nuove-letture">
        <button className="primario" onClick={() => nuova('A')}>+ Lettura lato A</button>
        <button className="primario" onClick={() => nuova('B')}>+ Lettura lato B</button>
        <button onClick={() => nuova('chiuso')}>+ Lettura a loop chiuso</button>
      </div>

      {ordinate.length > 0 && (
        <ul className="elenco elenco-letture">
          {ordinate.map((l) => (
            <li key={l.id}>
              <Link to={`/sessione/${s.id}/lettura/${l.id}`} className="voce">
                <span className="voce-titolo">
                  {NOME_RAMO[l.ramo]} <span className="tenue">{formattaOra(l.ora)}</span>
                  {(l === A || l === B || l === C) && <span className="badge">ultima</span>}
                </span>
                <span className="voce-dettagli">
                  {indirizzi(l.sensori).length} sensori · {indirizzi(l.moduli).length} moduli{l.nota && ` · ${l.nota}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {ordinate.length > 0 && (
        <>
          <div className="titolo-riga vista-pol">
            <div className="schede-famiglia" role="tablist">
              {(['sensori', 'moduli'] as const).map((f) => (
                <button key={f} role="tab" aria-selected={famiglia === f} className={famiglia === f ? 'attiva' : ''} onClick={() => setFamiglia(f)}>
                  {f === 'sensori' ? 'Sensori' : 'Moduli'}
                </button>
              ))}
            </div>
            <div className="schede-famiglia" role="tablist">
              <button role="tab" aria-selected={vista === 'griglia'} className={vista === 'griglia' ? 'attiva' : ''} onClick={() => setVista('griglia')}>
                Griglia
              </button>
              <button role="tab" aria-selected={vista === 'sequenza'} className={vista === 'sequenza' ? 'attiva' : ''} onClick={() => setVista('sequenza')}>
                Sequenza
              </button>
            </div>
          </div>
          {ab && (
            <p className={`stato-loop stato-${ab.stato}`}>
              {ab.stato === 'integro' && 'Loop integro: i due lati vedono gli stessi dispositivi.'}
              {ab.stato === 'interrotto' && 'Loop interrotto: i due lati vedono gruppi diversi di dispositivi.'}
              {ab.stato === 'parziale' && 'Alcuni dispositivi rispondono da un solo lato.'}
            </p>
          )}
          {vista === 'griglia' ? (
            <GrigliaPol griglia={combinata} stati={stati} etichetta={`Stato ${famiglia}`} />
          ) : (
            <VistaSequenza griglia={combinata} stati={stati} fino={famiglia === 'sensori' ? 159 : Math.min(159, Math.ceil(max / 20) * 20)} etichetta={`Sequenza ${famiglia}`} />
          )}
          <LegendaStati stati={C ? STATI_CHIUSO : STATI_AB} />
        </>
      )}

      {conAnalisi && ordinate.length > 0 && (
        <>
          <h3>Analisi delle letture</h3>
          <ElencoAnomalie anomalie={ordinaAnomalie([...analizzaLetture(s.letture, loop, sigle, soglie), ...confrontaConCentrale(s.letture, s.riconoscimenti)])} />
        </>
      )}

      {ordinate.length > 1 && (
        <details className="confronto-box">
          <summary>
            <strong>Confronta due letture</strong>
          </summary>
          <ConfrontoLetture letture={ordinate.map((l) => ({ lettura: l, etichetta: `${NOME_RAMO[l.ramo]} ${formattaOra(l.ora)}` }))} />
        </details>
      )}
    </>
  );
}
