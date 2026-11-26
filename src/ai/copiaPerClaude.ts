// Testi da copiare e incollare nella chat di Claude (usa l'abbonamento del tecnico, senza API).
// Non contengono nome del cliente né indirizzo: per la diagnosi non servono.
import type { Centrale, FamigliaPol, Griglia, Impostazioni, LetturaPol, Loop, Sessione } from '../model/types';
import { analizzaSessione } from '../analysis/sessione';
import { DEF_MISURE, formattaValore, nomeRamo } from '../analysis/misure';
import { indirizzi, intervalli, ultimaLettura } from '../analysis/pol';
import { breve, costruisciMappa, dorsale } from '../analysis/mappa';
import { datiIllegibili, idNodo } from '../import/mnt';
import { statistiche } from '../import/dat';
import { ultimoRiconoscimento } from '../analysis/riconoscimento';
import { cronologia, testoSintomo } from '../db/sessioni';
import { numeroLoopTotali } from '../db/repo';

const hh = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(11, 16) : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

/** Griglia in forma compatta: "OT: 1–4, 7–18 · ??: 19, 20". */
export function grigliaCompatta(g: Griglia): string {
  const per = new Map<string, number[]>();
  for (const n of indirizzi(g)) per.set(g[n], [...(per.get(g[n]) ?? []), n]);
  return [...per.entries()].map(([s, nn]) => `${s}: ${intervalli(nn)}`).join(' · ') || '(vuota)';
}

const n2 = (v: number) => String(v).replace('.', ',');

export function testoDiagnosi(s: Sessione, loop: Loop, centrale: Centrale | undefined, imp: Impostazioni): string {
  const so = imp.soglie;
  const r: string[] = [];
  r.push(
    'Sei un esperto di impianti di rivelazione incendio Notifier (centrale AM-8200N, loop con protocollo Advanced/CLIP, strumento di diagnosi POL-200-TS).',
    'Ti passo i dati di una verifica di un loop fatta in cantiere. Rispondi in italiano, in modo sintetico e pratico (lo leggo dal telefono), con:',
    '1. Diagnosi: cosa sta succedendo, con le cause più probabili in ordine di probabilità e il perché.',
    '2. Dove intervenire: passi concreti da fare in cantiere, nell\'ordine giusto (dove andare, cosa aprire o scollegare, cosa misurare e con quale valore atteso).',
    '3. Misure o letture mancanti che servirebbero a confermare la diagnosi.',
    'Non inventare dati che non ci sono: se qualcosa non si può dire, dillo. Tieni conto che le "anomalie già rilevate" sono calcolate da regole automatiche e possono essere incomplete.',
    '',
    '=== DATI DELLA VERIFICA ===',
  );
  if (centrale) r.push(`Centrale: ${centrale.modello}, ${numeroLoopTotali(centrale)} loop (${centrale.loopBase} sulla scheda madre${centrale.espansioni.length ? ` + ${centrale.espansioni.map((e) => `${e.modello} ${e.loop}`).join(', ')}` : ''}).`);
  r.push(`Loop ${loop.numero} (${loop.scheda})${loop.stile ? `, stile ${loop.stile === 'chiuso' ? 'loop chiuso' : 'linea aperta'}` : ''}${loop.protocollo ? `, protocollo ${loop.protocollo}` : ''}${loop.totaleAttesoSensori ? `, attesi ${loop.totaleAttesoSensori} sensori` : ''}${loop.totaleAttesoModuli ? ` e ${loop.totaleAttesoModuli} moduli` : ''}.`);
  if (s.sintomo) r.push(`Sintomo segnalato dalla centrale: ${testoSintomo(s.sintomo.tipo)}${s.sintomo.ramo !== 'non_noto' ? ` (${s.sintomo.ramo === 'entrambi' ? 'entrambi i rami' : `ramo ${s.sintomo.ramo}`})` : ''}${s.sintomo.descrizione ? `, display: "${s.sintomo.descrizione}"` : ''}.`);
  r.push(
    '',
    `Limiti usati: isolamento > ${so.isolamentoAttenzioneMOhm} MΩ (guasto sotto ${so.isolamentoMinMOhm} MΩ); resistenza di loop ≤ ${so.rLoopMaxOhm} Ω totali, negativo ≤ ${so.rNegMaxOhm} Ω; + / − con dispositivi ${n2(so.lineaPN[0])}÷${n2(so.lineaPN[1])} MΩ (tester + sul +) e ${n2(so.lineaNP[0])}÷${n2(so.lineaNP[1])} MΩ (invertito); capacità ≤ ${n2(so.capacitaMaxUF)} μF; tensione di ritorno POL ≥ ${so.vRitornoMinV} V; tensione di linea 24 V (sotto ${so.vLineaMinV} V = inversione); cavo max ${so.lunghezzaMaxM} m.`,
  );

  if (s.misure.length) {
    r.push('', 'MISURE (a cavo scollegato salvo diversa indicazione; in ordine di tempo, l\'ultima di ogni tipo è quella valida):');
    for (const m of [...s.misure].sort((a, b) => (a.ora < b.ora ? -1 : 1))) {
      const d = DEF_MISURE[m.tipo];
      r.push(`- ${hh(m.ora)} ${d.descrizione}, ${nomeRamo(m.ramo)}: ${formattaValore(m.valore, m.valore === 'OL' ? undefined : d.unita)}`);
    }
  }
  const c = s.cavo;
  if (c.lunghezzaM || c.sezioneMm2 || c.tipo) r.push('', `Cavo: ${[c.tipo, c.lunghezzaM ? `${c.lunghezzaM} m` : '', c.sezioneMm2 ? `${n2(c.sezioneMm2)} mm²` : ''].filter(Boolean).join(', ')}.`);

  const ultime = (['A', 'B', 'chiuso'] as const).map((rm) => ultimaLettura(s.letture, rm)).filter((x): x is LetturaPol => !!x);
  if (ultime.length) {
    r.push('', 'LETTURE POL-200-TS (ultima per lato; sigle come sul POL: "??" = lettura incerta, minuscolo = risposta non corretta, "-" = possibile doppio):');
    for (const l of ultime) {
      r.push(`- ${l.ramo === 'chiuso' ? 'Loop chiuso' : `Lato ${l.ramo}`} (${hh(l.ora)}${l.nomeFile ? `, file ${l.nomeFile}` : ''}):`);
      for (const f of ['sensori', 'moduli'] as FamigliaPol[]) r.push(`  ${f}: ${grigliaCompatta(l[f])}`);
      if (l.dettagli?.length) {
        const m = costruisciMappa(l.dettagli);
        const dd = dorsale(m);
        r.push(`  mappatura (dalla colonna DEP, ordine fisico dalla centrale): ${['Centrale', ...dd.map((x) => breve(x.id))].join(' > ')}`);
        if (m.derivazioni.length) r.push(`  derivazioni: ${m.derivazioni.map((x) => `${breve(x.id)} -> ${x.figli.slice(0, -1).map((f) => breve(f.id)).join(', ')}`).join('; ')}`);
        if (m.nonMappati.length) r.push(`  non collocati: ${m.nonMappati.map((x) => breve(idNodo(x.famiglia, x.indirizzo))).join(', ')}`);
        const corr = l.dettagli.filter(datiIllegibili);
        if (corr.length) r.push(`  risposte con seriale/costruttore illeggibili: ${corr.map((x) => breve(idNodo(x.famiglia, x.indirizzo))).join(', ')}`);
      }
    }
  }
  for (const reg of s.registri ?? []) {
    const st = statistiche(reg.campioni).filter((x) => x.risposte > 0);
    const strani = st.filter((x) => x.risposte < x.interrogato || x.indirizzo === 0);
    r.push('', `REGISTRO NEL TEMPO ${reg.nomeFile} (${reg.ramo === 'chiuso' ? 'loop chiuso' : `lato ${reg.ramo}`}): ${st.length} indirizzi rispondono (solo fino a 99).${strani.length ? ` Da notare: ${strani.map((x) => `${x.famiglia === 'sensori' ? 'S' : 'M'}${x.indirizzo} ${x.risposte}/${x.interrogato}`).join(', ')}.` : ''}`);
  }
  const ric = ultimoRiconoscimento(s.riconoscimenti);
  if (ric) {
    r.push('', 'RICONOSCIMENTO AUTOMATICO DELLA CENTRALE (NUO = nuovi, INC = programmati ma non coerenti, TOT = totale, MAN = programmati ma mancanti):');
    for (const x of ric.righe) r.push(`- ${x.tipoDispositivo}: NUO ${x.nuo}, INC ${x.inc}, TOT ${x.tot}, MAN ${x.man}`);
  }
  const note = cronologia(s).filter((e) => !e.automatico);
  if (note.length || s.note) {
    r.push('', 'NOTE DEL TECNICO:');
    for (const e of note) r.push(`- ${hh(e.ora)} ${e.testo}`);
    if (s.note) r.push(`- ${s.note}`);
  }
  const an = analizzaSessione(s, loop, so, imp.sigle);
  if (an.length) {
    r.push('', 'ANOMALIE GIÀ RILEVATE DALLE REGOLE AUTOMATICHE:');
    for (const a of an) r.push(`- [${a.gravita}] ${a.titolo}`);
  }
  return r.join('\n');
}

/** Richiesta da inviare a Claude insieme alla foto della griglia del POL. */
export function testoLetturaFoto(famiglia: FamigliaPol | 'entrambe'): string {
  return [
    `Nella foto allegata c'è la griglia ${famiglia === 'entrambe' ? 'dei sensori e/o dei moduli' : `dei ${famiglia}`} dello strumento Notifier POL-200-TS.`,
    'Colonne = decine (00, 10, 20 … 150), righe = unità (0 … 9): indirizzo = decina + unità (es. colonna 30, riga 6 = indirizzo 36). La cella 00/0 è sempre grigia e non conta.',
    'Leggi ogni cella e riporta la sigla esattamente come appare, rispettando maiuscole e minuscole (es. OT, O, ot, ??, -, SS, PI).',
    'Rispondi SOLO in questo formato, senza altro testo, raggruppando gli indirizzi consecutivi con la stessa sigla:',
    '',
    'SENSORI',
    '1-4 OT',
    '7-18 OT',
    '19 ??',
    'MODULI',
    '2 SS',
    '7 PI',
    'DUBBI',
    'S36, S40, M7',
    '',
    'Sotto DUBBI elenca gli indirizzi che non riesci a leggere con certezza (riflessi, sfocatura, celle tagliate), con S davanti per i sensori e M per i moduli. Ometti le sezioni che non sono nella foto. Le celle vuote non vanno elencate.',
  ].join('\n');
}

export interface GrigliaLetta {
  sensori: Griglia;
  moduli: Griglia;
  dubbi: { sensori: number[]; moduli: number[] };
  avvisi: string[];
}

/** Legge la risposta di Claude (formato sopra), in modo tollerante. */
export function leggiRispostaGriglia(testo: string, famigliaPredefinita: FamigliaPol = 'sensori'): GrigliaLetta {
  const out: GrigliaLetta = { sensori: {}, moduli: {}, dubbi: { sensori: [], moduli: [] }, avvisi: [] };
  let sez: FamigliaPol | 'dubbi' = famigliaPredefinita;
  let ultimaFam: FamigliaPol = famigliaPredefinita;
  for (const grezza of testo.replace(/```/g, '').split(/\r?\n/)) {
    const r = grezza.trim().replace(/^[-*•]\s*/, '');
    if (!r) continue;
    if (/^sensori\b/i.test(r)) { sez = ultimaFam = 'sensori'; continue; }
    if (/^moduli\b/i.test(r)) { sez = ultimaFam = 'moduli'; continue; }
    if (/^dubbi\b/i.test(r)) {
      sez = 'dubbi';
      const resto = r.replace(/^dubbi\s*:?\s*/i, '');
      if (resto) aggiungiDubbi(resto);
      continue;
    }
    if (sez === 'dubbi') { aggiungiDubbi(r); continue; }
    for (const pezzo of r.split(/[;,](?![^()]*\))/)) {
      const m = /^\s*(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?\s*[:=]?\s*(\S{1,4})\s*$/.exec(pezzo);
      if (!m) {
        if (pezzo.trim()) out.avvisi.push(`Non capito: «${pezzo.trim()}»`);
        continue;
      }
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      for (let n = Math.min(a, b); n <= Math.min(159, Math.max(a, b)); n++) out[sez][n] = m[3];
    }
  }
  return out;

  function aggiungiDubbi(t: string) {
    for (const p of t.split(/[,;\s]+/)) {
      const m = /^([SM])?(\d{1,3})(?:[-–](\d{1,3}))?$/i.exec(p.trim());
      if (!m) continue;
      const a = Number(m[2]);
      const b = m[3] ? Number(m[3]) : a;
      for (let n = a; n <= b; n++) {
        // senza prefisso: la griglia in cui l'indirizzo è presente (se è in una sola), altrimenti l'ultima sezione
        const inS = n in out.sensori;
        const inM = n in out.moduli;
        const fam: FamigliaPol = m[1] ? (m[1].toUpperCase() === 'S' ? 'sensori' : 'moduli') : inS !== inM ? (inS ? 'sensori' : 'moduli') : ultimaFam;
        out.dubbi[fam].push(n);
      }
    }
  }
}
