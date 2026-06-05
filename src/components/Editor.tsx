import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import { buildExtensions } from "../editor/extensions";
import { SupabaseProvider, stringToColor } from "../collaboration/SupabaseProvider";
import { CollaboratorAvatars } from "./CollaboratorAvatars";
import { SharePanel } from "./SharePanel";
import { Toolbar } from "./Toolbar";
import { exportPdf, copyRichText } from "../share";
import { useAuth } from "../auth/AuthContext";
import type { DohDoc } from "../storage/db";

function getMarkdown(editor: TiptapEditor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

interface Props {
  doc: DohDoc;
  onChange: (markdown: string, ydocState: string | null) => void;
  onOpenSidebar?: () => void;
}

export function Editor({ doc, onChange, onOpenSidebar }: Props) {
  const { session, profile } = useAuth();
  const saveTimer = useRef<number | undefined>(undefined);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseProvider | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [source, setSource] = useState(doc.markdown);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  // Set up Y.Doc and SupabaseProvider per document
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    if (doc.ydocState) {
      Y.applyUpdate(ydoc, base64ToUint8(doc.ydocState));
    }

    if (session) {
      const color = stringToColor(session.user.id);
      const name = profile?.displayName ?? profile?.email ?? "Anonymous";
      providerRef.current = new SupabaseProvider(doc.id, ydoc, { name, color });
    }

    return () => {
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const editor = useEditor(
    {
      extensions: buildExtensions(
        ydocRef.current && providerRef.current && profile
          ? {
              ydoc: ydocRef.current,
              provider: providerRef.current,
              user: {
                name: profile.displayName ?? profile.email,
                color: stringToColor(session!.user.id),
              },
            }
          : undefined
      ),
      content: doc.ydocState ? undefined : doc.markdown,
      onUpdate: ({ editor }) => {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          const md = getMarkdown(editor);
          const ydocState = ydocRef.current
            ? uint8ToBase64(Y.encodeStateAsUpdate(ydocRef.current))
            : null;
          onChange(md, ydocState);
        }, 400);
      },
    },
    [doc.id]
  );

  if (import.meta.env.DEV && editor) {
    (window as unknown as { __editor?: unknown }).__editor = editor;
  }

  useEffect(() => {
    if (editor && !doc.ydocState && getMarkdown(editor) !== doc.markdown) {
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
    if (editor) editor.commands.setContent(source, { emitUpdate: false });
    onChange(source, null);
    setSourceMode(false);
  }

  function onSourceInput(value: string) {
    setSource(value);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => onChange(value, null), 400);
  }

  async function shareRichText() {
    if (editor) {
      const ok = await copyRichText(editor);
      setCopied(ok);
      setTimeout(() => setCopied(false), 1800);
    }
    setExportOpen(false);
  }

  function sharePdf() {
    if (editor) exportPdf(editor, doc.title || "DohDocs");
    setExportOpen(false);
  }

  return (
    <div className="editor">
      <div className="view-toggle">
        <button className="menu-btn" onClick={onOpenSidebar} title="Open menu">☰</button>
        <button className={!sourceMode ? "active" : ""} onClick={() => sourceMode ? exitSource() : undefined} title="Rich text view">
          Rich
        </button>
        <button className={sourceMode ? "active" : ""} onClick={() => !sourceMode ? enterSource() : undefined} title="Markdown source">
          {"</> MD"}
        </button>

        <button className="print-btn" onClick={sharePdf} title="Print / Save as PDF">
          <svg width="16" height="16" aria-hidden="true"><use href="/icons.svg#printer-icon" /></svg>
        </button>

        <div className="share-wrap">
          <button className={`share-btn ${exportOpen ? "active" : ""}`} onClick={() => setExportOpen((v) => !v)} title="Export">
            {copied ? "Copied ✓" : "Export ▾"}
          </button>
          {exportOpen && (
            <div className="share-menu" onMouseLeave={() => setExportOpen(false)}>
              <button onClick={sharePdf}>PDF</button>
              <button onClick={shareRichText}>Rich Text (copy)</button>
            </div>
          )}
        </div>

        {session && (
          <button
            className={`collab-share-btn${sharePanelOpen ? " active" : ""}`}
            onClick={() => setSharePanelOpen((v) => !v)}
            title="Share this note"
          >
            Share
          </button>
        )}

        {providerRef.current && (
          <CollaboratorAvatars
            provider={providerRef.current}
            currentUserId={session?.user.id ?? ""}
          />
        )}
      </div>

      {sharePanelOpen && session && (
        <SharePanel
          noteId={doc.id}
          ownerId={doc.ownerId}
          currentUserId={session.user.id}
          onClose={() => setSharePanelOpen(false)}
        />
      )}

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
