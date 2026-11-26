// Importazione dei file di manutenzione (.MNT) del POL-200-TS.
import { useRef, useState } from 'react';
import type { LetturaPol } from '../../model/types';
import { leggiMnt, letturaDaMnt, type FileMnt } from '../../import/mnt';
import { aggiungiLettura } from '../../db/sessioni';
import { adesso, nuovoId } from '../../db/repo';
import { NOME_RAMO } from './LetturaPage';

interface DaImportare {
  file: FileMnt;
  ramo: LetturaPol['ramo'];
}

export function ImportaMnt({ sessioneId }: { sessioneId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [lista, setLista] = useState<DaImportare[]>([]);
  const [esito, setEsito] = useState('');

  async function scegli(files: FileList | null) {
    setEsito('');
    if (!files?.length) return;
    const out: DaImportare[] = [];
    for (const f of Array.from(files)) {
      const buf = await f.arrayBuffer();
      const testo = new TextDecoder('windows-1252').decode(buf);
      out.push({ file: leggiMnt(testo, f.name), ramo: 'A' });
    }
    setLista(out);
    if (input.current) input.current.value = '';
  }

  async function importa() {
    let n = 0;
    // in ordine di nome (i file del POL sono numerati in sequenza): le letture conservano l'ordine
    const ordinati = [...lista].filter((x) => x.file.dispositivi.length).sort((a, b) => a.file.nomeFile.localeCompare(b.file.nomeFile));
    for (const [i, x] of ordinati.entries()) {
      const ora = new Date(Date.parse(adesso()) + i * 1000).toISOString();
      await aggiungiLettura(sessioneId, letturaDaMnt(x.file, x.ramo, nuovoId(), ora));
      n++;
    }
    setLista([]);
    setEsito(`${n} letture importate.`);
  }

  return (
    <div className="importa-mnt">
      <button type="button" onClick={() => input.current?.click()}>
        Importa file del POL (.MNT)…
      </button>
      <input ref={input} type="file" accept=".mnt,.MNT,.txt,text/plain" multiple hidden onChange={(e) => scegli(e.target.files)} />
      {esito && <p className="ok-box">{esito}</p>}
      {lista.length > 0 && (
        <div className="scheda evidenza">
          <h3>File da importare</h3>
          {lista.map((x, i) => (
            <div key={i} className="file-mnt">
              <p>
                <strong>{x.file.nomeFile}</strong>: {x.file.dispositivi.filter((d) => d.famiglia === 'sensori').length} sensori,{' '}
                {x.file.dispositivi.filter((d) => d.famiglia === 'moduli').length} moduli
                {x.file.software && <span className="tenue"> · software POL {x.file.software}</span>}
              </p>
              {x.file.avvisi.length > 0 && (
                <details>
                  <summary className="testo-att">{x.file.avvisi.length} avvisi</summary>
                  <ul>
                    {x.file.avvisi.slice(0, 20).map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
              {x.file.dispositivi.length > 0 && (
                <div className="scelte" role="radiogroup" aria-label={`Lato della lettura ${x.file.nomeFile}`}>
                  {(['A', 'B', 'chiuso'] as const).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={x.ramo === r} className={x.ramo === r ? 'scelta attiva' : 'scelta'} onClick={() => setLista(lista.map((y, j) => (j === i ? { ...y, ramo: r } : y)))}>
                      {NOME_RAMO[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="azioni">
            <button className="primario" onClick={importa} disabled={!lista.some((x) => x.file.dispositivi.length)}>
              Importa
            </button>
            <button onClick={() => setLista([])}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
