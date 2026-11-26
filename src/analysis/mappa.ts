// Mappatura fisica del loop ricavata dalla colonna DEP del file .MNT del POL-200-TS
// (ogni dispositivo indica quello da cui dipende verso la centrale; PNL = centrale/POL).
import type { DispositivoMnt, FamigliaPol, LetturaPol, SiglaPol, Soglie } from '../model/types';
import type { Anomalia } from './findings';
import { datiIllegibili, idNodo } from '../import/mnt';
import { eAllarme, intervalli, ultimaLettura } from './pol';

export interface NodoMappa {
  id: string; // S002 / M004
  dispositivo: DispositivoMnt;
  figli: NodoMappa[];
  profondita: number; // posizione lungo il percorso (1 = primo dopo la centrale)
  dimensione: number; // dispositivi nel sotto-albero, compreso sé stesso
}

export interface Mappa {
  radici: NodoMappa[]; // dipendono da PNL
  nodi: Map<string, NodoMappa>;
  nonMappati: DispositivoMnt[]; // DEP vuoto, o dipendenza da un dispositivo che non c'è
  cicli: string[];
  derivazioni: NodoMappa[]; // nodi con più di un figlio
  fineRamo: NodoMappa[]; // foglie
  profonditaMax: number;
}

export const nomeNodo = (id: string) => `${id[0] === 'S' ? 'Sensore' : 'Modulo'} ${Number(id.slice(1))}`;
export const breve = (id: string) => `${id[0]}${Number(id.slice(1))}`;

export function costruisciMappa(dettagli: readonly DispositivoMnt[]): Mappa {
  const nodi = new Map<string, NodoMappa>();
  for (const d of dettagli) nodi.set(idNodo(d.famiglia, d.indirizzo), { id: idNodo(d.famiglia, d.indirizzo), dispositivo: d, figli: [], profondita: 0, dimensione: 1 });
  const radici: NodoMappa[] = [];
  const nonMappati: DispositivoMnt[] = [];
  for (const n of nodi.values()) {
    const dep = n.dispositivo.dep;
    if (dep === 'PNL') radici.push(n);
    else if (dep && nodi.has(dep) && dep !== n.id) nodi.get(dep)!.figli.push(n);
    else nonMappati.push(n.dispositivo);
  }
  // visita dalla centrale: profondità e dimensione; individua cicli (nodi mai raggiunti)
  const raggiunti = new Set<string>();
  const visita = (n: NodoMappa, p: number): number => {
    raggiunti.add(n.id);
    n.profondita = p;
    n.dimensione = 1 + n.figli.reduce((s, f) => s + (raggiunti.has(f.id) ? 0 : visita(f, p + 1)), 0);
    // figli in ordine: prima le derivazioni corte, per ultimo il ramo che continua
    n.figli.sort((a, b) => a.dimensione - b.dimensione || a.id.localeCompare(b.id));
    return n.dimensione;
  };
  radici.forEach((r) => visita(r, 1));
  const cicli = [...nodi.values()].filter((n) => !raggiunti.has(n.id) && !nonMappati.includes(n.dispositivo)).map((n) => n.id);
  const raggiungibili = [...nodi.values()].filter((n) => raggiunti.has(n.id));
  return {
    radici,
    nodi,
    nonMappati,
    cicli,
    derivazioni: raggiungibili.filter((n) => n.figli.length > 1),
    fineRamo: raggiungibili.filter((n) => n.figli.length === 0),
    profonditaMax: Math.max(0, ...raggiungibili.map((n) => n.profondita)),
  };
}

/** Percorso principale (dorsale): segue sempre il figlio con il sotto-albero più grande. */
export function dorsale(m: Mappa): NodoMappa[] {
  const out: NodoMappa[] = [];
  let n: NodoMappa | undefined = [...m.radici].sort((a, b) => b.dimensione - a.dimensione)[0];
  while (n) {
    out.push(n);
    n = n.figli[n.figli.length - 1];
  }
  return out;
}

const dispositiviSotto = (n: NodoMappa): NodoMappa[] => [n, ...n.figli.flatMap(dispositiviSotto)];

export function analizzaMappa(l: LetturaPol, sigle: readonly SiglaPol[], soglie: Pick<Soglie, 'maxDispositiviLoopAperto'>): Anomalia[] {
  if (!l.dettagli?.length) return [];
  const m = costruisciMappa(l.dettagli);
  if (m.radici.length === 0) return [];
  const out: Anomalia[] = [];
  const lato = l.ramo === 'chiuso' ? 'loop chiuso' : `lato ${l.ramo}`;
  const dors = dorsale(m);
  let ultimo = dors[dors.length - 1];
  const padre = dors[dors.length - 2];
  // se l'ultimo nodo è solo uno di più "foglie" alla pari, il punto finale certo è il loro padre
  const ventaglio = padre && padre.figli.length > 1 && padre.figli.every((f) => f.figli.length === 0) ? padre.figli : null;
  if (ventaglio) ultimo = padre;

  out.push({
    codice: `MAPPA_FINE_${l.ramo}`,
    gravita: 'info',
    titolo: ventaglio
      ? `Ultimo punto del percorso (${lato}): ${nomeNodo(ultimo.id)}, da cui dipendono ${ventaglio.map((f) => breve(f.id)).join(', ')}`
      : `Ultimo dispositivo raggiunto (${lato}): ${nomeNodo(ultimo.id)}`,
    spiegazione: `Seguendo il cavo dalla centrale si incontrano ${ventaglio ? dors.length - 1 : dors.length} dispositivi sul percorso principale.${
      l.ramo !== 'chiuso' ? ' Con il loop aperto l\'interruzione è subito dopo l\'ultimo punto raggiunto.' : ''
    }`,
    doveIntervenire: l.ramo !== 'chiuso' ? [`Ispezionare il cavo e i morsetti in uscita da ${nomeNodo(ultimo.id)}.`] : [],
    riferimenti: [ultimo.id],
  });

  for (const d of m.derivazioni) {
    const rami = d.figli.slice(0, -1); // l'ultimo è la prosecuzione
    for (const r of rami) {
      const punti = dispositiviSotto(r).filter((n) => eAllarme(l[n.dispositivo.famiglia][n.dispositivo.indirizzo] ?? '', n.dispositivo.famiglia, sigle)).length;
      if (punti > soglie.maxDispositiviLoopAperto) {
        out.push({
          codice: `MAPPA_T_OLTRE_32_${r.id}`,
          gravita: 'alta',
          titolo: `Derivazione a T da ${nomeNodo(d.id)} con ${punti} punti di allarme`,
          spiegazione: 'Il manuale di installazione: su un ramo a T in loop chiuso non devono essere installati più di 32 dispositivi e la diramazione va separata con un modulo di isolamento.',
          doveIntervenire: ['Separare la diramazione con un isolatore o ridistribuire i dispositivi.'],
        });
      }
    }
  }
  if (m.derivazioni.length) {
    out.push({
      codice: `MAPPA_DERIVAZIONI_${l.ramo}`,
      gravita: 'info',
      titolo: `Derivazioni (${lato}): ${m.derivazioni.map((d) => breve(d.id)).join(', ')}`,
      spiegazione:
        'Punti in cui più dispositivi dipendono dallo stesso dispositivo. Può essere una vera derivazione a T oppure dispositivi che il POL non è riuscito a separare (letture corrotte, isolatore non attivabile: ISO = N).',
      doveIntervenire: ['Confrontare con lo schema di cablaggio.'],
    });
  }

  // letture corrotte concentrate in fondo al ramo = problema nel tratto finale della linea
  const corrotti = [...m.nodi.values()].filter((n) => n.profondita > 0 && datiIllegibili(n.dispositivo));
  if (corrotti.length >= 2) {
    const soglia = Math.floor(m.profonditaMax * 0.8);
    const inFondo = corrotti.filter((n) => n.profondita >= soglia);
    if (inFondo.length === corrotti.length) {
      out.push({
        codice: `MAPPA_CORROTTI_IN_FONDO_${l.ramo}`,
        gravita: 'alta',
        titolo: `Le risposte corrotte sono tutte nel tratto finale del ${lato}`,
        spiegazione: `${corrotti.map((n) => breve(n.id)).join(', ')} si trovano tutti oltre l'80% del percorso dalla centrale. È tipico di un problema della linea in quel tratto (giunzione resistiva, umidità, schermo interrotto, disturbi) più che di dispositivi guasti.`,
        doveIntervenire: [
          'Ispezionare cavo, giunzioni e schermo nel tratto finale, a partire dai dispositivi da cui dipendono quelli corrotti.',
          'Ripetere la lettura dal lato opposto: se da lì rispondono bene, la conferma è un problema di linea.',
        ],
        riferimenti: corrotti.map((n) => n.id),
      });
    }
  }

  if (m.nonMappati.length) {
    out.push({
      codice: `MAPPA_NON_MAPPATI_${l.ramo}`,
      gravita: 'bassa',
      titolo: `Dispositivi non collocati nella mappatura: ${m.nonMappati.map((d) => breve(idNodo(d.famiglia, d.indirizzo))).join(', ')}`,
      spiegazione: 'Il POL non ha indicato da quale dispositivo dipendono (DEP vuoto): spesso sono dispositivi senza isolatore, oltre l\'ultimo isolatore attivabile, o con risposta incerta.',
      doveIntervenire: ['Verificare la posizione dalla planimetria o rileggere con la mappatura.'],
    });
  }
  if (m.cicli.length) {
    out.push({
      codice: `MAPPA_CICLI_${l.ramo}`,
      gravita: 'bassa',
      titolo: `Mappatura incoerente per: ${m.cicli.map(breve).join(', ')}`,
      spiegazione: 'Le dipendenze di questi dispositivi formano un anello e non portano alla centrale: mappatura da ripetere.',
      doveIntervenire: ['Ripetere la mappatura.'],
    });
  }
  return out;
}

// ───────── dati per dispositivo ─────────

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function analizzaDettagli(l: LetturaPol): Anomalia[] {
  const dd = l.dettagli ?? [];
  if (!dd.length) return [];
  const out: Anomalia[] = [];
  const lato = l.ramo === 'chiuso' ? 'loop chiuso' : `lato ${l.ramo}`;
  const nome = (d: DispositivoMnt) => breve(idNodo(d.famiglia, d.indirizzo));

  const illeggibili = dd.filter(datiIllegibili);
  if (illeggibili.length) {
    out.push({
      codice: `MNT_ILLEGGIBILI_${l.ramo}`,
      gravita: illeggibili.length >= 3 ? 'alta' : 'media',
      titolo: `Risposte corrotte (${lato}): ${illeggibili.map(nome).join(', ')}`,
      spiegazione:
        'Seriale o costruttore non leggibili (XXXXXXXX / XXX), spesso con costruttore o data di produzione incoerenti: la risposta del dispositivo arriva disturbata. Sono i dispositivi che il POL mostra come «??».',
      doveIntervenire: ['Controllare base e cablaggio di questi dispositivi.', 'Se sono vicini tra loro, cercare un problema nel tratto di linea che li alimenta.'],
      riferimenti: illeggibili.map((d) => idNodo(d.famiglia, d.indirizzo)),
    });
  }

  const costruttori = dd.filter((d) => !datiIllegibili(d)).map((d) => d.costruttore);
  const frequenza = new Map<string, number>();
  for (const c of costruttori) frequenza.set(c, (frequenza.get(c) ?? 0) + 1);
  const principale = [...frequenza.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const diversi = principale ? dd.filter((d) => !datiIllegibili(d) && d.costruttore !== principale) : [];
  if (diversi.length) {
    out.push({
      codice: `MNT_COSTRUTTORE_${l.ramo}`,
      gravita: 'bassa',
      titolo: `Costruttore diverso dagli altri (${lato}): ${diversi.map((d) => `${nome(d)} ${d.costruttore}`).join(', ')}`,
      spiegazione: `Gli altri dispositivi sono ${principale}. Può essere un dispositivo di altra marca oppure una risposta disturbata.`,
      doveIntervenire: ['Verificare il dispositivo installato.'],
    });
  }

  // PW1 di riferimento: circa 300 ±10% per i protocolli Notifier (manuale POL). Gli zeri = non campionato.
  const pwFuori = dd.filter((d) => d.pw[0] > 0 && (d.pw[0] < 270 || d.pw[0] > 330));
  if (pwFuori.length) {
    out.push({
      codice: `MNT_PW1_${l.ramo}`,
      gravita: 'media',
      titolo: `PW1 fuori da 300 ±10% (${lato}): ${pwFuori.map((d) => `${nome(d)} ${d.pw[0]}`).join(', ')}`,
      spiegazione: 'Secondo il manuale del POL-200-TS il valore PW1 dovrebbe essere circa 300 ±10% per i protocolli Notifier: valori diversi vanno segnalati all\'assistenza tecnica Honeywell.',
      doveIntervenire: ['Ripetere la lettura; se confermato, contattare l\'assistenza tecnica.'],
    });
  }

  // STA: significato non documentato; si segnalano i valori molto diversi dagli altri
  const sta = dd.map((d) => (d.sta && /^\d+$/.test(d.sta) ? Number(d.sta) : NaN));
  const med = mediana(sta.filter((x) => !Number.isNaN(x)));
  const staStrani = dd.filter((_d, i) => !Number.isNaN(sta[i]) && Math.abs(sta[i] - med) > 10);
  if (staStrani.length && med > 0) {
    out.push({
      codice: `MNT_STA_${l.ramo}`,
      gravita: 'info',
      titolo: `Valore STA diverso dagli altri (${lato}): ${staStrani.map((d) => `${nome(d)} ${d.sta}`).join(', ')}`,
      spiegazione: `La maggior parte dei dispositivi ha STA ≈ ${med}. Il significato della colonna STA non è documentato nel manuale: da approfondire, spesso coincide con le risposte corrotte.`,
      doveIntervenire: [],
    });
  }
  return out;
}

/** Differenze tra due letture da file dello stesso lato: dati che cambiano = risposte instabili; dispositivi fantasma. */
export function confrontaDettagli(prima: LetturaPol, dopo: LetturaPol): Anomalia[] {
  if (!prima.dettagli?.length || !dopo.dettagli?.length) return [];
  const mp = new Map(prima.dettagli.map((d) => [idNodo(d.famiglia, d.indirizzo), d]));
  const md = new Map(dopo.dettagli.map((d) => [idNodo(d.famiglia, d.indirizzo), d]));
  const instabili: string[] = [];
  for (const [k, d] of md) {
    const p = mp.get(k);
    if (p && (p.seriale !== d.seriale || p.costruttore !== d.costruttore || p.dataProd !== d.dataProd || p.tipoCodice !== d.tipoCodice)) instabili.push(k);
  }
  const fantasma = [...md.keys(), ...mp.keys()].filter((k, i, a) => a.indexOf(k) === i && (!mp.has(k) || !md.has(k)) && datiIllegibili((md.get(k) ?? mp.get(k))!));
  const out: Anomalia[] = [];
  const lato = dopo.ramo === 'chiuso' ? 'loop chiuso' : `lato ${dopo.ramo}`;
  if (instabili.length) {
    out.push({
      codice: `MNT_INSTABILI_${dopo.ramo}`,
      gravita: 'alta',
      titolo: `Risposte instabili tra due letture (${lato}): ${instabili.map(breve).join(', ')}`,
      spiegazione:
        'Lo stesso dispositivo risponde con seriale, costruttore, data o tipo diversi da una lettura all\'altra: un dispositivo reale non cambia questi dati. La comunicazione con questi indirizzi è disturbata.',
      doveIntervenire: ['Cercare un problema di linea (giunzioni, schermo, umidità) nel tratto di questi dispositivi.', 'Confrontare con la mappatura per localizzare il tratto.'],
      riferimenti: instabili,
    });
  }
  if (fantasma.length) {
    const nn = fantasma.filter((k) => k[0] === 'S').map((k) => Number(k.slice(1)));
    const mm = fantasma.filter((k) => k[0] === 'M').map((k) => Number(k.slice(1)));
    out.push({
      codice: `MNT_FANTASMA_${dopo.ramo}`,
      gravita: 'media',
      titolo: `Probabili risposte fantasma (${lato}): ${[nn.length ? `sensori ${intervalli(nn)}` : '', mm.length ? `moduli ${intervalli(mm)}` : ''].filter(Boolean).join('; ')}`,
      spiegazione: 'Indirizzi che compaiono in una sola delle due letture e con dati illeggibili: con ogni probabilità non sono dispositivi reali ma disturbi sulla linea.',
      doveIntervenire: ['Non programmarli. Verificare con la planimetria che a quegli indirizzi non ci siano dispositivi.'],
      riferimenti: fantasma,
    });
  }
  return out;
}

export const famigliaDaId = (id: string): FamigliaPol => (id[0] === 'S' ? 'sensori' : 'moduli');

/** Regole sui file importati: dettagli e mappatura delle ultime letture, instabilità tra letture dello stesso lato. */
export function analizzaFileLetture(letture: readonly LetturaPol[], sigle: readonly SiglaPol[], soglie: Pick<Soglie, 'maxDispositiviLoopAperto'>): Anomalia[] {
  const out: Anomalia[] = [];
  for (const ramo of ['A', 'B', 'chiuso'] as const) {
    const ultima = ultimaLettura(letture, ramo);
    if (!ultima?.dettagli?.length) continue;
    out.push(...analizzaDettagli(ultima), ...analizzaMappa(ultima, sigle, soglie));
    const precedente = [...letture]
      .filter((l) => l.ramo === ramo && l !== ultima && l.dettagli?.length && l.ora <= ultima.ora)
      .sort((a, b) => (a.ora < b.ora ? 1 : -1))[0];
    if (precedente) out.push(...confrontaDettagli(precedente, ultima));
  }
  return out;
}
