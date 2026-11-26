// Schemi Zod usati per validare un file di progetto importato.
// Sono tolleranti: i campi mancanti ricevono un valore predefinito, così un file
// creato da una versione precedente dell'app si importa comunque.
import { z } from 'zod';

const str = z.string().catch('');
const optNum = z.number().finite().optional().catch(undefined);
const valore = z.union([z.number().finite(), z.literal('OL')]);
const griglia = z.record(z.string(), z.string()).catch({});

export const impiantoSchema = z.object({
  id: z.string().min(1),
  cliente: str,
  nomeImpianto: str,
  indirizzo: str,
  tecnico: str,
  data: str,
  note: str,
  creato: str,
  modificato: str,
});

export const centraleSchema = z.object({
  id: z.string().min(1),
  impiantoId: z.string().min(1),
  nome: str,
  modello: z.string().catch('AM-8200N'),
  nodoCpu: str,
  loopBase: z.number().int().min(0).catch(1),
  espansioni: z.array(z.object({ modello: str, loop: z.number().int().min(0).catch(1) })).catch([]),
  firmware: str,
  note: str,
});

const voceSchema = z.object({
  id: z.string(),
  testo: str,
  esito: z.enum(['si', 'no', 'na']).nullable().catch(null),
  nota: str,
  ora: z.string().optional(),
});

export const reteSchema = z.object({
  impiantoId: z.string().min(1),
  tipo: z.enum(['CANbus', 'RS485', 'Ethernet', 'Fibra', 'Altro']).catch('CANbus'),
  tipoAltro: str,
  topologia: z.enum(['Anello', 'Lineare', 'Stella', 'Altro']).catch('Anello'),
  centraliCollegate: z.array(z.string()).catch([]),
  statoBus: z.enum(['OK', 'Guasto', 'Intermittente', 'Non verificato']).catch('Non verificato'),
  checklist: z.array(voceSchema).catch([]),
  note: str,
});

const esitoLoop = z.enum(['da_verificare', 'ok', 'ok_con_riserva', 'non_conforme']).catch('da_verificare');

export const loopSchema = z.object({
  id: z.string().min(1),
  centraleId: z.string().min(1),
  numero: z.number().int().catch(1),
  scheda: str,
  descrizione: str,
  totaleAttesoSensori: optNum,
  totaleAttesoModuli: optNum,
  stile: z.enum(['aperto', 'chiuso']).optional().catch(undefined),
  protocollo: z.enum(['ADV', 'CLIP']).optional().catch(undefined),
  resistenzaLineaOhm: optNum,
  esito: esitoLoop,
  note: str,
});

const letturaSchema = z.object({
  id: z.string(),
  ramo: z.enum(['A', 'B', 'chiuso']),
  ora: str,
  origine: z.enum(['manuale', 'file', 'foto']).catch('manuale'),
  sensori: griglia,
  moduli: griglia,
  colori: z
    .object({
      sensori: z.record(z.string(), z.enum(['rosso', 'arancio', 'nero'])).catch({}),
      moduli: z.record(z.string(), z.enum(['rosso', 'arancio', 'nero'])).catch({}),
    })
    .optional()
    .catch(undefined),
  vRitorno: optNum,
  mappatura: z
    .array(
      z.object({
        ordine: z.number(),
        famiglia: z.enum(['sensore', 'modulo']),
        indirizzo: z.number(),
        tipo: str,
        derivazione: optNum,
      }),
    )
    .optional(),
  dettagli: z
    .array(
      z.object({
        famiglia: z.enum(['sensori', 'moduli']),
        indirizzo: z.number(),
        tipoCodice: str,
        tipoNome: str,
        costruttore: str,
        seriale: str,
        dataProd: str,
        pw: z.array(z.number()).catch([]),
        corrente: optNum,
        correnteIniziale: optNum,
        sta: z.string().optional(),
        iso: z.string().optional(),
        dep: str,
      }),
    )
    .optional()
    .catch(undefined),
  infoFile: z.object({ software: z.string().optional(), database: z.string().optional() }).optional().catch(undefined),
  nomeFile: z.string().optional(),
  nota: str,
});

export const sessioneSchema = z.object({
  id: z.string().min(1),
  loopId: z.string().min(1),
  inizio: str,
  fine: z.string().optional(),
  strumento: z.string().catch('POL-200-TS'),
  tecnico: str,
  sintomo: z
    .object({
      tipo: z.enum(['dispersione', 'loop_aperto', 'corto', 'guasto', 'nessuno']),
      ramo: z.enum(['A', 'B', 'entrambi', 'non_noto']).catch('non_noto'),
      descrizione: str,
      ora: str,
    })
    .optional(),
  misure: z
    .array(
      z.object({
        id: z.string(),
        ramo: z.enum(['A', 'B', 'loop']),
        tipo: z.enum(['pT', 'nT', 'cT', 'pC', 'nC', 'pN', 'nP', 'rP', 'rN', 'rC', 'cap', 'vRes', 'vRit', 'vLin']),
        valore,
        ora: str,
        nota: str,
      }),
    )
    .catch([]),
  cavo: z.object({ lunghezzaM: optNum, sezioneMm2: optNum, tipo: str }).catch({ tipo: '' }),
  letture: z.array(letturaSchema).catch([]),
  riconoscimenti: z
    .array(
      z.object({
        id: z.string(),
        ora: str,
        righe: z.array(
          z.object({
            tipoDispositivo: str,
            nuo: z.number().catch(0),
            inc: z.number().catch(0),
            tot: z.number().catch(0),
            man: z.number().catch(0),
          }),
        ),
        fotoId: z.string().optional(),
        nota: str,
      }),
    )
    .catch([]),
  eventi: z
    .array(z.object({ id: z.string(), ora: str, testo: str, automatico: z.boolean().catch(false), rif: z.string().optional() }))
    .catch([]),
  esito: esitoLoop,
  attivitaDaEseguire: str,
  note: str,
});

export const fotoExportSchema = z.object({
  id: z.string().min(1),
  impiantoId: z.string().min(1),
  sessioneId: z.string().optional(),
  didascalia: str,
  ora: str,
  mime: z.string().catch('image/jpeg'),
  dataUrl: z.string().startsWith('data:'),
});

export const FORMATO_FILE = 'notifier-check-system/progetto';
export const VERSIONE_FILE = 1;

export const progettoSchema = z.object({
  formato: z.literal(FORMATO_FILE),
  versione: z.number().int().min(1).max(VERSIONE_FILE),
  esportato: str,
  impianto: impiantoSchema,
  centrali: z.array(centraleSchema).catch([]),
  rete: reteSchema.optional().nullable(),
  loops: z.array(loopSchema).catch([]),
  sessioni: z.array(sessioneSchema).catch([]),
  foto: z.array(fotoExportSchema).catch([]),
});

export type ProgettoFile = z.infer<typeof progettoSchema>;
export type FotoExport = z.infer<typeof fotoExportSchema>;
