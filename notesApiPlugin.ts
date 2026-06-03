// Vite dev-server plugin that persists notes as real Markdown files on disk,
// under <project root>/DohDocsNotes/. Each note is one `<id>.md` file; the id
// is a filesystem-safe slug. Titles are derived from the first heading/line, so
// the files stay clean, human-readable Markdown with no extra frontmatter.
//
// This keeps the "all data stored as MD files, local for now" requirement while
// the browser front-end talks to it over a tiny JSON API at /api/notes.

import type { Plugin, Connect } from "vite";
import fs from "node:fs/promises";
import path from "node:path";

const NOTES_DIR = "DohDocsNotes";

function safeId(id: string): string {
  // Allow only slug characters; strip any path traversal.
  return id.replace(/[^a-z0-9-_]/gi, "").slice(0, 120);
}

function deriveTitle(markdown: string): string {
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/^#+\s*/, "").trim();
    if (line) return line.slice(0, 80);
  }
  return "Untitled";
}

async function readBuffer(req: Connect.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  return (await readBuffer(req)).toString("utf8");
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

function json(res: import("node:http").ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function notesApiPlugin(): Plugin {
  return {
    name: "dohdocs-notes-api",
    configureServer(server) {
      const dir = path.resolve(server.config.root, NOTES_DIR);

      const ensureDir = () => fs.mkdir(dir, { recursive: true });

      const fileFor = (id: string) => path.join(dir, `${safeId(id)}.md`);

      const readNote = async (id: string) => {
        const markdown = await fs.readFile(fileFor(id), "utf8");
        const stat = await fs.stat(fileFor(id));
        return { id: safeId(id), title: deriveTitle(markdown), markdown, updatedAt: stat.mtimeMs };
      };

      server.middlewares.use("/api/notes", async (req, res) => {
        try {
          await ensureDir();
          const url = new URL(req.url ?? "/", "http://localhost");
          // /api/notes            -> "" ; /api/notes/<id> -> "<id>"
          const id = decodeURIComponent(url.pathname.replace(/^\//, ""));

          // ---- Image assets: /api/notes/assets/<file> ----
          if (id.startsWith("assets/") || id === "assets") {
            const assetsDir = path.join(dir, "assets");
            await fs.mkdir(assetsDir, { recursive: true });

            if (req.method === "POST") {
              const ext = (url.searchParams.get("ext") || "png").replace(/[^a-z0-9]/gi, "").toLowerCase();
              const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
              await fs.writeFile(path.join(assetsDir, name), await readBuffer(req));
              return json(res, 201, { url: `/api/notes/assets/${name}` });
            }
            if (req.method === "GET") {
              const file = safeId(id.replace(/^assets\//, "").replace(/\.[a-z0-9]+$/i, "")) +
                "." + (id.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? "png");
              const ext = file.split(".").pop() ?? "png";
              const bytes = await fs.readFile(path.join(assetsDir, file));
              res.statusCode = 200;
              res.setHeader("Content-Type", IMAGE_TYPES[ext] ?? "application/octet-stream");
              res.setHeader("Cache-Control", "no-cache");
              return res.end(bytes);
            }
            return json(res, 405, { error: "Method not allowed" });
          }

          if (req.method === "GET" && !id) {
            const q = (url.searchParams.get("q") || "").trim().toLowerCase();
            const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
            let metas = await Promise.all(
              files.map(async (f) => {
                const noteId = f.replace(/\.md$/, "");
                const markdown = await fs.readFile(path.join(dir, f), "utf8");
                const stat = await fs.stat(path.join(dir, f));
                return { id: noteId, title: deriveTitle(markdown), updatedAt: stat.mtimeMs, markdown };
              })
            );
            if (q) {
              metas = metas.filter(
                (m) => m.title.toLowerCase().includes(q) || m.markdown.toLowerCase().includes(q)
              );
            }
            metas.sort((a, b) => b.updatedAt - a.updatedAt);
            // Drop the body from the listing payload.
            return json(res, 200, metas.map(({ markdown, ...meta }) => { void markdown; return meta; }));
          }

          if (req.method === "GET" && id) {
            return json(res, 200, await readNote(id));
          }

          if (req.method === "POST" && !id) {
            const noteId = `note-${Date.now()}`;
            await fs.writeFile(fileFor(noteId), "", "utf8");
            return json(res, 201, await readNote(noteId));
          }

          if (req.method === "PUT" && id) {
            const body = await readBody(req);
            const { markdown } = JSON.parse(body || "{}");
            await fs.writeFile(fileFor(id), markdown ?? "", "utf8");
            return json(res, 200, await readNote(id));
          }

          if (req.method === "DELETE" && id) {
            await fs.rm(fileFor(id), { force: true });
            return json(res, 204, {});
          }

          return json(res, 405, { error: "Method not allowed" });
        } catch (err) {
          return json(res, 500, { error: String(err) });
        }
      });
    },
  };
}
