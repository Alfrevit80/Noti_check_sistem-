// Schermate di accesso e blocco automatico.
// Finché l'archivio non è sbloccato il resto dell'app non viene montato (nessuna lettura dal database).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { db } from '../db/db';
import { creaPassword, eliminaTuttiIDati, leggiCassaforte, sblocca, statoArchivio, type StatoArchivio } from '../security/sessione';
import { verificaRequisitiPassword } from '../security/crypto';

/** Blocca l'app: dimentica la chiave e ricarica la pagina (svuota anche tutto lo stato in memoria). */
export function bloccaApp() {
  db.impostaChiave(null);
  window.location.reload();
}

export function Accesso({ children }: { children: ReactNode }) {
  const [stato, setStato] = useState<StatoArchivio | 'caricamento' | 'errore'>('caricamento');
  const [errore, setErrore] = useState('');

  useEffect(() => {
    statoArchivio()
      .then(setStato)
      .catch((e) => {
        setErrore(String(e));
        setStato('errore');
      });
  }, []);

  if (stato === 'caricamento') return <Cornice><p className="tenue">Caricamento…</p></Cornice>;
  if (stato === 'errore') return <Cornice><p className="errore-box">Impossibile aprire l'archivio locale: {errore}</p></Cornice>;
  if (stato === 'nuovo') return <CreaPassword onFatto={() => setStato('sbloccato')} />;
  if (stato === 'bloccato') return <Sblocco onFatto={() => setStato('sbloccato')} />;
  return <BloccoAutomatico>{children}</BloccoAutomatico>;
}

function Cornice({ children }: { children: ReactNode }) {
  return (
    <div className="accesso">
      <div className="accesso-scheda">
        <div className="accesso-marchio">
          <img src="./icon.svg" alt="" width={56} height={56} />
          <h1>Notifier Check System</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CampoPassword(props: {
  id: string;
  etichetta: string;
  valore: string;
  onCambia: (v: string) => void;
  nuova?: boolean;
  autoFocus?: boolean;
}) {
  const [mostra, setMostra] = useState(false);
  return (
    <label className="campo" htmlFor={props.id}>
      <span className="campo-etichetta">{props.etichetta}</span>
      <span className="campo-password">
        <input
          id={props.id}
          type={mostra ? 'text' : 'password'}
          autoComplete={props.nuova ? 'new-password' : 'current-password'}
          autoFocus={props.autoFocus}
          value={props.valore}
          onChange={(e) => props.onCambia(e.target.value)}
        />
        <button type="button" className="piccolo" onClick={() => setMostra(!mostra)} aria-label={mostra ? 'Nascondi password' : 'Mostra password'}>
          {mostra ? 'Nascondi' : 'Mostra'}
        </button>
      </span>
    </label>
  );
}

/** Campo nascosto che aiuta i gestori di password (portachiavi iCloud, Google) a salvare la password. */
const UtenteNascosto = () => (
  <input type="text" name="username" autoComplete="username" value="Notifier Check System" readOnly hidden />
);

function CreaPassword({ onFatto }: { onFatto: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [capito, setCapito] = useState(false);
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);

  async function invia(e: FormEvent) {
    e.preventDefault();
    setErrore('');
    const r = verificaRequisitiPassword(p1);
    if (r) return setErrore(r);
    if (p1 !== p2) return setErrore('Le due password non coincidono.');
    if (!capito) return setErrore('Conferma di aver capito che la password non si può recuperare.');
    setAttesa(true);
    try {
      await creaPassword(p1);
      onFatto();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : String(err));
      setAttesa(false);
    }
  }

  return (
    <Cornice>
      <h2>Crea la password di accesso</h2>
      <p>
        Gli impianti salvati su questo dispositivo vengono <strong>cifrati</strong> con questa password: senza, nessuno può
        leggerli.
      </p>
      <form onSubmit={invia} className="accesso-form">
        <UtenteNascosto />
        <CampoPassword id="nuova-password" etichetta="Password (almeno 8 caratteri)" valore={p1} onCambia={setP1} nuova autoFocus />
        <CampoPassword id="conferma-password" etichetta="Ripeti la password" valore={p2} onCambia={setP2} nuova />
        <label className="spunta">
          <input type="checkbox" checked={capito} onChange={(e) => setCapito(e.target.checked)} />
          <span>
            Ho capito che <strong>se dimentico la password i dati non si possono recuperare</strong>, se non dai file di
            progetto esportati.
          </span>
        </label>
        {errore && <p className="errore-box">{errore}</p>}
        <button type="submit" className="primario" disabled={attesa}>
          {attesa ? 'Cifratura in corso…' : 'Crea password e entra'}
        </button>
      </form>
    </Cornice>
  );
}

function Sblocco({ onFatto }: { onFatto: () => void }) {
  const [p, setP] = useState('');
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [dimenticata, setDimenticata] = useState(false);

  async function invia(e: FormEvent) {
    e.preventDefault();
    if (!p) return;
    setErrore('');
    setAttesa(true);
    try {
      if (await sblocca(p)) return onFatto();
      setErrore('Password errata.');
      setP('');
    } catch (err) {
      setErrore(String(err));
    }
    setAttesa(false);
  }

  if (dimenticata) return <PasswordDimenticata onAnnulla={() => setDimenticata(false)} />;

  return (
    <Cornice>
      <h2>Inserisci la password</h2>
      <form onSubmit={invia} className="accesso-form">
        <UtenteNascosto />
        <CampoPassword id="password" etichetta="Password" valore={p} onCambia={setP} autoFocus />
        {errore && <p className="errore-box">{errore}</p>}
        <button type="submit" className="primario" disabled={attesa || !p}>
          {attesa ? 'Verifica…' : 'Sblocca'}
        </button>
      </form>
      <button type="button" className="link" onClick={() => setDimenticata(true)}>
        Ho dimenticato la password
      </button>
    </Cornice>
  );
}

function PasswordDimenticata({ onAnnulla }: { onAnnulla: () => void }) {
  const [testo, setTesto] = useState('');
  const [attesa, setAttesa] = useState(false);
  async function elimina() {
    setAttesa(true);
    await eliminaTuttiIDati();
    window.location.reload();
  }
  return (
    <Cornice>
      <h2>Password dimenticata</h2>
      <p>
        La password non si può recuperare: è l'unica chiave dei dati cifrati. L'unica possibilità è{' '}
        <strong>cancellare tutti i dati di questo dispositivo</strong> e ripartire, reimportando gli impianti dai file
        esportati (per aprirli serve la password scelta all'esportazione).
      </p>
      <label className="campo" htmlFor="conferma-elimina">
        <span className="campo-etichetta">Per confermare scrivi ELIMINA</span>
        <input id="conferma-elimina" value={testo} onChange={(e) => setTesto(e.target.value)} autoComplete="off" />
      </label>
      <div className="azioni">
        <button className="pericolo" disabled={testo.trim().toUpperCase() !== 'ELIMINA' || attesa} onClick={elimina}>
          Cancella tutti i dati
        </button>
        <button onClick={onAnnulla}>Annulla</button>
      </div>
    </Cornice>
  );
}

/** Blocca l'app dopo N minuti senza interazioni (anche se l'app resta in background). */
function BloccoAutomatico({ children }: { children: ReactNode }) {
  const ultimo = useRef(Date.now());
  const minuti = useRef(15);

  useEffect(() => {
    leggiCassaforte().then((c) => {
      if (c) minuti.current = c.bloccoMinuti;
    });
    const tocca = () => {
      controlla();
      ultimo.current = Date.now();
    };
    const controlla = () => {
      if (minuti.current > 0 && Date.now() - ultimo.current > minuti.current * 60_000) bloccaApp();
    };
    const visibilita = () => document.visibilityState === 'visible' && controlla();
    const eventi = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    eventi.forEach((e) => window.addEventListener(e, tocca, { passive: true }));
    document.addEventListener('visibilitychange', visibilita);
    const t = setInterval(controlla, 15_000);
    // le Impostazioni avvisano quando cambia il tempo di blocco
    const aggiorna = (e: Event) => (minuti.current = (e as CustomEvent<number>).detail);
    window.addEventListener('ncs-blocco-minuti', aggiorna);
    return () => {
      eventi.forEach((e) => window.removeEventListener(e, tocca));
      document.removeEventListener('visibilitychange', visibilita);
      window.removeEventListener('ncs-blocco-minuti', aggiorna);
      clearInterval(t);
    };
  }, []);

  return <>{children}</>;
}
