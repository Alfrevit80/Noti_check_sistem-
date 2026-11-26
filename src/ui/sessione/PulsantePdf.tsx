// Genera un PDF e offre "Visualizza" e "Condividi / scarica" (servono due tocchi distinti: i browser
// permettono di aprire o condividere solo in risposta diretta a un tocco).
import { useState } from 'react';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { consegnaPdf, creaPdf } from '../../report/genera';

export function PulsantePdf({ etichetta, nome, prepara, primario }: { etichetta: string; nome: string; prepara: () => Promise<TDocumentDefinitions>; primario?: boolean }) {
  const [stato, setStato] = useState<'pronto' | 'genero' | 'fatto' | 'errore'>('pronto');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  async function genera() {
    setStato('genero');
    setMsg('');
    try {
      const b = await creaPdf(await prepara());
      if (url) URL.revokeObjectURL(url);
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      setStato('fatto');
    } catch (e) {
      setMsg(`Generazione non riuscita: ${String(e)}`);
      setStato('errore');
    }
  }

  return (
    <div className="pulsante-pdf">
      <button className={primario ? 'primario' : ''} onClick={genera} disabled={stato === 'genero'}>
        {stato === 'genero' ? 'Preparazione PDF…' : etichetta}
      </button>
      {stato === 'fatto' && blob && (
        <div className="azioni">
          <a className="bottone" href={url} target="_blank" rel="noreferrer">
            Visualizza
          </a>
          <button
            onClick={async () => {
              const r = await consegnaPdf(blob, nome);
              setMsg(r === 'scaricato' ? `Salvato: ${nome}` : r === 'condiviso' ? 'Condiviso.' : '');
            }}
          >
            Condividi / scarica
          </button>
        </div>
      )}
      {msg && <p className={stato === 'errore' ? 'errore-box' : 'tenue'}>{msg}</p>}
    </div>
  );
}
