// Document storage backed by Supabase (Postgres).
// This module is the only place the UI touches persistence — swapping backends
// stays isolated here. The public interface is unchanged from the IndexedDB version.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface DohDoc extends DocMeta {
  /** Canonical document body stored as Markdown. */
  markdown: string;
}

// DB rows use snake_case; map to/from the camelCase interface the UI expects.
type Row = { id: string; title: string; markdown: string; updated_at: number };

function rowToMeta(row: Row): DocMeta {
  return { id: row.id, title: row.title, updatedAt: row.updated_at };
}

function rowToDoc(row: Row): DohDoc {
  return { id: row.id, title: row.title, markdown: row.markdown, updatedAt: row.updated_at };
}

function docToRow(doc: DohDoc): Row {
  return { id: doc.id, title: doc.title, markdown: doc.markdown, updated_at: doc.updatedAt };
}

export async function listDocs(query = ""): Promise<DocMeta[]> {
  const q = query.trim();
  let req = supabase
    .from("notes")
    .select("id, title, updated_at")
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
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();
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

export async function createDoc(): Promise<DohDoc> {
  const doc: DohDoc = {
    id: crypto.randomUUID(),
    title: "Untitled",
    markdown: "",
    updatedAt: Date.now(),
  };
  const { error } = await supabase.from("notes").insert(docToRow(doc));
  if (error) throw error;
  return doc;
}
