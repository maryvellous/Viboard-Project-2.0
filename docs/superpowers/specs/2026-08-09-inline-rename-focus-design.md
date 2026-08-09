# Inline Rename Focus Design

## Problem

Choosing **Rename** from either a document tree's right-click menu or its `...` button briefly opens the inline editor and then immediately closes it. Both entry points use the same Radix context menu. The rename action mounts and focuses the inline input while the menu is still closing; Radix subsequently restores focus to the element that was focused before the menu opened. That blurs the input, whose unchanged-value blur behavior cancels Arborist's edit state.

This is a client-side focus race. Remote/deployed mode changes which local-only menu actions are visible, but it does not use a different rename mutation.

## Design

### Menu focus ownership

The document-tree menu will use Radix's `onCloseAutoFocus` lifecycle hook. When an action has already transferred focus to a live element outside the closing menu, the handler will prevent Radix's default focus restoration. If focus has not transferred, normal restoration remains intact.

This rule belongs at the menu boundary: the menu owns close-time focus restoration, while the inline input should not need timers or knowledge of Radix. The behavior will remain scoped to document-tree menus rather than changing every application context menu.

No timing delay such as `setTimeout(node.edit)` will be introduced.

### One rename pipeline

Document and folder inline editors will submit through Arborist's `node.submit(name)` and cancel through `node.reset()`. The existing tree-level `onRename` callback will remain the single mutation path. It already routes document and folder renames, reports localized failures, and displays success feedback.

The duplicate row-level `onRenameDoc` and `onRenameFolder` mutation callbacks will be removed from `DocsTreeHandlers`. Other row actions remain unchanged.

### Input behavior

The inline input keeps its current interaction contract:

- It focuses and selects the current name when edit mode starts.
- Enter submits a non-empty changed value.
- Escape cancels.
- Blur submits a changed value and cancels an empty or unchanged value.
- Its committed guard prevents duplicate blur/keyboard submissions.

## Error handling

Rename failures continue to be handled by the central tree-level rename callback. A failed server or filesystem mutation produces the existing localized error toast and console diagnostic. The focus fix itself does not swallow errors or retry mutations.

## Regression coverage

A focused interaction regression will cover the close-focus decision: when a context-menu action transfers focus outside the closing menu, close-time auto-focus is prevented; otherwise default restoration is preserved.

The rename pipeline will also be covered at its smallest stable boundary so that document and folder rows submit through Arborist rather than bypassing the tree callback. Verification will include type checking, the focused tests, the full test suite, and a production application build.

## Scope

This change is limited to document-tree menu focus and document/folder inline rename plumbing. It does not alter rename semantics, filenames, remote APIs, tree sorting, selection, drag-and-drop, or global context-menu behavior.
