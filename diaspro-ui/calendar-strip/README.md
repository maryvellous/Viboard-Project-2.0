# Diaspro Calendar Strip

Striscia "10 giorni" riutilizzabile estratta da `GoogleCalendarWidget`
(vista "Striscia 10 Giorni"). Mostra N giorni (default 10) distribuiti su
tutta la larghezza senza scroll orizzontale, con altezza compatta e costante,
stati **normale / oggi / selezionato**, massimo 2 eventi per giorno +
indicatore `+N`, badge conteggio eventi e stato **Libero**.

Il click su un giorno apre il dettaglio in un overlay **assoluto** sopra la
strip: altezza e layout non cambiano mai.

Nessuna dipendenza da Google Calendar, Electron, gamification o React: il
componente riceve semplici dati evento.

## Struttura

```
diaspro-ui/calendar-strip/
├── calendar-strip.css   # stile, stati, overlay (namespace .diaspro-strip)
├── calendar-strip.js    # generazione giorni + gestione selezione/overlay
├── demo.html            # demo autonoma (tutti gli stati + overlay aperto)
└── README.md
```

## Uso

```html
<link rel="stylesheet" href="diaspro-ui/calendar-strip/calendar-strip.css" />
<script src="diaspro-ui/calendar-strip/calendar-strip.js"></script>
<div id="strip"></div>

<script>
  const strip = DiasproCalendarStrip.create(document.getElementById('strip'), {
    startDate: new Date(),   // facoltativo (default: oggi)
    days: 10,                // facoltativo (default: 10)
    events: [
      { date: '2026-09-05', title: 'Standup', time: '09:30' },
      { date: '2026-09-05', title: 'Lunch', time: '13:00' }
      // `date` in formato YYYY-MM-DD; `time` facoltativo ("Tutto il giorno")
    ],
    onSelect: (day) => {}    // facoltativo
  });
</script>
```

## API

`DiasproCalendarStrip.create(container, options)` ritorna un controller:

| Membro | Descrizione |
| --- | --- |
| `el` | Elemento DOM della strip. |
| `select(iso)` | Apre l'overlay sul giorno `YYYY-MM-DD`. |
| `close()` | Chiude l'overlay. |
| `getSelected()` | ISO del giorno selezionato (o `null`). |
| `setEvents(events)` | Sostituisce gli eventi e ri-renderizza. |

Opzioni:

| Opzione | Tipo | Default | Descrizione |
| --- | --- | --- | --- |
| `startDate` | `Date` \| `string` | oggi | Primo giorno della striscia. |
| `days` | `number` | `10` | Numero di giorni. |
| `events` | `Array` | `[]` | `{ date, title, time }`. |
| `onSelect` | `(day) => void` | — | Chiamato alla selezione di un giorno. |

## Classi CSS principali

| Classe | Ruolo |
| --- | --- |
| `.diaspro-strip` | Contenitore (card scura, bordo lavanda, `min-height`). |
| `.diaspro-strip__ribbon` | Riga giorni (`overflow-x: hidden`, altezza fissa). |
| `.diaspro-strip__day` | Giorno (`flex: 1` → distribuzione automatica). |
| `.diaspro-strip__day--today` | Stato **oggi** (plum/40 + bordo sabbia). |
| `.diaspro-strip__day--selected` | Stato **selezionato** (plum/80 + bordo sabbia). |
| `.diaspro-strip__day-name` / `__day-date` | Etichette nome/data. |
| `.diaspro-strip__badge` (+ `--filled`) | Badge conteggio eventi (`Nev`). |
| `.diaspro-strip__event` / `__more` / `__free` | Eventi (max 2), indicatore `+N`, "Libero". |
| `.diaspro-strip__overlay` (+ `__head`/`__title`/`__close`/`__list`/`__event`/`__empty`) | Dettaglio in overlay assoluto. |

## Fedeltà visiva

Colori (`#5c2a5c` card, `#1e1333` canvas, `#833d6f` plum, `#efdebd` sabbia,
`#9a85c0` lavanda, `#9ca98b` salvia, `#a8c6de` blu), raggi (24px/16px/12px),
altezza ribbon (116px), `min-height` 140px, stati e overlay (gradiente
plum→card→canvas, bordo lavanda, fade-in) sono replicati dalle fonti.

Variazioni consapevoli:

- L'evento non usa il link esterno `htmlLink` di Google: l'overlay mostra solo
  titolo + ora. Il tempo mancante è reso come "Tutto il giorno".
- La chiusura avviene con la ✕, con `Escape` oppure ricliccando il giorno
  selezionato (comportamento equivalente all'originale).
- Il fade-in dell'overlay è un'approssimazione (sola opacità) della classe
  utilitaria `animate-fadeIn`.
