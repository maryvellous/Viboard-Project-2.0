interface SearchProjectRef {
  id: string;
  workspaceId: string;
}

interface PaletteRouteNavigation {
  confirmUnsavedChanges: () => boolean;
  beforeNavigate?: () => void;
  activateDesk: () => void;
  navigate: (path: string) => void;
}

/** Navigate from the command palette, whose programmatic route change bypasses link guards. */
export function openPaletteRoute(
  path: string,
  navigation: PaletteRouteNavigation,
): boolean {
  if (!navigation.confirmUnsavedChanges()) return false;
  navigation.beforeNavigate?.();
  navigation.activateDesk();
  navigation.navigate(path);
  return true;
}

interface SearchProjectNavigation {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (workspaceId: string) => void;
  getCurrentWorkspaceId: () => string | null;
  confirmUnsavedChanges: () => boolean;
  activateDesk: () => void;
  navigate: (path: string) => void;
}

/** Open a project result, respecting the workspace guard and Desk-tab ownership. */
export function openSearchProject(
  project: SearchProjectRef,
  navigation: SearchProjectNavigation,
): boolean {
  if (project.workspaceId !== navigation.currentWorkspaceId) {
    navigation.setCurrentWorkspaceId(project.workspaceId);
    if (navigation.getCurrentWorkspaceId() !== project.workspaceId) return false;
  } else if (!navigation.confirmUnsavedChanges()) {
    return false;
  }

  navigation.activateDesk();
  navigation.navigate(`/projects?open=${encodeURIComponent(project.id)}`);
  return true;
}
