# Diaspro Installer runtime

Questa cartella contiene la copia minima del runtime necessario alle build Windows di questo repository.

Sorgente canonica: `maryvellous/diaspro-installer`.

I file vendorizzati sono:
- `build.ps1`
- `installer/diaspro-installer.iss`

Motivo: `diaspro-installer` è un repository privato e il `GITHUB_TOKEN` di GitHub Actions non può fare checkout cross-repository senza introdurre un PAT. La copia locale evita segreti aggiuntivi.

Quando il generatore canonico cambia in modo rilevante, sincronizzare questi due file e lasciare che la CI Windows verifichi il nuovo installer.
