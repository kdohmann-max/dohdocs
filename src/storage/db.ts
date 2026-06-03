// Local document storage backed by IndexedDB (via the `idb` package).
// This module is the only place the UI touches persistence — swapping in a
// sync/collaboration backend later stays isolated here.

import { openDB, type IDBPDatabase } from "idb";

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface DohDoc extends DocMeta {
  /** Canonical document body stored as Markdown. */
  markdown: string;
}

const DB_NAME = "dohdocs";
const STORE = "docs";

let _db: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!_db) {
    _db = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return _db;
}

export async function listDocs(query = ""): Promise<DocMeta[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as DohDoc[];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.markdown.toLowerCase().includes(q)
      )
    : all;
  return filtered
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
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
  const db = await getDB();
  return db.get(STORE, id);
}

export async function saveDoc(doc: DohDoc): Promise<void> {
  const db = await getDB();
  await db.put(STORE, doc);
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function createDoc(): Promise<DohDoc> {
  const doc: DohDoc = {
    id: crypto.randomUUID(),
    title: "Untitled",
    markdown: "",
    updatedAt: Date.now(),
  };
  const db = await getDB();
  await db.put(STORE, doc);
  return doc;
}
