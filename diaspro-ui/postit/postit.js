/**
 * Diaspro Post-it — comportamento minimale (drag + apertura/chiusura).
 *
 * Nessuna dipendenza da React, Electron o dalla logica task di Viboard.
 * Espone `window.DiasproPostit` con due factory:
 *   - createFloating(options)  → nota trascinabile con textarea
 *   - createOverlay(options)   → post-it ancorato a una card (header + body + footer)
 */
(function (global) {
  'use strict';

  // ── Icone inline (stesso tratto di lucide-react, zero dipendenze) ──────
  var SVG_X =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  var SVG_NOTE =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2Z"/>' +
    '<path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>';

  // ── Helper ──────────────────────────────────────────────────────────────
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function randomRotation() {
    return Math.random() * 6 - 3; // -3° … +3°
  }

  function randomPosition() {
    return { x: 40 + Math.random() * 200, y: 80 + Math.random() * 180 };
  }

  // ── Floating: nota trascinabile (vista Oggi) ────────────────────────────
  function createFloating(options) {
    options = options || {};
    var pos = options.x != null && options.y != null
      ? { x: options.x, y: options.y }
      : randomPosition();
    var rotation = options.rotation != null ? options.rotation : randomRotation();
    var text = options.text || '';
    var placeholder = options.placeholder || 'Scrivi una nota...';
    var onUpdate = options.onUpdate || null;
    var onDelete = options.onDelete || null;

    var el = document.createElement('div');
    el.className = 'diaspro-postit diaspro-postit--floating';
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.setProperty('--diaspro-postit-rotation', rotation.toFixed(2) + 'deg');

    el.innerHTML =
      '<div class="diaspro-postit__paper">' +
        '<div class="diaspro-postit__bar">' +
          '<button type="button" class="diaspro-postit__close" title="Elimina nota" aria-label="Elimina nota">' + SVG_X + '</button>' +
        '</div>' +
        '<textarea class="diaspro-postit__textarea" rows="5" placeholder="' + escapeHtml(placeholder) + '"></textarea>' +
      '</div>';

    var textarea = el.querySelector('.diaspro-postit__textarea');
    var closeBtn = el.querySelector('.diaspro-postit__close');
    textarea.value = text;

    // Drag (pointer events → mouse + touch). Come nell'originale, il drag
    // parte dalla carta ma NON da textarea/pulsanti.
    var dragging = false;
    var offsetX = 0;
    var offsetY = 0;

    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest('textarea') || e.target.closest('button')) return;
      dragging = true;
      offsetX = e.clientX - parseFloat(el.style.left || '0');
      offsetY = e.clientY - parseFloat(el.style.top || '0');
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      el.classList.add('diaspro-postit--dragging');
      e.preventDefault();
    });

    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = e.clientX - offsetX;
      var ny = e.clientY - offsetY;
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
      if (onUpdate) onUpdate({ x: nx, y: ny });
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('diaspro-postit--dragging');
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    textarea.addEventListener('input', function () {
      if (onUpdate) onUpdate({ text: textarea.value });
    });

    closeBtn.addEventListener('click', function () {
      el.remove();
      if (onDelete) onDelete();
    });

    return {
      el: el,
      get text() { return textarea.value; },
      set text(value) { textarea.value = value; },
      setPosition: function (x, y) {
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      },
      remove: function () { el.remove(); }
    };
  }
  // ── Overlay: post-it ancorato a una card (card Progetti) ────────────────
  function createOverlay(options) {
    options = options || {};
    var anchor = options.anchor;
    if (!anchor) {
      throw new Error('DiasproPostit.createOverlay: la proprietà "anchor" (elemento card) è obbligatoria.');
    }

    var title = options.title || 'Tasks Post-it';
    var open = options.open !== false;
    var onClose = options.onClose || null;

    var el = document.createElement('div');
    el.className = 'diaspro-postit diaspro-postit--overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);

    el.innerHTML =
      '<div class="diaspro-postit__paper">' +
        '<header class="diaspro-postit__header">' +
          '<span class="diaspro-postit__title">' + SVG_NOTE + '<span>' + escapeHtml(title) + '</span></span>' +
          '<button type="button" class="diaspro-postit__close" title="Chiudi" aria-label="Chiudi">' + SVG_X + '</button>' +
        '</header>' +
        '<div class="diaspro-postit__body"></div>' +
        '<div class="diaspro-postit__footer"></div>' +
      '</div>';

    anchor.appendChild(el);

    var body = el.querySelector('.diaspro-postit__body');
    var footer = el.querySelector('.diaspro-postit__footer');
    var closeBtn = el.querySelector('.diaspro-postit__close');

    function setOpen(next) {
      open = !!next;
      el.style.display = open ? '' : 'none';
      return open;
    }
    function openFn() { return setOpen(true); }
    function closeFn() {
      var wasOpen = open;
      setOpen(false);
      if (wasOpen && onClose) onClose();
      return false;
    }
    function toggle() { return open ? closeFn() : openFn(); }

    closeBtn.addEventListener('click', closeFn);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) closeFn();
    });

    if (!open) el.style.display = 'none';

    return {
      el: el,
      body: body,
      footer: footer,
      open: openFn,
      close: closeFn,
      toggle: toggle,
      get isOpen() { return open; }
    };
  }

  global.DiasproPostit = {
    createFloating: createFloating,
    createOverlay: createOverlay,
    randomRotation: randomRotation,
    randomPosition: randomPosition,
    icons: { x: SVG_X, note: SVG_NOTE }
  };
})(typeof window !== 'undefined' ? window : globalThis);

