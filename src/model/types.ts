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
export type TipoMisura = 'pT' | 'nT' | 'cT' | 'pC' | 'nC' | 'rP' | 'rN' | 'vRes' | 'vRit';

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

export type Griglia = Record<number, TipoCella>; // indirizzo → tipo (le celle vuote non sono presenti)

export interface NodoMappatura {
  ordine: number; // posizione fisica lungo il ramo
  famiglia: 'sensore' | 'modulo';
  indirizzo: number;
  tipo: TipoCella;
  derivazione?: number; // numero della derivazione (T) se il dispositivo non è sulla dorsale
}

export interface LetturaPol {
  id: Id;
  ramo: Ramo | 'chiuso'; // 'chiuso' = lettura a loop richiuso
  ora: string;
  origine: 'manuale' | 'file' | 'foto';
  sensori: Griglia;
  moduli: Griglia;
  vRitorno?: number;
  mappatura?: NodoMappatura[];
  nomeFile?: string;
  nota: string;
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
  riconoscimenti: Riconoscimento[];
  eventi: Evento[];
  esito: EsitoLoop;
  attivitaDaEseguire: string;
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
  soglie: Soglie;
  claudeApiKey: string;
  claudeModello: string;
}
