import { Extension, ReactRenderer, type Editor, type Range } from "@tiptap/react";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Code2,
  Quote,
  Minus,
  Link,
  ChevronLeft,
} from "lucide-react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TABLE_SIZE,
  TABLE_PICKER_LIMIT,
  moveTablePickerSelection,
  type TablePickerArrowKey,
  type TableSize,
} from "@/lib/editor-command-model";

// ─── Command Items ───────────────────────────────────────────────────────────

interface SlashCommandItemBase {
  title: string;
  aliases: string[];
  description: string;
  icon: React.ReactNode;
}

interface EditorSlashCommandItem extends SlashCommandItemBase {
  kind: "command";
  command: (editor: Editor, range: Range) => void;
}

interface TableSlashCommandItem extends SlashCommandItemBase {
  kind: "table";
}

type SlashCommandItem = EditorSlashCommandItem | TableSlashCommandItem;

type SlashCommandSelection =
  | { kind: "command"; item: EditorSlashCommandItem }
  | { kind: "table"; item: TableSlashCommandItem; size: TableSize };

function getSlashCommands(): SlashCommandItem[] {
  const t = i18next.t.bind(i18next);
  return [
    {
      kind: "command",
      title: t("ui.slashCommands.heading1.title"),
      aliases: ["h1"],
      description: t("ui.slashCommands.heading1.description"),
      icon: <Heading1 className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.heading2.title"),
      aliases: ["h2"],
      description: t("ui.slashCommands.heading2.description"),
      icon: <Heading2 className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.heading3.title"),
      aliases: ["h3"],
      description: t("ui.slashCommands.heading3.description"),
      icon: <Heading3 className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.bulletList.title"),
      aliases: ["bullet", "ul", "unordered"],
      description: t("ui.slashCommands.bulletList.description"),
      icon: <List className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.numberedList.title"),
      aliases: ["numbered", "ol", "ordered"],
      description: t("ui.slashCommands.numberedList.description"),
      icon: <ListOrdered className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.taskList.title"),
      aliases: ["task", "checkbox", "todo", "check"],
      description: t("ui.slashCommands.taskList.description"),
      icon: <CheckSquare className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      kind: "table",
      title: t("ui.slashCommands.table.title"),
      aliases: ["table"],
      description: t("ui.slashCommands.table.description"),
      icon: <TableIcon className="size-4" />,
    },
    {
      kind: "command",
      title: t("ui.slashCommands.codeBlock.title"),
      aliases: ["code", "codeblock", "pre"],
      description: t("ui.slashCommands.codeBlock.description"),
      icon: <Code2 className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.blockquote.title"),
      aliases: ["quote", "blockquote"],
      description: t("ui.slashCommands.blockquote.description"),
      icon: <Quote className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.divider.title"),
      aliases: ["divider", "hr", "rule", "separator"],
      description: t("ui.slashCommands.divider.description"),
      icon: <Minus className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      kind: "command",
      title: t("ui.slashCommands.link.title"),
      aliases: ["link", "url"],
      description: t("ui.slashCommands.link.description"),
      icon: <Link className="size-4" />,
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(
          new CustomEvent("slash-command:open-link-picker", {
            detail: { editor },
          })
        );
      },
    },
  ];
}

// ─── Filter ──────────────────────────────────────────────────────────────────

function filterCommands(query: string): SlashCommandItem[] {
  const commands = getSlashCommands();
  if (!query) return commands;
  const lower = query.toLowerCase();
  return commands.filter(
    (item) =>
      item.title.toLowerCase().includes(lower) ||
      item.aliases.some((a) => a.includes(lower))
  );
}

// ─── Popup Component ─────────────────────────────────────────────────────────

interface SlashCommandsListProps {
  editor: Editor;
  items: SlashCommandItem[];
  command: (selection: SlashCommandSelection) => void;
}

export interface SlashCommandsListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

function getTableCellKey(size: TableSize) {
  return `${size.rows}-${size.cols}`;
}

const SlashCommandsList = forwardRef<SlashCommandsListRef, SlashCommandsListProps>(
  ({ editor, items, command }, ref) => {
    const { t } = useTranslation();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [tableItem, setTableItem] = useState<TableSlashCommandItem | null>(null);
    const [tableSize, setTableSize] = useState<TableSize>(DEFAULT_TABLE_SIZE);
    const tableSizeRef = useRef<TableSize>(DEFAULT_TABLE_SIZE);
    const listRef = useRef<HTMLDivElement>(null);
    const tableCellRefs = useRef(new Map<string, HTMLButtonElement>());

    const focusTableCell = useCallback((size: TableSize) => {
      tableCellRefs.current.get(getTableCellKey(size))?.focus();
    }, []);

    const exitTablePicker = useCallback(() => {
      setTableItem(null);
      requestAnimationFrame(() => editor.commands.focus());
    }, [editor]);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
    useEffect(() => {
      const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    useEffect(() => {
      if (tableItem) focusTableCell(DEFAULT_TABLE_SIZE);
    }, [focusTableCell, tableItem]);

    const handleTablePickerKey = useCallback(
      (key: string) => {
        if (!tableItem) return false;
        if (key === "Escape") {
          exitTablePicker();
          return true;
        }
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
          const next = moveTablePickerSelection(
            tableSizeRef.current,
            key as TablePickerArrowKey,
          );
          tableSizeRef.current = next;
          setTableSize(next);
          focusTableCell(next);
          return true;
        }
        if (key === "Enter") {
          command({ kind: "table", item: tableItem, size: tableSizeRef.current });
          return true;
        }
        return false;
      }, [command, exitTablePicker, focusTableCell, tableItem],
    );

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (!item) return;
        if (item.kind === "table") {
          setTableItem(item);
          tableSizeRef.current = DEFAULT_TABLE_SIZE;
          setTableSize(DEFAULT_TABLE_SIZE);
          return;
        }
        command({ kind: "command", item });
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (tableItem) {
          return handleTablePickerKey(event.key);
        }
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }), [handleTablePickerKey, items.length, selectItem, selectedIndex, tableItem]);

    if (tableItem) {
      return (
        <div className="slash-commands-popup p-2">
          <button
            type="button"
            className="mb-2 flex w-full items-center gap-2 rounded-sm px-1 py-1 text-sm font-medium hover:bg-accent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={exitTablePicker}
          >
            <ChevronLeft className="size-4" />
            {t("ui.slashCommands.table.pickerTitle")}
          </button>
          <div
            role="grid"
            aria-label={t("ui.slashCommands.table.pickerLabel")}
            aria-rowcount={TABLE_PICKER_LIMIT}
            aria-colcount={TABLE_PICKER_LIMIT}
            className="grid grid-cols-8 gap-1"
          >
            {Array.from({ length: TABLE_PICKER_LIMIT }, (_, rowIndex) => {
              const rows = rowIndex + 1;
              return (
                <div key={rows} role="row" className="contents">
                  {Array.from({ length: TABLE_PICKER_LIMIT }, (_, colIndex) => {
                    const cols = colIndex + 1;
                    const size = { rows, cols };
                    const isActive = rows === tableSize.rows && cols === tableSize.cols;
                    const isSelected = rows <= tableSize.rows && cols <= tableSize.cols;
                    return (
                      <button
                        key={getTableCellKey(size)}
                        ref={(element) => {
                          const key = getTableCellKey(size);
                          if (element) tableCellRefs.current.set(key, element);
                          else tableCellRefs.current.delete(key);
                        }}
                        type="button"
                        role="gridcell"
                        aria-label={t("ui.slashCommands.table.dimensions", size)}
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        className={cn(
                          "size-6 rounded-sm border transition-colors",
                          isSelected
                            ? "border-primary bg-primary/20"
                            : "border-border bg-background hover:bg-accent",
                        )}
                        onKeyDown={(event) => {
                          if (!handleTablePickerKey(event.key)) return;
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseEnter={() => {
                          tableSizeRef.current = size;
                          setTableSize(size);
                        }}
                        onClick={() =>
                          command({ kind: "table", item: tableItem, size })
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="pt-2 text-center text-xs text-muted-foreground">
            {t("ui.slashCommands.table.dimensions", {
              rows: tableSize.rows,
              cols: tableSize.cols,
            })}
          </div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="slash-commands-popup">
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {t("ui.slashCommands.empty")}
          </div>
        </div>
      );
    }

    return (
      <div ref={listRef} className="slash-commands-popup">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-sm text-left",
              "hover:bg-accent",
              index === selectedIndex && "bg-accent text-accent-foreground"
            )}
            onClick={() => selectItem(index)}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);
SlashCommandsList.displayName = "SlashCommandsList";

// ─── Positioning Helper ──────────────────────────────────────────────────────

function updatePosition(
  popup: HTMLElement,
  clientRect: (() => DOMRect | null) | null | undefined
) {
  if (!clientRect) return;
  const rect = clientRect();
  if (!rect) return;

  // Position below cursor, flip above if near bottom of viewport
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 300) {
    popup.style.left = `${rect.left}px`;
    popup.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    popup.style.top = "";
  } else {
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.bottom = "";
  }
}

// ─── Suggestion Render ───────────────────────────────────────────────────────

function createSuggestionRender(): SuggestionOptions<SlashCommandItem, SlashCommandSelection>["render"] {
  return () => {
    let renderer: ReactRenderer<SlashCommandsListRef, SlashCommandsListProps> | null = null;

    return {
      onStart(props: SuggestionProps<SlashCommandItem, SlashCommandSelection>) {
        renderer = new ReactRenderer(SlashCommandsList, {
          editor: props.editor,
          props: {
            editor: props.editor,
            items: props.items,
            command: props.command,
          },
        });
        const popup = renderer.element;
        popup.style.position = "fixed";
        popup.style.zIndex = "50";
        document.body.appendChild(popup);
        updatePosition(popup, props.clientRect);
      },

      onUpdate(props: SuggestionProps<SlashCommandItem, SlashCommandSelection>) {
        if (!renderer) return;
        updatePosition(renderer.element, props.clientRect);
        renderer.updateProps({
          editor: props.editor,
          items: props.items,
          command: props.command,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },

      onExit() {
        renderer?.destroy();
        renderer = null;
      },
    };
  };
}

// ─── Tiptap Extension ────────────────────────────────────────────────────────

const slashCommandsPluginKey = new PluginKey("slashCommands");

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandSelection>({
        editor: this.editor,
        pluginKey: slashCommandsPluginKey,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        allowedPrefixes: [" "],
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props: selection }) => {
          if (selection.kind === "table") {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertTable({
                rows: selection.size.rows,
                cols: selection.size.cols,
                withHeaderRow: true,
              })
              .run();
            return;
          }
          selection.item.command(editor, range);
        },
        render: createSuggestionRender(),
      }),
    ];
  },
});
