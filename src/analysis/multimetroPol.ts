// Regole sulla schermata Multimetro del POL-200-TS (resistenze, guasti, capacità).
// Nate dall'esperienza in cantiere del 26/11/2026: calza non collegata ai morsetti del POL, contatto
// calza / positivo, ponticelli che falsano la resistenza, capacità sbilanciata con un conduttore interrotto.
import type { Misura, Soglie } from '../model/types';
import type { Anomalia } from './findings';
import { formattaValore, valoreUltima } from './misure';

const k = (v: number | 'OL') => formattaValore(v, 'kΩ');

export function analizzaMultimetroPol(misure: readonly Misura[], s: Soglie): Anomalia[] {
  const out: Anomalia[] = [];
  const v = (t: Parameters<typeof valoreUltima>[2]) => valoreUltima(misure, 'loop', t);

  // ── contatti calza / conduttori ──
  const gCP = v('gCP');
  const gCN = v('gCN');
  if (typeof gCP === 'number' || typeof gCN === 'number') {
    const p = typeof gCP === 'number' ? gCP : Infinity;
    const n = typeof gCN === 'number' ? gCN : Infinity;
    const peggiore = p <= n ? 'positivo (+)' : 'negativo (−)';
    out.push({
      codice: 'POLM_CALZA_CONDUTTORE',
      gravita: 'alta',
      titolo: `Contatto tra calza e conduttori (POL): calza / + ${gCP === undefined ? '—' : k(gCP)}, calza / − ${gCN === undefined ? '—' : k(gCN)}`,
      spiegazione: `Il manuale chiede più di 15÷20 MΩ tra calza e conduttori; il POL arriva a 1000 kΩ, quindi ogni valore misurabile è un guasto. Il valore più basso indica il conduttore coinvolto: il ${peggiore}${
        Number.isFinite(p) && Number.isFinite(n) ? '; quello sull\'altro conduttore può essere lo stesso guasto visto attraverso i dispositivi' : ''
      }. Tipico di umidità in una scatola o in una base, o di un filo della calza che tocca un morsetto.`,
      doveIntervenire: [
        'Dividere la linea a metà e rimisurare dal lato centrale: la metà in cui il valore resta basso contiene il guasto.',
        'Ispezionare scatole e basi: calza raccolta e isolata, nessun filo vicino ai morsetti, assenza di umidità.',
      ],
    });
  }

  // ── dispersioni verso terra ──
  const terra = (['gTP', 'gTN', 'gTC'] as const).filter((t) => typeof v(t) === 'number');
  if (terra.length) {
    const nomi = { gTP: 'positivo', gTN: 'negativo', gTC: 'calza' } as const;
    out.push({
      codice: 'POLM_TERRA',
      gravita: 'alta',
      titolo: `Dispersione verso terra (POL): ${terra.map((t) => `${nomi[t]} ${k(v(t) as number)}`).join(', ')}`,
      spiegazione: 'Il POL misura una resistenza finita verso terra: la centrale segnalerà dispersione (LED «Dispersione a terra»).',
      doveIntervenire: ['Dividere la linea a metà e rimisurare; gli isolatori non separano un guasto verso terra.'],
    });
  }

  // ── guasto + / − ──
  const gPN = v('gPN');
  if (typeof gPN === 'number' && gPN < 100) {
    out.push({
      codice: 'POLM_PIU_MENO',
      gravita: gPN < 1 ? 'alta' : 'media',
      titolo: `Guasto + / − basso (POL): ${k(gPN)}`,
      spiegazione:
        gPN < 1
          ? 'Praticamente un corto tra + e −.'
          : 'Con i dispositivi collegati il POL può leggere valori bassi, ma in un loop sano dopo l\'intervento si sono visti 995 kΩ: pochi kΩ indicano una perdita tra i conduttori (umidità, dispositivo o base guasti).',
      doveIntervenire: ['Confrontare con un loop sano e con la misura + / − col multimetro (1÷1,3 MΩ).', 'Dividere la linea a metà e rimisurare.'],
    });
  }

  // ── resistenze: collegamenti al POL sospetti ──
  const rP = valoreUltima(misure, 'loop', 'rP');
  const rN = valoreUltima(misure, 'loop', 'rN');
  const rC = valoreUltima(misure, 'loop', 'rC');
  if (rC === 'OL' && typeof rP === 'number' && typeof rN === 'number') {
    out.push({
      codice: 'POLM_CALZA_NON_COLLEGATA',
      gravita: 'media',
      titolo: 'Calza «>150 Ω» con + e − regolari',
      spiegazione: 'Spesso la calza non è collegata ai morsetti grigi del POL (o a uno dei due): in quel caso anche le misure calza / conduttori e verso terra non sono valide.',
      doveIntervenire: ['Collegare entrambe le calze ai morsetti grigi del POL e rimisurare; se resta così, lo schermo è interrotto.'],
    });
  }
  for (const [nome, r] of [['negativo', rN], ['positivo', rP]] as const) {
    if (r === 0) {
      out.push({
        codice: `POLM_ZERO_${nome === 'negativo' ? 'NEG' : 'POS'}`,
        gravita: 'media',
        titolo: `Resistenza del ${nome} 0 Ω`,
        spiegazione: 'Attraverso il cavo del loop non è possibile: i due morsetti del POL sono collegati tra loro da un tratto cortissimo (stesso filo, ponticello, capi uniti vicino al POL). La misura non riguarda la linea.',
        doveIntervenire: ['Ricollegare ramo A a destra e ramo B a sinistra, senza ponticelli, e rimisurare.'],
      });
    }
  }

  // ── capacità ──
  const cPN = v('cPN');
  if (typeof cPN === 'number' && cPN > s.capacitaMaxUF * 1000) {
    out.push({
      codice: 'POLM_CAPACITA',
      gravita: 'info',
      titolo: `Capacità + / − ${formattaValore(cPN, 'nF')} (cavo: massimo ${s.capacitaMaxUF * 1000} nF)`,
      spiegazione: 'Il limite del manuale riguarda il cavo: con i dispositivi collegati la capacità misurata è più alta. Va valutata con i dispositivi scollegati o confrontata con loop simili.',
      doveIntervenire: [],
    });
  }
  const cCP = v('cCP');
  const cCN = v('cCN');
  if (typeof cCP === 'number' && typeof cCN === 'number' && Math.min(cCP, cCN) > 0 && Math.max(cCP, cCN) / Math.min(cCP, cCN) > 2.5) {
    const corto = cCP < cCN ? 'positivo (+)' : 'negativo (−)';
    out.push({
      codice: 'POLM_CAPACITA_SBILANCIATA',
      gravita: 'media',
      titolo: `Capacità verso la calza sbilanciata: calza / + ${formattaValore(cCP, 'nF')}, calza / − ${formattaValore(cCN, 'nF')}`,
      spiegazione: `In un cavo intrecciato i due conduttori hanno capacità simile verso lo schermo. Il ${corto} sembra collegato per un tratto molto più corto: possibile interruzione su quel conduttore.`,
      doveIntervenire: [`Verificare la continuità del ${corto} dividendo la linea a metà.`],
    });
  }
  return out;
}
