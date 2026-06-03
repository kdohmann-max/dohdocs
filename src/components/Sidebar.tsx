// Document list with search, sort, and theme controls.

import type { DocMeta } from "../storage/db";
import type { Theme } from "../theme";

export type SortMode = "edited" | "name";

interface Props {
  docs: DocMeta[];
  activeId: string | null;
  search: string;
  onSearch: (value: string) => void;
  sort: SortMode;
  onSort: (mode: SortMode) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  docs,
  activeId,
  search,
  onSearch,
  sort,
  onSort,
  theme,
  onToggleTheme,
  onSelect,
  onCreate,
  onDelete,
  isOpen,
  onClose,
}: Props) {
  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      <div className="sidebar-head">
        <span className="brand">DohDocs</span>
        <div className="head-actions">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="new-doc" onClick={onCreate} title="New document">
            +
          </button>
          <button className="sidebar-close" onClick={onClose} title="Close menu">
            ✕
          </button>
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
        {docs.length === 0 && (
          <li className="empty">{search ? "No matches" : "No documents yet"}</li>
        )}
        {docs.map((d) => (
          <li
            key={d.id}
            className={d.id === activeId ? "active" : ""}
            onClick={() => onSelect(d.id)}
          >
            <span className="doc-title">{d.title || "Untitled"}</span>
            <button
              className="del"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${d.title || "Untitled"}"?`)) onDelete(d.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
