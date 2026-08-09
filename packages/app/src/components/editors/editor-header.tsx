
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatusIndicator, type SaveStatus } from "@/components/ui/save-status";
import { AIBadge } from "@/components/ui/ai-badge";
import { Trash2, Bot, BotOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageWidthClasses } from "@/lib/enterprise-ui";

interface EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onTitleBlur?: () => void;
  placeholder?: string;
  saveStatus: SaveStatus;
  onRetry?: () => void;
  onReview?: () => void;
  onDelete: () => void;
  /** Provenance: the file carries `author: ai` (display-only mark next to the title) */
  authorAI?: boolean;
  /** Whether the document is included in AI indexing */
  aiIncluded?: boolean;
  /** Callback when AI inclusion is toggled */
  onAIInclusionChange?: (included: boolean) => void;
  /** Whether the file is in an excluded folder (toggle disabled) */
  isInExcludedFolder?: boolean;
  /** Path of the excluded folder (for tooltip) */
  excludedFolderPath?: string;
}

export function EditorHeader({
  title,
  onTitleChange,
  onTitleBlur,
  placeholder,
  saveStatus,
  onRetry,
  onReview,
  onDelete,
  authorAI,
  aiIncluded,
  onAIInclusionChange,
  isInExcludedFolder,
  excludedFolderPath,
}: EditorHeaderProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("editors.shared.untitled");

  // Determine if toggle should be disabled
  const isToggleDisabled = isInExcludedFolder;

  // Build tooltip text
  const getTooltipText = () => {
    if (isInExcludedFolder && excludedFolderPath) {
      return t("editors.shared.aiExcludedByFolder", { path: excludedFolderPath });
    }
    if (aiIncluded) {
      return t("editors.shared.aiIncludedToggle");
    }
    return t("editors.shared.aiExcludedToggle");
  };

  return (
    <div className="shrink-0 bg-background">
      <div className={cn("mx-auto flex items-center gap-3 px-6 py-2", pageWidthClasses.reading)}>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          placeholder={resolvedPlaceholder}
          className="h-auto flex-1 border-none bg-transparent px-3 py-1 text-xl font-semibold shadow-none focus-visible:ring-0"
        />
        {authorAI && <AIBadge />}
        <SaveStatusIndicator status={saveStatus} />
        {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>{t("common.buttons.retry")}</Button>}
        {onReview && <Button variant="ghost" size="sm" onClick={onReview}>{t("editors.shared.review")}</Button>}
        {onAIInclusionChange && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => !isToggleDisabled && onAIInclusionChange(!aiIncluded)}
            disabled={isToggleDisabled}
            title={getTooltipText()}
            className={cn(
              "shrink-0",
              isToggleDisabled
                ? "cursor-not-allowed text-muted-foreground/40"
                : aiIncluded
                ? "text-muted-foreground/80 hover:text-foreground"
                : "text-muted-foreground/65 hover:text-foreground"
            )}
            aria-label={getTooltipText()}
          >
            {aiIncluded && !isInExcludedFolder ? (
              <Bot className="h-3.5 w-3.5" />
            ) : (
              <BotOff className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="shrink-0 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
          title={t("common.buttons.delete")}
          aria-label={t("common.buttons.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
