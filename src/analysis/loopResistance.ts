// Regole di analisi della resistenza di loop e del cavo.
import type { Cavo, Misura, RigaSezione, Soglie } from '../model/types';
import type { Anomalia } from './findings';
import { formattaValore, valoreUltima } from './misure';

/** Resistività del rame a 20 °C (Ω·mm²/m). */
export const RHO_RAME = 0.0175;

/** Resistenza attesa di un conduttore lungo L metri con sezione S mm². */
export const resistenzaConduttore = (lunghezzaM: number, sezioneMm2: number) => (RHO_RAME * lunghezzaM) / sezioneMm2;

/** Lunghezza massima del loop con questa sezione perché ogni conduttore resti entro la metà della resistenza massima. */
export const lunghezzaMassima = (sezioneMm2: number, rLoopMaxOhm: number) => ((rLoopMaxOhm / 2) * sezioneMm2) / RHO_RAME;

/** Sezione minima dalla tabella; null se la lunghezza supera l'ultima riga. */
export function sezioneMinima(lunghezzaM: number, tabella: readonly RigaSezione[]): number | null {
  const righe = [...tabella].filter((r) => r.lunghezzaMaxM > 0).sort((a, b) => a.lunghezzaMaxM - b.lunghezzaMaxM);
  const r = righe.find((x) => lunghezzaM <= x.lunghezzaMaxM);
  return r ? r.sezioneMinMm2 : null;
}

const ohm = (n: number) => formattaValore(Math.round(n * 100) / 100, 'Ω');

const PASSI_INTERRUZIONE = [
  'Le letture del POL-200-TS dal ramo A e dal ramo B indicano tra quali indirizzi si trova l\'interruzione.',
  'Controllare morsetti e giunzioni in quel tratto e gli isolatori (un isolatore in protezione apre la linea).',
];

export function analizzaResistenza(misure: readonly Misura[], cavo: Cavo, s: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  const rP = valoreUltima(misure, 'loop', 'rP');
  const rN = valoreUltima(misure, 'loop', 'rN');

  if (rP === 'OL' && rN === 'OL') {
    out.push({
      codice: 'RES_LOOP_APERTO',
      gravita: 'alta',
      titolo: 'Loop aperto: nessuna continuità tra A e B su entrambi i conduttori',
      spiegazione: 'Cavo interrotto (o un isolatore aperto) tra il ramo A e il ramo B.',
      doveIntervenire: PASSI_INTERRUZIONE,
    });
  } else {
    for (const [k, v, nome] of [['POS', rP, 'positivo (+)'], ['NEG', rN, 'negativo (−)']] as const) {
      if (v === 'OL') {
        out.push({
          codice: `RES_INTERROTTO_${k}`,
          gravita: 'alta',
          titolo: `Conduttore ${nome} interrotto tra A e B`,
          spiegazione: `Manca la continuità solo sul ${nome}: morsetto scollegato, conduttore tranciato o isolatore aperto su quel conduttore.`,
          doveIntervenire: PASSI_INTERRUZIONE,
        });
      }
    }
  }

  const p = typeof rP === 'number' ? rP : undefined;
  const n = typeof rN === 'number' ? rN : undefined;

  if (p !== undefined && n !== undefined) {
    const tot = p + n;
    if (tot > s.rLoopMaxOhm) {
      out.push({
        codice: 'RES_TOTALE_ALTA',
        gravita: 'alta',
        titolo: `Resistenza di loop troppo alta: ${ohm(tot)} (massimo ${s.rLoopMaxOhm} Ω)`,
        spiegazione: `Somma di positivo (${ohm(p)}) e negativo (${ohm(n)}). Con resistenza alta la tensione arriva bassa ai dispositivi lontani e la comunicazione diventa instabile.`,
        doveIntervenire: [
          'Verificare la sezione del cavo rispetto alla lunghezza.',
          'Controllare giunzioni e morsetti (ossidati o allentati aggiungono resistenza).',
          'Valutare la divisione del loop o un cavo di sezione maggiore.',
        ],
      });
    }
    const diff = Math.abs(p - n);
    if (diff > Math.max(2, 0.2 * Math.min(p, n))) {
      const alto = p > n ? 'positivo (+)' : 'negativo (−)';
      out.push({
        codice: 'RES_SBILANCIATA',
        gravita: 'media',
        titolo: `Resistenze di + e − diverse: ${ohm(p)} / ${ohm(n)}`,
        spiegazione: `Sullo stesso cavo i due conduttori dovrebbero avere quasi la stessa resistenza. Il ${alto} ha ${ohm(diff)} in più: probabile morsetto allentato o ossidato o giunzione difettosa su quel conduttore. Gli isolatori aggiungono una piccola resistenza solo sul conduttore che sezionano.`,
        doveIntervenire: [`Ricontrollare i serraggi dei morsetti del ${alto} nelle basi e nelle scatole di giunzione.`],
      });
    }
  }
  if (n !== undefined && n > s.rNegMaxOhm) {
    out.push({
      codice: 'RES_NEGATIVO_ALTO',
      gravita: 'alta',
      titolo: `Resistenza del negativo troppo alta: ${ohm(n)} (massimo ${s.rNegMaxOhm} Ω)`,
      spiegazione: 'Il negativo è il riferimento della comunicazione: oltre il limite la centrale può perdere dispositivi.',
      doveIntervenire: ['Controllare morsetti e giunzioni del negativo.', 'Verificare sezione e lunghezza del cavo.'],
    });
  }

  // ── confronto con il cavo ──
  const L = cavo.lunghezzaM;
  const S = cavo.sezioneMm2;
  if (L && S && L > 0 && S > 0) {
    const atteso = resistenzaConduttore(L, S);
    for (const [k, v, nome] of [['POS', p, 'positivo'], ['NEG', n, 'negativo']] as const) {
      if (v === undefined) continue;
      if (v > atteso * 1.25 + 1) {
        out.push({
          codice: `RES_OLTRE_CAVO_${k}`,
          gravita: 'media',
          titolo: `Resistenza del ${nome} più alta di quella del cavo: ${ohm(v)} (attesa circa ${ohm(atteso)})`,
          spiegazione: `Con ${L} m di cavo da ${S} mm² ogni conduttore dovrebbe misurare circa ${ohm(atteso)}. La differenza è dovuta a giunzioni o morsetti resistivi, oppure la lunghezza reale è maggiore di quella indicata.`,
          doveIntervenire: ['Verificare la lunghezza reale del loop.', 'Controllare giunzioni e morsetti.'],
        });
      } else if (v < atteso * 0.5) {
        out.push({
          codice: `RES_SOTTO_CAVO_${k}`,
          gravita: 'bassa',
          titolo: `Resistenza del ${nome} molto più bassa di quella attesa: ${ohm(v)} (attesa circa ${ohm(atteso)})`,
          spiegazione: 'La lunghezza indicata è forse sovrastimata, oppure la misura non percorre tutto il loop (ponte o collegamento intermedio tra le linee).',
          doveIntervenire: ['Verificare la lunghezza del cavo e che A e B siano davvero i due estremi dello stesso loop.'],
        });
      }
    }
    const min = sezioneMinima(L, s.tabellaSezioni);
    if (min === null) {
      out.push({
        codice: 'CAVO_OLTRE_TABELLA',
        gravita: 'media',
        titolo: `Lunghezza ${L} m oltre la tabella delle sezioni`,
        spiegazione: `La tabella nelle Impostazioni arriva fino a ${Math.max(0, ...s.tabellaSezioni.map((r) => r.lunghezzaMaxM))} m.`,
        doveIntervenire: ['Verificare con il manuale della centrale se la lunghezza è ammessa.'],
      });
    } else if (S < min) {
      out.push({
        codice: 'CAVO_SEZIONE_INSUFFICIENTE',
        gravita: 'alta',
        titolo: `Sezione insufficiente: ${S} mm² per ${L} m (minimo ${min} mm²)`,
        spiegazione: `Con ${S} mm² la lunghezza massima per stare entro ${s.rLoopMaxOhm} Ω è circa ${Math.round(lunghezzaMassima(S, s.rLoopMaxOhm))} m.`,
        doveIntervenire: ['Sostituire il cavo con uno di sezione adeguata o dividere il loop.'],
      });
    }
  }
  return out;
}
