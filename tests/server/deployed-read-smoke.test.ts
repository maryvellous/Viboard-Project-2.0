import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { getDeskService } from "@desk/core";
import { setDataRootResolver, setStorage } from "@desk/core/host";
import type { Doc, Project, Workspace } from "@desk/core/types";
import { verifyDeployedRead } from "../../scripts/verify-deployed-read";
import { DataRootOwnership } from "../../packages/server/src/data-root-ownership";
import { NodeFsProvider } from "../../packages/server/src/node-fs-provider";

const execFileAsync = promisify(execFile);

const workspace: Workspace = {
  id: "slsp",
  name: "SLSP",
  created: "2026-01-01",
};

const project: Project = {
  id: "library-interface",
  workspaceId: workspace.id,
  name: "Speicherbibliothek Interface",
  status: "active",
  created: "2026-01-01",
};

const listedDoc: Doc = {
  id: "2026-07-16-state",
  workspaceId: workspace.id,
  projectId: project.id,
  filePath: "/data/workspaces/slsp/projects/library-interface/docs/2026-07-16-state.md",
  title: "Current state",
  content: "Library interface state",
};

describe("deployed scoped-read smoke", () => {
  it("runs against the live data root while the server owns its writer lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "deskmd-deployed-read-"));
    setStorage(new NodeFsProvider(root));
    setDataRootResolver(async () => root);

    const service = getDeskService();
    await service.createWorkspace({ id: "verification", name: "Verification" });
    const project = await service.createProject({
      workspaceId: "verification",
      name: "Live Data",
    });
    const created = await service.createDoc({
      workspaceId: "verification",
      projectId: project.id,
      title: "Deployment Read",
    });
    const ownership = DataRootOwnership.acquire(root);

    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        ["--import", "tsx", "scripts/verify-deployed-read.ts"],
        {
          cwd: process.cwd(),
          env: { ...process.env, DESK_DATA_ROOT: root },
        },
      );

      expect(JSON.parse(stdout.trim())).toEqual({
        ok: true,
        workspace: "verification",
        project: "live-data",
        document: created.id,
      });
    } finally {
      ownership.release();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reads the listed document with its complete workspace/project identity", async () => {
    const getDoc = vi.fn().mockResolvedValue(listedDoc);
    const result = await verifyDeployedRead({
      getWorkspaces: vi.fn().mockResolvedValue([workspace]),
      getProjects: vi.fn().mockResolvedValue([project]),
      getDocsByProject: vi.fn().mockResolvedValue([listedDoc]),
      getDoc,
    });

    expect(getDoc).toHaveBeenCalledWith(workspace.id, project.id, listedDoc.id);
    expect(result).toEqual({
      ok: true,
      workspace: workspace.id,
      project: project.id,
      document: listedDoc.id,
    });
  });

  it("rejects a same-id document resolved from another project", async () => {
    await expect(
      verifyDeployedRead({
        getWorkspaces: vi.fn().mockResolvedValue([workspace]),
        getProjects: vi.fn().mockResolvedValue([project]),
        getDocsByProject: vi.fn().mockResolvedValue([listedDoc]),
        getDoc: vi.fn().mockResolvedValue({
          ...listedDoc,
          projectId: "crm",
          filePath: "/data/workspaces/slsp/projects/crm/docs/2026-07-16-state.md",
          content: "CRM state",
        }),
      }),
    ).rejects.toThrow("Scoped document read mismatch");
  });
});
