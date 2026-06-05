import { useEffect, useRef, useState } from "react";
import type { DocMeta, Folder, Profile } from "../storage/db";

export type SortMode = "edited" | "name";

interface Props {
  docs: DocMeta[];
  folders: Folder[];
  activeId: string | null;
  search: string;
  onSearch: (value: string) => void;
  sort: SortMode;
  onSort: (mode: SortMode) => void;
  onSelect: (id: string) => void;
  onCreateInFolder: (folderId: string | null) => void;
  onDelete: (id: string) => void;
  onMoveDoc: (docId: string, folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  profile?: Profile | null;
  onOpenAdmin?: () => void;
}

type Tree = Map<string | null, Folder[]>;

function buildTree(folders: Folder[]): Tree {
  const map: Tree = new Map();
  for (const f of folders) {
    const arr = map.get(f.parentId) ?? [];
    arr.push(f);
    map.set(f.parentId, arr);
  }
  return map;
}

// ---- Shared inline input ----

function InlineInput({
  placeholder = "Name…",
  defaultValue = "",
  depth,
  onConfirm,
  onCancel,
}: {
  placeholder?: string;
  defaultValue?: string;
  depth: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    if (defaultValue) ref.current?.select();
  }, [defaultValue]);

  return (
    <li
      className="inline-input-item"
      style={{ paddingLeft: `${10 + depth * 16}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        className="inline-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (value.trim()) onConfirm(value.trim());
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={onCancel}
      />
    </li>
  );
}

// ---- DocItem ----

interface DocItemProps {
  doc: DocMeta;
  activeId: string | null;
  depth: number;
  folders: Folder[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveDoc: (docId: string, folderId: string | null) => void;
}

function DocItem({ doc, activeId, depth, folders, onSelect, onDelete, onMoveDoc }: DocItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function closeMenu() {
    setShowMenu(false);
    setConfirmDelete(false);
  }

  return (
    <li
      className={`doc-item${doc.id === activeId ? " active" : ""}`}
      style={{ paddingLeft: `${10 + depth * 16}px` }}
      onClick={() => { onSelect(doc.id); closeMenu(); }}
    >
      <span className="doc-title">{doc.title || "Untitled"}</span>
      <div className="doc-actions" onClick={(e) => e.stopPropagation()}>
        <button className="doc-menu-btn" title="Options" onClick={() => setShowMenu((v) => !v)}>
          ⋯
        </button>
        {showMenu && !confirmDelete && (
          <div className="doc-menu">
            <div className="doc-menu-label">Move to</div>
            <button onClick={() => { onMoveDoc(doc.id, null); closeMenu(); }}>Root</button>
            {folders.map((f) => (
              <button key={f.id} onClick={() => { onMoveDoc(doc.id, f.id); closeMenu(); }}>
                {f.name}
              </button>
            ))}
            <div className="doc-menu-sep" />
            <button className="doc-menu-delete" onClick={() => setConfirmDelete(true)}>
              Delete…
            </button>
          </div>
        )}
        {showMenu && confirmDelete && (
          <div className="doc-menu">
            <div className="doc-menu-label">Delete this note?</div>
            <button
              className="doc-menu-delete"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { closeMenu(); onDelete(doc.id); }}
            >
              Yes, delete
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ---- FolderNode ----

interface FolderNodeProps {
  folder: Folder;
  depth: number;
  tree: Tree;
  docs: DocMeta[];
  activeId: string | null;
  folders: Folder[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveDoc: (docId: string, folderId: string | null) => void;
  onCreateInFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

function FolderNode({
  folder, depth, tree, docs, activeId, folders,
  onSelect, onDelete, onMoveDoc, onCreateInFolder,
  onCreateFolder, onRenameFolder, onDeleteFolder,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const children = tree.get(folder.id) ?? [];
  const folderDocs = docs.filter((d) => d.folderId === folder.id);

  function closeMenu() {
    setMenuOpen(false);
    setConfirmDelete(false);
  }

  return (
    <>
      <li className="folder-item" style={{ paddingLeft: `${10 + depth * 16}px` }}>
        <button
          className="folder-toggle"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▼" : "▶"}
        </button>

        {renaming ? (
          <input
            className="folder-rename-input"
            defaultValue={folder.name}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value.trim();
                if (v && v !== folder.name) onRenameFolder(folder.id, v);
                setRenaming(false);
              }
              if (e.key === "Escape") { e.preventDefault(); setRenaming(false); }
            }}
            onBlur={() => setRenaming(false)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="folder-name">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ marginRight: 4, opacity: 0.7, flexShrink: 0 }}>
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.764c.414 0 .8.182 1.06.5l.5.625A1.5 1.5 0 0 0 8.9 3.75H13.5A1.5 1.5 0 0 1 15 5.25v7.25A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9Z"/>
            </svg>
            {folder.name}
          </span>
        )}

        <div className="folder-actions">
          <button
            className="folder-add-btn"
            title="New note in folder"
            onClick={() => onCreateInFolder(folder.id)}
          >+</button>
          <button
            className="folder-menu-btn"
            title="Folder options"
            onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
          >⋯</button>

          {menuOpen && !confirmDelete && (
            <div className="folder-menu">
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { closeMenu(); setRenaming(true); }}>Rename</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { closeMenu(); setExpanded(true); setAddingChild(true); }}>New subfolder</button>
              <button className="folder-menu-delete" onMouseDown={(e) => e.preventDefault()} onClick={() => setConfirmDelete(true)}>Delete…</button>
            </div>
          )}
          {menuOpen && confirmDelete && (
            <div className="folder-menu">
              <div className="folder-menu-label">Delete "{folder.name}"?</div>
              <button
                className="folder-menu-delete"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { closeMenu(); onDeleteFolder(folder.id); }}
              >Yes, delete</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      </li>

      {expanded && (
        <>
          {addingChild && (
            <InlineInput
              placeholder="Subfolder name…"
              depth={depth + 1}
              onConfirm={(name) => { setAddingChild(false); onCreateFolder(name, folder.id); }}
              onCancel={() => setAddingChild(false)}
            />
          )}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              tree={tree}
              docs={docs}
              activeId={activeId}
              folders={folders}
              onSelect={onSelect}
              onDelete={onDelete}
              onMoveDoc={onMoveDoc}
              onCreateInFolder={onCreateInFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
          {folderDocs.map((doc) => (
            <DocItem
              key={doc.id}
              doc={doc}
              activeId={activeId}
              depth={depth + 1}
              folders={folders}
              onSelect={onSelect}
              onDelete={onDelete}
              onMoveDoc={onMoveDoc}
            />
          ))}
        </>
      )}
    </>
  );
}

// ---- Sidebar ----

export function Sidebar({
  docs, folders, activeId, search, onSearch, sort, onSort,
  onSelect, onCreateInFolder, onDelete, onMoveDoc,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  isOpen, onClose, profile, onOpenAdmin,
}: Props) {
  const [addingRoot, setAddingRoot] = useState(false);
  const tree = buildTree(folders);
  const rootFolders = tree.get(null) ?? [];
  const rootDocs = docs.filter((d) => d.folderId === null);

  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      <div className="sidebar-head">
        <span className="brand">DohDocs</span>
        <div className="head-actions">
          {profile?.role === "admin" && (
            <button className="admin-btn" onClick={onOpenAdmin} title="Admin dashboard">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
              </svg>
            </button>
          )}
          <button className="new-folder" onClick={() => setAddingRoot(true)} title="New folder">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.764c.414 0 .8.182 1.06.5l.5.625A1.5 1.5 0 0 0 8.9 3.75H13.5A1.5 1.5 0 0 1 15 5.25v7.25A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9Z"/>
            </svg>
            +
          </button>
          <button className="new-doc" onClick={() => onCreateInFolder(null)} title="New document">+</button>
          <button className="sidebar-close" onClick={onClose} title="Close menu">✕</button>
        </div>
      </div>

      <div className="sidebar-controls">
        <input
          className="search-input"
          type="search"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <label className="sort-control" title="Sort notes">
          <span className="sort-label">Sort</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as SortMode)}>
            <option value="edited">Last edited</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <ul className="doc-list">
        {addingRoot && (
          <InlineInput
            placeholder="Folder name…"
            depth={0}
            onConfirm={(name) => { setAddingRoot(false); onCreateFolder(name, null); }}
            onCancel={() => setAddingRoot(false)}
          />
        )}
        {rootFolders.length === 0 && rootDocs.length === 0 && !addingRoot && (
          <li className="empty">{search ? "No matches" : "No documents yet"}</li>
        )}
        {rootFolders.map((f) => (
          <FolderNode
            key={f.id}
            folder={f}
            depth={0}
            tree={tree}
            docs={docs}
            activeId={activeId}
            folders={folders}
            onSelect={onSelect}
            onDelete={onDelete}
            onMoveDoc={onMoveDoc}
            onCreateInFolder={onCreateInFolder}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />
        ))}
        {rootDocs.map((doc) => (
          <DocItem
            key={doc.id}
            doc={doc}
            activeId={activeId}
            depth={0}
            folders={folders}
            onSelect={onSelect}
            onDelete={onDelete}
            onMoveDoc={onMoveDoc}
          />
        ))}
      </ul>
    </aside>
  );
}
