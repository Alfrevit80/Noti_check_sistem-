// Riepilogo di una verifica: tabelle delle misure, analisi, cronologia.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { analizzaSessione, esitoSuggerito, misureMancanti } from '../../analysis/sessione';
import { DEF_MISURE, formattaValore, nomeRamo } from '../../analysis/misure';
import { valutaMisura } from '../../analysis/valutazione';
import { aggiungiNota, cronologia, eliminaEvento, eliminaMisura, eliminaSessione, riapriSessione, testoSintomo } from '../../db/sessioni';
import { Caricamento, Intestazione, NonTrovato} from '../components/Layout';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { formattaOra, testoEsito } from '../etichette';
import { RiepilogoCavo, TabellaIsolamento, TabellaResistenzeTensioni } from './TabelleMisure';
import { EditorRiconoscimento } from './EditorRiconoscimento';
import { PannelloProssimo } from './PannelloProssimo';
import { useSessione } from './useSessione';
import { PannelloPol } from '../pol/PannelloPol';
import { CopiaPerClaude } from '../components/CopiaPerClaude';
import { testoDiagnosi } from '../../ai/copiaPerClaude';
import { CampoTesto } from '../components/Campi';
import { salvaDiagnosiClaude } from '../../db/sessioni';
import { FotoSessione } from './FotoSessione';
import { PulsantePdf } from './PulsantePdf';
import { db } from '../../db/db';
import { modelloLoop } from '../../report/modello';
import { pdfLoop } from '../../report/pdfLoop';
import { nomePdf } from '../../report/genera';
import type { Sessione } from '../../model/types';

export function SessionePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const ctx = useSessione(id);
  if (ctx === undefined) return <Caricamento />;
  if (ctx === null) return <NonTrovato cosa="Verifica" />;
  const { sessione: s, loop, centrale, impianto, impostazioni } = ctx;
  const soglie = impostazioni.soglie;
  const anomalie = analizzaSessione(s, loop, soglie, impostazioni.sigle);
  const suggerito = esitoSuggerito(anomalie, s);
  const mancanti = misureMancanti(s);

  async function elimina() {
    if (!confirm('Eliminare questa verifica con tutte le misure e la cronologia?')) return;
    await eliminaSessione(id);
    nav(`/loop/${loop.id}`);
  }

  return (
    <>
      <Intestazione
        sopratitolo={`${impianto?.cliente || 'Impianto'} · ${centrale?.nome || 'Centrale'} · Loop ${loop.numero}`}
        titolo={`Verifica ${formattaOra(s.inizio).replace(/\/\d{4},/, '')}`}
        indietro={`/loop/${loop.id}`}
        azioni={
          s.fine ? (
            <button className="piccolo" onClick={() => riapriSessione(id)}>
              Riapri
            </button>
          ) : null
        }
      />
      <PannelloProssimo s={s} loop={loop} soglie={soglie} sigle={impostazioni.sigle} />

      <nav className="indice-sezioni" aria-label="Sezioni della verifica">
        <a href="#analisi">Analisi</a>
        <a href="#misure">Misure</a>
        <a href="#pol">POL</a>
        <a href="#claude">Claude</a>
        <a href="#foto">Foto</a>
        <a href="#rapportino">Rapportino</a>
        <a href="#cronologia">Cronologia</a>
      </nav>

      <section className="scheda stato-sessione">
        <dl className="dati">
          <dt>Stato</dt>
          <dd>
            {s.fine ? (
              <>
                Chiusa il {formattaOra(s.fine)} — <span className={`badge esito-${s.esito}`}>{testoEsito(s.esito)}</span>
              </>
            ) : (
              <>In corso · esito suggerito <span className={`badge esito-${suggerito}`}>{testoEsito(suggerito)}</span></>
            )}
          </dd>
          <dt>Sintomo</dt>
          <dd>
            {s.sintomo ? (
              <>
                {testoSintomo(s.sintomo.tipo)}
                {s.sintomo.tipo !== 'nessuno' && s.sintomo.ramo !== 'non_noto' && ` — ${s.sintomo.ramo === 'entrambi' ? 'entrambi i rami' : `ramo ${s.sintomo.ramo}`}`}
                {s.sintomo.descrizione && <span className="tenue"> · {s.sintomo.descrizione}</span>}
              </>
            ) : (
              <Link to={`/sessione/${id}/guida/sintomo`}>da indicare</Link>
            )}
          </dd>
          <dt>Tecnico / strumento</dt>
          <dd>
            {s.tecnico || '—'} · {s.strumento}
          </dd>
        </dl>
        {mancanti.length > 0 && (
          <p className="tenue">
            Misure base mancanti: {mancanti.map((m) => `${DEF_MISURE[m.tipo].etichetta}${m.ramo === 'loop' ? '' : ` ${m.ramo}`}`).join(', ')}.
          </p>
        )}
      </section>

      <section className="scheda" id="analisi">
        <h2>Analisi</h2>
        <ElencoAnomalie anomalie={anomalie} vuoto={mancanti.length ? 'Nessuna anomalia nelle misure inserite finora.' : 'Nessuna anomalia rilevata.'} />
      </section>

      <section className="scheda" id="claude">
        <h2>Chiedi a Claude</h2>
        <p className="tenue">
          Copia i dati della verifica (senza nome del cliente né indirizzo) e incollali nella chat di Claude: usi il tuo abbonamento, senza costi
          aggiuntivi. Poi incolla qui sotto la risposta: viene salvata nella verifica e inserita nel rapportino.
        </p>
        <CopiaPerClaude testo={() => testoDiagnosi(s, loop, centrale, impostazioni)} />
        <CampoTesto
          etichetta="Diagnosi di Claude (incolla qui la risposta)"
          multiriga
          valore={s.diagnosiClaude?.testo ?? ''}
          onSalva={(v) => salvaDiagnosiClaude(s.id, v)}
          className="diagnosi-claude"
        />
        {s.diagnosiClaude && <p className="tenue">Salvata il {formattaOra(s.diagnosiClaude.ora)}.</p>}
      </section>

      <div className="due-colonne">
        <section className="scheda" id="misure">
          <h2>Misure a cavo scollegato</h2>
          <TabellaIsolamento sessione={s} soglie={soglie} />
          <p className="tenue legenda">Tocca una cella per misurare o rimisurare.</p>
        </section>
        <section className="scheda">
          <h2>Resistenze e tensioni</h2>
          <TabellaResistenzeTensioni sessione={s} soglie={soglie} />
        </section>
      </div>

      <section className="scheda" id="pol">
        <h2>Letture POL-200-TS</h2>
        <PannelloPol s={s} loop={loop} sigle={impostazioni.sigle} soglie={soglie} conAnalisi={false} />
      </section>

      <section className="scheda">
        <div className="titolo-riga">
          <h2>Cavo</h2>
          <Link className="bottone" to={`/sessione/${id}/guida/cavo`}>
            Modifica
          </Link>
        </div>
        <RiepilogoCavo sessione={s} soglie={soglie} />
      </section>

      <section className="scheda">
        <h2>Riconoscimento automatico della centrale</h2>
        <EditorRiconoscimento sessione={s} />
      </section>

      {impianto && (
        <section className="scheda" id="foto">
          <h2>Foto</h2>
          <FotoSessione impiantoId={impianto.id} sessioneId={s.id} />
        </section>
      )}

      <section className="scheda" id="rapportino">
        <h2>Rapportino</h2>
        <p className="tenue">PDF A4 con intestazione, stato iniziale e finale, misure, mappatura, riconoscimento, analisi, cronologia, foto, esito e spazio per le firme.</p>
        <PulsantePdf
          etichetta="Genera rapportino PDF"
          primario
          nome={nomePdf(['Rapportino', impianto?.cliente, `Loop${loop.numero}`, s.inizio.slice(0, 10)])}
          prepara={async () => pdfLoop(modelloLoop(s, loop, centrale, impianto, impostazioni, await db.foto.where('sessioneId').equals(s.id).toArray()))}
        />
      </section>

      <section className="scheda" id="cronologia">
        <h2>Cronologia</h2>
        <Cronologia s={s} />
      </section>

      <section className="scheda">
        <details>
          <summary>
            <strong>Storico di tutte le misure ({s.misure.length})</strong>
          </summary>
          <StoricoMisure s={s} soglie={soglie} />
        </details>
      </section>

      {(s.attivitaDaEseguire || s.note) && (
        <section className="scheda">
          {s.attivitaDaEseguire && (
            <>
              <h2>Attività ancora da eseguire</h2>
              <p className="testo-lungo">{s.attivitaDaEseguire}</p>
            </>
          )}
          {s.note && (
            <>
              <h2>Note</h2>
              <p className="testo-lungo">{s.note}</p>
            </>
          )}
          <Link to={`/sessione/${id}/guida/esito`}>Modifica</Link>
        </section>
      )}

      <section className="scheda zona-pericolo">
        <button className="pericolo" onClick={elimina}>
          Elimina verifica
        </button>
      </section>
    </>
  );
}

function Cronologia({ s }: { s: Sessione }) {
  const [testo, setTesto] = useState('');
  const [ora, setOra] = useState('');
  const eventi = cronologia(s);
  async function aggiungi(e: FormEvent) {
    e.preventDefault();
    let iso: string | undefined;
    if (ora) {
      const [h, m] = ora.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      iso = d.toISOString();
    }
    await aggiungiNota(s.id, testo, undefined, iso);
    setTesto('');
    setOra('');
  }
  return (
    <>
      {eventi.length === 0 ? (
        <p className="tenue">Nessun evento.</p>
      ) : (
        <ol className="cronologia">
          {eventi.map((e) => (
            <li key={e.id} className={e.automatico ? 'auto' : 'manuale'}>
              <time>{formattaOra(e.ora).slice(-5)}</time>
              <span>{e.testo}</span>
              {!e.automatico && (
                <button className="piccolo" onClick={() => eliminaEvento(s.id, e.id)} aria-label="Elimina nota">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <form className="aggiungi-nota" onSubmit={aggiungi}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Aggiungi un evento (es. sostituita base indirizzo 12)" aria-label="Testo dell'evento" />
        <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} aria-label="Ora (facoltativa, predefinita adesso)" />
        <button type="submit" disabled={!testo.trim()}>
          Aggiungi
        </button>
      </form>
    </>
  );
}

function StoricoMisure({ s, soglie }: { s: Sessione; soglie: Parameters<typeof valutaMisura>[2] }) {
  const ordinate = [...s.misure].sort((a, b) => (a.ora < b.ora ? 1 : -1));
  if (ordinate.length === 0) return <p className="tenue">Nessuna misura.</p>;
  return (
    <div className="scorrimento-x">
      <table className="tabella">
        <thead>
          <tr>
            <th>Ora</th>
            <th>Misura</th>
            <th>Ramo</th>
            <th>Valore</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ordinate.map((m) => (
            <tr key={m.id}>
              <td>{formattaOra(m.ora)}</td>
              <td>{DEF_MISURE[m.tipo].descrizione}</td>
              <td>{nomeRamo(m.ramo)}</td>
              <td className={`v-testo-${valutaMisura(m.tipo, m.valore, soglie)}`}>
                {formattaValore(m.valore, m.valore === 'OL' ? undefined : DEF_MISURE[m.tipo].unita)}
              </td>
              <td>
                <button className="piccolo" onClick={() => confirm('Eliminare questa misura (inserita per errore)?') && eliminaMisura(s.id, m.id)} aria-label="Elimina misura">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
