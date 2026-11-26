// Copia negli appunti un testo da incollare nella chat di Claude (abbonamento del tecnico, nessun costo API).
import { useRef, useState } from 'react';

export function CopiaPerClaude({ testo, etichetta = 'Copia per Claude', dopo }: { testo: () => string; etichetta?: string; dopo?: string }) {
  const [stato, setStato] = useState<'pronto' | 'copiato' | 'manuale'>('pronto');
  const [contenuto, setContenuto] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  async function copia() {
    const t = testo();
    setContenuto(t);
    try {
      await navigator.clipboard.writeText(t);
      setStato('copiato');
    } catch {
      // appunti non disponibili: si mostra il testo selezionato da copiare a mano
      setStato('manuale');
      setTimeout(() => area.current?.select(), 50);
    }
  }

  return (
    <div className="copia-claude">
      <button type="button" onClick={copia}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
        </svg>
        {etichetta}
      </button>
      {stato === 'copiato' && (
        <p className="ok-box">
          Copiato ({contenuto.length.toLocaleString('it-IT')} caratteri). Apri Claude, incolla nella chat e invia.{dopo ? ` ${dopo}` : ''}{' '}
          <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
            Apri Claude
          </a>
        </p>
      )}
      {stato === 'manuale' && (
        <>
          <p className="attenzione-box">Non riesco a copiare in automatico: seleziona il testo qui sotto e copialo.</p>
          <textarea ref={area} readOnly rows={8} value={contenuto} onFocus={(e) => e.target.select()} />
        </>
      )}
    </div>
  );
}
