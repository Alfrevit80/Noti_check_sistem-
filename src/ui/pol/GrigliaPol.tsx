// Griglia stile POL-200-TS: colonne = decine (00…150), righe = unità (0…9). Indirizzo = decina + unità.
import type { ColorePol, Griglia } from '../../model/types';
import type { StatoCella } from '../../analysis/pol';

export const DECINE = Array.from({ length: 16 }, (_, i) => i * 10);
export const UNITA = Array.from({ length: 10 }, (_, i) => i);

export function GrigliaPol(props: {
  griglia: Griglia;
  colori?: Record<number, ColorePol>;
  stati?: Record<number, StatoCella>;
  evidenzia?: ReadonlySet<number>;
  onTocca?: (indirizzo: number) => void;
  etichetta: string;
}) {
  const { griglia, colori, stati, onTocca } = props;
  return (
    <div className="griglia-pol-box">
      <table className={`griglia-pol ${onTocca ? 'modificabile' : ''}`} aria-label={props.etichetta}>
        <thead>
          <tr>
            <th />
            {DECINE.map((d) => (
              <th key={d} scope="col">
                {String(d).padStart(2, '0')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UNITA.map((u) => (
            <tr key={u}>
              <th scope="row">{u}</th>
              {DECINE.map((d) => {
                const n = d + u;
                if (n > 159) return <td key={d} className="fuori" />;
                const s = griglia[n] ?? '';
                const stato = stati?.[n];
                const classi = [
                  n === 0 ? 'zero' : '',
                  stato ? `st-${stato}` : '',
                  colori?.[n] ? `col-${colori[n]}` : '',
                  props.evidenzia?.has(n) ? 'evidenziata' : '',
                ].join(' ');
                const testo = `Indirizzo ${n}: ${s || 'vuoto'}${stato ? `, ${stato}` : ''}`;
                return (
                  <td key={d} className={classi}>
                    {onTocca ? (
                      <button type="button" onClick={() => onTocca(n)} aria-label={testo} title={testo}>
                        {s}
                      </button>
                    ) : (
                      <span title={testo}>{s}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
