// Tavolozza: si sceglie la sigla (e facoltativamente il colore), poi si toccano le celle.
import { useState } from 'react';
import type { ColorePol, FamigliaPol, SiglaPol } from '../../model/types';

export interface Pennello {
  sigla: string; // '' = gomma
  colore: ColorePol | null;
}

export function Tavolozza(props: {
  famiglia: FamigliaPol;
  sigle: readonly SiglaPol[];
  pennello: Pennello;
  onCambia: (p: Pennello) => void;
}) {
  const [libera, setLibera] = useState('');
  const disponibili = props.sigle.filter((s) => s.famiglia === props.famiglia || s.famiglia === 'entrambe');
  const p = props.pennello;
  return (
    <div className="tavolozza" role="toolbar" aria-label="Sigla da inserire">
      <div className="tavolozza-sigle">
        {disponibili.map((s) => (
          <button
            key={s.codice}
            type="button"
            className={p.sigla === s.codice ? 'attiva' : ''}
            aria-pressed={p.sigla === s.codice}
            title={s.descrizione}
            onClick={() => props.onCambia({ ...p, sigla: s.codice })}
          >
            {s.codice}
          </button>
        ))}
        <button type="button" className={p.sigla === '' ? 'attiva gomma' : 'gomma'} aria-pressed={p.sigla === ''} onClick={() => props.onCambia({ ...p, sigla: '' })}>
          Vuoto
        </button>
        <form
          className="sigla-libera"
          onSubmit={(e) => {
            e.preventDefault();
            if (libera.trim()) props.onCambia({ ...p, sigla: libera.trim() });
          }}
        >
          <input value={libera} onChange={(e) => setLibera(e.target.value)} placeholder="Altra" maxLength={4} aria-label="Altra sigla" />
        </form>
      </div>
      <div className="tavolozza-colori" role="group" aria-label="Colore sul POL (facoltativo)">
        <span className="tenue">Colore:</span>
        {([null, 'rosso', 'arancio', 'nero'] as const).map((c) => (
          <button key={c ?? 'nessuno'} type="button" className={`colore ${c ? `col-${c}` : ''} ${p.colore === c ? 'attiva' : ''}`} aria-pressed={p.colore === c} onClick={() => props.onCambia({ ...p, colore: c })}>
            {c ?? 'nessuno'}
          </button>
        ))}
      </div>
    </div>
  );
}
