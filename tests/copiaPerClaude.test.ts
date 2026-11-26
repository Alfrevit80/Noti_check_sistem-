import { describe, expect, it } from 'vitest';
import testoMnt from './dati/26112600.MNT?raw';
import { grigliaCompatta, leggiRispostaGriglia, testoDiagnosi, testoLetturaFoto } from '../src/ai/copiaPerClaude';
import { leggiMnt, letturaDaMnt } from '../src/import/mnt';
import { IMPOSTAZIONI_PREDEFINITE } from '../src/settings/defaults';
import { iso, loop, m, sessione } from './fixtures';
import { SENSORI_A_REALE } from './fixturesPol';

describe('testo per la diagnosi', () => {
  const l = letturaDaMnt(leggiMnt(testoMnt, '26112600.MNT'), 'A', 'l', '2026-11-26T09:00:00Z');
  const s = sessione({
    sintomo: { tipo: 'dispersione', ramo: 'A', descrizione: 'GUASTO TERRA NEG', ora: '' },
    misure: [...iso('A', { nT: 0.3 }), m('loop', 'rN', 12.1)],
    letture: [l],
    eventi: [{ id: 'e', ora: '2026-11-26T09:30:00Z', testo: 'Scatola umida al piano 2', automatico: false }],
  });
  const t = testoDiagnosi(s, loop({ numero: 2, protocollo: 'ADV' }), undefined, IMPOSTAZIONI_PREDEFINITE);

  it('contiene istruzioni, dati, mappatura, note e anomalie già trovate', () => {
    expect(t).toContain('Rispondi in italiano');
    expect(t).toContain('display: "GUASTO TERRA NEG"');
    expect(t).toContain('Isolamento negativo verso terra, ramo A: 0,3 MΩ');
    expect(t).toContain('Centrale > S2 > S1 > S4');
    expect(t).toContain('Scatola umida al piano 2');
    expect(t).toContain('[alta] Dispersione verso terra sul negativo');
  });
  it('non contiene dati del cliente', () => {
    expect(t).not.toMatch(/Cliente|Indirizzo:/);
  });
});

describe('lettura della foto tramite Claude', () => {
  it('griglia compatta', () => {
    expect(grigliaCompatta({ 1: 'OT', 2: 'OT', 3: 'OT', 5: '??' })).toBe('OT: 1–3 · ??: 5');
  });
  it('richiesta con il formato da usare', () => {
    expect(testoLetturaFoto('sensori')).toContain('DUBBI');
  });
  it('legge la risposta: sezioni, intervalli, dubbi, testo sporco', () => {
    const r = leggiRispostaGriglia('```\nSENSORI\n1-4 OT\n- 19 ??\n40: ot, 41 ot\nMODULI\n2 SS\n7 PI\nDUBBI\nS36, M7, 40\nboh\n```');
    expect(r.sensori).toEqual({ 1: 'OT', 2: 'OT', 3: 'OT', 4: 'OT', 19: '??', 40: 'ot', 41: 'ot' });
    expect(r.moduli).toEqual({ 2: 'SS', 7: 'PI' });
    expect(r.dubbi).toEqual({ sensori: [36, 40], moduli: [7] }); // 40 senza prefisso: è nei sensori
  });
  it('andata e ritorno con la griglia reale', () => {
    const testo = 'SENSORI\n' + grigliaCompatta(SENSORI_A_REALE).split(' · ').flatMap((p) => {
      const [sigla, nn] = p.split(': ');
      return nn.split(', ').map((x) => `${x.replace('–', '-')} ${sigla}`);
    }).join('\n');
    expect(leggiRispostaGriglia(testo).sensori).toEqual(SENSORI_A_REALE);
  });
});
