import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { NcsDB } from '../src/db/db';
import { creaCentrale, creaImpianto, leggiImpostazioni, salvaImpostazioni } from '../src/db/repo';
import { ArchivioBloccatoError } from '../src/db/cifratura';
import { blocca, cambiaPassword, creaPassword, eliminaTuttiIDati, sblocca, statoArchivio } from '../src/security/sessione';
import { ITER_TEST } from './helpers';

/** Legge i record così come sono su disco, senza decifrare. */
async function grezzi(nome: string, tabella: string) {
  const raw = new Dexie(nome);
  await raw.open(); // apre lo schema esistente senza dichiararlo
  const r = await raw.table(tabella).toArray();
  raw.close();
  return r;
}

const nomeDb = () => 'cif-' + Math.random();

describe('archivio cifrato', () => {
  it('primo avvio: nuovo → crea password → sbloccato; su disco nessun dato in chiaro', async () => {
    const nome = nomeDb();
    const d = new NcsDB(nome);
    expect(await statoArchivio(d)).toBe('nuovo');
    await creaPassword('password-cantiere', d, ITER_TEST);
    expect(await statoArchivio(d)).toBe('sbloccato');

    const imp = await creaImpianto({ cliente: 'Ospedale Riservato', indirizzo: 'Via Segreta 1' }, d);
    await creaCentrale(imp.id, { firmware: 'FW-SEGRETO' }, d);
    await salvaImpostazioni({ claudeApiKey: 'sk-ant-SEGRETA' }, d);

    // attraverso l'app: in chiaro
    expect((await d.impianti.get(imp.id))!.cliente).toBe('Ospedale Riservato');
    expect((await leggiImpostazioni(d)).claudeApiKey).toBe('sk-ant-SEGRETA');

    // su disco: cifrato
    d.close();
    for (const t of ['impianti', 'centrali', 'impostazioni']) {
      const testo = JSON.stringify(await grezzi(nome, t), (_k, v) => (v instanceof Uint8Array ? `[${v.length} byte]` : v));
      expect(testo).not.toMatch(/Riservato|Segreta|SEGRET/);
    }
    const [r] = await grezzi(nome, 'impianti');
    expect(Object.keys(r).sort()).toEqual(['__c', 'data', 'id', 'modificato']);
  });

  it('bloccato: niente letture né scritture; sblocco con la password giusta', async () => {
    const nome = nomeDb();
    const d = new NcsDB(nome);
    await creaPassword('password-cantiere', d, ITER_TEST);
    const imp = await creaImpianto({ cliente: 'Cliente X' }, d);
    blocca(d);
    expect(await statoArchivio(d)).toBe('bloccato');
    await expect(d.impianti.get(imp.id)).rejects.toThrow(ArchivioBloccatoError);
    await expect(creaImpianto({}, d)).rejects.toThrow();
    expect(await sblocca('password-sbagliata', d)).toBe(false);
    expect(await sblocca('password-cantiere', d)).toBe(true);
    expect((await d.impianti.get(imp.id))!.cliente).toBe('Cliente X');
  });

  it('riapertura (nuova istanza = app riavviata) e cambio password', async () => {
    const nome = nomeDb();
    const d = new NcsDB(nome);
    await creaPassword('prima-password', d, ITER_TEST);
    await creaImpianto({ cliente: 'Persistente' }, d);
    d.close();

    const d2 = new NcsDB(nome);
    expect(await statoArchivio(d2)).toBe('bloccato');
    expect(await sblocca('prima-password', d2)).toBe(true);
    expect(await cambiaPassword('errata-errata', 'seconda-password', d2)).toBe(false);
    expect(await cambiaPassword('prima-password', 'seconda-password', d2)).toBe(true);
    blocca(d2);
    expect(await sblocca('prima-password', d2)).toBe(false);
    expect(await sblocca('seconda-password', d2)).toBe(true);
    expect((await d2.impianti.toArray())[0].cliente).toBe('Persistente');
  });

  it('i dati creati prima del login (in chiaro, foto come Blob) vengono cifrati', async () => {
    const nome = nomeDb();
    // database della versione 1, senza cifratura
    const v1 = new Dexie(nome);
    v1.version(1).stores({
      impianti: 'id, cliente, data, modificato', centrali: 'id, impiantoId', reti: 'impiantoId',
      loops: 'id, centraleId, [centraleId+numero]', sessioni: 'id, loopId, inizio',
      foto: 'id, impiantoId, sessioneId', impostazioni: 'id',
    });
    await v1.table('impianti').add({ id: 'i1', cliente: 'Vecchio Cliente', data: '2026-11-01', modificato: '' });
    await v1.table('foto').add({ id: 'f1', impiantoId: 'i1', mime: 'image/png', dati: new Blob([new Uint8Array([5, 6])], { type: 'image/png' }) });
    v1.close();

    const d = new NcsDB(nome);
    await creaPassword('password-cantiere', d, ITER_TEST);
    expect((await d.impianti.get('i1'))!.cliente).toBe('Vecchio Cliente');
    expect(Array.from((await d.foto.get('f1'))!.dati)).toEqual([5, 6]);
    d.close();
    expect(JSON.stringify(await grezzi(nome, 'impianti'))).not.toContain('Vecchio');
  });

  it('each() e where() funzionano attraverso la cifratura', async () => {
    const d = new NcsDB(nomeDb());
    await creaPassword('password-cantiere', d, ITER_TEST);
    const imp = await creaImpianto({ cliente: 'A' }, d);
    await creaCentrale(imp.id, { nome: 'Uno' }, d);
    await creaCentrale(imp.id, { nome: 'Due' }, d);
    const nomi: string[] = [];
    await d.centrali.each((c) => nomi.push(c.nome));
    expect(nomi.sort()).toEqual(['Due', 'Uno']);
    expect(await d.loops.where('[centraleId+numero]').between([(await d.centrali.toArray())[0].id, 0], [(await d.centrali.toArray())[0].id, 99]).count()).toBe(2);
    await d.centrali.where('impiantoId').equals(imp.id).modify({ firmware: '1.2' });
    expect((await d.centrali.toArray()).every((c) => c.firmware === '1.2')).toBe(true);
  });

  it('password dimenticata: elimina tutto e si riparte da zero', async () => {
    const nome = nomeDb();
    const d = new NcsDB(nome);
    await creaPassword('password-cantiere', d, ITER_TEST);
    await creaImpianto({ cliente: 'Da cancellare' }, d);
    await eliminaTuttiIDati(d);
    const d2 = new NcsDB(nome);
    expect(await statoArchivio(d2)).toBe('nuovo');
  });
});
