// Regole sul registro nel tempo (.DAT) del POL-200-TS.
import type { LetturaPol, RegistroPol } from '../model/types';
import type { Anomalia } from './findings';
import { MAX_CAMPIONATO, giri, statistiche } from '../import/dat';
import { indirizzi, intervalli, ultimaLettura } from './pol';

const et = (f: 'sensori' | 'moduli', n: number) => `${f === 'sensori' ? 'S' : 'M'}${n}`;

export function analizzaRegistro(r: RegistroPol, letture: readonly LetturaPol[] = []): Anomalia[] {
  const out: Anomalia[] = [];
  const lato = r.ramo === 'chiuso' ? 'loop chiuso' : `lato ${r.ramo}`;
  const st = statistiche(r.campioni);
  const nGiri = giri(r.campioni).filter((g) => g.completo && g.famiglia === 'sensori').length;
  const risponde = st.filter((s) => s.risposte > 0);

  const zero = risponde.filter((s) => s.indirizzo === 0);
  if (zero.length) {
    out.push({
      codice: `DAT_INDIRIZZO_0_${r.ramo}`,
      gravita: 'alta',
      titolo: `Risponde un dispositivo all'indirizzo 0: ${zero.map((s) => (s.famiglia === 'sensori' ? 'sensore' : 'modulo')).join(' e ')} (${lato})`,
      spiegazione:
        'Nel registro del POL un dispositivo risponde all\'indirizzo 0: è un dispositivo non indirizzato (nuovo o sostituito). La griglia del POL non mostra la cella 0, per questo può sfuggire.',
      doveIntervenire: ['Trovare il dispositivo con indirizzo 0 (in genere l\'ultimo installato o sostituito) e impostare l\'indirizzo di progetto.'],
      riferimenti: zero.map((s) => et(s.famiglia, 0)),
    });
  }

  const intermittenti = st.filter((s) => s.risposte > 0 && s.risposte < s.interrogato);
  if (intermittenti.length) {
    out.push({
      codice: `DAT_INTERMITTENTI_${r.ramo}`,
      gravita: 'alta',
      titolo: `Risposte intermittenti nel tempo (${lato}): ${intermittenti.map((s) => `${et(s.famiglia, s.indirizzo)} ${s.risposte}/${s.interrogato}`).join(', ')}`,
      spiegazione: 'Questi dispositivi rispondono solo in alcuni giri di lettura: contatto incerto nella base, giunzione difettosa o disturbi sulla linea.',
      doveIntervenire: ['Controllare inserimento nella base e serraggio dei morsetti.', 'Se sono vicini nella mappatura, controllare il tratto di linea comune.'],
      riferimenti: intermittenti.map((s) => et(s.famiglia, s.indirizzo)),
    });
  }

  const pwFuori = risponde.filter((s) => s.pw1 && (s.pw1[0] < 270 || s.pw1[1] > 330));
  if (pwFuori.length) {
    out.push({
      codice: `DAT_PW1_${r.ramo}`,
      gravita: 'media',
      titolo: `PW1 fuori da 300 ±10% nel registro (${lato}): ${pwFuori.map((s) => `${et(s.famiglia, s.indirizzo)} ${s.pw1![0]}–${s.pw1![1]}`).join(', ')}`,
      spiegazione: 'Per il manuale del POL-200-TS PW1 dovrebbe essere circa 300 ±10% con i protocolli Notifier.',
      doveIntervenire: ['Se confermato, contattare l\'assistenza tecnica Honeywell.'],
    });
  }

  const variabili = risponde.filter(
    (s) => (s.pw1 && s.pw1[1] - s.pw1[0] > 15) || (s.ii && s.ii[0] > 0 && (s.ii[1] - s.ii[0]) / s.ii[0] > 0.2),
  );
  if (variabili.length) {
    out.push({
      codice: `DAT_VARIABILI_${r.ramo}`,
      gravita: 'bassa',
      titolo: `Valori variabili tra un giro e l'altro (${lato}): ${variabili
        .map((s) => `${et(s.famiglia, s.indirizzo)}${s.ii ? ` I_I ${s.ii[0]}–${s.ii[1]}` : ''}${s.pw1 ? ` PW1 ${s.pw1[0]}–${s.pw1[1]}` : ''}`)
        .join(', ')}`,
      spiegazione:
        'PW1 o I_I cambiano molto da un giro all\'altro (oltre 15 punti di PW1 o oltre il 20% di I_I). Il manuale non spiega il significato di I_I: da tenere d\'occhio, soprattutto se il dispositivo dà anche altri segnali.',
      doveIntervenire: ['Controllare il dispositivo e il cablaggio; confrontare con i dispositivi vicini.'],
    });
  }

  // STA: significato non documentato; si segnalano i valori costanti diversi dagli altri
  const tutti = risponde.flatMap((s) => Object.entries(s.sta).flatMap(([k, n]) => Array(n).fill(k) as string[]));
  const freq = new Map<string, number>();
  for (const v of tutti) freq.set(v, (freq.get(v) ?? 0) + 1);
  const normali = new Set([...freq.entries()].filter(([, n]) => n >= tutti.length * 0.1).map(([k]) => k));
  const staStrani = risponde.filter((s) => Object.keys(s.sta).some((k) => !normali.has(k)));
  if (staStrani.length && normali.size) {
    out.push({
      codice: `DAT_STA_${r.ramo}`,
      gravita: 'info',
      titolo: `STA diverso dagli altri nel registro (${lato}): ${staStrani.map((s) => `${et(s.famiglia, s.indirizzo)} ${Object.keys(s.sta).join('/')}`).join(', ')}`,
      spiegazione: `Valori più frequenti: ${[...normali].join(', ')}. Il significato della colonna STA non è documentato nel manuale.`,
      doveIntervenire: [],
    });
  }

  // confronto con l'ultima lettura dello stesso lato (solo indirizzi campionati, fino a 99)
  const l = ultimaLettura(letture, r.ramo);
  if (l) {
    for (const f of ['sensori', 'moduli'] as const) {
      const inLettura = new Set(indirizzi(l[f]).filter((n) => n > 0 && n <= MAX_CAMPIONATO));
      const inRegistro = new Set(risponde.filter((s) => s.famiglia === f && s.indirizzo > 0).map((s) => s.indirizzo));
      const soloRegistro = [...inRegistro].filter((n) => !inLettura.has(n)).sort((a, b) => a - b);
      const soloLettura = [...inLettura].filter((n) => !inRegistro.has(n)).sort((a, b) => a - b);
      if (soloRegistro.length || soloLettura.length) {
        out.push({
          codice: `DAT_DIVERSO_DA_LETTURA_${f.toUpperCase()}_${r.ramo}`,
          gravita: 'media',
          titolo: `Registro e lettura del ${lato} non coincidono (${f})`,
          spiegazione: `${soloRegistro.length ? `Rispondono nel registro ma non sono nella lettura: ${intervalli(soloRegistro)}. ` : ''}${
            soloLettura.length ? `Sono nella lettura ma non rispondono nel registro: ${intervalli(soloLettura)}.` : ''
          } Il registro considera solo gli indirizzi fino a ${MAX_CAMPIONATO}.`,
          doveIntervenire: ['Verificare che registro e lettura siano dello stesso lato e dello stesso momento; altrimenti i dispositivi elencati rispondono in modo intermittente.'],
        });
      }
    }
  }

  if (nGiri < 2 && r.campioni.length) {
    out.push({
      codice: `DAT_POCHI_GIRI_${r.ramo}`,
      gravita: 'info',
      titolo: `Registro con ${nGiri} giro completo`,
      spiegazione: 'Per vedere le risposte intermittenti servono almeno 2-3 giri di lettura.',
      doveIntervenire: [],
    });
  }
  return out;
}

export function analizzaRegistri(registri: readonly RegistroPol[] | undefined, letture: readonly LetturaPol[]): Anomalia[] {
  const out: Anomalia[] = [];
  for (const ramo of ['A', 'B', 'chiuso'] as const) {
    const r = [...(registri ?? [])].filter((x) => x.ramo === ramo).sort((a, b) => (a.importato < b.importato ? 1 : -1))[0];
    if (r) out.push(...analizzaRegistro(r, letture));
  }
  return out;
}
