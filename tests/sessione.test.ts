import { describe, expect, it } from 'vitest';
import { analizzaSessione, esitoSuggerito, misureMancanti, testoEventoMisura } from '../src/analysis/sessione';
import { analizzaRiconoscimento } from '../src/analysis/riconoscimento';
import { S, codici, iso, loop, m, sessione } from './fixtures';

const completo = () => [...iso('A'), ...iso('B'), m('loop', 'rP', 12), m('loop', 'rN', 12)];

describe('sessione', () => {
  it('misure mancanti e esito suggerito', () => {
    const s = sessione();
    expect(misureMancanti(s)).toHaveLength(12);
    expect(esitoSuggerito([], s)).toBe('da_verificare');
    const ok = sessione({ misure: completo() });
    expect(misureMancanti(ok)).toEqual([]);
    expect(esitoSuggerito(analizzaSessione(ok, loop(), S), ok)).toBe('ok');
  });

  it('esito suggerito: alta → non conforme, media → con riserva', () => {
    const guasto = sessione({ misure: [...completo(), m('A', 'nT', 0.1)] });
    expect(esitoSuggerito(analizzaSessione(guasto, loop(), S), guasto)).toBe('non_conforme');
    const ridotto = sessione({ misure: [...completo(), m('A', 'nT', 5)] });
    expect(esitoSuggerito(analizzaSessione(ridotto, loop(), S), ridotto)).toBe('ok_con_riserva');
  });

  it('dispersione segnalata ma cavo buono', () => {
    const s = sessione({ misure: completo(), sintomo: { tipo: 'dispersione', ramo: 'A', descrizione: '', ora: '' } });
    expect(codici(analizzaSessione(s, loop(), S))).toEqual(['SINTOMO_DISPERSIONE_NON_TROVATA']);
  });

  it('loop aperto segnalato ma continuità buona', () => {
    const s = sessione({ misure: completo(), sintomo: { tipo: 'loop_aperto', ramo: 'non_noto', descrizione: '', ora: '' } });
    expect(codici(analizzaSessione(s, loop(), S))).toEqual(['SINTOMO_APERTO_CONTINUITA_OK']);
  });

  it('anomalie ordinate per gravità', () => {
    const s = sessione({ misure: [m('A', 'pT', 5), m('A', 'nT', 0.1)] });
    const g = analizzaSessione(s, loop(), S).map((a) => a.gravita);
    expect(g).toEqual([...g].sort((a, b) => ['critica', 'alta', 'media', 'bassa', 'info'].indexOf(a) - ['critica', 'alta', 'media', 'bassa', 'info'].indexOf(b)));
  });

  it('testo evento', () => {
    expect(testoEventoMisura('A', 'pT', 'OL')).toBe('Isolamento positivo verso terra — ramo A: OL');
    expect(testoEventoMisura('loop', 'rN', 11.5)).toBe('Resistenza del negativo da A a B: 11,5 Ω');
  });
});

describe('riconoscimento automatico', () => {
  const ric = (righe: { tipoDispositivo: string; nuo: number; inc: number; tot: number; man: number }[], ora = '2026-11-26T10:00:00Z') =>
    ({ id: 'r' + ora, ora, righe, nota: '' });

  it('MAN = 0, NUO = 0: nessuna anomalia', () => {
    expect(analizzaRiconoscimento([ric([{ tipoDispositivo: 'Sensori', nuo: 0, inc: 0, tot: 40, man: 0 }])], loop())).toEqual([]);
  });

  it('mancanti, nuovi e INC', () => {
    const r = analizzaRiconoscimento([ric([{ tipoDispositivo: 'NFX(I)-OPT', nuo: 2, inc: 1, tot: 40, man: 3 }])], loop());
    expect(codici(r)).toEqual(['RIC_MANCANTI_NFX(I)-OPT', 'RIC_NUOVI_NFX(I)-OPT', 'RIC_INC_NFX(I)-OPT']);
    expect(r[0].gravita).toBe('alta');
    expect(r[2].spiegazione).toMatch(/PHOT.*THER/);
  });

  it('totale diverso da quello atteso del loop', () => {
    const r = analizzaRiconoscimento(
      [ric([{ tipoDispositivo: 'Sensori', nuo: 0, inc: 0, tot: 40, man: 0 }, { tipoDispositivo: 'Moduli', nuo: 0, inc: 0, tot: 5, man: 0 }])],
      loop({ totaleAttesoSensori: 42, totaleAttesoModuli: 5 }),
    );
    expect(codici(r)).toEqual(['RIC_TOTALE_DIVERSO']);
    expect(r[0].spiegazione).toMatch(/Mancano 2/);
  });

  it('vale l\'ultimo riconoscimento', () => {
    const vecchio = ric([{ tipoDispositivo: 'Sensori', nuo: 0, inc: 0, tot: 40, man: 3 }], '2026-11-26T09:00:00Z');
    const nuovo = ric([{ tipoDispositivo: 'Sensori', nuo: 0, inc: 0, tot: 43, man: 0 }], '2026-11-26T11:00:00Z');
    expect(analizzaRiconoscimento([nuovo, vecchio], loop())).toEqual([]);
  });
});

describe('riconoscimento: regole dal manuale', () => {
  const r1 = (x: { nuo: number; inc: number; tot: number; man: number }) =>
    analizzaRiconoscimento([{ id: 'r', ora: '', righe: [{ tipoDispositivo: 'M721', ...x }], nota: '' }], loop());
  it('TOT minore di NUO + INC = errore di trascrizione', () => {
    expect(codici(r1({ nuo: 3, inc: 1, tot: 2, man: 0 }))).toContain('RIC_TOT_INCOERENTE_M721');
  });
  it('avviso: CONF rimuove i MAN', () => {
    expect(r1({ nuo: 0, inc: 0, tot: 5, man: 1 })[0].doveIntervenire.join(' ')).toMatch(/CONF.*rimossi/);
  });
});
