import { useEffect, useState } from "react";
import { type Share, listShares, addShare, updateShare, removeShare, findProfileByEmail } from "../storage/db";

interface Props {
  noteId: string;
  ownerId: string | null;
  currentUserId: string;
  onClose: () => void;
}

export function SharePanel({ noteId, ownerId, currentUserId, onClose }: Props) {
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"viewer" | "editor">("editor");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = ownerId === currentUserId;

  useEffect(() => {
    void listShares(noteId).then(setShares);
  }, [noteId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setAdding(true);
    setError(null);
    try {
      const profile = await findProfileByEmail(addr);
      if (!profile) {
        setError("No account found for that email. They may need an invite first.");
        return;
      }
      if (profile.id === currentUserId) {
        setError("That's you.");
        return;
      }
      await addShare(noteId, profile.id, permission, currentUserId);
      setShares(await listShares(noteId));
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function handlePermChange(s: Share, perm: "viewer" | "editor") {
    await updateShare(noteId, s.userId, perm);
    setShares((prev) => prev.map((x) => x.userId === s.userId ? { ...x, permission: perm } : x));
  }

  async function handleRemove(s: Share) {
    await removeShare(noteId, s.userId);
    setShares((prev) => prev.filter((x) => x.userId !== s.userId));
  }

  return (
    <div className="share-panel">
      <div className="share-panel-header">
        <span className="share-panel-title">Share this note</span>
        <button className="share-panel-close" onClick={onClose}>✕</button>
      </div>

      {isOwner && (
        <form className="share-add-form" onSubmit={handleAdd}>
          <input
            className="share-email-input"
            type="email"
            placeholder="Add by email…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            className="share-perm-select"
            value={permission}
            onChange={(e) => setPermission(e.target.value as "viewer" | "editor")}
          >
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="share-add-btn" type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      {error && <p className="share-error">{error}</p>}

      {shares.length > 0 ? (
        <ul className="share-list">
          {shares.map((s) => (
            <li key={s.userId} className="share-item">
              <div className="share-item-user">
                {s.profile.avatarUrl && <img src={s.profile.avatarUrl} className="share-avatar" alt="" />}
                <span>{s.profile.displayName ?? s.profile.email}</span>
              </div>
              {isOwner ? (
                <div className="share-item-actions">
                  <select
                    className="share-perm-select"
                    value={s.permission}
                    onChange={(e) => handlePermChange(s, e.target.value as "viewer" | "editor")}
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button className="share-remove-btn" onClick={() => handleRemove(s)} title="Remove">✕</button>
                </div>
              ) : (
                <span className="share-perm-label">{s.permission}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="share-empty">Not shared with anyone yet.</p>
      )}
    </div>
  );
}
