import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Braces,
  Columns3,
  Copy,
  Italic,
  Link as LinkIcon,
  MoreHorizontal,
  Rows3,
  Strikethrough,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  decodeCodeBlockLanguage,
  encodeCodeBlockLanguage,
  getCodeBlockLanguageOptions,
} from "@/lib/editor-command-model";
import { cn } from "@/lib/utils";

interface RichTextEditorControlsProps {
  editor: Editor;
}

interface MenuButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const menuSurface =
  "flex items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md";

function MenuButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: MenuButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn("size-7", active && "bg-accent text-accent-foreground")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function TextSelectionMenu({ editor }: RichTextEditorControlsProps) {
  const { t } = useTranslation();
  const [editingLink, setEditingLink] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      href: String(current.getAttributes("link").href ?? ""),
    }),
  });
  const [href, setHref] = useState("");

  const openLinkEditor = () => {
    setHref(state.href);
    setEditingLink(true);
  };

  const applyLink = () => {
    const nextHref = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (nextHref) chain.setLink({ href: nextHref }).run();
    else chain.unsetLink().run();
    setEditingLink(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="deskTextSelectionMenu"
      data-editor-menu="text"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current, from, to }) =>
        current.isEditable &&
        from !== to &&
        !current.isActive("codeBlock") &&
        !current.isActive("table")
      }
      className={menuSurface}
    >
      {editingLink ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            autoFocus
            value={href}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setEditingLink(false);
                editor.commands.focus();
              }
            }}
            placeholder={t("ui.richTextEditor.linkPlaceholder")}
            aria-label={t("ui.richTextEditor.linkUrl")}
            className="h-7 w-56 text-xs"
          />
          <Button type="submit" size="sm" className="h-7 px-2 text-xs">
            {t("common.buttons.apply")}
          </Button>
        </form>
      ) : (
        <>
          <MenuButton
            label={t("ui.richTextEditor.bold")}
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </MenuButton>
          <MenuButton
            label={t("ui.richTextEditor.italic")}
            active={state.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </MenuButton>
          <MenuButton
            label={t("ui.richTextEditor.strike")}
            active={state.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough />
          </MenuButton>
          <MenuButton
            label={t("ui.richTextEditor.inlineCode")}
            active={state.code}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Braces />
          </MenuButton>
          <MenuButton
            label={t("ui.richTextEditor.link")}
            active={state.link}
            onClick={openLinkEditor}
          >
            <LinkIcon />
          </MenuButton>
          {state.link && (
            <MenuButton
              label={t("ui.richTextEditor.unlink")}
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink />
            </MenuButton>
          )}
        </>
      )}
    </BubbleMenu>
  );
}

function TableMenu({ editor }: RichTextEditorControlsProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const availability = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      addRowBefore: current.can().addRowBefore(),
      addRowAfter: current.can().addRowAfter(),
      addColumnBefore: current.can().addColumnBefore(),
      addColumnAfter: current.can().addColumnAfter(),
      deleteRow: current.can().deleteRow(),
      deleteColumn: current.can().deleteColumn(),
      deleteTable: current.can().deleteTable(),
      mergeCells: current.can().mergeCells(),
      splitCell: current.can().splitCell(),
      toggleHeaderRow: current.can().toggleHeaderRow(),
    }),
  });

  const runAction = (action: () => unknown) => {
    action();
    setShowMore(false);
  };
  const actions: Array<{
    key:
      | "addRowBefore"
      | "addRowAfter"
      | "addColumnBefore"
      | "addColumnAfter"
      | "mergeCells"
      | "splitCell"
      | "toggleHeaderRow"
      | "deleteRow"
      | "deleteColumn"
      | "deleteTable";
    enabled: boolean;
    run: () => boolean;
  }> = [
    {
      key: "addRowBefore",
      enabled: availability.addRowBefore,
      run: () => editor.commands.addRowBefore(),
    },
    {
      key: "addRowAfter",
      enabled: availability.addRowAfter,
      run: () => editor.commands.addRowAfter(),
    },
    {
      key: "addColumnBefore",
      enabled: availability.addColumnBefore,
      run: () => editor.commands.addColumnBefore(),
    },
    {
      key: "addColumnAfter",
      enabled: availability.addColumnAfter,
      run: () => editor.commands.addColumnAfter(),
    },
    {
      key: "mergeCells",
      enabled: availability.mergeCells,
      run: () => editor.commands.mergeCells(),
    },
    {
      key: "splitCell",
      enabled: availability.splitCell,
      run: () => editor.commands.splitCell(),
    },
    {
      key: "toggleHeaderRow",
      enabled: availability.toggleHeaderRow,
      run: () => editor.commands.toggleHeaderRow(),
    },
    {
      key: "deleteRow",
      enabled: availability.deleteRow,
      run: () => editor.commands.deleteRow(),
    },
    {
      key: "deleteColumn",
      enabled: availability.deleteColumn,
      run: () => editor.commands.deleteColumn(),
    },
    {
      key: "deleteTable",
      enabled: availability.deleteTable,
      run: () => editor.commands.deleteTable(),
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="deskTableMenu"
      data-editor-menu="table"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current }) => current.isEditable && current.isActive("table")}
      className={cn(menuSurface, "flex-col items-stretch")}
    >
      <div className="flex items-center gap-0.5">
        <MenuButton
          label={t("ui.richTextEditor.table.addRowAfter")}
          disabled={!availability.addRowAfter}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          <Rows3 />
        </MenuButton>
        <MenuButton
          label={t("ui.richTextEditor.table.addColumnAfter")}
          disabled={!availability.addColumnAfter}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <Columns3 />
        </MenuButton>
        <MenuButton
          label={t("ui.richTextEditor.table.more")}
          active={showMore}
          onClick={() => setShowMore((visible) => !visible)}
        >
          <MoreHorizontal />
        </MenuButton>
      </div>
      {showMore && (
        <div className="grid grid-cols-2 gap-0.5 border-t pt-1">
          {actions.map((action) => (
            <Button
              key={action.key}
              type="button"
              variant="ghost"
              size="sm"
              disabled={!action.enabled}
              className={cn(
                "h-7 justify-start px-2 text-xs",
                action.key === "deleteTable" && "text-destructive hover:text-destructive",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(action.run)}
            >
              {t(`ui.richTextEditor.table.${action.key}`)}
            </Button>
          ))}
        </div>
      )}
    </BubbleMenu>
  );
}

function CodeBlockMenu({ editor }: RichTextEditorControlsProps) {
  const { t } = useTranslation();
  const language = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      String(current.getAttributes("codeBlock").language ?? ""),
  });
  const options = getCodeBlockLanguageOptions(language);

  const copyCode = async () => {
    const node = editor.state.selection.$from.parent;
    if (node.type.name !== "codeBlock") return;
    try {
      await navigator.clipboard.writeText(node.textContent);
      toast.success(t("ui.richTextEditor.code.copied"));
    } catch {
      toast.error(t("ui.richTextEditor.code.copyFailed"));
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="deskCodeBlockMenu"
      data-editor-menu="code"
      options={{ placement: "top-end", offset: 8 }}
      shouldShow={({ editor: current }) =>
        current.isEditable && current.isActive("codeBlock")
      }
      className={menuSurface}
    >
      <Select
        value={encodeCodeBlockLanguage(language)}
        onValueChange={(value) =>
          editor
            .chain()
            .focus()
            .updateAttributes("codeBlock", {
              language: decodeCodeBlockLanguage(value) || null,
            })
            .run()
        }
      >
        <SelectTrigger
          size="xs"
          className="h-7 max-w-36 border-0 bg-transparent px-2 shadow-none"
          aria-label={t("ui.richTextEditor.code.language")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={encodeCodeBlockLanguage(option.value)}
              value={encodeCodeBlockLanguage(option.value)}
            >
              {option.value ? option.label : t("ui.richTextEditor.code.plainText")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <MenuButton label={t("ui.richTextEditor.code.copy")} onClick={() => void copyCode()}>
        <Copy />
      </MenuButton>
    </BubbleMenu>
  );
}

export function RichTextEditorControls({ editor }: RichTextEditorControlsProps) {
  return (
    <>
      <TextSelectionMenu editor={editor} />
      <TableMenu editor={editor} />
      <CodeBlockMenu editor={editor} />
    </>
  );
}
