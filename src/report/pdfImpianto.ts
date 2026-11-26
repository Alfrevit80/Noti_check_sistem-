// Rapportino riepilogativo dell'impianto: centrali, esito di ogni loop, rete.
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Centrale, Impianto, Impostazioni, Loop, Rete, Sessione } from '../model/types';
import { analizzaSessione } from '../analysis/sessione';
import { analizzaRete } from '../analysis/network';
import { analizzaCentrale } from '../analysis/centrale';
import { ordinaAnomalie } from '../analysis/findings';
import { numeroLoopTotali } from '../db/repo';
import { anomaliePdf, datiChiave, documento, firmePdf } from './pdfLoop';
import { dataIt, testoEsitoReport } from './modello';

export interface DatiImpianto {
  impianto: Impianto;
  centrali: Centrale[];
  loops: Loop[];
  sessioni: Sessione[];
  rete?: Rete | null;
  impostazioni: Impostazioni;
}

const ESITO_COLORE: Record<string, string> = { ok: '#1e7d34', ok_con_riserva: '#d97706', non_conforme: '#c62828', da_verificare: '#6b7280' };

export function pdfImpianto(d: DatiImpianto): TDocumentDefinitions {
  const { impianto: i, impostazioni: imp } = d;
  const c: Content[] = [
    { text: 'Rapportino riepilogativo impianto', style: 'titolo' },
    datiChiave([
      ['Cliente', i.cliente],
      ['Impianto', i.nomeImpianto],
      ['Indirizzo', i.indirizzo],
      ['Data', dataIt(i.data)],
      ['Tecnico', i.tecnico],
      ['Centrali', String(d.centrali.length)],
    ]),
  ];
  const conteggio = { ok: 0, ok_con_riserva: 0, non_conforme: 0, da_verificare: 0 } as Record<string, number>;
  for (const l of d.loops) conteggio[l.esito] = (conteggio[l.esito] ?? 0) + 1;
  c.push({
    text: `Loop: ${d.loops.length} — conformi ${conteggio.ok}, con riserva ${conteggio.ok_con_riserva}, non conformi ${conteggio.non_conforme}, da verificare ${conteggio.da_verificare}.`,
    fontSize: 9.5,
    bold: true,
    margin: [0, 8, 0, 0],
  });

  for (const ce of [...d.centrali].sort((a, b) => a.nodoCpu.localeCompare(b.nodoCpu, 'it', { numeric: true }))) {
    c.push({ text: `${ce.nome} — ${ce.modello}`, style: 'h2' });
    c.push({
      text: `CPU ${ce.nodoCpu || '?'} · ${numeroLoopTotali(ce)} loop (${ce.loopBase} base${ce.espansioni.length ? ` + ${ce.espansioni.map((e) => `${e.modello} ${e.loop}`).join(', ')}` : ''})${ce.firmware ? ` · firmware ${ce.firmware}` : ''}`,
      fontSize: 8.5,
    });
    const anomCentrale = analizzaCentrale(ce, imp.profiliCentrale[ce.modello]);
    if (anomCentrale.length) c.push(anomaliePdf(anomCentrale, ''));
    const loops = d.loops.filter((l) => l.centraleId === ce.id).sort((a, b) => a.numero - b.numero);
    const body = [
      ['Loop', 'Scheda', 'Ultima verifica', 'Esito', 'Anomalie', 'Attività da eseguire'].map((t) => ({ text: t, style: 'th' })),
      ...loops.map((l) => {
        const s = d.sessioni.filter((x) => x.loopId === l.id).sort((a, b) => (a.inizio < b.inizio ? 1 : -1))[0];
        const an = s ? analizzaSessione(s, l, imp.soglie, imp.sigle) : [];
        const alte = an.filter((a) => a.gravita === 'alta' || a.gravita === 'critica').length;
        const medie = an.filter((a) => a.gravita === 'media').length;
        return [
          { text: `${l.numero}${l.descrizione ? ` — ${l.descrizione}` : ''}`, fontSize: 8.5 },
          { text: l.scheda, fontSize: 8.5 },
          { text: s ? dataIt(s.inizio) : '—', fontSize: 8.5 },
          { text: testoEsitoReport(l.esito), fontSize: 8.5, bold: true, color: ESITO_COLORE[l.esito] },
          { text: s ? `${alte} alte, ${medie} medie` : '—', fontSize: 8.5 },
          { text: s?.attivitaDaEseguire || '', fontSize: 8 },
        ];
      }),
    ];
    c.push({ table: { headerRows: 1, widths: [60, 60, 55, 60, 55, '*'], body }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 0] });
  }

  if (d.centrali.length > 1 || d.rete) {
    c.push({ text: 'Rete tra centrali', style: 'h2' });
    if (d.rete) {
      const r = d.rete;
      c.push(
        datiChiave([
          ['Comunicazione', r.tipo === 'Altro' ? r.tipoAltro || 'Altro' : r.tipo],
          ['Topologia', r.topologia],
          ['Stato del bus', r.statoBus],
          ['CPU collegate', d.centrali.filter((x) => r.centraliCollegate.includes(x.id)).map((x) => `${x.nome} (CPU ${x.nodoCpu})`).join(', ') || '—'],
        ]),
      );
      const esito = { si: 'Sì', no: 'No', na: 'N/A' } as Record<string, string>;
      c.push({
        table: {
          headerRows: 1,
          widths: ['*', 40, 150],
          body: [
            [{ text: 'Verifica', style: 'th' }, { text: 'Esito', style: 'th' }, { text: 'Nota', style: 'th' }],
            ...r.checklist.map((v) => [
              { text: v.testo, fontSize: 8.5 },
              { text: v.esito ? esito[v.esito] : '—', fontSize: 8.5, bold: true, color: v.esito === 'no' ? '#c62828' : v.esito === 'si' ? '#1e7d34' : undefined },
              { text: v.nota, fontSize: 8 },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 6, 0, 0],
      });
    }
    c.push({ text: 'Analisi della rete', style: 'h3' });
    c.push(anomaliePdf(ordinaAnomalie(analizzaRete(d.rete ?? null, d.centrali)), 'Nessuna anomalia.'));
  }
  if (i.note) {
    c.push({ text: 'Note', style: 'h2' });
    c.push({ text: i.note, fontSize: 9 });
  }
  c.push(firmePdf());
  return documento(`Riepilogo impianto — ${i.cliente || ''} ${i.nomeImpianto || ''} — ${dataIt(i.data)}`.trim(), c);
}
