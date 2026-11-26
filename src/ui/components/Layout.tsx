import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { bloccaApp } from '../Accesso';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="barra">
        <Link to="/" className="marchio">
          <img src="./icon.svg" alt="" width={28} height={28} />
          <span>Notifier Check System</span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Impianti
          </NavLink>
          <NavLink to="/impostazioni">Impostazioni</NavLink>
          <button className="blocca" onClick={bloccaApp} title="Blocca l'app" aria-label="Blocca l'app">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V7z" />
            </svg>
            <span>Blocca</span>
          </button>
        </nav>
      </header>
      <main className="contenuto">{children}</main>
    </div>
  );
}

export interface Briciola {
  testo: string;
  a?: string;
}

export function Briciole({ voci }: { voci: Briciola[] }) {
  return (
    <nav className="briciole" aria-label="Percorso">
      {voci.map((v, i) => (
        <span key={i}>
          {i > 0 && <span className="sep">›</span>}
          {v.a ? <Link to={v.a}>{v.testo}</Link> : <span>{v.testo}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Caricamento() {
  return <p className="tenue">Caricamento…</p>;
}

export function NonTrovato({ cosa }: { cosa: string }) {
  return (
    <div className="scheda">
      <p>{cosa} non trovato.</p>
      <Link to="/">Torna all'elenco impianti</Link>
    </div>
  );
}
