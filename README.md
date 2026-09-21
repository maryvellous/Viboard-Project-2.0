# Diaspro Viboard

Seconda generazione di Viboard basata sul progetto open source **desk.md**, adattata all'identità e al flusso di lavoro Diaspro.

La base resta local-first: spazi di lavoro, progetti, attività, documenti e riunioni sono salvati come normali file Markdown. Il progetto supporta sia l'app desktop locale sia la modalità self-hosted.

## Stato del progetto

Il fork è in fase di trasformazione attiva da Desk a Diaspro Viboard.

Sono già integrati nell'app:

- identità visiva Diaspro, palette, tipografia, logo e navigazione;
- dashboard con calendario, focus, raccolta rapida e quick-add;
- viste progetti con card Diaspro e task in formato post-it;
- planner settimanale;
- attività, documenti e riunioni;
- localizzazione italiana completa e risorse i18n;
- shell desktop e metadati applicativi con branding Diaspro Viboard.

La cartella `diaspro-ui/` resta il kit di riferimento per i pattern visivi e contiene card, lava, post-it, calendar strip e guida visuale.

### Naming interno

Per ridurre il rischio durante la migrazione, i namespace tecnici ereditati restano temporaneamente invariati:

- `@desk/core`
- `@desk/app`
- `@desk/server`
- `DeskService` e la cartella dominio `src/desk/`

Questi identificatori sono dettagli interni e non rappresentano il nome del prodotto. Il loro eventuale rename verrà affrontato come refactor separato dopo un checkpoint CI pulito.

## Stack

- React 19
- TypeScript
- Vite
- Tauri 2
- Rust
- Zustand
- TanStack Query
- Tiptap
- Tailwind CSS
- Vitest
- Node 22
- Hono per il server self-hosted

## Struttura

```text
Viboard-Project-2.0/
├── packages/
│   ├── core/            # Dominio condiviso
│   ├── app/             # Applicazione React + Tauri
│   └── server/          # Backend self-hosted e MCP
├── diaspro-ui/          # Kit e riferimenti visuali Diaspro
├── deploy/              # Configurazione self-hosting
├── docs/
├── tests/
└── package.json
```

## Sviluppo locale

Richiede Node 22.

```bash
npm install
npm run dev
```

Per eseguire l'app desktop con filesystem reale:

```bash
npm run tauri:dev
```

Checkpoint completo:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:storage
npm run build
npm run build:hosted -w @desk/app
```

Le pull request eseguono questi controlli tramite GitHub Actions. Le modifiche a `packages/app/src-tauri/` attivano anche `cargo check` su macOS, Linux e Windows.

## Release e aggiornamenti

L'app desktop usa il repository `maryvellous/Viboard-Project-2.0` come sorgente per release e aggiornamenti. Prima della prima release pubblica va configurata la chiave di firma Tauri del progetto e verificata la relativa chiave pubblica in `tauri.conf.json`.

## Upstream

Progetto originale: `v1lling/desk.md`.

La struttura tecnica di base, parte della cronologia e gli avvisi di licenza derivano dal progetto upstream.

## Licenza

GPL-3.0-or-later. Vedi `LICENSE`.
