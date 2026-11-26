// Dati del rapportino, raccolti in una struttura semplice (pura e testabile) da cui si genera il PDF.
import type { Anomalia } from '../analysis/findings';
import type { Centrale, Foto, Griglia, Impianto, Impostazioni, LetturaPol, Loop, Sessione, ValoreMisura } from '../model/types';
import { analizzaSessione, esitoSuggerito } from '../analysis/sessione';
import { DEF_MISURE, TIPI_ISOLAMENTO, TIPI_LINEA, formattaValore, ultimaMisura, type RamoMisura } from '../analysis/misure';
import { valutaMisura, type Valutazione } from '../analysis/valutazione';
import { indirizzi, statiCelle, ultimaLettura, type StatoCella } from '../analysis/pol';
import { breve, costruisciMappa, dorsale } from '../analysis/mappa';
import { idNodo } from '../import/mnt';
import { totaliRiconoscimento, ultimoRiconoscimento } from '../analysis/riconoscimento';
import { cronologia, testoSintomo } from '../db/sessioni';
import { resistenzaConduttore, sezioneMinima } from '../analysis/loopResistance';
import { numeroLoopTotali } from '../db/repo';

export interface Cella {
  testo: string;
  stato?: Valutazione | 'vuoto';
}

export interface StatoGriglie {
  titolo: string;
  sensori: Griglia;
  moduli: Griglia;
  statiSensori: Record<number, StatoCella>;
  statiModuli: Record<number, StatoCella>;
  legenda: StatoCella[];
  tabellaModuli: { indirizzo: number; sigla: string; info: string }[];
  totali: { sensori: number; moduli: number };
}

export interface ModelloLoop {
  intestazione: {
    cliente: string;
    impianto: string;
    indirizzo: string;
    data: string;
    tecnico: string;
    strumento: string;
    centrale: string;
    loop: string;
    inizio: string;
    fine?: string;
  };
  sintomo?: string;
  iniziale?: StatoGriglie;
  finale?: StatoGriglie;
  isolamento: { etichetta: string; A: Cella; B: Cella }[];
  altreMisure: { etichetta: string; valore: Cella; limite: string }[];
  cavo: string[];
  riconoscimento?: { ora: string; righe: { tipo: string; nuo: number; inc: number; tot: number; man: number }[]; totali: { nuo: number; inc: number; tot: number; man: number } };
  mappatura?: { lato: string; percorso: string; derivazioni: string; fine: string; nonMappati: string };
  anomalie: Anomalia[];
  cronologia: { ora: string; testo: string }[];
  foto: { didascalia: string; mime: string; dati: Uint8Array }[];
  diagnosiClaude?: { testo: string; ora: string };
  esito: string;
  esitoSuggerito: string;
  chiusa: boolean;
  attivita: string;
  note: string;
}

const ESITI: Record<string, string> = { da_verificare: 'Da verificare', ok: 'Conforme', ok_con_riserva: 'Conforme con riserva', non_conforme: 'Non conforme' };
export const testoEsitoReport = (e: string) => ESITI[e] ?? e;

export function dataIt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function oraIt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function cellaMisura(s: Sessione, ramo: RamoMisura, tipo: Parameters<typeof valutaMisura>[0], imp: Impostazioni): Cella {
  const m = ultimaMisura(s.misure, ramo, tipo);
  if (!m) return { testo: '—', stato: 'vuoto' };
  const v: ValoreMisura = m.valore;
  return { testo: formattaValore(v, v === 'OL' ? undefined : DEF_MISURE[tipo].unita), stato: valutaMisura(tipo, v, imp.soglie) };
}

function statoGriglie(titolo: string, letture: LetturaPol[], imp: Impostazioni, conModello: boolean): StatoGriglie | undefined {
  if (!letture.length) return undefined;
  const ordinate = [...letture].sort((a, b) => (a.ora < b.ora ? -1 : 1));
  const sensori: Griglia = {};
  const moduli: Griglia = {};
  for (const l of ordinate) {
    Object.assign(sensori, l.sensori);
    Object.assign(moduli, l.moduli);
  }
  const statiSensori = statiCelle(letture, 'sensori');
  const statiModuli = statiCelle(letture, 'moduli');
  const chiuso = letture.some((l) => l.ramo === 'chiuso');
  const dettagli = ordinate.flatMap((l) => l.dettagli ?? []);
  const nomeStato: Record<string, string> = { soloA: 'lato A', soloB: 'lato B', entrambi: 'A e B', doppio: 'doppio', incerto: 'incerto', presente: 'presente', perso: 'perso' };
  const tabellaModuli = indirizzi(moduli).map((n) => {
    const det = dettagli.filter((d) => d.famiglia === 'moduli' && d.indirizzo === n).at(-1);
    const sigla = imp.sigle.find((x) => x.codice === moduli[n]);
    return {
      indirizzo: n,
      sigla: moduli[n],
      info: conModello ? det?.tipoNome ?? sigla?.descrizione ?? '' : nomeStato[statiModuli[n]] ?? '',
    };
  });
  return {
    titolo,
    sensori,
    moduli,
    statiSensori,
    statiModuli,
    legenda: chiuso ? ['presente', 'perso', 'incerto'] : ['soloA', 'soloB', 'entrambi', 'doppio', 'incerto'],
    tabellaModuli,
    totali: { sensori: indirizzi(sensori).filter((n) => n > 0).length, moduli: indirizzi(moduli).filter((n) => n > 0).length },
  };
}

export function modelloLoop(
  s: Sessione,
  loop: Loop,
  centrale: Centrale | undefined,
  impianto: Impianto | undefined,
  imp: Impostazioni,
  foto: Foto[],
): ModelloLoop {
  const anomalie = analizzaSessione(s, loop, imp.soglie, imp.sigle);
  // stato iniziale: le prime letture dal lato A e dal lato B; stato finale: l'ultima lettura a loop chiuso
  const primaDi = (r: 'A' | 'B') => [...s.letture].filter((l) => l.ramo === r).sort((a, b) => (a.ora < b.ora ? -1 : 1))[0];
  const iniziali = [primaDi('A'), primaDi('B')].filter((x): x is LetturaPol => !!x);
  const chiuso = ultimaLettura(s.letture, 'chiuso');
  const finali = chiuso ? [chiuso] : [ultimaLettura(s.letture, 'A'), ultimaLettura(s.letture, 'B')].filter((x): x is LetturaPol => !!x);
  const finaliDiversi = chiuso || finali.some((f) => !iniziali.includes(f));

  const isolamento = [...TIPI_ISOLAMENTO, ...TIPI_LINEA].map((t) => ({
    etichetta: DEF_MISURE[t].etichetta,
    A: cellaMisura(s, 'A', t, imp),
    B: cellaMisura(s, 'B', t, imp),
  }));
  const so = imp.soglie;
  const rP = ultimaMisura(s.misure, 'loop', 'rP')?.valore;
  const rN = ultimaMisura(s.misure, 'loop', 'rN')?.valore;
  const tot = typeof rP === 'number' && typeof rN === 'number' ? Math.round((rP + rN) * 100) / 100 : undefined;
  const altreMisure = [
    { etichetta: 'Tensione residua ramo A', valore: cellaMisura(s, 'A', 'vRes', imp), limite: `≤ ${so.vResiduaMaxV} V` },
    { etichetta: 'Tensione residua ramo B', valore: cellaMisura(s, 'B', 'vRes', imp), limite: `≤ ${so.vResiduaMaxV} V` },
    { etichetta: 'Resistenza A+ → B+', valore: cellaMisura(s, 'loop', 'rP', imp), limite: '' },
    { etichetta: 'Resistenza A− → B−', valore: cellaMisura(s, 'loop', 'rN', imp), limite: `≤ ${so.rNegMaxOhm} Ω` },
    {
      etichetta: 'Resistenza di loop totale',
      valore: tot === undefined ? { testo: '—', stato: 'vuoto' as const } : { testo: formattaValore(tot, 'Ω'), stato: (tot > so.rLoopMaxOhm ? 'basso' : 'ok') as Valutazione },
      limite: `≤ ${so.rLoopMaxOhm} Ω`,
    },
    { etichetta: 'Resistenza calza A → B', valore: cellaMisura(s, 'loop', 'rC', imp), limite: `≈ ${so.calzaSuNegativo[0]}–${so.calzaSuNegativo[1]} × negativo` },
    { etichetta: 'Capacità + / −', valore: cellaMisura(s, 'loop', 'cap', imp), limite: `≤ ${String(so.capacitaMaxUF).replace('.', ',')} μF` },
    { etichetta: 'Tensione di ritorno (POL)', valore: cellaMisura(s, 'loop', 'vRit', imp), limite: `≥ ${so.vRitornoMinV} V` },
    { etichetta: 'Tensione di linea (centrale alimentata)', valore: cellaMisura(s, 'loop', 'vLin', imp), limite: `24 V (min ${so.vLineaMinV} V)` },
  ];
  const { lunghezzaM: L, sezioneMm2: S, tipo } = s.cavo;
  const cavo = [
    tipo ? `Tipo: ${tipo}` : '',
    L ? `Lunghezza: ${L} m` : '',
    S ? `Sezione: ${String(S).replace('.', ',')} mm²` : '',
    L && S ? `Resistenza attesa per conduttore: circa ${String(Math.round(resistenzaConduttore(L, S) * 10) / 10).replace('.', ',')} Ω` : '',
    L ? (() => {
      const min = sezioneMinima(L, so.tabellaSezioni);
      return min === null ? 'Lunghezza oltre la tabella delle sezioni' : `Sezione minima per questa lunghezza: ${String(min).replace('.', ',')} mm²`;
    })() : '',
  ].filter(Boolean);

  const ric = ultimoRiconoscimento(s.riconoscimenti);
  const conMappa = [ultimaLettura(s.letture, 'A'), ultimaLettura(s.letture, 'B'), chiuso].find((l) => l?.dettagli?.length);
  let mappatura: ModelloLoop['mappatura'];
  if (conMappa) {
    const m = costruisciMappa(conMappa.dettagli!);
    const d = dorsale(m);
    mappatura = {
      lato: conMappa.ramo === 'chiuso' ? 'loop chiuso' : `lato ${conMappa.ramo}`,
      percorso: ['Centrale', ...d.map((n) => breve(n.id))].join(' → '),
      derivazioni: m.derivazioni.map((n) => `${breve(n.id)}: ${n.figli.slice(0, -1).map((f) => [f, ...f.figli].map((x) => breve(x.id)).join('-')).join(', ')}`).join('; '),
      fine: d.length ? breve(d[d.length - 1].id) : '',
      nonMappati: m.nonMappati.map((x) => breve(idNodo(x.famiglia, x.indirizzo))).join(', '),
    };
  }

  const sint = s.sintomo
    ? `${testoSintomo(s.sintomo.tipo)}${s.sintomo.tipo !== 'nessuno' && s.sintomo.ramo !== 'non_noto' ? ` — ${s.sintomo.ramo === 'entrambi' ? 'entrambi i rami' : `ramo ${s.sintomo.ramo}`}` : ''}${s.sintomo.descrizione ? ` («${s.sintomo.descrizione}»)` : ''}`
    : undefined;

  return {
    intestazione: {
      cliente: impianto?.cliente ?? '',
      impianto: impianto?.nomeImpianto ?? '',
      indirizzo: impianto?.indirizzo ?? '',
      data: dataIt(s.inizio),
      tecnico: s.tecnico || impianto?.tecnico || '',
      strumento: s.strumento,
      centrale: centrale ? `${centrale.nome} — ${centrale.modello}, CPU ${centrale.nodoCpu || '?'}${centrale.firmware ? `, FW ${centrale.firmware}` : ''}` : '',
      loop: `Loop ${loop.numero} — ${loop.scheda}${loop.descrizione ? ` (${loop.descrizione})` : ''}${centrale ? ` · ${numeroLoopTotali(centrale)} loop in centrale` : ''}`,
      inizio: `${dataIt(s.inizio)} ${oraIt(s.inizio)}`,
      fine: s.fine ? `${dataIt(s.fine)} ${oraIt(s.fine)}` : undefined,
    },
    sintomo: sint,
    iniziale: statoGriglie('Stato iniziale', iniziali, imp, false),
    finale: finaliDiversi ? statoGriglie(chiuso ? 'Stato finale (loop chiuso)' : 'Stato finale', finali, imp, true) : undefined,
    isolamento,
    altreMisure,
    cavo,
    riconoscimento: ric ? { ora: oraIt(ric.ora), righe: ric.righe.map((r) => ({ tipo: r.tipoDispositivo, nuo: r.nuo, inc: r.inc, tot: r.tot, man: r.man })), totali: totaliRiconoscimento(ric) } : undefined,
    mappatura,
    anomalie,
    cronologia: cronologia(s).map((e) => ({ ora: oraIt(e.ora), testo: e.testo })),
    foto: foto.filter((f) => f.sessioneId === s.id).map((f) => ({ didascalia: f.didascalia, mime: f.mime, dati: f.dati })),
    diagnosiClaude: s.diagnosiClaude ? { testo: s.diagnosiClaude.testo, ora: `${dataIt(s.diagnosiClaude.ora)} ${oraIt(s.diagnosiClaude.ora)}` } : undefined,
    esito: testoEsitoReport(s.esito),
    esitoSuggerito: testoEsitoReport(esitoSuggerito(anomalie, s)),
    chiusa: !!s.fine,
    attivita: s.attivitaDaEseguire,
    note: s.note,
  };
}
