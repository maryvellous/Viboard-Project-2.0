/**
 * Dashboard quick-add — ONE compact bar, no second creation path.
 *
 * The bar collects a title and hands it to `NewTaskModal`, the same component the
 * Tasks page uses, which calls `useCreateTask` → `getDeskService().createTask`.
 * Nothing here writes files or fakes a task: pressing Enter or the pill opens the
 * real modal with the title prefilled so project/priority/due stay selectable.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NewTaskModal } from "@/components/tasks/new-task-modal";

export function QuickAddTask() {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);

  const openModal = () => setOpen(true);

  return (
    <>
      <form
        className="diaspro-quickadd"
        onSubmit={(event) => {
          event.preventDefault();
          openModal();
        }}
      >
        <Plus className="size-4 shrink-0 text-[#1e1333]/55" />
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("pages.dashboard.quickAdd.placeholder")}
          className="h-7 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          aria-label={t("pages.dashboard.quickAdd.placeholder")}
        />
        <button type="submit" className="diaspro-pill diaspro-pill--sand">
          <Plus className="size-3.5" />
          {t("pages.dashboard.quickAdd.action")}
        </button>
      </form>

      <NewTaskModal
        open={open}
        onClose={() => {
          setOpen(false);
          setTitle("");
        }}
        defaultTitle={title.trim() || undefined}
      />
    </>
  );
}
