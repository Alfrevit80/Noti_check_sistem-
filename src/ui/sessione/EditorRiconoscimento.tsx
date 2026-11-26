// Inserimento del sommario del riconoscimento automatico della centrale (NUO / INC / TOT / MAN).
import { useState } from 'react';
import type { RigaRiconoscimento, Sessione } from '../../model/types';
import { eliminaRiconoscimento, salvaRiconoscimento } from '../../db/sessioni';
import { totaliRiconoscimento } from '../../analysis/riconoscimento';
import { formattaOra } from '../etichette';
import { TIPI_HW } from '../../settings/tipiHw';

const RIGHE_INIZIALI: RigaRiconoscimento[] = [{ tipoDispositivo: '', nuo: 0, inc: 0, tot: 0, man: 0 }];

const COLONNE = ['nuo', 'inc', 'tot', 'man'] as const;

export function EditorRiconoscimento({ sessione }: { sessione: Sessione }) {
  const ordinati = [...sessione.riconoscimenti].sort((a, b) => (a.ora < b.ora ? 1 : -1));
  const [modifica, setModifica] = useState<string | null | 'nuovo'>(ordinati.length ? null : 'nuovo');

  return (
    <>
      <p className="tenue">
        Al termine dell'auto-riconoscimento il display mostra il sommario per tipo di dispositivo: NUO (nuovi dispositivi trovati),
        INC (programmati in precedenza ma non coerenti con quanto rilevato, es. PHOT rilevato come THER), TOT (totale) e MAN
        (programmati ma mancanti). Ricopia qui i valori, una riga per tipo. Consiglio: avvia l'auto-riconoscimento con «Verifica
        doppi indirizzi» = SI.
      </p>
      {modifica !== null && (
        <Modulo
          key={modifica}
          iniziale={modifica === 'nuovo' ? undefined : sessione.riconoscimenti.find((r) => r.id === modifica)}
          onSalva={async (righe, nota) => {
            await salvaRiconoscimento(sessione.id, { id: modifica === 'nuovo' ? undefined : modifica, righe, nota });
            setModifica(null);
          }}
          onAnnulla={ordinati.length ? () => setModifica(null) : undefined}
          tipiUsati={sessione.riconoscimenti.flatMap((r) => r.righe.map((x) => x.tipoDispositivo)).filter(Boolean)}
        />
      )}
      {ordinati.map((r) => {
        const t = totaliRiconoscimento(r);
        return (
          <div key={r.id} className="riconoscimento">
            <div className="titolo-riga">
              <strong>{formattaOra(r.ora)}</strong>
              <div className="azioni">
                <button className="piccolo" onClick={() => setModifica(r.id)}>
                  Modifica
                </button>
                <button className="piccolo pericolo" onClick={() => confirm('Eliminare questo riconoscimento?') && eliminaRiconoscimento(sessione.id, r.id)}>
                  Elimina
                </button>
              </div>
            </div>
            <div className="scorrimento-x">
              <table className="tabella tabella-numeri">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>NUO</th>
                    <th>INC</th>
                    <th>TOT</th>
                    <th>MAN</th>
                  </tr>
                </thead>
                <tbody>
                  {r.righe.map((x, i) => (
                    <tr key={i}>
                      <td>{x.tipoDispositivo}</td>
                      <td className={x.nuo ? 'testo-att' : ''}>{x.nuo}</td>
                      <td className={x.inc ? 'testo-att' : ''}>{x.inc}</td>
                      <td>{x.tot}</td>
                      <td className={x.man ? 'testo-err' : ''}>{x.man}</td>
                    </tr>
                  ))}
                  <tr className="totale">
                    <td>Totale</td>
                    <td>{t.nuo}</td>
                    <td>{t.inc}</td>
                    <td>{t.tot}</td>
                    <td>{t.man}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {r.nota && <p className="tenue">{r.nota}</p>}
          </div>
        );
      })}
      {modifica === null && (
        <button onClick={() => setModifica('nuovo')}>+ Nuovo riconoscimento</button>
      )}
    </>
  );
}

function Modulo(props: {
  iniziale?: { righe: RigaRiconoscimento[]; nota: string };
  onSalva: (righe: RigaRiconoscimento[], nota: string) => Promise<void>;
  onAnnulla?: () => void;
  tipiUsati: string[];
}) {
  const [righe, setRighe] = useState<RigaRiconoscimento[]>(props.iniziale?.righe ?? RIGHE_INIZIALI);
  const [nota, setNota] = useState(props.iniziale?.nota ?? '');
  const set = (i: number, patch: Partial<RigaRiconoscimento>) => setRighe(righe.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="scheda evidenza">
      <div className="scorrimento-x">
        <table className="tabella tabella-input">
          <thead>
            <tr>
              <th>Tipo dispositivo</th>
              <th>NUO</th>
              <th>INC</th>
              <th>TOT</th>
              <th>MAN</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={r.tipoDispositivo}
                    list="tipi-hw"
                    placeholder="es. NFX(I)-OPT"
                    onChange={(e) => set(i, { tipoDispositivo: e.target.value })}
                    aria-label="Tipo dispositivo"
                  />
                </td>
                {COLONNE.map((c) => (
                  <td key={c}>
                    <input
                      inputMode="numeric"
                      value={r[c] || ''}
                      placeholder="0"
                      aria-label={c.toUpperCase()}
                      onChange={(e) => set(i, { [c]: Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)) })}
                    />
                  </td>
                ))}
                <td>
                  <button className="piccolo" onClick={() => setRighe(righe.filter((_, j) => j !== i))} aria-label="Rimuovi riga">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id="tipi-hw">
        {[...new Set(props.tipiUsati)].filter((t) => !TIPI_HW.some((x) => x.codice === t)).map((t) => (
          <option key={t} value={t} />
        ))}
        {TIPI_HW.map((t) => (
          <option key={t.codice} value={t.codice}>
            {t.descrizione}
          </option>
        ))}
      </datalist>
      <button className="piccolo" onClick={() => setRighe([...righe, { tipoDispositivo: '', nuo: 0, inc: 0, tot: 0, man: 0 }])}>
        + Riga
      </button>
      <label className="campo">
        <span className="campo-etichetta">Nota</span>
        <input value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>
      <div className="azioni">
        <button className="primario" onClick={() => props.onSalva(righe.filter((r) => r.tipoDispositivo.trim() || r.tot), nota)}>
          Salva riconoscimento
        </button>
        {props.onAnnulla && <button onClick={props.onAnnulla}>Annulla</button>}
      </div>
    </div>
  );
}
