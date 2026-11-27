// Linee guida per eseguire correttamente ogni misura ("Come misurare").
// Ogni suggerimento indica la fonte: manuale di installazione AM-8200N (M-173.2), manuale POL-200-TS,
// oppure buona pratica di cantiere.
import type { Soglie, TipoMisura } from '../model/types';

export type Fonte = 'AM-8200N' | 'POL-200-TS' | 'pratica';

export interface Consiglio {
  testo: string;
  fonte: Fonte;
}

export interface GuidaMisura {
  strumento: string;
  preparazione: Consiglio[];
  esecuzione: Consiglio[];
  atteso: (s: Soglie) => string;
  errori: Consiglio[];
}

const am = (testo: string): Consiglio => ({ testo, fonte: 'AM-8200N' });
const pol = (testo: string): Consiglio => ({ testo, fonte: 'POL-200-TS' });
const prat = (testo: string): Consiglio => ({ testo, fonte: 'pratica' });
const n = (x: number) => String(x).replace('.', ',');

const SCOLLEGATO = am('Canali A e B del loop scollegati dalla scheda (CPU o LIB-8200N), calza compresa.');
const NO_DITA = prat('Non toccare le punte dei puntali né i conduttori con le dita: il corpo falsa le misure in MΩ.');
const STABILE = prat('Attendere che la lettura si stabilizzi: la capacità del cavo e dei dispositivi si carica e il valore sale lentamente. Registrare il valore stabile.');
const MULTIMETRO = am('Usare un multimetro digitale, come indicato dal manuale di installazione.');
const NO_MEGGER = prat('Non usare un megaohmmetro ad alta tensione di prova (250–500 V) con i dispositivi collegati: può danneggiarli e dà valori non confrontabili con quelli del manuale.');

const isolamento = (a: string, b: string, extra: Consiglio[] = []): GuidaMisura => ({
  strumento: 'Multimetro digitale in Ω, scala MΩ (fondo scala più alto disponibile)',
  preparazione: [SCOLLEGATO, am('Linea scarica: tensione residua verificata ≈ 0 V.'), ...extra, MULTIMETRO, NO_MEGGER],
  esecuzione: [prat(`Un puntale su ${a}, l'altro su ${b}.`), STABILE, NO_DITA, prat('Se il display indica fuori scala registrare OL.')],
  atteso: (s) => `Maggiore di 15÷20 MΩ, meglio infinito (OL). Sotto ${n(s.isolamentoMinMOhm)} MΩ = guasto.`,
  errori: [
    prat('Lettura che scende e risale: umidità o contatto intermittente, ripetere e annotarlo.'),
    prat('Batteria del multimetro scarica: letture instabili in MΩ.'),
  ],
});

const TERRA = 'la barra di terra della centrale (morsettiera di terra)';

const multimetroPol = (riga: string, atteso: (s: Soglie) => string, extra: Consiglio[] = []): GuidaMisura => ({
  strumento: 'POL-200-TS, funzione Multimetro',
  preparazione: [
    pol('Loop scollegato dalla centrale e centrale spenta; ramo A a destra («Uscita loop»), ramo B a sinistra («Ritorno»).'),
    prat('Collegare anche le due calze ai morsetti grigi e il filo di terra: senza, le misure di calza e terra non sono valide.'),
    pol('Batteria del POL carica.'),
  ],
  esecuzione: [prat(`Leggere la riga «${riga}». Se il display mostra «>1000» (o «>150 Ohm») registrare OL.`), ...extra],
  atteso,
  errori: [prat('Valori «----»: la misura non è stata eseguita; premere il tasto della colonna (Ω, μH, nF, terra).')],
});

export const GUIDE_MISURE: Record<TipoMisura, GuidaMisura> = {
  gPN: multimetroPol('Guasto — Pos.- neg.', () => 'Il più alto possibile. Pochi kΩ indicano una perdita tra i conduttori (con i dispositivi collegati, confrontare con un loop sano).'),
  gCP: multimetroPol('Guasto — Calza Pos.', () => '>1000 kΩ (OL). Un valore misurabile è un contatto tra calza e positivo.'),
  gCN: multimetroPol('Guasto — Calza Neg.', () => '>1000 kΩ (OL). Un valore misurabile è un contatto tra calza e negativo.'),
  gTP: multimetroPol('Guasto Terra — Positivo', () => '>1000 kΩ (OL).', [prat('Premere il tasto con il simbolo di terra.')]),
  gTN: multimetroPol('Guasto Terra — Negativo', () => '>1000 kΩ (OL).'),
  gTC: multimetroPol('Guasto Terra — Calza', () => '>1000 kΩ (OL).'),
  cPN: multimetroPol('Capacità — Pos.- neg.', (s) => `Cavo entro ${s.capacitaMaxUF * 1000} nF (manuale); con i dispositivi collegati il valore cresce.`, [prat('Premere il tasto nF.')]),
  cCP: multimetroPol('Capacità — Calza Pos.', () => 'Simile alla capacità calza / −: i due conduttori sono lunghi uguali.'),
  cCN: multimetroPol('Capacità — Calza Neg.', () => 'Simile alla capacità calza / +.'),
  vRes: {
    strumento: 'Multimetro digitale in Vcc (scala automatica o 200 V)',
    preparazione: [SCOLLEGATO, am('Verificare l\'assenza di tensione sul canale A e sul canale B prima di ogni misura in Ω.')],
    esecuzione: [prat('Puntale rosso sul +, nero sul − del ramo.'), prat('Leggere dopo qualche secondo.')],
    atteso: (s) => `Circa 0 V (massimo ${n(s.vResiduaMaxV)} V).`,
    errori: [
      prat('Tensione presente: un modulo o una sirena con alimentazione esterna ancora collegata, oppure il cavo non è davvero scollegato.'),
      prat('Per scaricare la linea collegare brevemente + e −, poi ciascun conduttore verso terra, e rimisurare.'),
    ],
  },
  pT: isolamento('+ del ramo', TERRA),
  nT: isolamento('− del ramo', TERRA, [prat('Se sulla linea ci sono barriere Zener, il negativo è collegato a terra per progetto: annotarlo.')]),
  cT: isolamento('calza del ramo', TERRA, [am('La calza va scollegata dalla terra in centrale: deve essere collegata a terra in un solo punto.')]),
  pC: isolamento('+ del ramo', 'calza dello stesso ramo'),
  nC: isolamento('− del ramo', 'calza dello stesso ramo'),
  pN: {
    strumento: 'Multimetro digitale in Ω, scala MΩ',
    preparazione: [SCOLLEGATO, am('Sensori e moduli installati sulla linea (è una prova con i dispositivi collegati).'), MULTIMETRO],
    esecuzione: [am('Puntale + del tester sul + della linea, puntale − del tester sul − della linea.'), STABILE, NO_DITA],
    atteso: (s) => `${n(s.lineaPN[0])} ÷ ${n(s.lineaPN[1])} MΩ (manuale di installazione, Test 1).`,
    errori: [prat('I valori dipendono dal multimetro: tra due strumenti diversi possono cambiare un po\'. Usare sempre lo stesso.')],
  },
  nP: {
    strumento: 'Multimetro digitale in Ω, scala MΩ',
    preparazione: [SCOLLEGATO, am('Sensori e moduli installati sulla linea.')],
    esecuzione: [am('Puntali invertiti: + del tester sul − della linea, − del tester sul + della linea.'), STABILE, NO_DITA],
    atteso: (s) => `${n(s.lineaNP[0])} ÷ ${n(s.lineaNP[1])} MΩ (manuale di installazione, Test 2).`,
    errori: [prat('Se il valore è uguale nei due versi c\'è una resistenza tra i conduttori (umidità, corto resistivo) che maschera i dispositivi.')],
  },
  rP: {
    strumento: 'Multimetro digitale in Ω, scala 200 Ω',
    preparazione: [SCOLLEGATO, prat('Prima di misurare, unire i due puntali e annotare la loro resistenza (di solito 0,1–0,5 Ω): va sottratta.')],
    esecuzione: [prat('Un puntale sul + del ramo A, l\'altro sul + del ramo B.')],
    atteso: (s) => `Circa uguale al negativo; totale + e − sotto ${s.rLoopMaxOhm} Ω.`,
    errori: [prat('Lettura che varia toccando i morsetti: morsetto allentato.'), prat('OL: conduttore interrotto o isolatore aperto.')],
  },
  rN: {
    strumento: 'Multimetro digitale in Ω, scala 200 Ω',
    preparazione: [SCOLLEGATO, prat('Sottrarre la resistenza dei puntali (misurata a puntali uniti).')],
    esecuzione: [am('I terminali del multimetro vanno collegati ai capi del cavo negativo: − del ramo A e − del ramo B.')],
    atteso: (s) => `Al massimo ${s.rNegMaxOhm} Ω. Il totale del loop è circa 2 × negativo (massimo ${s.rLoopMaxOhm} Ω).`,
    errori: [prat('Valore molto più alto del previsto per la lunghezza: giunzioni ossidate o morsetti allentati.')],
  },
  rC: {
    strumento: 'Multimetro digitale in Ω, scala 200 Ω',
    preparazione: [SCOLLEGATO, am('Calza scollegata dalla terra in centrale.')],
    esecuzione: [prat('Un puntale sulla calza del ramo A, l\'altro sulla calza del ramo B.')],
    atteso: (s) => `Circa ${s.calzaSuNegativo[0]}–${s.calzaSuNegativo[1]} volte la resistenza del negativo (manuale POL-200-TS).`,
    errori: [prat('OL: calza non giuntata in una scatola o in una base.')],
  },
  cap: {
    strumento: 'POL-200-TS, funzione Multimetro (oppure capacimetro)',
    preparazione: [
      pol('Loop scollegato dai morsetti della centrale e centrale spenta prima di collegare il POL.'),
      pol('Batteria del POL carica: con la carica insufficiente le misure risultano alterate.'),
    ],
    esecuzione: [pol('Dal menù principale aprire Multimetro e visualizzare i valori di resistenza, induttanza, capacità e terra.')],
    atteso: (s) => `Inferiore a ${n(s.capacitaMaxUF)} μF (500 nF).`,
    errori: [prat('Capacità alta: cavo non twistato o non schermato, oppure tratte di cavo in più non previste.')],
  },
  vRit: {
    strumento: 'POL-200-TS, funzione Multimetro, range 24 V',
    preparazione: [
      pol('Loop scollegato dalla centrale e centrale spenta.'),
      pol('Inizio del loop (ramo A, verso il primo dispositivo) ai connettori di destra «Uscita loop»; ritorno (ramo B) ai connettori di sinistra «Ingresso / Ritorno». Collegare anche la terra.'),
      pol('Batteria del POL carica.'),
    ],
    esecuzione: [
      pol('Aprire Multimetro e verificare le tensioni e i consumi per i range 0 V, 5 V e 24 V.'),
      pol('Leggere «V ritorno» con il range 24 V: è la tensione che torna dopo aver percorso tutto il loop.'),
      pol('Con il range 5 V non ci deve essere consumo: se c\'è, cercare raccordi o induzioni sulla linea.'),
    ],
    atteso: (s) => `Almeno ${s.vRitornoMinV} V. Sotto = resistenza del loop troppo alta.`,
    errori: [pol('Nessun dispositivo o valori strani: verificare che il loop sia collegato all\'ingresso giusto del POL.')],
  },
  vLin: {
    strumento: 'Multimetro digitale in Vcc',
    preparazione: [am('Loop ricollegato alla centrale e centrale alimentata.'), am('Nessun punto programmato: la centrale non interroga i dispositivi (prima dell\'auto-riconoscimento).')],
    esecuzione: [prat('Puntale rosso sul + e nero sul − in uscita della linea, sulla morsettiera della scheda.')],
    atteso: (s) => `24 Vcc. Sotto ${s.vLineaMinV} V = inversione nei collegamenti di sensori o moduli.`,
    errori: [pol('Il POL-200-TS segnala anche il cablaggio a polarità inversa con l\'icona dedicata.')],
  },
};

/** Suggerimenti per i passi che non sono misure. */
export const GUIDE_PASSI: Record<string, Consiglio[]> = {
  sintomo: [
    am('Il LED giallo «Dispersione a terra» è acceso fisso con il positivo o il negativo a terra.'),
    am('Nella scheda GST ZONA, premendo invio, si vede la lista dei dispositivi in guasto con il tipo di guasto; i guasti di centrale sono in GST CENTRALE.'),
    prat('Annotare il testo esatto del display (si può scrivere nel campo qui sotto) e, se possibile, fotografarlo.'),
  ],
  cavo: [
    am('La lunghezza è quella totale del loop, dai morsetti di uscita a quelli di ingresso in centrale (anello completo).'),
    am('Cavo a 2 conduttori twistato a passo stretto (5–10 cm) e schermato.'),
    prat('Se la lunghezza non è nota, si può stimare dalla resistenza del negativo e dalla sezione (pulsante «Stima»).'),
  ],
  pol: [
    pol('Collegare il POL con la centrale spenta e il loop scollegato dai morsetti della centrale.'),
    pol('Primo dispositivo del loop (ramo A) ai connettori di destra, ritorno (ramo B) ai connettori di sinistra.'),
    pol('Il carattere «?» indica un problema del dispositivo o della linea; «-» può indicare un indirizzo doppio.'),
  ],
  riconoscimento: [
    am('Menù Punti → Auto-riconoscimento: inserire il numero di CPU e attivare «Verifica doppi indirizzi» = SI.'),
    am('Con il tasto PROT si passa dal riepilogo ADV a quello CLIP.'),
    am('Prima di premere CONF controllare i MAN: confermando vengono rimossi dalla programmazione, mentre NUO e INC vengono reinizializzati con i dati di default.'),
  ],
};

export const ETICHETTA_FONTE: Record<Fonte, string> = {
  'AM-8200N': 'Manuale AM-8200N',
  'POL-200-TS': 'Manuale POL-200-TS',
  pratica: 'Buona pratica',
};
