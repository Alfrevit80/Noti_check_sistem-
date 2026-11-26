// Procedura guidata passo-passo per la verifica di un loop.
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Sessione, Sintomo, Soglie } from '../../model/types';
import { TIPI_ISOLAMENTO, ultimaMisura } from '../../analysis/misure';
import { analizzaSessione, esitoSuggerito } from '../../analysis/sessione';
import { tensioneResiduaAlta } from '../../analysis/voltages';
import { lunghezzaMassima, resistenzaConduttore, sezioneMinima } from '../../analysis/loopResistance';
import { aggiornaSessione, chiudiSessione, impostaSintomo, salvaCavo } from '../../db/sessioni';
import { Briciole, Caricamento, NonTrovato } from '../components/Layout';
import { CampoNumero, CampoScelta, CampoTesto } from '../components/Campi';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { ESITI_LOOP, testoEsito } from '../etichette';
import { SequenzaMisure, type Domanda } from './SequenzaMisure';
import { EditorRiconoscimento } from './EditorRiconoscimento';
import { useSessione } from './useSessione';
import type { CtxSessione } from './useSessione';

interface Passo {
  id: string;
  titolo: string;
  completo: (s: Sessione) => boolean;
}

const tutte = (s: Sessione, dd: Domanda[]) => dd.every((d) => ultimaMisura(s.misure, d.ramo, d.tipo));
const DOM_RESIDUA: Domanda[] = [{ ramo: 'A', tipo: 'vRes' }, { ramo: 'B', tipo: 'vRes' }];
const domIso = (r: 'A' | 'B'): Domanda[] => TIPI_ISOLAMENTO.map((tipo) => ({ ramo: r, tipo }));
const DOM_RES: Domanda[] = [{ ramo: 'loop', tipo: 'rP' }, { ramo: 'loop', tipo: 'rN' }];
const DOM_RES_CALZA: Domanda[] = [...DOM_RES, { ramo: 'loop', tipo: 'rC' }];
const DOM_LINEA: Domanda[] = (['A', 'B'] as const).flatMap((ramo) => [{ ramo, tipo: 'pN' as const }, { ramo, tipo: 'nP' as const }]);
const DOM_MULTIMETRO: Domanda[] = [{ ramo: 'loop', tipo: 'cap' }, { ramo: 'loop', tipo: 'vRit' }];

export const PASSI: Passo[] = [
  { id: 'sintomo', titolo: 'Sintomo', completo: (s) => !!s.sintomo },
  { id: 'scollegamento', titolo: 'Scollegamento', completo: (s) => tutte(s, DOM_RESIDUA) },
  { id: 'isoA', titolo: 'Isolamento A', completo: (s) => tutte(s, domIso('A')) },
  { id: 'isoB', titolo: 'Isolamento B', completo: (s) => tutte(s, domIso('B')) },
  { id: 'linea', titolo: 'Linea + / −', completo: (s) => tutte(s, DOM_LINEA.filter((d) => d.ramo === 'A')) },
  { id: 'resistenza', titolo: 'Resistenza', completo: (s) => tutte(s, DOM_RES) },
  { id: 'cavo', titolo: 'Cavo', completo: (s) => !!(s.cavo.lunghezzaM && s.cavo.sezioneMm2) },
  { id: 'pol', titolo: 'Letture POL', completo: (s) => s.letture.length > 0 },
  { id: 'ritorno', titolo: 'Multimetro POL', completo: (s) => tutte(s, DOM_MULTIMETRO) },
  { id: 'ricollegamento', titolo: 'Ricollegamento', completo: (s) => !!ultimaMisura(s.misure, 'loop', 'vLin') },
  { id: 'riconoscimento', titolo: 'Riconoscimento', completo: (s) => s.riconoscimenti.length > 0 },
  { id: 'esito', titolo: 'Esito', completo: (s) => !!s.fine },
];

/** Primo passo non completato (per riprendere la procedura). */
export const passoDaRiprendere = (s: Sessione) => (PASSI.find((p) => !p.completo(s)) ?? PASSI[PASSI.length - 1]).id;

export function GuidaPage() {
  const { id = '', passo = '' } = useParams();
  const [cerca] = useSearchParams();
  const nav = useNavigate();
  const ctx = useSessione(id);

  if (ctx === undefined) return <Caricamento />;
  if (ctx === null) return <NonTrovato cosa="Verifica" />;
  const { sessione, loop, centrale, impianto } = ctx;

  const i = Math.max(0, PASSI.findIndex((p) => p.id === passo));
  const p = PASSI[i];
  const vai = (j: number) => nav(`/sessione/${id}/guida/${PASSI[j].id}`);
  const prossimo = () => (i < PASSI.length - 1 ? vai(i + 1) : nav(`/sessione/${id}`));
  const q = cerca.get('q') ?? undefined;

  return (
    <>
      <Briciole
        voci={[
          { testo: impianto?.cliente || 'Impianto', a: impianto ? `/impianto/${impianto.id}` : undefined },
          { testo: centrale?.nome || 'Centrale', a: centrale ? `/centrale/${centrale.id}` : undefined },
          { testo: `Loop ${loop.numero}`, a: `/loop/${loop.id}` },
          { testo: 'Verifica', a: `/sessione/${id}` },
        ]}
      />
      <nav className="passi" aria-label="Passi della procedura">
        {PASSI.map((x, j) => (
          <Link key={x.id} to={`/sessione/${id}/guida/${x.id}`} className={`passo ${j === i ? 'corrente' : ''} ${x.completo(sessione) ? 'fatto' : ''}`}>
            <span className="num">{x.completo(sessione) ? '✓' : j + 1}</span>
            <span className="tit">{x.titolo}</span>
          </Link>
        ))}
      </nav>

      <section className="scheda passo-scheda">
        <h1>
          {i + 1}. {p.titolo}
        </h1>
        <ContenutoPasso key={p.id + (q ?? '')} passo={p.id} ctx={ctx} q={q} onAvanti={prossimo} />
      </section>

      <div className="azioni navigazione-passi">
        <button disabled={i === 0} onClick={() => vai(i - 1)}>
          ← Indietro
        </button>
        <Link className="bottone" to={`/sessione/${id}`}>
          Riepilogo
        </Link>
        <button className="primario" onClick={prossimo}>
          {i < PASSI.length - 1 ? 'Avanti →' : 'Fine'}
        </button>
      </div>
    </>
  );
}

function ContenutoPasso({ passo, ctx, q, onAvanti }: { passo: string; ctx: CtxSessione; q?: string; onAvanti: () => void }) {
  const { sessione: s, impostazioni } = ctx;
  const soglie = impostazioni.soglie;
  switch (passo) {
    case 'sintomo':
      return <PassoSintomo s={s} onAvanti={onAvanti} />;
    case 'scollegamento':
      return (
        <>
          <ol className="istruzioni">
            <li>Scollegare dalla centrale il ramo A e il ramo B del loop.</li>
            <li>Scollegare la calza dalla terra della centrale.</li>
            <li>Misurare la tensione residua tra + e − di entrambi i rami.</li>
          </ol>
          <AvvisoScarica s={s} soglie={soglie} />
          <SequenzaMisure sessioneId={s.id} misure={s.misure} domande={DOM_RESIDUA} soglie={soglie} iniziale={q} onCompletata={onAvanti} />
        </>
      );
    case 'isoA':
    case 'isoB': {
      const r = passo === 'isoA' ? 'A' : 'B';
      return (
        <>
          <AvvisoScarica s={s} soglie={soglie} rami={[r]} />
          <SequenzaMisure sessioneId={s.id} misure={s.misure} domande={domIso(r)} soglie={soglie} iniziale={q} onCompletata={onAvanti} />
        </>
      );
    }
    case 'linea':
      return (
        <>
          <p className="tenue">
            Con sensori e moduli installati, misura tra + e − di ogni ramo nei due versi (manuale di installazione, «Isolamento
            della linea»): {String(soglie.lineaPN[0]).replace('.', ',')} ÷ {String(soglie.lineaPN[1]).replace('.', ',')} MΩ con il
            tester + sul +, {String(soglie.lineaNP[0]).replace('.', ',')} ÷ {String(soglie.lineaNP[1]).replace('.', ',')} MΩ
            invertendo i puntali. Con il loop chiuso basta il ramo A.
          </p>
          <AvvisoScarica s={s} soglie={soglie} />
          <SequenzaMisure sessioneId={s.id} misure={s.misure} domande={DOM_LINEA} soglie={soglie} iniziale={q} onCompletata={onAvanti} />
        </>
      );
    case 'resistenza':
      return (
        <>
          <p className="tenue">
            Con i due rami scollegati dalla centrale si misura la continuità del loop da un capo all'altro. Limiti: totale ≤{' '}
            {soglie.rLoopMaxOhm} Ω, negativo ≤ {soglie.rNegMaxOhm} Ω (il totale è circa 2 × negativo). La calza deve essere continua.
          </p>
          <AvvisoScarica s={s} soglie={soglie} />
          <SequenzaMisure sessioneId={s.id} misure={s.misure} domande={DOM_RES_CALZA} soglie={soglie} iniziale={q} onCompletata={onAvanti} />
        </>
      );
    case 'cavo':
      return <PassoCavo s={s} soglie={soglie} />;
    case 'pol':
      return (
        <p className="attenzione-box">
          Le griglie del POL-200-TS (lato A e lato B, sensori e moduli) e il confronto A/B arrivano nella <strong>fase 3</strong>.
          Per ora puoi passare al passo successivo.
        </p>
      );
    case 'ritorno':
      return (
        <>
          <p className="tenue">
            Valori del multimetro del POL-200-TS: capacità tra + e − (massimo {String(soglie.capacitaMaxUF).replace('.', ',')} μF) e
            tensione di ritorno (sotto {soglie.vRitornoMinV} V la resistenza del loop è troppo alta).
          </p>
          <SequenzaMisure sessioneId={s.id} misure={s.misure} domande={DOM_MULTIMETRO} soglie={soglie} iniziale={q} onCompletata={onAvanti} />
        </>
      );
    case 'ricollegamento':
      return (
        <>
          <ol className="istruzioni">
            <li>Ricollegare il loop (ramo A e B) e la calza in centrale.</li>
            <li>Alimentare la centrale e misurare la tensione in uscita della linea (nessun punto programmato): deve essere 24 Vcc.</li>
          </ol>
          <SequenzaMisure sessioneId={s.id} misure={s.misure} domande={[{ ramo: 'loop', tipo: 'vLin' }]} soglie={soglie} iniziale={q} onCompletata={onAvanti} />
        </>
      );
    case 'riconoscimento':
      return <EditorRiconoscimento sessione={s} />;
    case 'esito':
      return <PassoEsito ctx={ctx} />;
  }
  return null;
}

function AvvisoScarica({ s, soglie, rami = ['A', 'B'] }: { s: Sessione; soglie: Soglie; rami?: ('A' | 'B')[] }) {
  const alti = rami.filter((r) => tensioneResiduaAlta(s.misure, r, soglie));
  if (alti.length > 0) {
    return (
      <p className="errore-box avviso-scarica" role="alert">
        <strong>Tensione residua presente sul ramo {alti.join(' e ')}.</strong> Scarica la linea (collega brevemente + e −, poi verso
        terra) e rimisura la tensione prima delle misure in Ω: altrimenti le letture sono falsate e lo strumento può danneggiarsi.
      </p>
    );
  }
  return <p className="attenzione-box">⚠ Prima delle misure in Ω e MΩ la linea deve essere scollegata e scarica.</p>;
}

const SINTOMI: { v: Sintomo['tipo']; t: string }[] = [
  { v: 'dispersione', t: 'Dispersione' },
  { v: 'loop_aperto', t: 'Loop aperto' },
  { v: 'corto', t: 'Corto' },
  { v: 'guasto', t: 'Guasto' },
  { v: 'nessuno', t: 'Nessuno' },
];
const RAMI: { v: Sintomo['ramo']; t: string }[] = [
  { v: 'A', t: 'Ramo A' },
  { v: 'B', t: 'Ramo B' },
  { v: 'entrambi', t: 'Entrambi' },
  { v: 'non_noto', t: 'Non indicato' },
];

function PassoSintomo({ s, onAvanti }: { s: Sessione; onAvanti: () => void }) {
  const [tipo, setTipo] = useState<Sintomo['tipo'] | undefined>(s.sintomo?.tipo);
  const [ramo, setRamo] = useState<Sintomo['ramo']>(s.sintomo?.ramo ?? 'non_noto');
  const [descrizione, setDescrizione] = useState(s.sintomo?.descrizione ?? '');
  async function conferma() {
    if (!tipo) return;
    await impostaSintomo(s.id, { tipo, ramo: tipo === 'nessuno' ? 'non_noto' : ramo, descrizione: descrizione.trim() });
    onAvanti();
  }
  return (
    <>
      <p>Cosa segnala la centrale su questo loop?</p>
      <div className="scelte" role="radiogroup" aria-label="Sintomo">
        {SINTOMI.map((x) => (
          <button key={x.v} type="button" role="radio" aria-checked={tipo === x.v} className={tipo === x.v ? 'scelta attiva' : 'scelta'} onClick={() => setTipo(x.v)}>
            {x.t}
          </button>
        ))}
      </div>
      {tipo && tipo !== 'nessuno' && (
        <>
          <p>Su quale ramo?</p>
          <div className="scelte" role="radiogroup" aria-label="Ramo">
            {RAMI.map((x) => (
              <button key={x.v} type="button" role="radio" aria-checked={ramo === x.v} className={ramo === x.v ? 'scelta attiva' : 'scelta'} onClick={() => setRamo(x.v)}>
                {x.t}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="campo">
        <span className="campo-etichetta">Messaggio sul display / dettagli (facoltativo)</span>
        <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. GUASTO TERRA NEGATIVO LOOP 2" />
      </label>
      <div className="azioni">
        <button className="primario" disabled={!tipo} onClick={conferma}>
          Conferma sintomo
        </button>
      </div>
    </>
  );
}

const SEZIONI_COMUNI = [1, 1.5, 2.5];

function PassoCavo({ s, soglie }: { s: Sessione; soglie: Soglie }) {
  const c = s.cavo;
  const salva = (patch: Partial<Sessione['cavo']>) => salvaCavo(s.id, patch);
  const min = c.lunghezzaM ? sezioneMinima(c.lunghezzaM, soglie.tabellaSezioni) : undefined;
  return (
    <>
      <div className="griglia-campi">
        <CampoNumero etichetta="Lunghezza del loop" unita="m" valore={c.lunghezzaM} onSalva={(v) => salva({ lunghezzaM: v })} aiuto="Da A a B, lungo tutto il percorso" />
        <CampoNumero etichetta="Sezione" unita="mm²" valore={c.sezioneMm2} onSalva={(v) => salva({ sezioneMm2: v })} />
        <CampoTesto etichetta="Tipo di cavo" valore={c.tipo} onSalva={(v) => salva({ tipo: v })} placeholder="es. 2x1,5 schermato twistato" />
      </div>
      <div className="scelte">
        {SEZIONI_COMUNI.map((x) => (
          <button key={x} type="button" className={c.sezioneMm2 === x ? 'scelta attiva' : 'scelta'} onClick={() => salva({ sezioneMm2: x })}>
            {String(x).replace('.', ',')} mm²
          </button>
        ))}
      </div>
      {c.lunghezzaM && c.sezioneMm2 ? (
        <ul className="calcoli">
          <li>
            Resistenza attesa per conduttore: <strong>{(Math.round(resistenzaConduttore(c.lunghezzaM, c.sezioneMm2) * 10) / 10).toString().replace('.', ',')} Ω</strong>
          </li>
          <li>
            Con {String(c.sezioneMm2).replace('.', ',')} mm² la lunghezza massima è circa <strong>{Math.round(lunghezzaMassima(c.sezioneMm2, soglie.rLoopMaxOhm))} m</strong>
          </li>
          <li>
            {min === null ? (
              <span className="testo-att">Lunghezza oltre la tabella delle sezioni.</span>
            ) : min !== undefined && c.sezioneMm2 < min ? (
              <span className="testo-err">Sezione insufficiente: per {c.lunghezzaM} m servono almeno {String(min).replace('.', ',')} mm².</span>
            ) : (
              <span className="testo-ok">Sezione adeguata secondo la tabella.</span>
            )}
          </li>
        </ul>
      ) : null}
    </>
  );
}

function PassoEsito({ ctx }: { ctx: CtxSessione }) {
  const { sessione: s, loop, impostazioni } = ctx;
  const nav = useNavigate();
  const anomalie = analizzaSessione(s, loop, impostazioni.soglie);
  const suggerito = esitoSuggerito(anomalie, s);
  const [esito, setEsito] = useState(s.fine ? s.esito : suggerito);
  async function chiudi() {
    await chiudiSessione(s.id, esito);
    nav(`/sessione/${s.id}`);
  }
  return (
    <>
      <h2>Analisi</h2>
      <ElencoAnomalie anomalie={anomalie} />
      <p>
        Esito suggerito: <span className={`badge esito-${suggerito}`}>{testoEsito(suggerito)}</span>
      </p>
      <div className="griglia-campi">
        <CampoScelta etichetta="Esito del loop" valore={esito} opzioni={ESITI_LOOP} onSalva={setEsito} />
        <CampoTesto etichetta="Attività ancora da eseguire" multiriga valore={s.attivitaDaEseguire} onSalva={(v) => aggiornaSessione(s.id, { attivitaDaEseguire: v })} className="largo" />
        <CampoTesto etichetta="Note" multiriga valore={s.note} onSalva={(v) => aggiornaSessione(s.id, { note: v })} className="largo" />
      </div>
      <div className="azioni">
        <button className="primario" onClick={chiudi}>
          {s.fine ? 'Aggiorna esito' : 'Chiudi verifica'}
        </button>
      </div>
    </>
  );
}
