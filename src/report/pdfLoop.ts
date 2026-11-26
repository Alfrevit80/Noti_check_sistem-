// Impaginazione del rapportino PDF (pdfmake). Funzioni pure: restituiscono la definizione del documento.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Griglia } from '../model/types';
import type { StatoCella } from '../analysis/pol';
import { ETICHETTA_STATO } from '../analysis/pol';
import { ETICHETTA_GRAVITA, type Anomalia } from '../analysis/findings';
import { bytesToBase64 } from '../security/crypto';
import type { Cella, ModelloLoop, StatoGriglie } from './modello';

export const COLORE_STATO: Record<StatoCella, string> = {
  soloA: '#ffd8a8',
  soloB: '#a5d8ff',
  entrambi: '#b2f2bb',
  doppio: '#d0bfff',
  incerto: '#ffec99',
  presente: '#b2f2bb',
  perso: '#ffa8a8',
  vuoto: '#ffffff',
};
const COLORE_VALUTAZIONE: Record<string, string> = { ok: '#d3f9d8', attenzione: '#fff3bf', basso: '#ffc9c9', vuoto: '#ffffff' };
const COLORE_GRAVITA: Record<string, string> = { critica: '#8e0000', alta: '#c62828', media: '#d97706', bassa: '#2f6fb3', info: '#6b7280' };
const ROSSO = '#c62828';

export const stili: TDocumentDefinitions['styles'] = {
  titolo: { fontSize: 16, bold: true, color: ROSSO, margin: [0, 0, 0, 6] },
  h2: { fontSize: 12, bold: true, margin: [0, 12, 0, 5], color: '#1d2433' },
  h3: { fontSize: 10, bold: true, margin: [0, 6, 0, 3] },
  piccolo: { fontSize: 7.5, color: '#5f6672' },
  th: { bold: true, fillColor: '#e9ecf2', fontSize: 8 },
};

/** Tabella chiave/valore. */
export function datiChiave(righe: [string, string | undefined][]): Content {
  return {
    table: { widths: [110, '*'], body: righe.filter(([, v]) => v).map(([k, v]) => [{ text: k, bold: true, fontSize: 8.5 }, { text: v!, fontSize: 8.5 }]) },
    layout: 'lightHorizontalLines',
  };
}

const sezione = (t: string): Content => ({ text: t, style: 'h2' });

/** Griglia stile POL (colonne decine 00-150, righe unità 0-9) con il colore dello stato. */
export function grigliaPdf(g: Griglia, stati: Record<number, StatoCella>, titolo: string): Content {
  const decine = Array.from({ length: 16 }, (_, i) => i * 10);
  const head: TableCell[] = [{ text: '', style: 'th' }, ...decine.map((d) => ({ text: String(d).padStart(2, '0'), style: 'th', alignment: 'center' as const }))];
  const body: TableCell[][] = [head];
  for (let u = 0; u < 10; u++) {
    const riga: TableCell[] = [{ text: String(u), style: 'th', alignment: 'center' }];
    for (const d of decine) {
      const n = d + u;
      const sigla = g[n] ?? '';
      const zeroOccupato = n === 0 && sigla;
      riga.push({
        text: sigla,
        alignment: 'center',
        fontSize: 7,
        bold: true,
        fillColor: n > 159 ? '#e5e7eb' : zeroOccupato ? '#ff8787' : n === 0 ? '#c5ccd8' : sigla ? COLORE_STATO[stati[n] ?? 'vuoto'] : '#ffffff',
      });
    }
    body.push(riga);
  }
  return {
    stack: [
      { text: titolo, style: 'h3' },
      { table: { widths: [14, ...decine.map(() => '*')], body }, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#6b7280', vLineColor: () => '#6b7280', paddingTop: () => 1.5, paddingBottom: () => 1.5, paddingLeft: () => 0, paddingRight: () => 0 } },
    ],
    unbreakable: true,
  };
}

export function legendaPdf(stati: StatoCella[]): Content {
  return {
    columns: stati.map((s) => ({
      width: 'auto',
      columns: [
        { canvas: [{ type: 'rect', x: 0, y: 1, w: 8, h: 8, color: COLORE_STATO[s], lineColor: '#6b7280' }], width: 11 },
        { text: ETICHETTA_STATO[s], fontSize: 7.5, width: 'auto' },
      ],
      columnGap: 2,
    })),
    columnGap: 10,
    margin: [0, 4, 0, 0],
  };
}

function statoPdf(st: StatoGriglie, colonnaInfo: string): Content[] {
  const out: Content[] = [sezione(st.titolo)];
  out.push(grigliaPdf(st.sensori, st.statiSensori, `Sensori (${st.totali.sensori})`));
  if (st.tabellaModuli.length) out.push(grigliaPdf(st.moduli, st.statiModuli, `Moduli (${st.totali.moduli})`));
  out.push(legendaPdf(st.legenda));
  if (st.sensori[0] || st.moduli[0]) out.push({ text: 'In rosso: dispositivo all\'indirizzo 0 (non indirizzato).', fontSize: 8, color: ROSSO, margin: [0, 3, 0, 0] });
  if (st.tabellaModuli.length) {
    out.push({ text: 'Moduli', style: 'h3' });
    out.push({
      table: {
        headerRows: 1,
        widths: [50, 50, '*'],
        body: [
          [{ text: 'Indirizzo', style: 'th' }, { text: 'Sigla', style: 'th' }, { text: colonnaInfo, style: 'th' }],
          ...st.tabellaModuli.map((m) => [{ text: String(m.indirizzo), fontSize: 8 }, { text: m.sigla, fontSize: 8, bold: true }, { text: m.info, fontSize: 8 }]),
        ],
      },
      layout: 'lightHorizontalLines',
    });
  }
  out.push({ text: `Totali: ${st.totali.sensori} sensori, ${st.totali.moduli} moduli.`, fontSize: 8.5, margin: [0, 4, 0, 0] });
  return out;
}

const cella = (c: Cella): TableCell => ({ text: c.testo, fontSize: 8.5, bold: c.stato !== 'vuoto', fillColor: COLORE_VALUTAZIONE[c.stato ?? 'vuoto'], alignment: 'center' });

export function anomaliePdf(anomalie: Anomalia[], vuoto: string): Content {
  if (!anomalie.length) return { text: vuoto, fontSize: 9, color: '#1e7d34' };
  return {
    stack: anomalie.map((a) => ({
      margin: [0, 0, 0, 5],
      unbreakable: true,
      stack: [
        { text: [{ text: ` ${ETICHETTA_GRAVITA[a.gravita].toUpperCase()} `, color: '#ffffff', background: COLORE_GRAVITA[a.gravita], bold: true, fontSize: 7.5 }, { text: `  ${a.titolo}`, bold: true, fontSize: 9 }] },
        a.spiegazione ? { text: a.spiegazione, fontSize: 8, margin: [0, 1, 0, 0] } : '',
        a.doveIntervenire.length ? { ol: a.doveIntervenire.map((p) => ({ text: p, fontSize: 8 })), margin: [8, 1, 0, 0] } : '',
      ],
    })),
  };
}

export function firmePdf(): Content {
  const box = (t: string): Content => ({
    stack: [
      { text: t, fontSize: 9, bold: true },
      { canvas: [{ type: 'rect', x: 0, y: 4, w: 240, h: 60, lineColor: '#9ca3af' }] },
      { text: 'Nome e cognome: ____________________________', fontSize: 8, margin: [0, 6, 0, 0] },
    ],
  });
  return { columns: [box('Firma del tecnico'), box('Firma del cliente / committente')], columnGap: 20, margin: [0, 14, 0, 0], unbreakable: true } as Content;
}

/** Caratteri che il font del PDF (Roboto) non contiene: sostituiti con equivalenti leggibili. */
const SOSTITUZIONI: [RegExp, string][] = [
  [/→/g, '>'],
  [/←/g, '<'],
  [/✓/g, 'OK'],
  [/✕/g, 'x'],
];
export function pulisciTesti<T>(x: T): T {
  if (typeof x === 'string') return SOSTITUZIONI.reduce((s, [r, v]) => s.replace(r, v), x as string) as T;
  if (Array.isArray(x)) return x.map(pulisciTesti) as T;
  if (x && typeof x === 'object' && !(x instanceof Uint8Array)) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) o[k] = k === 'image' ? v : pulisciTesti(v);
    return o as T;
  }
  return x;
}

export function documento(titolo: string, contenuto: Content[]): TDocumentDefinitions {
  const creato = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return {
    pageSize: 'A4',
    pageMargins: [36, 40, 36, 40],
    info: { title: pulisciTesti(titolo), creator: 'Notifier Check System' },
    defaultStyle: { fontSize: 9, lineHeight: 1.15 },
    styles: stili,
    header: (pagina) => ({ text: pagina > 1 ? pulisciTesti(titolo) : '', fontSize: 7.5, color: '#9ca3af', margin: [36, 18, 36, 0] }),
    footer: (pagina, totale) => ({
      columns: [
        { text: `Generato con Notifier Check System il ${creato}`, fontSize: 7, color: '#9ca3af' },
        { text: `Pagina ${pagina} di ${totale}`, fontSize: 7, color: '#9ca3af', alignment: 'right' },
      ],
      margin: [36, 12, 36, 0],
    }),
    content: pulisciTesti(contenuto),
  };
}

export function pdfLoop(m: ModelloLoop): TDocumentDefinitions {
  const h = m.intestazione;
  const c: Content[] = [
    { text: 'Rapportino di verifica loop', style: 'titolo' },
    datiChiave([
      ['Data', h.data],
      ['Cliente', h.cliente],
      ['Impianto', h.impianto],
      ['Indirizzo', h.indirizzo],
      ['Centrale', h.centrale],
      ['Loop / scheda', h.loop],
      ['Strumento', h.strumento],
      ['Tecnico', h.tecnico],
      ['Inizio verifica', h.inizio],
      ['Fine verifica', h.fine],
      ['Sintomo segnalato', m.sintomo],
    ]),
  ];

  if (m.iniziale) c.push(...statoPdf(m.iniziale, 'Visto da'));

  c.push(sezione('Misure a cavo scollegato'));
  c.push({
    table: {
      headerRows: 1,
      widths: ['*', 80, 80],
      body: [
        [{ text: 'Misura (MΩ)', style: 'th' }, { text: 'Ramo A', style: 'th', alignment: 'center' }, { text: 'Ramo B', style: 'th', alignment: 'center' }],
        ...m.isolamento.map((r) => [{ text: r.etichetta, fontSize: 8.5 }, cella(r.A), cella(r.B)]),
      ],
    },
    layout: 'lightHorizontalLines',
  });
  c.push({ text: 'Resistenze e tensioni', style: 'h3' });
  c.push({
    table: {
      headerRows: 1,
      widths: ['*', 80, 110],
      body: [
        [{ text: 'Misura', style: 'th' }, { text: 'Valore', style: 'th', alignment: 'center' }, { text: 'Limite', style: 'th' }],
        ...m.altreMisure.map((r) => [{ text: r.etichetta, fontSize: 8.5 }, cella(r.valore), { text: r.limite, fontSize: 8, color: '#5f6672' }]),
      ],
    },
    layout: 'lightHorizontalLines',
  });
  if (m.cavo.length) {
    c.push({ text: 'Cavo', style: 'h3' });
    c.push({ ul: m.cavo.map((t) => ({ text: t, fontSize: 8.5 })) });
  }

  if (m.finale) c.push(...statoPdf(m.finale, 'Modello / tipo'));

  if (m.mappatura) {
    c.push(sezione(`Mappatura (${m.mappatura.lato})`));
    c.push({ text: m.mappatura.percorso, fontSize: 8 });
    if (m.mappatura.derivazioni) c.push({ text: [{ text: 'Derivazioni: ', bold: true }, m.mappatura.derivazioni], fontSize: 8, margin: [0, 3, 0, 0] });
    if (m.mappatura.nonMappati) c.push({ text: [{ text: 'Non collocati: ', bold: true }, m.mappatura.nonMappati], fontSize: 8, margin: [0, 3, 0, 0] });
  }

  if (m.riconoscimento) {
    c.push(sezione(`Riconoscimento automatico della centrale (${m.riconoscimento.ora})`));
    const t = m.riconoscimento.totali;
    c.push({
      table: {
        headerRows: 1,
        widths: ['*', 45, 45, 45, 45],
        body: [
          ['Tipo', 'NUO', 'INC', 'TOT', 'MAN'].map((x, i) => ({ text: x, style: 'th', alignment: i ? ('right' as const) : ('left' as const) })),
          ...m.riconoscimento.righe.map((r) => [
            { text: r.tipo, fontSize: 8.5 },
            ...[r.nuo, r.inc, r.tot, r.man].map((v, i) => ({ text: String(v), fontSize: 8.5, alignment: 'right' as const, color: v && i !== 2 ? (i === 3 ? ROSSO : '#d97706') : undefined, bold: !!v && i !== 2 })),
          ]),
          [{ text: 'Totale', bold: true, fontSize: 8.5 }, ...[t.nuo, t.inc, t.tot, t.man].map((v) => ({ text: String(v), bold: true, fontSize: 8.5, alignment: 'right' as const }))],
        ],
      },
      layout: 'lightHorizontalLines',
    });
    c.push({ text: 'NUO = nuovi dispositivi trovati · INC = programmati ma non coerenti con quanto rilevato · TOT = totale rilevato · MAN = programmati ma non rilevati.', style: 'piccolo', margin: [0, 3, 0, 0] });
  }

  c.push(sezione('Analisi'));
  c.push(anomaliePdf(m.anomalie, 'Nessuna anomalia rilevata.'));

  if (m.diagnosiClaude) {
    c.push(sezione('Diagnosi assistita (Claude)'));
    c.push({ text: `Testo generato da Claude sui dati della verifica e incollato dal tecnico il ${m.diagnosiClaude.ora}. Da valutare a cura del tecnico.`, style: 'piccolo', margin: [0, 0, 0, 4] });
    c.push({ text: m.diagnosiClaude.testo.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, ''), fontSize: 8.5 });
  }

  c.push(sezione('Cronologia'));
  c.push(
    m.cronologia.length
      ? { table: { widths: [36, '*'], body: m.cronologia.map((e) => [{ text: e.ora, fontSize: 8, color: '#5f6672' }, { text: e.testo, fontSize: 8 }]) }, layout: 'lightHorizontalLines' }
      : { text: 'Nessun evento.', fontSize: 8.5 },
  );

  const immagini = m.foto.filter((f) => /jpe?g|png/i.test(f.mime));
  if (immagini.length) {
    const righe: Content[] = [];
    for (let i = 0; i < immagini.length; i += 2) {
      righe.push({
        columns: immagini.slice(i, i + 2).map((f) => ({
          stack: [{ image: `data:${f.mime};base64,${bytesToBase64(f.dati)}`, fit: [250, 200] }, { text: f.didascalia || ' ', fontSize: 8, margin: [0, 2, 0, 0] }],
          width: '50%',
        })),
        columnGap: 12,
        margin: [0, 0, 0, 10],
        unbreakable: true,
      });
    }
    // il titolo resta sulla stessa pagina della prima riga di foto
    c.push({ stack: [sezione('Foto allegate'), righe[0]], unbreakable: true }, ...righe.slice(1));
  }

  c.push(sezione('Esito'));
  c.push({
    table: {
      widths: [110, '*'],
      body: [
        [{ text: 'Esito del loop', bold: true }, { text: m.chiusa ? m.esito : `${m.esito} (verifica non chiusa; esito suggerito: ${m.esitoSuggerito})`, bold: true, color: /Non conforme/.test(m.esito) ? ROSSO : undefined }],
        [{ text: 'Attività ancora da eseguire', bold: true }, { text: m.attivita || '—' }],
        [{ text: 'Note', bold: true }, { text: m.note || '—' }],
      ],
    },
    layout: 'lightHorizontalLines',
    fontSize: 9,
  } as Content);
  c.push(firmePdf());

  return documento(`Rapportino loop — ${h.cliente || 'impianto'} — ${h.loop.split(' — ')[0]} — ${h.data}`, c);
}
