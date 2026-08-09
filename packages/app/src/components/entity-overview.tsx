import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { EditorDocumentRef } from "@desk/core";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionLabel } from "@/components/patterns";
import { useEditorDocumentSession } from "@/hooks/editor";
import { cn } from "@/lib/utils";
import { EditorConflictDialog } from "@/components/editors/editor-conflict-dialog";
import { InlineProgress } from "@/components/ui/inline-progress";
import { resolveEntityOverviewMode } from "@/lib/entity-overview-state";

interface EntityOverviewProps {
  title: string;
  value: string;
  placeholder: string;
  documentRef: Extract<EditorDocumentRef, { kind: "workspace-overview" | "project-overview" }>;
  /** Caps read mode and offers inline expansion. Editing is always expanded. */
  collapsedClassName?: string;
  /** Resets local expansion when the owning entity changes. */
  resetKey?: string;
}

/** Shared display/edit surface for the user-owned workspace.md/project.md body. */
export function EntityOverview({
  title,
  value,
  placeholder,
  documentRef,
  collapsedClassName,
  resetKey,
}: EntityOverviewProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const session = useEditorDocumentSession({ ref: documentRef });
  const currentValue = session.state ? session.content : value;
  const empty = currentValue.trim().length === 0;
  const mode = resolveEntityOverviewMode({
    hasState: Boolean(session.state),
    isLoading: session.isLoading,
    loadError: session.loadError,
    fileDeleted: session.fileDeleted,
  });

  useEffect(() => {
    if (session.saveStatus === "conflict") setShowConflict(true);
  }, [session.saveStatus]);

  useEffect(() => setExpanded(false), [resetKey]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !collapsedClassName || editing || expanded) {
      setHasOverflow(false);
      return;
    }
    const measure = () => setHasOverflow(element.scrollHeight > element.clientHeight + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [collapsedClassName, editing, expanded, currentValue]);

  const done = async () => {
    try {
      if (await session.save()) {
        setEditing(false);
      } else if (session.saveStatus === "conflict") {
        setShowConflict(true);
      } else {
        toast.error(t("toasts.overview.update.error"));
      }
    } catch (error) {
      console.error("Failed to save overview:", error);
      toast.error(t("toasts.overview.update.error"));
    }
  };

  const recover = async () => {
    await session.recover();
  };

  const discard = async () => {
    if (!(await session.discard())) toast.error(t("editors.shared.discardFailed"));
  };

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{title}</SectionLabel>
          {mode === "loading" && <InlineProgress />}
          {mode === "ready" && !editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              {empty ? <Plus className="size-3.5" /> : <Pencil className="size-3.5" />}
              {t(empty ? "common.buttons.add" : "common.buttons.edit")}
            </Button>
          )}
        </div>

        <div className="relative">
          <div
            ref={contentRef}
            className={cn(
              !editing && !expanded && collapsedClassName,
              !editing && !expanded && collapsedClassName && "overflow-hidden",
            )}
          >
            {mode === "load-error" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p>{t("overviews.loadFailed")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={session.retryLoad}>
                  {t("common.buttons.retry")}
                </Button>
              </div>
            ) : mode === "missing" ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>{t("overviews.missing")}</p>
                {session.isDirty && <p className="mt-1">{t("overviews.unsavedHint")}</p>}
                {session.recoveryBlocked === "parent-missing" && (
                  <p className="mt-1 text-destructive">{t("ui.editorBanners.fileDeleted.parentMissing")}</p>
                )}
                {session.isDirty && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void recover()} disabled={session.saveStatus === "saving"}>
                      {session.recoveryBlocked === "parent-missing"
                        ? t("common.buttons.tryAgain")
                        : t("ui.editorBanners.fileDeleted.restoreFromEdits")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void discard()}>
                      {t("overviews.discardAction")}
                    </Button>
                  </div>
                )}
              </div>
            ) : !editing && empty ? (
              <button
                type="button"
                className="py-1 text-left text-sm italic text-muted-foreground/60 hover:text-muted-foreground"
                onClick={() => mode === "ready" && setEditing(true)}
                disabled={mode !== "ready"}
              >
                {placeholder}
              </button>
            ) : (
              <RichTextEditor
                value={currentValue}
                onChange={editing && mode === "ready" ? session.setContent : () => {}}
                placeholder={placeholder}
                borderless={!editing}
                editable={editing && mode === "ready"}
                autofocus={editing && mode === "ready"}
                minHeight="60px"
                maxHeight={editing ? "480px" : undefined}
                className={editing ? undefined : "bg-transparent"}
              />
            )}
          </div>
          {!editing && !expanded && hasOverflow && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>

        {!editing && collapsedClassName && (hasOverflow || expanded) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-fit gap-1 px-1.5 text-xs text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {t(expanded ? "overviews.showLess" : "overviews.showMore")}
          </Button>
        )}

        {editing && (
          <div className="flex justify-end gap-2">
            {session.saveStatus === "error" && (
              <Button type="button" variant="outline" size="sm" onClick={session.retry}>
                {t("common.buttons.retry")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => void done()} disabled={session.saveStatus === "saving"}>
              {session.saveStatus === "saving" ? t("common.buttons.saving") : t("common.buttons.done")}
            </Button>
          </div>
        )}
      </section>
      <EditorConflictDialog
        open={showConflict && session.saveStatus === "conflict"}
        onUseExternal={() => { setShowConflict(false); session.useExternal(); }}
        onKeepDesk={() => { setShowConflict(false); session.keepDesk(); }}
        onCancel={() => { setShowConflict(false); session.cancelConflict(); }}
      />
    </>
  );
}
