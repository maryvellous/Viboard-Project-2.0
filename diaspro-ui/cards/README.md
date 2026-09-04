# Diaspro Cards

Famiglia di card riutilizzabile estratta dalla pagina **Progetti** di Diaspro
Viboard. Non è un design system completo: isola la grammatica visiva della
pagina — card colorate, grandi raggi, ombre profonde, hover con lieve
sollevamento, pill/badge e pannelli interni scuri.

## Riferimenti

- `src/index.css` → `.dashboard-card`, `.theme-*`, `.badge-pill`, `.action-pill`,
  `.card-commit-block`, `.card-bottom-actions`, `.task-sticker-badge`.
- `src/components/ProjectsView.jsx` → composizione della card e relativi stati.

## Struttura

```
diaspro-ui/cards/
├── tokens.css   # colori, font, raggi, ombre, easing (namespace --diaspro-*)
├── cards.css    # struttura, varianti, hover, pill, badge, pannelli
├── demo.html    # 6 card di esempio (nessuna logica applicativa)
└── README.md
```

## Uso

```html
<link rel="stylesheet" href="diaspro-ui/cards/tokens.css" />
<link rel="stylesheet" href="diaspro-ui/cards/cards.css" />
```

```html
<article class="diaspro-card diaspro-card--plum">
  <header class="diaspro-card__head">
    <div class="diaspro-card__title-row">
      <h3 class="diaspro-card__title">Progetto</h3>
      <span class="diaspro-card__chip">◆</span>
    </div>
    <p class="diaspro-card__subtitle">~/dev/progetto</p>
    <div class="diaspro-card__meta">◷ aggiornato ieri</div>
  </header>

  <div class="diaspro-card__badges">
    <span class="diaspro-card__badge diaspro-card__badge--accent">Locale</span>
    <span class="diaspro-card__badge diaspro-card__badge--solid">GitHub</span>
    <span class="diaspro-card__badge diaspro-card__badge--ghost">⎇ main</span>
  </div>

  <div class="diaspro-card__panel">
    <div class="diaspro-card__panel-label">◈ a1b2c3d</div>
    <p class="diaspro-card__panel-text">Ultimo commit</p>
  </div>

  <div class="diaspro-card__actions">
    <button class="diaspro-card__action diaspro-card__action--solid">Fetch</button>
    <button class="diaspro-card__action diaspro-card__action--ghost">Dettagli</button>
    <span class="diaspro-card__sticker">3 task</span>
  </div>
</article>
```

## Varianti colore (8 temi)

| Classe | Sfondo | Testo |
| --- | --- | --- |
| `.diaspro-card--blue` | `#a8c6de` | `#1e1333` |
| `.diaspro-card--sage` | `#9ca98b` | `#1e1333` |
| `.diaspro-card--sand` | `#efdebd` | `#1e1333` |
| `.diaspro-card--lavender` | `#9a85c0` | `#ffffff` |
| `.diaspro-card--plum` | `#833d6f` | `#ffffff` |
| `.diaspro-card--terracotta` | `#8f5a5a` | `#ffffff` |
| `.diaspro-card--warm-sand` | `#785076` | `#ffffff` |
| `.diaspro-card--default` | `#5c2a5c` | `#ffffff` (+ bordo `white/12`) |

## Classi principali

| Classe | Ruolo |
| --- | --- |
| `.diaspro-card` | Base (raggio 28px, ombra profonda, hover `translateY(-4px)`). |
| `.diaspro-card--*` | Variante colore (8 temi). |
| `.diaspro-card__head` / `__title-row` / `__title` | Intestazione e titolo. |
| `.diaspro-card__subtitle` | Percorso/URL in mono, opacità 70%. |
| `.diaspro-card__meta` | Riga metadati (es. data modifica). |
| `.diaspro-card__chip` | Piccolo chip icona (es. spilla "fissato"). |
| `.diaspro-card__badges` | Contenitore pill/badge. |
| `.diaspro-card__badge` + `--solid`/`--accent`/`--ghost` | Badge/pill. |
| `.diaspro-card__panel` + `__panel-label`/`__panel-text` | Pannello interno scuro (commit). |
| `.diaspro-card__actions` + `__action` + `--solid`/`--accent`/`--ghost` | Azioni in fondo. |
| `.diaspro-card__sticker` | Badge a gradiente (es. "3 task"). |

## Personalizzazione

Tutti i valori sono custom properties in `tokens.css` (`--diaspro-*`):
palette, font, raggi, ombre, spaziature ed easing. Per cambiare un singolo
colore o la distanza dell'hover basta sovrascrivere il token su `:root`.

## Fedeltà visiva

Colori, raggi (28px/18px/12px/pill), ombre, easing "giocoso"
`cubic-bezier(0.34,1.56,0.64,1)` e sollevamento hover (−4px) sono replicati
dalle fonti. Variazioni consapevoli:

- Il badge `--ghost` e il separatore delle azioni usano `color-mix()` con il
  colore "on" della card (`--diaspro-card-fg`), così si adattano
  automaticamente alle card chiare e scure con un'unica classe.
- Il separatore delle azioni è un `border-top` (l'originale applica un bordo
  completo); la resa visiva è la stessa intesa (riga divisoria prima delle
  azioni).
- Il badge `--accent` usa la combinazione "sidebar + lavanda" dell'originale
  (la variante chiara "canvas + blu" è omessa per non duplicare le classi).
