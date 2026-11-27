import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Check, Home, Lock, Save, Settings } from 'lucide-react';
import { bloccaApp } from '../Accesso';
import { salvaTutto } from '../salvataggio';

// ───────── avvisi a scomparsa ─────────

type TipoToast = 'ok' | 'errore' | 'info';
const ContestoToast = createContext<(testo: string, tipo?: TipoToast) => void>(() => undefined);
export const useToast = () => useContext(ContestoToast);

function ProviderToast({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<{ id: number; testo: string; tipo: TipoToast }[]>([]);
  const mostra = useCallback((testo: string, tipo: TipoToast = 'info') => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, testo, tipo }]);
    setTimeout(() => setLista((l) => l.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ContestoToast.Provider value={mostra}>
      {children}
      <div className="toast-box" role="status" aria-live="polite">
        {lista.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`}>
            {t.tipo === 'ok' && <Check size={18} />}
            {t.testo}
          </div>
        ))}
      </div>
    </ContestoToast.Provider>
  );
}

/** Salva tutto e mostra la conferma: usato dal tasto Salva di ogni pagina e da Ctrl+S. */
export function useSalva() {
  const toast = useToast();
  return useCallback(async () => {
    try {
      await salvaTutto();
      toast(`Salvato sul dispositivo alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, 'ok');
    } catch {
      toast('Salvataggio non riuscito: riprova', 'errore');
    }
  }, [toast]);
}

// ───────── struttura ─────────

const VOCI_NAV = [
  { a: '/', testo: 'Home', icona: Home, end: true },
  { a: '/impianti', testo: 'Impianti', icona: Building2, end: false },
  { a: '/impostazioni', testo: 'Impostazioni', icona: Settings, end: false },
];

function Struttura({ children }: { children: ReactNode }) {
  const salva = useSalva();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void salva();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [salva]);

  return (
    <div className="app">
      <header className="barra">
        <Link to="/" className="marchio">
          <img src="./icon.svg" alt="" />
          <span>
            Notifier Check
            <small>Verifiche loop AM-8200N · POL-200-TS</small>
          </span>
        </Link>
        <nav className="nav-desktop" aria-label="Sezioni">
          {VOCI_NAV.map((v) => (
            <NavLink key={v.a} to={v.a} end={v.end}>
              <v.icona size={18} />
              {v.testo}
            </NavLink>
          ))}
        </nav>
        <div className="barra-azioni">
          <button className="icona-btn" onClick={bloccaApp} title="Blocca l'app" aria-label="Blocca l'app">
            <Lock size={18} />
          </button>
        </div>
      </header>
      <main className="contenuto">{children}</main>
      <nav className="nav-basso" aria-label="Sezioni">
        {VOCI_NAV.map((v) => (
          <NavLink key={v.a} to={v.a} end={v.end}>
            <v.icona size={22} />
            {v.testo}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <ProviderToast>
      <Struttura>{children}</Struttura>
    </ProviderToast>
  );
}

/**
 * Intestazione di ogni pagina: Indietro (alla pagina "madre"), titolo, Salva.
 * `indietro` è il percorso della pagina superiore; senza, torna alla pagina precedente.
 */
export function Intestazione(props: { titolo: ReactNode; sopratitolo?: ReactNode; indietro?: string; azioni?: ReactNode; senzaSalva?: boolean }) {
  const nav = useNavigate();
  const salva = useSalva();
  const [fatto, setFatto] = useState(false);
  return (
    <div className="intestazione">
      <button
        type="button"
        className="btn-indietro"
        onClick={() => (props.indietro ? nav(props.indietro) : nav(-1))}
        aria-label="Indietro"
      >
        <ArrowLeft size={20} />
        <span>Indietro</span>
      </button>
      <div className="titoli">
        {props.sopratitolo && <div className="sopratitolo">{props.sopratitolo}</div>}
        <h1>{props.titolo}</h1>
      </div>
      <div className="azioni-testa">
        {props.azioni}
        {!props.senzaSalva && (
          <button
            type="button"
            className={`btn-salva ${fatto ? 'salvato' : ''}`}
            onClick={async () => {
              await salva();
              setFatto(true);
              setTimeout(() => setFatto(false), 1500);
            }}
            aria-label="Salva"
            title="Salva (Ctrl+S)"
          >
            {fatto ? <Check size={20} /> : <Save size={20} />}
            <span>{fatto ? 'Salvato' : 'Salva'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Titolo di sezione con icona. */
export function TitoloSezione({ icona: Icona, children, azioni }: { icona?: typeof Home; children: ReactNode; azioni?: ReactNode }) {
  return (
    <div className="titolo-riga">
      <h2 className="sezione-titolo">
        {Icona && <Icona size={20} />}
        {children}
      </h2>
      {azioni && <div className="azioni">{azioni}</div>}
    </div>
  );
}

export interface Briciola {
  testo: string;
  a?: string;
}

/** Percorso compatto (usato come sopratitolo). */
export function Briciole({ voci }: { voci: Briciola[] }) {
  return <>{voci.map((v) => v.testo).join(' › ')}</>;
}

export function Caricamento() {
  return <p className="tenue" style={{ paddingTop: '1rem' }}>Caricamento…</p>;
}

export function NonTrovato({ cosa }: { cosa: string }) {
  return (
    <>
      <Intestazione titolo={`${cosa} non trovato`} indietro="/" senzaSalva />
      <div className="scheda">
        <p>{cosa} non trovato: forse è stato eliminato.</p>
        <Link to="/">Torna alla home</Link>
      </div>
    </>
  );
}
