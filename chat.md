# chat.md — Project Memory

Central reference for project context. Read this first in every new session.

## 1. Project Overview
- Purpose: NEXORA AI — "From intention to execution." AI agent workspace + workflow automation SaaS (fresh project, unrelated to CAMPUZZ).
- Stack: TanStack Start (React 19, Vite 7), Tailwind CSS v4. No backend connected yet.

## 2. What Has Been Built
- Stage 1–3 (2026-11-02): design system (midnight/violet/blue/cyan, Sora/Manrope, dark+light), public pages (/, /features, /pricing [illustrative], /privacy & /terms [placeholders]), /auth (email+Google, forgot password), /reset-password.
- Cloud backend: profiles, projects, conversations, messages, tasks, usage_records — all owner-only.
- /app shell; working: overview, agent (threaded, saved, streaming, rename/delete/copy/retry/stop, project context), tasks, projects, history (paged), usage, settings. Knowledge base built (stage 5): upload .txt/.md/.csv/.json ≤1MB (50 docs max), text split into searchable sections, keyword search, delete; agent tool search_knowledge cites document names and treats document text as untrusted. PDF supported (text layer only, VERIFIED 2026-11-02); Word NOT supported; original files are not kept, only extracted text.
- AI: Lovable AI (openai/gpt-6-astra) via /api/chat; server limits 50/day, 6/min, 8000 chars.

## 3. Requested Changes
- Full NEXORA AI build directive (2026-11-02): landing/features/pricing/auth/legal pages; /app shell with agent, tasks, projects, knowledge, workflows, history, usage, settings, approvals; real OpenAI agent with tool registry + approvals; document RAG; executable workflow builder; per-user security, limits, tests, external deployment docs.
- Brand: deep midnight bg, violet/electric blue/cyan accents, restrained glass, dark+light themes.

## 4. Errors / Bugs to Fix
- Reported TS2367 in src/main.tsx: file does not exist in this project (stale/foreign error). Nothing to fix.
- Reported TS2769 in src/App.tsx: file does not exist (stale/foreign). Real build errors fixed; typecheck + tests pass.
- Reported TS7006 in src/pages/Index.tsx: file does not exist (foreign). Typecheck clean.
- Reported TS2554 in src/pages/NotFound.tsx: file does not exist (foreign).
- Reported TS18048 in src/pages/Index.tsx: file does not exist (foreign).

## 5. Task Status
- Completed: Created chat.md (2026-11-02).
- In progress: —
- Done 2026-11-02: agent tools (list/create/update tasks, max 6 steps) shown in chat; .env.example + DEPLOYMENT.md.
- Done 2026-11-02: agent runs + step log (History), approvals queue with audit trail; task deletion only via approval. VERIFIED end-to-end as owner.
- Completed: knowledge base (VERIFIED 2026-11-02 as user's account: upload, search, agent answered from doc).
- Completed: workflow builder (stage 6) — VERIFIED 2026-11-02 as user's account: sample workflow (input → AI text → condition → create task) ran, AI generated a title, branch taken, task created.
- Workflow limits: 25 steps, 40 connections, 30 runs/day, one run at a time, no loops, one incoming connection per step. Approval gate files a request on the Approvals page; approving continues the run, rejecting cancels it (VERIFIED 2026-11-02). Cancel stops before the next step.
- Completed: final delivery report (DELIVERY_REPORT.md); basic security scan clean.
- Pending: external deployment / publishing (not attempted), legal review of privacy/terms.
- VERIFIED 2026-11-02: signed-in chat streams, agent created+listed a task, messages/usage saved.

## 6. Next Steps
- Read the project text files the user uploads, then fill in this document.

## 7. Must NOT Be Changed / Removed / Implemented
- Never rewrite the whole project for small changes.
- Never remove existing functionality without explicit permission.

## 8. Standing Instructions (from user)
- Read all provided files (any name/extension) before working; judge by content, not filename.
- Latest applicable instruction is the source of truth; ask when unclear or contradictory.
- Keep this file updated whenever new info/files arrive; preserve history, don't record assumptions as facts.
- Make only necessary changes; verify fixes; report honestly if unverified.
- After each task, summarize: what changed, errors fixed, files modified, what remains, whether chat.md was updated.

## 9. Reference Files
| File | Purpose |
|------|---------|
| (none uploaded yet) | |

## 10. Change Log
- 2026-11-02: chat.md created with standing instructions.

- 2026-11-02: Foreign error src/pages/NotFound.tsx TS18048 (file doesn't exist). Built knowledge base: tables knowledge_documents/knowledge_chunks (owner-only), src/lib/knowledge.ts, knowledge.functions.ts, app.knowledge.tsx, search_knowledge agent tool, src/test/knowledge.test.ts. 9 tests pass.
- 2026-11-02: Foreign error src/main.tsx TS2345 (file doesn't exist). Built workflows: tables workflows/workflow_runs (owner-only), src/lib/workflows.ts (validation), workflows.functions.ts (save/run, server-validated), routes app.workflows(.index/.$workflowId) using @xyflow/react, src/test/workflows.test.ts. 15 tests pass. A sample workflow 'Test: summarise and file task' and its task exist in the user's account.
- 2026-11-02: Foreign error src/App.tsx TS18048 (file doesn't exist). Ran security scan (clean), wrote DELIVERY_REPORT.md.
- 2026-11-02: Foreign error src/pages/NotFound.tsx TS2322 (file doesn't exist). Built workflow resume: engine moved to src/lib/workflow-engine.server.ts; approval_gate files a workflow_resume approval; approvals.functions continues/cancels the run. Test workflow 'Test: approval gate' + task 'Approved gate task' exist in user's account.
- 2026-11-02: Foreign error src/pages/Index.tsx TS2769 (file doesn't exist). Added PDF upload (unpdf, server-side, magic-byte check). Test file budget.pdf exists in user's knowledge base.
