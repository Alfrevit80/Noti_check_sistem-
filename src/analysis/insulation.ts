// Regole di analisi delle misure di isolamento (a cavo scollegato dalla centrale).
import type { Misura, Ramo, Soglie, ValoreMisura } from '../model/types';
import type { Anomalia } from './findings';
import { formattaValore, num, valoreUltima } from './misure';

export type StatoIsolamento = 'ok' | 'attenzione' | 'basso';

export function valutaIsolamento(v: ValoreMisura, s: Pick<Soglie, 'isolamentoMinMOhm' | 'isolamentoAttenzioneMOhm'>): StatoIsolamento {
  const n = num(v);
  if (n < s.isolamentoMinMOhm) return 'basso';
  if (n < s.isolamentoAttenzioneMOhm) return 'attenzione';
  return 'ok';
}

/** Passi per la ricerca di un guasto verso terra. */
export const PASSI_RICERCA_TERRA = [
  'Dividere la linea a metà (aprire una scatola di derivazione o scollegare un dispositivo a metà percorso) e rimisurare dalla centrale: se il valore torna normale il guasto è nel tratto scollegato, altrimenti in quello ancora collegato. Ripetere dimezzando il tratto guasto.',
  'Gli isolatori NON separano un guasto verso terra: per sezionare bisogna aprire fisicamente la linea.',
  'Sospetti tipici: scatole umide o con acqua, cavi spellati o schiacciati (passaggi su canaline, fascette, ingressi in quadri metallici), sirene e moduli con alimentazione esterna, contatti di macchine o quadri riferiti a terra collegati ai moduli.',
];

const fmt = (v: ValoreMisura) => formattaValore(v, 'MΩ');
const nomeCond = { pT: 'positivo (+)', nT: 'negativo (−)' } as const;

export function analizzaIsolamentoRamo(misure: readonly Misura[], ramo: Ramo, s: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  const v = {
    pT: valoreUltima(misure, ramo, 'pT'),
    nT: valoreUltima(misure, ramo, 'nT'),
    cT: valoreUltima(misure, ramo, 'cT'),
    pC: valoreUltima(misure, ramo, 'pC'),
    nC: valoreUltima(misure, ramo, 'nC'),
  };
  const st = (x: ValoreMisura | undefined) => (x === undefined ? undefined : valutaIsolamento(x, s));
  const sp = st(v.pT);
  const sn = st(v.nT);
  const R = `ramo ${ramo}`;

  // ── conduttori verso terra ──
  if (sp === 'basso' && sn !== 'basso') {
    out.push({
      codice: `ISO_TERRA_POS_${ramo}`,
      gravita: 'alta',
      titolo: `Dispersione verso terra sul positivo (${R}): ${fmt(v.pT!)}`,
      spiegazione: `Valore basso solo sul +${v.nT !== undefined ? ` (− / terra: ${fmt(v.nT)})` : ''}: il conduttore guasto è il positivo.`,
      doveIntervenire: PASSI_RICERCA_TERRA,
    });
  } else if (sn === 'basso' && sp !== 'basso') {
    out.push({
      codice: `ISO_TERRA_NEG_${ramo}`,
      gravita: 'alta',
      titolo: `Dispersione verso terra sul negativo (${R}): ${fmt(v.nT!)}`,
      spiegazione: `Valore basso solo sul −${v.pT !== undefined ? ` (+ / terra: ${fmt(v.pT)})` : ''}: il conduttore guasto è il negativo.`,
      doveIntervenire: PASSI_RICERCA_TERRA,
    });
  } else if (sp === 'basso' && sn === 'basso') {
    const p = num(v.pT!);
    const n = num(v.nT!);
    const min = Math.min(p, n);
    const max = Math.max(p, n);
    const distinguibile = min === 0 ? max > 0 : max / min >= 1.5;
    const piuBasso: 'pT' | 'nT' = p <= n ? 'pT' : 'nT';
    out.push({
      codice: `ISO_TERRA_ENTRAMBI_${ramo}`,
      gravita: 'alta',
      titolo: `Dispersione verso terra su entrambi i conduttori (${R}): + ${fmt(v.pT!)}, − ${fmt(v.nT!)}`,
      spiegazione: distinguibile
        ? `Di solito il guasto è su un solo conduttore e si vede anche sull'altro attraverso i dispositivi collegati. Il valore più basso indica il conduttore più probabile: il ${nomeCond[piuBasso]}.`
        : 'Valori simili sui due conduttori: non si distingue quale sia guasto. Possibile guasto su un dispositivo (tra + e terra e tra − e terra) o due guasti distinti.',
      doveIntervenire: PASSI_RICERCA_TERRA,
    });
  }
  for (const k of ['pT', 'nT'] as const) {
    if (st(v[k]) === 'attenzione') {
      out.push({
        codice: `ISO_TERRA_RIDOTTO_${k.toUpperCase()}_${ramo}`,
        gravita: 'media',
        titolo: `Isolamento ridotto del ${nomeCond[k]} verso terra (${R}): ${fmt(v[k]!)}`,
        spiegazione: `Sopra la soglia di guasto (${s.isolamentoMinMOhm} MΩ) ma sotto quella di attenzione (${s.isolamentoAttenzioneMOhm} MΩ): possibile inizio di dispersione (umidità, isolante danneggiato).`,
        doveIntervenire: ['Rimisurare dopo qualche ora o con clima diverso: se il valore scende, cercare il punto come per una dispersione.', ...PASSI_RICERCA_TERRA.slice(2)],
      });
    }
  }

  // ── calza verso terra ──
  const sc = st(v.cT);
  if (sc === 'basso' || sc === 'attenzione') {
    out.push({
      codice: `ISO_CALZA_TERRA_${ramo}`,
      gravita: sc === 'basso' ? 'alta' : 'media',
      titolo: `Calza verso terra ${sc === 'basso' ? 'bassa' : 'ridotta'} (${R}): ${fmt(v.cT!)}`,
      spiegazione:
        'Lo schermo tocca una massa metallica o è collegato a terra in più punti. Lo schermo va collegato a terra solo in centrale e deve essere continuo e isolato lungo tutta la linea.',
      doveIntervenire: [
        'Controllare le scatole di derivazione e le basi dei dispositivi: la calza deve essere giuntata e isolata, senza toccare viti, staffe o scatole metalliche.',
        'Controllare gli ingressi in quadri e carpenterie metalliche e i pressacavi.',
        'Dividere la linea a metà e rimisurare calza / terra per localizzare il punto.',
      ],
    });
  }

  // ── conduttori verso calza: devono essere infiniti ──
  for (const k of ['pC', 'nC'] as const) {
    const x = v[k];
    if (x === undefined || x === 'OL') continue;
    const stato = valutaIsolamento(x, s);
    const cond = k === 'pC' ? 'positivo (+)' : 'negativo (−)';
    out.push({
      codice: `ISO_CALZA_COND_${k === 'pC' ? 'POS' : 'NEG'}_${ramo}`,
      gravita: stato === 'basso' ? 'alta' : stato === 'attenzione' ? 'media' : 'bassa',
      titolo: `Contatto tra schermo e ${cond} (${R}): ${fmt(x)}`,
      spiegazione:
        stato === 'ok'
          ? 'Il valore dovrebbe essere infinito (OL): un valore misurabile, anche alto, indica un principio di contatto tra schermo e conduttore.'
          : 'Il conduttore è in contatto con lo schermo: tipicamente un filo della calza che tocca un morsetto in una base o in una scatola.',
      doveIntervenire: [
        'Ispezionare basi dei dispositivi e scatole: la calza deve essere raccolta, isolata (guaina o nastro) e lontana dai morsetti.',
        'Dividere la linea a metà e rimisurare per localizzare il punto.',
      ],
    });
  }

  // ── combinazione: dispersione che passa attraverso lo schermo ──
  const condCalzaBasso = (['pC', 'nC'] as const).some((k) => v[k] !== undefined && st(v[k]) === 'basso');
  if (condCalzaBasso && sc === 'basso') {
    out.push({
      codice: `ISO_CATENA_SCHERMO_${ramo}`,
      gravita: 'info',
      titolo: `La dispersione passa attraverso lo schermo (${R})`,
      spiegazione:
        'Un conduttore tocca lo schermo e lo schermo tocca terra: la centrale vede una dispersione. Eliminando uno dei due contatti la dispersione sparisce; conviene cercare prima il contatto conduttore / schermo.',
      doveIntervenire: [],
    });
  }

  return out;
}

/** Confronto tra le misure dei due rami: con il loop integro sono lo stesso circuito. */
export function confrontaIsolamentoRami(misure: readonly Misura[], s: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  const guasto = (r: Ramo) =>
    (['pT', 'nT'] as const).some((k) => {
      const x = valoreUltima(misure, r, k);
      return x !== undefined && valutaIsolamento(x, s) === 'basso';
    });
  const misurato = (r: Ramo) => (['pT', 'nT'] as const).every((k) => valoreUltima(misure, r, k) !== undefined);
  for (const [r, altro] of [['A', 'B'], ['B', 'A']] as const) {
    if (guasto(r) && misurato(altro) && !guasto(altro)) {
      out.push({
        codice: `ISO_SOLO_${r}`,
        gravita: 'info',
        titolo: `La dispersione si vede solo dal ramo ${r}`,
        spiegazione: `Con il loop integro i rami A e B sono lo stesso circuito e darebbero la stessa lettura. Se dal ramo ${altro} l'isolamento è buono, la linea è interrotta (cavo o isolatore aperto) e il guasto verso terra è nel tratto collegato al ramo ${r}.`,
        doveIntervenire: [
          `Cercare il guasto partendo dal ramo ${r}, nel tratto prima dell'interruzione.`,
          'Verificare la continuità A→B con le misure di resistenza di loop.',
        ],
      });
    }
  }
  return out;
}

export function analizzaIsolamento(misure: readonly Misura[], s: Soglie): Anomalia[] {
  return [...analizzaIsolamentoRamo(misure, 'A', s), ...analizzaIsolamentoRamo(misure, 'B', s), ...confrontaIsolamentoRami(misure, s)];
}
