# AGENTS.md — Viboard-Project-2.0

## Divisione del lavoro
- ChatGPT in chat gestisce direttamente su GitHub lettura/scrittura del codice, documentazione, branch, commit, PR, review e controlli CI, anche per modifiche consistenti.
- Codex serve per browser interattivo, avvio dell'app, build/test locali, debugging runtime, verifiche visive e collaudi operativi autorizzati: non consumarlo per operazioni fattibili via GitHub.
- Quando servono entrambi: ChatGPT implementa, Codex verifica, ChatGPT corregge su GitHub. Codex modifica codice se necessario al test locale o se espressamente richiesto.
- Non delegare all'utente operazioni che puoi svolgere con gli strumenti disponibili.

## Goal e scelte
- Completa il risultato richiesto end-to-end, senza approvazioni di micro-task già definiti.
- Autonomia tecnica, non progettuale: rispetta i comportamenti e i compromessi approvati. Chiedi solo se una decisione irrisolta cambia prodotto, sicurezza, dati o scope.
- Mantieni i cambiamenti focalizzati; niente refactor estranei, nuove dipendenze o servizi inutili, astrazioni preventive, integrazioni simulate o procedure inventate.
- Preserva ciò che funziona; evita costi ricorrenti e riscritture senza necessità dimostrata.
- Leggi le specifiche pertinenti e segui i pattern del progetto, senza duplicare la documentazione in questo file.

## Verifica, Git e sicurezza
- Usa test proporzionati al goal; indica test eseguiti e risultati, oppure «non eseguiti». La CI verde non prova da sola il funzionamento in browser o sul dispositivo.
- Distingui scritto, committato, verificato in CI, testato localmente e distribuito. Codex deve riportare passi di riproduzione ed evidenze concrete.
- Prima di intervenire controlla stato del branch, PR aperte e modifiche esistenti; non sovrascrivere lavoro non correlato. Commit e PR mirati.
- Niente force-push, merge o deploy in produzione senza incarico esplicito. Non fare migrazioni distruttive, cancellazioni di dati o modifiche a sistemi live senza autorizzazione.
- Non registrare o divulgare segreti, token, credenziali o dati personali; nei test usa dati sintetici.

## Progetto: Diaspro Viboard
- Fonti: `README.md`, `CLAUDE.md` (architettura e comandi), `CHANGELOG.md` e specifiche pertinenti in `docs/`. Il file `CLAUDE.md` descrive più in dettaglio i confini dei package; non duplicarlo.
- Usa Node 22: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run verify:storage`, `npm run build`; desktop reale con `npm run tauri:dev` e `npm run tauri:build`.
- Confini: `packages/core` dominio local-first, `packages/app` React/Tauri, `packages/server` compatibilità/servizi. Non accoppiare il core a React o all'host.
- I documenti Markdown locali dell'utente sono canonici; non convertirli in un database proprietario. Mantieni i namespace interni `@desk/*` ereditati finché non sia approvata una migrazione dedicata.
