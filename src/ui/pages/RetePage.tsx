import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '../../db/db';
import { adesso, leggiRete, nuovoId, salvaRete } from '../../db/repo';
import { analizzaRete } from '../../analysis/network';
import type { EsitoVoce, Rete, StatoBus, TipoComunicazione, Topologia, VoceChecklist } from '../../model/types';
import { Briciole, Caricamento, NonTrovato } from '../components/Layout';
import { CampoScelta, CampoTesto } from '../components/Campi';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { useState } from 'react';

const TIPI: TipoComunicazione[] = ['CANbus', 'RS485', 'Ethernet', 'Fibra', 'Altro'];
const TOPOLOGIE: Topologia[] = ['Anello', 'Lineare', 'Stella', 'Altro'];
const STATI: StatoBus[] = ['Non verificato', 'OK', 'Intermittente', 'Guasto'];

export function RetePage() {
  const { id = '' } = useParams();
  const impianto = useLiveQuery(() => db.impianti.get(id).then((x) => x ?? null), [id]);
  const centrali = useLiveQuery(() => db.centrali.where('impiantoId').equals(id).sortBy('nodoCpu'), [id]);
  const rete = useLiveQuery(() => leggiRete(id), [id]);
  const [nuovaVoce, setNuovaVoce] = useState('');

  if (impianto === undefined || centrali === undefined || rete === undefined) return <Caricamento />;
  if (impianto === null) return <NonTrovato cosa="Impianto" />;

  const salva = (patch: Partial<Rete>) => salvaRete({ ...rete, ...patch });
  const setVoce = (vid: string, patch: Partial<VoceChecklist>) =>
    salva({ checklist: rete.checklist.map((v) => (v.id === vid ? { ...v, ...patch } : v)) });
  const toggleCentrale = (cid: string) =>
    salva({
      centraliCollegate: rete.centraliCollegate.includes(cid)
        ? rete.centraliCollegate.filter((x) => x !== cid)
        : [...rete.centraliCollegate, cid],
    });

  return (
    <>
      <Briciole
        voci={[
          { testo: 'Impianti', a: '/' },
          { testo: impianto.cliente || 'Impianto', a: `/impianto/${id}` },
          { testo: 'Rete' },
        ]}
      />
      <h1>Verifica rete tra centrali</h1>

      <section className="scheda">
        <h2>Configurazione</h2>
        <div className="griglia-campi">
          <CampoScelta etichetta="Tipo di comunicazione" valore={rete.tipo} opzioni={TIPI} onSalva={(v) => salva({ tipo: v })} />
          {rete.tipo === 'Altro' && <CampoTesto etichetta="Specificare" valore={rete.tipoAltro} onSalva={(v) => salva({ tipoAltro: v })} />}
          <CampoScelta etichetta="Topologia" valore={rete.topologia} opzioni={TOPOLOGIE} onSalva={(v) => salva({ topologia: v })} />
          <CampoScelta etichetta="Stato del bus" valore={rete.statoBus} opzioni={STATI} onSalva={(v) => salva({ statoBus: v })} />
        </div>
        <h3>CPU collegate in rete</h3>
        <div className="scelte-multiple">
          {centrali.map((c) => (
            <label key={c.id} className="spunta">
              <input type="checkbox" checked={rete.centraliCollegate.includes(c.id)} onChange={() => toggleCentrale(c.id)} />
              {c.nome} — CPU {c.nodoCpu || '?'} ({c.modello})
            </label>
          ))}
        </div>
      </section>

      <section className="scheda">
        <h2>Checklist</h2>
        <ul className="checklist">
          {rete.checklist.map((v) => (
            <li key={v.id} className={`voce-check esito-${v.esito ?? 'nd'}`}>
              <div className="voce-check-testo">{v.testo}</div>
              <SiNo valore={v.esito} onCambia={(e) => setVoce(v.id, { esito: e, ora: e ? adesso() : undefined })} />
              <CampoTesto etichetta="Nota" valore={v.nota} onSalva={(t) => setVoce(v.id, { nota: t })} className="nota-voce" />
              {v.id.startsWith('custom-') && (
                <button className="piccolo" onClick={() => salva({ checklist: rete.checklist.filter((x) => x.id !== v.id) })}>
                  Rimuovi voce
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="aggiungi-voce"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nuovaVoce.trim()) return;
            salva({ checklist: [...rete.checklist, { id: `custom-${nuovoId()}`, testo: nuovaVoce.trim(), esito: null, nota: '' }] });
            setNuovaVoce('');
          }}
        >
          <input placeholder="Aggiungi una voce alla checklist…" value={nuovaVoce} onChange={(e) => setNuovaVoce(e.target.value)} />
          <button type="submit">Aggiungi</button>
        </form>
        <CampoTesto etichetta="Note sulla rete" multiriga valore={rete.note} onSalva={(t) => salva({ note: t })} />
      </section>

      <section className="scheda">
        <h2>Analisi</h2>
        <ElencoAnomalie anomalie={analizzaRete(rete, centrali)} vuoto="Rete senza anomalie." />
      </section>
    </>
  );
}

function SiNo({ valore, onCambia }: { valore: EsitoVoce; onCambia: (e: EsitoVoce) => void }) {
  const op: { v: Exclude<EsitoVoce, null>; t: string }[] = [
    { v: 'si', t: 'Sì' },
    { v: 'no', t: 'No' },
    { v: 'na', t: 'N/A' },
  ];
  return (
    <div className="sino" role="group">
      {op.map((o) => (
        <button
          key={o.v}
          type="button"
          className={valore === o.v ? `attivo ${o.v}` : ''}
          aria-pressed={valore === o.v}
          onClick={() => onCambia(valore === o.v ? null : o.v)}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}
