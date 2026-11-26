// Riepilogo di un registro nel tempo (.DAT): risposte e valori per indirizzo sui giri completi.
import type { RegistroPol } from '../../model/types';
import { MAX_CAMPIONATO, giri, statistiche } from '../../import/dat';
import { eliminaRegistro } from '../../db/sessioni';
import { NOME_RAMO } from './LetturaPage';

export function VistaRegistro({ r, sessioneId }: { r: RegistroPol; sessioneId: string }) {
  const g = giri(r.campioni);
  const completi = g.filter((x) => x.completo);
  const st = statistiche(r.campioni).filter((s) => s.risposte > 0 || s.interrogato === 0);
  const ore = r.campioni.map((c) => c.ora).sort();
  return (
    <details className="registro">
      <summary>
        <strong>{r.nomeFile}</strong> — {NOME_RAMO[r.ramo]}, {completi.filter((x) => x.famiglia === 'sensori').length} giri completi sui sensori
        {ore.length > 0 && `, ${ore[0].slice(11, 16)}–${ore[ore.length - 1].slice(11, 16)}`}
      </summary>
      <p className="tenue">
        Solo gli indirizzi fino a {MAX_CAMPIONATO}: oltre, il POL non campiona i valori dettagliati. Sono elencati i dispositivi che hanno risposto almeno una volta.
      </p>
      <div className="scorrimento-x">
        <table className="tabella tabella-dettagli">
          <thead>
            <tr>
              <th>Ind.</th>
              <th>Risposte</th>
              <th>PW1</th>
              <th>I_I</th>
              <th>STA</th>
            </tr>
          </thead>
          <tbody>
            {st.map((s) => (
              <tr key={s.famiglia + s.indirizzo} className={s.risposte < s.interrogato || s.indirizzo === 0 ? 'riga-corrotta' : ''}>
                <td>{`${s.famiglia === 'sensori' ? 'S' : 'M'}${s.indirizzo}`}</td>
                <td>
                  {s.risposte}/{s.interrogato}
                </td>
                <td>{s.pw1 ? (s.pw1[0] === s.pw1[1] ? s.pw1[0] : `${s.pw1[0]}–${s.pw1[1]}`) : '—'}</td>
                <td>{s.ii ? (s.ii[0] === s.ii[1] ? s.ii[0] : `${s.ii[0]}–${s.ii[1]}`) : '—'}</td>
                <td>{Object.keys(s.sta).join(' / ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="piccolo pericolo" onClick={() => confirm('Eliminare questo registro?') && eliminaRegistro(sessioneId, r.id)}>
        Elimina registro
      </button>
    </details>
  );
}
