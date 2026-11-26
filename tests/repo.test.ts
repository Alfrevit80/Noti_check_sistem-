import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { NcsDB } from '../src/db/db';
import {
  aggiornaCentrale, creaCentrale, creaImpianto, creaSessione, eliminaImpianto,
  leggiImpostazioni, numeroLoopTotali, salvaImpostazioni, schedaDelLoop,
} from '../src/db/repo';

let d: NcsDB;
beforeEach(async () => {
  d = new NcsDB('test-' + Math.random());
  await d.open();
});

describe('centrali e loop', () => {
  it('conta i loop totali e la scheda di ciascuno', () => {
    const c = { loopBase: 2, espansioni: [{ modello: 'LIB-8200N', loop: 2 }, { modello: 'LIB-8200N', loop: 2 }] };
    expect(numeroLoopTotali(c)).toBe(6);
    expect(schedaDelLoop(c, 2)).toBe('CPU');
    expect(schedaDelLoop(c, 3)).toBe('LIB-8200N #1');
    expect(schedaDelLoop(c, 6)).toBe('LIB-8200N #2');
  });

  it('crea i loop alla creazione e aggiungendo espansioni, senza cancellarli', async () => {
    const imp = await creaImpianto({ cliente: 'Test' }, d);
    const c = await creaCentrale(imp.id, { loopBase: 2 }, d);
    expect(await d.loops.where('centraleId').equals(c.id).count()).toBe(2);
    await aggiornaCentrale(c.id, { espansioni: [{ modello: 'LIB-8200N', loop: 2 }] }, d);
    const loops = await d.loops.where('centraleId').equals(c.id).sortBy('numero');
    expect(loops.map((l) => l.scheda)).toEqual(['CPU', 'CPU', 'LIB-8200N #1', 'LIB-8200N #1']);
    await aggiornaCentrale(c.id, { espansioni: [] }, d);
    expect(await d.loops.where('centraleId').equals(c.id).count()).toBe(4); // conservati
  });

  it('eliminaImpianto rimuove tutto a cascata', async () => {
    const imp = await creaImpianto({}, d);
    const c = await creaCentrale(imp.id, {}, d);
    const l = (await d.loops.where('centraleId').equals(c.id).first())!;
    await creaSessione(l.id, d);
    await eliminaImpianto(imp.id, d);
    expect(await d.centrali.count()).toBe(0);
    expect(await d.loops.count()).toBe(0);
    expect(await d.sessioni.count()).toBe(0);
  });
});

describe('impostazioni', () => {
  it('predefinite e salvataggio parziale delle soglie', async () => {
    const s = await leggiImpostazioni(d);
    expect(s.soglie.rLoopMaxOhm).toBe(40);
    expect(s.modelliCentrale[0]).toBe('AM-8200N');
    await salvaImpostazioni({ soglie: { ...s.soglie, rLoopMaxOhm: 35 } }, d);
    expect((await leggiImpostazioni(d)).soglie.rLoopMaxOhm).toBe(35);
  });
});

describe('profili centrale', () => {
  it('una nuova AM-8200N nasce con 2 loop', async () => {
    const imp = await creaImpianto({}, d);
    const c = await creaCentrale(imp.id, {}, d);
    expect(c.modello).toBe('AM-8200N');
    expect(c.loopBase).toBe(2);
    expect(await d.loops.where('centraleId').equals(c.id).count()).toBe(2);
  });
});
