import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useBootStore } from "@/stores/boot";
import { createNativeAuthClient } from "@/lib/native-auth-client";
import { nativeFetch } from "@/lib/native-http";
import { AuthScreen } from "./auth-screen";
import { AppBootScreen } from "@/app/boot-screen";
import {
  EditorAuthTransitionNotice,
  useGuardedEditorAuthSession,
} from "@/hooks/use-guarded-editor-auth-session";
import { searchIndexController } from "@/lib/search-index-controller";

/**
 * Native remote-mode auth gate — the desktop counterpart of
 * [hosted-auth-gate.tsx]. Lazy-loaded in every non-hosted build (`!VITE_DESK_HOSTED`)
 * and rendered by the app-shell only inside a Tauri webview (isTauri()) when
 * `connectionMode === "remote"`, so the browser-fixture build never shows it and local
 * mode never sees a login.
 *
 * Same three states as the web gate, but pointed at the user's chosen server and
 * authenticating with a Keychain bearer token instead of a same-origin cookie:
 *   loading        → branded boot surface
 *   no session     → AuthScreen ("create" on a fresh server, else "login")
 *   authenticated  → the app shell (children)
 */
export default function NativeAuthGate({ children }: { children: ReactNode }) {
  const serverUrl = useBootStore((s) => s.serverUrl);
  // One client per server URL. Stable across renders so useSession is stable.
  const client = useMemo(() => createNativeAuthClient(serverUrl), [serverUrl]);
  const { data: session, isPending } = client.useSession();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const guarded = useGuardedEditorAuthSession(session, isPending);
  const acceptedUserId = guarded.acceptedSession?.user.id ?? null;

  useEffect(() => {
    searchIndexController.clear();
    if (acceptedUserId) void searchIndexController.refresh();
  }, [acceptedUserId, serverUrl]);

  useEffect(() => {
    let active = true;
    const base = serverUrl.replace(/\/$/, "");
    nativeFetch(`${base}/api/auth-status`)
      .then((r) => r.json())
      .then((d: { hasUsers?: boolean }) => {
        if (active) setHasUsers(!!d.hasUsers);
      })
      // Fail safe: assume an account exists → show login, never an open create screen.
      .catch(() => {
        if (active) setHasUsers(true);
      });
    return () => {
      active = false;
    };
  }, [serverUrl]);

  if (guarded.initializing || hasUsers === null) {
    return <AppBootScreen />;
  }

  if (!guarded.acceptedSession) {
    return (
      <AuthScreen
        mode={hasUsers ? "login" : "create"}
        auth={{ signIn: client.signIn, signUp: client.signUp }}
      />
    );
  }

  return (
    <>
      {children}
      {guarded.blocked && <EditorAuthTransitionNotice retry={guarded.retry} />}
    </>
  );
}
