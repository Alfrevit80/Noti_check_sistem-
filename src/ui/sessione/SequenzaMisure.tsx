// Chiede le misure una alla volta e le registra con data e ora.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Misura, Soglie, TipoMisura, ValoreMisura } from '../../model/types';
import { DEF_MISURE, formattaValore, nomeRamo, ultimaMisura, type RamoMisura } from '../../analysis/misure';
import { TESTO_VALUTAZIONE, valutaMisura } from '../../analysis/valutazione';
import { registraMisura } from '../../db/sessioni';
import { leggiNumero } from '../components/Campi';
import { formattaOra } from '../etichette';

export interface Domanda {
  ramo: RamoMisura;
  tipo: TipoMisura;
}

export const chiaveDomanda = (d: Domanda) => (d.ramo === 'loop' ? d.tipo : `${d.tipo}-${d.ramo}`);

export function SequenzaMisure(props: {
  sessioneId: string;
  misure: readonly Misura[];
  domande: Domanda[];
  soglie: Soglie;
  iniziale?: string; // chiave della domanda da cui partire
  onCompletata?: () => void;
}) {
  const { domande, misure, soglie } = props;
  const primaMancante = domande.findIndex((d) => !ultimaMisura(misure, d.ramo, d.tipo));
  const daChiave = props.iniziale ? domande.findIndex((d) => chiaveDomanda(d) === props.iniziale || d.tipo === props.iniziale) : -1;
  const [indice, setIndice] = useState(daChiave >= 0 ? daChiave : primaMancante >= 0 ? primaMancante : 0);
  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState('');
  const [ultimoRegistrato, setUltimoRegistrato] = useState<{ d: Domanda; valore: ValoreMisura } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const d = domande[Math.min(indice, domande.length - 1)];
  const def = DEF_MISURE[d.tipo];
  const precedente = ultimaMisura(misure, d.ramo, d.tipo);

  useEffect(() => {
    setTesto('');
    setErrore('');
    input.current?.focus({ preventScroll: true });
  }, [indice]);

  async function registra(valore: ValoreMisura) {
    setErrore('');
    await registraMisura(props.sessioneId, { ramo: d.ramo, tipo: d.tipo, valore });
    setUltimoRegistrato({ d, valore });
    // tensione residua presente: ci si ferma, l'avviso di scaricare la linea non deve sfuggire
    if (d.tipo === 'vRes' && valutaMisura(d.tipo, valore, soglie) === 'basso') return;
    avanti();
  }

  function avanti() {
    if (indice < domande.length - 1) setIndice(indice + 1);
    else props.onCompletata?.();
  }

  function invia(e: FormEvent) {
    e.preventDefault();
    const t = testo.trim().toUpperCase();
    if (t === 'OL' && def.consentiOL) return void registra('OL');
    const n = leggiNumero(testo);
    if (n === undefined) return setErrore(def.consentiOL ? 'Inserisci un valore oppure tocca OL.' : 'Inserisci un valore.');
    if (n === null) return setErrore('Numero non valido (usa la virgola o il punto per i decimali).');
    if (def.unita !== 'V' && n < 0) return setErrore('Il valore non può essere negativo.');
    void registra(n);
  }

  return (
    <div className="sequenza">
      <div className="sequenza-progresso" aria-label={`Domanda ${indice + 1} di ${domande.length}`}>
        {domande.map((x, i) => {
          const m = ultimaMisura(misure, x.ramo, x.tipo);
          const st = m ? valutaMisura(x.tipo, m.valore, soglie) : 'vuoto';
          return (
            <button
              key={chiaveDomanda(x)}
              type="button"
              className={`pallino v-${st} ${i === indice ? 'corrente' : ''}`}
              onClick={() => setIndice(i)}
              title={`${DEF_MISURE[x.tipo].etichetta} ${x.ramo === 'loop' ? '' : x.ramo}`}
            >
              {DEF_MISURE[x.tipo].etichetta}
              {x.ramo !== 'loop' && domande.some((y) => y.tipo === x.tipo && y.ramo !== x.ramo) ? ` ${x.ramo}` : ''}
            </button>
          );
        })}
      </div>

      {ultimoRegistrato && (
        <RiscontroUltimo d={ultimoRegistrato.d} valore={ultimoRegistrato.valore} soglie={soglie} />
      )}

      <form className="domanda" onSubmit={invia}>
        <div className="domanda-titolo">
          <span className="tenue">
            {indice + 1} di {domande.length} · {nomeRamo(d.ramo)}
          </span>
          <h3>{def.descrizione}{d.ramo !== 'loop' ? ` — ramo ${d.ramo}` : ''}</h3>
          <p className="tenue">{def.istruzioni}</p>
        </div>
        {precedente && (
          <p className="precedente">
            Già misurato: <strong>{formattaValore(precedente.valore, precedente.valore === 'OL' ? undefined : def.unita)}</strong> alle{' '}
            {formattaOra(precedente.ora).slice(-5)}. Una nuova misura si aggiunge allo storico e diventa quella valida.
          </p>
        )}
        <div className="domanda-input">
          <input
            ref={input}
            inputMode="decimal"
            autoComplete="off"
            placeholder={def.consentiOL ? 'valore oppure OL' : 'valore'}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            aria-label={`${def.descrizione} in ${def.unita}`}
            aria-invalid={!!errore}
          />
          <span className="unita">{def.unita}</span>
        </div>
        {errore && <p className="errore-box">{errore}</p>}
        <div className="azioni domanda-azioni">
          {def.consentiOL && (
            <button type="button" className="ol" onClick={() => registra('OL')}>
              OL
            </button>
          )}
          <button type="submit" className="primario">
            Registra
          </button>
          <button type="button" onClick={avanti}>
            {precedente ? 'Mantieni →' : 'Salta →'}
          </button>
        </div>
        {indice > 0 && (
          <button type="button" className="link" onClick={() => setIndice(indice - 1)}>
            ← Domanda precedente
          </button>
        )}
      </form>
    </div>
  );
}

function RiscontroUltimo({ d, valore, soglie }: { d: Domanda; valore: ValoreMisura; soglie: Soglie }) {
  const st = valutaMisura(d.tipo, valore, soglie);
  const def = DEF_MISURE[d.tipo];
  return (
    <p className={`riscontro v-${st}`} role="status">
      Registrato {def.etichetta}
      {d.ramo !== 'loop' ? ` ramo ${d.ramo}` : ''}: <strong>{formattaValore(valore, valore === 'OL' ? undefined : def.unita)}</strong>
      {TESTO_VALUTAZIONE[d.tipo][st] && ` — ${TESTO_VALUTAZIONE[d.tipo][st]}`}
    </p>
  );
}
