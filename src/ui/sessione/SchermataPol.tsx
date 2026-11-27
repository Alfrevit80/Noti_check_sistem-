// Modulo che riproduce la schermata "Multimetro" del POL-200-TS: si ricopiano tutti i valori in una volta.
import { useState } from 'react';
import type { Sessione, Soglie, TipoMisura, ValoreMisura } from '../../model/types';
import { DEF_MISURE, formattaValore, ultimaMisura } from '../../analysis/misure';
import { valutaMisura } from '../../analysis/valutazione';
import { analizzaMultimetroPol } from '../../analysis/multimetroPol';
import { registraMisura } from '../../db/sessioni';
import { leggiNumero } from '../components/Campi';
import { ElencoAnomalie } from '../components/ElencoAnomalie';
import { CopiaPerClaude } from '../components/CopiaPerClaude';
import { leggiRispostaMultimetro, testoLetturaMultimetro } from '../../ai/copiaPerClaude';
import { useAlSalvataggio } from '../salvataggio';
import { useToast } from '../components/Layout';

const BLOCCHI: { titolo: string; voci: [TipoMisura, string][] }[] = [
  { titolo: 'Resistenza', voci: [['rP', 'Positivo'], ['rN', 'Negativo'], ['rC', 'Calza']] },
  { titolo: 'Guasto', voci: [['gPN', 'Pos.- neg.'], ['gCP', 'Calza Pos.'], ['gCN', 'Calza Neg.']] },
  { titolo: 'Guasto Terra', voci: [['gTP', 'Positivo'], ['gTN', 'Negativo'], ['gTC', 'Calza']] },
  { titolo: 'Capacità', voci: [['cPN', 'Pos.- neg.'], ['cCP', 'Calza Pos.'], ['cCN', 'Calza Neg.']] },
  { titolo: 'Tensione', voci: [['vRit', 'V ritorno (24 V)']] },
];
const TUTTI = BLOCCHI.flatMap((b) => b.voci.map(([t]) => t));

/** ">150", ">1000", "OL" = fuori scala. */
function leggiValore(t: string): ValoreMisura | undefined | null {
  const s = t.trim();
  if (!s) return undefined;
  if (/^(ol|>|oltre)/i.test(s)) return 'OL';
  const n = leggiNumero(s);
  return n === undefined ? undefined : n;
}

export function SchermataPol({ s, soglie }: { s: Sessione; soglie: Soglie }) {
  const [valori, setValori] = useState<Partial<Record<TipoMisura, string>>>({});
  const [risposta, setRisposta] = useState('');
  const toast = useToast();

  async function registra() {
    let n = 0;
    for (const t of TUTTI) {
      const v = leggiValore(valori[t] ?? '');
      if (v === undefined || v === null) continue;
      await registraMisura(s.id, { ramo: 'loop', tipo: t, valore: v });
      n++;
    }
    setValori({});
    if (n) toast(`Registrati ${n} valori del Multimetro`, 'ok');
    return n;
  }
  // il tasto Salva registra anche i valori scritti e non ancora registrati
  useAlSalvataggio(() => (TUTTI.some((t) => valori[t]?.trim()) ? registra() : undefined));

  const nonValidi = TUTTI.filter((t) => leggiValore(valori[t] ?? '') === null);

  return (
    <>
      <div className="schermo-pol">
        <div className="blocchi">
          {BLOCCHI.map((b) => (
            <div key={b.titolo}>
              <h3>{b.titolo}</h3>
              <div className="righe">
                {b.voci.map(([t, et]) => {
                  const d = DEF_MISURE[t];
                  const prec = ultimaMisura(s.misure, 'loop', t);
                  const v = leggiValore(valori[t] ?? '');
                  const st = v !== undefined && v !== null ? valutaMisura(t, v, soglie) : prec ? valutaMisura(t, prec.valore, soglie) : '';
                  return (
                    <label key={t} htmlFor={`pol-${t}`} style={{ display: 'contents' }}>
                      <span>{et}</span>
                      <span className="val-unita">
                        <input
                          id={`pol-${t}`}
                          inputMode="decimal"
                          autoComplete="off"
                          className={st ? `v-${st}` : ''}
                          value={valori[t] ?? ''}
                          placeholder={prec ? formattaValore(prec.valore) : '----'}
                          onChange={(e) => setValori({ ...valori, [t]: e.target.value })}
                          aria-label={`${b.titolo} ${et} in ${d.unita}`}
                        />
                        <span className="u">{d.unita}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="tenue">Scrivi i numeri come sul display; per «&gt;150 Ohm» o «&gt;1000 KOhm» scrivi «&gt;» (= fuori scala). I campi vuoti non vengono registrati; in grigio l'ultimo valore registrato.</p>
      {nonValidi.length > 0 && <p className="errore-box">Valori non validi: {nonValidi.map((t) => DEF_MISURE[t].etichetta).join(', ')}</p>}
      <div className="azioni">
        <button className="primario" onClick={registra} disabled={!TUTTI.some((t) => valori[t]?.trim()) || nonValidi.length > 0}>
          Registra i valori
        </button>
      </div>

      <details className="come-misurare" style={{ marginTop: '0.75rem' }}>
        <summary>Leggi la foto della schermata con Claude</summary>
        <ol className="istruzioni">
          <li>Fotografa la schermata Multimetro del POL.</li>
          <li>Copia la richiesta, apri Claude, allega la foto e incolla la richiesta.</li>
          <li>Incolla qui la risposta: i campi si compilano, controllali e tocca «Registra i valori».</li>
        </ol>
        <CopiaPerClaude testo={testoLetturaMultimetro} etichetta="Copia la richiesta per Claude" dopo="Ricordati di allegare la foto." />
        <textarea rows={5} value={risposta} onChange={(e) => setRisposta(e.target.value)} placeholder={'RES POSITIVO: 19\n…'} aria-label="Risposta di Claude" />
        <div className="azioni">
          <button
            disabled={!risposta.trim()}
            onClick={() => {
              const letti = leggiRispostaMultimetro(risposta);
              const nuovi = { ...valori };
              for (const x of letti) nuovi[x.tipo] = x.valore === 'OL' ? '>' : String(x.valore).replace('.', ',');
              setValori(nuovi);
              toast(letti.length ? `${letti.length} valori inseriti: controllali e registra` : 'Nessun valore riconosciuto', letti.length ? 'ok' : 'errore');
            }}
          >
            Compila i campi
          </button>
        </div>
      </details>

      <h3>Analisi del Multimetro</h3>
      <ElencoAnomalie anomalie={analizzaMultimetroPol(s.misure, soglie)} vuoto="Nessuna anomalia nei valori del Multimetro." />
    </>
  );
}
