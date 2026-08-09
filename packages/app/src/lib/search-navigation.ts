interface SearchProjectRef {
  id: string;
  workspaceId: string;
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
