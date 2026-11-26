import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { leggiImpostazioni, salvaImpostazioni } from '../../db/repo';
import type { ProfiloCentrale, RigaSezione, Soglie } from '../../model/types';
import { SOGLIE_PREDEFINITE } from '../../settings/defaults';
import { CampoNumero, CampoTesto } from '../components/Campi';
import { Caricamento } from '../components/Layout';

export function ImpostazioniPage() {
  const s = useLiveQuery(() => leggiImpostazioni(), []);
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const [spazio, setSpazio] = useState('');

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente).catch(() => setPersistente(null));
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setSpazio(`${(e.usage / 1024 / 1024).toFixed(1)} MB usati`);
    });
  }, []);

  if (!s) return <Caricamento />;
  const setSoglia = (k: keyof Omit<Soglie, 'tabellaSezioni'>) => (v: number | undefined) =>
    salvaImpostazioni({ soglie: { ...s.soglie, [k]: v ?? SOGLIE_PREDEFINITE[k] } });
  const setRiga = (i: number, patch: Partial<RigaSezione>) =>
    salvaImpostazioni({ soglie: { ...s.soglie, tabellaSezioni: s.soglie.tabellaSezioni.map((r, j) => (j === i ? { ...r, ...patch } : r)) } });

  return (
    <>
      <h1>Impostazioni</h1>

      <section className="scheda">
        <h2>Generali</h2>
        <div className="griglia-campi">
          <CampoTesto etichetta="Tecnico predefinito" valore={s.tecnicoPredefinito} onSalva={(v) => salvaImpostazioni({ tecnicoPredefinito: v })} />
          <CampoTesto etichetta="Strumento predefinito" valore={s.strumentoPredefinito} onSalva={(v) => salvaImpostazioni({ strumentoPredefinito: v })} />
        </div>
      </section>

      <section className="scheda">
        <h2>Modelli</h2>
        <div className="griglia-campi">
          <EditorLista etichetta="Modelli di centrale (il primo è il predefinito)" voci={s.modelliCentrale} onSalva={(v) => salvaImpostazioni({ modelliCentrale: v })} />
          <EditorLista etichetta="Schede di espansione loop" voci={s.modelliEspansione} onSalva={(v) => salvaImpostazioni({ modelliEspansione: v })} />
        </div>
        <h3>Loop per modello</h3>
        <p className="tenue">Usati come valore iniziale per le nuove centrali e per segnalare configurazioni oltre il massimo. Lascia vuoto se non noto.</p>
        <div className="scorrimento-x">
          <table className="tabella">
            <thead>
              <tr>
                <th>Modello</th>
                <th>Loop scheda madre</th>
                <th>Loop massimi</th>
              </tr>
            </thead>
            <tbody>
              {s.modelliCentrale.map((m) => {
                const p = s.profiliCentrale[m];
                const set = (patch: Partial<ProfiloCentrale>) => {
                  const nuovo = { loopBase: p?.loopBase ?? 1, loopMax: p?.loopMax ?? 1, ...patch };
                  const profili = { ...s.profiliCentrale };
                  if (patch.loopBase === undefined && 'loopBase' in patch) delete profili[m];
                  else if (patch.loopMax === undefined && 'loopMax' in patch) delete profili[m];
                  else profili[m] = nuovo;
                  salvaImpostazioni({ profiliCentrale: profili });
                };
                return (
                  <tr key={m}>
                    <td>{m}</td>
                    <td>
                      <CampoNumero etichetta="" intero valore={p?.loopBase} onSalva={(v) => set({ loopBase: v })} />
                    </td>
                    <td>
                      <CampoNumero etichetta="" intero valore={p?.loopMax} onSalva={(v) => set({ loopMax: v })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="scheda">
        <div className="titolo-riga">
          <h2>Soglie di analisi</h2>
          <button onClick={() => confirm('Ripristinare tutte le soglie ai valori predefiniti?') && salvaImpostazioni({ soglie: SOGLIE_PREDEFINITE })}>
            Ripristina predefinite
          </button>
        </div>
        <p className="tenue">Valori di riferimento del manuale AM-8200. Verifica sempre con la documentazione della centrale installata.</p>
        <div className="griglia-campi">
          <CampoNumero etichetta="Isolamento minimo (dispersione sotto)" unita="MΩ" valore={s.soglie.isolamentoMinMOhm} onSalva={setSoglia('isolamentoMinMOhm')} />
          <CampoNumero etichetta="Isolamento di attenzione" unita="MΩ" valore={s.soglie.isolamentoAttenzioneMOhm} onSalva={setSoglia('isolamentoAttenzioneMOhm')} />
          <CampoNumero etichetta="Resistenza di loop massima" unita="Ω" valore={s.soglie.rLoopMaxOhm} onSalva={setSoglia('rLoopMaxOhm')} />
          <CampoNumero etichetta="Resistenza massima del negativo" unita="Ω" valore={s.soglie.rNegMaxOhm} onSalva={setSoglia('rNegMaxOhm')} />
          <CampoNumero etichetta="Tensione di ritorno minima" unita="V" valore={s.soglie.vRitornoMinV} onSalva={setSoglia('vRitornoMinV')} />
          <CampoNumero etichetta="Tensione residua massima per misure in Ω" unita="V" valore={s.soglie.vResiduaMaxV} onSalva={setSoglia('vResiduaMaxV')} />
          <CampoNumero etichetta="Dispositivi massimi con loop aperto" intero valore={s.soglie.maxDispositiviLoopAperto} onSalva={setSoglia('maxDispositiviLoopAperto')} />
        </div>
        <h3>Sezione minima del cavo in funzione della lunghezza</h3>
        <table className="tabella">
          <thead>
            <tr>
              <th>Lunghezza fino a (m)</th>
              <th>Sezione minima (mm²)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.soglie.tabellaSezioni.map((r, i) => (
              <tr key={i}>
                <td>
                  <CampoNumero etichetta="" valore={r.lunghezzaMaxM} onSalva={(v) => v !== undefined && setRiga(i, { lunghezzaMaxM: v })} />
                </td>
                <td>
                  <CampoNumero etichetta="" valore={r.sezioneMinMm2} onSalva={(v) => v !== undefined && setRiga(i, { sezioneMinMm2: v })} />
                </td>
                <td>
                  <button className="piccolo" onClick={() => salvaImpostazioni({ soglie: { ...s.soglie, tabellaSezioni: s.soglie.tabellaSezioni.filter((_, j) => j !== i) } })}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => salvaImpostazioni({ soglie: { ...s.soglie, tabellaSezioni: [...s.soglie.tabellaSezioni, { lunghezzaMaxM: 0, sezioneMinMm2: 0 }] } })}>
          + Aggiungi riga
        </button>
      </section>

      <section className="scheda">
        <h2>Claude (diagnosi assistita)</h2>
        <p className="tenue">
          La chiave resta salvata solo su questo dispositivo e non viene inclusa nei file di progetto esportati. Usata dalla fase 6.
        </p>
        <div className="griglia-campi">
          <CampoTesto etichetta="Chiave API Anthropic" tipo="password" valore={s.claudeApiKey} onSalva={(v) => salvaImpostazioni({ claudeApiKey: v.trim() })} placeholder="sk-ant-…" />
          <CampoTesto etichetta="Modello" valore={s.claudeModello} onSalva={(v) => salvaImpostazioni({ claudeModello: v.trim() })} />
        </div>
      </section>

      <section className="scheda">
        <h2>Archivio locale</h2>
        <p>
          {persistente === true && '✓ Archivio protetto: il browser non cancellerà i dati automaticamente.'}
          {persistente === false && 'Il browser potrebbe cancellare i dati se lo spazio scarseggia. Installa l\'app e/o esporta i progetti regolarmente.'}
          {persistente === null && 'Stato dell\'archivio non disponibile.'}
          {spazio && <span className="tenue"> ({spazio})</span>}
        </p>
        {persistente === false && (
          <button onClick={() => navigator.storage.persist().then(setPersistente)}>Richiedi archivio persistente</button>
        )}
      </section>
    </>
  );
}

function EditorLista({ etichetta, voci, onSalva }: { etichetta: string; voci: string[]; onSalva: (v: string[]) => void }) {
  const [nuova, setNuova] = useState('');
  const sposta = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= voci.length) return;
    const v = [...voci];
    [v[i], v[j]] = [v[j], v[i]];
    onSalva(v);
  };
  return (
    <div className="campo">
      <span className="campo-etichetta">{etichetta}</span>
      <ul className="lista-modifica">
        {voci.map((v, i) => (
          <li key={v + i}>
            <span>{v}</span>
            <button className="piccolo" onClick={() => sposta(i, -1)} disabled={i === 0} aria-label="Sposta su">
              ↑
            </button>
            <button className="piccolo" onClick={() => sposta(i, 1)} disabled={i === voci.length - 1} aria-label="Sposta giù">
              ↓
            </button>
            <button className="piccolo" onClick={() => onSalva(voci.filter((_, j) => j !== i))} aria-label="Rimuovi">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="aggiungi-voce"
        onSubmit={(e) => {
          e.preventDefault();
          const t = nuova.trim();
          if (t && !voci.includes(t)) onSalva([...voci, t]);
          setNuova('');
        }}
      >
        <input value={nuova} onChange={(e) => setNuova(e.target.value)} placeholder="Nuovo modello…" />
        <button type="submit">Aggiungi</button>
      </form>
    </div>
  );
}
