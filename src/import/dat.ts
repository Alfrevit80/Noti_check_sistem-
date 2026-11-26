// Lettore del registro nel tempo (.DAT) del POL-200-TS.
//
// Formato osservato (separato da tabulazioni):
//   26112600.DAT
//   Date      Time      Add  M/S  PW1  PW2  PW3  PW4  PW5  I    I_I  STA
//   26/11/26  13:34:53  001  S    0302 0302 0302 0797 0893 049  169  050
//   26/11/26  13:34:53  005  S    -    -    -    -    -    -    -    000     ← nessuna risposta
// Il POL interroga a giri tutti gli indirizzi (sensori 0-159, poi moduli 0-159). Il campionamento dettagliato
// funziona solo sotto l'indirizzo 99 (manuale POL, "Campione"): oltre risulta sempre "-".
import type { CampioneDat, FamigliaPol } from '../model/types';

export interface FileDat {
  nomeFile: string;
  colonne: string[];
  campioni: CampioneDat[];
  avvisi: string[];
}

export const MAX_CAMPIONATO = 99;

/** Riconosce un registro .DAT dal contenuto (intestazione con Date / Time). */
export const sembraDat = (testo: string) => /^\s*Date\s+Time\s+Add\s+M\/S/im.test(testo);

export function leggiDat(testo: string, nomeFile = 'file.DAT'): FileDat {
  const out: FileDat = { nomeFile, colonne: [], campioni: [], avvisi: [] };
  let colonne = ['DATE', 'TIME', 'ADD', 'M/S', 'PW1', 'PW2', 'PW3', 'PW4', 'PW5', 'I', 'I_I', 'STA'];
  for (const [i, grezza] of testo.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const r = grezza.trim();
    if (!r) continue;
    const parti = r.split(/\t+|\s{2,}|\s+(?=\S)/).filter(Boolean);
    if (/^Date$/i.test(parti[0])) {
      colonne = parti.map((c) => c.toUpperCase());
      out.colonne = colonne;
      continue;
    }
    const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(parti[0] ?? '');
    if (!m) {
      if (i > 0 && !/\.DAT$/i.test(r)) out.avvisi.push(`Riga ${i + 1} non riconosciuta: «${r.slice(0, 60)}»`);
      continue;
    }
    const campo: Record<string, string> = {};
    colonne.forEach((c, k) => (campo[c] = parti[k]));
    const [, gg, mm, aa] = m;
    const ora = /^\d\d:\d\d:\d\d$/.test(campo.TIME ?? '') ? campo.TIME : '00:00:00';
    const ms = (campo['M/S'] ?? '').toUpperCase();
    const add = Number(campo.ADD);
    if (!['S', 'M'].includes(ms) || !Number.isInteger(add)) {
      out.avvisi.push(`Riga ${i + 1}: indirizzo o tipo non validi.`);
      continue;
    }
    const num = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : undefined);
    const pwCol = colonne.filter((c) => /^PW\d+$/.test(c));
    const risponde = pwCol.some((c) => num(campo[c]) !== undefined);
    out.campioni.push({
      ora: `20${aa}-${mm}-${gg}T${ora}`,
      famiglia: ms === 'S' ? 'sensori' : 'moduli',
      indirizzo: add,
      risponde,
      pw: risponde ? pwCol.map((c) => num(campo[c]) ?? 0) : [],
      corrente: num(campo.I),
      correnteIniziale: num(campo.I_I),
      sta: campo.STA,
    });
  }
  if (!out.campioni.length) out.avvisi.unshift('Nessun campione trovato: il file non sembra un registro del POL-200-TS.');
  return out;
}

export interface Giro {
  famiglia: FamigliaPol;
  inizio: string;
  fine: string;
  campioni: CampioneDat[];
  completo: boolean; // arriva almeno all'indirizzo 99
}

/** Divide i campioni in giri: un giro ricomincia quando l'indirizzo torna indietro o cambia la famiglia. */
export function giri(campioni: readonly CampioneDat[]): Giro[] {
  const out: Giro[] = [];
  let g: Giro | null = null;
  let ultimo = -1;
  for (const c of campioni) {
    if (!g || g.famiglia !== c.famiglia || c.indirizzo <= ultimo) {
      g = { famiglia: c.famiglia, inizio: c.ora, fine: c.ora, campioni: [], completo: false };
      out.push(g);
    }
    g.campioni.push(c);
    g.fine = c.ora;
    ultimo = c.indirizzo;
    if (c.indirizzo >= MAX_CAMPIONATO) g.completo = true;
  }
  return out;
}

export interface StatIndirizzo {
  famiglia: FamigliaPol;
  indirizzo: number;
  interrogato: number; // giri completi in cui è stato interrogato
  risposte: number;
  pw1: [number, number] | null; // min, max
  ii: [number, number] | null;
  sta: Record<string, number>;
}

/** Statistiche per indirizzo sui giri completi (solo indirizzi fino a 99). */
export function statistiche(campioni: readonly CampioneDat[]): StatIndirizzo[] {
  const m = new Map<string, StatIndirizzo>();
  for (const g of giri(campioni).filter((x) => x.completo)) {
    for (const c of g.campioni) {
      if (c.indirizzo > MAX_CAMPIONATO) continue;
      const k = `${c.famiglia}${c.indirizzo}`;
      const s = m.get(k) ?? { famiglia: c.famiglia, indirizzo: c.indirizzo, interrogato: 0, risposte: 0, pw1: null, ii: null, sta: {} };
      s.interrogato++;
      if (c.risponde) {
        s.risposte++;
        const p = c.pw[0];
        if (p > 0) s.pw1 = s.pw1 ? [Math.min(s.pw1[0], p), Math.max(s.pw1[1], p)] : [p, p];
        if (c.correnteIniziale !== undefined) s.ii = s.ii ? [Math.min(s.ii[0], c.correnteIniziale), Math.max(s.ii[1], c.correnteIniziale)] : [c.correnteIniziale, c.correnteIniziale];
        if (c.sta) s.sta[c.sta] = (s.sta[c.sta] ?? 0) + 1;
      }
      m.set(k, s);
    }
  }
  return [...m.values()].sort((a, b) => (a.famiglia === b.famiglia ? a.indirizzo - b.indirizzo : a.famiglia === 'sensori' ? -1 : 1));
}
