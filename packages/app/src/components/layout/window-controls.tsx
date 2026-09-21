import { Minus, Square, X } from "lucide-react";
import { isMacOS, isTauri } from "@desk/core";
import { cn } from "@/lib/utils";

interface WindowControlsProps {
  className?: string;
}

async function minimizeWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

async function toggleMaximizeWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

async function closeWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export function WindowControls({ className }: WindowControlsProps) {
  if (!isTauri() || isMacOS()) return null;

  return (
    <div className={cn("flex h-full shrink-0 items-stretch", className)}>
      <button
        type="button"
        className="flex w-11 items-center justify-center text-foreground/70 hover:bg-white/10 hover:text-foreground"
        aria-label="Minimizza"
        onClick={() => void minimizeWindow()}
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        className="flex w-11 items-center justify-center text-foreground/70 hover:bg-white/10 hover:text-foreground"
        aria-label="Massimizza o ripristina"
        onClick={() => void toggleMaximizeWindow()}
      >
        <Square className="size-3.5" />
      </button>
      <button
        type="button"
        className="flex w-11 items-center justify-center text-foreground/70 hover:bg-red-600 hover:text-white"
        aria-label="Chiudi"
        onClick={() => void closeWindow()}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
