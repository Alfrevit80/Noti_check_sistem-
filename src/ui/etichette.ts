import type { EsitoLoop } from '../model/types';

export const ESITI_LOOP: { valore: EsitoLoop; testo: string }[] = [
  { valore: 'da_verificare', testo: 'Da verificare' },
  { valore: 'ok', testo: 'Conforme' },
  { valore: 'ok_con_riserva', testo: 'Conforme con riserva' },
  { valore: 'non_conforme', testo: 'Non conforme' },
];

export const testoEsito = (e: EsitoLoop) => ESITI_LOOP.find((x) => x.valore === e)?.testo ?? e;

export function formattaData(iso: string): string {
  if (!iso) return '—';
  const [a, m, g] = iso.slice(0, 10).split('-');
  return g && m && a ? `${g}/${m}/${a}` : iso;
}

export function formattaOra(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
