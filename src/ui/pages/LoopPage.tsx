import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/db';
import { aggiornaLoop, creaSessione } from '../../db/repo';
import type { EsitoLoop, Loop } from '../../model/types';
import { Caricamento, Intestazione, NonTrovato} from '../components/Layout';
import { CampoNumero, CampoScelta, CampoTesto } from '../components/Campi';
import { ESITI_LOOP, formattaOra, testoEsito } from '../etichette';
import { ConfrontoLetture } from '../pol/ConfrontoLetture';
import { avanzamento } from '../../analysis/prossimoPasso';
import { NOME_RAMO } from '../pol/LetturaPage';

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
      <Intestazione
        sopratitolo={`${impianto?.cliente || 'Impianto'} · ${centrale?.nome || 'Centrale'}`}
        titolo={`Loop ${loop.numero} — ${loop.scheda}`}
        indietro={centrale ? `/centrale/${centrale.id}` : '/'}
      />

      <section className="scheda">
        <h2>Dati del loop</h2>
        <div className="griglia-campi">
          <CampoTesto etichetta="Descrizione / zona servita" valore={loop.descrizione} onSalva={(v) => salva({ descrizione: v })} className="largo" />
          <CampoNumero etichetta="Sensori attesi" intero valore={loop.totaleAttesoSensori} onSalva={(v) => salva({ totaleAttesoSensori: v })} aiuto="Da progetto o da programmazione" />
          <CampoNumero etichetta="Moduli attesi" intero valore={loop.totaleAttesoModuli} onSalva={(v) => salva({ totaleAttesoModuli: v })} />
          <CampoScelta
            etichetta="Stile della linea (in centrale)"
            valore={loop.stile ?? ''}
            opzioni={[{ valore: '', testo: 'Non indicato' }, { valore: 'chiuso', testo: 'Loop chiuso' }, { valore: 'aperto', testo: 'Linea aperta' }]}
            onSalva={(v) => salva({ stile: v === '' ? undefined : (v as 'aperto' | 'chiuso') })}
          />
          <CampoScelta
            etichetta="Protocollo"
            valore={loop.protocollo ?? ''}
            opzioni={[{ valore: '', testo: 'Non indicato' }, { valore: 'ADV', testo: 'ADV (indirizzi 1-159)' }, { valore: 'CLIP', testo: 'CLIP (indirizzi 1-99)' }]}
            onSalva={(v) => salva({ protocollo: v === '' ? undefined : (v as 'ADV' | 'CLIP') })}
          />
          <CampoNumero etichetta="Resistenza di linea impostata" unita="Ω" valore={loop.resistenzaLineaOhm} onSalva={(v) => salva({ resistenzaLineaOhm: v })} aiuto="Menù Sistema → Linea" />
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
                  <span className={`barra-avanzamento ${avanzamento(s) === 100 ? 'completa' : ''}`} style={{ margin: '0.3rem 0' }}>
                    <div style={{ width: `${avanzamento(s)}%` }} />
                  </span>
                  <span className="voce-dettagli">
                    {avanzamento(s)}% · {s.misure.length} misure · {s.letture.length} letture POL · {s.tecnico || 'tecnico n.d.'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {sessioni.flatMap((x) => x.letture).length > 1 && (
        <section className="scheda">
          <h2>Storico delle letture POL del loop</h2>
          <p className="tenue">Confronta due letture qualsiasi, anche di verifiche diverse: cosa è comparso, sparito o cambiato.</p>
          <ConfrontoLetture
            letture={sessioni
              .flatMap((x) => x.letture)
              .sort((p, q) => (p.ora < q.ora ? 1 : -1))
              .map((l) => ({ lettura: l, etichetta: `${formattaOra(l.ora)} — ${NOME_RAMO[l.ramo]}` }))}
          />
        </section>
      )}
    </>
  );
}
