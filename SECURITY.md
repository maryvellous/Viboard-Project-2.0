# Security Policy

## Versioni supportate

Solo l'ultima release di Diaspro Viboard riceve correzioni di sicurezza.

## Segnalare una vulnerabilità

Non pubblicare vulnerabilità di sicurezza come issue pubbliche.

Preferisci **GitHub Security Advisories → Report a vulnerability** nel repository, se disponibile. Se la segnalazione privata di GitHub non è disponibile, contatta privatamente il maintainer tramite il profilo GitHub del repository.

Includi, se possibile:

- descrizione del problema e impatto;
- passaggi per riprodurlo;
- versione di Diaspro Viboard;
- versione di Windows;
- eventuale proof of concept.

## Ambito

Diaspro Viboard è local-first: progetti, attività e documenti vengono salvati nella cartella dati scelta dall'utente.

Le funzioni AI sono opzionali e possono inviare contenuti ai provider configurati dall'utente (Anthropic, OpenAI o DeepSeek) tramite le rispettive API. Le chiavi API dell'app desktop vengono conservate nel credential store del sistema operativo.

Sono considerate in ambito, tra le altre:

- lettura o modifica non autorizzata dei file locali;
- esfiltrazione inattesa di contenuti;
- esposizione delle chiavi API;
- esecuzione di codice non autorizzata;
- bypass delle restrizioni del filesystem o della shell Tauri.
