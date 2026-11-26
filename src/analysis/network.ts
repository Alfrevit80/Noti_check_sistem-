// Regole di analisi per la rete tra centrali.
import type { Centrale, Rete } from '../model/types';
import { ordinaAnomalie, type Anomalia, type Gravita } from './findings';
import { LIMITI_LINEA } from '../settings/tipiHw';

interface RegolaVoce {
  gravita: Gravita;
  titolo: string;
  spiegazione: string;
  passi: string[];
}

// Cosa significa una risposta "No" a ciascuna voce della checklist predefinita.
const SE_NO: Record<string, RegolaVoce> = {
  continuita: {
    gravita: 'alta',
    titolo: 'Continuità del bus non verificata o interrotta',
    spiegazione: 'Una tratta del bus interrotta isola una o più CPU dalla rete.',
    passi: [
      'Scollegare il bus in ogni CPU e misurare la continuità tratta per tratta.',
      'Controllare i morsetti del bus nelle centrali e nelle eventuali scatole di giunzione.',
    ],
  },
  terminazioni: {
    gravita: 'alta',
    titolo: 'Terminazioni del bus non corrette',
    spiegazione:
      'Terminazioni mancanti, doppie o in posizione intermedia causano errori di comunicazione intermittenti.',
    passi: [
      'Verificare che la terminazione sia inserita solo sulle due CPU agli estremi (topologia lineare).',
      'Con il bus scollegato dalle CPU, misurare la resistenza tra le due linee dati e confrontarla con il manuale.',
    ],
  },
  schermo: {
    gravita: 'media',
    titolo: 'Schermo del bus non collegato correttamente',
    spiegazione: 'Lo schermo collegato a terra in più punti crea anelli di massa e disturbi sulla comunicazione.',
    passi: ['Collegare lo schermo a terra in un solo punto e garantirne la continuità lungo tutto il bus.'],
  },
  indirizzi: {
    gravita: 'critica',
    titolo: 'Indirizzi di rete delle CPU non univoci',
    spiegazione: 'Due CPU con lo stesso indirizzo impediscono il corretto funzionamento della rete.',
    passi: ['Assegnare un indirizzo di rete diverso a ogni CPU e riavviare la rete.'],
  },
  comunicazione: {
    gravita: 'alta',
    titolo: 'Una o più CPU non risultano in rete',
    spiegazione: 'La centrale segnala un guasto di comunicazione verso almeno un nodo.',
    passi: [
      'Leggere sul display quale nodo è in guasto.',
      'Controllare alimentazione e scheda di rete della CPU indicata, poi la tratta di bus che la raggiunge.',
    ],
  },
  archivi: {
    gravita: 'alta',
    titolo: 'Archivi non allineati tra le CPU',
    spiegazione: 'Con archivi diversi gli eventi e le logiche di rete possono non essere eseguiti come previsto.',
    passi: ['Riallineare gli archivi dalla CPU di riferimento e verificare l\'esito su tutte le CPU.'],
  },
  orologio: {
    gravita: 'bassa',
    titolo: 'Data e ora non sincronizzate',
    spiegazione: 'Lo storico eventi delle diverse CPU risulta difficile da confrontare.',
    passi: ['Impostare data e ora e sincronizzarle su tutta la rete.'],
  },
  backup: {
    gravita: 'media',
    titolo: 'Backup su USB non eseguito',
    spiegazione: 'Senza backup, in caso di guasto della CPU la programmazione va ricostruita da zero.',
    passi: ['Eseguire il backup della configurazione su chiavetta USB e conservarne una copia con la documentazione.'],
  },
};

export function analizzaRete(rete: Rete | undefined | null, centrali: Centrale[]): Anomalia[] {
  const out: Anomalia[] = [];

  // indirizzi CPU duplicati: si vedono anche senza rete compilata
  const perNodo = new Map<string, Centrale[]>();
  for (const c of centrali) {
    const k = c.nodoCpu.trim();
    if (!k) continue;
    perNodo.set(k, [...(perNodo.get(k) ?? []), c]);
  }
  for (const [nodo, lista] of perNodo) {
    if (lista.length > 1) {
      out.push({
        codice: 'RETE_NODO_DUPLICATO',
        gravita: 'critica',
        titolo: `Indirizzo CPU ${nodo} usato da ${lista.length} centrali`,
        spiegazione: 'Ogni CPU in rete deve avere un indirizzo univoco.',
        doveIntervenire: [`Correggere l'indirizzo di: ${lista.map((c) => c.nome).join(', ')}.`],
        riferimenti: lista.map((c) => c.id),
      });
    }
  }

  for (const c of centrali) {
    const k = c.nodoCpu.trim();
    if (!k) continue;
    const n = Number(k);
    if (!Number.isInteger(n) || n < 1 || n > LIMITI_LINEA.indirizzoReteMax) {
      out.push({
        codice: 'RETE_NODO_FUORI_RANGE',
        gravita: 'media',
        titolo: `Indirizzo CPU "${k}" non valido (${c.nome})`,
        spiegazione: `L'indirizzo della centrale sul CAN-BUS va da 1 a ${LIMITI_LINEA.indirizzoReteMax}.`,
        doveIntervenire: ['Correggere l\'indirizzo (Menù Programmazione → Sistema → Indirizzo).'],
        riferimenti: [c.id],
      });
    }
  }

  if (centrali.length < 2) return ordinaAnomalie(out);

  if (!rete) {
    out.push({
      codice: 'RETE_NON_COMPILATA',
      gravita: 'info',
      titolo: 'Rete tra centrali non ancora verificata',
      spiegazione: `L'impianto ha ${centrali.length} centrali: compila la sezione Rete.`,
      doveIntervenire: ['Aprire la sezione Rete e compilare tipo, topologia e checklist.'],
    });
    return ordinaAnomalie(out);
  }

  if (rete.statoBus === 'Guasto' || rete.statoBus === 'Intermittente') {
    out.push({
      codice: rete.statoBus === 'Guasto' ? 'RETE_BUS_GUASTO' : 'RETE_BUS_INTERMITTENTE',
      gravita: rete.statoBus === 'Guasto' ? 'alta' : 'media',
      titolo: `Bus di rete: ${rete.statoBus.toLowerCase()}`,
      spiegazione:
        rete.statoBus === 'Guasto'
          ? 'La centrale segnala il bus in guasto.'
          : 'Errori intermittenti indicano spesso terminazioni, schermo o un contatto incerto.',
      doveIntervenire: [
        'Verificare continuità, terminazioni e schermo del bus (vedi checklist).',
        rete.topologia === 'Anello'
          ? 'In anello: individuare la tratta aperta leggendo da quale lato ciascuna CPU riceve.'
          : 'Sezionare il bus a metà per isolare la tratta in guasto.',
      ],
    });
  }

  const idCentrali = new Set(centrali.map((c) => c.id));
  const collegate = rete.centraliCollegate.filter((id) => idCentrali.has(id));
  const scollegate = centrali.filter((c) => !collegate.includes(c.id));
  if (scollegate.length > 0) {
    out.push({
      codice: 'RETE_CPU_NON_COLLEGATE',
      gravita: 'media',
      titolo: `${scollegate.length} centrale/i non indicate come collegate in rete`,
      spiegazione: 'Se la centrale deve far parte della rete, va collegata e configurata.',
      doveIntervenire: [`Verificare: ${scollegate.map((c) => `${c.nome} (CPU ${c.nodoCpu || '?'})`).join(', ')}.`],
      riferimenti: scollegate.map((c) => c.id),
    });
  }

  if (rete.tipo === 'Altro' && !rete.tipoAltro.trim()) {
    out.push({
      codice: 'RETE_TIPO_NON_DESCRITTO',
      gravita: 'bassa',
      titolo: 'Tipo di comunicazione non descritto',
      spiegazione: 'È stato scelto "Altro" senza specificare il tipo.',
      doveIntervenire: ['Indicare il tipo di comunicazione usato.'],
    });
  }

  if (rete.topologia === 'Anello' && collegate.length > 0 && collegate.length < 2) {
    out.push({
      codice: 'RETE_ANELLO_INCOMPLETO',
      gravita: 'bassa',
      titolo: 'Anello con una sola CPU indicata',
      spiegazione: 'Un anello richiede almeno due CPU collegate.',
      doveIntervenire: ['Completare l\'elenco delle CPU collegate.'],
    });
  }

  const daVerificare: string[] = [];
  for (const v of rete.checklist) {
    if (v.esito === 'no') {
      const r = SE_NO[v.id];
      out.push({
        codice: `RETE_CHECK_${v.id.toUpperCase()}`,
        gravita: r?.gravita ?? 'media',
        titolo: r?.titolo ?? `Non conforme: ${v.testo}`,
        spiegazione: [r?.spiegazione, v.nota && `Nota: ${v.nota}`].filter(Boolean).join(' '),
        doveIntervenire: r?.passi ?? ['Risolvere il punto indicato e ripetere la verifica.'],
      });
    } else if (v.esito === null) {
      daVerificare.push(v.testo);
    }
  }
  if (daVerificare.length > 0) {
    out.push({
      codice: 'RETE_CHECK_INCOMPLETA',
      gravita: 'info',
      titolo: `Checklist di rete: ${daVerificare.length} voci da verificare`,
      spiegazione: daVerificare.join('; '),
      doveIntervenire: ['Completare le voci mancanti.'],
    });
  }

  return ordinaAnomalie(out);
}
