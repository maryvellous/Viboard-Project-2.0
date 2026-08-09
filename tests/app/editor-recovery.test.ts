import { afterEach, describe, expect, it } from "vitest";
import {
  IndexedDbEditorRecovery,
  editorRecoveryNamespace,
  setEditorRecoveryUser,
} from "../../packages/app/src/lib/editor-recovery";
import { useBootStore } from "../../packages/app/src/stores/boot";

afterEach(() => {
  setEditorRecoveryUser(null);
  useBootStore.setState({
    dataPath: "~/DeskMD",
    connectionMode: "local",
    serverUrl: "",
  });
});

describe("editor recovery isolation", () => {
  it("binds a recovery store to the namespace captured at construction", () => {
    useBootStore.setState({ dataPath: "/data/one", connectionMode: "local" });
    const recovery = new IndexedDbEditorRecovery(editorRecoveryNamespace());

    useBootStore.setState({ dataPath: "/data/two" });

    expect(recovery.namespace).toBe("local:/data/one");
  });

  it("separates local data roots", () => {
    useBootStore.setState({ dataPath: "/data/one", connectionMode: "local" });
    const first = editorRecoveryNamespace();
    useBootStore.setState({ dataPath: "/data/two" });

    expect(editorRecoveryNamespace()).not.toBe(first);
  });

  it("separates remote origins and authenticated users", () => {
    useBootStore.setState({
      connectionMode: "remote",
      serverUrl: "https://desk-one.example/path",
    });
    setEditorRecoveryUser("alice");
    const aliceAtFirstServer = editorRecoveryNamespace();

    setEditorRecoveryUser("bob");
    const bobAtFirstServer = editorRecoveryNamespace();
    useBootStore.setState({ serverUrl: "https://desk-two.example" });
    const bobAtSecondServer = editorRecoveryNamespace();

    expect(bobAtFirstServer).not.toBe(aliceAtFirstServer);
    expect(bobAtSecondServer).not.toBe(bobAtFirstServer);
  });
});
