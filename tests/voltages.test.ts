import { describe, expect, it } from 'vitest';
import { analizzaTensioni } from '../src/analysis/voltages';
import { S, codici, m } from './fixtures';

describe('tensioni', () => {
  it('tensione residua bassa: ok', () => {
    expect(analizzaTensioni([m('A', 'vRes', 0.2)], S)).toEqual([]);
  });

  it('tensione residua alta: avviso di scaricare la linea', () => {
    const r = analizzaTensioni([m('A', 'vRes', 12)], S);
    expect(codici(r)).toEqual(['TENSIONE_RESIDUA_A']);
    expect(r[0].doveIntervenire.join(' ')).toMatch(/Scaricare/);
  });

  it('misure in Ω dopo una tensione residua alta vanno ripetute', () => {
    const r = analizzaTensioni([m('A', 'vRes', 12), m('A', 'pT', 'OL'), m('loop', 'rP', 10)], S);
    expect(codici(r)).toEqual(['TENSIONE_RESIDUA_A', 'OHM_DA_RIPETERE_A']);
  });

  it('dopo aver scaricato la linea (nuova misura bassa) nessun avviso', () => {
    expect(analizzaTensioni([m('A', 'vRes', 12), m('A', 'vRes', 0), m('A', 'pT', 'OL')], S)).toEqual([]);
  });

  it('tensione di ritorno sotto 17 V = resistenza di linea troppo alta', () => {
    expect(codici(analizzaTensioni([m('loop', 'vRit', 16.2)], S))).toEqual(['TENSIONE_RITORNO_BASSA']);
    expect(analizzaTensioni([m('loop', 'vRit', 17)], S)).toEqual([]);
  });
});
