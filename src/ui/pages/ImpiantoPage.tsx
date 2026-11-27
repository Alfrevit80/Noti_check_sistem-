import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/db';
import { aggiornaImpianto, creaCentrale, eliminaImpianto, numeroLoopTotali } from '../../db/repo';
import { esportaFileCifrato } from '../../db/exportImport';
import { verificaRequisitiPassword } from '../../security/crypto';
import { CampoPassword } from '../Accesso';
import { analizzaRete } from '../../analysis/network';
import { Caricamento, Intestazione, NonTrovato} from '../components/Layout';
import { CampoTesto } from '../components/Campi';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { useState, type FormEvent } from 'react';
import { IdCard, Server, Share2 } from 'lucide-react';
import { formattaData, testoEsito } from '../etichette';
import { PulsantePdf } from '../sessione/PulsantePdf';
import { pdfImpianto } from '../../report/pdfImpianto';
import { nomePdf } from '../../report/genera';
import { leggiImpostazioni } from '../../db/repo';

export function ImpiantoPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const impianto = useLiveQuery(() => db.impianti.get(id).then((x) => x ?? null), [id]);
  const centrali = useLiveQuery(() => db.centrali.where('impiantoId').equals(id).sortBy('nodoCpu'), [id]);
  const rete = useLiveQuery(() => db.reti.get(id).then((x) => x ?? null), [id]);
  const loops = useLiveQuery(async () => {
    const cc = await db.centrali.where('impiantoId').equals(id).primaryKeys();
    return db.loops.where('centraleId').anyOf(cc).toArray();
  }, [id]);
  const [msg, setMsg] = useState('');
  const [dialogoExport, setDialogoExport] = useState(false);
  const [anagraficaAperta, setAnagraficaAperta] = useState<boolean | null>(null);

  if (impianto === undefined || centrali === undefined || rete === undefined) return <Caricamento />;
  if (impianto === null) return <NonTrovato cosa="Impianto" />;

  const salva = (campo: keyof typeof impianto) => (v: string) => aggiornaImpianto(id, { [campo]: v });
  const anomalieRete = analizzaRete(rete, centrali);

  async function esporta(password: string) {
    setMsg('');
    const { nome, testo } = await esportaFileCifrato(id, password);
    const file = new File([testo], nome, { type: 'application/json' });
    setDialogoExport(false);
    // Sul telefono: foglio di condivisione (WhatsApp, mail, Drive…). Altrimenti download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nome });
        setMsg(`File cifrato condiviso: ${nome}`);
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMsg(`File cifrato salvato: ${nome}`);
  }

  async function elimina() {
    if (!confirm('Eliminare questo impianto con tutte le centrali, i loop, le misure e le foto? L\'operazione non si può annullare.')) return;
    await eliminaImpianto(id);
    nav('/');
  }

  async function nuovaCentrale() {
    const c = await creaCentrale(id);
    nav(`/centrale/${c.id}`);
  }

  return (
    <>
      <Intestazione
        sopratitolo={impianto.nomeImpianto || 'Impianto'}
        titolo={impianto.cliente || 'Nuovo impianto'}
        indietro="/impianti"
        azioni={
          <button className="piccolo" onClick={() => setDialogoExport(true)} title="Esporta progetto cifrato">
            <Share2 size={18} />
          </button>
        }
      />
      {msg && <p className="ok-box">{msg}</p>}
      {dialogoExport && <DialogoExport onAnnulla={() => setDialogoExport(false)} onConferma={esporta} />}

      <section className="scheda">
        <div className="titolo-riga">
          <h2>Centrali</h2>
          <button className="primario" onClick={nuovaCentrale}>
            + Aggiungi centrale
          </button>
        </div>
        {centrali.length === 0 ? (
          <p className="tenue">Nessuna centrale. Aggiungine una per iniziare.</p>
        ) : (
          <div className="centrali">
            {centrali.map((c) => (
              <div key={c.id} className="centrale-card">
                <Link to={`/centrale/${c.id}`} className="centrale-testa">
                  <Server size={20} />
                  <span>
                    <strong>{c.nome}</strong>
                    <small>
                      {c.modello} · CPU {c.nodoCpu || '?'} · {numeroLoopTotali(c)} loop{c.firmware && ` · FW ${c.firmware}`}
                    </small>
                  </span>
                </Link>
                <div className="tasselli">
                  {(loops ?? [])
                    .filter((l) => l.centraleId === c.id)
                    .sort((x, y) => x.numero - y.numero)
                    .map((l) => (
                      <Link key={l.id} to={`/loop/${l.id}`} className={`tassello esito-${l.esito}`} title={`Loop ${l.numero}: ${testoEsito(l.esito)}`}>
                        <span className="num">{l.numero}</span>
                        <span className="et">{testoEsito(l.esito)}</span>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {centrali.length > 1 && (
        <section className="scheda">
          <div className="titolo-riga">
            <h2>Rete tra centrali</h2>
            <Link className="bottone" to={`/impianto/${id}/rete`}>
              {rete ? 'Apri verifica rete' : 'Compila verifica rete'}
            </Link>
          </div>
          {rete && (
            <p className="tenue">
              {rete.tipo === 'Altro' ? rete.tipoAltro || 'Altro' : rete.tipo} · {rete.topologia} · bus: {rete.statoBus} ·{' '}
              {rete.checklist.filter((v) => v.esito !== null).length}/{rete.checklist.length} voci compilate
            </p>
          )}
          <ElencoAnomalie anomalie={anomalieRete} vuoto="Rete senza anomalie." />
        </section>
      )}
      {centrali.length <= 1 && anomalieRete.length > 0 && <ElencoAnomalie anomalie={anomalieRete} />}

      <details
        className="scheda anagrafica"
        open={anagraficaAperta ?? !impianto.cliente}
        onToggle={(e) => setAnagraficaAperta((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <h2 className="sezione-titolo">
            <IdCard size={20} /> Anagrafica
          </h2>
          <span className="tenue">
            {[impianto.indirizzo, impianto.tecnico, formattaData(impianto.data)].filter(Boolean).join(' · ') || 'da compilare'}
          </span>
        </summary>
        <div className="griglia-campi">
          <CampoTesto etichetta="Cliente" valore={impianto.cliente} onSalva={salva('cliente')} />
          <CampoTesto etichetta="Impianto" valore={impianto.nomeImpianto} onSalva={salva('nomeImpianto')} placeholder="es. Edificio A, Capannone 2" />
          <CampoTesto etichetta="Indirizzo" valore={impianto.indirizzo} onSalva={salva('indirizzo')} className="largo" />
          <CampoTesto etichetta="Tecnico" valore={impianto.tecnico} onSalva={salva('tecnico')} />
          <CampoTesto etichetta="Data" tipo="date" valore={impianto.data} onSalva={salva('data')} />
          <CampoTesto etichetta="Note" multiriga valore={impianto.note} onSalva={salva('note')} className="largo" />
        </div>
      </details>

      <section className="scheda">
        <h2>Rapportino riepilogativo</h2>
        <p className="tenue">Centrali, esito di ogni loop con l'ultima verifica, rete tra centrali, firme.</p>
        <PulsantePdf
          etichetta="Genera riepilogo PDF"
          nome={nomePdf(['Riepilogo', impianto.cliente, impianto.nomeImpianto, impianto.data])}
          prepara={async () => {
            const loops = await db.loops.where('centraleId').anyOf(centrali.map((c) => c.id)).toArray();
            const sessioni = await db.sessioni.where('loopId').anyOf(loops.map((l) => l.id)).toArray();
            return pdfImpianto({ impianto, centrali, loops, sessioni, rete, impostazioni: await leggiImpostazioni() });
          }}
        />
      </section>

      <section className="scheda zona-pericolo">
        <button className="pericolo" onClick={elimina}>
          Elimina impianto
        </button>
      </section>
    </>
  );
}

function DialogoExport({ onAnnulla, onConferma }: { onAnnulla: () => void; onConferma: (password: string) => Promise<void> }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);
  async function invia(e: FormEvent) {
    e.preventDefault();
    const r = verificaRequisitiPassword(p1);
    if (r) return setErrore(r);
    if (p1 !== p2) return setErrore('Le due password non coincidono.');
    setAttesa(true);
    try {
      await onConferma(p1);
    } catch (err) {
      setErrore(`Esportazione non riuscita: ${String(err)}`);
      setAttesa(false);
    }
  }
  return (
    <div className="dialogo-sfondo" role="dialog" aria-modal="true" aria-labelledby="titolo-export">
      <form className="dialogo" onSubmit={invia}>
        <h2 id="titolo-export">Esporta progetto cifrato</h2>
        <p className="tenue">
          Il file viene cifrato con la password che scegli qui. Servirà per importarlo su un altro dispositivo: comunicala
          a parte, non nello stesso messaggio del file. Puoi usare anche la password di accesso dell'app.
        </p>
        <CampoPassword id="export-p1" etichetta="Password del file" valore={p1} onCambia={setP1} nuova autoFocus />
        <CampoPassword id="export-p2" etichetta="Ripeti la password" valore={p2} onCambia={setP2} nuova />
        {errore && <p className="errore-box">{errore}</p>}
        <div className="azioni">
          <button type="submit" className="primario" disabled={attesa}>
            {attesa ? 'Cifratura…' : 'Esporta'}
          </button>
          <button type="button" onClick={onAnnulla}>
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
