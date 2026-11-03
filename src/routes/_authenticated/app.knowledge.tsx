import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Search, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { KNOWLEDGE_LIMITS, SUPPORTED_EXTENSIONS, isSupportedFile } from "@/lib/knowledge";
import { ingestDocument } from "@/lib/knowledge.functions";

export const Route = createFileRoute("/_authenticated/app/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge — NEXORA AI" }] }),
  component: Knowledge,
});

function Knowledge() {
  const qc = useQueryClient();
  const ingest = useServerFn(ingestDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ name: string; idx: number; content: string }[] | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("id, name, size_bytes, status, error, chunk_count, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["knowledge"] });

  const upload = async (file: File) => {
    if (!isSupportedFile(file.name)) { toast.error("Only .txt, .md, .csv, .json and .pdf files are supported."); return; }
    if (file.size > KNOWLEDGE_LIMITS.maxFileBytes) { toast.error("File is larger than 1 MB."); return; }
    setBusy(true);
    try {
      const name = file.name.slice(0, 200);
      let payload: { name: string; projectId: null; text?: string; pdfBase64?: string } = { name, projectId: null };
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        payload = { ...payload, pdfBase64: btoa(bin) };
      } else {
        payload = { ...payload, text: await file.text() };
      }
      const res = await ingest({ data: payload });
      if (res.status === "ready") toast.success(`${file.name} is ready (${res.chunks} sections).`);
      else toast.error(`${file.name} failed: ${res.error}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    refresh();
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim().slice(0, 200);
    if (term.length < 2) return;
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("content, idx, knowledge_documents(name)")
      .textSearch("fts", term, { type: "websearch", config: "english" })
      .limit(10);
    if (error) { toast.error("Search failed"); return; }
    setResults((data ?? []).map((r) => ({ name: (r.knowledge_documents as { name: string } | null)?.name ?? "?", idx: r.idx, content: r.content })));
  };

  return (
    <div>
      <PageHeader title="Knowledge" description="Private documents the agent can search and cite. Only you can see them." />
      <div className="max-w-3xl space-y-6 p-6">
        <div className="rounded-xl border border-dashed border-border p-5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            aria-label="Choose a document"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="size-4" /> {busy ? "Processing…" : "Upload document"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Supported: {SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(", ")} — up to 1 MB, {KNOWLEDGE_LIMITS.maxDocsPerUser} documents. PDFs must contain real text (scanned pages aren't read). Word files are not supported yet.
          </p>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your documents…" maxLength={200} aria-label="Search documents" />
          <Button type="submit" variant="secondary"><Search className="size-4" /> Search</Button>
        </form>
        {results && (
          <div className="space-y-2">
            {results.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
            {results.map((r, i) => (
              <div key={i} className="rounded-lg border border-border p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-primary">{r.name} · section {r.idx + 1}</p>
                <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && docs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(d.size_bytes / 1024).toFixed(1)} KB ·{" "}
                  {d.status === "ready" ? `Ready · ${d.chunk_count} sections` : d.status === "failed" ? `Failed: ${d.error ?? "unknown"}` : "Processing"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(d.id)} aria-label={`Delete ${d.name}`}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
