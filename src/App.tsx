import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type SortMode } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { useTheme } from "./theme";
import {
  type DocMeta,
  type DohDoc,
  createDoc,
  deleteDoc,
  getDoc,
  listDocs,
  saveDoc,
} from "./storage/db";
import "./App.css";

const EXAMPLE_NOTE = `# DohDocs Formatting Guide

A complete tour of every formatting type the editor supports.

## Headings

### Heading 3

#### Heading 4

## Text Styles

Regular paragraph text. **Bold** and *italic* can be applied from the toolbar or with standard keyboard shortcuts.

==Highlighted text== gets a yellow background from the Highlight extension.

> Blockquotes set off a callout or pulled quote — great for notes-within-notes.

## Priority Marks

Apply these with the **F** button in the toolbar:

<span data-fmt="p1" class="fmt-p1">P1 — red background, highest priority</span>

<span data-fmt="p2" class="fmt-p2">P2 — yellow background, medium priority</span>

<span data-fmt="p3" class="fmt-p3">P3 — blue background, lower priority</span>

<span data-fmt="comment" class="fmt-comment">This is a comment — italic with quotation marks</span>

## Lists

### Bullet List

- First item
- Second item
- Third item with **bold** text inside

### Numbered List

1. Step one
2. Step two
3. Step three

### Task List

- [ ] Unchecked task
- [x] Completed task
- [ ] Another open task

### Nested List (parent items auto-bold)

- Design
  - Create wireframes
  - Review with team
- Development
  - Implement feature
  - Write tests
`;

/** Derive a document title from its first heading or first line of text. */
function deriveTitle(markdown: string): string {
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/^#+\s*/, "").trim();
    if (line) return line.slice(0, 80);
  }
  return "Untitled";
}

export default function App() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [active, setActive] = useState<DohDoc | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>(
    () => (localStorage.getItem("dohdocs-sort") as SortMode) || "edited"
  );
  const { theme, toggle: toggleTheme } = useTheme();
  const initialized = useRef(false);
  const loadSeq = useRef(0);

  // Latest-wins: ignore a slow response if a newer load started meanwhile.
  const loadDocs = useCallback(async (q = search) => {
    const seq = ++loadSeq.current;
    const list = await listDocs(q);
    if (seq === loadSeq.current) setDocs(list);
  }, [search]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      const list = await listDocs();
      setDocs(list);
      if (list.length > 0) {
        setActive((await getDoc(list[0].id)) ?? null);
      } else {
        const doc = await createDoc();
        const seeded = {
          ...doc,
          title: deriveTitle(EXAMPLE_NOTE),
          markdown: EXAMPLE_NOTE,
        };
        await saveDoc(seeded);
        setActive(seeded);
        setDocs(await listDocs());
      }
    })();
  }, []);

  // Debounced search.
  useEffect(() => {
    if (!initialized.current) return;
    const t = setTimeout(() => void loadDocs(search), 250);
    return () => clearTimeout(t);
  }, [search, loadDocs]);

  useEffect(() => {
    localStorage.setItem("dohdocs-sort", sort);
  }, [sort]);

  const sortedDocs = useMemo(() => {
    const list = [...docs];
    if (sort === "name") {
      list.sort((a, b) =>
        (a.title || "Untitled").localeCompare(b.title || "Untitled", undefined, {
          sensitivity: "base",
        })
      );
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }, [docs, sort]);

  async function handleSelect(id: string) {
    setActive((await getDoc(id)) ?? null);
    setSidebarOpen(false);
  }

  async function handleCreate() {
    const doc = await createDoc();
    setActive(doc);
    await loadDocs();
  }

  async function handleDelete(id: string) {
    await deleteDoc(id);
    const list = await listDocs(search);
    loadSeq.current++;
    setDocs(list);
    if (active?.id === id) {
      setActive(list.length ? (await getDoc(list[0].id)) ?? null : null);
    }
  }

  const handleChange = useCallback(
    async (markdown: string) => {
      if (!active) return;
      const updated: DohDoc = {
        ...active,
        markdown,
        title: deriveTitle(markdown),
        updatedAt: Date.now(),
      };
      await saveDoc(updated);
      setActive((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur));
      const list = await listDocs(search);
      loadSeq.current++;
      setDocs(list);
    },
    [active, search]
  );

  return (
    <div className="app">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        docs={sortedDocs}
        activeId={active?.id ?? null}
        search={search}
        onSearch={setSearch}
        sort={sort}
        onSort={setSort}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main">
        {active ? (
          <Editor key={active.id} doc={active} onChange={handleChange} onOpenSidebar={() => setSidebarOpen(true)} />
        ) : (
          <div className="empty-main">Create a document to get started.</div>
        )}
      </main>
    </div>
  );
}
