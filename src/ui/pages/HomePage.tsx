// Cruscotto: verifiche in corso, numeri chiave, azioni rapide, promemoria dai manuali.
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, CheckCircle2, ClipboardList, Lightbulb, Plus, Upload } from 'lucide-react';
import { db } from '../../db/db';
import { creaImpianto, leggiImpostazioni } from '../../db/repo';
import { avanzamento, prossimiPassi } from '../../analysis/prossimoPasso';
import { formattaData, formattaOra, testoEsito } from '../etichette';
import { TitoloSezione } from '../components/Layout';

const PROMEMORIA = [
  'Leggi con il POL in modalità ADV: con AM-8200N e sensori NFX la modalità CLIP&ADV produce «??» e minuscole inutili.',
  'Isolamento: il manuale chiede più di 15÷20 MΩ tra conduttori, calza e terra, meglio infinito; 2 MΩ è il minimo assoluto.',
  'Resistenza del loop: totale sotto 40 Ω, negativo entro 20 Ω; + e − devono essere quasi uguali.',
  'La calza va a terra solo in centrale, deve essere continua: circa 2–3 volte la resistenza del negativo.',
  'Con il loop aperto non si possono avere più di 32 punti di allarme (sensori e pulsanti) su un lato.',
  'Prima di confermare l\'auto-riconoscimento (CONF) controlla i MAN: vengono rimossi dalla programmazione.',
  'Tensione di ritorno sul POL sotto 17 V: resistenza del loop troppo alta.',
  'Sul Multimetro del POL collega sempre anche le calze (morsetti grigi) e la terra, altrimenti quelle misure non valgono.',
];

export function HomePage() {
  const nav = useNavigate();
  const dati = useLiveQuery(async () => {
    const [impianti, centrali, loops, sessioni, imp] = await Promise.all([
      db.impianti.toArray(),
      db.centrali.toArray(),
      db.loops.toArray(),
      db.sessioni.toArray(),
      leggiImpostazioni(),
    ]);
    return { impianti, centrali, loops, sessioni, imp };
  }, []);
  if (!dati) return null;
  const { impianti, centrali, loops, sessioni, imp } = dati;
  const aperte = sessioni.filter((s) => !s.fine).sort((a, b) => (a.inizio < b.inizio ? 1 : -1));
  const nonConformi = loops.filter((l) => l.esito === 'non_conforme').length;
  const daVerificare = loops.filter((l) => l.esito === 'da_verificare').length;
  const recenti = [...impianti].sort((a, b) => (a.modificato < b.modificato ? 1 : -1)).slice(0, 5);
  const consiglio = PROMEMORIA[new Date().getDate() % PROMEMORIA.length];
  const ora = new Date().getHours();
  const saluto = ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';

  async function nuovo() {
    const i = await creaImpianto();
    nav(`/impianto/${i.id}`);
  }

  return (
    <>
      <div style={{ padding: '1.1rem 0 0.4rem' }}>
        <h1 style={{ marginBottom: '0.2rem' }}>
          {saluto}
          {imp.tecnicoPredefinito ? `, ${imp.tecnicoPredefinito.split(' ')[0]}` : ''}
        </h1>
        <p className="tenue" style={{ margin: 0 }}>
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="kpi">
        <Link to="/impianti" className="kpi-voce">
          <span className="icona"><Building2 size={22} /></span>
          <span><strong>{impianti.length}</strong><span>impianti</span></span>
        </Link>
        <a href="#in-corso" className="kpi-voce att">
          <span className="icona"><ClipboardList size={22} /></span>
          <span><strong>{aperte.length}</strong><span>verifiche in corso</span></span>
        </a>
        <div className="kpi-voce">
          <span className="icona"><AlertTriangle size={22} /></span>
          <span><strong>{nonConformi}</strong><span>loop non conformi</span></span>
        </div>
        <div className="kpi-voce ok">
          <span className="icona"><CheckCircle2 size={22} /></span>
          <span><strong>{loops.length - daVerificare}</strong><span>loop verificati su {loops.length}</span></span>
        </div>
      </div>

      <div className="azioni-rapide">
        <button className="primario" onClick={nuovo}>
          <Plus size={20} /> Nuovo impianto
        </button>
        <Link className="bottone" to="/impianti?importa=1">
          <Upload size={20} /> Importa progetto
        </Link>
      </div>

      <section className="scheda" id="in-corso">
        <TitoloSezione icona={ClipboardList}>Verifiche in corso</TitoloSezione>
        {aperte.length === 0 ? (
          <p className="tenue">Nessuna verifica aperta. Apri un impianto, scegli il loop e tocca «Nuova verifica».</p>
        ) : (
          <ul className="elenco">
            {aperte.map((s) => {
              const loop = loops.find((l) => l.id === s.loopId);
              const centrale = centrali.find((c) => c.id === loop?.centraleId);
              const impianto = impianti.find((i) => i.id === centrale?.impiantoId);
              const perc = avanzamento(s);
              const passo = loop ? prossimiPassi(s, loop, imp.soglie, imp.sigle, 1)[0] : undefined;
              return (
                <li key={s.id}>
                  <Link to={`/sessione/${s.id}`} className="voce">
                    <span className="voce-titolo">
                      {impianto?.cliente || 'Impianto'} · Loop {loop?.numero ?? '?'}
                      <span className="tenue">{centrale?.nome}</span>
                    </span>
                    <span className={`barra-avanzamento ${perc === 100 ? 'completa' : ''}`} style={{ margin: '0.3rem 0' }}>
                      <div style={{ width: `${perc}%` }} />
                    </span>
                    <span className="voce-dettagli">
                      {perc}% · iniziata {formattaOra(s.inizio)}
                      {passo && <> · <strong>Prossimo: {passo.titolo}</strong></>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="scheda">
        <TitoloSezione icona={Building2} azioni={<Link to="/impianti">Tutti</Link>}>
          Impianti recenti
        </TitoloSezione>
        {recenti.length === 0 ? (
          <p className="tenue">Nessun impianto: crea il primo con «Nuovo impianto».</p>
        ) : (
          <ul className="elenco">
            {recenti.map((i) => {
              const lc = loops.filter((l) => centrali.some((c) => c.impiantoId === i.id && c.id === l.centraleId));
              const nc = lc.filter((l) => l.esito === 'non_conforme').length;
              return (
                <li key={i.id}>
                  <Link to={`/impianto/${i.id}`} className="voce">
                    <span className="voce-titolo">
                      {i.cliente || <em>Cliente non indicato</em>}
                      {i.nomeImpianto && <span className="tenue">— {i.nomeImpianto}</span>}
                      {nc > 0 && <span className="badge esito-non_conforme">{nc} non conformi</span>}
                    </span>
                    <span className="voce-dettagli">
                      {formattaData(i.data)} · {lc.length} loop · {lc.filter((l) => l.esito !== 'da_verificare').length} verificati
                      {lc.length > 0 && lc.every((l) => l.esito === 'ok') && ` · ${testoEsito('ok')}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="scheda">
        <TitoloSezione icona={Lightbulb}>Promemoria dai manuali</TitoloSezione>
        <p style={{ margin: 0 }}>{consiglio}</p>
      </section>
    </>
  );
}
