# Contributing to Diaspro Viboard

Grazie per l'interesse nel progetto.

Diaspro Viboard è un'app local-first basata su file Markdown e sviluppata principalmente per Windows.

## Come contribuire

Puoi:

- segnalare bug;
- proporre miglioramenti;
- inviare pull request;
- migliorare documentazione e traduzioni.

## Ambiente di sviluppo

### Requisiti

- Node.js 22
- Rust stable
- prerequisiti Tauri per il tuo sistema operativo

### Setup

```bash
npm ci
npm run dev
```

Per usare filesystem e shell reali:

```bash
npm run tauri:dev
```

## Prima di aprire una pull request

Esegui:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:storage
npm run build
```

Le pull request eseguono automaticamente i controlli frontend. Le modifiche Tauri/Rust vengono controllate anche tramite GitHub Actions.

## Piattaforme

Windows 10/11 x64 è la piattaforma ufficialmente supportata.

Le modifiche Linux sono benvenute, ma Linux è ancora considerato sperimentale finché non viene introdotto un processo di release e test manuale dedicato.

## Convenzioni

- crea un branch da `main`;
- mantieni ogni PR focalizzata su un cambiamento coerente;
- aggiorna documentazione e test quando cambi il comportamento;
- evita di rinominare in massa i namespace `@desk/*` senza una migrazione dedicata.

## Upstream

Diaspro Viboard deriva da [desk.md](https://github.com/v1lling/desk.md). Le modifiche di questo fork restano distribuite secondo la stessa licenza GPL.

## Licenza

Contribuendo accetti che il tuo contributo venga distribuito sotto **GPL-3.0-or-later**.
