import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { NcsDB } from '../src/db/db';
import { creaCentrale, creaImpianto, creaSessione, nuovaRete, salvaRete } from '../src/db/repo';
import {
  ErroreImport, blobToDataUrl, dataUrlToBlob, esportaProgetto, importaProgetto, leggiFileProgetto, nomeFileExport,
} from '../src/db/exportImport';

let d: NcsDB;
beforeEach(async () => {
  d = new NcsDB('test-' + Math.random());
  await d.open();
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
    dati: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/png' }),
  });
  return imp;
}

describe('blob ↔ data URL', () => {
  it('andata e ritorno', async () => {
    const url = await blobToDataUrl(new Blob([new Uint8Array([0, 255, 10])], { type: 'image/jpeg' }));
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
    const b = dataUrlToBlob(url);
    expect(Array.from(new Uint8Array(await b.arrayBuffer()))).toEqual([0, 255, 10]);
  });
});

describe('export/import progetto', () => {
  it('esporta e reimporta come copia su un altro dispositivo', async () => {
    const imp = await impiantoCompleto();
    const file = await esportaProgetto(imp.id, d);
    const testo = JSON.stringify(file);

    const altro = new NcsDB('altro-' + Math.random());
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
    expect(Array.from(new Uint8Array(await f.dati.arrayBuffer()))).toEqual([1, 2, 3, 250]);
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

  it('nome file pulito', () => {
    expect(nomeFileExport({ impianto: { cliente: 'Città & Co.', nomeImpianto: 'Pad. B', data: '2026-11-26' } as never }))
      .toBe('NCS_Citta-Co-Pad-B_2026-11-26.json');
  });
});
