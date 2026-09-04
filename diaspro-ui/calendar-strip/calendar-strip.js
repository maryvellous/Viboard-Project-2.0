/**
 * Diaspro Calendar Strip — comportamento minimale.
 *
 * Genera una striscia di N giorni (default 10) distribuiti su tutta la
 * larghezza, raggruppa gli eventi per data e gestisce l'apertura/chiusura
 * dell'overlay di dettaglio (assoluto, senza alterare altezza/layout).
 *
 * Nessuna dipendenza da Google Calendar, Electron, gamification o React.
 */
(function (global) {
  'use strict';

  var DEFAULT_DAYS = 10;

  function pad(n) { return String(n).padStart(2, '0'); }
  function toIso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function parseDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'string') {
      var parts = value.split('-');
      if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
    }
    return new Date();
  }

  function create(container, options) {
    options = options || {};
    var startDate = parseDate(options.startDate || new Date());
    var daysCount = options.days || DEFAULT_DAYS;
    var events = options.events || []; // [{ date, title, time }]
    var onSelect = options.onSelect || null;

    if (!container) {
      throw new Error('DiasproCalendarStrip.create: "container" è obbligatorio.');
    }

    function buildDays() {
      var days = [];
      for (var i = 0; i < daysCount; i++) {
        var d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        var iso = toIso(d);
        days.push({
          iso: iso,
          dayName: d.toLocaleDateString('it-IT', { weekday: 'short' }),
          dateLabel: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
          events: events.filter(function (ev) { return ev && ev.date === iso; }),
          isToday: i === 0,
        });
      }
      return days;
    }

    var root = document.createElement('div');
    root.className = 'diaspro-strip';
    var ribbon = document.createElement('div');
    ribbon.className = 'diaspro-strip__ribbon';
    root.appendChild(ribbon);

    var overlayEl = null;
    var selectedIso = null;
    var days = buildDays();

    function findDay(iso) {
      for (var i = 0; i < days.length; i++) if (days[i].iso === iso) return days[i];
      return null;
    }

    function renderRibbon() {
      ribbon.innerHTML = '';
      days.forEach(function (day) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'diaspro-strip__day';
        if (day.isToday) cell.classList.add('diaspro-strip__day--today');
        if (day.iso === selectedIso) cell.classList.add('diaspro-strip__day--selected');

        var top = document.createElement('div');
        top.className = 'diaspro-strip__day-top';
        var head = document.createElement('div');
        head.className = 'diaspro-strip__day-head';
        var nameEl = document.createElement('span');
        nameEl.className = 'diaspro-strip__day-name';
        nameEl.textContent = day.dayName;
        var dateEl = document.createElement('span');
        dateEl.className = 'diaspro-strip__day-date';
        dateEl.textContent = day.dateLabel;
        head.appendChild(nameEl);
        head.appendChild(dateEl);

        var badge = document.createElement('span');
        badge.className = 'diaspro-strip__badge' + (day.events.length > 0 ? ' diaspro-strip__badge--filled' : '');
        badge.textContent = day.events.length + 'ev';

        top.appendChild(head);
        top.appendChild(badge);

        var area = document.createElement('div');
        area.className = 'diaspro-strip__day-events';
        if (day.events.length === 0) {
          var free = document.createElement('span');
          free.className = 'diaspro-strip__free';
          free.textContent = 'Libero';
          area.appendChild(free);
        } else {
          day.events.slice(0, 2).forEach(function (ev) {
            var e = document.createElement('span');
            e.className = 'diaspro-strip__event';
            e.textContent = '\u2022 ' + (ev.title || '');
            e.title = ev.title || '';
            area.appendChild(e);
          });
          if (day.events.length > 2) {
            var more = document.createElement('span');
            more.className = 'diaspro-strip__more';
            more.textContent = '+' + (day.events.length - 2);
            area.appendChild(more);
          }
        }

        cell.appendChild(top);
        cell.appendChild(area);
        cell.addEventListener('click', function () { toggle(day); });

        ribbon.appendChild(cell);
      });
    }
    function toggle(day) {
      if (selectedIso === day.iso) close();
      else select(day);
    }

    function select(day) {
      selectedIso = day.iso;
      renderRibbon();
      showOverlay(day);
      if (onSelect) onSelect(day);
    }

    function close() {
      selectedIso = null;
      removeOverlay();
      renderRibbon();
    }

    function removeOverlay() {
      if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    }

    function showOverlay(day) {
      removeOverlay();
      overlayEl = document.createElement('div');
      overlayEl.className = 'diaspro-strip__overlay';

      var head = document.createElement('div');
      head.className = 'diaspro-strip__overlay-head';

      var title = document.createElement('h3');
      title.className = 'diaspro-strip__overlay-title';
      title.appendChild(document.createTextNode(day.dayName + ' ' + day.dateLabel));
      if (day.isToday) {
        var todayBadge = document.createElement('span');
        todayBadge.className = 'diaspro-strip__today-badge';
        todayBadge.textContent = 'Oggi';
        title.appendChild(todayBadge);
      }

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'diaspro-strip__close';
      closeBtn.textContent = '\u2715 Chiudi';
      closeBtn.addEventListener('click', close);

      head.appendChild(title);
      head.appendChild(closeBtn);

      var list = document.createElement('div');
      list.className = 'diaspro-strip__overlay-list';
      if (day.events.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'diaspro-strip__overlay-empty';
        empty.textContent = 'Nessun evento registrato per questa data.';
        list.appendChild(empty);
      } else {
        day.events.forEach(function (ev) {
          var card = document.createElement('div');
          card.className = 'diaspro-strip__overlay-event';
          var info = document.createElement('div');
          var t = document.createElement('p');
          t.className = 'diaspro-strip__overlay-event-title';
          t.textContent = ev.title || '';
          var time = document.createElement('span');
          time.className = 'diaspro-strip__overlay-event-time';
          time.textContent = ev.time || 'Tutto il giorno';
          info.appendChild(t);
          info.appendChild(time);
          card.appendChild(info);
          list.appendChild(card);
        });
      }

      overlayEl.appendChild(head);
      overlayEl.appendChild(list);
      root.appendChild(overlayEl);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && selectedIso) close();
    });

    renderRibbon();

    return {
      el: root,
      select: function (iso) { var d = findDay(iso); if (d) select(d); },
      close: close,
      getSelected: function () { return selectedIso; },
      setEvents: function (next) {
        events = next || [];
        days = buildDays();
        renderRibbon();
        if (selectedIso) {
          var d = findDay(selectedIso);
          if (d) showOverlay(d); else selectedIso = null;
        }
      }
    };
  }

  global.DiasproCalendarStrip = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);

