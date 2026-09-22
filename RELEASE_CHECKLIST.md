# Release checklist

Questa checklist descrive il processo consigliato per una release pubblica stabile di Diaspro Viboard.

## Piattaforma ufficiale

La piattaforma supportata per la prima release stabile è:

- Windows 10/11 x64

Linux resta sperimentale finché non viene eseguito un ciclo completo di test manuale e packaging su una distribuzione supportata.

## Prima della release

- [ ] Installare l'ultima preview su un PC Windows reale.
- [ ] Verificare l'icona in installer, Start, taskbar e finestra.
- [ ] Verificare la sidebar e il branding Diaspro.
- [ ] Provare una nuova installazione senza dati precedenti.
- [ ] Provare un aggiornamento sopra la versione precedente.
- [ ] Creare, rinominare ed eliminare un progetto.
- [ ] Creare e modificare attività.
- [ ] Creare e modificare documenti.
- [ ] Verificare Pianificatore e Dashboard.
- [ ] Cambiare cartella dati e riaprire l'app.
- [ ] Provare almeno un provider AI configurato dall'utente.
- [ ] Verificare che l'app funzioni anche senza alcuna chiave AI.
- [ ] Verificare chiusura/riapertura con modifiche salvate.
- [ ] Verificare disinstallazione e reinstallazione.

## Repository GitHub

Prima di annunciare la release:

- [ ] GitHub Issues abilitate.
- [ ] Private vulnerability reporting / Security Advisories abilitati.
- [ ] Descrizione repository aggiornata a Diaspro Viboard.
- [ ] README, SECURITY, CONTRIBUTING e NOTICE aggiornati.
- [ ] Branch protection su `main` consigliata.
- [ ] CI verde sull'ultimo commit di `main`.

## Versione

Per una release stabile, aggiornare la stessa versione in:

- `packages/app/package.json`
- `packages/core/package.json`
- `packages/server/package.json`
- `packages/app/src-tauri/tauri.conf.json`
- `package-lock.json`

Esempio prima release stabile: `1.0.0`.

## Pubblicazione

Il workflow `.github/workflows/release.yml` parte soltanto da tag `v*`.

Esempio:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Il tag deve corrispondere esattamente alla versione dell'app.

I tag con suffisso, ad esempio `v1.0.0-rc.1`, vengono pubblicati come prerelease.

## Firma Windows

La firma Authenticode non è obbligatoria per distribuire il programma, ma è consigliata per una release destinata a molti utenti perché riduce gli avvisi SmartScreen.

Se la build resta non firmata, documentare chiaramente che Windows può mostrare un avviso all'installazione.

## Aggiornamenti automatici

L'auto-updater Tauri è intenzionalmente disabilitato.

Per abilitarlo in futuro:

1. generare una coppia di chiavi Tauri propria di Diaspro;
2. conservare la chiave privata esclusivamente nei GitHub Secrets;
3. inserire la chiave pubblica nella configurazione Tauri;
4. riattivare gli updater artifacts nella release;
5. ripristinare plugin e interfaccia di aggiornamento;
6. testare un aggiornamento reale tra due versioni firmate.

## Linux

Per dichiarare Linux supportato ufficialmente servono almeno:

- una distribuzione target esplicita (es. Ubuntu 24.04 LTS);
- build `.deb` e/o AppImage;
- test manuale dell'installer;
- test di filesystem, keyring e apertura file;
- verifica delle dipendenze WebKitGTK;
- almeno una macchina reale o VM Linux nel ciclo di release.
