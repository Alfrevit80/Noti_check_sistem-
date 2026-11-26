import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/db';
import { aggiornaLoop, creaSessione } from '../../db/repo';
import type { EsitoLoop, Loop } from '../../model/types';
import { Briciole, Caricamento, NonTrovato } from '../components/Layout';
import { CampoNumero, CampoScelta, CampoTesto } from '../components/Campi';
import { ESITI_LOOP, formattaOra, testoEsito } from '../etichette';

export function LoopPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const loop = useLiveQuery(() => db.loops.get(id).then((x) => x ?? null), [id]);
  const centrale = useLiveQuery(async () => (loop ? (await db.centrali.get(loop.centraleId)) ?? null : null), [loop?.centraleId]);
  const impianto = useLiveQuery(async () => (centrale ? (await db.impianti.get(centrale.impiantoId)) ?? null : null), [centrale?.impiantoId]);
  const sessioni = useLiveQuery(() => db.sessioni.where('loopId').equals(id).reverse().sortBy('inizio'), [id]);

  if (loop === undefined || sessioni === undefined) return <Caricamento />;
  if (loop === null) return <NonTrovato cosa="Loop" />;

  const salva = (patch: Partial<Loop>) => aggiornaLoop(id, patch);

  return (
    <>
      <Briciole
        voci={[
          { testo: 'Impianti', a: '/' },
          { testo: impianto?.cliente || 'Impianto', a: impianto ? `/impianto/${impianto.id}` : undefined },
          { testo: centrale?.nome || 'Centrale', a: centrale ? `/centrale/${centrale.id}` : undefined },
          { testo: `Loop ${loop.numero}` },
        ]}
      />
      <h1>
        Loop {loop.numero} <span className="tenue">— {loop.scheda}</span>
      </h1>

      <section className="scheda">
        <h2>Dati del loop</h2>
        <div className="griglia-campi">
          <CampoTesto etichetta="Descrizione / zona servita" valore={loop.descrizione} onSalva={(v) => salva({ descrizione: v })} className="largo" />
          <CampoNumero etichetta="Sensori attesi" intero valore={loop.totaleAttesoSensori} onSalva={(v) => salva({ totaleAttesoSensori: v })} aiuto="Da progetto o da programmazione" />
          <CampoNumero etichetta="Moduli attesi" intero valore={loop.totaleAttesoModuli} onSalva={(v) => salva({ totaleAttesoModuli: v })} />
          <CampoScelta<EsitoLoop> etichetta="Esito" valore={loop.esito} opzioni={ESITI_LOOP} onSalva={(v) => salva({ esito: v })} />
          <CampoTesto etichetta="Note" multiriga valore={loop.note} onSalva={(v) => salva({ note: v })} className="largo" />
        </div>
      </section>

      <section className="scheda">
        <div className="titolo-riga">
          <h2>Verifiche</h2>
          <button
            className="primario"
            onClick={async () => {
              const s = await creaSessione(id);
              nav(`/sessione/${s.id}/guida/sintomo`);
            }}
          >
            + Nuova verifica
          </button>
        </div>
        {sessioni.length === 0 ? (
          <p className="tenue">Nessuna verifica. Avvia la procedura guidata con «Nuova verifica».</p>
        ) : (
          <ul className="elenco">
            {sessioni.map((s) => (
              <li key={s.id}>
                <Link to={`/sessione/${s.id}`} className="voce">
                  <span className="voce-titolo">
                    {formattaOra(s.inizio)}
                    <span className={`badge esito-${s.esito}`}>{s.fine ? testoEsito(s.esito) : 'In corso'}</span>
                  </span>
                  <span className="voce-dettagli">
                    {s.misure.length} misure · {s.letture.length} letture POL · {s.tecnico || 'tecnico n.d.'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
