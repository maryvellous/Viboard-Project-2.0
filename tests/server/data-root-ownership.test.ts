import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DataRootOwnership } from "../../packages/server/src/data-root-ownership";

const roots: string[] = [];
const children: ChildProcessWithoutNullStreams[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null) child.kill("SIGKILL");
    await waitForExit(child);
  }
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("server data-root ownership", () => {
  it("rejects a second owner and permits it after normal release", async () => {
    const root = await temporaryRoot();
    const first = DataRootOwnership.acquire(root);
    expect(() => DataRootOwnership.acquire(root)).toThrow(/already owned/);
    first.release();

    const second = DataRootOwnership.acquire(root);
    second.release();
  });

  it("is released by the OS after a process is killed", async () => {
    const root = await temporaryRoot();
    const child = spawn(
      process.execPath,
      [
        "-e",
        `const fs=require("node:fs");const p=require("node:path");const x=require("fs-ext");`
          + `const d=p.join(process.argv[1],".desk");fs.mkdirSync(d,{recursive:true});`
          + `const fd=fs.openSync(p.join(d,"writer.lock"),"a");x.flockSync(fd,"exnb");`
          + `process.stdout.write("ready\\n");setInterval(()=>{},1000);`,
        root,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    children.push(child);
    await waitForOutput(child, "ready");

    expect(() => DataRootOwnership.acquire(root)).toThrow(/already owned/);
    child.kill("SIGKILL");
    await waitForExit(child);

    const owner = DataRootOwnership.acquire(root);
    owner.release();
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "deskmd-owner-"));
  roots.push(root);
  return root;
}

function waitForOutput(child: ChildProcessWithoutNullStreams, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.includes(expected)) resolve();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (!output.includes(expected)) reject(new Error(`Lock holder exited early (${code})`));
    });
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", () => resolve()));
}
