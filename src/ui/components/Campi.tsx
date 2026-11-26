// Campi di input con salvataggio automatico.
// Il testo viene tenuto in uno stato locale e salvato dopo una breve pausa o all'uscita dal campo,
// così la digitazione resta fluida anche con il database che si aggiorna sotto.
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface BaseProps {
  etichetta: string;
  aiuto?: ReactNode;
  className?: string;
}

export function Campo({ etichetta, aiuto, className, children }: BaseProps & { children: ReactNode }) {
  return (
    <label className={`campo ${className ?? ''}`}>
      <span className="campo-etichetta">{etichetta}</span>
      {children}
      {aiuto && <span className="campo-aiuto">{aiuto}</span>}
    </label>
  );
}

function useBozza<T>(valore: T, salva: (v: T) => void, ritardo = 500) {
  const [bozza, setBozza] = useState(valore);
  const inModifica = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ultimo = useRef(salva);
  ultimo.current = salva;

  useEffect(() => {
    if (!inModifica.current) setBozza(valore);
  }, [valore]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cambia = (v: T) => {
    inModifica.current = true;
    setBozza(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => ultimo.current(v), ritardo);
  };
  const esci = () => {
    clearTimeout(timer.current);
    if (bozza !== valore) ultimo.current(bozza);
    inModifica.current = false;
  };
  return { bozza, cambia, esci };
}

export function CampoTesto(
  props: BaseProps & {
    valore: string;
    onSalva: (v: string) => void;
    multiriga?: boolean;
    tipo?: 'text' | 'date' | 'password' | 'email';
    placeholder?: string;
    list?: string;
  },
) {
  const { bozza, cambia, esci } = useBozza(props.valore, props.onSalva);
  return (
    <Campo etichetta={props.etichetta} aiuto={props.aiuto} className={props.className}>
      {props.multiriga ? (
        <textarea rows={3} value={bozza} placeholder={props.placeholder} onChange={(e) => cambia(e.target.value)} onBlur={esci} />
      ) : (
        <input
          type={props.tipo ?? 'text'}
          value={bozza}
          placeholder={props.placeholder}
          list={props.list}
          autoComplete="off"
          onChange={(e) => cambia(e.target.value)}
          onBlur={esci}
        />
      )}
    </Campo>
  );
}

/** Numero con virgola o punto decimale. Vuoto = undefined. */
export function CampoNumero(
  props: BaseProps & {
    valore: number | undefined;
    onSalva: (v: number | undefined) => void;
    unita?: string;
    min?: number;
    intero?: boolean;
  },
) {
  const testo = props.valore === undefined || Number.isNaN(props.valore) ? '' : String(props.valore).replace('.', ',');
  const { bozza, cambia, esci } = useBozza(testo, (t) => {
    const n = leggiNumero(t);
    if (n === null) return; // non valido: non salvo
    props.onSalva(n);
  });
  const nonValido = leggiNumero(bozza) === null;
  return (
    <Campo etichetta={props.etichetta} aiuto={nonValido ? 'Numero non valido' : props.aiuto} className={props.className}>
      <span className="campo-unita">
        <input
          inputMode={props.intero ? 'numeric' : 'decimal'}
          value={bozza}
          aria-invalid={nonValido}
          onChange={(e) => cambia(e.target.value)}
          onBlur={esci}
        />
        {props.unita && <span>{props.unita}</span>}
      </span>
    </Campo>
  );
}

/** '' → undefined; numero valido → numero; altrimenti null. */
export function leggiNumero(t: string): number | undefined | null {
  const s = t.trim().replace(',', '.');
  if (s === '') return undefined;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function CampoScelta<T extends string>(
  props: BaseProps & { valore: T; opzioni: readonly (T | { valore: T; testo: string })[]; onSalva: (v: T) => void },
) {
  return (
    <Campo etichetta={props.etichetta} aiuto={props.aiuto} className={props.className}>
      <select value={props.valore} onChange={(e) => props.onSalva(e.target.value as T)}>
        {props.opzioni.map((o) => {
          const v = typeof o === 'string' ? o : o.valore;
          const t = typeof o === 'string' ? o : o.testo;
          return (
            <option key={v} value={v}>
              {t}
            </option>
          );
        })}
      </select>
    </Campo>
  );
}
