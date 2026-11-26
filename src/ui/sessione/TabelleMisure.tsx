import { Link } from 'react-router-dom';
import type { Misura, Sessione, Soglie, TipoMisura } from '../../model/types';
import { DEF_MISURE, TIPI_ISOLAMENTO, formattaValore, ultimaMisura, type RamoMisura } from '../../analysis/misure';
import { valutaMisura } from '../../analysis/valutazione';
import { lunghezzaMassima, resistenzaConduttore, sezioneMinima } from '../../analysis/loopResistance';
import { formattaOra } from '../etichette';

function CellaMisura(props: { misure: readonly Misura[]; ramo: RamoMisura; tipo: TipoMisura; soglie: Soglie; link: string }) {
  const m = ultimaMisura(props.misure, props.ramo, props.tipo);
  const def = DEF_MISURE[props.tipo];
  const stato = m ? valutaMisura(props.tipo, m.valore, props.soglie) : 'vuoto';
  return (
    <td className={`cella-misura v-${stato}`}>
      <Link to={props.link} title="Misura / rimisura">
        <span className="valore">{m ? formattaValore(m.valore, m.valore === 'OL' ? undefined : def.unita) : '—'}</span>
        {m && <span className="ora">{formattaOra(m.ora).slice(-5)}</span>}
      </Link>
    </td>
  );
}

export function TabellaIsolamento({ sessione, soglie }: { sessione: Sessione; soglie: Soglie }) {
  return (
    <div className="scorrimento-x">
      <table className="tabella tabella-misure">
        <thead>
          <tr>
            <th>Isolamento (MΩ)</th>
            <th>Ramo A</th>
            <th>Ramo B</th>
          </tr>
        </thead>
        <tbody>
          {TIPI_ISOLAMENTO.map((t) => (
            <tr key={t}>
              <th scope="row">{DEF_MISURE[t].etichetta}</th>
              {(['A', 'B'] as const).map((r) => (
                <CellaMisura key={r} misure={sessione.misure} ramo={r} tipo={t} soglie={soglie} link={`/sessione/${sessione.id}/guida/iso${r}?q=${t}`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TabellaResistenzeTensioni({ sessione, soglie }: { sessione: Sessione; soglie: Soglie }) {
  const rP = ultimaMisura(sessione.misure, 'loop', 'rP')?.valore;
  const rN = ultimaMisura(sessione.misure, 'loop', 'rN')?.valore;
  const tot = typeof rP === 'number' && typeof rN === 'number' ? Math.round((rP + rN) * 100) / 100 : undefined;
  const g = (passo: string, q: string) => `/sessione/${sessione.id}/guida/${passo}?q=${q}`;
  return (
    <div className="scorrimento-x">
      <table className="tabella tabella-misure">
        <thead>
          <tr>
            <th>Misura</th>
            <th>Valore</th>
            <th>Limite</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Tensione residua ramo A</th>
            <CellaMisura misure={sessione.misure} ramo="A" tipo="vRes" soglie={soglie} link={g('scollegamento', 'vRes-A')} />
            <td className="tenue">≤ {soglie.vResiduaMaxV} V</td>
          </tr>
          <tr>
            <th scope="row">Tensione residua ramo B</th>
            <CellaMisura misure={sessione.misure} ramo="B" tipo="vRes" soglie={soglie} link={g('scollegamento', 'vRes-B')} />
            <td className="tenue">≤ {soglie.vResiduaMaxV} V</td>
          </tr>
          <tr>
            <th scope="row">Resistenza A+ → B+</th>
            <CellaMisura misure={sessione.misure} ramo="loop" tipo="rP" soglie={soglie} link={g('resistenza', 'rP')} />
            <td className="tenue" />
          </tr>
          <tr>
            <th scope="row">Resistenza A− → B−</th>
            <CellaMisura misure={sessione.misure} ramo="loop" tipo="rN" soglie={soglie} link={g('resistenza', 'rN')} />
            <td className="tenue">≤ {soglie.rNegMaxOhm} Ω</td>
          </tr>
          <tr>
            <th scope="row">Resistenza di loop totale</th>
            <td className={`cella-misura v-${tot === undefined ? 'vuoto' : tot > soglie.rLoopMaxOhm ? 'basso' : 'ok'}`}>
              <span className="valore">{tot === undefined ? '—' : formattaValore(tot, 'Ω')}</span>
            </td>
            <td className="tenue">≤ {soglie.rLoopMaxOhm} Ω</td>
          </tr>
          <tr>
            <th scope="row">Tensione di ritorno (POL)</th>
            <CellaMisura misure={sessione.misure} ramo="loop" tipo="vRit" soglie={soglie} link={g('ritorno', 'vRit')} />
            <td className="tenue">≥ {soglie.vRitornoMinV} V</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function RiepilogoCavo({ sessione, soglie }: { sessione: Sessione; soglie: Soglie }) {
  const { lunghezzaM: L, sezioneMm2: S, tipo } = sessione.cavo;
  if (!L && !S && !tipo) return <p className="tenue">Dati del cavo non inseriti.</p>;
  const min = L ? sezioneMinima(L, soglie.tabellaSezioni) : undefined;
  return (
    <dl className="dati">
      {tipo && (
        <>
          <dt>Tipo</dt>
          <dd>{tipo}</dd>
        </>
      )}
      <dt>Lunghezza</dt>
      <dd>{L ? `${L} m` : '—'}</dd>
      <dt>Sezione</dt>
      <dd>
        {S ? `${String(S).replace('.', ',')} mm²` : '—'}
        {min != null && S && S < min && <span className="badge g-alta">min {String(min).replace('.', ',')} mm²</span>}
      </dd>
      {L && S ? (
        <>
          <dt>Resistenza attesa per conduttore</dt>
          <dd>{formattaValore(Math.round(resistenzaConduttore(L, S) * 10) / 10, 'Ω')}</dd>
          <dt>Lunghezza massima con questa sezione</dt>
          <dd>circa {Math.round(lunghezzaMassima(S, soglie.rLoopMaxOhm))} m</dd>
        </>
      ) : null}
    </dl>
  );
}
