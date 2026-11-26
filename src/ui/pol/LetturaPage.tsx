// Inserimento manuale di una lettura del POL-200-TS (griglie sensori e moduli).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { FamigliaPol, LetturaPol } from '../../model/types';
import { analizzaLettura, indirizzi } from '../../analysis/pol';
import { aggiornaLettura, eliminaLettura, impostaCella } from '../../db/sessioni';
import { useSessione } from '../sessione/useSessione';
import { Briciole, Caricamento, NonTrovato } from '../components/Layout';
import { CampoTesto } from '../components/Campi';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { formattaOra } from '../etichette';
import { GrigliaPol } from './GrigliaPol';
import { Tavolozza, type Pennello } from './Tavolozza';
import { TabellaDettagli, VistaMappatura } from './VistaMappatura';
import { analizzaDettagli, analizzaMappa } from '../../analysis/mappa';
import { CopiaPerClaude } from '../components/CopiaPerClaude';
import { leggiRispostaGriglia, testoLetturaFoto, type GrigliaLetta } from '../../ai/copiaPerClaude';
import { applicaGrigliaLetta, confermaCella } from '../../db/sessioni';

export const NOME_RAMO: Record<LetturaPol['ramo'], string> = { A: 'Lato A', B: 'Lato B', chiuso: 'Loop chiuso' };

export function LetturaPage() {
  const { id = '', lid = '' } = useParams();
  const nav = useNavigate();
  const ctx = useSessione(id);
  const [famiglia, setFamiglia] = useState<FamigliaPol>('sensori');
  const [pennelli, setPennelli] = useState<Record<FamigliaPol, Pennello>>({
    sensori: { sigla: 'OT', colore: null },
    moduli: { sigla: 'PI', colore: null },
  });
  const [da, setDa] = useState('');
  const [a, setA] = useState('');
  const [risposta, setRisposta] = useState('');
  const [letta, setLetta] = useState<GrigliaLetta | null>(null);
  const [sostituisci, setSostituisci] = useState(true);

  if (ctx === undefined) return <Caricamento />;
  if (ctx === null) return <NonTrovato cosa="Verifica" />;
  const { sessione: s, loop, impostazioni } = ctx;
  const l = s.letture.find((x) => x.id === lid);
  if (!l) return <NonTrovato cosa="Lettura" />;

  const pennello = pennelli[famiglia];
  const g = l[famiglia];
  const colori = l.colori?.[famiglia];

  function tocca(n: number) {
    const uguale = (g[n] ?? '') === pennello.sigla && (colori?.[n] ?? null) === pennello.colore;
    // toccare una cella già uguale al pennello la svuota
    void impostaCella(s.id, lid, famiglia, n, uguale ? '' : pennello.sigla, uguale ? null : pennello.colore);
  }

  async function riempi() {
    const x = parseInt(da, 10);
    const y = parseInt(a || da, 10);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    for (let n = Math.max(0, Math.min(x, y)); n <= Math.min(159, Math.max(x, y)); n++) {
      await impostaCella(s.id, lid, famiglia, n, pennello.sigla, pennello.colore);
    }
    setDa('');
    setA('');
  }

  async function elimina() {
    if (!confirm('Eliminare questa lettura?')) return;
    await eliminaLettura(s.id, lid);
    nav(`/sessione/${s.id}/guida/pol`);
  }

  const anomalie = [...analizzaLettura(l, loop), ...analizzaDettagli(l), ...analizzaMappa(l, impostazioni.sigle, impostazioni.soglie)];
  const conta = (f: FamigliaPol) => indirizzi(l[f]).length;

  return (
    <>
      <Briciole
        voci={[
          { testo: `Loop ${loop.numero}`, a: `/loop/${loop.id}` },
          { testo: 'Verifica', a: `/sessione/${s.id}` },
          { testo: 'Letture POL', a: `/sessione/${s.id}/guida/pol` },
          { testo: NOME_RAMO[l.ramo] },
        ]}
      />
      <div className="titolo-riga">
        <h1>
          Lettura POL — {NOME_RAMO[l.ramo]} <span className="tenue">{formattaOra(l.ora).slice(-5)}</span>
        </h1>
        <div className="scelte" role="radiogroup" aria-label="Lato della lettura">
          {(['A', 'B', 'chiuso'] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={l.ramo === r} className={l.ramo === r ? 'scelta attiva' : 'scelta'} onClick={() => aggiornaLettura(s.id, lid, { ramo: r })}>
              {NOME_RAMO[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="schede-famiglia" role="tablist">
        {(['sensori', 'moduli'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={famiglia === f} className={famiglia === f ? 'attiva' : ''} onClick={() => setFamiglia(f)}>
            {f === 'sensori' ? 'Sensori' : 'Moduli'} <span className="conteggio">{conta(f)}</span>
          </button>
        ))}
      </div>

      <section className="scheda scheda-griglia">
        <p className="tenue istruzione-griglia">
          Scegli la sigla qui sotto e tocca le celle come le vedi sul POL. Toccando una cella già uguale la svuoti.
        </p>
        <GrigliaPol griglia={g} colori={colori} onTocca={tocca} etichetta={`Griglia ${famiglia}`} evidenzia={new Set(l.daVerificare?.[famiglia] ?? [])} />
        {(l.daVerificare?.[famiglia] ?? []).length > 0 && (
          <div className="da-confermare">
            <p>
              <strong>Celle lette dalla foto da confermare</strong> (bordo rosso). Confrontale con il POL: tocca «OK» se la sigla è giusta, oppure
              correggila toccando la cella con la sigla corretta.
            </p>
            <div className="scelte">
              {l.daVerificare![famiglia].map((n) => (
                <button key={n} type="button" className="scelta" onClick={() => confermaCella(s.id, lid, famiglia, n)}>
                  {n}: {g[n] || 'vuota'} — OK
                </button>
              ))}
            </div>
          </div>
        )}
        <Tavolozza famiglia={famiglia} sigle={impostazioni.sigle} pennello={pennello} onCambia={(p) => setPennelli({ ...pennelli, [famiglia]: p })} />
        <form
          className="riempi"
          onSubmit={(e) => {
            e.preventDefault();
            void riempi();
          }}
        >
          <span>Riempi da</span>
          <input inputMode="numeric" value={da} onChange={(e) => setDa(e.target.value.replace(/\D/g, ''))} aria-label="Dall'indirizzo" />
          <span>a</span>
          <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} aria-label="All'indirizzo" />
          <button type="submit" disabled={!da}>
            con «{pennello.sigla || 'vuoto'}»
          </button>
        </form>
      </section>

      <section className="scheda">
        <details>
          <summary>
            <strong>Leggi una foto della griglia con Claude</strong>
          </summary>
          <ol className="istruzioni">
            <li>Fotografa la griglia sul display del POL (sensori, moduli o entrambe in due foto).</li>
            <li>
              Copia la richiesta, apri Claude, <strong>allega la foto</strong> e incolla la richiesta nella stessa chat.
            </li>
            <li>Copia la risposta di Claude e incollala qui sotto.</li>
          </ol>
          <CopiaPerClaude testo={() => testoLetturaFoto('entrambe')} etichetta="Copia la richiesta per Claude" dopo="Ricordati di allegare la foto." />
          <label className="campo">
            <span className="campo-etichetta">Risposta di Claude</span>
            <textarea rows={6} value={risposta} onChange={(e) => { setRisposta(e.target.value); setLetta(null); }} placeholder={'SENSORI\n1-4 OT\n…'} />
          </label>
          <div className="azioni">
            <button type="button" disabled={!risposta.trim()} onClick={() => setLetta(leggiRispostaGriglia(risposta, famiglia))}>
              Controlla
            </button>
          </div>
          {letta && (
            <div className="scheda evidenza">
              <p>
                Letti {indirizzi(letta.sensori).length} sensori e {indirizzi(letta.moduli).length} moduli
                {letta.dubbi.sensori.length + letta.dubbi.moduli.length > 0 && `, ${letta.dubbi.sensori.length + letta.dubbi.moduli.length} celle dubbie da confermare`}.
              </p>
              {letta.avvisi.length > 0 && <p className="attenzione-box">{letta.avvisi.slice(0, 5).join(' · ')}</p>}
              <label className="spunta">
                <input type="checkbox" checked={sostituisci} onChange={(e) => setSostituisci(e.target.checked)} />
                Sostituisci le griglie lette (altrimenti aggiunge alle celle già presenti)
              </label>
              <div className="azioni">
                <button
                  className="primario"
                  disabled={!indirizzi(letta.sensori).length && !indirizzi(letta.moduli).length}
                  onClick={async () => {
                    await applicaGrigliaLetta(s.id, lid, letta, sostituisci);
                    setLetta(null);
                    setRisposta('');
                  }}
                >
                  Compila la griglia
                </button>
              </div>
            </div>
          )}
        </details>
      </section>

      <section className="scheda">
        <h2>Analisi di questa lettura</h2>
        <ElencoAnomalie anomalie={anomalie} vuoto="Nessuna anomalia in questa lettura." />
        <p className="tenue">Il confronto tra lato A e lato B è nel passo «Letture POL» e nel riepilogo della verifica.</p>
      </section>

      {l.dettagli?.length ? (
        <>
          <section className="scheda">
            <h2>Mappatura (ordine fisico)</h2>
            <p className="tenue">
              Dal file {l.nomeFile}: ogni dispositivo dipende da quello sopra di lui verso la centrale. Le derivazioni sono rientrate.
            </p>
            <VistaMappatura l={l} />
          </section>
          <section className="scheda">
            <details>
              <summary>
                <strong>Dati per dispositivo dal file ({l.dettagli.length})</strong>
              </summary>
              <TabellaDettagli l={l} />
            </details>
          </section>
        </>
      ) : null}

      <section className="scheda">
        <CampoTesto etichetta="Nota sulla lettura" multiriga valore={l.nota} onSalva={(v) => aggiornaLettura(s.id, lid, { nota: v })} />
      </section>

      <div className="azioni navigazione-passi">
        <button className="pericolo" onClick={elimina}>
          Elimina lettura
        </button>
        <Link className="bottone primario-link" to={`/sessione/${s.id}/guida/pol`}>
          Fatto
        </Link>
      </div>
    </>
  );
}
