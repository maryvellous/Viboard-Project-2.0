# Diaspro Post-it

Elemento UI riutilizzabile del design system **Diaspro**: il post-it "carta
calda" estratto da Diaspro Viboard e reso autonomo. Niente React, niente
context, niente Electron e **nessuna logica task**: è un contenitore generico
con il solo comportamento necessario (drag e apertura/chiusura).

Due varianti, fedeli alle rispettive fonti:

- **`floating`** — i foglietti trascinabili della vista **Oggi** (`StickyNote.jsx`).
- **`overlay`** — il post-it ancorato in alto a destra delle card **Progetti**
  (`.postit-floating-overlay`).

In entrambe le varianti l'identità è la stessa: carta calda, lieve rotazione,
ombra profonda e **nastro adesivo superiore** (l'elemento che lo rende un
oggetto fisico sopra l'interfaccia e non una semplice card gialla).

## Riferimenti

- **Nota flottante** (carta, ombra, bordo, drag, rotazione casuale −3°…+3°):
  `src/components/StickyNote.jsx`.
- **Post-it overlay** (gradiente carta, rotazione −1.5°, nastro adesivo,
  header/content, fade-in): `src/components/ProjectsView.jsx` +
  `src/index.css` (`.postit-floating-overlay`).
- **Badge trigger** (apre/chiude l'overlay): `.task-sticker-badge` in
  `src/index.css`.

## Struttura

```
diaspro-ui/postit/
├── postit.css   # stile, varianti e animazioni (namespace .diaspro-postit)
├── postit.js    # comportamento: drag + apertura/chiusura (vanilla JS)
├── demo.html    # demo autonoma (floating + overlay ancorato a una card)
└── README.md
```

## Uso

Apri `demo.html` nel browser (nessuna build richiesta). Per integrarlo:

```html
<link rel="stylesheet" href="diaspro-ui/postit/postit.css" />
<script src="diaspro-ui/postit/postit.js"></script>
```

### Nota flottante

```js
const note = DiasproPostit.createFloating({
  x: 120, y: 80,               // posizione iniziale (opzionale: casuale)
  rotation: -1.4,              // gradi (opzionale: casuale tra -3 e +3)
  text: 'Scrivi qui...',
  placeholder: 'Scrivi una nota...',
  onUpdate: ({ x, y, text }) => {},   // chiamato su drag/edit
  onDelete: () => {},                 // chiamato alla chiusura
});
board.appendChild(note.el);    // "board" deve essere position: relative
```

> Il drag parte dalla carta, **non** dalla textarea né dai pulsanti (come
> nell'originale). Funziona sia con mouse sia con touch.

### Post-it overlay

```js
const overlay = DiasproPostit.createOverlay({
  anchor: card,                // elemento card: DEVE essere position: relative
  title: 'Tasks Post-it',
  open: false,                 // parte chiuso
  onClose: () => {},
});
overlay.body.appendChild(...);   // contenuto libero
overlay.footer.appendChild(...); // eventuale form / azioni

trigger.addEventListener('click', () => overlay.toggle());
```

L'overlay si chiude con la ✕ oppure con `Escape`. Il contenuto (`body`,
`footer`) è totalmente a carico dell'integratore: nessuna logica task è
incorporata nel componente.

### Trigger (facoltativo)

La classe `.diaspro-postit-trigger` replica il badge originale per aprire/
chiudere l'overlay:

```html
<button class="diaspro-postit-trigger">3 note</button>
```
## API

### `DiasproPostit.createFloating(options)`

| Opzione        | Tipo                 | Default              | Descrizione                                   |
| -------------- | -------------------- | -------------------- | --------------------------------------------- |
| `x`, `y`       | `number`             | casuale              | Posizione iniziale (px).                      |
| `rotation`     | `number`             | casuale (−3…+3)      | Rotazione in gradi.                           |
| `text`         | `string`             | `''`                 | Testo iniziale.                               |
| `placeholder`  | `string`             | `'Scrivi una nota…'` | Placeholder della textarea.                   |
| `onUpdate`     | `(changes) => void`  | —                    | `{ x, y }` in drag, `{ text }` in edit.       |
| `onDelete`     | `() => void`         | —                    | Chiamato alla chiusura della nota.            |

Ritorna `{ el, text (get/set), setPosition(x, y), remove() }`.

### `DiasproPostit.createOverlay(options)`

| Opzione    | Tipo               | Default           | Descrizione                                  |
| ---------- | ------------------ | ----------------- | -------------------------------------------- |
| `anchor`   | `Element`          | **obbligatorio**  | Card a cui ancorare il post-it.              |
| `title`    | `string`           | `'Tasks Post-it'` | Titolo nell'header.                          |
| `open`     | `boolean`          | `true`            | Stato iniziale.                              |
| `onClose`  | `() => void`       | —                 | Chiamato quando viene chiuso.                |

Ritorna `{ el, body, footer, open(), close(), toggle(), isOpen }`.

### Helper

- `DiasproPostit.randomRotation()` → gradi casuali (−3…+3).
- `DiasproPostit.randomPosition()` → `{ x, y }` casuali nell'area in alto.
- `DiasproPostit.icons.x` / `DiasproPostit.icons.note` → SVG inline.

## Classi CSS principali

| Classe                         | Ruolo                                          |
| ------------------------------ | ---------------------------------------------- |
| `.diaspro-postit`              | Blocco base (posizionamento + rotazione).      |
| `.diaspro-postit--floating`    | Variante nota trascinabile.                    |
| `.diaspro-postit--overlay`     | Variante ancorata alla card.                   |
| `.diaspro-postit--dragging`    | Stato durante il drag (cursore + ombra).       |
| `.diaspro-postit__paper`       | La carta (sfondo, bordo, ombra, nastro).       |
| `.diaspro-postit__close`       | Pulsante ✕.                                    |
| `.diaspro-postit__textarea`    | Area di testo della nota flottante.            |
| `.diaspro-postit__header`      | Header dell'overlay.                           |
| `.diaspro-postit__title`       | Titolo dell'overlay.                           |
| `.diaspro-postit__body`        | Contenuto scrollabile dell'overlay.            |
| `.diaspro-postit__footer`      | Area azioni dell'overlay.                      |
| `.diaspro-postit__form`/`__input`/`__submit` | Pattern "aggiungi nota".        |
| `.diaspro-postit-trigger`      | Badge per aprire/chiudere l'overlay.           |

## Personalizzazione (CSS custom properties)

Tutti i valori si sovrascrivono su `.diaspro-postit`:

```css
.diaspro-postit {
  --diaspro-postit-paper: #efdebd;
  --diaspro-postit-ink: #1e1333;
  --diaspro-postit-border: rgba(120, 80, 118, 0.55);
  --diaspro-postit-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(154,133,192,0.18);
  --diaspro-postit-rotation: 0deg;
}
```

## Fedeltà visiva

Colori, bordo, raggi, ombre, rotazioni, nastro adesivo (60×18px, bianco al 60%
con `blur(4px)`) e microinterazioni (hover ✕ → terracotta, fade-in dell'overlay)
sono replicati dalle fonti. Variazioni consapevoli rispetto all'originale:

- Il **nastro adesivo** è applicato a entrambe le varianti: nell'originale è
  presente solo sull'overlay, ma qui è trattato come firma comune del sistema
  per mantenere coerente la "sensazione di oggetto fisico".
- Il drag usa **pointer events** (mouse + touch) invece dei soli eventi mouse
  dell'originale; il comportamento resta identico.
- Il fade-in dell'overlay è un'approssimazione (opacità + leggero
  `translateY`) della classe utilitaria `animate-fadeIn` di Viboard.

