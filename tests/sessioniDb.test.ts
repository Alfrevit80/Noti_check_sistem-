import { dbDiTest } from './helpers'; // per primo: carica fake-indexeddb
import { beforeEach, describe, expect, it } from 'vitest';
import type { NcsDB } from '../src/db/db';
import { creaCentrale, creaImpianto, creaSessione } from '../src/db/repo';
import {
  aggiungiNota, chiudiSessione, salvaCavo, cronologia, eliminaMisura, impostaSintomo, registraMisura, salvaRiconoscimento,
} from '../src/db/sessioni';

let d: NcsDB;
let sid: string;
let lid: string;
beforeEach(async () => {
  d = await dbDiTest();
  const imp = await creaImpianto({}, d);
  const c = await creaCentrale(imp.id, {}, d);
  lid = (await d.loops.where('centraleId').equals(c.id).first())!.id;
  sid = (await creaSessione(lid, d)).id;
});

describe('sessione di verifica', () => {
  it('ogni misura registrata crea un evento in cronologia; eliminandola sparisce anche l\'evento', async () => {
    const m1 = await registraMisura(sid, { ramo: 'A', tipo: 'pT', valore: 'OL' }, d);
    await registraMisura(sid, { ramo: 'loop', tipo: 'rN', valore: 11.5 }, d);
    let s = (await d.sessioni.get(sid))!;
    expect(s.misure).toHaveLength(2);
    expect(cronologia(s).map((e) => e.testo)).toEqual([
      'Isolamento positivo verso terra — ramo A: OL',
      'Resistenza del negativo da A a B: 11,5 Ω',
    ]);
    await eliminaMisura(sid, m1.id, d);
    s = (await d.sessioni.get(sid))!;
    expect(s.misure).toHaveLength(1);
    expect(s.eventi).toHaveLength(1);
  });

  it('sintomo: un solo evento, aggiornato se corretto', async () => {
    await impostaSintomo(sid, { tipo: 'dispersione', ramo: 'A', descrizione: '' }, d);
    await impostaSintomo(sid, { tipo: 'dispersione', ramo: 'B', descrizione: 'negativo' }, d);
    const s = (await d.sessioni.get(sid))!;
    expect(s.sintomo!.ramo).toBe('B');
    expect(s.eventi.map((e) => e.testo)).toEqual(['Sintomo segnalato dalla centrale: Dispersione verso terra (ramo B) — negativo']);
  });

  it('cavo: due salvataggi ravvicinati di campi diversi non si sovrascrivono', async () => {
    await Promise.all([salvaCavo(sid, { lunghezzaM: 1200 }, d), salvaCavo(sid, { sezioneMm2: 1.5 }, d)]);
    expect((await d.sessioni.get(sid))!.cavo).toMatchObject({ lunghezzaM: 1200, sezioneMm2: 1.5 });
  });

  it('la verifica prende il tecnico dell\'impianto', async () => {
    const imp = await creaImpianto({ tecnico: 'Mario Rossi' }, d);
    const c = await creaCentrale(imp.id, {}, d);
    const l = (await d.loops.where('centraleId').equals(c.id).first())!;
    expect((await creaSessione(l.id, d)).tecnico).toBe('Mario Rossi');
  });

  it('riconoscimento salvato e aggiornato con lo stesso evento', async () => {
    const id = await salvaRiconoscimento(sid, { righe: [{ tipoDispositivo: 'Sensori', nuo: 1, inc: 0, tot: 10, man: 0 }], nota: '' }, d);
    await salvaRiconoscimento(sid, { id, righe: [{ tipoDispositivo: 'Sensori', nuo: 0, inc: 0, tot: 11, man: 0 }], nota: '' }, d);
    const s = (await d.sessioni.get(sid))!;
    expect(s.riconoscimenti).toHaveLength(1);
    expect(s.eventi.map((e) => e.testo)).toEqual(['Riconoscimento automatico della centrale: TOT 11, NUO 0, INC 0, MAN 0']);
  });

  it('note manuali e chiusura: l\'esito passa al loop', async () => {
    await aggiungiNota(sid, 'Sostituita base indirizzo 12', d);
    await chiudiSessione(sid, 'ok_con_riserva', d);
    const s = (await d.sessioni.get(sid))!;
    expect(s.fine).toBeDefined();
    expect(cronologia(s).map((e) => e.automatico)).toEqual([false, true]);
    expect((await d.loops.get(lid))!.esito).toBe('ok_con_riserva');
  });
});
