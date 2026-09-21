import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  usePreferencesStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  type Language,
} from "@/stores/preferences";

export function GeneralTab() {
  const { t } = useTranslation();
  const { language, sidebarWidth, setLanguage, setSidebarWidth } = usePreferencesStore();
  const isCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH;

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t("settings.general.appearance.title")}
        description={t("settings.general.appearance.description")}
      >
        <SettingsGroup>
          <SettingsRow
            label={t("settings.general.language.label")}
            description={t("settings.general.language.description")}
          >
            <Select value={language} onValueChange={(v: Language) => setLanguage(v)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("settings.general.language.options.en")}</SelectItem>
                <SelectItem value="de">{t("settings.general.language.options.de")}</SelectItem>
                <SelectItem value="fr">{t("settings.general.language.options.fr")}</SelectItem>
                <SelectItem value="it">{t("settings.general.language.options.it")}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label={t("settings.general.compactSidebar.label")}
            description={t("settings.general.compactSidebar.description")}
          >
            <Switch
              checked={isCollapsed}
              onCheckedChange={(checked) => {
                setSidebarWidth(checked ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_DEFAULT_WIDTH);
                toast.success(
                  checked
                    ? t("toasts.settings.sidebarCollapsed")
                    : t("toasts.settings.sidebarExpanded"),
                );
              }}
            />
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>
    </div>
  );
}
