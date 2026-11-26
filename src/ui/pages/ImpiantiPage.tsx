import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { creaImpianto } from '../../db/repo';
import { ErroreImport, importaProgetto, leggiFileProgetto, type ModoImport } from '../../db/exportImport';
import type { ProgettoFile } from '../../model/schema';
import { formattaData } from '../etichette';

export function ImpiantiPage() {
  const nav = useNavigate();
  const [filtro, setFiltro] = useState('');
  const impianti = useLiveQuery(() => db.impianti.orderBy('modificato').reverse().toArray(), []);
  const contaCentrali = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.centrali.each((c) => m.set(c.impiantoId, (m.get(c.impiantoId) ?? 0) + 1));
    return m;
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const [daImportare, setDaImportare] = useState<{ p: ProgettoFile; esiste: boolean } | null>(null);
  const [errore, setErrore] = useState('');

  async function nuovo() {
    const i = await creaImpianto();
    nav(`/impianto/${i.id}`);
  }

  async function scegliFile(f: File | undefined) {
    setErrore('');
    if (!f) return;
    try {
      const p = leggiFileProgetto(await f.text());
      const esiste = !!(await db.impianti.get(p.impianto.id));
      setDaImportare({ p, esiste });
    } catch (e) {
      setErrore(e instanceof ErroreImport ? e.message : `Errore nella lettura del file: ${String(e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function conferma(modo: ModoImport) {
    if (!daImportare) return;
    try {
      const id = await importaProgetto(daImportare.p, modo);
      setDaImportare(null);
      nav(`/impianto/${id}`);
    } catch (e) {
      setErrore(`Importazione non riuscita: ${String(e)}`);
    }
  }

  const f = filtro.trim().toLowerCase();
  const visibili = (impianti ?? []).filter(
    (i) => !f || [i.cliente, i.nomeImpianto, i.indirizzo, i.tecnico].some((s) => s.toLowerCase().includes(f)),
  );

  return (
    <>
      <div className="titolo-riga">
        <h1>Impianti</h1>
        <div className="azioni">
          <button onClick={() => fileRef.current?.click()}>Importa progetto…</button>
          <button className="primario" onClick={nuovo}>
            + Nuovo impianto
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => scegliFile(e.target.files?.[0])}
      />

      {errore && <p className="errore-box">{errore}</p>}

      {daImportare && (
        <div className="scheda evidenza">
          <h2>Importa progetto</h2>
          <p>
            <strong>{daImportare.p.impianto.cliente || 'Senza cliente'}</strong>
            {daImportare.p.impianto.nomeImpianto && ` — ${daImportare.p.impianto.nomeImpianto}`}
            <br />
            {daImportare.p.centrali.length} centrali, {daImportare.p.loops.length} loop,{' '}
            {daImportare.p.sessioni.length} verifiche, {daImportare.p.foto.length} foto
          </p>
          {daImportare.esiste && (
            <p className="attenzione-box">
              Questo impianto è già presente su questo dispositivo. "Sostituisci" sovrascrive la versione attuale con
              quella del file.
            </p>
          )}
          <div className="azioni">
            {daImportare.esiste && (
              <button className="pericolo" onClick={() => conferma('sostituisci')}>
                Sostituisci
              </button>
            )}
            <button className="primario" onClick={() => conferma(daImportare.esiste ? 'copia' : 'sostituisci')}>
              {daImportare.esiste ? 'Importa come copia' : 'Importa'}
            </button>
            <button onClick={() => setDaImportare(null)}>Annulla</button>
          </div>
        </div>
      )}

      {impianti && impianti.length > 3 && (
        <input className="ricerca" placeholder="Cerca cliente, impianto, indirizzo…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      )}

      {impianti === undefined ? null : impianti.length === 0 ? (
        <div className="scheda vuoto">
          <p>Nessun impianto salvato su questo dispositivo.</p>
          <p className="tenue">Crea un nuovo impianto oppure importa un file di progetto (.json) da un altro dispositivo.</p>
        </div>
      ) : (
        <ul className="elenco">
          {visibili.map((i) => (
            <li key={i.id}>
              <Link to={`/impianto/${i.id}`} className="voce">
                <span className="voce-titolo">
                  {i.cliente || <em>Cliente non indicato</em>}
                  {i.nomeImpianto && <span className="tenue"> — {i.nomeImpianto}</span>}
                </span>
                <span className="voce-dettagli">
                  {formattaData(i.data)} · {i.tecnico || 'tecnico non indicato'} · {contaCentrali?.get(i.id) ?? 0} centrali
                  {i.indirizzo && ` · ${i.indirizzo}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
