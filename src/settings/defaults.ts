import type { Impostazioni, Soglie, VoceChecklist } from '../model/types';

// Valori dal Manuale di installazione AM-8200N (M-173.2, cap. 9) e dal manuale del POL-200-TS.
// Modificabili nelle Impostazioni.
export const VERSIONE_SOGLIE = 2;
export const SOGLIE_PREDEFINITE: Soglie = {
  isolamentoMinMOhm: 2, // "è richiesto un minimo di 2 MΩ di isolamento"
  isolamentoAttenzioneMOhm: 20, // "maggiore di 15÷20 MΩ, meglio se infinito"
  rLoopMaxOhm: 40, // resistenza totale della linea < 40 Ω
  rNegMaxOhm: 20, // negativo ≤ 20 Ω (totale = 2 × negativo)
  vRitornoMinV: 17, // POL-200-TS: V ritorno < 17 V = resistenza troppo alta
  vResiduaMaxV: 1,
  maxDispositiviLoopAperto: 32, // EN54: max 32 punti di allarme senza isolatori
  tabellaSezioni: [
    { lunghezzaMaxM: 500, sezioneMinMm2: 0.5 },
    { lunghezzaMaxM: 1000, sezioneMinMm2: 1 },
    { lunghezzaMaxM: 1500, sezioneMinMm2: 1.5 },
    { lunghezzaMaxM: 3000, sezioneMinMm2: 2.5 },
  ],
  lunghezzaMaxM: 3000,
  capacitaMaxUF: 0.5,
  vLineaMinV: 14,
  lineaPN: [1, 1.3],
  lineaNP: [0.7, 0.9],
  calzaSuNegativo: [2, 3],
  versione: VERSIONE_SOGLIE,
};

/** Valori predefiniti della versione 1 (prima dei manuali): se l'utente non li ha cambiati, si aggiornano. */
export const SOGLIE_V1: Partial<Soglie> = {
  isolamentoMinMOhm: 1,
  tabellaSezioni: [
    { lunghezzaMaxM: 1000, sezioneMinMm2: 1.0 },
    { lunghezzaMaxM: 1500, sezioneMinMm2: 1.5 },
    { lunghezzaMaxM: 2500, sezioneMinMm2: 2.5 },
    { lunghezzaMaxM: 3000, sezioneMinMm2: 4.0 },
  ],
};

/** Aggiorna le soglie salvate: i valori rimasti uguali ai vecchi predefiniti prendono i nuovi. */
export function aggiornaSoglie(salvate: Partial<Soglie> | undefined): Soglie {
  const s: Soglie = { ...SOGLIE_PREDEFINITE, ...salvate };
  if ((salvate?.versione ?? 1) < 2) {
    for (const [k, vecchio] of Object.entries(SOGLIE_V1) as [keyof Soglie, unknown][]) {
      if (JSON.stringify(salvate?.[k]) === JSON.stringify(vecchio)) (s as unknown as Record<string, unknown>)[k] = SOGLIE_PREDEFINITE[k];
    }
  }
  s.versione = VERSIONE_SOGLIE;
  return s;
}

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  id: 'app',
  tecnicoPredefinito: '',
  strumentoPredefinito: 'POL-200-TS',
  modelliCentrale: ['AM-8200N', 'AM-8200', 'AM-6000N', 'AM-2000N', 'AM-4000'],
  // Solo i modelli di cui conosciamo la configurazione; gli altri si aggiungono nelle Impostazioni.
  profiliCentrale: {
    'AM-8200N': { loopBase: 2, loopMax: 4 },
    'AM-8200': { loopBase: 2, loopMax: 4 },
  },
  modelliEspansione: ['LIB-8200N', 'LIB-8200'],
  soglie: SOGLIE_PREDEFINITE,
  claudeApiKey: '',
  claudeModello: 'claude-sonnet-5-5',
};

export const CHECKLIST_RETE_PREDEFINITA: Omit<VoceChecklist, 'esito' | 'nota'>[] = [
  { id: 'continuita', testo: 'Continuità del bus verificata su tutte le tratte' },
  { id: 'terminazioni', testo: 'Terminazioni presenti e corrette (solo agli estremi)' },
  { id: 'schermo', testo: 'Schermo del cavo bus collegato a terra in un solo punto' },
  { id: 'indirizzi', testo: 'Indirizzi di rete delle CPU univoci' },
  { id: 'comunicazione', testo: 'Tutte le CPU risultano in rete (nessun guasto comunicazione)' },
  { id: 'archivi', testo: 'Archivi allineati tra le CPU' },
  { id: 'orologio', testo: 'Data e ora sincronizzate tra le CPU' },
  { id: 'backup', testo: 'Backup della configurazione su USB eseguito' },
];

export function nuovaChecklistRete(): VoceChecklist[] {
  return CHECKLIST_RETE_PREDEFINITA.map((v) => ({ ...v, esito: null, nota: '' }));
}
