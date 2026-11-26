// Tipi HW riconosciuti dall'AM-8200N (Manuale di programmazione M-173.1-AM8200N-ITA Rev A.1, cap. 7 e 8.1).

export interface TipoHw {
  codice: string;
  descrizione: string;
  famiglia: 'sensore' | 'modulo';
  protocollo: 'ADV' | 'CLIP' | 'ADV/CLIP';
}

const s = (codice: string, descrizione: string, protocollo: TipoHw['protocollo']): TipoHw => ({ codice, descrizione, famiglia: 'sensore', protocollo });
const m = (codice: string, descrizione: string, protocollo: TipoHw['protocollo'] = 'ADV'): TipoHw => ({ codice, descrizione, famiglia: 'modulo', protocollo });

export const TIPI_HW: TipoHw[] = [
  // Sensori serie ADVANCED
  s('NFX(I)-OPT', 'Sensore ottico di fumo NFXI-OPT', 'ADV'),
  s('NFX(I)-TFIX58', 'Sensore termico NFXI-TFIX58', 'ADV'),
  s('NFX(I)-TFIX78', 'Sensore termico NFXI-TFIX78', 'ADV'),
  s('NFX(I)-TDIFF', 'Sensore termovelocimetrico NFXI-TDIFF', 'ADV'),
  s('NFX(I)-SMT2', 'Sensore combinato NFXI-SMT2', 'ADV'),
  s('NFX(I)-SMT3', 'Sensore combinato NFXI-SMT3', 'ADV'),
  s('IRX-751CTEM', 'Sensore combinato IRX-751CTEM-W SMART4', 'ADV'),
  s('NFX(I)-BEAM', 'Sensore lineare di fumo NFXI-BEAM', 'ADV'),
  s('NFX(I)-BEAM-T', 'Sensore lineare di fumo NFXI-BEAM', 'ADV'),
  s('NRX-OPT', 'Sensore ottico di fumo wireless NRX-OPT', 'ADV'),
  s('NRX-TFIX58', 'Sensore termico wireless NRX-TFIX58', 'ADV'),
  s('NRX-TDIFF', 'Sensore termovelocimetrico wireless NRX-TDIFF', 'ADV'),
  s('NRX-SMT3', 'Sensore combinato wireless NRX-SMT3', 'ADV'),
  // Sensori serie CLIP
  s('PHOT', 'Sensore ottico di fumo SDX751', 'CLIP'),
  s('ION', 'Sensore ionico di fumo', 'CLIP'),
  s('THER', 'Sensore termico FDX551REM', 'CLIP'),
  s('PINN', 'Sensore di fumo ad alta sensibilità "Laser" 7251', 'CLIP'),
  s('OMNI', 'Sensore combinato "Omni" SDX751TEM', 'CLIP'),
  // Moduli
  m('WMSS', 'Sirena + lampeggiante a parete'),
  m('WMSB', 'Lampeggiante a parete'),
  m('WMS', 'Sirena a parete'),
  m('DBSS', 'Base con sirena + lampeggiante'),
  m('DBS', 'Base con sirena'),
  m('WCP5A', 'Pulsante da esterno'),
  m('MCP5A', 'Pulsante da interno'),
  m('UDS', 'Pannello UDS-3N', 'CLIP'),
  m('ALW1', 'Alimentatore ALW1'),
  m('NRXI-GATE', 'Gateway wireless NRXI-GATE'),
  m('NRX-WPC', 'Pulsante manuale radio NRX-WCP'),
  m('NRX-REP', 'Ripetitore radio NRX-REP'),
  m('NFXI-RM6', 'Modulo 6 uscite (non supervisionate)'),
  m('NFXI-MM10', 'Modulo 10 ingressi'),
  m('MMX2E', 'Modulo di ingresso per zona convenzionale MMX2', 'CLIP'),
  m('MMX-1', 'Modulo di ingresso', 'CLIP'),
  m('MCX-55ME', 'Modulo 5 ingressi 5 uscite (non supervisionate)'),
  m('MCX-55M', 'Modulo 5 ingressi 5 uscite (non supervisionate)', 'CLIP'),
  m('M721', 'Modulo 2 ingressi 1 uscita (non supervisionata)'),
  m('M720', 'Modulo 2 ingressi'),
  m('M710CZR', 'Modulo di ingresso a sicurezza intrinseca'),
  m('M710CZ', 'Modulo di ingresso per sensori convenzionali'),
  m('M710', 'Modulo di ingresso'),
  m('M701-240', 'Modulo di uscita (carichi a 240 V)'),
  m('M701', 'Modulo di uscita'),
  m('MMX-10ME', 'Modulo 10 ingressi'),
  m('MMX-10M', 'Modulo 10 ingressi'),
  m('FL2022EI', 'FAAST a 2 canali'),
  m('FL2012EI', 'FAAST a un canale, un sensore'),
  m('FL2011EI', 'FAAST a un canale, due sensori'),
  m('CMX-1', 'Modulo di uscita', 'CLIP'),
  m('CMA22', 'Modulo 2 ingressi 2 uscite (seconda uscita supervisionata)'),
  m('CMA22C', 'Modulo 2 ingressi 2 uscite (seconda uscita supervisionata)'),
  m('CMA11E', 'Modulo 1 ingresso 1 uscita (supervisionata)'),
  m('CMA11', 'Modulo 1 ingresso 1 uscita (supervisionata)', 'CLIP'),
  m('CMX-10RME', 'Modulo 10 uscite relè'),
  m('CMX-10RM', 'Modulo 10 uscite relè', 'CLIP'),
];

const norm = (c: string) => c.toUpperCase().replace(/\s+/g, '');
export const cercaTipoHw = (codice: string) => TIPI_HW.find((t) => norm(t.codice) === norm(codice));

/** Limiti di indirizzamento (manuale, cap. 1-2). */
export const LIMITI_LINEA = {
  indirizziAdv: 159, // sensori 1-159 e moduli 1-159 per loop
  indirizziClip: 99, // CLIP: 1-99
  maxClipSuLineaAdv: 30, // una linea ADV gestisce al massimo 30 dispositivi CLIP
  subAddressPerLib: 700, // sub-address per LIB-8200N (2 loop)
  indirizzoReteMax: 32, // indirizzo della centrale sul CAN-BUS: 1-32
};
