// Analisi delle letture del POL-200-TS (griglie sensori e moduli, lato A / lato B / loop chiuso).
//
// Convenzioni (manuale POL-200-TS):
//  - "?" nella sigla = problema del dispositivo o della linea;
//  - "-" = possibile indirizzo doppio;
//  - minuscolo = risposta non corretta (cablaggio, dispositivo difettoso, disturbi) o protocollo non coincidente;
//  - cambio di sigla tra due letture = risposta non corretta del dispositivo.
import type { FamigliaPol, Griglia, LetturaPol, Loop, Riconoscimento, SiglaPol, Soglie } from '../model/types';
import type { Anomalia } from './findings';
import { cercaTipoHw, LIMITI_LINEA } from '../settings/tipiHw';
import { ultimoRiconoscimento } from './riconoscimento';

export const FAMIGLIE: FamigliaPol[] = ['sensori', 'moduli'];
export const NOME_FAMIGLIA: Record<FamigliaPol, string> = { sensori: 'sensori', moduli: 'moduli' };
const singolare: Record<FamigliaPol, string> = { sensori: 'sensore', moduli: 'modulo' };

// ───────── sigle ─────────

export const siglaIncerta = (c: string) => c.includes('?');
export const siglaDoppio = (c: string) => c.trim() === '-';
export const siglaMinuscola = (c: string) => /[a-z]/.test(c) && c !== c.toUpperCase();
/** Sigla "pulita" per confrontare due letture (OT e ot sono lo stesso tipo). */
export const tipoBase = (c: string) => c.trim().toUpperCase();

export function eAllarme(codice: string, famiglia: FamigliaPol, sigle: readonly SiglaPol[]): boolean {
  const s =
    sigle.find((x) => x.codice === codice && (x.famiglia === famiglia || x.famiglia === 'entrambe')) ??
    sigle.find((x) => tipoBase(x.codice) === tipoBase(codice) && (x.famiglia === famiglia || x.famiglia === 'entrambe'));
  return s ? s.puntoAllarme : famiglia === 'sensori';
}

export const indirizzi = (g: Griglia): number[] =>
  Object.keys(g)
    .map(Number)
    .filter((n) => Number.isInteger(n) && g[n] !== undefined && g[n] !== '')
    .sort((a, b) => a - b);

/** Raggruppa numeri consecutivi: [1,2,3,7] → "1–3, 7". */
export function intervalli(nn: readonly number[]): string {
  const v = [...nn].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < v.length; i++) {
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
    out.push(j > i + 1 ? `${v[i]}–${v[j]}` : j === i + 1 ? `${v[i]}, ${v[j]}` : `${v[i]}`);
    i = j;
  }
  return out.join(', ');
}

/** Buchi nella numerazione tra 1 e l'indirizzo più alto presente. */
export function buchi(g: Griglia): number[] {
  const ii = indirizzi(g).filter((n) => n > 0);
  if (ii.length === 0) return [];
  const pres = new Set(ii);
  const out: number[] = [];
  for (let n = 1; n < ii[ii.length - 1]; n++) if (!pres.has(n)) out.push(n);
  return out;
}

/** Indirizzi lontani almeno `distanza` da qualunque altro: tipico errore di impostazione dei selettori. */
export function isolati(g: Griglia, distanza = 6): number[] {
  const ii = indirizzi(g).filter((n) => n > 0);
  if (ii.length < 4) return [];
  return ii.filter((n, i) => {
    const prima = i > 0 ? n - ii[i - 1] : Infinity;
    const dopo = i < ii.length - 1 ? ii[i + 1] - n : Infinity;
    return Math.min(prima, dopo) >= distanza;
  });
}

const etRamo = (r: LetturaPol['ramo']) => (r === 'chiuso' ? 'loop chiuso' : `lato ${r}`);

// ───────── una singola lettura ─────────

export function analizzaLettura(l: LetturaPol, loop: Pick<Loop, 'protocollo'>): Anomalia[] {
  const out: Anomalia[] = [];
  const dove = etRamo(l.ramo);
  for (const f of FAMIGLIE) {
    const g = l[f];
    const ii = indirizzi(g);
    const F = NOME_FAMIGLIA[f];
    const cod = (k: string) => `POL_${k}_${f.toUpperCase()}_${l.ramo}`;

    if (g[0] !== undefined && g[0] !== '') {
      out.push({
        codice: cod('INDIRIZZO_0'),
        gravita: 'alta',
        titolo: `Dispositivo all'indirizzo 0 (${F}, ${dove})`,
        spiegazione: 'Un dispositivo all\'indirizzo 0 non è indirizzato: la centrale non lo gestisce.',
        doveIntervenire: ['Individuare il dispositivo senza indirizzo (in genere nuovo o sostituito) e impostarne l\'indirizzo corretto.'],
        riferimenti: [0],
      });
    }
    const incerti = ii.filter((n) => siglaIncerta(g[n]));
    if (incerti.length) {
      out.push({
        codice: cod('INCERTI'),
        gravita: incerti.length >= 3 ? 'alta' : 'media',
        titolo: `Letture incerte «??» (${F}, ${dove}): ${intervalli(incerti)}`,
        spiegazione:
          'Il POL non riconosce la risposta: problema del dispositivo o della linea. Più «??» vicini o consecutivi fanno pensare a un tratto di linea (giunzione, umidità, disturbi) più che a dispositivi guasti.',
        doveIntervenire: [
          'Rileggere più volte (lettura continua): se il «??» si sposta o cambia è un problema di linea.',
          'Controllare le basi e le giunzioni intorno a questi indirizzi.',
          'Confrontare con la lettura dall\'altro lato.',
        ],
        riferimenti: incerti,
      });
    }
    const doppi = ii.filter((n) => siglaDoppio(g[n]));
    if (doppi.length) {
      out.push({
        codice: cod('DOPPI_POL'),
        gravita: 'alta',
        titolo: `Possibili indirizzi doppi segnalati dal POL (${F}, ${dove}): ${intervalli(doppi)}`,
        spiegazione: 'Il carattere «-» indica che a quell\'indirizzo rispondono probabilmente due dispositivi.',
        doveIntervenire: ['Fare l\'auto-riconoscimento con «Verifica doppi indirizzi» = SI e individuare i dispositivi dal LED.'],
        riferimenti: doppi,
      });
    }
    const minuscoli = ii.filter((n) => siglaMinuscola(g[n]));
    if (minuscoli.length) {
      out.push({
        codice: cod('MINUSCOLI'),
        gravita: 'media',
        titolo: `Sigle in minuscolo (${F}, ${dove}): ${intervalli(minuscoli)}`,
        spiegazione:
          'Secondo il manuale del POL la risposta del dispositivo non è corretta: cablaggio, dispositivo difettoso o disturbi. Se TUTTI i dispositivi sono in minuscolo, è il protocollo selezionato sul POL a essere sbagliato.',
        doveIntervenire: ['Controllare il cablaggio di questi dispositivi (morsetti, base).', 'Se persiste, sostituire il dispositivo e rileggere.'],
        riferimenti: minuscoli,
      });
    }
    const iso = isolati(g);
    if (iso.length) {
      out.push({
        codice: cod('ISOLATI'),
        gravita: 'bassa',
        titolo: `Indirizzi isolati (${F}, ${dove}): ${intervalli(iso)}`,
        spiegazione: 'Indirizzi lontani da tutti gli altri: spesso un selettore impostato male (es. 116 invece di 16 o 106).',
        doveIntervenire: ['Verificare sul dispositivo l\'indirizzo impostato rispetto al progetto.'],
        riferimenti: iso,
      });
    }
    const massimo = loop.protocollo === 'CLIP' ? LIMITI_LINEA.indirizziClip : LIMITI_LINEA.indirizziAdv;
    const fuori = ii.filter((n) => n > massimo);
    if (fuori.length) {
      out.push({
        codice: cod('FUORI_RANGE'),
        gravita: 'alta',
        titolo: `Indirizzi oltre ${massimo} (${F}, ${dove}): ${intervalli(fuori)}`,
        spiegazione: `Con protocollo ${loop.protocollo ?? 'ADV'} gli indirizzi vanno da 1 a ${massimo}.`,
        doveIntervenire: ['Correggere gli indirizzi o il protocollo della linea.'],
        riferimenti: fuori,
      });
    }
  }
  return out;
}

// ───────── confronto lato A / lato B ─────────

export interface ConfrontoFamiglia {
  soloA: number[];
  soloB: number[];
  comuni: number[];
  tipoDiverso: number[]; // comuni con sigla diversa
  incertiSoloA: number[]; // incerti/minuscoli da A, buoni da B
  incertiSoloB: number[];
}

export function confrontaFamiglia(a: Griglia, b: Griglia): ConfrontoFamiglia {
  const ia = new Set(indirizzi(a).filter((n) => n > 0));
  const ib = new Set(indirizzi(b).filter((n) => n > 0));
  const comuni = [...ia].filter((n) => ib.has(n)).sort((x, y) => x - y);
  const cattiva = (c: string) => siglaIncerta(c) || siglaMinuscola(c);
  return {
    soloA: [...ia].filter((n) => !ib.has(n)).sort((x, y) => x - y),
    soloB: [...ib].filter((n) => !ia.has(n)).sort((x, y) => x - y),
    comuni,
    tipoDiverso: comuni.filter((n) => !cattiva(a[n]) && !cattiva(b[n]) && tipoBase(a[n]) !== tipoBase(b[n])),
    incertiSoloA: comuni.filter((n) => cattiva(a[n]) && !cattiva(b[n])),
    incertiSoloB: comuni.filter((n) => cattiva(b[n]) && !cattiva(a[n])),
  };
}

export type StatoLoop = 'integro' | 'interrotto' | 'parziale' | 'non_valutabile';

/** Il loop è integro se entrambi i lati vedono (quasi) gli stessi dispositivi, interrotto se vedono gruppi diversi. */
export function statoLoop(c: Record<FamigliaPol, ConfrontoFamiglia>): StatoLoop {
  const tot = (k: keyof ConfrontoFamiglia) => c.sensori[k].length + c.moduli[k].length;
  const unione = tot('comuni') + tot('soloA') + tot('soloB');
  if (unione === 0) return 'non_valutabile';
  if (tot('soloA') + tot('soloB') === 0) return 'integro';
  if (tot('comuni') <= unione * 0.2) return 'interrotto';
  return 'parziale';
}

export function ultimaLettura(letture: readonly LetturaPol[], ramo: LetturaPol['ramo']): LetturaPol | undefined {
  return [...letture].filter((l) => l.ramo === ramo).sort((x, y) => (x.ora < y.ora ? 1 : -1))[0];
}

export function confrontaAB(
  A: LetturaPol,
  B: LetturaPol,
  sigle: readonly SiglaPol[],
  soglie: Pick<Soglie, 'maxDispositiviLoopAperto'>,
): { confronto: Record<FamigliaPol, ConfrontoFamiglia>; stato: StatoLoop; anomalie: Anomalia[] } {
  const confronto = { sensori: confrontaFamiglia(A.sensori, B.sensori), moduli: confrontaFamiglia(A.moduli, B.moduli) };
  const stato = statoLoop(confronto);
  const out: Anomalia[] = [];

  if (stato === 'integro') {
    out.push({
      codice: 'AB_INTEGRO',
      gravita: 'info',
      titolo: 'Entrambi i lati vedono gli stessi dispositivi: nessuna interruzione',
      spiegazione: 'La comunicazione arriva a tutti i dispositivi sia dal lato A sia dal lato B.',
      doveIntervenire: [],
    });
  }

  if (stato === 'interrotto' || stato === 'parziale') {
    for (const f of FAMIGLIE) {
      const c = confronto[f];
      if (stato === 'interrotto' && c.comuni.length) {
        out.push({
          codice: `AB_DOPPI_${f.toUpperCase()}`,
          gravita: 'alta',
          titolo: `Indirizzi visti da entrambi i lati con loop interrotto (${NOME_FAMIGLIA[f]}): ${intervalli(c.comuni)}`,
          spiegazione:
            'Con il loop interrotto ogni dispositivo risponde da un solo lato. Un indirizzo che risponde da entrambi è quasi certamente un indirizzo doppio: due dispositivi, uno per parte.',
          doveIntervenire: ['Individuare i due dispositivi (uno nel tratto A, uno nel tratto B) e correggere l\'indirizzo di uno dei due.'],
          riferimenti: c.comuni,
        });
      }
    }
    if (stato === 'interrotto') {
      const ultimoA = Math.max(0, ...confronto.sensori.soloA, ...confronto.moduli.soloA);
      const primoB = Math.min(...confronto.sensori.soloB, ...confronto.moduli.soloB);
      out.push({
        codice: 'AB_INTERRUZIONE',
        gravita: 'alta',
        titolo: 'Loop interrotto: i due lati vedono gruppi diversi di dispositivi',
        spiegazione: `Dal lato A rispondono ${confronto.sensori.soloA.length} sensori e ${confronto.moduli.soloA.length} moduli, dal lato B ${confronto.sensori.soloB.length} sensori e ${confronto.moduli.soloB.length} moduli.${
          Number.isFinite(primoB) && ultimoA > 0
            ? ` Se gli indirizzi seguono il percorso del cavo, l'interruzione è dopo l'indirizzo ${ultimoA} (ultimo visto da A) e prima del ${primoB} (primo visto da B).`
            : ''
        }`,
        doveIntervenire: [
          'Ispezionare il tratto tra l\'ultimo dispositivo visto da A e il primo visto da B: morsetti, giunzioni, isolatori in protezione.',
          'La mappatura del POL (fase 4) indica l\'ordine fisico reale dei dispositivi.',
        ],
      });
      for (const [lato, f2] of [['A', 'soloA'], ['B', 'soloB']] as const) {
        const punti = FAMIGLIE.flatMap((f) =>
          confronto[f][f2].filter((n) => eAllarme((lato === 'A' ? A : B)[f][n], f, sigle)),
        ).length;
        if (punti > soglie.maxDispositiviLoopAperto) {
          out.push({
            codice: `AB_OLTRE_32_${lato}`,
            gravita: 'alta',
            titolo: `${punti} punti di allarme alimentati solo dal lato ${lato} (massimo ${soglie.maxDispositiviLoopAperto})`,
            spiegazione:
              'Con il loop aperto un ulteriore guasto sul lato può far perdere più punti di quanto ammesso dalla EN54 (massimo 32 sensori e pulsanti).',
            doveIntervenire: ['Ripristinare al più presto la chiusura del loop.'],
          });
        }
      }
    }
    if (stato === 'parziale') {
      const sa = [...confronto.sensori.soloA];
      const sb = [...confronto.sensori.soloB];
      out.push({
        codice: 'AB_SOLO_UN_LATO',
        gravita: 'media',
        titolo: 'Alcuni dispositivi rispondono da un solo lato',
        spiegazione: `Sensori solo da A: ${intervalli(sa) || 'nessuno'}; solo da B: ${intervalli(sb) || 'nessuno'}. Moduli solo da A: ${
          intervalli(confronto.moduli.soloA) || 'nessuno'
        }; solo da B: ${intervalli(confronto.moduli.soloB) || 'nessuno'}. Con il loop integro dovrebbero rispondere da entrambi i lati: risposta intermittente o letture incomplete.`,
        doveIntervenire: ['Ripetere le letture in modalità continua.', 'Controllare base e cablaggio dei dispositivi elencati.'],
      });
    }
  }

  for (const f of FAMIGLIE) {
    const c = confronto[f];
    if (c.tipoDiverso.length) {
      out.push({
        codice: `AB_TIPO_DIVERSO_${f.toUpperCase()}`,
        gravita: 'media',
        titolo: `Tipo diverso tra lato A e lato B (${NOME_FAMIGLIA[f]}): ${intervalli(c.tipoDiverso)}`,
        spiegazione: 'Lo stesso indirizzo risponde con una sigla diversa dai due lati: indirizzo doppio con dispositivi di tipo diverso oppure risposta non corretta.',
        doveIntervenire: ['Verificare quale dispositivo è installato a quell\'indirizzo.'],
        riferimenti: c.tipoDiverso,
      });
    }
    for (const [lato, altro, k] of [['A', 'B', 'incertiSoloA'], ['B', 'A', 'incertiSoloB']] as const) {
      const v = c[k];
      if (v.length >= 2) {
        out.push({
          codice: `AB_PEGGIORA_${lato}_${f.toUpperCase()}`,
          gravita: 'media',
          titolo: `Letture incerte solo dal lato ${lato} (${NOME_FAMIGLIA[f]}): ${intervalli(v)}`,
          spiegazione: `Dal lato ${altro} gli stessi dispositivi rispondono bene: la comunicazione peggiora percorrendo la linea dal lato ${lato}. Tipico di resistenza alta, capacità eccessiva o una giunzione difettosa.`,
          doveIntervenire: ['Confrontare con resistenza di loop, capacità e tensione di ritorno.', 'Controllare le giunzioni lungo il percorso.'],
          riferimenti: v,
        });
      }
    }
  }
  return { confronto, stato, anomalie: out };
}

// ───────── tutte le letture della verifica ─────────

export function analizzaLetture(
  letture: readonly LetturaPol[],
  loop: Loop,
  sigle: readonly SiglaPol[],
  soglie: Soglie,
): Anomalia[] {
  const out: Anomalia[] = [];
  const A = ultimaLettura(letture, 'A');
  const B = ultimaLettura(letture, 'B');
  const C = ultimaLettura(letture, 'chiuso');
  for (const l of [A, B, C]) if (l) out.push(...analizzaLettura(l, loop));
  if (A && B) out.push(...confrontaAB(A, B, sigle, soglie).anomalie);
  else if ((A || B) && !C) {
    const presente = A ? 'A' : 'B';
    out.push({
      codice: 'POL_MANCA_LATO',
      gravita: 'info',
      titolo: `Lettura solo dal lato ${presente}`,
      spiegazione: `Per il confronto (interruzione, indirizzi doppi, dispositivi da un solo lato) serve anche la lettura dal lato ${presente === 'A' ? 'B' : 'A'}.`,
      doveIntervenire: [],
    });
  }

  // buchi nella numerazione (sommando tutte le letture)
  const ultime = [A, B, C].filter((x): x is LetturaPol => !!x);
  if (ultime.length) {
    for (const f of FAMIGLIE) {
      const unione: Griglia = {};
      for (const l of ultime) for (const n of indirizzi(l[f])) unione[n] = l[f][n];
      const b = buchi(unione);
      if (b.length) {
        out.push({
          codice: `POL_BUCHI_${f.toUpperCase()}`,
          gravita: 'bassa',
          titolo: `Buchi nella numerazione dei ${NOME_FAMIGLIA[f]}: ${intervalli(b)}`,
          spiegazione: `Indirizzi mai letti tra 1 e ${Math.max(...indirizzi(unione))}. Possono essere indirizzi liberi da progetto, dispositivi che non rispondono o un tratto di linea non raggiunto${A && B ? '' : ' (manca la lettura da un lato)'}.`,
          doveIntervenire: ['Confrontare con la planimetria / l\'elenco punti del progetto.'],
          riferimenti: b,
        });
      }
    }
  }

  // linea aperta per progetto: max 32 punti di allarme
  const rif = C ?? A ?? B;
  if (rif && loop.stile === 'aperto') {
    const punti = FAMIGLIE.flatMap((f) => indirizzi(rif[f]).filter((n) => n > 0 && eAllarme(rif[f][n], f, sigle))).length;
    if (punti > soglie.maxDispositiviLoopAperto) {
      out.push({
        codice: 'LINEA_APERTA_OLTRE_32',
        gravita: 'alta',
        titolo: `Linea aperta con ${punti} punti di allarme (massimo ${soglie.maxDispositiviLoopAperto})`,
        spiegazione: 'Il manuale di installazione (EN54) ammette al massimo 32 sensori e pulsanti su una linea installata come loop aperto.',
        doveIntervenire: ['Chiudere la linea a loop con isolatori, oppure dividerla.'],
      });
    }
  }

  // totale atteso
  const unione = (f: FamigliaPol) => new Set(letture.filter((l) => l === A || l === B || l === C).flatMap((l) => indirizzi(l[f]).filter((n) => n > 0))).size;
  for (const [f, atteso] of [['sensori', loop.totaleAttesoSensori], ['moduli', loop.totaleAttesoModuli]] as const) {
    if (!atteso || !(A || B || C)) continue;
    const visti = unione(f);
    if (visti !== atteso) {
      out.push({
        codice: `POL_TOTALE_${f.toUpperCase()}`,
        gravita: visti < atteso ? 'media' : 'bassa',
        titolo: `${NOME_FAMIGLIA[f][0].toUpperCase() + NOME_FAMIGLIA[f].slice(1)} letti dal POL: ${visti}, attesi ${atteso}`,
        spiegazione:
          visti < atteso
            ? `Mancano ${atteso - visti} ${NOME_FAMIGLIA[f]}: se sommando i due lati ne mancano molti c'è un tratto morto (due interruzioni, un isolatore aperto o un corto).`
            : `Ci sono ${visti - atteso} ${NOME_FAMIGLIA[f]} in più del previsto.`,
        doveIntervenire: ['Verificare il totale atteso e i buchi nella numerazione.'],
      });
    }
  }
  return out;
}

// ───────── POL ↔ centrale ─────────

export function confrontaConCentrale(letture: readonly LetturaPol[], rr: readonly Riconoscimento[]): Anomalia[] {
  const r = ultimoRiconoscimento(rr);
  if (!r) return [];
  const rif = ultimaLettura(letture, 'chiuso') ?? null;
  const A = ultimaLettura(letture, 'A');
  const B = ultimaLettura(letture, 'B');
  if (!rif && !A && !B) return [];
  const visti = (f: FamigliaPol) =>
    new Set([rif, A, B].filter((x): x is LetturaPol => !!x).flatMap((l) => indirizzi(l[f]).filter((n) => n > 0))).size;
  const tot: Record<FamigliaPol, number> = { sensori: 0, moduli: 0 };
  const nonClassificati: string[] = [];
  for (const x of r.righe) {
    const t = cercaTipoHw(x.tipoDispositivo);
    if (!t) {
      if (x.tot) nonClassificati.push(x.tipoDispositivo || '(senza tipo)');
      continue;
    }
    tot[t.famiglia === 'sensore' ? 'sensori' : 'moduli'] += x.tot;
  }
  const out: Anomalia[] = [];
  for (const f of FAMIGLIE) {
    const v = visti(f);
    if (tot[f] === 0 && nonClassificati.length) continue;
    if (v !== tot[f]) {
      out.push({
        codice: `POL_CENTRALE_${f.toUpperCase()}`,
        gravita: 'media',
        titolo: `${NOME_FAMIGLIA[f][0].toUpperCase() + NOME_FAMIGLIA[f].slice(1)}: POL ${v}, centrale (TOT) ${tot[f]}`,
        spiegazione:
          v > tot[f]
            ? `Il POL vede ${v - tot[f]} ${NOME_FAMIGLIA[f]} in più di quelli rilevati dalla centrale: dispositivi che non rispondono alla centrale (linea, indirizzo doppio) o letture incerte contate dal POL.`
            : `La centrale rileva ${tot[f] - v} ${NOME_FAMIGLIA[f]} in più del POL: letture POL incomplete o eseguite con il loop interrotto.`,
        doveIntervenire: ['Ripetere le letture e l\'auto-riconoscimento a loop chiuso e confrontare indirizzo per indirizzo.'],
      });
    }
  }
  if (nonClassificati.length) {
    out.push({
      codice: 'POL_CENTRALE_TIPI_SCONOSCIUTI',
      gravita: 'info',
      titolo: 'Confronto POL ↔ centrale parziale',
      spiegazione: `Tipi del riconoscimento non presenti nella tabella dei Tipi HW: ${nonClassificati.join(', ')}. Non so se contarli tra sensori o moduli.`,
      doveIntervenire: ['Usare i nomi dei Tipi HW come compaiono sul display (es. NFX(I)-OPT, MCP5A).'],
    });
  }
  return out;
}

// ───────── differenze tra due letture ─────────

export interface DiffLettura {
  aggiunti: number[];
  persi: number[];
  cambiati: { indirizzo: number; prima: string; dopo: string }[];
}

export function diffGriglie(prima: Griglia, dopo: Griglia): DiffLettura {
  const p = new Set(indirizzi(prima));
  const d = new Set(indirizzi(dopo));
  return {
    aggiunti: [...d].filter((n) => !p.has(n)).sort((a, b) => a - b),
    persi: [...p].filter((n) => !d.has(n)).sort((a, b) => a - b),
    cambiati: [...d]
      .filter((n) => p.has(n) && prima[n] !== dopo[n])
      .sort((a, b) => a - b)
      .map((n) => ({ indirizzo: n, prima: prima[n], dopo: dopo[n] })),
  };
}

// ───────── stato di ogni cella per la visualizzazione ─────────

export type StatoCella = 'soloA' | 'soloB' | 'entrambi' | 'doppio' | 'incerto' | 'presente' | 'perso' | 'vuoto';

export const ETICHETTA_STATO: Record<StatoCella, string> = {
  soloA: 'Solo lato A',
  soloB: 'Solo lato B',
  entrambi: 'Da entrambi i lati',
  doppio: 'Indirizzo doppio',
  incerto: 'Lettura incerta',
  presente: 'Presente (loop chiuso)',
  perso: 'Perso rispetto alla lettura precedente',
  vuoto: 'Nessuna risposta',
};

/**
 * Stato di ogni indirizzo di una famiglia, combinando le ultime letture.
 * Con una lettura a loop chiuso: presente / perso (c'era in una lettura precedente) / incerto.
 * Senza: solo A / solo B / entrambi / doppio (visto da entrambi con loop interrotto) / incerto.
 */
export function statiCelle(letture: readonly LetturaPol[], f: FamigliaPol): Record<number, StatoCella> {
  const out: Record<number, StatoCella> = {};
  const C = ultimaLettura(letture, 'chiuso');
  if (C) {
    const precedenti = letture.filter((l) => l !== C && l.ora <= C.ora);
    const visti = new Set(precedenti.flatMap((l) => indirizzi(l[f])));
    for (const n of indirizzi(C[f])) out[n] = siglaIncerta(C[f][n]) || siglaMinuscola(C[f][n]) || siglaDoppio(C[f][n]) ? 'incerto' : 'presente';
    for (const n of visti) if (!(n in out)) out[n] = 'perso';
    return out;
  }
  const A = ultimaLettura(letture, 'A');
  const B = ultimaLettura(letture, 'B');
  const interrotto = A && B ? statoLoop({ sensori: confrontaFamiglia(A.sensori, B.sensori), moduli: confrontaFamiglia(A.moduli, B.moduli) }) === 'interrotto' : false;
  const ga = A?.[f] ?? {};
  const gb = B?.[f] ?? {};
  for (const n of new Set([...indirizzi(ga), ...indirizzi(gb)])) {
    const inA = n in ga && ga[n] !== '';
    const inB = n in gb && gb[n] !== '';
    const c = (inA ? ga[n] : '') + (inB ? gb[n] : '');
    if (siglaDoppio(ga[n] ?? '') || siglaDoppio(gb[n] ?? '')) out[n] = 'doppio';
    else if (inA && inB) out[n] = interrotto ? 'doppio' : siglaIncerta(c) || siglaMinuscola(c) ? 'incerto' : 'entrambi';
    else if (siglaIncerta(c) || siglaMinuscola(c)) out[n] = 'incerto';
    else out[n] = inA ? 'soloA' : 'soloB';
  }
  return out;
}

export const nomeFamiglia = (f: FamigliaPol, n: number) => (n === 1 ? singolare[f] : NOME_FAMIGLIA[f]);
