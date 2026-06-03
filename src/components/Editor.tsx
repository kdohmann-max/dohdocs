// The document editor: a TipTap instance wired to the MD Toolbar, with
// debounced autosave back to the Markdown store.

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import { buildExtensions } from "../editor/extensions";

/** tiptap-markdown's storage isn't typed; access its serializer safely. */
function getMarkdown(editor: TiptapEditor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
}
import { Toolbar } from "./Toolbar";
import { exportPdf, copyRichText } from "../share";
import type { DohDoc } from "../storage/db";

interface Props {
  doc: DohDoc;
  onChange: (markdown: string) => void;
  onOpenSidebar?: () => void;
}

export function Editor({ doc, onChange, onOpenSidebar }: Props) {
  const saveTimer = useRef<number | undefined>(undefined);
  const [sourceMode, setSourceMode] = useState(false);
  const [source, setSource] = useState(doc.markdown);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const editor = useEditor(
    {
      extensions: buildExtensions(),
      content: doc.markdown,
      onUpdate: ({ editor }) => {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          // tiptap-markdown exposes the serializer on storage.
          const md = getMarkdown(editor);
          onChange(md);
        }, 400);
      },
    },
    [doc.id]
  );

  // Dev-only: expose the editor for manual/automated verification.
  if (import.meta.env.DEV && editor) {
    (window as unknown as { __editor?: unknown }).__editor = editor;
  }

  // Load a different document's content when the selection changes.
  useEffect(() => {
    if (editor && getMarkdown(editor) !== doc.markdown) {
      editor.commands.setContent(doc.markdown, { emitUpdate: false });
    }
    setSource(doc.markdown);
    setSourceMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, editor]);

  function enterSource() {
    if (editor) setSource(getMarkdown(editor));
    setSourceMode(true);
  }

  function exitSource() {
    // Push edited Markdown back into the rich editor and save.
    if (editor) editor.commands.setContent(source, { emitUpdate: false });
    onChange(source);
    setSourceMode(false);
  }

  function onSourceInput(value: string) {
    setSource(value);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => onChange(value), 400);
  }

  function sharePdf() {
    if (editor) exportPdf(editor, doc.title || "DohDocs");
    setShareOpen(false);
  }

  async function shareRichText() {
    if (editor) {
      const ok = await copyRichText(editor);
      setCopied(ok);
      setTimeout(() => setCopied(false), 1800);
    }
    setShareOpen(false);
  }

  return (
    <div className="editor">
      <div className="view-toggle">
        <button className="menu-btn" onClick={onOpenSidebar} title="Open menu">☰</button>
        <button
          className={!sourceMode ? "active" : ""}
          onClick={() => (sourceMode ? exitSource() : undefined)}
          title="Rich text view"
        >
          Rich
        </button>
        <button
          className={sourceMode ? "active" : ""}
          onClick={() => (!sourceMode ? enterSource() : undefined)}
          title="Markdown source view"
        >
          {"</> MD"}
        </button>

        <button
          className="print-btn"
          onClick={sharePdf}
          title="Print / Save as PDF"
        >
          <svg width="16" height="16" aria-hidden="true">
            <use href="/icons.svg#printer-icon" />
          </svg>
        </button>

        <div className="share-wrap">
          <button
            className={`share-btn ${shareOpen ? "active" : ""}`}
            onClick={() => setShareOpen((v) => !v)}
            title="Share"
          >
            {copied ? "Copied ✓" : "Share ▾"}
          </button>
          {shareOpen && (
            <div className="share-menu" onMouseLeave={() => setShareOpen(false)}>
              <button onClick={sharePdf}>PDF</button>
              <button onClick={shareRichText}>Rich Text (copy)</button>
            </div>
          )}
        </div>
      </div>

      {sourceMode ? (
        <textarea
          className="source-surface"
          value={source}
          spellCheck={false}
          onChange={(e) => onSourceInput(e.target.value)}
        />
      ) : (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} className="editor-surface" />
        </>
      )}
    </div>
  );
}
