# Diaspro Viboard

Diaspro Viboard è un'app desktop local-first per organizzare progetti, attività e documenti in semplici file Markdown.

È un fork evoluto di [desk.md](https://github.com/v1lling/desk.md), adattato al flusso di lavoro e all'identità visiva Diaspro.

## Stato

Diaspro Viboard è attualmente in fase preview.

### Supporto ufficiale

- **Windows 10/11 x64** — supportato e distribuito tramite installer `.exe`.
- **Linux** — il codice resta compatibile e viene controllato in CI, ma al momento non viene distribuito come build ufficiale.
- **macOS** — non è un target di release ufficiale.

Le release disponibili sono pubblicate nella sezione **Releases** di GitHub.

## Funzioni principali

- spazi di lavoro locali;
- progetti;
- attività e pianificazione settimanale;
- documenti Markdown;
- dashboard e raccolta rapida;
- ricerca e command palette;
- modelli per attività e documenti;
- supporto AI opzionale tramite API proprie di Anthropic, OpenAI e DeepSeek;
- dati salvati nella cartella scelta dall'utente, senza server Diaspro.

Diaspro Viboard non richiede un account e non usa un server remoto per conservare i tuoi progetti.

## Dati e privacy

I dati principali restano sul computer dell'utente in file locali.

Le funzioni AI sono opzionali. Quando vengono usate, Diaspro Viboard invia al provider selezionato soltanto i contenuti necessari alla funzione richiesta. Le chiavi API vengono salvate nel credential store del sistema operativo.

## Installazione

### Windows

Scarica l'ultima build dalla pagina **Releases** del repository e avvia l'installer x64.

Le build preview possono non essere firmate digitalmente; Windows SmartScreen può quindi mostrare un avviso.

## Sviluppo

### Requisiti

- Node.js 22
- Rust stable
- prerequisiti Tauri per il sistema operativo

Installa le dipendenze:

```bash
npm ci
```

Avvia il frontend in modalità sviluppo:

```bash
npm run dev
```

Avvia l'app desktop:

```bash
npm run tauri:dev
```

Controlli principali:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:storage
npm run build
```

## Struttura del repository

```text
Viboard-Project-2.0/
├── packages/
│   ├── app/        # React + Tauri
│   ├── core/       # dominio condiviso
│   └── server/     # codice ereditato/compatibilità, non usato dall'app desktop locale
├── diaspro-ui/     # riferimenti visuali Diaspro
├── docs/
├── tests/
└── .github/
```

Alcuni namespace tecnici ereditati da desk.md (`@desk/*`, `DeskService`, ecc.) sono ancora presenti internamente. Non fanno parte del branding pubblico.

## Contribuire

Bug report e pull request sono benvenuti. Vedi [CONTRIBUTING.md](CONTRIBUTING.md).

## Sicurezza

Per vulnerabilità di sicurezza, vedi [SECURITY.md](SECURITY.md). Non pubblicare vulnerabilità sensibili come issue pubbliche.

## Upstream e licenza

Progetto originale: [v1lling/desk.md](https://github.com/v1lling/desk.md).

Diaspro Viboard mantiene la licenza **GPL-3.0-or-later** del progetto upstream. Vedi [LICENSE](LICENSE).
