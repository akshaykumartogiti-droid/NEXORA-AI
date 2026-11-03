// Shared, browser-safe knowledge base rules.
export const KNOWLEDGE_LIMITS = {
  maxFileBytes: 1_000_000, // 1 MB
  maxDocsPerUser: 50,
  chunkChars: 1500,
  chunkOverlap: 200,
  maxChunksPerDoc: 400,
  searchResults: 6,
} as const;

// Plain-text formats and PDFs (text layer only; scanned images are not read). Word is not supported.
export const SUPPORTED_EXTENSIONS = ["txt", "md", "markdown", "csv", "json", "pdf"] as const;

export function extensionOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function isSupportedFile(name: string) {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

// Splits text into overlapping chunks, preferring paragraph/line breaks.
export function chunkText(text: string, size: number = KNOWLEDGE_LIMITS.chunkChars, overlap: number = KNOWLEDGE_LIMITS.chunkOverlap): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const brk = Math.max(clean.lastIndexOf("\n\n", end), clean.lastIndexOf("\n", end));
      if (brk > start + size / 2) end = brk;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
