// Confronto tra due letture: cosa è comparso, cosa è sparito, cosa ha cambiato sigla.
import { useState } from 'react';
import type { LetturaPol } from '../../model/types';
import { FAMIGLIE, diffGriglie, intervalli } from '../../analysis/pol';

export interface LetturaEtichettata {
  lettura: LetturaPol;
  etichetta: string;
}

/** `letture` dalla più recente alla più vecchia. */
export function ConfrontoLetture({ letture }: { letture: LetturaEtichettata[] }) {
  const [iPrima, setIPrima] = useState(Math.min(1, letture.length - 1));
  const [iDopo, setIDopo] = useState(0);
  if (letture.length < 2) return <p className="tenue">Servono almeno due letture.</p>;
  const prima = letture[iPrima]?.lettura;
  const dopo = letture[iDopo]?.lettura;
  return (
    <div className="confronto">
      <div className="griglia-campi">
        <label className="campo">
          <span className="campo-etichetta">Lettura precedente</span>
          <select value={iPrima} onChange={(e) => setIPrima(Number(e.target.value))}>
            {letture.map((l, i) => (
              <option key={l.lettura.id} value={i}>
                {l.etichetta}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etichetta">Lettura successiva</span>
          <select value={iDopo} onChange={(e) => setIDopo(Number(e.target.value))}>
            {letture.map((l, i) => (
              <option key={l.lettura.id} value={i}>
                {l.etichetta}
              </option>
            ))}
          </select>
        </label>
      </div>
      {prima && dopo && prima !== dopo ? (
        <table className="tabella">
          <thead>
            <tr>
              <th />
              <th>Comparsi</th>
              <th>Spariti</th>
              <th>Sigla cambiata</th>
            </tr>
          </thead>
          <tbody>
            {FAMIGLIE.map((f) => {
              const d = diffGriglie(prima[f], dopo[f]);
              return (
                <tr key={f}>
                  <th scope="row">{f === 'sensori' ? 'Sensori' : 'Moduli'}</th>
                  <td className="testo-ok">{intervalli(d.aggiunti) || '—'}</td>
                  <td className="testo-err">{intervalli(d.persi) || '—'}</td>
                  <td>{d.cambiati.map((c) => `${c.indirizzo}: ${c.prima}→${c.dopo}`).join(', ') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="tenue">Scegli due letture diverse.</p>
      )}
    </div>
  );
}
