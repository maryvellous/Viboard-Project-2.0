import { Settings, Calendar, FolderOpen, FileText, Sparkles, Info, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { interactionClasses } from "@/lib/enterprise-ui";

export type SettingsCategory =
  | "general"
  | "planner"
  | "templates"
  | "ai"
  | "agents"
  | "data"
  | "about";

/**
 * Keyed by SettingsCategory so TypeScript enforces an entry for every category —
 * adding a category to the union without one here is a compile error. Object key
 * order drives the nav order.
 *
 * `labelKey` resolves through i18next at render time.
 */
const CATEGORY_META: Record<
  SettingsCategory,
  { labelKey: string; icon: typeof Settings }
> = {
  general: { labelKey: "settings.nav.general", icon: Settings },
  planner: { labelKey: "settings.nav.planner", icon: Calendar },
  templates: { labelKey: "settings.nav.templates", icon: FileText },
  ai: { labelKey: "settings.nav.ai", icon: Sparkles },
  agents: { labelKey: "settings.nav.agents", icon: Users },
  data: { labelKey: "settings.nav.data", icon: FolderOpen },
  about: { labelKey: "settings.nav.about", icon: Info },
};

export const SETTINGS_CATEGORIES = (
  Object.keys(CATEGORY_META) as SettingsCategory[]
).map((value) => ({ value, ...CATEGORY_META[value] }));

interface SettingsNavProps {
  active: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}

export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center">
        <span className="text-sm font-medium">{t("settings.nav.title")}</span>
      </div>

      {/* Category list */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {SETTINGS_CATEGORIES.map(({ value, labelKey, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              value === active
                ? interactionClasses.selectedContent
                : interactionClasses.restingContent,
              interactionClasses.keyboardFocus,
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {t(labelKey)}
          </button>
        ))}
      </nav>
    </div>
  );
}
