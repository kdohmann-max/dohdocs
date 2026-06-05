// Document storage backed by Supabase (Postgres).
// All persistence — notes, folders, sharing, auth — is isolated here.

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://wqbouosruykioizrtlqd.supabase.co",
  "sb_publishable_VUB5I54gSRhAhwmyVUbJbw_OvNQkKQb"
);

// ---- Types ----

export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "admin" | "member";
  createdAt: number;
}

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
  folderId: string | null;
  ownerId: string | null;
}

export interface DohDoc extends DocMeta {
  markdown: string;
  ydocState: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface Share {
  noteId: string;
  userId: string;
  permission: "viewer" | "editor";
  grantedBy: string | null;
  createdAt: number;
  profile: Pick<Profile, "id" | "email" | "displayName" | "avatarUrl">;
}

export interface Invitation {
  id: string;
  email: string;
  invitedBy: string | null;
  createdAt: number;
  acceptedAt: number | null;
}

// ---- Row types (DB snake_case) ----

type Row = {
  id: string; title: string; markdown: string;
  updated_at: number; folder_id: string | null;
  owner_id: string | null; ydoc_state: string | null;
};
type FolderRow = { id: string; name: string; parent_id: string | null; created_at: number; owner_id?: string | null };
type ProfileRow = { id: string; email: string; display_name: string | null; avatar_url: string | null; role: "admin" | "member"; created_at: number };
type ShareRow = { note_id: string; user_id: string; permission: "viewer" | "editor"; granted_by: string | null; created_at: number; profiles: ProfileRow };
type InvitationRow = { id: string; email: string; invited_by: string | null; created_at: number; accepted_at: number | null };

// ---- Mappers ----

function rowToMeta(row: Row): DocMeta {
  return { id: row.id, title: row.title, updatedAt: row.updated_at, folderId: row.folder_id, ownerId: row.owner_id };
}

function rowToDoc(row: Row): DohDoc {
  return { id: row.id, title: row.title, markdown: row.markdown, updatedAt: row.updated_at, folderId: row.folder_id, ownerId: row.owner_id, ydocState: row.ydoc_state };
}

function docToRow(doc: DohDoc): Row {
  return { id: doc.id, title: doc.title, markdown: doc.markdown, updated_at: doc.updatedAt, folder_id: doc.folderId, owner_id: doc.ownerId, ydoc_state: doc.ydocState };
}

function folderRowToFolder(row: FolderRow): Folder {
  return { id: row.id, name: row.name, parentId: row.parent_id, createdAt: row.created_at };
}

function profileRowToProfile(row: ProfileRow): Profile {
  return { id: row.id, email: row.email, displayName: row.display_name, avatarUrl: row.avatar_url, role: row.role, createdAt: row.created_at };
}

function shareRowToShare(row: ShareRow): Share {
  const p = row.profiles;
  return {
    noteId: row.note_id, userId: row.user_id, permission: row.permission,
    grantedBy: row.granted_by, createdAt: row.created_at,
    profile: { id: p.id, email: p.email, displayName: p.display_name, avatarUrl: p.avatar_url },
  };
}

function invRowToInvitation(row: InvitationRow): Invitation {
  return { id: row.id, email: row.email, invitedBy: row.invited_by, createdAt: row.created_at, acceptedAt: row.accepted_at };
}

// ---- Auth / Profiles ----

export async function getProfile(userId: string): Promise<Profile | undefined> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return undefined;
  return profileRowToProfile(data as ProfileRow);
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw error;
  return (data as ProfileRow[]).map(profileRowToProfile);
}

export async function updateProfileRole(userId: string, role: "admin" | "member"): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

export async function findProfileByEmail(email: string): Promise<Profile | undefined> {
  const { data, error } = await supabase.from("profiles").select("*").eq("email", email.toLowerCase()).single();
  if (error) return undefined;
  return profileRowToProfile(data as ProfileRow);
}

// ---- Invitations ----

export async function listInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as InvitationRow[]).map(invRowToInvitation);
}

export async function deleteInvitation(id: string): Promise<void> {
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) throw error;
}

// ---- Notes ----

export async function listDocs(query = ""): Promise<DocMeta[]> {
  const q = query.trim();
  let req = supabase
    .from("notes")
    .select("id, title, updated_at, folder_id, owner_id, ydoc_state")
    .order("updated_at", { ascending: false });

  if (q) {
    req = req.or(`title.ilike.%${q}%,markdown.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error) throw error;
  return (data as Row[]).map(rowToMeta);
}

/** Convert an image file to a base64 data URL so it can be embedded inline. */
export function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function getDoc(id: string): Promise<DohDoc | undefined> {
  const { data, error } = await supabase.from("notes").select("*").eq("id", id).single();
  if (error) return undefined;
  return rowToDoc(data as Row);
}

export async function saveDoc(doc: DohDoc): Promise<void> {
  const { error } = await supabase.from("notes").upsert(docToRow(doc));
  if (error) throw error;
}

export async function deleteDoc(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function createDoc(folderId: string | null = null, ownerId: string | null = null): Promise<DohDoc> {
  const doc: DohDoc = {
    id: crypto.randomUUID(),
    title: "Untitled",
    markdown: "",
    updatedAt: Date.now(),
    folderId,
    ownerId,
    ydocState: null,
  };
  const { error } = await supabase.from("notes").insert(docToRow(doc));
  if (error) throw error;
  return doc;
}

export async function moveDoc(id: string, folderId: string | null): Promise<void> {
  const { error } = await supabase.from("notes").update({ folder_id: folderId }).eq("id", id);
  if (error) throw error;
}

// ---- Folders ----

export async function listFolders(): Promise<Folder[]> {
  const { data, error } = await supabase.from("folders").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data as FolderRow[]).map(folderRowToFolder);
}

export async function createFolder(name: string, parentId: string | null = null, ownerId: string | null = null): Promise<Folder> {
  const folder: Folder = { id: crypto.randomUUID(), name, parentId, createdAt: Date.now() };
  const { error } = await supabase.from("folders").insert({ id: folder.id, name: folder.name, parent_id: folder.parentId, created_at: folder.createdAt, owner_id: ownerId });
  if (error) throw error;
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;
}

// ---- Sharing ----

export async function listShares(noteId: string): Promise<Share[]> {
  const { data, error } = await supabase
    .from("note_shares")
    .select("*, profiles(*)")
    .eq("note_id", noteId);
  if (error) throw error;
  return (data as ShareRow[]).map(shareRowToShare);
}

export async function addShare(noteId: string, userId: string, permission: "viewer" | "editor", grantedBy: string): Promise<void> {
  const { error } = await supabase.from("note_shares").upsert({
    note_id: noteId, user_id: userId, permission, granted_by: grantedBy, created_at: Date.now(),
  });
  if (error) throw error;
}

export async function updateShare(noteId: string, userId: string, permission: "viewer" | "editor"): Promise<void> {
  const { error } = await supabase.from("note_shares").update({ permission }).eq("note_id", noteId).eq("user_id", userId);
  if (error) throw error;
}

export async function removeShare(noteId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("note_shares").delete().eq("note_id", noteId).eq("user_id", userId);
  if (error) throw error;
}

export async function listAllShares(): Promise<{ noteId: string; noteTitle: string; userId: string; userEmail: string; permission: string }[]> {
  const { data, error } = await supabase
    .from("note_shares")
    .select("note_id, permission, notes(title), profiles(email)")
    .order("note_id");
  if (error) throw error;
  return (data as unknown as { note_id: string; permission: string; notes: { title: string } | null; profiles: { email: string } | null }[]).map((r) => ({
    noteId: r.note_id,
    noteTitle: r.notes?.title ?? "Untitled",
    userId: "",
    userEmail: r.profiles?.email ?? "",
    permission: r.permission,
  }));
}
