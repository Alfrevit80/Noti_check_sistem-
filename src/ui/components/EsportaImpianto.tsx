// Esportazione di un impianto in un file cifrato, per importarlo su un altro PC o smartphone.
import { useState, type FormEvent, type ReactNode } from 'react';
import { esportaFileCifrato } from '../../db/exportImport';
import { verificaRequisitiPassword } from '../../security/crypto';
import { CampoPassword } from '../Accesso';
import { useToast } from './Layout';

/** Bottone che apre il dialogo di esportazione cifrata. */
export function PulsanteEsporta({ impiantoId, className, children, title }: { impiantoId: string; className?: string; children: ReactNode; title?: string }) {
  const [aperto, setAperto] = useState(false);
  const toast = useToast();

  async function esporta(password: string) {
    const { nome, testo } = await esportaFileCifrato(impiantoId, password);
    const file = new File([testo], nome, { type: 'application/json' });
    setAperto(false);
    // Sul telefono: foglio di condivisione (WhatsApp, mail, Drive, AirDrop…). Altrimenti download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nome });
        toast(`File cifrato condiviso: ${nome}`, 'ok');
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast(`File cifrato salvato nei download: ${nome}`, 'ok');
  }

  return (
    <>
      <button type="button" className={className} title={title} aria-label={title} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAperto(true); }}>
        {children}
      </button>
      {aperto && <DialogoExport onAnnulla={() => setAperto(false)} onConferma={esporta} />}
    </>
  );
}

function DialogoExport({ onAnnulla, onConferma }: { onAnnulla: () => void; onConferma: (password: string) => Promise<void> }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);
  async function invia(e: FormEvent) {
    e.preventDefault();
    const r = verificaRequisitiPassword(p1);
    if (r) return setErrore(r);
    if (p1 !== p2) return setErrore('Le due password non coincidono.');
    setAttesa(true);
    try {
      await onConferma(p1);
    } catch (err) {
      setErrore(`Esportazione non riuscita: ${String(err)}`);
      setAttesa(false);
    }
  }
  return (
    <div className="dialogo-sfondo" role="dialog" aria-modal="true" aria-labelledby="titolo-export">
      <form className="dialogo" onSubmit={invia}>
        <h2 id="titolo-export">Esporta impianto</h2>
        <p className="tenue">
          Il file contiene anagrafica, centrali, loop, verifiche, letture POL e foto, ed è cifrato con la password che scegli qui. Sull'altro
          dispositivo servirà la stessa password: comunicala a parte, non nello stesso messaggio del file.
        </p>
        <CampoPassword id="export-p1" etichetta="Password del file" valore={p1} onCambia={setP1} nuova autoFocus />
        <CampoPassword id="export-p2" etichetta="Ripeti la password" valore={p2} onCambia={setP2} nuova />
        {errore && <p className="errore-box">{errore}</p>}
        <div className="azioni">
          <button type="submit" className="primario" disabled={attesa}>
            {attesa ? 'Cifratura…' : 'Esporta'}
          </button>
          <button type="button" onClick={onAnnulla}>
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
