// Foto allegate alla verifica (es. display della centrale con il riconoscimento automatico).
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../db/db';
import { aggiornaFoto, aggiungiFoto, eliminaFoto, preparaFoto } from '../../db/repo';
import { aggiungiNota } from '../../db/sessioni';
import type { Foto } from '../../model/types';
import { CampoTesto } from '../components/Campi';

const SUGGERIMENTI = ['Riconoscimento automatico (sommario)', 'Griglia POL sensori', 'Griglia POL moduli', 'Display centrale: guasto', 'Punto del guasto'];

export function FotoSessione({ impiantoId, sessioneId }: { impiantoId: string; sessioneId: string }) {
  const foto = useLiveQuery(() => db.foto.where('sessioneId').equals(sessioneId).sortBy('ora'), [sessioneId]);
  const input = useRef<HTMLInputElement>(null);
  const [attesa, setAttesa] = useState(false);

  async function aggiungi(files: FileList | null) {
    if (!files?.length) return;
    setAttesa(true);
    try {
      for (const f of Array.from(files)) {
        const p = await preparaFoto(f);
        await aggiungiFoto(impiantoId, sessioneId, p, '');
      }
      await aggiungiNota(sessioneId, `Allegat${files.length > 1 ? 'e' : 'a'} ${files.length} foto`);
    } finally {
      setAttesa(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="foto-sessione">
      <div className="azioni">
        <button onClick={() => input.current?.click()} disabled={attesa}>
          {attesa ? 'Salvataggio…' : '+ Scatta o aggiungi foto'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => aggiungi(e.target.files)} />
      <datalist id="didascalie-foto">
        {SUGGERIMENTI.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {foto && foto.length > 0 && (
        <ul className="galleria">
          {foto.map((f) => (
            <MiniaturaFoto key={f.id} f={f} />
          ))}
        </ul>
      )}
      {foto && foto.length === 0 && <p className="tenue">Nessuna foto. Le foto finiscono nel rapportino PDF con la loro didascalia.</p>}
    </div>
  );
}

function MiniaturaFoto({ f }: { f: Foto }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([f.dati], { type: f.mime })), [f.dati, f.mime]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <li>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={f.didascalia || 'Foto'} loading="lazy" />
      </a>
      <CampoTesto etichetta="Didascalia" valore={f.didascalia} onSalva={(v) => aggiornaFoto(f.id, v)} list="didascalie-foto" />
      <button className="piccolo pericolo" onClick={() => confirm('Eliminare questa foto?') && eliminaFoto(f.id)}>
        Elimina
      </button>
    </li>
  );
}
