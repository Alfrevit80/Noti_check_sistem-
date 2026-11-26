import { describe, expect, it } from 'vitest';
import testoMnt from './dati/26112600.MNT?raw';
import { modelloLoop } from '../src/report/modello';
import { pdfLoop } from '../src/report/pdfLoop';
import { pdfImpianto } from '../src/report/pdfImpianto';
import { leggiMnt, letturaDaMnt } from '../src/import/mnt';
import { IMPOSTAZIONI_PREDEFINITE } from '../src/settings/defaults';
import type { Centrale, Impianto } from '../src/model/types';
import { iso, loop, m, sessione } from './fixtures';
import { lettura } from './fixturesPol';

const imp = IMPOSTAZIONI_PREDEFINITE;
const impianto: Impianto = { id: 'i', cliente: 'Magazzino Nord', nomeImpianto: 'Capannone 2', indirizzo: 'Via Roma 1', tecnico: 'Alfredo', data: '2026-11-26', note: '', creato: '', modificato: '' };
const centrale: Centrale = { id: 'c', impiantoId: 'i', nome: 'Centrale 1', modello: 'AM-8200N', nodoCpu: '1', loopBase: 2, espansioni: [], firmware: '3.1', note: '' };

function sessioneCompleta() {
  const A = letturaDaMnt(leggiMnt(testoMnt, '26112600.MNT'), 'A', 'la', '2026-11-26T09:00:00Z');
  const B = lettura('B', { 1: 'OT', 2: 'OT' }, {}, '2026-11-26T09:10:00Z');
  return sessione({
    inizio: '2026-11-26T08:30:00Z',
    tecnico: 'Alfredo',
    sintomo: { tipo: 'dispersione', ramo: 'A', descrizione: 'GUASTO TERRA NEG', ora: '' },
    misure: [...iso('A', { nT: 0.3 }), ...iso('B'), m('loop', 'rP', 11.8), m('loop', 'rN', 12.1)],
    cavo: { lunghezzaM: 900, sezioneMm2: 1.5, tipo: '2x1,5 schermato' },
    letture: [A, B],
    riconoscimenti: [{ id: 'r', ora: '2026-11-26T10:00:00Z', nota: '', righe: [{ tipoDispositivo: 'NFX(I)-OPT', nuo: 0, inc: 0, tot: 100, man: 2 }] }],
    eventi: [{ id: 'e', ora: '2026-11-26T09:30:00Z', testo: 'Sostituita base indirizzo 12', automatico: false }],
    attivitaDaEseguire: 'Ricercare dispersione sul negativo',
  });
}

describe('dati del rapportino del loop', () => {
  const md = modelloLoop(sessioneCompleta(), loop({ numero: 2 }), centrale, impianto, imp, []);

  it('intestazione e sintomo', () => {
    expect(md.intestazione).toMatchObject({ cliente: 'Magazzino Nord', impianto: 'Capannone 2', tecnico: 'Alfredo', strumento: 'POL-200-TS' });
    expect(md.intestazione.centrale).toContain('AM-8200N, CPU 1, FW 3.1');
    expect(md.intestazione.loop).toContain('Loop 2');
    expect(md.sintomo).toBe('Dispersione verso terra — ramo A («GUASTO TERRA NEG»)');
  });

  it('stato iniziale: griglie A e B combinate, moduli con il lato', () => {
    expect(md.iniziale!.totali.moduli).toBe(7);
    expect(md.iniziale!.tabellaModuli[0]).toEqual({ indirizzo: 2, sigla: 'SS', info: 'lato A' });
    expect(md.iniziale!.statiSensori[1]).toBe('doppio'); // loop interrotto: visto da A e da B = possibile doppio
  });

  it('misure colorate e altre tabelle', () => {
    const nT = md.isolamento.find((r) => r.etichetta === '− / terra')!;
    expect(nT.A).toEqual({ testo: '0,3 MΩ', stato: 'basso' });
    expect(nT.B).toEqual({ testo: 'OL', stato: 'ok' });
    expect(md.altreMisure.find((r) => r.etichetta === 'Resistenza di loop totale')!.valore.testo).toBe('23,9 Ω');
    expect(md.cavo).toContain('Sezione: 1,5 mm²');
  });

  it('mappatura, riconoscimento, analisi, cronologia, esito', () => {
    expect(md.mappatura!.percorso.startsWith('Centrale → S2 → S1 → S4')).toBe(true);
    expect(md.mappatura!.derivazioni).toContain('S75: S70-S71');
    expect(md.riconoscimento!.totali.man).toBe(2);
    expect(md.anomalie.some((a) => a.codice === 'ISO_TERRA_NEG_A')).toBe(true);
    expect(md.cronologia.map((e) => e.testo)).toContain('Sostituita base indirizzo 12');
    expect(md.esitoSuggerito).toBe('Non conforme');
    expect(md.chiusa).toBe(false);
  });
});

describe('generazione dei PDF', () => {
  it('rapportino del loop: definizione valida e PDF generato', async () => {
    const dd = pdfLoop(modelloLoop(sessioneCompleta(), loop({ numero: 2 }), centrale, impianto, imp, []));
    const testo = JSON.stringify(dd.content);
    for (const t of ['Rapportino di verifica loop', 'Stato iniziale', 'Misure a cavo scollegato', 'Mappatura (lato A)', 'Riconoscimento automatico', 'Analisi', 'Cronologia', 'Esito', 'Firma del cliente']) {
      expect(testo).toContain(t);
    }
    expect(testo).not.toContain('→'); // il font del PDF non ha la freccia
    const { default: pdfMake } = await import('pdfmake/build/pdfmake');
    const { default: vfs } = await import('pdfmake/build/vfs_fonts');
    (pdfMake as unknown as { vfs: unknown }).vfs = vfs;
    const buf: Uint8Array = await new Promise((ok) => (pdfMake as unknown as { createPdf: (d: unknown) => { getBuffer: (cb: (b: Uint8Array) => void) => void } }).createPdf(dd).getBuffer(ok));
    expect(new TextDecoder().decode(buf.slice(0, 5))).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(10_000);

  }, 30_000);

  it('riepilogo impianto', () => {
    const s = { ...sessioneCompleta(), loopId: 'l' };
    const dd = pdfImpianto({ impianto, centrali: [centrale], loops: [loop({ id: 'l', centraleId: 'c', esito: 'non_conforme' })], sessioni: [s], rete: null, impostazioni: imp });
    const testo = JSON.stringify(dd.content);
    expect(testo).toContain('Rapportino riepilogativo impianto');
    expect(testo).toContain('non conformi 1');
    expect(testo).toContain('Ricercare dispersione sul negativo');
  });
});
