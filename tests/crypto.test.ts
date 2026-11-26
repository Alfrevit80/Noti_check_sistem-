import { describe, expect, it } from 'vitest';
import {
  apriCassaforte, cambiaPasswordCassaforte, cifraOggetto, creaCassaforte, decifraConPassword, cifraConPassword,
  decifraOggetto, verificaRequisitiPassword,
} from '../src/security/crypto';
import nacl from 'tweetnacl';
import { ITER_TEST } from './helpers';

describe('cifratura', () => {
  it('oggetti con Uint8Array: andata e ritorno', () => {
    const k = nacl.randomBytes(32);
    const v = { a: 'Città', n: 1.5, ol: 'OL', foto: new Uint8Array([9, 8, 7]), nested: [{ x: null }] };
    const c = cifraOggetto(k, v);
    expect(new TextDecoder().decode(c)).not.toContain('Città');
    expect(decifraOggetto(k, c)).toEqual(v);
  });

  it('chiave sbagliata o dati alterati → errore', () => {
    const k = nacl.randomBytes(32);
    const c = cifraOggetto(k, { a: 1 });
    expect(() => decifraOggetto(nacl.randomBytes(32), c)).toThrow();
    c[c.length - 1] ^= 1;
    expect(() => decifraOggetto(k, c)).toThrow();
  });

  it('i Blob non vengono salvati per sbaglio in chiaro', () => {
    expect(() => cifraOggetto(nacl.randomBytes(32), { b: new Blob(['x']) })).toThrow(/Blob/);
  });
});

describe('cassaforte', () => {
  it('password giusta apre, sbagliata no', async () => {
    const { cassaforte, chiave } = await creaCassaforte('Cantiere2026!', ITER_TEST);
    expect(await apriCassaforte(cassaforte, 'Cantiere2026!')).toEqual(chiave);
    expect(await apriCassaforte(cassaforte, 'cantiere2026!')).toBeNull();
  });

  it('cambio password: stessa chiave dei dati, vecchia password non vale più', async () => {
    const { cassaforte, chiave } = await creaCassaforte('vecchia-pass', ITER_TEST);
    expect(await cambiaPasswordCassaforte(cassaforte, 'errata', 'nuova-pass')).toBeNull();
    const nuova = (await cambiaPasswordCassaforte(cassaforte, 'vecchia-pass', 'nuova-pass'))!;
    expect(await apriCassaforte(nuova, 'nuova-pass')).toEqual(chiave);
    expect(await apriCassaforte(nuova, 'vecchia-pass')).toBeNull();
  });

  it('requisiti minimi della password', () => {
    expect(verificaRequisitiPassword('corta')).toMatch(/8 caratteri/);
    expect(verificaRequisitiPassword('12345678')).toMatch(/cifre/);
    expect(verificaRequisitiPassword('1234567890')).toBeNull();
    expect(verificaRequisitiPassword('notifier8200')).toBeNull();
  });

  it('pacco cifrato con password', async () => {
    const p = await cifraConPassword('ciao', 'password-1', ITER_TEST);
    expect(await decifraConPassword(p, 'password-1')).toBe('ciao');
    expect(await decifraConPassword(p, 'password-2')).toBeNull();
  });
});
