/**
 * Keep focus where a tree-menu action deliberately moved it. Otherwise Radix
 * should restore focus normally when the menu closes.
 */
export function shouldPreserveTreeMenuActionFocus(
  activeElement: Element | null,
  documentBody: HTMLElement,
  menuContent: HTMLElement,
): boolean {
  return activeElement !== null
    && activeElement !== documentBody
    && !menuContent.contains(activeElement);
}
