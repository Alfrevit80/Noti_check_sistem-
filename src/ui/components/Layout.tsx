import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

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
