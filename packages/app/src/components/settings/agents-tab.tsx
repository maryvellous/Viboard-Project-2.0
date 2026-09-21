import {
  SettingsGroup,
  SettingsNotice,
  SettingsRow,
  SettingsSection,
} from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import { useAgentSettingsStore, anyAgentFileEnabled } from "@/stores/agent-settings";
import { useWorkspaces } from "@/stores";
import {
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
} from "@/lib/smart-index/agent-files";
import { getDeskService } from "@desk/core";
import { AgentInstructionsCard } from "./agent-instructions-card";
import { AgentFilePreviewCard } from "./agent-file-preview-card";

export function AgentsTab() {
  const { t } = useTranslation();
  const {
    emitClaudeMd,
    emitAgentsMd,
    emitGeminiMd,
    setEmitClaudeMd,
    setEmitAgentsMd,
    setEmitGeminiMd,
  } = useAgentSettingsStore();
  const { data: workspaces = [] } = useWorkspaces();

  // Re-emit all agent files (or sweep disabled ones) after a toggle change.
  const refreshAgentFiles = async () => {
    try {
      for (const ws of workspaces) {
        const projects = await getDeskService().getProjects(ws.id);
        await writePerWorkspaceAgentFiles(ws.id, ws, projects);
      }
      await writeTopLevelAgentFiles(workspaces);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.settings.agentFilesUpdateFailed", { message }));
    }
  };

  const makeToggleHandler =
    (setter: (v: boolean) => void, label: string) => async (enabled: boolean) => {
      setter(enabled);
      await refreshAgentFiles();
      toast.success(
        enabled
          ? t("toasts.settings.agentFileEnabled", { file: label })
          : t("toasts.settings.agentFileRemoved", { file: label }),
      );
    };

  const anyEnabled = anyAgentFileEnabled();
  return (
    <div className="space-y-8">
      <SettingsNotice>
        <Trans i18nKey="settings.agents.notice" components={{ strong: <strong /> }} />
      </SettingsNotice>

      <SettingsSection
        title={t("settings.agents.global.title")}
        description={t("settings.agents.global.description")}
      >
        <SettingsGroup>
          <AgentInstructionsCard />
          <AgentFilePreviewCard />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title={t("settings.agents.emit.title")}
        description={t("settings.agents.emit.description")}
      >
        <SettingsGroup>
          <ToggleRow
            label="CLAUDE.md"
            description={t("settings.agents.emit.claude")}
            checked={emitClaudeMd}
            onChange={makeToggleHandler(setEmitClaudeMd, "CLAUDE.md")}
          />
          <ToggleRow
            label="AGENTS.md"
            description={t("settings.agents.emit.agents")}
            checked={emitAgentsMd}
            onChange={makeToggleHandler(setEmitAgentsMd, "AGENTS.md")}
          />
          <ToggleRow
            label="GEMINI.md"
            description={t("settings.agents.emit.gemini")}
            checked={emitGeminiMd}
            onChange={makeToggleHandler(setEmitGeminiMd, "GEMINI.md")}
          />
        </SettingsGroup>
        {!anyEnabled && (
          <SettingsNotice tone="warning">{t("settings.agents.emit.noneEnabled")}</SettingsNotice>
        )}
      </SettingsSection>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <SettingsRow
      label={<code className="text-xs">{label}</code>}
      description={description}
    >
      <Switch checked={checked} onCheckedChange={onChange} />
    </SettingsRow>
  );
}
