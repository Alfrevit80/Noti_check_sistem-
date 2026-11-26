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

## Sicurezza

- Al primo avvio si sceglie una **password di accesso**. Tutti i dati salvati sul dispositivo
  (impianti, misure, foto, impostazioni, chiave API) sono cifrati con XSalsa20-Poly1305 (tweetnacl);
  la chiave dei dati è protetta dalla password tramite PBKDF2-SHA256 (600.000 iterazioni, WebCrypto).
  In chiaro su disco restano solo identificativi casuali e date usati negli indici.
- La cifratura è un middleware Dexie (`src/db/cifratura.ts`) al livello più basso: il resto del codice lavora in chiaro.
- Blocco manuale (lucchetto in alto) e automatico dopo N minuti di inattività (Impostazioni → Sicurezza).
- **Password dimenticata = dati non recuperabili** (si possono solo cancellare e reimportare dai file esportati).
- I file di progetto esportati sono **sempre cifrati** con una password scelta all'esportazione;
  il nome del file non contiene il nome del cliente.

## Struttura

| Cartella | Contenuto |
|---|---|
| `src/model/` | Tipi TypeScript del modello dati e schemi Zod per validare i file importati |
| `src/db/` | Database Dexie (IndexedDB), operazioni CRUD, export/import JSON |
| `src/analysis/` | Regole di analisi **pure** (nessuna dipendenza da React), testate in `tests/` |
| `src/security/` | Cifratura, password, sblocco/blocco |
| `src/settings/` | Valori predefiniti: soglie, modelli di centrale, checklist di rete |
| `src/ui/` | Pagine e componenti React |
| `tests/` | Test Vitest |

## Stato delle fasi

1. ✅ Struttura, modello dati, anagrafica impianto e centrali, rete tra centrali, export/import, PWA
2. ✅ Procedura guidata del loop, tabelle misure, regole su isolamento, resistenza, tensioni, cavo, riconoscimento
3. ✅ Griglie POL (inserimento manuale), analisi lato A / lato B, vista sequenza, storico e confronto letture, confronto POL ↔ centrale
4. ⏳ Import file POL-200-TS (.MNT, log)
5. ⏳ Rapportino PDF
6. ⏳ Integrazione con Claude

## Pubblicazione

Il workflow `.github/workflows/ci.yml` esegue test e build a ogni push; dal branch `main`
pubblica anche su GitHub Pages: https://alfrevit80.github.io/Noti_check_sistem-/
(in *Settings → Pages → Source* deve essere selezionato *GitHub Actions*).
