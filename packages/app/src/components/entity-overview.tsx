import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionLabel } from "@/components/patterns";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";

interface EntityOverviewProps {
  title: string;
  value: string;
  placeholder: string;
  onSave: (overview: string) => Promise<void>;
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
  onSave,
  collapsedClassName,
  resetKey,
}: EntityOverviewProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dirty = draft.trim() !== value.trim();
  const empty = value.trim().length === 0;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

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
  }, [collapsedClassName, editing, expanded, value]);

  useUnsavedChangesGuard(
    editing && dirty,
    t("overviews.discardDescription"),
    true,
    title,
  );

  const finishCancel = () => {
    setDraft(value);
    setEditing(false);
    setConfirmDiscard(false);
  };

  const cancel = () => {
    if (dirty) setConfirmDiscard(true);
    else finishCancel();
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      console.error("Failed to save overview:", error);
      toast.error(t("toasts.overview.update.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{title}</SectionLabel>
          {!editing && (
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
            {!editing && empty ? (
              <button
                type="button"
                className="py-1 text-left text-sm italic text-muted-foreground/60 hover:text-muted-foreground"
                onClick={() => setEditing(true)}
              >
                {placeholder}
              </button>
            ) : (
              <RichTextEditor
                value={editing ? draft : value}
                onChange={editing ? setDraft : () => {}}
                placeholder={placeholder}
                borderless={!editing}
                editable={editing}
                autofocus={editing}
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
            <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={saving}>
              {t("common.buttons.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? t("common.buttons.saving") : t("common.buttons.save")}
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t("overviews.discardTitle")}
        description={t("overviews.discardDescription")}
        confirmLabel={t("overviews.discardAction")}
        onConfirm={finishCancel}
      />
    </>
  );
}
