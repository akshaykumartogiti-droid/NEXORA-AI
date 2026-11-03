import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { KNOWLEDGE_LIMITS, chunkText, extensionOf, isSupportedFile } from "@/lib/knowledge";

const ingestInput = z.object({
  name: z.string().min(1).max(200),
  text: z.string().max(KNOWLEDGE_LIMITS.maxFileBytes).optional(),
  pdfBase64: z.string().max(Math.ceil(KNOWLEDGE_LIMITS.maxFileBytes * 1.37)).optional(),
  projectId: z.string().uuid().nullable(),
});

// Stores a plain-text document and its searchable chunks. Runs as the
// signed-in user, so access rules keep every document private to its owner.
export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ingestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isSupportedFile(data.name)) throw new Error("Unsupported file type. Use .txt, .md, .csv, .json or .pdf.");
    const { count } = await supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= KNOWLEDGE_LIMITS.maxDocsPerUser) throw new Error(`Limit reached: ${KNOWLEDGE_LIMITS.maxDocsPerUser} documents.`);

    let text = data.text ?? "";
    let size = new TextEncoder().encode(text).length;
    let mime = "text/plain";
    if (extensionOf(data.name) === "pdf") {
      if (!data.pdfBase64) throw new Error("Missing PDF content.");
      const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
      if (bytes.length > KNOWLEDGE_LIMITS.maxFileBytes) throw new Error("File is larger than 1 MB.");
      if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("This file is not a valid PDF.");
      size = bytes.length;
      mime = "application/pdf";
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        const res = await extractText(pdf, { mergePages: true });
        text = (Array.isArray(res.text) ? res.text.join("\n\n") : res.text).slice(0, KNOWLEDGE_LIMITS.maxFileBytes);
      } catch {
        text = "";
      }
    }
    const { data: doc, error } = await supabase
      .from("knowledge_documents")
      .insert({ user_id: userId, project_id: data.projectId, name: data.name, mime, size_bytes: size })
      .select("id")
      .single();
    if (error || !doc) throw new Error("Could not save the document.");

    const fail = async (msg: string) => {
      await supabase.from("knowledge_documents").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", doc.id);
      return { id: doc.id, status: "failed" as const, error: msg };
    };

    const chunks = chunkText(text);
    if (chunks.length === 0) return fail(mime === "application/pdf" ? "No readable text found (scanned PDFs are not supported)." : "The file has no readable text.");
    if (chunks.length > KNOWLEDGE_LIMITS.maxChunksPerDoc) return fail("The file is too long to process.");

    const { error: cErr } = await supabase
      .from("knowledge_chunks")
      .insert(chunks.map((content, idx) => ({ document_id: doc.id, user_id: userId, idx, content })));
    if (cErr) return fail("Text could not be indexed.");

    await supabase.from("knowledge_documents").update({ status: "ready", chunk_count: chunks.length, updated_at: new Date().toISOString() }).eq("id", doc.id);
    return { id: doc.id, status: "ready" as const, chunks: chunks.length };
  });
