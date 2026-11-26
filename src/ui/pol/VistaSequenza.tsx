// Indirizzi in fila (righe da 20) per vedere i buchi a colpo d'occhio.
import type { Griglia } from '../../model/types';
import type { StatoCella } from '../../analysis/pol';

export function VistaSequenza({ griglia, stati, fino, etichetta }: { griglia: Griglia; stati: Record<number, StatoCella>; fino: number; etichetta: string }) {
  const righe: number[][] = [];
  for (let i = 1; i <= fino; i += 20) righe.push(Array.from({ length: Math.min(20, fino - i + 1) }, (_, k) => i + k));
  return (
    <div className="sequenza-box" aria-label={etichetta}>
      {righe.map((r) => (
        <div key={r[0]} className="sequenza-riga">
          {r.map((n) => (
            <span key={n} className={`seq st-${stati[n] ?? 'vuoto'}`} title={`${n}: ${griglia[n] ?? 'nessuna risposta'}`}>
              <small>{n}</small>
              {griglia[n] ?? ''}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
