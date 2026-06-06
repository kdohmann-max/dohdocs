import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import { supabase } from "../storage/db";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface UserInfo {
  name: string;
  color: string;
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

/** Deterministic color derived from a string (e.g. user id). */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360},70%,50%)`;
}

export class SupabaseProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  private channel: RealtimeChannel;
  private docUpdateHandler: (update: Uint8Array, origin: unknown) => void;
  private awarenessUpdateHandler: (changes: { added: number[]; updated: number[]; removed: number[] }) => void;

  constructor(noteId: string, doc: Y.Doc, user: UserInfo) {
    this.doc = doc;
    this.awareness = new Awareness(doc);

    this.channel = supabase.channel(`doc:${noteId}`, {
      config: { broadcast: { self: false }, presence: { key: crypto.randomUUID() } },
    });

    this.channel.on("broadcast", { event: "y-update" }, ({ payload }: { payload: { update: string } }) => {
      Y.applyUpdate(doc, base64ToUint8(payload.update), "remote");
    });

    this.channel.on("broadcast", { event: "awareness" }, ({ payload }: { payload: { update: string } }) => {
      applyAwarenessUpdate(this.awareness, base64ToUint8(payload.update), "remote");
    });

    this.channel.subscribe();

    this.docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      void this.channel.send({ type: "broadcast", event: "y-update", payload: { update: uint8ToBase64(update) } });
    };

    this.awarenessUpdateHandler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed];
      const update = encodeAwarenessUpdate(this.awareness, changed);
      void this.channel.send({ type: "broadcast", event: "awareness", payload: { update: uint8ToBase64(update) } });
    };

    doc.on("update", this.docUpdateHandler);
    this.awareness.on("update", this.awarenessUpdateHandler);
    this.awareness.setLocalStateField("user", user);
  }

  destroy() {
    this.doc.off("update", this.docUpdateHandler);
    this.awareness.off("update", this.awarenessUpdateHandler);
    this.awareness.setLocalState(null);
    this.awareness.destroy();
    void supabase.removeChannel(this.channel);
  }
}
