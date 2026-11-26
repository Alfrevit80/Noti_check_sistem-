// Lettore tollerante dei file di manutenzione (.MNT) del POL-200-TS.
//
// Formato osservato (POL software "Mar 16 2021", database "Oct 24 2017"):
//   26112600.MNT   Software Version:   Mar 16 2021    Database Version:   Oct 24 2017
//   Add  M/S  Type                     Man  Serial N  YY/WW  PW1  PW2  PW3  PW4  PW5  I    I_I  STA  ISO  DEP
//   001  S    020  OTTIC0(EU)          NOT  31392D49  25/49  0302 0302 0302 0797 0893 049  169  050  Y    S002
//   002  M    151  SIR.STROBE WSS      NOT  3419887A  25/52  0294 0294 0294 1193 0594 052  089  050  Y    S018
// Le colonne dopo YY/WW si leggono in base all'intestazione (il numero di PW può cambiare).
// DEP indica il dispositivo da cui dipende verso la centrale (PNL = centrale/POL): è la mappatura.
import type { DispositivoMnt, FamigliaPol, Griglia, LetturaPol } from '../model/types';

export interface FileMnt {
  nomeFile: string;
  software?: string;
  database?: string;
  colonne: string[];
  dispositivi: DispositivoMnt[];
  avvisi: string[];
}

const RIGA = /^\s*(\d{1,3})\s+([SM])\s+(\d{2,3})\s+(.+?)\s+([A-Z?]{2,4})\s+([0-9A-FX?]{6,10})\s+(\d\d\/\d\d|XX\/XX)\s*(.*)$/i;

/** Il dispositivo ha dati non leggibili (seriale o costruttore illeggibili): risposta corrotta. */
export const datiIllegibili = (d: Pick<DispositivoMnt, 'seriale' | 'costruttore'>) => /^X+$/i.test(d.seriale) || /^X+$/i.test(d.costruttore);

export const idNodo = (famiglia: FamigliaPol, indirizzo: number) => `${famiglia === 'sensori' ? 'S' : 'M'}${String(indirizzo).padStart(3, '0')}`;

function normDep(t: string | undefined): string {
  if (!t) return '';
  const s = t.trim().toUpperCase();
  if (s === 'PNL' || s === 'PANEL') return 'PNL';
  const m = /^([SM])0*(\d{1,3})$/.exec(s);
  return m ? `${m[1]}${m[2].padStart(3, '0')}` : '';
}

export function leggiMnt(testo: string, nomeFile = 'file.MNT'): FileMnt {
  const righe = testo.replace(/^﻿/, '').split(/\r?\n/);
  const out: FileMnt = { nomeFile, colonne: [], dispositivi: [], avvisi: [] };
  let dopo: string[] = ['PW1', 'PW2', 'PW3', 'PW4', 'PW5', 'I', 'I_I', 'STA', 'ISO', 'DEP'];

  for (const [i, grezza] of righe.entries()) {
    const r = grezza.replace(/\t/g, '    ');
    if (!r.trim()) continue;
    const sw = /Software Version:\s*(.+?)(?:\s{2,}|$)/i.exec(r);
    if (sw) out.software = sw[1].trim();
    const db = /Database Version:\s*(.+?)\s*$/i.exec(r);
    if (db) out.database = db[1].trim();
    if (sw || db) continue;

    if (/^\s*Add\s+M\/S/i.test(r)) {
      out.colonne = r.trim().split(/\s{2,}/);
      const idx = out.colonne.findIndex((c) => /^YY\/WW$/i.test(c));
      if (idx >= 0) dopo = out.colonne.slice(idx + 1).map((c) => c.toUpperCase().replace(/\s+/g, '_'));
      continue;
    }

    const m = RIGA.exec(r);
    if (!m) {
      out.avvisi.push(`Riga ${i + 1} non riconosciuta: «${r.trim().slice(0, 60)}»`);
      continue;
    }
    const [, add, ms, codice, nome, man, ser, data, resto] = m;
    const valori = resto.trim() ? resto.trim().split(/\s+/) : [];
    const campo: Record<string, string> = {};
    // DEP è facoltativo (vuoto per i dispositivi non mappati): si assegnano i valori da sinistra
    dopo.forEach((c, k) => {
      if (valori[k] !== undefined) campo[c] = valori[k];
    });
    // se mancano colonne ma l'ultimo valore sembra un DEP, va nel DEP
    const ultimo = valori[valori.length - 1];
    if (!campo.DEP && ultimo && normDep(ultimo) && valori.length < dopo.length) campo.DEP = ultimo;

    const num = (s?: string) => (s !== undefined && /^\d+$/.test(s) ? Number(s) : undefined);
    const pw = dopo.filter((c) => /^PW\d+$/.test(c)).map((c) => num(campo[c]) ?? 0);
    out.dispositivi.push({
      famiglia: ms.toUpperCase() === 'S' ? 'sensori' : 'moduli',
      indirizzo: Number(add),
      tipoCodice: codice,
      tipoNome: nome.trim(),
      costruttore: man.toUpperCase(),
      seriale: ser.toUpperCase(),
      dataProd: data,
      pw,
      corrente: num(campo.I),
      correnteIniziale: num(campo.I_I),
      sta: campo.STA,
      iso: campo.ISO,
      dep: normDep(campo.DEP),
    });
  }
  if (out.dispositivi.length === 0) out.avvisi.unshift('Nessun dispositivo trovato: il file non sembra un file di manutenzione del POL-200-TS.');
  const visti = new Set<string>();
  for (const d of out.dispositivi) {
    const k = idNodo(d.famiglia, d.indirizzo);
    if (visti.has(k)) out.avvisi.push(`${k} compare più volte nel file.`);
    visti.add(k);
  }
  return out;
}

/** Sigle predefinite per codice tipo del file (modificabili). */
export const SIGLE_DA_TIPO: Record<string, string> = { '020': 'OT', '030': 'O', '130': 'PI', '151': 'SS' };

function siglaPer(d: DispositivoMnt, mappa: Record<string, string>): string {
  if (datiIllegibili(d)) return '??';
  const s = mappa[d.tipoCodice];
  if (s) return s;
  // tipo sconosciuto: prime lettere del nome
  return d.tipoNome.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '??';
}

/** Converte il file in una lettura POL (griglie + dettagli). */
export function letturaDaMnt(f: FileMnt, ramo: LetturaPol['ramo'], id: string, ora: string, mappa = SIGLE_DA_TIPO): LetturaPol {
  const sensori: Griglia = {};
  const moduli: Griglia = {};
  for (const d of f.dispositivi) (d.famiglia === 'sensori' ? sensori : moduli)[d.indirizzo] = siglaPer(d, mappa);
  return {
    id,
    ramo,
    ora,
    origine: 'file',
    sensori,
    moduli,
    dettagli: f.dispositivi,
    infoFile: { software: f.software, database: f.database },
    nomeFile: f.nomeFile,
    nota: '',
  };
}
