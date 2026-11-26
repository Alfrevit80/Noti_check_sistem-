// Generazione del PDF e consegna (condivisione su telefono, download su PC).
// pdfmake e i caratteri vengono caricati solo quando serve (non appesantiscono l'avvio dell'app).
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

export async function creaPdf(dd: TDocumentDefinitions): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pm = pdfMake as unknown as { vfs: unknown; createPdf: (d: TDocumentDefinitions) => { getBlob: (cb: (b: Blob) => void) => void } };
  pm.vfs = (vfs as { pdfMake?: { vfs: unknown } }).pdfMake?.vfs ?? vfs;
  return new Promise((ok, ko) => {
    try {
      pm.createPdf(dd).getBlob(ok);
    } catch (e) {
      ko(e);
    }
  });
}

export function nomePdf(parti: (string | undefined)[]): string {
  const base = parti
    .filter(Boolean)
    .join('_')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${base || 'rapportino'}.pdf`;
}

/** Sul telefono apre la condivisione (mail, WhatsApp, Drive…), altrimenti scarica il file. */
export async function consegnaPdf(blob: Blob, nome: string): Promise<'condiviso' | 'scaricato' | 'annullato'> {
  const file = new File([blob], nome, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return 'condiviso';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'annullato';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'scaricato';
}

/** Apre il PDF in una nuova scheda per vederlo prima di condividerlo. */
export function apriPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
