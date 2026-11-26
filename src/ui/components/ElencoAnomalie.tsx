import { ETICHETTA_GRAVITA, type Anomalia } from '../../analysis/findings';

export function ElencoAnomalie({ anomalie, vuoto = 'Nessuna anomalia rilevata.' }: { anomalie: Anomalia[]; vuoto?: string }) {
  if (anomalie.length === 0) return <p className="ok-box">✓ {vuoto}</p>;
  return (
    <ul className="anomalie">
      {anomalie.map((a, i) => (
        <li key={a.codice + i} className={`anomalia g-${a.gravita}`}>
          <details>
            <summary>
              <span className={`badge g-${a.gravita}`}>{ETICHETTA_GRAVITA[a.gravita]}</span> {a.titolo}
            </summary>
            {a.spiegazione && <p>{a.spiegazione}</p>}
            {a.doveIntervenire.length > 0 && (
              <>
                <strong>Dove intervenire</strong>
                <ol>
                  {a.doveIntervenire.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ol>
              </>
            )}
          </details>
        </li>
      ))}
    </ul>
  );
}
