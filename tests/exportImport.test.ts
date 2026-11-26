import { beforeEach, describe, expect, it } from 'vitest';
import type { NcsDB } from '../src/db/db';
import { dbDiTest, ITER_TEST } from './helpers';
import { creaCentrale, creaImpianto, creaSessione, nuovaRete, salvaRete } from '../src/db/repo';
import {
  ErroreImport, bytesToDataUrl, dataUrlToBytes, decifraFile, esportaFileCifrato, esportaProgetto, importaProgetto,
  leggiFile, leggiFileProgetto, nomeFileExport,
} from '../src/db/exportImport';

let d: NcsDB;
beforeEach(async () => {
  d = await dbDiTest();
});

async function impiantoCompleto() {
  const imp = await creaImpianto({ cliente: 'Ospedale Città', nomeImpianto: 'Padiglione B' }, d);
  const c1 = await creaCentrale(imp.id, { loopBase: 2 }, d);
  const c2 = await creaCentrale(imp.id, { loopBase: 1 }, d);
  await salvaRete({ ...nuovaRete(imp.id), centraliCollegate: [c1.id, c2.id] }, d);
  const loop = (await d.loops.where('centraleId').equals(c1.id).first())!;
  const s = await creaSessione(loop.id, d);
  await d.sessioni.update(s.id, { misure: [{ id: 'm1', ramo: 'A', tipo: 'pT', valore: 'OL', ora: '', nota: '' }] });
  await d.foto.add({
    id: 'f1', impiantoId: imp.id, sessioneId: s.id, didascalia: 'Sommario', ora: '', mime: 'image/png',
    dati: new Uint8Array([1, 2, 3, 250]),
  });
  return imp;
}

describe('byte ↔ data URL', () => {
  it('andata e ritorno', () => {
    const url = bytesToDataUrl(new Uint8Array([0, 255, 10]), 'image/jpeg');
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
    const r = dataUrlToBytes(url);
    expect(r.mime).toBe('image/jpeg');
    expect(Array.from(r.dati)).toEqual([0, 255, 10]);
  });
});

describe('export/import progetto', () => {
  it('esporta e reimporta come copia su un altro dispositivo', async () => {
    const imp = await impiantoCompleto();
    const file = await esportaProgetto(imp.id, d);
    const testo = JSON.stringify(file);

    const altro = await dbDiTest();
    const p = leggiFileProgetto(testo);
    const nuovoId = await importaProgetto(p, 'copia', altro);
    expect(nuovoId).not.toBe(imp.id);
    expect(await altro.centrali.count()).toBe(2);
    expect(await altro.loops.count()).toBe(3);
    const s = (await altro.sessioni.toArray())[0];
    expect(s.misure[0].valore).toBe('OL');
    const loop = await altro.loops.get(s.loopId);
    expect(loop).toBeDefined();
    const rete = await altro.reti.get(nuovoId);
    const idCentrali = (await altro.centrali.toArray()).map((c) => c.id).sort();
    expect([...rete!.centraliCollegate].sort()).toEqual(idCentrali);
    const f = (await altro.foto.toArray())[0];
    expect(f.sessioneId).toBe(s.id);
    expect(Array.from(f.dati)).toEqual([1, 2, 3, 250]);
  });

  it('sostituisci rimpiazza l\'impianto esistente senza duplicare', async () => {
    const imp = await impiantoCompleto();
    const file = await esportaProgetto(imp.id, d);
    file.impianto.note = 'aggiornato';
    file.centrali = file.centrali.filter((c) => c.loopBase === 2);
    await importaProgetto(leggiFileProgetto(JSON.stringify(file)), 'sostituisci', d);
    expect(await d.impianti.count()).toBe(1);
    expect((await d.impianti.get(imp.id))!.note).toBe('aggiornato');
    expect(await d.centrali.count()).toBe(1);
    expect(await d.loops.count()).toBe(2); // i loop della centrale tolta non restano orfani
  });

  it('file non valido, di altro tipo o di versione futura', () => {
    expect(() => leggiFileProgetto('ciao')).toThrow(ErroreImport);
    expect(() => leggiFileProgetto('{"a":1}')).toThrow(/non è un progetto/);
    expect(() => leggiFileProgetto(JSON.stringify({ formato: 'notifier-check-system/progetto', versione: 99 }))).toThrow(/più recente/);
  });

  it('campi mancanti ricevono valori predefiniti', () => {
    const p = leggiFileProgetto(JSON.stringify({
      formato: 'notifier-check-system/progetto', versione: 1,
      impianto: { id: 'x' },
      centrali: [{ id: 'c', impiantoId: 'x' }],
    }));
    expect(p.centrali[0].modello).toBe('AM-8200N');
    expect(p.loops).toEqual([]);
  });

  it('il nome del file non contiene il nome del cliente', () => {
    expect(nomeFileExport({ impianto: { id: 'ab12-cd34', cliente: 'Città & Co.', nomeImpianto: 'Pad. B', data: '2026-11-26' } as never }))
      .toBe('NCS_2026-11-26_AB12CD.json');
  });
});

describe('file esportato cifrato', () => {
  it('senza password non si legge nulla; con la password giusta si reimporta', async () => {
    const imp = await impiantoCompleto();
    const { testo, nome } = await esportaFileCifrato(imp.id, 'segreta-123', d, ITER_TEST);
    expect(nome).not.toContain('Ospedale');
    expect(testo).not.toContain('Ospedale');
    expect(testo).not.toContain('Padiglione');
    const letto = leggiFile(testo);
    expect(letto.cifrato).toBe(true);
    if (!letto.cifrato) return;
    await expect(decifraFile(letto.pacco, 'sbagliata')).rejects.toThrow(/Password errata/);
    const p = await decifraFile(letto.pacco, 'segreta-123');
    expect(p.impianto.cliente).toBe('Ospedale Città');
    expect(p.foto[0].dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('i file in chiaro delle versioni precedenti si importano ancora', async () => {
    const imp = await impiantoCompleto();
    const letto = leggiFile(JSON.stringify(await esportaProgetto(imp.id, d)));
    expect(letto.cifrato).toBe(false);
  });
});
