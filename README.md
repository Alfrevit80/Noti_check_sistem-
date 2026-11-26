# Notifier Check System

Web app installabile (PWA) per i tecnici di impianti antincendio: verifiche e test preliminari
prima della messa in servizio delle centrali di rivelazione incendio
(Notifier AM-8200N con schede LIB-8200N; il modello è configurabile).

Funziona offline. I dati restano sul dispositivo (IndexedDB) e si trasferiscono tra dispositivi
esportando e importando un progetto in formato JSON.

## Avvio

```bash
npm install
npm run dev       # sviluppo, http://localhost:5173 (raggiungibile anche dal telefono in rete locale)
npm test          # test delle regole di analisi, del database e dell'export/import
npm run build     # build di produzione in dist/
npm run preview   # prova della build (service worker incluso)
```

## Struttura

| Cartella | Contenuto |
|---|---|
| `src/model/` | Tipi TypeScript del modello dati e schemi Zod per validare i file importati |
| `src/db/` | Database Dexie (IndexedDB), operazioni CRUD, export/import JSON |
| `src/analysis/` | Regole di analisi **pure** (nessuna dipendenza da React), testate in `tests/` |
| `src/settings/` | Valori predefiniti: soglie, modelli di centrale, checklist di rete |
| `src/ui/` | Pagine e componenti React |
| `tests/` | Test Vitest |

## Stato delle fasi

1. ✅ Struttura, modello dati, anagrafica impianto e centrali, rete tra centrali, export/import, PWA
2. ⏳ Procedura guidata del loop e tabelle misure
3. ⏳ Griglie POL e analisi lato A / lato B
4. ⏳ Import file POL-200-TS (.MNT, log)
5. ⏳ Rapportino PDF
6. ⏳ Integrazione con Claude

## Pubblicazione

Il workflow `.github/workflows/pages.yml` esegue i test, fa la build e pubblica su GitHub Pages
(impostare in *Settings → Pages → Source: GitHub Actions*).
