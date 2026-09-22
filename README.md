<p align="center">
  <img src="docs/banner.svg" alt="Diaspro Viboard" width="900">
</p>

<p align="center">
  <strong>Progetti, attività, pianificazione e documenti Markdown in un'app desktop local-first.</strong>
</p>

<p align="center">
  <a href="https://github.com/maryvellous/Viboard-Project-2.0/releases/latest"><strong>Scarica per Windows</strong></a>
  ·
  <a href="CHANGELOG.md">Changelog</a>
  ·
  <a href="CONTRIBUTING.md">Contribuire</a>
</p>

---

## Cos'è Viboard

**Diaspro Viboard** è un'app desktop per organizzare il lavoro senza affidare i tuoi dati a un servizio remoto.

Progetti, attività e documenti vengono salvati nella cartella che scegli tu, in file locali e leggibili. Non serve un account e non esiste un server Diaspro che conserva i tuoi contenuti.

La versione stabile attuale è **1.0.1**.

## Cosa puoi farci

- organizzare più spazi di lavoro e progetti;
- creare, ordinare e pianificare attività;
- usare il planner settimanale e la dashboard;
- scrivere documenti in Markdown;
- raccogliere velocemente idee e cose da fare;
- cercare contenuti e usare la command palette;
- creare modelli per attività e documenti;
- usare funzioni AI opzionali tramite le tue API di **Anthropic, OpenAI o DeepSeek**.

## Installazione

### Windows

**Windows 10/11 x64** è la piattaforma ufficialmente supportata.

Scarica l'ultima versione dalla pagina [Releases](https://github.com/maryvellous/Viboard-Project-2.0/releases/latest) e avvia l'installer `.exe`.

Le build possono non essere firmate digitalmente, quindi Windows SmartScreen può mostrare un avviso durante l'installazione.

### Linux

Il codice continua a essere verificato in CI anche su Linux, ma non distribuisco ancora una build Linux ufficiale. Per ora Linux va considerato **sperimentale**.

## Local-first, davvero

I dati principali restano nella cartella locale scelta dall'utente.

Le funzioni AI sono facoltative. Quando le usi, Viboard invia al provider selezionato soltanto i contenuti necessari alla funzione richiesta. Le chiavi API dell'app desktop vengono conservate nel credential store del sistema operativo.

L'auto-updater non è incluso nella 1.0.0: le nuove versioni vengono pubblicate nella sezione Releases.

## Stack

- **Tauri 2** + Rust per l'app desktop;
- **React 19** + TypeScript;
- **Vite**;
- **Tailwind CSS**;
- file Markdown come base del modello local-first.

## Sviluppo

### Requisiti

- Node.js 22
- Rust stable
- prerequisiti Tauri per il sistema operativo

Installa le dipendenze:

```bash
npm ci
```

Avvia il frontend:

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
│   └── server/     # codice ereditato/compatibilità
├── diaspro-ui/     # riferimenti visuali Diaspro
├── docs/
├── tests/
└── .github/
```

Alcuni namespace tecnici ereditati da desk.md, come `@desk/*` e `DeskService`, sono ancora presenti internamente ma non fanno parte del branding pubblico.

## Origine del progetto

Diaspro Viboard nasce come fork di [desk.md](https://github.com/v1lling/desk.md) di Sascha Villing e si è poi evoluto in una versione focalizzata sull'uso desktop locale e sull'identità Diaspro.

Le modifiche principali includono il nuovo sistema visuale, il flusso desktop local-only, la localizzazione italiana, il supporto DeepSeek e la rimozione delle superfici Riunioni/server dall'esperienza utente.

Per l'attribuzione completa vedi [NOTICE.md](NOTICE.md).

## Licenza

Diaspro Viboard mantiene la licenza **GPL-3.0-or-later** del progetto upstream.

Vedi [LICENSE](LICENSE).

## Sicurezza

Per segnalazioni di sicurezza consulta [SECURITY.md](SECURITY.md). Non pubblicare vulnerabilità sensibili come issue pubbliche.
