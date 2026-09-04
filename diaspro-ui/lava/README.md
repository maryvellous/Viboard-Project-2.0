# Diaspro Lava

Primo elemento UI riutilizzabile del design system **Diaspro**. È il layer di
"bolle lava lamp" estratto dalla sidebar di Diaspro Viboard e reso autonomo:
niente dipendenze dalla logica di Viboard, niente routing, niente stato globale.

Il layer è un elemento puramente decorativo: riempie il proprio contenitore,
sta dietro al contenuto (z-index 0) e ignora il puntatore.

## Riferimenti

- **Riferimento canonico** (movimento, deformazione, blur, colori, opacità,
  dimensioni, velocità): `src/components/Sidebar.jsx` + `src/index.css`
  (`@keyframes lavalamp`, `.lava-bubble`).
- **Riferimento per contenitori larghi**: `public/banner.svg` — stesso effetto
  adattato a un banner largo tramite **delay negativi** (bolle già in movimento
  al caricamento) e **due bolle extra** sul lato destro per coprire la larghezza.

## Struttura

```
diaspro-ui/lava/
├── DiasproLava.jsx   # componente React (preset `panel` e `banner`)
├── lava.css          # motore dell'effetto (keyframes + stili, namespace .diaspro-lava)
├── index.js          # barrel export
├── README.md
└── demo/
    └── index.html    # demo autonoma delle due configurazioni (senza build)
```

## Uso (React)

```jsx
import { DiasproLava } from './diaspro-ui/lava/index.js';

// Pannello verticale / sidebar
<div className="relative h-full w-32 overflow-hidden bg-sidebar">
  <DiasproLava variant="panel" />
  {/* contenuto in primo piano, z-index > 0 */}
</div>

// Hero / banner / contenitore largo
<div className="relative h-56 w-full overflow-hidden">
  <DiasproLava variant="banner" />
  {/* contenuto in primo piano */}
</div>
```

> Il genitore **deve** essere `position: relative` e avere dimensioni definite:
> il layer si posiziona con `absolute inset-0`.

## API del componente

| Prop              | Tipo                                                   | Default   | Descrizione                                                        |
| ----------------- | ------------------------------------------------------ | --------- | ------------------------------------------------------------------ |
| `variant`         | `'panel' \| 'banner'`                                  | `'panel'` | Preset di bolle: verticale (canonico) o largo (banner).            |
| `bubbles`         | `Array<{size, left, delay, duration}>`                 | —         | Sostituisce la configurazione bolle.                               |
| `colors`          | `string[]`                                             | —         | Sostituisce i colori (ciclici per indice).                         |
| `className`       | `string`                                               | `''`      | Classi extra sul layer.                                            |
| `bubbleClassName` | `string`                                               | `''`      | Classi extra su ogni bolla.                                        |
| `style`           | `object`                                               | —         | Stile inline sul layer.                                            |

Le bolle usano valori di default identici a quelli canonici:

```js
// panel (Sidebar.jsx)
{ size: 90,  left: '12%', delay: 0,   duration: 12 }
{ size: 60,  left: '55%', delay: 3.5, duration: 15 }
{ size: 110, left: '30%', delay: 7,   duration: 18 }
{ size: 50,  left: '70%', delay: 1.5, duration: 11 }
{ size: 75,  left: '45%', delay: 9,   duration: 14 }
{ size: 45,  left: '20%', delay: 5,   duration: 16 }

// banner (banner.svg): delay negativi + 2 bolle extra a destra
```

Colori canonici (dal `BUBBLE_COLORS` della sidebar):

```
Plum        rgba(131, 61, 111, 0.55)   #833d6f
Lavender    rgba(154, 133, 192, 0.45)  #9a85c0
Sidebar     rgba(110, 90, 142, 0.50)   #6e5a8e
Blue        rgba(168, 198, 222, 0.35)  #a8c6de
Sage        rgba(156, 169, 139, 0.40)  #9ca98b
Terracotta  rgba(143, 90, 90, 0.40)    #8f5a5a
```

## Fedeltà visiva

L'animazione è una replica esatta dei keyframe canonici: stessa deformazione
(`border-radius` morph), stesso `blur(6px)`, stesse opacità (`0 → 1 → 0.6 → 0`),
stesse scale (`1 → 1.15 → 0.9 → 1.2 → 0.8`) e stesse durate/ritardi.

Unica variazione consapevole: la distanza di risalita usa unità **container
query** (`cqh`) invece di `vh`, così la corsa segue l'altezza del contenitore
(essenziale per banner/hero bassi). Nella sidebar a tutta altezza `1cqh === 1vh`,
quindi il risultato è identico all'originale.

> Richiede unità container query: Chromium/Electron 105+ (Electron 34 incluso),
> Safari 16+, Firefox 110+.

## Demo

Apri `demo/index.html` direttamente nel browser (nessuna build richiesta):
mostra le due configurazioni affiancate:

1. **Pannello verticale** — `variant="panel"`, colonna stretta a tutta altezza
   con sfondo `#6e5a8e` (come la sidebar).
2. **Hero / banner largo** — `variant="banner"`, banner `900×220` con gradiente
   `#1e1333 → #2b1c47 → #6b5887` (come il banner del README).
