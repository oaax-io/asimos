import { useEditor, EditorContent, Editor, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Node, mergeAttributes } from "@tiptap/core";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Table as TableIcon,
  Link as LinkIcon,
  Code as CodeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ----- Variable chip node -----
// Renders {{key}} as a styled, atomic, non-editable chip in the editor.
const VariableChipView = (props: { node: { attrs: Record<string, unknown> } }) => {
  const name = String(props.node.attrs.name ?? "");
  const label = props.node.attrs.label ? String(props.node.attrs.label) : name;
  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary mx-0.5 align-middle select-none"
      data-variable={name}
    >
      {label}
    </NodeViewWrapper>
  );
};

const VariableChip = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: { default: "" },
      label: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-variable]",
        getAttrs: (el) => ({
          name: (el as HTMLElement).getAttribute("data-variable") ?? "",
          label: (el as HTMLElement).getAttribute("data-label"),
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    // Render as a plain {{name}} placeholder in stored HTML so the renderer can substitute it.
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-variable": node.attrs.name,
        "data-label": node.attrs.label ?? "",
      }),
      `{{${node.attrs.name}}}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VariableChipView);
  },
});

// Pre-process incoming HTML: convert {{key}} text occurrences into chip spans
// so that legacy templates (and HTML-tab edits) display chips after parsing.
function preprocessHtml(html: string, labelLookup: (key: string) => string | undefined): string {
  if (!html) return html;
  return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const label = labelLookup(key) ?? key;
    return `<span data-variable="${key}" data-label="${label.replace(/"/g, "&quot;")}">{{${key}}}</span>`;
  });
}

type Variable = { key: string; label: string };

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables: Variable[];
  className?: string;
}

export function RichTextEditor({ value, onChange, variables, className }: RichTextEditorProps) {
  const labelLookup = (key: string) => variables.find((v) => v.key === key)?.label;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "doc-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      VariableChip,
    ],
    content: preprocessHtml(value || "", labelLookup),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[400px] max-h-[60vh] overflow-y-auto rounded-md border bg-white p-4 focus:outline-none focus:ring-2 focus:ring-primary/30",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. switch from HTML tab) back into the editor.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(preprocessHtml(value, labelLookup), { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "ghost"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8"
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
      <ToolBtn title="Fett" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Kursiv" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Unterstrichen" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Durchgestrichen" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolBtn>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolBtn title="Überschrift 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Überschrift 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Überschrift 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolBtn>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolBtn title="Liste" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Nummerierung" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Zitat" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <CodeIcon className="h-4 w-4" />
      </ToolBtn>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolBtn title="Links ausrichten" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Zentriert" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Rechts ausrichten" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </ToolBtn>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolBtn
        title="Tabelle einfügen"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Link einfügen"
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href ?? "";
          const url = window.prompt("URL eingeben", previous);
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <LinkIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Trennlinie" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolBtn>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolBtn title="Rückgängig" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Wiederherstellen" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolBtn>
    </div>
  );
}

// Helper exposed so parent components can insert a variable chip programmatically.
export function insertVariableIntoEditor(editor: Editor | null, key: string, label: string) {
  if (!editor) return;
  editor.chain().focus().insertContent({
    type: "variable",
    attrs: { name: key, label },
  }).run();
}
