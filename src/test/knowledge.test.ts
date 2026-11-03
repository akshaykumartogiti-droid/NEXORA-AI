import { describe, expect, it } from "vitest";

import { KNOWLEDGE_LIMITS, chunkText, isSupportedFile } from "@/lib/knowledge";

describe("knowledge rules", () => {
  it("accepts only plain-text formats", () => {
    expect(isSupportedFile("notes.MD")).toBe(true);
    expect(isSupportedFile("report.pdf")).toBe(true);
    expect(isSupportedFile("report.docx")).toBe(false);
  });
  it("caps files at 1 MB", () => {
    expect(KNOWLEDGE_LIMITS.maxFileBytes).toBe(1_000_000);
  });
  it("chunks long text into bounded pieces", () => {
    const chunks = chunkText("word ".repeat(2000));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= KNOWLEDGE_LIMITS.chunkChars)).toBe(true);
  });
  it("returns no chunks for empty text", () => {
    expect(chunkText("   \n ")).toEqual([]);
  });
});
