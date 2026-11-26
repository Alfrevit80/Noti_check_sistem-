import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/db';
import { aggiornaCentrale, eliminaCentrale, eliminaLoop, leggiImpostazioni, numeroLoopTotali } from '../../db/repo';
import type { Centrale, Espansione } from '../../model/types';
import { Briciole, Caricamento, NonTrovato } from '../components/Layout';
import { CampoNumero, CampoScelta, CampoTesto } from '../components/Campi';
import { testoEsito } from '../etichette';

export function CentralePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const c = useLiveQuery(() => db.centrali.get(id).then((x) => x ?? null), [id]);
  const impianto = useLiveQuery(async () => (c ? (await db.impianti.get(c.impiantoId)) ?? null : null), [c?.impiantoId]);
  const loops = useLiveQuery(() => db.loops.where('centraleId').equals(id).sortBy('numero'), [id]);
  const impostazioni = useLiveQuery(() => leggiImpostazioni(), []);

  if (c === undefined || loops === undefined || impostazioni === undefined) return <Caricamento />;
  if (c === null) return <NonTrovato cosa="Centrale" />;

  const salva = (patch: Partial<Centrale>) => aggiornaCentrale(id, patch);
  const modelli = impostazioni.modelliCentrale.includes(c.modello)
    ? impostazioni.modelliCentrale
    : [c.modello, ...impostazioni.modelliCentrale];
  const totali = numeroLoopTotali(c);

  const setEsp = (i: number, patch: Partial<Espansione>) =>
    salva({ espansioni: c.espansioni.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  async function elimina() {
    if (!confirm(`Eliminare ${c!.nome} con tutti i suoi loop e le verifiche registrate?`)) return;
    const imp = c!.impiantoId;
    await eliminaCentrale(id);
    nav(`/impianto/${imp}`);
  }

  async function eliminaLoopInEccesso(loopId: string, numero: number) {
    const n = await db.sessioni.where('loopId').equals(loopId).count();
    if (!confirm(`Eliminare il loop ${numero}${n ? ` e le sue ${n} verifiche` : ''}?`)) return;
    await eliminaLoop(loopId);
  }

  return (
    <>
      <Briciole
        voci={[
          { testo: 'Impianti', a: '/' },
          { testo: impianto?.cliente || 'Impianto', a: `/impianto/${c.impiantoId}` },
          { testo: c.nome },
        ]}
      />
      <h1>{c.nome}</h1>

      <section className="scheda">
        <h2>Dati centrale</h2>
        <div className="griglia-campi">
          <CampoTesto etichetta="Nome / posizione" valore={c.nome} onSalva={(v) => salva({ nome: v })} />
          <CampoScelta etichetta="Modello" valore={c.modello} opzioni={modelli} onSalva={(v) => salva({ modello: v })} aiuto="La lista si modifica nelle Impostazioni" />
          <CampoTesto etichetta="N. CPU / indirizzo di rete" valore={c.nodoCpu} onSalva={(v) => salva({ nodoCpu: v })} />
          <CampoTesto etichetta="Versione firmware" valore={c.firmware} onSalva={(v) => salva({ firmware: v })} />
          <CampoNumero etichetta="Loop sulla scheda base" intero valore={c.loopBase} onSalva={(v) => salva({ loopBase: Math.max(0, Math.round(v ?? 0)) })} />
          <CampoTesto etichetta="Note" multiriga valore={c.note} onSalva={(v) => salva({ note: v })} className="largo" />
        </div>
      </section>

      <section className="scheda">
        <div className="titolo-riga">
          <h2>Schede di espansione loop</h2>
          <button onClick={() => salva({ espansioni: [...c.espansioni, { modello: impostazioni.modelliEspansione[0] ?? 'LIB-8200N', loop: 2 }] })}>
            + Aggiungi scheda
          </button>
        </div>
        {c.espansioni.length === 0 && <p className="tenue">Nessuna espansione.</p>}
        {c.espansioni.map((e, i) => (
          <div key={i} className="riga-espansione">
            <span className="tenue">#{i + 1}</span>
            <CampoScelta
              etichetta="Modello"
              valore={e.modello}
              opzioni={impostazioni.modelliEspansione.includes(e.modello) ? impostazioni.modelliEspansione : [e.modello, ...impostazioni.modelliEspansione]}
              onSalva={(v) => setEsp(i, { modello: v })}
            />
            <CampoNumero etichetta="Loop" intero valore={e.loop} onSalva={(v) => setEsp(i, { loop: Math.max(0, Math.round(v ?? 0)) })} />
            <button className="piccolo" onClick={() => salva({ espansioni: c.espansioni.filter((_, j) => j !== i) })} aria-label="Rimuovi scheda">
              ✕
            </button>
          </div>
        ))}
        <p className="tenue">Totale loop: {totali}</p>
      </section>

      <section className="scheda">
        <h2>Loop</h2>
        <ul className="elenco">
          {loops.map((l) => {
            const eccesso = l.numero > totali;
            return (
              <li key={l.id} className={eccesso ? 'eccesso' : ''}>
                <Link to={`/loop/${l.id}`} className="voce">
                  <span className="voce-titolo">
                    Loop {l.numero} <span className="tenue">— {l.scheda}</span>
                    <span className={`badge esito-${l.esito}`}>{testoEsito(l.esito)}</span>
                  </span>
                  {(l.descrizione || eccesso) && (
                    <span className="voce-dettagli">{eccesso ? 'Non più previsto dalla configurazione' : l.descrizione}</span>
                  )}
                </Link>
                {eccesso && (
                  <button className="piccolo pericolo" onClick={() => eliminaLoopInEccesso(l.id, l.numero)}>
                    Elimina
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="scheda zona-pericolo">
        <button className="pericolo" onClick={elimina}>
          Elimina centrale
        </button>
      </section>
    </>
  );
}
