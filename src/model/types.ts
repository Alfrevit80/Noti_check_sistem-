// Modello dati di Notifier Check System.
// Tutte le date/ore sono stringhe ISO 8601 (new Date().toISOString()).

export type Id = string;

// ───────────────────────── Anagrafica ─────────────────────────

export interface Impianto {
  id: Id;
  cliente: string;
  nomeImpianto: string;
  indirizzo: string;
  tecnico: string;
  data: string; // data della verifica (YYYY-MM-DD)
  note: string;
  creato: string;
  modificato: string;
}

export interface Espansione {
  modello: string; // es. LIB-8200N
  loop: number; // loop aggiunti dalla scheda
}

export interface Centrale {
  id: Id;
  impiantoId: Id;
  nome: string; // descrizione libera, es. "Centrale piano terra"
  modello: string; // dalla lista modificabile, default AM-8200N
  nodoCpu: string; // numero CPU / indirizzo di rete
  loopBase: number;
  espansioni: Espansione[];
  firmware: string;
  note: string;
}

// ───────────────────────── Rete tra centrali ─────────────────────────

export type TipoComunicazione = 'CANbus' | 'RS485' | 'Ethernet' | 'Fibra' | 'Altro';
export type Topologia = 'Anello' | 'Lineare' | 'Stella' | 'Altro';
export type StatoBus = 'OK' | 'Guasto' | 'Intermittente' | 'Non verificato';

/** sì / no / non applicabile / da verificare */
export type EsitoVoce = 'si' | 'no' | 'na' | null;

export interface VoceChecklist {
  id: string; // chiave stabile (es. 'continuita') o 'custom-…'
  testo: string;
  esito: EsitoVoce;
  nota: string;
  ora?: string; // quando è stata compilata
}

export interface Rete {
  impiantoId: Id; // una rete per impianto (chiave primaria)
  tipo: TipoComunicazione;
  tipoAltro: string;
  topologia: Topologia;
  centraliCollegate: Id[];
  statoBus: StatoBus;
  checklist: VoceChecklist[];
  note: string;
}

// ───────────────────────── Loop e sessioni di verifica ─────────────────────────

export type EsitoLoop = 'da_verificare' | 'ok' | 'ok_con_riserva' | 'non_conforme';

export interface Loop {
  id: Id;
  centraleId: Id;
  numero: number; // numero del loop sulla centrale
  scheda: string; // es. "CPU" o "LIB-8200N #1"
  descrizione: string;
  totaleAttesoSensori?: number;
  totaleAttesoModuli?: number;
  // Programmazione della linea in centrale (Menù Sistema → Linea)
  stile?: 'aperto' | 'chiuso';
  protocollo?: 'ADV' | 'CLIP';
  resistenzaLineaOhm?: number; // "Resistenza di linea" impostata in centrale
  esito: EsitoLoop;
  note: string;
}

export type Ramo = 'A' | 'B';
export type TipoSintomo = 'dispersione' | 'loop_aperto' | 'corto' | 'guasto' | 'nessuno';

export interface Sintomo {
  tipo: TipoSintomo;
  ramo: Ramo | 'entrambi' | 'non_noto';
  descrizione: string;
  ora: string;
}

/**
 * Misure a cavo scollegato.
 *  isolamento:  pT = +/terra, nT = −/terra, cT = calza/terra, pC = +/calza, nC = −/calza
 *  resistenza:  rP = A+→B+, rN = A−→B−
 *  tensioni:    vRes = residua tra + e −, vRit = ritorno letta sul POL-200-TS
 */
export type TipoMisura =
  | 'pT' | 'nT' | 'cT' | 'pC' | 'nC' // isolamento
  | 'pN' | 'nP' // + / − con dispositivi collegati (tester + su +, poi invertito)
  | 'rP' | 'rN' | 'rC' // resistenza A→B di +, − e calza
  | 'cap' // capacità + / − (multimetro, μF)
  | 'vRes' | 'vRit' | 'vLin' // tensioni: residua, ritorno (POL), di linea (centrale alimentata)
  // Schermata Multimetro del POL-200-TS (kΩ e nF, come sul display; ">1000" = OL)
  | 'gPN' | 'gCP' | 'gCN' // guasto + / −, calza / +, calza / −
  | 'gTP' | 'gTN' | 'gTC' // guasto terra di +, − e calza
  | 'cPN' | 'cCP' | 'cCN'; // capacità + / −, calza / +, calza / −

/** Valore numerico oppure 'OL' (fuori scala = isolato / infinito). */
export type ValoreMisura = number | 'OL';

export interface Misura {
  id: Id;
  ramo: Ramo | 'loop'; // la resistenza A→B riguarda tutto il loop
  tipo: TipoMisura;
  valore: ValoreMisura;
  ora: string;
  nota: string;
}

export interface Cavo {
  lunghezzaM?: number;
  sezioneMm2?: number;
  tipo: string; // es. "2x1,5 schermato"
}

/** Tipi di cella della griglia POL. '' = vuota (nessuna risposta). */
export type TipoCella = 'OT' | 'O' | '??' | 'PI' | 'SS' | 'MM' | 'CM' | 'ISO' | string;

export type Griglia = Record<number, TipoCella>;
export type ColorePol = 'rosso' | 'arancio' | 'nero';
export type FamigliaPol = 'sensori' | 'moduli';

/** Sigla mostrata dal POL-200-TS nella griglia (configurabile nelle Impostazioni). */
export interface SiglaPol {
  codice: string; // come appare sul POL, maiuscole/minuscole comprese
  famiglia: FamigliaPol | 'entrambe';
  descrizione: string;
  puntoAllarme: boolean; // conta nei 32 punti (sensori e pulsanti)
} // indirizzo → tipo (le celle vuote non sono presenti)

export interface NodoMappatura {
  ordine: number; // posizione fisica lungo il ramo
  famiglia: 'sensore' | 'modulo';
  indirizzo: number;
  tipo: TipoCella;
  derivazione?: number; // numero della derivazione (T) se il dispositivo non è sulla dorsale
}

/** Riga di un file di manutenzione (.MNT) del POL-200-TS. */
export interface DispositivoMnt {
  famiglia: FamigliaPol;
  indirizzo: number;
  tipoCodice: string; // es. "020"
  tipoNome: string; // es. "OTTIC0(EU)"
  costruttore: string; // NOT, HON, MOR, XXX…
  seriale: string; // XXXXXXXX = non letto
  dataProd: string; // YY/WW
  pw: number[]; // PW1…PWn
  corrente?: number; // colonna I
  correnteIniziale?: number; // colonna I_I
  sta?: string;
  iso?: string; // Y / N / X
  dep: string; // dispositivo da cui dipende verso la centrale: "S002", "M004", "PNL" o "" (non mappato)
}

export interface LetturaPol {
  id: Id;
  ramo: Ramo | 'chiuso'; // 'chiuso' = lettura a loop richiuso
  ora: string;
  origine: 'manuale' | 'file' | 'foto';
  sensori: Griglia;
  moduli: Griglia;
  /** Colore della sigla sul display del POL (facoltativo: il significato non è documentato, salvo rosso = cambiato). */
  colori?: { sensori: Record<number, ColorePol>; moduli: Record<number, ColorePol> };
  vRitorno?: number;
  mappatura?: NodoMappatura[];
  /** Dati per dispositivo importati da un file .MNT (con la dipendenza DEP = mappatura fisica). */
  dettagli?: DispositivoMnt[];
  infoFile?: { software?: string; database?: string };
  /** Celle lette da una foto (tramite Claude) che il tecnico deve ancora confermare. */
  daVerificare?: { sensori: number[]; moduli: number[] };
  nomeFile?: string;
  /** Modalità di lettura impostata sul POL-200-TS. */
  modalita?: 'ADV' | 'CLIP' | 'CLIP&ADV';
  nota: string;
}

/** Un campione del registro nel tempo (.DAT) del POL-200-TS. */
export interface CampioneDat {
  ora: string; // ISO
  famiglia: FamigliaPol;
  indirizzo: number;
  risponde: boolean; // false = "-" (nessuna risposta)
  pw: number[];
  corrente?: number;
  correnteIniziale?: number;
  sta?: string;
}

export interface RegistroPol {
  id: Id;
  ramo: Ramo | 'chiuso';
  nomeFile: string;
  importato: string;
  campioni: CampioneDat[];
}

export interface RigaRiconoscimento {
  tipoDispositivo: string; // es. "Sensori ottici", "Moduli"
  nuo: number;
  inc: number;
  tot: number;
  man: number;
}

export interface Riconoscimento {
  id: Id;
  ora: string;
  righe: RigaRiconoscimento[];
  fotoId?: Id;
  nota: string;
}

export interface Evento {
  id: Id;
  ora: string;
  testo: string;
  automatico: boolean; // generato dall'app (es. "Registrata misura +/terra ramo A")
  rif?: Id; // misura o riconoscimento a cui si riferisce (eliminandoli si elimina anche l'evento)
}

export interface Sessione {
  id: Id;
  loopId: Id;
  inizio: string;
  fine?: string;
  strumento: string; // POL-200-TS
  tecnico: string;
  sintomo?: Sintomo;
  misure: Misura[];
  cavo: Cavo;
  letture: LetturaPol[];
  registri?: RegistroPol[];
  riconoscimenti: Riconoscimento[];
  eventi: Evento[];
  esito: EsitoLoop;
  attivitaDaEseguire: string;
  /** Risposta di Claude incollata dal tecnico (diagnosi assistita). */
  diagnosiClaude?: { testo: string; ora: string };
  note: string;
}

export interface Foto {
  id: Id;
  impiantoId: Id;
  sessioneId?: Id;
  didascalia: string;
  ora: string;
  mime: string;
  dati: Uint8Array; // byte dell'immagine (cifrati su disco insieme al resto del record)
}

// ───────────────────────── Impostazioni ─────────────────────────

export interface RigaSezione {
  lunghezzaMaxM: number; // fino a questa lunghezza…
  sezioneMinMm2: number; // …basta questa sezione
}

export interface Soglie {
  isolamentoMinMOhm: number; // sotto = dispersione
  isolamentoAttenzioneMOhm: number; // sotto = da tenere d'occhio
  rLoopMaxOhm: number; // 40 Ω totali
  rNegMaxOhm: number; // 20 Ω sul negativo
  vRitornoMinV: number; // 17 V
  vResiduaMaxV: number; // sopra = scaricare la linea prima di misurare in Ω
  maxDispositiviLoopAperto: number; // 32
  tabellaSezioni: RigaSezione[];
  lunghezzaMaxM: number; // 3000 m
  capacitaMaxUF: number; // 0,5 μF
  vLineaMinV: number; // sotto: inversione dei collegamenti (14 V)
  lineaPN: [number, number]; // MΩ, tester + su + (1 ÷ 1,3)
  lineaNP: [number, number]; // MΩ, tester + su − (0,7 ÷ 0,9)
  calzaSuNegativo: [number, number]; // rapporto resistenza calza / negativo (circa 2 ÷ 3)
  versione?: number; // versione dei valori predefiniti (per aggiornare quelli non modificati)
}

/** Configurazione tipica di un modello di centrale (per i valori predefiniti e i controlli). */
export interface ProfiloCentrale {
  loopBase: number; // loop sulla scheda madre
  loopMax: number; // loop massimi con le espansioni
}

export interface Impostazioni {
  id: 'app';
  tecnicoPredefinito: string;
  strumentoPredefinito: string;
  modelliCentrale: string[];
  profiliCentrale: Record<string, ProfiloCentrale>; // chiave = modello
  modelliEspansione: string[];
  sigle: SiglaPol[];
  soglie: Soglie;
  claudeApiKey: string;
  claudeModello: string;
}
