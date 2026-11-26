// Mappatura in ordine fisico: percorso principale dalla centrale, derivazioni rientrate, fine ramo evidenziata.
import type { LetturaPol } from '../../model/types';
import { breve, costruisciMappa, type NodoMappa } from '../../analysis/mappa';
import { datiIllegibili, idNodo } from '../../import/mnt';

function Ramo({ nodo, l, primo }: { nodo: NodoMappa; l: LetturaPol; primo?: boolean }) {
  // percorre il ramo finché continua dritto; le derivazioni (tutti i figli tranne l'ultimo) si rientrano
  const catena: NodoMappa[] = [];
  let n: NodoMappa | undefined = nodo;
  while (n) {
    catena.push(n);
    n = n.figli[n.figli.length - 1];
  }
  return (
    <ol className={`mappa-ramo ${primo ? 'principale' : 'derivato'}`}>
      {catena.map((x) => {
        const d = x.dispositivo;
        const sigla = l[d.famiglia][d.indirizzo] ?? '';
        const fine = x.figli.length === 0;
        const classi = ['mappa-nodo', d.famiglia, datiIllegibili(d) ? 'corrotto' : '', fine ? 'fine' : '', x.figli.length > 1 ? 'derivazione' : ''].join(' ');
        return (
          <li key={x.id}>
            <div className={classi}>
              <span className="pos">{x.profondita}</span>
              <strong>{breve(x.id)}</strong>
              <span className="sigla">{sigla}</span>
              <span className="tenue tipo">{d.tipoNome}</span>
              {d.iso === 'N' && <span className="badge g-media">ISO N</span>}
              {x.figli.length > 1 && <span className="badge">T: {x.figli.length - 1} derivazion{x.figli.length > 2 ? 'i' : 'e'}</span>}
              {fine && <span className="badge g-alta">fine ramo</span>}
            </div>
            {x.figli.slice(0, -1).map((f) => (
              <Ramo key={f.id} nodo={f} l={l} />
            ))}
          </li>
        );
      })}
    </ol>
  );
}

export function VistaMappatura({ l }: { l: LetturaPol }) {
  if (!l.dettagli?.length) return <p className="tenue">Nessun dato di mappatura: si ottiene importando il file .MNT del POL.</p>;
  const m = costruisciMappa(l.dettagli);
  return (
    <div className="mappa">
      <p className="mappa-centrale">Centrale / POL ({l.ramo === 'chiuso' ? 'loop chiuso' : `lato ${l.ramo}`})</p>
      {[...m.radici].sort((a, b) => b.dimensione - a.dimensione).map((r, i) => (
        <Ramo key={r.id} nodo={r} l={l} primo={i === 0} />
      ))}
      {m.nonMappati.length > 0 && (
        <p className="tenue">
          Non collocati (DEP vuoto): {m.nonMappati.map((d) => breve(idNodo(d.famiglia, d.indirizzo))).join(', ')}
        </p>
      )}
      <ul className="legenda-stati">
        <li><span className="campione mappa-c-corrotto" />Risposta corrotta</li>
        <li><span className="campione mappa-c-fine" />Fine ramo</li>
        <li><span className="campione mappa-c-modulo" />Modulo</li>
      </ul>
    </div>
  );
}

export function TabellaDettagli({ l }: { l: LetturaPol }) {
  const dd = [...(l.dettagli ?? [])].sort((a, b) => (a.famiglia === b.famiglia ? a.indirizzo - b.indirizzo : a.famiglia === 'sensori' ? -1 : 1));
  const npw = Math.max(0, ...dd.map((d) => d.pw.length));
  return (
    <div className="scorrimento-x">
      <table className="tabella tabella-dettagli">
        <thead>
          <tr>
            <th>Ind.</th>
            <th>Tipo</th>
            <th>Costr.</th>
            <th>Seriale</th>
            <th>Prod.</th>
            {Array.from({ length: npw }, (_, i) => (
              <th key={i}>PW{i + 1}</th>
            ))}
            <th>I</th>
            <th>I_I</th>
            <th>STA</th>
            <th>ISO</th>
            <th>DEP</th>
          </tr>
        </thead>
        <tbody>
          {dd.map((d) => (
            <tr key={idNodo(d.famiglia, d.indirizzo)} className={datiIllegibili(d) ? 'riga-corrotta' : ''}>
              <td>{breve(idNodo(d.famiglia, d.indirizzo))}</td>
              <td>
                {d.tipoCodice} {d.tipoNome}
              </td>
              <td>{d.costruttore}</td>
              <td>{d.seriale}</td>
              <td>{d.dataProd}</td>
              {Array.from({ length: npw }, (_, i) => (
                <td key={i}>{d.pw[i] ?? ''}</td>
              ))}
              <td>{d.corrente ?? ''}</td>
              <td>{d.correnteIniziale ?? ''}</td>
              <td>{d.sta ?? ''}</td>
              <td>{d.iso ?? ''}</td>
              <td>{d.dep ? (d.dep === 'PNL' ? 'PNL' : breve(d.dep)) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
