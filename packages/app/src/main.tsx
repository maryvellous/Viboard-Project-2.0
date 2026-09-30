import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./app/globals.css";
// i18n init runs as a side-effect on import — must precede modules that read
// translations at module-eval time (e.g. src/lib/design-tokens.ts).
import "./i18n";
import { Buffer as BufferPolyfill } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppBootError, AppBootScreen } from "./app/boot-screen";
import { applyThemePreference } from "./lib/theme";

// gray-matter — used by every Markdown parse (parseMarkdown) — calls
// `Buffer.from()` at runtime. The Tauri/browser WebView has no Node `Buffer`
// global, so provide one. Without this, every workspace/task/doc/meeting parse
// throws "Buffer is not defined" and the app silently shows no data.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = BufferPolyfill as unknown as typeof globalThis.Buffer;
}

// Paint the branded boot surface before host wiring and dynamic imports begin.
// The same component is reused by provider/auth gates, so startup reads as one
// continuous state rather than a series of unrelated loaders.
const stopInitialThemeSync = applyThemePreference("dark");
const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <AppBootScreen />
  </StrictMode>
);

async function bootstrap() {
  // Wire the @desk/core host seams before any domain call. The domain layer is
  // UI-agnostic (it runs on a server too); these injectors connect it to this
  // app's stores. The data-root resolver MUST be set before expandFsScope()
  // below, since that resolves the data path through it.
  const { setDataRootResolver } = await import("@desk/core/host");
  const { useBootStore } = await import("./stores/boot");
  setDataRootResolver(async () => useBootStore.getState().dataPath || "~/Viboard");
  const { isTauri } = await import("@desk/core");

  // Set up the local data root exactly once, before file-backed stores are
  // evaluated. The old provider-level initializer repeated this work after
  // React mounted, keeping the app behind a second boot gate.
  if (isTauri()) {
    const { expandFsScope, initDeskDirectory } = await import("@desk/core/host/files");
    try {
      await expandFsScope(); // claims ownership before any local read or write
      await initDeskDirectory();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Desk] local bootstrap failed:", error);
      stopInitialThemeSync();
      root.render(<AppBootError message={message} />);
      return;
    }
  }

  // Wire the remaining seams (only needed once writes happen): editor-sync
  // notifications and external-agent file generation.
  const { setEditorNotifier, setAgentFileWriter } = await import("@desk/core/host");
  const { useOpenEditorRegistry } = await import("./stores/open-editor-registry");
  setEditorNotifier({
    isOpen: (p) => useOpenEditorRegistry.getState().isOpen(p),
    handlePathDeleted: (p) => useOpenEditorRegistry.getState().handlePathDeleted(p),
    handlePathChange: (o, n) => useOpenEditorRegistry.getState().handlePathChange(o, n),
  });
  const { writePerWorkspaceAgentFiles, writeTopLevelAgentFiles } = await import(
    "./lib/smart-index/agent-files"
  );
  setAgentFileWriter({
    writePerWorkspace: writePerWorkspaceAgentFiles,
    writeTopLevel: writeTopLevelAgentFiles,
  });

  // AI key seam: the app resolves provider keys from the OS Keychain. Outside Tauri the
  // secrets module throws BrowserModeError — mapped to "no key", which every caller handles.
  const { setAIKeyResolver } = await import("@desk/core/host");
  setAIKeyResolver(async (ref) => {
    try {
      const { getSecret } = await import("./lib/ai/secrets");
      return await getSecret(ref);
    } catch {
      return null;
    }
  });

  // Hosted web mode: when this bundle is built for the server
  // (VITE_DESK_HOSTED=1, via `npm run build:hosted`), the domain runs on the
  // server — inject a RemoteDeskService so every getDeskService() call goes over
  // HTTP instead of the in-process LocalDeskService. Same-origin → cookie auth, no CORS.
  if (import.meta.env.VITE_DESK_HOSTED) {
    const { setDeskService, setStorage, GuardStorageProvider } = await import("@desk/core/host");
    const { createRemoteDeskService } = await import("./lib/remote-desk-service");
    // Domain runs on the server: make the local filesystem structurally off-limits so a
    // stray getStorage() throws instead of silently hitting the wrong disk.
    setStorage(new GuardStorageProvider());
    setDeskService(createRemoteDeskService(window.location.origin));
  }

  // Dynamic import: the App module graph (and every store with persist) is
  // only evaluated now, after the FS scope is in place.
  const { App } = await import("./app");

  stopInitialThemeSync();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // Maintenance is not required for first paint. Load it after the app is
  // visible so its module graph and store hydration cannot delay startup.
  void import("./lib/maintenance")
    .then(({ startAppMaintenanceEngine }) => startAppMaintenanceEngine())
    .catch((error) => {
      console.warn("[maintenance] Failed to start after bootstrap:", error);
    });
}

bootstrap();
