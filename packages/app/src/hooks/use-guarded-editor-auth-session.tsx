import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { EditorAuthTransitionGuard } from "@/lib/editor-auth-transition";
import { setEditorRecoveryUser } from "@/lib/editor-recovery";
import { prepareEditorContextTransition } from "@/lib/editor-session-controller";

interface AuthSessionLike {
  user: { id: string };
}

export function useGuardedEditorAuthSession<T extends AuthSessionLike>(
  observedSession: T | null | undefined,
  isPending: boolean,
) {
  const [acceptedSession, setAcceptedSession] = useState<T | null | undefined>(undefined);
  const [blocked, setBlocked] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const guardRef = useRef<EditorAuthTransitionGuard | null>(null);
  const transitionVersion = useRef(0);
  const observedSessionRef = useRef(observedSession);
  const observedUserIdRef = useRef<string | null>(null);
  observedSessionRef.current = observedSession;
  const observedUserId = observedSession?.user.id ?? null;
  observedUserIdRef.current = observedUserId;

  useEffect(() => {
    if (isPending) return;
    const currentGuard = guardRef.current;
    if (!currentGuard) {
      guardRef.current = new EditorAuthTransitionGuard(observedUserId);
      setEditorRecoveryUser(observedUserId);
      setAcceptedSession(observedSessionRef.current ?? null);
      setBlocked(false);
      return;
    }
    if (currentGuard.acceptedUserId === observedUserId) {
      transitionVersion.current++;
      setBlocked(false);
      return;
    }

    const version = ++transitionVersion.current;
    const transitionSession = observedSessionRef.current ?? null;
    void currentGuard
      .transition(
        observedUserId,
        prepareEditorContextTransition,
        () => {
          if (transitionVersion.current !== version || observedUserIdRef.current !== observedUserId) {
            return false;
          }
          setEditorRecoveryUser(observedUserId);
          setAcceptedSession(transitionSession);
          setBlocked(false);
          return true;
        },
      )
      .then((accepted) => {
        if (transitionVersion.current !== version) return;
        if (!accepted) {
          setBlocked(true);
        }
      });
  }, [isPending, observedUserId, retryVersion]);

  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);
  return {
    acceptedSession,
    initializing: acceptedSession === undefined,
    blocked,
    retry,
  };
}

export function EditorAuthTransitionNotice({ retry }: { retry: () => void }): ReactNode {
  const { t } = useTranslation();
  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-destructive/30 bg-background p-4 shadow-lg"
      role="alert"
    >
      <p className="text-sm text-foreground">{t("editors.shared.contextTransitionBlocked")}</p>
      <Button className="mt-3" size="sm" variant="outline" onClick={retry}>
        {t("common.buttons.retry")}
      </Button>
    </div>
  );
}
