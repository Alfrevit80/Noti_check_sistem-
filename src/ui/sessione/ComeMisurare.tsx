// Riquadro "Come misurare": strumento, preparazione, esecuzione, valore atteso, errori tipici.
import { useState } from 'react';
import type { Soglie, TipoMisura } from '../../model/types';
import { ETICHETTA_FONTE, GUIDE_MISURE, GUIDE_PASSI, type Consiglio } from '../../guide/guideMisure';

const CHIAVE = 'ncs-guida-aperta';
function leggiPreferenza(): boolean {
  try {
    return localStorage.getItem(CHIAVE) !== '0';
  } catch {
    return true;
  }
}
function salvaPreferenza(aperta: boolean) {
  try {
    localStorage.setItem(CHIAVE, aperta ? '1' : '0');
  } catch {
    /* non disponibile: pazienza */
  }
}

function Voci({ voci }: { voci: Consiglio[] }) {
  return (
    <ul className="consigli">
      {voci.map((c, i) => (
        <li key={i}>
          {c.testo} <span className={`fonte fonte-${c.fonte === 'pratica' ? 'pratica' : 'manuale'}`}>{ETICHETTA_FONTE[c.fonte]}</span>
        </li>
      ))}
    </ul>
  );
}

export function ComeMisurare({ tipo, soglie }: { tipo: TipoMisura; soglie: Soglie }) {
  const g = GUIDE_MISURE[tipo];
  const [aperta, setAperta] = useState(leggiPreferenza);
  return (
    <details
      className="come-misurare"
      open={aperta}
      onToggle={(e) => {
        const o = (e.target as HTMLDetailsElement).open;
        setAperta(o);
        salvaPreferenza(o);
      }}
    >
      <summary>Come misurare</summary>
      <p>
        <strong>Strumento:</strong> {g.strumento}
      </p>
      <h4>Prima di misurare</h4>
      <Voci voci={g.preparazione} />
      <h4>Misura</h4>
      <Voci voci={g.esecuzione} />
      <p className="atteso">
        <strong>Valore atteso:</strong> {g.atteso(soglie)}
      </p>
      {g.errori.length > 0 && (
        <>
          <h4>Se qualcosa non torna</h4>
          <Voci voci={g.errori} />
        </>
      )}
    </details>
  );
}

export function SuggerimentiPasso({ passo }: { passo: string }) {
  const voci = GUIDE_PASSI[passo];
  if (!voci) return null;
  return (
    <details className="come-misurare" open>
      <summary>Suggerimenti</summary>
      <Voci voci={voci} />
    </details>
  );
}
