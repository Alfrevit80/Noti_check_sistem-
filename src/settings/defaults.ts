import type { Impostazioni, Soglie, VoceChecklist } from '../model/types';

// Valori di riferimento dal manuale AM-8200 (modificabili nelle Impostazioni).
// La tabella sezioni è indicativa: va adattata al cavo e alla corrente del loop.
export const SOGLIE_PREDEFINITE: Soglie = {
  isolamentoMinMOhm: 1,
  isolamentoAttenzioneMOhm: 20,
  rLoopMaxOhm: 40,
  rNegMaxOhm: 20,
  vRitornoMinV: 17,
  vResiduaMaxV: 1,
  maxDispositiviLoopAperto: 32,
  tabellaSezioni: [
    { lunghezzaMaxM: 1000, sezioneMinMm2: 1.0 },
    { lunghezzaMaxM: 1500, sezioneMinMm2: 1.5 },
    { lunghezzaMaxM: 2500, sezioneMinMm2: 2.5 },
    { lunghezzaMaxM: 3000, sezioneMinMm2: 4.0 },
  ],
};

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  id: 'app',
  tecnicoPredefinito: '',
  strumentoPredefinito: 'POL-200-TS',
  modelliCentrale: ['AM-8200N', 'AM-8200', 'AM-6000N', 'AM-2000N', 'AM-4000'],
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
