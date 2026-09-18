# Viboard Project 2.0

Repository di esplorazione per una possibile seconda generazione di Viboard, basato su **desk.md**.

Questo repository è un fork di `v1lling/desk.md`: la codebase principale conserva ancora struttura, naming e architettura di Desk, mentre la cartella `diaspro-ui/` raccoglie materiale e prove visive per l'adattamento all'identità Diaspro/Viboard.

## Base tecnica

La base upstream è un workspace manager local-first in cui progetti, task, documenti e meeting restano file Markdown normali.

L'architettura è un monorepo npm con:

- `@desk/core` — dominio e accesso ai dati;
- `@desk/app` — client React + Tauri;
- `@desk/server` — server Node per modalità self-hosted, auth e MCP.

Il progetto supporta sia uso desktop locale sia una modalità self-hosted.

## Stato di questo fork

Il fork non è ancora una riscrittura completa di Viboard.

Al momento:

- il codice applicativo principale è ancora quello di Desk;
- package, namespace e documentazione tecnica interna usano ancora il naming `desk`;
- `diaspro-ui/` contiene il lavoro di esplorazione visuale e componenti di riferimento;
- non va quindi presentato come una release autonoma di Viboard già pronta.

## Stack ereditato

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
├── diaspro-ui/          # Esperimenti e riferimenti visuali Diaspro
├── deploy/              # Configurazione self-hosting
├── docs/
├── tests/
└── package.json
```

## Sviluppo locale

La codebase upstream richiede Node 22.

```bash
npm install
npm run dev
```

Per eseguire l'app desktop con filesystem reale:

```bash
npm run tauri:dev
```

Controlli principali:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Diaspro UI

La cartella `diaspro-ui/` contiene materiale di progettazione separato dalla base applicativa:

- linee guida palette;
- componenti e card;
- prove della lava;
- post-it;
- calendar strip;
- guida visuale HTML.

Questi file rappresentano il livello di esplorazione grafica del fork e non implicano che tutta la UI upstream sia già stata sostituita.

## Upstream

Progetto originale: `v1lling/desk.md`.

La cronologia e il codice di base restano soggetti alla licenza e agli avvisi del progetto upstream.

## Licenza

GPL-3.0-or-later, come il progetto upstream. Vedi `LICENSE`.