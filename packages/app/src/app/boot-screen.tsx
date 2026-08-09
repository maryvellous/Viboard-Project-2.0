import { useTranslation } from "react-i18next";

/**
 * The one branded loading surface used before Desk is interactive.
 *
 * Keep the mark and its motion isolated here so the startup treatment can be
 * refined without touching bootstrap, authentication, or routing code.
 */
export function AppBootScreen() {
  const { t } = useTranslation();

  return (
    <div
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background"
      role="status"
      aria-live="polite"
    >
      <img
        src="/icon.png"
        alt=""
        className="desk-boot-mark size-14 rounded-[14px]"
        draggable={false}
      />
      <span className="sr-only">{t("common.buttons.loading")}</span>
    </div>
  );
}

export function AppBootError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-lg font-semibold text-foreground">{t("common.bootErrorTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          {t("common.buttons.retry")}
        </button>
      </div>
    </div>
  );
}
