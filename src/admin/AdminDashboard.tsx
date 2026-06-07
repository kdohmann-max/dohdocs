import { useEffect, useState } from "react";
import {
  type Profile, type Invitation,
  listProfiles, updateProfileRole,
  listInvitations, deleteInvitation,
  listAllShares, removeShare,
  supabase,
} from "../storage/db";

interface Props {
  onClose: () => void;
}

type Tab = "users" | "invites" | "shares";

export function AdminDashboard({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("users");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [shares, setShares] = useState<{ noteId: string; noteTitle: string; userId: string; userEmail: string; permission: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoadError(null);
    try {
      const [p, i, s] = await Promise.all([listProfiles(), listInvitations(), listAllShares()]);
      setProfiles(p);
      setInvitations(i);
      setShares(s);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRoleToggle(user: Profile) {
    const next = user.role === "admin" ? "member" : "admin";
    try {
      await updateProfileRole(user.id, next);
      setProfiles((prev) => prev.map((p) => p.id === user.id ? { ...p, role: next } : p));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const { error } = await supabase.functions.invoke("invite-user", { body: { email } });
      if (error) throw new Error(error.message);
      setInviteSuccess(true);
      setInviteEmail("");
      void loadAll();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    await deleteInvitation(id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleRevokeShare(noteId: string, userId: string) {
    await removeShare(noteId, userId);
    setShares((prev) => prev.filter((s) => !(s.noteId === noteId && s.userId === userId)));
  }

  return (
    <div className="admin-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2 className="admin-title">Admin Dashboard</h2>
          <button className="admin-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="admin-tabs">
          {(["users", "invites", "shares"] as Tab[]).map((t) => (
            <button key={t} className={`admin-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="admin-body">
          {loadError && <p className="invite-msg invite-msg--err">Load error: {loadError}</p>}
          {tab === "users" && (
            <table className="admin-table">
              <thead><tr><th>User</th><th>Role</th><th>Action</th></tr></thead>
              <tbody>
                {profiles.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        {u.avatarUrl && <img src={u.avatarUrl} className="admin-avatar" alt="" />}
                        <div>
                          <div>{u.displayName ?? u.email}</div>
                          <div className="admin-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`admin-role admin-role--${u.role}`}>{u.role}</span></td>
                    <td>
                      <button className="admin-action-btn" onClick={() => handleRoleToggle(u)}>
                        Make {u.role === "admin" ? "member" : "admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "invites" && (
            <>
              <form className="invite-form" onSubmit={handleInvite}>
                <input className="invite-input" type="email" placeholder="Email address to invite…"
                  value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                <button className="invite-submit" type="submit" disabled={inviting}>
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </form>
              {inviteSuccess && <p className="invite-msg invite-msg--ok">Invite sent.</p>}
              {inviteError && <p className="invite-msg invite-msg--err">{inviteError}</p>}
              <table className="admin-table">
                <thead><tr><th>Email</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{inv.acceptedAt ? "Accepted" : "Pending"}</td>
                      <td>{!inv.acceptedAt && (
                        <button className="admin-action-btn admin-action-btn--danger" onClick={() => handleRevokeInvite(inv.id)}>
                          Revoke
                        </button>
                      )}</td>
                    </tr>
                  ))}
                  {invitations.length === 0 && <tr><td colSpan={3} className="admin-empty">No invitations yet</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {tab === "shares" && (
            <table className="admin-table">
              <thead><tr><th>Note</th><th>Shared with</th><th>Permission</th><th>Action</th></tr></thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={`${s.noteId}-${s.userId}`}>
                    <td>{s.noteTitle}</td>
                    <td>{s.userEmail}</td>
                    <td><span className={`admin-perm admin-perm--${s.permission}`}>{s.permission}</span></td>
                    <td>
                      <button className="admin-action-btn admin-action-btn--danger" onClick={() => handleRevokeShare(s.noteId, s.userId)}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {shares.length === 0 && <tr><td colSpan={4} className="admin-empty">No shared notes</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
